(() => {
  if (!window.location.pathname.startsWith('/boards/')) return;
  const root = document.querySelector('#boardDetailRoot');
  if (!root) return;
  const API_BASE = window.JPEDIA_CONFIG?.API_BASE_URL || window.JINFO_API_BASE || `${window.location.origin}/api`;
  const el = (tag, cls = '', text) => { const item = document.createElement(tag); if (cls) item.className = cls; if (text !== undefined) item.textContent = text; return item; };
  const api = async path => {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) { const error = new Error(result.error?.message || `Request failed (${response.status})`); error.status = response.status; throw error; }
    return result;
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
      const link = el('a', '', job.title || 'Job details'); link.href = `/jobs/${encodeURIComponent(job._id)}`;
      card.append(link);
      if (job.organization) card.append(el('p', '', job.organization));
      if (job.applicationDeadline) card.append(el('small', '', `Deadline: ${new Date(job.applicationDeadline).toLocaleDateString()}`));
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
      if (href) { const anchor = el('a', '', `${item.title} ↗`); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; row.append(anchor); }
      else row.append(el('span', '', item.title));
      if (item.description) row.append(el('p', '', item.description));
      list.append(row);
    });
    section.append(list); return section;
  }
  function pagination(meta, page, onPage) {
    if (meta.total <= meta.limit) return null;
    const bar = el('nav', 'board-detail-pagination'); bar.setAttribute('aria-label', 'Board jobs pages');
    const previous = el('button', 'board-detail-page-button', 'Previous'); previous.disabled = page <= 1; previous.addEventListener('click', () => onPage(page - 1));
    const next = el('button', 'board-detail-page-button', 'Next'); next.disabled = !meta.hasNextPage; next.addEventListener('click', () => onPage(page + 1));
    bar.append(previous, el('span', '', `Page ${page}`), next); return bar;
  }
  async function load(page = 1) {
    document.body.classList.add('board-details-shell');
    root.hidden = false; root.replaceChildren(el('p', 'board-detail-state', 'Loading board...'));
    const slug = window.location.pathname.slice('/boards/'.length).split('/')[0];
    try {
      const result = await api(`/boards/${encodeURIComponent(decodeURIComponent(slug))}?page=${page}&limit=20`);
      const { board, jobs = [], upcomingJobs = [], resources = [] } = result.data;
      if (!board) { root.replaceChildren(el('p', 'board-detail-state', 'Board not found.')); return; }
      document.title = `${board.name} Recruitment Board | SetBGet`;
      const canonical = `https://www.setbget.in/boards/${encodeURIComponent(board.slug || slug)}`;
      const description = String(board.shortDescription || board.description || `Browse published recruitment notices from ${board.name} on SetBGet.`).replace(/\s+/g, ' ').slice(0, 300);
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
      const home = el('a', 'board-detail-brand', 'j-i'); home.href = '/'; top.append(home);
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
      const website = externalLink('Visit Official Website ↗', board.officialWebsite);
      const notices = externalLink('Official Notifications ↗', board.officialNotificationWebsite);
      if (website) links.append(website); if (notices) links.append(notices); if (links.children.length) header.append(links);
      pageNode.append(top, header);
      if (board.description || board.about) { const section = el('section', 'board-detail-section'); section.append(el('h2', '', 'About this Board'), el('p', '', board.description || board.about)); pageNode.append(section); }
      if (upcomingJobs.length) pageNode.append(jobsSection('Upcoming Jobs', upcomingJobs));
      const latest = jobsSection('Latest Jobs', jobs);
      if (latest) { pageNode.append(latest); const pages = pagination(result.pagination || {total:0,limit:20,hasNextPage:false}, page, load); if (pages) pageNode.append(pages); }
      else if (!(result.pagination?.total)) pageNode.append(el('p', 'board-detail-state', 'No published jobs for this board yet.'));
      const syllabus = resources.filter(item => item.type === 'SYLLABUS');
      const papers = resources.filter(item => item.type === 'PYQ');
      const mocks = resources.filter(item => item.type === 'MOCK_TEST');
      const study = resources.filter(item => item.type === 'STUDY_MATERIAL');
      const prep = el('section', 'board-detail-section'); prep.append(el('h2', '', 'Preparation'));
      const groups = [resourceSection('Syllabus', syllabus), resourceSection('Previous Papers', papers), resourceSection('Mock Tests', mocks), resourceSection('Study Materials', study)].filter(Boolean);
      if (groups.length) prep.append(...groups); else prep.append(el('p', 'board-detail-state', 'Preparation resources will appear here when available.'));
      pageNode.append(prep);
      root.replaceChildren(pageNode);
    } catch (error) {
      root.replaceChildren(el('p', 'board-detail-state', error.status === 404 ? 'Board not found.' : 'Unable to load this board right now.'));
    }
  }
  load();
})();
