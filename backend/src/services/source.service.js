const crypto = require('crypto');
const { URL } = require('url');
const { RecruitmentSource, JobDiscovery, Job, Board } = require('../models');
const { AppError } = require('../utils/http');
const {registerAdapter,getAdapter}=require('../integrations/recruitment/adapterRegistry');
registerAdapter('MANUAL',{async fetch(source){throw new Error(`Manual source ${source.name} has no automatic adapter.`);},parse(){return[];},normalize(item){return item;}});
registerAdapter('API',require('../integrations/recruitment/jsonApi.adapter'));
function slugify(value) { return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'job'; }
function fingerprintJob(item, sourceId) { const normalized = [String(sourceId), item.externalId || '', item.officialNotificationUrl || item.url || '', slugify(item.title || ''), slugify(item.organization || ''), item.applicationDeadline && !Number.isNaN(new Date(item.applicationDeadline).getTime()) ? new Date(item.applicationDeadline).toISOString().slice(0,10) : ''].join('|'); return crypto.createHash('sha256').update(normalized).digest('hex'); }
function adapterFor(source) { return getAdapter(source.sourceType); }

async function fetchSource(source) {
  const start = Date.now();
  try {
    if(!source.isOfficial)throw new Error('Source has not been verified as an official recruitment source.');
    const adapter = adapterFor(source); if (!adapter) throw new Error(`No verified parser is implemented for ${source.sourceType}. Configure a source-specific adapter before activating fetch.`);
    const raw = await adapter.fetch(source); const parsed = adapter.parse(raw); let discoveredCount = 0;
    for (const rawItem of parsed) {
      const item = adapter.normalize(rawItem); if (!item?.title || !item?.sourceUrl && !item?.url) continue;
      const sourceUrl = item.sourceUrl || item.url; let host; try { host = new URL(sourceUrl).hostname; } catch { continue; }
      let sourceHost; try { sourceHost = new URL(source.websiteUrl).hostname; } catch { continue; }
      if (!(host === sourceHost || host.endsWith(`.${sourceHost}`))) continue;
      const fingerprint = fingerprintJob(item, source._id); const existing = await JobDiscovery.findOne({ $or: [{ fingerprint }, { sourceUrl }] });
      const titleMatch = item.applicationDeadline ? { title: String(item.title).trim(), organization: String(item.organization||source.organization||'').trim(), applicationDeadline: new Date(item.applicationDeadline) } : null;
      const officialDuplicate = item.officialNotificationUrl ? await Job.findOne({ officialNotificationUrl: item.officialNotificationUrl }) : null;
      const sourceDuplicate = item.externalId ? await Job.findOne({ source: source._id, sourceExternalId: item.externalId }) : null;
      const titleDuplicate = !officialDuplicate&&!sourceDuplicate&&titleMatch ? await Job.findOne(titleMatch) : null;
      const status = officialDuplicate || sourceDuplicate || titleDuplicate ? 'DUPLICATE' : 'PENDING_REVIEW';
      const matchedJob = officialDuplicate?._id || sourceDuplicate?._id || titleDuplicate?._id;
      if (existing) {
        if (existing.processingStatus !== 'ERROR') continue;
        Object.assign(existing, { externalId: item.externalId, rawTitle: item.title, rawContent: typeof raw === 'string' ? raw.slice(0, 100000) : undefined, extractedData: item, fingerprint, processingStatus: status, matchedJob, error: undefined });
        existing.processingHistory.push({ status, note: 'Discovery reprocessed from its recruitment source.' });
        await existing.save();
      } else {
        await JobDiscovery.create({ source: source._id, sourceUrl, externalId: item.externalId, rawTitle: item.title, rawContent: typeof raw === 'string' ? raw.slice(0, 100000) : undefined, extractedData: item, fingerprint, processingStatus: status, matchedJob, processingHistory: [{ status, note: 'Discovered from recruitment source.' }] });
      }
      discoveredCount++;
    }
    source.lastFetchedAt = new Date(); source.lastSuccessAt = new Date(); source.lastError = undefined; source.lastFetchedItemCount = discoveredCount; source.nextFetchAt = new Date(Date.now() + (source.fetchInterval || 24) * 3600000); await source.save();
    console.info({ event: 'recruitment_fetch_success', source: source.name, discoveredCount, durationMs: Date.now() - start }); return discoveredCount;
  } catch (error) { source.lastFetchedAt = new Date(); source.lastFailureAt = new Date(); source.lastError = `Fetch failed (${error.code || error.name || 'Error'}).`; source.nextFetchAt = new Date(Date.now() + Math.min(24, source.fetchInterval || 24) * 3600000); await source.save().catch(() => {}); console.error({ event: 'recruitment_fetch_failure', sourceId: String(source._id), errorType: error.name || 'Error', code: error.code }); throw error; }
}
async function fetchAll({ sourceId } = {}) {
  const sources = await RecruitmentSource.find(sourceId ? { _id: sourceId, active: true } : { active: true });
  const results = await Promise.allSettled(sources.map(source => fetchSource(source)));
  return results.map((result, index) => ({ source: sources[index].name, status: result.status, ...(result.status === 'fulfilled' ? { discoveries: result.value } : { error: result.reason.message }) }));
}
async function promoteDiscovery(discovery, reviewer) {
  if (!discovery || discovery.processingStatus !== 'PENDING_REVIEW') throw new AppError(404, 'DISCOVERY_NOT_FOUND', 'Pending discovery was not found.');
  const data = discovery.extractedData || {}; const title = data.title || discovery.rawTitle; const board = data.board ? await Board.findOne({ slug: slugify(data.board) }) : null;
  const job = await Job.create({ title, slug: `${slugify(title)}-${Date.now().toString(36)}`, organization: data.organization || discovery.source.name, board: board?._id, boardName: board?.name, category: data.category, tags: data.tags || [], description: data.description, applicationDeadline: data.applicationDeadline, qualification: data.qualification, location: data.location, officialNotificationUrl: data.officialNotificationUrl || discovery.sourceUrl, source: discovery.source._id, sourceUrl: discovery.sourceUrl, sourceExternalId: discovery.externalId, rawSourceReference: discovery.sourceUrl, status: 'PENDING_REVIEW', verificationStatus: 'PENDING', reviewedBy: reviewer._id });
  discovery.processingStatus = 'MATCHED'; discovery.matchedJob = job._id; discovery.reviewedBy = reviewer._id; discovery.reviewedAt = new Date(); discovery.processingHistory.push({ status: 'MATCHED', actor: reviewer._id, note: 'Promoted into a job pending human review.' }); await discovery.save(); return job;
}
module.exports = { slugify, fingerprintJob, adapterFor, fetchSource, fetchAll, promoteDiscovery };
