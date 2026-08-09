// One-time migration: split the legacy single-file index.html into
// src/styles.css and src/js/*.jsx modules. Run once; the src/ files are the
// source of truth afterwards. Idempotent - safe to re-run against the original
// index.html (kept as index.legacy.html) if we ever need to re-split.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcHtml = readFileSync(join(root, 'index.legacy.html'), 'utf8');
const lines = srcHtml.split('\n');

// --- locate the real <style> block (the first one; later "<style>" strings
//     live inside PDF print-template literals) ------------------------------
const styleOpen = lines.findIndex(l => l.trim() === '<style>');
const styleClose = lines.findIndex((l, i) => i > styleOpen && l.trim() === '</style>');
const css = lines.slice(styleOpen + 1, styleClose).join('\n').trim() + '\n';
writeFileSync(join(root, 'src', 'styles.css'), css);
console.log(`styles.css  ${css.split('\n').length} lines`);

// --- locate the #appsrc JSX blob -------------------------------------------
const appOpen = lines.findIndex(l => l.includes('id="appsrc"'));
const appClose = lines.findIndex((l, i) => i > appOpen && l.trim() === '</script>');
const app = lines.slice(appOpen + 1, appClose);   // inner JSX lines

// --- module boundaries: ordered anchors. Each anchor is a unique substring
//     identifying the FIRST declaration/header of a module. The splitter walks
//     upward from each anchor over contiguous comment/blank lines so the
//     section's header comment travels with its code. -----------------------
const anchors = [
  { file: '01-utils.jsx',                anchor: null },                       // start of file
  { file: '02-storage.jsx',              anchor: 'LOCAL STORAGE ENGINE' },
  { file: '03-firebase.jsx',             anchor: 'FIREBASE CONFIGURATION' },
  { file: '04-team-access.jsx',          anchor: 'MULTI-USER / TEAM ACCESS' },
  { file: '05-csv-utils.jsx',            anchor: 'CSV UTILITIES' },
  { file: '06-pdf-templates.jsx',        anchor: 'GST INVOICE PDF GENERATOR' },
  { file: '07-seed-data.jsx',            anchor: 'SEED DATA' },
  { file: '08-sample-data.jsx',          anchor: 'SAMPLE DATA GENERATOR' },
  { file: '09-auth.jsx',                 anchor: 'UPGRADE MODAL' },
  { file: '10-app.jsx',                  anchor: 'function App({ user=null' },
  { file: '11-masters.jsx',              anchor: 'function CostCentreMaster(' },
  { file: '12-accounts-parties.jsx',     anchor: 'function ChartOfAccounts(' },
  { file: '13-vouchers.jsx',             anchor: 'function Vouchers(' },
  { file: '14-reports.jsx',              anchor: 'function SalesDocs(' },
  { file: '15-gst.jsx',                  anchor: 'function PeriodClose(' },
  { file: '16-finance.jsx',              anchor: 'function MSMEDues(' },
  { file: '17-payroll.jsx',              anchor: 'function GoogleDriveSync(' },
  { file: '18-help.jsx',                 anchor: 'function HelpGuide(' },
  { file: '19-statements-inventory.jsx', anchor: 'function LedgerStatement(' },
];

// resolve each anchor to a start line, walking up over its header comment block
function resolveStart(anchor) {
  if (anchor === null) return 0;
  const hits = app.map((l, i) => l.includes(anchor) ? i : -1).filter(i => i >= 0);
  if (hits.length !== 1) {
    throw new Error(`anchor ${JSON.stringify(anchor)} matched ${hits.length} lines (expected 1)`);
  }
  let i = hits[0];
  while (i > 0) {
    const prev = app[i - 1].trim();
    if (prev.startsWith('//') || prev === '') i--;
    else break;
  }
  return i;
}

const starts = anchors.map(a => resolveStart(a.anchor));
// sanity: strictly increasing
for (let i = 1; i < starts.length; i++) {
  if (starts[i] <= starts[i - 1]) {
    throw new Error(`boundaries out of order at ${anchors[i].file} (${starts[i]} <= ${starts[i - 1]})`);
  }
}

let total = 0;
anchors.forEach((a, idx) => {
  const from = starts[idx];
  const to = idx + 1 < starts.length ? starts[idx + 1] : app.length;
  const body = app.slice(from, to).join('\n').replace(/\s+$/, '') + '\n';
  writeFileSync(join(root, 'src', 'js', a.file), body);
  const n = to - from;
  total += n;
  console.log(`${a.file.padEnd(30)} ${String(n).padStart(6)} lines`);
});
console.log(`TOTAL ${total} lines (appsrc had ${app.length})`);
