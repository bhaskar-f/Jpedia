(() => {
  const preview = window.__SETBGET_TRANSLATION_PREVIEW__;
  if (!preview || window.location.pathname === preview.originalPath) return;
  window.history.replaceState({}, '', preview.originalPath);
})();
