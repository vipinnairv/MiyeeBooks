// Headless smoke test: serve dist/ and confirm the app boots - #root gets
// populated and no uncaught errors fire. Not committed to CI; local check only.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';

const dist = join(process.cwd(), 'dist');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(dist, p);
  if (!existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
// wait for React to mount something into #root
let mounted = false;
try {
  await page.waitForFunction(() => {
    const r = document.getElementById('root');
    return r && r.children.length > 0;
  }, { timeout: 15000 });
  mounted = true;
} catch {}

const rootHtmlLen = await page.evaluate(() => (document.getElementById('root')||{}).innerHTML?.length || 0);
const bodyText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 200).replace(/\s+/g,' ').trim();

console.log('mounted        :', mounted);
console.log('#root html len :', rootHtmlLen);
console.log('visible text   :', JSON.stringify(bodyText));
// Ignore benign network errors for external CDNs that the sandbox may block.
const realErrors = errors.filter(e =>
  !/net::ERR|Failed to load resource|firebase|gstatic|unpkg|ERR_/i.test(e));
console.log('error count    :', errors.length, '(non-network:', realErrors.length + ')');
if (errors.length) console.log('--- errors ---\n' + errors.slice(0, 20).join('\n'));

await browser.close();
server.close();
process.exit(mounted && realErrors.length === 0 ? 0 : 1);
