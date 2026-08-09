
// ============================================================================
// LOCAL STORAGE ENGINE  IndexedDB primary, localStorage fallback
// localStorage caps at ~5 MB - with attachments and years of vouchers that
// overflows silently. IndexedDB allows hundreds of MB. Because IndexedDB is
// async-only while the app expects a synchronous loadData() at first render,
// idbPreload() runs BEFORE ReactDOM renders and stashes the dataset in
// __IDB_PRELOADED; loadData() then returns it synchronously. On the very first
// run after this upgrade, any existing localStorage dataset is migrated into
// IndexedDB once and the old blob removed. If IndexedDB is unavailable
// (blocked/private mode), everything falls back to the old localStorage path.
// ============================================================================
let __IDB_OK = false;              // set true once the DB opens successfully
let __IDB_PRELOADED = undefined;   // undefined = preload didn't run → sync fallback
let __IDB_DB = null;

function idbOpen(){
  return new Promise((resolve, reject) => {
    if(__IDB_DB) return resolve(__IDB_DB);
    if(!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open('miyeebooks', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv'); };
    req.onsuccess = () => { __IDB_DB = req.result; __IDB_OK = true; resolve(__IDB_DB); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}
function idbGet(key){
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const rq = db.transaction('kv','readonly').objectStore('kv').get(key);
    rq.onsuccess = () => resolve(rq.result != null ? rq.result : null);
    rq.onerror = () => reject(rq.error);
  }));
}
function idbSet(key, value){
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv','readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}
function idbDel(key){
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv','readwrite');
    tx.objectStore('kv').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// Runs once before first render. Loads from IndexedDB; if empty, performs the
// one-time localStorage → IndexedDB migration (only removing the localStorage
// blob AFTER the IndexedDB write succeeded, so a failed migration loses nothing).
function idbPreload(){
  return idbGet(STORAGE_KEY).then(raw => {
    if(raw != null){ __IDB_PRELOADED = JSON.parse(raw); return; }
    let lsRaw = null;
    try { lsRaw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY); } catch(e){}
    if(lsRaw != null){
      const parsed = JSON.parse(lsRaw);
      return idbSet(STORAGE_KEY, lsRaw).then(() => {
        __IDB_PRELOADED = parsed;
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_KEY);
          localStorage.setItem(STORAGE_KEY + '_storage', 'idb');   // diagnostic marker
        } catch(e){}
        console.info('MiyeeBooks: local data migrated from localStorage to IndexedDB ('+Math.round(lsRaw.length/1024)+' KB)');
      });
    }
    __IDB_PRELOADED = null;   // preload ran; no local data exists
  }).catch(e => {
    console.warn('idbPreload failed - staying on localStorage:', e);
    __IDB_OK = false;
    // leave __IDB_PRELOADED = undefined → loadData() uses the sync fallback
  });
}

function loadData(){
  // Preferred path: dataset preloaded from IndexedDB before first render
  if(__IDB_PRELOADED !== undefined) return __IDB_PRELOADED;
  // Fallback (IndexedDB unavailable): original synchronous localStorage path
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if(legacyRaw) {
      localStorage.setItem(STORAGE_KEY, legacyRaw);
      localStorage.removeItem(LEGACY_KEY);
      return JSON.parse(legacyRaw);
    }
  } catch(e){}
  return null;
}
function saveData(data){
  // Cap the unbounded audit log before persisting
  const toSave = (data.auditLog && data.auditLog.length > 1000)
    ? { ...data, auditLog: data.auditLog.slice(-1000) } : data;
  const json = JSON.stringify(toSave);
  if(__IDB_OK){
    idbSet(STORAGE_KEY, json).catch(e => {
      console.warn('saveData: IndexedDB write failed - falling back to localStorage', e);
      try { localStorage.setItem(STORAGE_KEY, json); } catch(e2){ console.warn('saveData: localStorage fallback also failed (quota?)', e2); }
    });
  } else {
    try { localStorage.setItem(STORAGE_KEY, json); }
    catch(e){ console.warn('saveData: localStorage write failed (quota?) - sign in for cloud sync or export a backup', e); }
  }
}
