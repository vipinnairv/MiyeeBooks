// Test harness: load the REAL app functions into Node so tests exercise the
// shipped code, not a re-implementation.
//
// The app is a set of classic scripts sharing one global scope. We esbuild each
// src/js/*.jsx exactly as the build does, concatenate them, and run the blob
// inside a single `new Function` with just enough browser stubbed out for the
// module-load-time code to execute (React component definitions, the mount call
// in the last module, the IndexedDB preload). We then `return` the accounting
// functions under test. This is the same shared-global-scope model the browser
// uses — so a test that calls computePeriodBals is calling the same code a user
// does, byte for byte.
import { transform } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root  = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'src', 'js');

const JSX = {
  loader: 'jsx', jsx: 'transform',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  target: 'es2019', minifyWhitespace: false, minifySyntax: false, minifyIdentifiers: false,
};

// Minimal browser surface: enough for top-level code to run without throwing.
const STUBS = `
  const noop = () => {};
  function StubComponent(props){ this.props = props||{}; this.state = {}; }
  StubComponent.prototype.setState = noop;
  StubComponent.prototype.render = function(){ return null; };
  const React = {
    Component: StubComponent,
    createElement: () => ({}),
    Fragment: 'Fragment',
    useState: (v) => [typeof v === 'function' ? v() : v, noop],
    useEffect: noop, useMemo: (f) => { try { return f(); } catch(e){ return undefined; } },
    useRef: (v) => ({ current: v }), useCallback: (f) => f,
    useContext: () => undefined, createContext: () => ({ Provider: noop, Consumer: noop }),
  };
  const ReactDOM = { createRoot: () => ({ render: noop }), render: noop };
  const chain = new Proxy(function(){ return chain; }, { get: () => chain, apply: () => chain });
  const firebase = chain;
  const XLSX = { utils:{}, write: noop, writeFile: noop };
  const localStorage = { _d:{}, getItem(k){ return k in this._d ? this._d[k] : null; }, setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; } };
  const sessionStorage = localStorage;
  const document = { getElementById: () => ({}), createElement: () => ({ style:{}, appendChild: noop, click: noop, remove: noop, setAttribute: noop }), head:{ appendChild: noop }, body:{ appendChild: noop } };
  const location = { reload: noop, href: '' };
  const navigator = { userAgent: 'node' };
  const indexedDB = undefined;   // idbOpen rejects -> preload falls back cleanly
  const window = { addEventListener: noop, removeEventListener: noop, __miyeeUserEmail: 'test@local', location, indexedDB: undefined };
  const alert = noop, confirm = () => true, prompt = () => '';
  const atob = (s) => Buffer.from(s, 'base64').toString('binary');
  const btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  const fetch = () => Promise.reject(new Error('no network in tests'));
  const FileReader = function(){};
  const Blob = function(){}; const URL = { createObjectURL: () => '', revokeObjectURL: noop };
`;

// Names the harness exposes to tests. Add here to test more functions.
const EXPORTS = [
  'fmt', 'affectsLedger', 'computePeriodBals', 'estimateTax', 'companyTaxRate',
  'nextVoucherNumber', 'auditEntry', 'isDateLocked', 'uid',
  'SEED_COA', 'makeFreshData', 'attStripInline', 'upiLink', 'generateRecurring', 'poTotal', 'App',
];

let _api = null;
export async function loadApp(){
  if(_api) return _api;
  const files = readdirSync(jsDir).filter(f => f.endsWith('.jsx')).sort();
  const parts = [];
  for(const f of files){
    const src = readFileSync(join(jsDir, f), 'utf8');
    const out = await transform(src, { ...JSX, sourcefile: f });
    parts.push('/* ' + f + ' */\n' + out.code);
  }
  const body = STUBS + '\n' + parts.join('\n') + '\n'
    + 'return {' + EXPORTS.map(n => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(', ') + '};';
  _api = new Function(body)();
  return _api;
}
