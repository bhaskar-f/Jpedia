(() => {
  const reportError = (message) => {
    console.error('[translation-preview]', message);
    window.__SETBGET_TRANSLATION_PREVIEW_ERROR__ = String(message);
    const status = document.querySelector('#translationPreviewError');
    if (status) {
      status.hidden = false;
      status.textContent = `Preview could not render: ${message}`;
    }
  };
  window.addEventListener('error', event => reportError(event.message || 'JavaScript error'));
  window.addEventListener('unhandledrejection', event => reportError(event.reason?.stack || event.reason?.message || event.reason || 'Unhandled promise rejection'));

  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(window.location.hostname)) {
    document.documentElement.innerHTML = '<head><title>Local preview only</title></head><body>This translation preview is available on localhost only.</body>';
    return;
  }

  const fixtureFactory = window.SetBGetTranslationPreviewFixture;
  if (!fixtureFactory) {
    reportError('The stored translation test fixture did not load. Check /dev-fixtures/content-translated-job.fixture.js.');
    return;
  }
  const job = fixtureFactory.translatedJob();
  job.status = 'PUBLISHED';
  // job-details.js normally gets this shared icon helper from script.js;
  // the isolated preview supplies only that dependency without booting the app shell.
  const iconPaths = {
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H4V10"/>',
    work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6m0-5c4-1 6 1 6 5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.1M4 12h.1M4 18h.1"/>',
  };
  window.icon = (name, className = '') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `icon ${className}`.trim());
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.innerHTML = iconPaths[name] || iconPaths.list;
    return svg;
  };
  const originalPath = window.location.pathname;
  const fixturePath = `/jobs/${encodeURIComponent(job.slug)}`;
  window.history.replaceState({ translationPreview: true }, '', fixturePath);
  window.JPEDIA_CONFIG = Object.freeze({ API_BASE_URL: `${window.location.origin}/api` });

  const jsonResponse = (data, status = 200) => new Response(
    JSON.stringify(status >= 400
      ? { success: false, error: { message: 'Preview request unavailable.' } }
      : { success: true, data }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (url.pathname.startsWith('/api/')) console.info('[translation-preview] intercepted', url.pathname);
    if (url.pathname.startsWith('/locales/')) {
      return originalFetch(`${url.pathname}${url.search}`, options);
    }
    if (url.pathname === `/api/jobs/public/${encodeURIComponent(job.slug)}` ||
        url.pathname === `/api/jobs/public/${encodeURIComponent(job._id)}`) {
      return jsonResponse(job);
    }
    if (url.pathname === `/api/jobs/public/${encodeURIComponent(job._id)}/related`) {
      return jsonResponse([]);
    }
    if (url.pathname === '/api/users/me' || url.pathname === '/api/auth/refresh') {
      return jsonResponse(null, 401);
    }
    if (url.pathname.startsWith('/api/')) {
      return jsonResponse(null, 404);
    }
    return originalFetch(input, options);
  };

  window.__SETBGET_TRANSLATION_PREVIEW__ = Object.freeze({ originalPath });
})();
