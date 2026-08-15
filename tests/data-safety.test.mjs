// Phase-1 data-layer guarantees, pinned so they cannot silently regress.
//   - attStripInline never lets an attachment payload reach the saved document
//   - the Firestore revision guard refuses a stale save instead of overwriting
// Both run against the REAL shipped code (attStripInline via the harness; the
// concurrency guard by slicing the exact functions out of 03-firebase.jsx).
import { describe, it, assert } from './run.mjs';
import { loadApp } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = await loadApp();

describe('Attachments never bloat the saved document', () => {
  const { attStripInline } = app;
  const bookWith = (n, every) => ({ company:{name:'X'}, coa:[], auditLog:[],
    vouchers: Array.from({length:n}, (_,i) => {
      const v = { id:'v'+i, type:'SAL', date:'2026-04-01', amount:1000+i,
        lines:[{accountId:'2400',debit:1180,credit:0},{accountId:'3100',debit:0,credit:1000},{accountId:'1310',debit:0,credit:180}] };
      if(every && i % every === 0) v.attachments = [{ id:'at'+i, name:'bill.pdf', type:'application/pdf', size:300000, dataUrl:'data:application/pdf;base64,'+'A'.repeat(200000) }];
      return v;
    }) });

  it('strips every inline dataUrl from the persisted payload', () => {
    const lean = attStripInline(bookWith(2000, 25));
    assert.ok(!JSON.stringify(lean).includes('dataUrl'), 'no dataUrl may survive a save');
  });

  it('keeps the reference fields (id/name/type/size) intact', () => {
    const lean = attStripInline(bookWith(100, 10));
    const a = lean.vouchers[0].attachments[0];
    assert.equal(a.id, 'at0'); assert.equal(a.name, 'bill.pdf');
    assert.equal(a.type, 'application/pdf'); assert.equal(a.size, 300000);
  });

  it('collapses the payload dramatically vs the inline form', () => {
    const heavy = bookWith(2000, 25);
    const before = JSON.stringify(heavy).length;
    const after  = JSON.stringify(attStripInline(heavy)).length;
    assert.ok(after * 10 < before, 'stripped payload must be at least 10x smaller (was ' + (before/after).toFixed(1) + 'x)');
  });

  it('returns an attachment-free dataset by identity (no needless churn)', () => {
    const clean = bookWith(50, 0);
    assert.equal(attStripInline(clean), clean, 'unchanged dataset returned as-is');
  });
});

describe('Concurrent saves cannot destroy each other (real fbSaveCompany)', () => {
  // Slice the real guard + save function and run them against a mock Firestore.
  const full  = readFileSync(join(root, 'src/js/03-firebase.jsx'), 'utf8');
  const guard = full.slice(full.indexOf('// ── Concurrency control'), full.indexOf('const fbWatchCompany'));
  const save  = full.slice(full.indexOf('const fbSaveCompany'), full.indexOf('const fbCreateCompany'));
  const build = () => {
    const server = { data:{ rev:0, payload:JSON.stringify({company:{name:'Acme'},vouchers:[]}) } };
    const mkRef = () => ({ get: async () => ({ exists:true, data: () => ({...server.data}) }),
      set: async (o) => { Object.assign(server.data, o); }, collection: () => ({ doc: () => ({}) }) });
    const scope = { fbDb:{}, firebase:{ firestore:{ FieldValue:{ serverTimestamp: () => 'TS' } } },
      window:{ __miyeeUserEmail:'a@x.com' }, console, FB_CHUNK_SIZE:250000,
      capAudit: d=>d, fbCompanyRef: () => mkRef(), fbClearChunks: async()=>{} };
    const api = new Function(...Object.keys(scope),
      guard + '\n' + save + '\nreturn { fbSaveCompany, fbGetRev, fbSetRev, FbConflictError };')(...Object.values(scope));
    return { api, server };
  };

  it('the first saver wins and their entry lands', async () => {
    const { api, server } = build();
    api.fbSetRev('c1', 0);
    const rev = await api.fbSaveCompany('u','c1',{company:{name:'Acme'},vouchers:[{id:'A'}]});
    assert.equal(rev, 1); assert.equal(server.data.rev, 1);
    assert.equal(JSON.parse(server.data.payload).vouchers[0].id, 'A');
  });

  it('a stale second saver is refused, not silently applied', async () => {
    const { api, server } = build();
    api.fbSetRev('c1', 0);
    await api.fbSaveCompany('u','c1',{company:{name:'Acme'},vouchers:[{id:'A'}]});   // rev -> 1
    api.fbSetRev('c1', 0);                                                            // B still on rev 0
    let refused = false, srv = null;
    try { await api.fbSaveCompany('u','c1',{company:{name:'Acme'},vouchers:[{id:'B'}]}); }
    catch(e){ refused = e.name === 'FbConflictError'; srv = e.serverRev; }
    assert.ok(refused, 'stale save must throw FbConflictError');
    assert.equal(srv, 1, 'conflict reports the server revision');
    assert.equal(JSON.parse(server.data.payload).vouchers[0].id, 'A', "victim's data survives");
  });

  it('an explicit force overwrite (Keep mine) is allowed', async () => {
    const { api, server } = build();
    api.fbSetRev('c1', 0);
    await api.fbSaveCompany('u','c1',{company:{name:'Acme'},vouchers:[{id:'A'}]});
    api.fbSetRev('c1', 0);
    await api.fbSaveCompany('u','c1',{company:{name:'Acme'},vouchers:[{id:'B'}]}, { force:true });
    assert.equal(JSON.parse(server.data.payload).vouchers[0].id, 'B');
  });
});
