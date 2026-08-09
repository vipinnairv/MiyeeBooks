// Network-free wiring test. The org proxy blocks the CDN libs, so we stub
// React/ReactDOM/firebase/XLSX just enough for the modules' TOP-LEVEL code to
// run, then load the REAL compiled dist/js/*.js as 19 separate <script> tags
// (exactly as the deployed page does) and assert:
//   1. every module executes with no top-level ReferenceError,
//   2. cross-module names resolve in the shared global lexical scope,
//   3. the final module fires the ReactDOM mount.
// This exercises the multi-file wiring; it does not render components (that
// needs real React, which the sandbox can't fetch).
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const dist = join(process.cwd(), 'dist', 'js');
const modules = readdirSync(dist).filter(f => f.endsWith('.js')).sort();
const scripts = modules.map(f => `<script src="/js/${f}"></script>`).join('\n');

// probe: bare references to top-level const/function from across modules.
// A bare reference to an uninitialised/undeclared name throws → caught per name.
const probeNames = [
  'fmt', 'uid', 'STORAGE_KEY', 'posLabel', 'STATE_NAMES',   // 01 utils
  'App', 'AuthGate', 'LoginScreen',                          // 09/10
  'CostCentreMaster', 'ChartOfAccounts', 'Vouchers',         // 11/12/13
  'SalesDocs', 'PeriodClose', 'MSMEDues',                    // 14/15/16
  'GoogleDriveSync', 'HelpGuide', 'LedgerStatement',         // 17/18/19
];
const probe = `<script>
window.__probe = {};
${probeNames.map(n => `try{ window.__probe[${JSON.stringify(n)}] = typeof ${n}; }catch(e){ window.__probe[${JSON.stringify(n)}] = 'MISSING:'+e.message; }`).join('\n')}
</script>`;

const stub = `<script>
(function(){
  var hook = function(){ return [undefined, function(){}]; };
  window.React = {
    createElement: function(){ return {__stub:true, args:[].slice.call(arguments)}; },
    Fragment: 'Fragment',
    useState: function(v){ return [typeof v==='function'?v():v, function(){}]; },
    useEffect: function(){}, useMemo: function(f){ try{return f();}catch(e){return undefined;} },
    useRef: function(v){ return {current:v}; }, useCallback: function(f){ return f; },
    useContext: function(){ return undefined; }, createContext: function(){ return {Provider:function(){},Consumer:function(){}}; }
  };
  window.__rendered = false;
  window.ReactDOM = { createRoot: function(el){ return { render: function(node){ window.__rendered = true; window.__mountNode = node; } }; }, render: function(){ window.__rendered = true; } };
  var chain = new Proxy(function(){ return chain; }, { get: function(){ return chain; }, apply: function(){ return chain; } });
  window.firebase = chain;
  window.XLSX = { utils:{}, write:function(){}, writeFile:function(){} };
})();
</script>`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>wiring</title>${stub}</head>
<body><div id="root"></div>
${scripts}
${probe}
</body></html>`;

const server = createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/' ) { res.writeHead(200, {'content-type':'text/html'}); return res.end(html); }
  if (p.startsWith('/js/')) {
    try { res.writeHead(200, {'content-type':'text/javascript'}); return res.end(readFileSync(join(dist, p.slice(4)))); }
    catch { res.writeHead(404); return res.end('nf'); }
  }
  res.writeHead(404); res.end('nf');
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
try { await page.waitForFunction(() => window.__rendered === true, { timeout: 10000 }); } catch {}

const rendered = await page.evaluate(() => window.__rendered);
const probeResult = await page.evaluate(() => window.__probe);

console.log('mount fired    :', rendered);
console.log('cross-module name resolution:');
let bad = 0;
for (const [k, v] of Object.entries(probeResult)) {
  const ok = v === 'function' || (['STATE_NAMES','STORAGE_KEY'].includes(k) && (v === 'object' || v === 'string'));
  if (!ok) bad++;
  console.log(`  ${ok ? 'ok ' : 'XX '} ${k.padEnd(18)} ${v}`);
}
console.log('top-level pageerrors:', errors.length);
errors.slice(0, 20).forEach(e => console.log('   ! ' + e));

await browser.close();
server.close();
const pass = rendered === true && bad === 0 && errors.length === 0;
console.log(pass ? '\nWIRING OK' : '\nWIRING FAILED');
process.exit(pass ? 0 : 1);
