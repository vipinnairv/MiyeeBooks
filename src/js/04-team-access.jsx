
// ============================================================================
// MULTI-USER / TEAM ACCESS  Firestore helpers
// ============================================================================
// Data model:
//   invitations/{code}              → { ownerId, companyId, companyName, role, used, expiresAt }
//   sharedAccess/{uid}/grants/{companyId} → { ownerId, companyId, companyName, role, grantedAt }

const fbCreateInvite = async (ownerId, companyId, companyName, role) => {
  if(!fbDb) return null;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  await fbDb.collection('invitations').doc(code).set({
    ownerId, companyId, companyName, role,
    createdBy: ownerId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 7*24*60*60*1000),
    used: false,
  });
  return code;
};

const fbAcceptInvite = async (code, uid, userEmail='', userDisplayName='') => {
  if(!fbDb) throw new Error('Not connected to Firebase');
  const ref = fbDb.collection('invitations').doc(code.toUpperCase().trim());
  const snap = await ref.get();
  if(!snap.exists) throw new Error('Invalid invite code. Please check and try again.');
  const inv = snap.data();
  if(inv.used) throw new Error('This invite code has already been used.');
  const exp = inv.expiresAt?.toDate ? inv.expiresAt.toDate() : new Date(inv.expiresAt);
  if(exp < new Date()) throw new Error('This invite code has expired (valid for 7 days).');
  if(inv.ownerId === uid) throw new Error("You can't accept your own invite.");
  await fbDb.collection('sharedAccess').doc(uid).collection('grants').doc(inv.companyId).set({
    ownerId: inv.ownerId, companyId: inv.companyId, companyName: inv.companyName,
    role: inv.role, grantedAt: firebase.firestore.FieldValue.serverTimestamp(), inviteCode: code,
    memberEmail: userEmail, memberName: userDisplayName,
  });
  await ref.update({ used: true, usedBy: uid, usedByEmail: userEmail, usedByName: userDisplayName,
    usedAt: firebase.firestore.FieldValue.serverTimestamp() });
  return inv;
};

const fbListSharedCompanies = async (uid) => {
  if(!fbDb) return [];
  try {
    const snap = await fbDb.collection('sharedAccess').doc(uid).collection('grants').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e){ return []; }
};

const fbListMembers = async (ownerId, companyId) => {
  if(!fbDb) return [];
  try {
    const snap = await fbDb.collectionGroup('grants')
      .where('companyId','==',companyId).where('ownerId','==',ownerId).get();
    return snap.docs.map(d => ({ memberUid: d.ref.parent.parent.id, ...d.data() }));
  } catch(e){ console.warn('fbListMembers:', e); return []; }
};

const fbRevokeAccess = async (memberUid, companyId) => {
  if(!fbDb) return;
  await fbDb.collection('sharedAccess').doc(memberUid).collection('grants').doc(companyId).delete();
};

const fbGetPendingInvites = async (ownerId, companyId) => {
  if(!fbDb) return [];
  try {
    const snap = await fbDb.collection('invitations')
      .where('ownerId','==',ownerId).where('companyId','==',companyId)
      .where('used','==',false).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e){ return []; }
};

const fbCancelInvite = async (code) => {
  if(!fbDb) return;
  await fbDb.collection('invitations').doc(code).update({ used: true, cancelled: true });
};
