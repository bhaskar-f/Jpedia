const test = require('node:test');
const assert = require('node:assert/strict');
const cloudinary = require('cloudinary').v2;
const { Resource, AuditLog } = require('../models');
const { env } = require('../config/env');
const controller = require('./resource.controller');

const author = { _id: 'author-1', role: 'AUTHOR' };
const pdf = () => ({ originalname: 'guide.pdf', mimetype: 'application/pdf', size: 5, buffer: Buffer.from('%PDF-') });
function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function runUpload({ file = pdf(), body = {}, cloudResult = { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/guide.pdf', public_id: 'j-info/resources/guide', resource_type: 'image', bytes: 5 }, cloudError, createError, configured = true } = {}) {
  const originals = { create: Resource.create, uploadStream: cloudinary.uploader.upload_stream, destroy: cloudinary.uploader.destroy, cloudinaryName: env.cloudinaryName, cloudinaryKey: env.cloudinaryKey, cloudinarySecret: env.cloudinarySecret };
  const destroyed = [];
  if (configured) Object.assign(env, { cloudinaryName: 'demo', cloudinaryKey: 'key', cloudinarySecret: 'secret' });
  else Object.assign(env, { cloudinaryName: '', cloudinaryKey: '', cloudinarySecret: '' });
  Resource.create = async values => { if (createError) throw createError; return { _id: 'resource-1', ...values }; };
  cloudinary.uploader.upload_stream = (options, callback) => ({ end(buffer) { assert.ok(Buffer.isBuffer(buffer)); if (cloudError) callback(cloudError); else callback(null, cloudResult); } });
  cloudinary.uploader.destroy = async (id, options) => { destroyed.push({ id, ...options }); return { result: 'ok' }; };
  const req = { file, body: { title: 'Guide', type: 'OTHER', ...body }, user: author };
  const res = response();
  return controller.upload(req, res).then(() => ({ res, destroyed })).catch(error => { error.response = res; error.destroyed = destroyed; throw error; }).finally(() => {
    Resource.create = originals.create;
    cloudinary.uploader.upload_stream = originals.uploadStream;
    cloudinary.uploader.destroy = originals.destroy;
    Object.assign(env, { cloudinaryName: originals.cloudinaryName, cloudinaryKey: originals.cloudinaryKey, cloudinarySecret: originals.cloudinarySecret });
  });
}

test('Cloudinary upload rejects missing config and missing/invalid files before provider calls', async () => {
  await assert.rejects(runUpload({ configured: false }), error => error.code === 'UPLOAD_PROVIDER_NOT_CONFIGURED');
  await assert.rejects(runUpload({ file: null }), error => error.code === 'FILE_REQUIRED');
  await assert.rejects(runUpload({ file: { ...pdf(), buffer: Buffer.from('not a pdf') } }), error => error.code === 'INVALID_FILE_CONTENT');
});

test('Cloudinary upload persists resource metadata for every supported type', async () => {
  for (const type of ['SYLLABUS', 'PYQ', 'MOCK_TEST', 'STUDY_MATERIAL', 'OTHER']) {
    const { res } = await runUpload({ body: { type, accessMode: 'DOWNLOAD' } });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.sourceType, 'UPLOAD');
    assert.equal(res.body.data.type, type);
    assert.equal(res.body.data.accessMode, 'DOWNLOAD');
    assert.equal(res.body.data.cloudinaryPublicId, 'j-info/resources/guide');
    assert.equal(res.body.data.cloudinaryResourceType, 'image');
    assert.equal(res.body.data.mimeType, 'application/pdf');
  }
});

test('Cloudinary failures create no Resource and return a safe error', async () => {
  await assert.rejects(runUpload({ cloudError: Object.assign(new Error('provider detail'), { http_code: 401 }) }), error => error.code === 'CLOUDINARY_UPLOAD_FAILED' && !error.message.includes('provider detail'));
});

test('database failure after upload removes the orphaned Cloudinary asset', async () => {
  await assert.rejects(runUpload({ createError: new Error('database unavailable') }), error => error.message === 'database unavailable' && error.destroyed.some(asset => asset.id === 'j-info/resources/guide' && asset.resource_type === 'image'));
});

test('external URL creation does not call Cloudinary', async () => {
  const originals = { create: Resource.create, audit: AuditLog.create, uploadStream: cloudinary.uploader.upload_stream };
  let uploadCalls = 0;
  Resource.create = async values => ({ _id: 'external-1', ...values });
  AuditLog.create = async () => ({});
  cloudinary.uploader.upload_stream = () => { uploadCalls++; throw new Error('should not upload'); };
  try {
    const res = response();
    await controller.create({ body: { title: 'External', type: 'OTHER', url: 'https://example.org/resource' }, user: author }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.sourceType, 'EXTERNAL_URL');
    assert.equal(uploadCalls, 0);
  } finally {
    Resource.create = originals.create;
    AuditLog.create = originals.audit;
    cloudinary.uploader.upload_stream = originals.uploadStream;
  }
});
