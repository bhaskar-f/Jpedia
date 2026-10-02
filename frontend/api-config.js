/* Local/combined-host default. The frontend build replaces this with its
   environment-specific public API origin. This file contains no secrets. */
window.JPEDIA_CONFIG = window.JPEDIA_CONFIG || {
  API_BASE_URL: window.JINFO_API_BASE ||
    (window.location.port && window.location.port !== "3000"
      ? `http://${window.location.hostname}:3000/api`
      : `${window.location.origin}/api`),
};
