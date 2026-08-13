// ============================================================================
// ATTACHMENTS  file payloads live outside the ledger document.
// ----------------------------------------------------------------------------
// Previously a receipt was stored as base64 inside the same JSON as the whole
// company, so every save re-serialised every bill ever attached. Measured on
// the real save path: 5,000 vouchers alone = 2.2 MB / 28 ms, but adding 200
// receipts made it 78.5 MB / 1,375 ms - and roughly 314 Firestore writes per
// save, which exhausts the free daily quota in about sixty saves.
//
// Now the voucher/claim carries only a light reference:
//     { id, name, type, size }            <- lives in the dataset
// and the payload is stored separately:
//     IndexedDB 'blobs' store              <- always, works offline
//     Firebase Storage                     <- additionally, when signed in
//
// Legacy records that still carry an inline `dataUrl` keep working and are
// migrated out on load, so existing books shrink without any user action.
// ============================================================================

const ATT_MAX_BYTES = 10 * 1024 * 1024;   // 10 MB - Storage-backed, so generous

// Firebase Storage is optional: absent when not signed in or not configured.
const attBucket = () => {
  try { return (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null; }
  catch(_){ return null; }
};
const attCloudPath = (ownerId, companyId, id) =>
  'users/' + ownerId + '/companies/' + (companyId||'local') + '/attachments/' + id;

// Current cloud coordinates, published by App so this module stays decoupled.
const attCtx = () => (typeof window !== 'undefined' && window.__miyeeAttCtx) || null;

// ── write ───────────────────────────────────────────────────────────────────
// Reads a File into the blob store and returns the light reference to embed in
// the voucher/claim. Cloud upload is fire-and-forget: a failure (offline, rules)
// never blocks the user - the local copy is authoritative and syncs later.
async function attSave(file){
  if(file.size > ATT_MAX_BYTES) throw new Error(file.name + ' is over ' + Math.round(ATT_MAX_BYTES/1048576) + ' MB');
  const dataUrl = await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload  = () => resolve(rd.result);
    rd.onerror = () => reject(new Error('Could not read ' + file.name));
    rd.readAsDataURL(file);
  });
  const ref = { id: uid(), name: file.name, type: file.type, size: file.size };
  try { await blobPut(ref.id, dataUrl); }
  catch(e){ console.warn('attSave: local blob write failed, keeping inline', e); ref.dataUrl = dataUrl; }
  attCloudUpload(ref.id, dataUrl);
  return ref;
}

function attCloudUpload(id, dataUrl){
  const st = attBucket(); const ctx = attCtx();
  if(!st || !ctx || !ctx.ownerId) return;
  try {
    st.ref(attCloudPath(ctx.ownerId, ctx.companyId, id))
      .putString(dataUrl, 'data_url')
      .catch(e => console.warn('attachment cloud upload failed (local copy kept):', e && e.message));
  } catch(e){ console.warn('attachment cloud upload skipped:', e && e.message); }
}

// ── read ────────────────────────────────────────────────────────────────────
// Resolution order: inline (legacy) → local blob store → Firebase Storage.
// The cloud hit is what makes an attachment filed on the office desktop open
// on the accountant's laptop.
async function attData(att){
  if(!att) return null;
  if(att.dataUrl) return att.dataUrl;
  try { const local = await blobGet(att.id); if(local) return local; } catch(_){}
  const st = attBucket(); const ctx = attCtx();
  if(st && ctx && ctx.ownerId){
    try {
      const url = await st.ref(attCloudPath(ctx.ownerId, ctx.companyId, att.id)).getDownloadURL();
      const res = await fetch(url);
      if(res.ok){
        const blob = await res.blob();
        const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        try { await blobPut(att.id, dataUrl); } catch(_){}   // cache locally for next time
        return dataUrl;
      }
    } catch(e){ console.warn('attachment cloud fetch failed:', e && e.message); }
  }
  return null;
}

// Open an attachment in a new tab (used by the voucher/claim file chips).
async function attOpen(att){
  const dataUrl = await attData(att);
  if(!dataUrl){ alert('This file is not available on this device yet.\n\nIt was attached on another device and could not be downloaded - check your connection, or sign in to sync.'); return; }
  const w = window.open('', '_blank');
  if(!w) return;
  const isPdf = /pdf/i.test(att.type||'') || /\.pdf$/i.test(att.name||'');
  const safe = String(att.name||'attachment').replace(/[<>&"]/g,'');
  w.document.write('<html><head><title>'+safe+'</title></head><body style="margin:0;background:#333;text-align:center">'
    + (isPdf ? '<iframe src="'+dataUrl+'" style="width:100%;height:100vh;border:none"></iframe>'
             : '<img src="'+dataUrl+'" style="max-width:100%;margin-top:20px"/>') + '</body></html>');
  w.document.close();
}

async function attDrop(att){
  if(!att) return;
  try { await blobDel(att.id); } catch(_){}
  const st = attBucket(); const ctx = attCtx();
  if(st && ctx && ctx.ownerId){
    try { await st.ref(attCloudPath(ctx.ownerId, ctx.companyId, att.id)).delete(); } catch(_){}
  }
}

// ── migration + save-path guard ─────────────────────────────────────────────
// Walks every attachment-bearing record, moves any inline payload into the blob
// store and strips it from the dataset. Returns the cleaned data plus a count,
// so existing books shrink on first load after this upgrade.
const ATT_HOSTS = ['vouchers','reimbursements','salesDocs'];
async function attMigrateInline(data){
  if(!data) return { data, moved:0 };
  let moved = 0;
  const next = { ...data };
  for(const host of ATT_HOSTS){
    const rows = data[host];
    if(!Array.isArray(rows) || !rows.length) continue;
    let touched = false;
    const out = [];
    for(const row of rows){
      const atts = row && row.attachments;
      if(!Array.isArray(atts) || !atts.some(a => a && a.dataUrl)){ out.push(row); continue; }
      const cleaned = [];
      for(const a of atts){
        if(a && a.dataUrl){
          try { await blobPut(a.id, a.dataUrl); attCloudUpload(a.id, a.dataUrl);
                const { dataUrl, ...rest } = a; cleaned.push(rest); moved++; touched = true; }
          catch(e){ cleaned.push(a); }      // keep inline if the move failed
        } else cleaned.push(a);
      }
      out.push({ ...row, attachments: cleaned });
    }
    if(touched) next[host] = out;
  }
  if(moved) console.info('MiyeeBooks: moved ' + moved + ' attachment(s) out of the dataset document');
  return { data: next, moved };
}

// Synchronous belt-and-braces used by saveData: never let an inline payload
// reach the persisted document, even if migration has not run yet.
function attStripInline(data){
  if(!data) return data;
  let touched = false;
  const next = { ...data };
  for(const host of ATT_HOSTS){
    const rows = data[host];
    if(!Array.isArray(rows) || !rows.length) continue;
    if(!rows.some(r => Array.isArray(r && r.attachments) && r.attachments.some(a => a && a.dataUrl))) continue;
    next[host] = rows.map(r => (Array.isArray(r && r.attachments) && r.attachments.some(a => a && a.dataUrl))
      ? { ...r, attachments: r.attachments.map(a => { if(a && a.dataUrl){ const { dataUrl, ...rest } = a; return rest; } return a; }) }
      : r);
    touched = true;
  }
  return touched ? next : data;
}
