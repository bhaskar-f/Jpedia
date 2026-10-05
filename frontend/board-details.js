(() => {
  if (!window.location.pathname.startsWith('/boards/')) return;
  const root = document.querySelector('#boardDetailRoot');
  if (!root) return;
  const i18n = window.SetBGetI18n;
  const t = (key, values) => i18n?.t(key, values) ?? key;
  const formatDate = value => i18n?.formatDate(value) || new Date(value).toLocaleDateString();
  const API_BASE = window.JPEDIA_CONFIG?.API_BASE_URL || window.JINFO_API_BASE || `${window.location.origin}/api`;
  let currentPage = 1;
  const el = (tag, cls = '', text) => { const item = document.createElement(tag); if (cls) item.className = cls; if (text !== undefined) item.textContent = text; return item; };
  const api = async path => {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) { const error = new Error(result.error?.message || t('errors.requestFailed')); error.status = response.status; error.code = result.error?.code; throw error; }
    return result;
  };
  const apiError = (error, fallbackKey) => {
    if (error?.code || error?.status) {
      const key = i18n?.errorKey(error);
      const translated = key ? t(key) : key;
      if (translated && translated !== key) return translated;
    }
    return t(fallbackKey);
  };
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim() || !/^https?:\/\//i.test(value.trim())) return null;
    try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  }
  function externalLink(label, value) {
    const href = safeUrl(value); if (!href) return null;
    const link = el('a', 'board-detail-link', label); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
  }
  function jobsSection(title, jobs) {
    if (!jobs?.length) return null;
    const section = el('section', 'board-detail-section'); section.append(el('h2', '', title));
    const list = el('div', 'board-detail-job-list');
    jobs.forEach(job => {
      const card = el('article', 'board-detail-job');
      const link = el('a', '', job.title || t('boards.jobDetails')); link.href = `/jobs/${encodeURIComponent(job._id)}`;
      card.append(link);
      if (job.organization) card.append(el('p', '', job.organization));
      if (job.applicationDeadline) card.append(el('small', '', `${t('boards.deadlinePrefix')} ${formatDate(job.applicationDeadline)}`));
      list.append(card);
    });
    section.append(list); return section;
  }
  function resourceSection(title, items) {
    if (!items.length) return null;
    const section = el('section', 'board-detail-section'); section.append(el('h2', '', title));
    const list = el('ul', 'board-detail-resources');
    items.forEach(item => {
      const row = el('li'); const href = safeUrl(item.url || item.cloudinaryUrl || item.youtubeUrl);
      if (href) { const anchor = el('a', '', `${item.title} ↗`); const action = item.accessMode === 'DOWNLOAD' ? t('examPreparation.downloadResource') : t('examPreparation.openResource'); anchor.setAttribute('aria-label', `${action}: ${item.title}`); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; row.append(anchor); }
      else row.append(el('span', '', item.title));
      if (item.description) row.append(el('p', '', item.description));
      list.append(row);
    });
    section.append(list); return section;
  }
  function pagination(meta, page, onPage) {
    if (meta.total <= meta.limit) return null;
    const bar = el('nav', 'board-detail-pagination'); bar.setAttribute('aria-label', t('accessibility.boardJobsPagination'));
    const previous = el('button', 'board-detail-page-button', t('boards.previous')); previous.type = 'button'; previous.disabled = page <= 1; previous.addEventListener('click', () => onPage(page - 1));
    const next = el('button', 'board-detail-page-button', t('boards.next')); next.type = 'button'; next.disabled = !meta.hasNextPage; next.addEventListener('click', () => onPage(page + 1));
    bar.append(previous, el('span', '', t('boards.pageResults', { page, count: meta.total })), next); return bar;
  }
  async function load(page = 1) {
    await i18n?.ready;
    currentPage = page;
    document.body.classList.add('board-details-shell');
    root.hidden = false; root.replaceChildren(el('p', 'board-detail-state', t('boards.loadingDetail')));
    const slug = window.location.pathname.slice('/boards/'.length).split('/')[0];
    try {
      const result = await api(`/boards/${encodeURIComponent(decodeURIComponent(slug))}?page=${page}&limit=20`);
      const { board, jobs = [], upcomingJobs = [], resources = [] } = result.data;
      if (!board) { root.replaceChildren(el('p', 'board-detail-state', t('boards.notFound'))); return; }
      document.title = `${board.name} ${t('boards.titleSuffix')} | SetBGet`;
      const canonical = `https://www.setbget.in/boards/${encodeURIComponent(board.slug || slug)}`;
      const description = String(board.shortDescription || board.description || `${t('boards.fallbackDescriptionPrefix')} ${board.name} ${t('boards.fallbackDescriptionSuffix')}`).replace(/\s+/g, ' ').slice(0, 300);
      const setMeta = (selector, attr, value, tag, key, keyValue) => { let node = document.head.querySelector(selector); if (!node) { node = document.createElement(tag); node.setAttribute(key, keyValue); document.head.append(node); } node.setAttribute(attr, value); };
      setMeta('meta[name="description"]', 'content', description, 'meta', 'name', 'description');
      setMeta('link[rel="canonical"]', 'href', canonical, 'link', 'rel', 'canonical');
      setMeta('meta[name="robots"]', 'content', 'index, follow', 'meta', 'name', 'robots');
      setMeta('meta[property="og:title"]', 'content', document.title, 'meta', 'property', 'og:title');
      setMeta('meta[property="og:description"]', 'content', description, 'meta', 'property', 'og:description');
      setMeta('meta[property="og:url"]', 'content', canonical, 'meta', 'property', 'og:url');
      setMeta('meta[name="twitter:url"]', 'content', canonical, 'meta', 'name', 'twitter:url');
      const pageNode = el('main', 'board-detail-page');
      const top = el('header', 'board-detail-top');
      const home = el('a', 'board-detail-brand', 'j-i'); home.href = '/'; home.setAttribute('aria-label', t('accessibility.setbgetHome')); top.append(home);
      const header = el('header', 'board-detail-header');
      const iconUrl = safeUrl(board.icon);
      if (iconUrl) { const image = el('img', 'board-detail-logo'); image.src = iconUrl; image.alt = ''; image.loading = 'lazy'; header.append(image); }
      else if (board.icon && typeof window.icon === 'function') header.append(window.icon(board.icon, 'board-detail-symbol'));
      else header.append(el('span', 'board-detail-mark', (board.name || 'B').slice(0, 1).toUpperCase()));
      const intro = el('div', 'board-detail-intro');
      intro.append(el('h1', '', board.name));
      if (board.shortDescription) intro.append(el('p', 'board-detail-short', board.shortDescription));
      if (board.organization) intro.append(el('p', '', board.organization));
      if (board.location) intro.append(el('p', '', board.location));
      header.append(intro);
      const links = el('div', 'board-detail-links');
      const website = externalLink(`${t('boards.visitOfficialWebsite')} ↗`, board.officialWebsite);
      const notices = externalLink(`${t('boards.officialNotifications')} ↗`, board.officialNotificationWebsite);
      if (website) links.append(website); if (notices) links.append(notices); if (links.children.length) header.append(links);
      pageNode.append(top, header);
      pageNode.setAttribute('aria-label', t('accessibility.boardDetailsRegion'));
      if (board.description || board.about) { const section = el('section', 'board-detail-section'); section.append(el('h2', '', t('boards.aboutBoard')), el('p', '', board.description || board.about)); pageNode.append(section); }
      if (upcomingJobs.length) pageNode.append(jobsSection(t('boards.upcomingJobs'), upcomingJobs));
      const latest = jobsSection(t('boards.latestJobs'), jobs);
      if (latest) { pageNode.append(latest); const pages = pagination(result.pagination || {total:0,limit:20,hasNextPage:false}, page, load); if (pages) pageNode.append(pages); }
      else if (!(result.pagination?.total)) pageNode.append(el('p', 'board-detail-state', t('boards.noPublishedJobs')));
      const syllabus = resources.filter(item => item.type === 'SYLLABUS');
      const papers = resources.filter(item => item.type === 'PYQ');
      const mocks = resources.filter(item => item.type === 'MOCK_TEST');
      const study = resources.filter(item => item.type === 'STUDY_MATERIAL');
      const prep = el('section', 'board-detail-section'); prep.append(el('h2', '', t('boards.preparation')));
      const groups = [resourceSection(t('examPreparation.types.syllabus'), syllabus), resourceSection(t('examPreparation.types.previousPapers'), papers), resourceSection(t('examPreparation.types.mockTests'), mocks), resourceSection(t('examPreparation.types.studyMaterials'), study)].filter(Boolean);
      if (groups.length) prep.append(...groups); else prep.append(el('p', 'board-detail-state', t('boards.preparationEmpty')));
      pageNode.append(prep);
      root.replaceChildren(pageNode);
    } catch (error) {
      root.replaceChildren(el('p', 'board-detail-state', apiError(error, error.status === 404 ? 'boards.notFound' : 'boards.detailLoadError')));
    }
  }
  document.addEventListener('setbget:localechange', () => load(currentPage));
  load();
})();
