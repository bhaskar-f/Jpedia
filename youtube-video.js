(function attachYouTubeVideoId(root, factory) {
  const parseYouTubeVideoId = factory();
  if (typeof module === "object" && module.exports) module.exports = parseYouTubeVideoId;
  if (root) root.JInfoYouTubeVideoId = parseYouTubeVideoId;
})(typeof window === "undefined" ? null : window, function createParser() {
  return function parseYouTubeVideoId(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value.trim());
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      let id = "";
      if (host === "youtu.be") {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length === 1) id = parts[0];
      } else if (host === "youtube.com" || host === "www.youtube.com") {
        const parts = url.pathname.split("/").filter(Boolean);
        if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
        else if (parts.length === 2 && parts[0] === "embed") id = parts[1];
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  };
});
