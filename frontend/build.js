const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const output = path.join(root, 'public');
if (process.env.VERCEL === '1' && !process.env.PUBLIC_API_BASE_URL)
  throw new Error('Set PUBLIC_API_BASE_URL separately in the Vercel Production and Preview environments.');
const apiBase = process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
let parsed;
try { parsed = new URL(apiBase); } catch { throw new Error('PUBLIC_API_BASE_URL must be an absolute API URL.'); }
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.pathname.replace(/\/$/, '').endsWith('/api'))
  throw new Error('PUBLIC_API_BASE_URL must be an HTTP(S) API base URL ending in /api.');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'data'), { recursive: true });
for (const name of ['index.html', 'style.css', 'script.js', 'admin.js', 'public-pages.js', 'job-details.js', 'board-details.js', 'job-content.js', 'youtube-video.js', 'data.json', 'logo.png', 'favicon.png'])
  fs.copyFileSync(path.join(root, name), path.join(output, name));
for (const name of ['qualification-taxonomy.json', 'india-locations.json', 'job-taxonomy.json'])
  fs.copyFileSync(path.join(root, 'data', name), path.join(output, 'data', name));
fs.writeFileSync(path.join(output, 'api-config.js'), `window.JPEDIA_CONFIG = Object.freeze({ API_BASE_URL: ${JSON.stringify(apiBase.replace(/\/$/, ''))} });\n`);
console.info('Built static SetBGet frontend with public API origin:', parsed.origin);
