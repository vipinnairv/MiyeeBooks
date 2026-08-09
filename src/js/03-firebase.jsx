
// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
// ⚠  Replace every value below with your own Firebase project credentials.
//    Console → https://console.firebase.google.com
//    Your project → Project Settings → General → Your apps → Config
// ─────────────────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDWJNkE2ocb_LsE-F5RX7MOT5NZ51WDUiE",
  authDomain:        "miyeebooks.firebaseapp.com",
  projectId:         "miyeebooks",
  storageBucket:     "miyeebooks.firebasestorage.app",
  messagingSenderId: "1045761764245",
  appId:             "1:1045761764245:web:8736ab4cfd4cb23098249c",
};
// ─────────────────────────────────────────────────────────────────────────────

// Detect whether the user has filled in real credentials
const FB_CONFIGURED = !FIREBASE_CONFIG.apiKey.startsWith('REPLACE');

let fbApp = null, fbAuth = null, fbDb = null;
if(FB_CONFIGURED){
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();
  } catch(e){ console.warn('Firebase init error:', e); }
}

// ── Firestore path helpers ───────────────────────────────────────────────────
// users/{uid}/companies/{companyId}  →  { name, gstin, createdAt, updatedAt, payload: JSON }
// payload stores the entire MiyeeBooks data object as a JSON string.
// Firestore 1 MB doc limit is fine for MSMEs; the limit is per-document not per-collection.

const fbCompanyRef = (uid, companyId) =>
  fbDb.collection('users').doc(uid).collection('companies').doc(companyId);

const fbListCompanies = async (uid) => {
  if(!fbDb) return [];
  try {
    // Do NOT .orderBy('updatedAt') here - Firestore DROPS any document missing
    // that field, which made companies created by older builds (e.g. a holding
    // company) silently disappear from the switch list AND from consolidation.
    // Fetch all, sort client-side (missing updatedAt → sorts last).
    const snap = await fbDb.collection('users').doc(uid).collection('companies').get();
    const arr = snap.docs.map(d => { const x = d.data();
      return { id: d.id, name: x.name||'Unnamed', gstin: x.gstin||'',
        groupName: x.groupName||'', isHolding: !!x.isHolding, parentCompanyId: x.parentCompanyId||'',
        _upd: (x.updatedAt && x.updatedAt.toMillis) ? x.updatedAt.toMillis() : (x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0) }; });
    arr.sort((a,b) => b._upd - a._upd);
    return arr;
  } catch(e){ console.warn('fbListCompanies:', e); return []; }
};

// ── Chunked storage ─────────────────────────────────────────────────────────
// Firestore caps a document at 1 MB. Storing the whole company as one JSON blob
// silently fails (→ data loss) once a business has a few thousand vouchers.
// We therefore split large payloads across a `chunks` subcollection.
const FB_CHUNK_SIZE = 250000;   // chars/chunk - safely < 1 MB even with multibyte (₹) chars
const FB_AUDIT_CAP  = 1000;     // keep only the most recent N audit entries when persisting

// Trim the unbounded audit log before persisting (prevents the blob inflating forever)
const capAudit = (data) => (data.auditLog && data.auditLog.length > FB_AUDIT_CAP)
  ? { ...data, auditLog: data.auditLog.slice(-FB_AUDIT_CAP) }
  : data;

const fbClearChunks = async (ref, keepFrom = 0) => {
  try {
    const snap = await ref.collection('chunks').get();
    if(snap.empty) return;
    const batch = fbDb.batch(); let n = 0;
    snap.docs.forEach(d => { if((d.data().i ?? 0) >= keepFrom){ batch.delete(d.ref); n++; } });
    if(n > 0) await batch.commit();
  } catch(e){ console.warn('fbClearChunks:', e); }
};

const fbLoadCompany = async (uid, companyId) => {
  if(!fbDb) return null;
  try {
    const ref  = fbCompanyRef(uid, companyId);
    const snap = await ref.get();
    if(!snap.exists) return null;
    const doc  = snap.data();
    // Reassemble payload from chunks if the company was stored chunked.
    let payloadStr;
    if(doc.chunked === true){
      const chunkSnap = await ref.collection('chunks').orderBy('i').get();
      payloadStr = chunkSnap.docs.map(d => d.data().d).join('');
    } else {
      payloadStr = doc.payload || 'null';
    }
    const data = JSON.parse(payloadStr || 'null');
    if(!data) return null;
    // isPremium is stored as a TOP-LEVEL Firestore field so the developer can set
    // it directly in Firebase Console; the app always trusts the field over payload.
    if(doc.isPremium === true){
      data.company.isPremium    = true;
      data.company.premiumSince = doc.premiumSince || data.company.premiumSince || '';
    } else {
      data.company.isPremium    = false;
    }
    return data;
  } catch(e){ console.warn('fbLoadCompany:', e); return null; }
};

const fbSaveCompany = async (uid, companyId, data) => {
  if(!fbDb) return;
  const ref = fbCompanyRef(uid, companyId);
  const payload = JSON.stringify(capAudit(data));
  const meta = {
    name:      data.company?.name  || 'My Company',
    gstin:     data.company?.gstin || '',
    // group metadata mirrored to the doc so the company list can show the
    // holding/subsidiary tree without loading full payloads
    groupName:       data.company?.groupName || '',
    isHolding:       !!data.company?.isHolding,
    parentCompanyId: data.company?.parentCompanyId || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    // top-level premium flag (developer-set) - only ever written true, never downgraded here
    ...(data.company?.isPremium ? { isPremium: true, premiumSince: data.company.premiumSince || '' } : {}),
  };
  if(payload.length <= FB_CHUNK_SIZE){
    await ref.set({ ...meta, payload, chunked: false, chunkCount: 0 }, { merge: true });
    await fbClearChunks(ref, 0);   // remove any leftover chunks from a previous large save
  } else {
    const chunks = [];
    for(let i = 0; i < payload.length; i += FB_CHUNK_SIZE) chunks.push(payload.slice(i, i + FB_CHUNK_SIZE));
    const batch = fbDb.batch();
    chunks.forEach((c, idx) => batch.set(ref.collection('chunks').doc('c' + String(idx).padStart(4,'0')), { i: idx, d: c }));
    await batch.commit();
    await fbClearChunks(ref, chunks.length);  // delete stale chunks beyond the new count
    await ref.set({ ...meta, payload: '', chunked: true, chunkCount: chunks.length }, { merge: true });
  }
};

const fbCreateCompany = async (uid, initialData) => {
  if(!fbDb) return null;
  const ref = fbDb.collection('users').doc(uid).collection('companies').doc();
  await ref.set({
    name:      initialData.company?.name  || 'My Company',
    gstin:     initialData.company?.gstin || '',
    groupName:       initialData.company?.groupName || '',
    isHolding:       !!initialData.company?.isHolding,
    parentCompanyId: initialData.company?.parentCompanyId || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    payload:   JSON.stringify(initialData),
    chunked:   false, chunkCount: 0,
  });
  return ref.id;
};

const fbDeleteCompany = async (uid, companyId) => {
  if(!fbDb) return;
  const ref = fbCompanyRef(uid, companyId);
  await fbClearChunks(ref, 0);   // delete the chunks subcollection (Firestore won't cascade)
  await ref.delete();
};

// Friendly Firebase auth error messages
const fbErrMsg = (code) => ({
  'auth/user-not-found':        'No account found with this email.',
  'auth/wrong-password':        'Incorrect password.',
  'auth/invalid-credential':    'Incorrect email or password.',
  'auth/email-already-in-use':  'This email is already registered. Please sign in.',
  'auth/weak-password':         'Password must be at least 6 characters.',
  'auth/invalid-email':         'Please enter a valid email address.',
  'auth/too-many-requests':     'Too many attempts. Please try again later.',
  'auth/network-request-failed':'Network error. Check your internet connection.',
  'auth/popup-closed-by-user':  '',
}[code] || 'Something went wrong. Please try again.');
