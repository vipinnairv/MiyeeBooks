// ============================================================================
// AUDIT TRAIL  append-only, uncapped, stored apart from the data it describes.
// ----------------------------------------------------------------------------
// The trail used to live inside the same mutable company document as the
// records it audits, and was trimmed to the most recent 1,000 entries on every
// save. That makes it evidence nobody can rely on: the same write that changes
// a voucher can rewrite the line describing the change, and older history
// simply disappears.
//
// Rule 3(1) of the Companies (Accounts) Rules expects an audit trail that
// cannot be disabled or edited. So entries are now appended to:
//   * an IndexedDB 'audit' store - append-only, never trimmed, works offline
//   * a Firestore subcollection  - one document per entry, so a company save
//                                  physically cannot rewrite or drop them
// The copy inside the dataset stays as a fast cache for the recent view.
// ============================================================================

function auditIdbOpen(){
  return new Promise((resolve, reject) => {
    if(!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open('miyeebooks_audit', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('audit')) db.createObjectStore('audit', { autoIncrement:true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// Append one entry. Never throws into the caller: an audit write must not be
// able to block the business action it is recording.
function auditAppend(entry){
  try {
    auditIdbOpen().then(db => {
      const tx = db.transaction('audit','readwrite');
      tx.objectStore('audit').add(entry);
    }).catch(()=>{});
  } catch(_){}
  try {
    const ctx = (typeof window !== 'undefined' && window.__miyeeAttCtx) || null;
    if(ctx && ctx.ownerId && ctx.companyId && typeof fbDb !== 'undefined' && fbDb){
      fbDb.collection('users').doc(ctx.ownerId)
        .collection('companies').doc(ctx.companyId)
        .collection('audit').add(entry)
        .catch(()=>{});          // offline or rules: the local copy still holds
    }
  } catch(_){}
  return entry;
}

// Read the durable local trail, newest first. Used by the Audit Trail page so
// history older than the in-dataset cache is still visible.
function auditReadAll(limit=5000){
  return auditIdbOpen().then(db => new Promise((resolve) => {
    const out = [];
    const rq = db.transaction('audit','readonly').objectStore('audit').openCursor(null, 'prev');
    rq.onsuccess = () => {
      const cur = rq.result;
      if(!cur || out.length >= limit) return resolve(out);
      out.push(cur.value); cur.continue();
    };
    rq.onerror = () => resolve(out);
  })).catch(() => []);
}

// Export the full trail as CSV - what an auditor actually asks for.
function auditExportCsv(rows){
  const esc = (v) => '"' + String(v==null?'':v).replace(/"/g,'""') + '"';
  const csv = ['Timestamp,User,Action,Detail']
    .concat((rows||[]).map(r => [r.ts, r.user, r.action, r.detail].map(esc).join(',')))
    .join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'audit-trail-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
