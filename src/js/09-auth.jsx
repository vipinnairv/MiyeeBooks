
// ============================================================================
// UPGRADE MODAL  shown when free tier limit is reached or from settings
// ============================================================================
function UpgradeModal({ data, setData, showToast, onClose, triggerReason='limit', companyId=null, userUid=null }) {
  const activeCount = (data.vouchers||[]).filter(v=>v.status!=='Cancelled').length;
  const isPrem      = isPremiumActive(data.company);

  const FEATURES_FREE    = ['Double-entry accounting','Chart of Accounts','GST  GSTR-1 / 3B / 2B','Parties  Debtors & Creditors','Balance Sheet, P&L, Cash Flow'];
  const FEATURES_PREMIUM = ['✦ Unlimited vouchers & entries','All free features included','Bank Reconciliation','Bill Tagging on PAY / REC','Cost Centres & Departments','TDS, Payroll, HR module','Inventory & Factory BOM','Excel export  all reports','Multi-user team access (Cloud)','Firebase cloud sync & backup','Priority support  email & phone'];

  // ── How activation works ─────────────────────────────────────────────────
  // This is a single-file app. No client-side key can be secure  the
  // customer uses the SAME file as the developer, so any key generator
  // embedded here is visible to everyone.
  // Premium is therefore activated ONLY by the developer in Firebase Firestore:
  //   Firebase Console → miyeebooks → companies → <companyId> → isPremium: true
  // On next cloud sync the app reads the flag and unlocks automatically.
  // For customers NOT using Firebase cloud: ask them to enable cloud sync first
  // (Help & Guide → User Configuration).

  return (
    <div className="modal-overlay" style={{zIndex:3000}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal" style={{maxWidth:660,maxHeight:'93vh',overflowY:'auto',padding:0}}>

        {/* Hero */}
        <div style={{background:'linear-gradient(135deg,#0b6b4f 0%,#1a9a72 100%)',padding:'26px 30px 20px',color:'#fff',borderRadius:'12px 12px 0 0',position:'relative'}}>
          <button onClick={onClose} style={{position:'absolute',top:13,right:16,background:'rgba(255,255,255,.18)',border:'none',color:'#fff',width:28,height:28,borderRadius:'50%',cursor:'pointer',fontSize:16,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          {isPrem ? (
            <>
              <div style={{fontSize:34,marginBottom:6}}>✅</div>
              <div style={{fontSize:20,fontWeight:800}}>Premium is Active</div>
              <div style={{fontSize:12,opacity:.85,marginTop:4}}>Your account is fully unlocked. Thank you for supporting MiyeeBooks!</div>
              <div style={{marginTop:8,fontSize:11,opacity:.7}}>Active since: {data.company.premiumSince||''}</div>
            </>
          ) : (
            <>
              <div style={{fontSize:32,marginBottom:6}}>🚀</div>
              <div style={{fontSize:21,fontWeight:800}}>Upgrade to MiyeeBooks Premium</div>
              <div style={{fontSize:12,opacity:.85,marginTop:4}}>
                {triggerReason==='limit'
                  ? `Free limit reached  ${activeCount} of ${FREE_VOUCHER_LIMIT} entries used. Unlock unlimited access.`
                  : 'Unlimited entries, all modules, cloud sync, priority support.'}
              </div>
              {triggerReason==='limit' && (
                <div style={{marginTop:10,display:'inline-flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.15)',borderRadius:8,padding:'7px 13px'}}>
                  <span style={{fontSize:11}}>Free usage</span>
                  <div style={{background:'rgba(255,255,255,.3)',borderRadius:20,width:110,height:7,overflow:'hidden'}}>
                    <div style={{background:'#fff',height:'100%',borderRadius:20,width:`${(activeCount/FREE_VOUCHER_LIMIT)*100}%`}}></div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700}}>{activeCount}/{FREE_VOUCHER_LIMIT}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{padding:'22px 26px'}}>
          {isPrem ? (
            /* ── ALREADY PREMIUM ── */
            <div style={{textAlign:'center',padding:'12px 0 24px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
                {[['Vouchers','Unlimited','📝'],['Team Users','Multi-user','👥'],['Reports','All modules','📊'],['Support','Priority','💬']].map(([l,v,ic])=>(
                  <div key={l} style={{background:'var(--primary-soft)',border:'1px solid var(--primary)',borderRadius:8,padding:'12px 10px',textAlign:'center'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{ic}</div>
                    <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:2}}>{l}</div>
                    <div style={{fontWeight:700,fontSize:13,color:'var(--primary)'}}>{v}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{padding:'9px 28px'}} onClick={onClose}>Continue working →</button>
            </div>
          ) : (
            <>
              {/* ── PLAN COMPARISON ── */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
                {/* Free */}
                <div style={{border:'1px solid var(--line)',borderRadius:10,padding:'16px 15px'}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>Free</div>
                  <div style={{fontSize:22,fontWeight:800,marginBottom:10}}>₹0 <span style={{fontSize:11,fontWeight:400,color:'var(--ink-3)'}}>forever</span></div>
                  <ul style={{listStyle:'none',padding:0,margin:0,fontSize:12,color:'var(--ink-2)'}}>
                    {FEATURES_FREE.map((f,i)=>(
                      <li key={i} style={{padding:'3px 0',display:'flex',gap:6,alignItems:'flex-start'}}>
                        <span style={{color:'var(--ink-3)',marginTop:1}}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <div style={{marginTop:12,background:'#fff3e0',borderRadius:6,padding:'7px 10px',fontSize:11,color:'#e65100'}}>
                    ⚠ Max <b>{FREE_VOUCHER_LIMIT} entries</b> only
                  </div>
                </div>

                {/* Premium */}
                <div style={{border:'2px solid var(--primary)',borderRadius:10,padding:'16px 15px',background:'var(--primary-soft)',position:'relative'}}>
                  <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--primary)',color:'#fff',fontSize:10,fontWeight:700,padding:'2px 12px',borderRadius:20,whiteSpace:'nowrap'}}>RECOMMENDED</div>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--primary)',marginBottom:3}}>Premium</div>
                  <div style={{fontSize:22,fontWeight:800,color:'var(--primary)',marginBottom:10}}>
                    ₹{PREMIUM_PRICE_INR.toLocaleString('en-IN')} <span style={{fontSize:11,fontWeight:400,color:'var(--ink-3)'}}>/ month</span>
                  </div>
                  <ul style={{listStyle:'none',padding:0,margin:0,fontSize:12,color:'var(--ink-2)'}}>
                    {FEATURES_PREMIUM.map((f,i)=>(
                      <li key={i} style={{padding:'3px 0',display:'flex',gap:6,alignItems:'flex-start',fontWeight:f.startsWith('✦')?700:400}}>
                        <span style={{color:'var(--primary)',marginTop:1,flexShrink:0}}>✓</span>{f.replace('✦ ','')}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ── HOW TO ACTIVATE ── */}
              <div style={{background:'var(--surface-2)',borderRadius:10,padding:'16px 18px',marginBottom:18}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'var(--ink)'}}>💳 How to Subscribe  3 Simple Steps</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
                  {[
                    { n:'1', ico:'💸', title:'Pay ₹1,500/month',
                      lines:[`UPI: ${PREMIUM_UPI}`, 'GPay / PhonePe / Paytm', 'Bank transfer on request'] },
                    { n:'2', ico:'📩', title:'Send payment proof',
                      lines:[`WhatsApp / email`, `${PREMIUM_CONTACT}`, `${PREMIUM_PHONE}`] },
                    { n:'3', ico:'☁', title:'Activated in Firestore',
                      lines:['Developer enables premium', 'in your cloud account', 'App unlocks on next sync'] },
                  ].map(s=>(
                    <div key={s.n} style={{background:'#fff',borderRadius:8,padding:'12px 13px',border:'1px solid var(--line)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                        <span style={{background:'var(--primary)',color:'#fff',borderRadius:'50%',width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>{s.n}</span>
                        <span style={{fontWeight:600,fontSize:12}}>{s.title}</span>
                      </div>
                      {s.lines.map((l,i)=><div key={i} style={{fontSize:11,color:'var(--ink-3)',marginBottom:1}}>{l}</div>)}
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12,padding:'9px 12px',background:'#e8f5e9',borderRadius:6,fontSize:11,color:'#2e7d32',border:'1px solid #a5d6a7'}}>
                  ☁ <b>Cloud sync is required for Premium.</b> Make sure you're signed in with Firebase (see Help → User Configuration).
                  Once the developer enables your plan, the app unlocks automatically on the next sync  no key to enter, nothing to download.
                </div>
              </div>

              {/* Contact strip */}
              <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                <a href={`https://wa.me/${PREMIUM_PHONE.replace(/[^0-9]/g,'')}`} target="_blank" rel="noopener"
                  className="btn btn-primary" style={{fontSize:12,padding:'8px 18px'}}>
                  💬 WhatsApp Us to Subscribe
                </a>
                <a href={`mailto:${PREMIUM_CONTACT}?subject=MiyeeBooks Premium Subscription&body=Company: ${data.company.name}%0AFirebase UID: (from Help page)%0APayment: done`}
                  className="btn btn-sm" style={{fontSize:12}}>
                  📧 Email: {PREMIUM_CONTACT}
                </a>
                <a href={`tel:${PREMIUM_PHONE.replace(/\s/g,'')}`} className="btn btn-sm" style={{fontSize:12}}>
                  📱 {PREMIUM_PHONE}
                </a>
              </div>

              {/* Account identifiers  customer must share these for activation */}
              <div style={{marginTop:16,padding:'12px 16px',background:'#e8f5e9',borderRadius:8,border:'1px solid #a5d6a7'}}>
                <div style={{fontWeight:700,fontSize:12,color:'#1b5e20',marginBottom:8}}>
                  📋 Share these details with us when you pay  required for activation:
                </div>
                <div style={{display:'grid',gap:6}}>
                  {[
                    ['Company Name', data.company.name],
                    ['User UID',     userUid  || ' sign in with Firebase to see '],
                    ['Company ID',   companyId || ' sign in with Firebase to see '],
                  ].map(([label, value])=>(
                    <div key={label} style={{display:'flex',alignItems:'center',gap:8,background:'#fff',borderRadius:6,padding:'6px 10px',border:'1px solid #c8e6c9'}}>
                      <span style={{fontSize:11,color:'#388e3c',minWidth:100,flexShrink:0,fontWeight:600}}>{label}</span>
                      <code style={{fontFamily:'var(--mono)',fontSize:11,color:'#1b5e20',wordBreak:'break-all',flex:1}}>{value}</code>
                      {value && value !== ' sign in with Firebase to see ' && (
                        <button onClick={()=>{navigator.clipboard?.writeText(value); showToast(`${label} copied`);}}
                          style={{background:'none',border:'none',cursor:'pointer',fontSize:13,opacity:.6,padding:'2px 4px',flexShrink:0}} title="Copy">📋</button>
                      )}
                    </div>
                  ))}
                </div>
                {(!userUid || !companyId) && (
                  <div style={{marginTop:8,fontSize:11,color:'#f57c00',background:'#fff8e1',borderRadius:6,padding:'6px 10px',border:'1px solid #ffe082'}}>
                    ⚠ You're in local mode. Enable cloud sync (Help → User Configuration) first to get your Firebase IDs.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{borderTop:'1px solid var(--line)',padding:'11px 22px',background:'var(--surface-2)',borderRadius:'0 0 12px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:'var(--ink-3)'}}>
          <span>MiyeeBooks by Vipin Nair · MSME Accounting Suite</span>
          {!isPrem && <span>⚡ Your data is always safe  upgrade when ready</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOGIN SCREEN
// ============================================================================
function LoginScreen({ onLogin }){
  const [tab, setTab]           = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      let cred;
      if(tab === 'login'){
        cred = await fbAuth.signInWithEmailAndPassword(email, password);
      } else {
        cred = await fbAuth.createUserWithEmailAndPassword(email, password);
        if(name.trim()) await cred.user.updateProfile({ displayName: name.trim() });
      }
      onLogin(cred.user);
    } catch(err){
      setError(fbErrMsg(err.code));
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setGLoading(true); setError('');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await fbAuth.signInWithPopup(provider);
      onLogin(cred.user);
    } catch(err){
      const msg = fbErrMsg(err.code);
      if(msg) setError(msg);
    } finally { setGLoading(false); }
  };

  const switchTab = (t) => { setTab(t); setError(''); setEmail(''); setPassword(''); setName(''); setShowPw(false); };

  /* ── inline style tokens (immune to CSS cascade issues) ── */
  const S = {
    page: {
      margin:0, padding:0,
      minHeight:'100vh', width:'100vw',
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(145deg, #0b6b4f 0%, #063d2d 55%, #021a12 100%)',
      fontFamily:'"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      boxSizing:'border-box', padding:'20px',
    },
    card: {
      background:'#ffffff', borderRadius:20,
      padding:'40px 36px 32px', width:'100%', maxWidth:420,
      boxShadow:'0 32px 80px rgba(0,0,0,.45), 0 4px 16px rgba(0,0,0,.2)',
      boxSizing:'border-box',
    },
    /* brand row */
    brandRow:{ display:'flex', alignItems:'center', gap:16, marginBottom:32 },
    logoBox:{
      width:56, height:56, borderRadius:14, flexShrink:0, position:'relative',
      background:'#0b6b4f', display:'flex', alignItems:'center', justifyContent:'center',
    },
    logoText:{ fontFamily:'Georgia,serif', fontSize:32, fontWeight:700, color:'#fff', lineHeight:1 },
    logoDot:{
      position:'absolute', top:6, right:6, width:11, height:11,
      borderRadius:'50%', background:'#c9a227',
    },
    brandName:{ fontSize:24, fontWeight:700, color:'#0e2a23', letterSpacing:'-.3px' },
    brandAccent:{ color:'#c9a227' },
    brandTag:{ fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', color:'#6b7f78', marginTop:2 },
    /* tab switcher */
    tabBar:{
      display:'flex', background:'#f4f7f5', borderRadius:10, padding:4,
      marginBottom:24, border:'1px solid #e3ebe7', gap:4,
    },
    tab:(active)=>({
      flex:1, border:'none', cursor:'pointer', padding:'9px 0', borderRadius:7,
      fontSize:13, fontWeight: active?600:500, transition:'all .15s',
      background: active?'#ffffff':'transparent',
      color: active?'#0e2a23':'#6b7f78',
      boxShadow: active?'0 1px 4px rgba(0,0,0,.12)':'none',
    }),
    /* form */
    form:{ display:'flex', flexDirection:'column', gap:16 },
    fieldWrap:{ display:'flex', flexDirection:'column', gap:6 },
    label:{ fontSize:12, fontWeight:600, color:'#3a4f49', letterSpacing:'.2px' },
    inputWrap:{ position:'relative' },
    input:{
      width:'100%', boxSizing:'border-box', padding:'11px 14px',
      border:'1.5px solid #cfdbd5', borderRadius:9, fontSize:14,
      background:'#ffffff', color:'#0e2a23', outline:'none',
      transition:'border-color .15s', fontFamily:'inherit',
    },
    inputFocus:{ borderColor:'#0b6b4f' },
    pwEye:{
      position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
      background:'none', border:'none', cursor:'pointer', color:'#6b7f78', fontSize:15, padding:0,
    },
    /* primary button */
    btnPrimary:(disabled)=>({
      width:'100%', border:'none', borderRadius:10, padding:'13px',
      fontSize:14, fontWeight:700, cursor: disabled?'not-allowed':'pointer',
      background: disabled?'#8fb5a8':'#0b6b4f', color:'#ffffff',
      transition:'background .15s', letterSpacing:'.2px', marginTop:2,
    }),
    /* google button */
    btnGoogle:{
      display:'flex', alignItems:'center', justifyContent:'center', gap:10,
      width:'100%', padding:'12px 14px', background:'#ffffff',
      border:'1.5px solid #cfdbd5', borderRadius:10, fontSize:13.5,
      fontWeight:500, color:'#0e2a23', cursor:'pointer', transition:'all .15s',
      fontFamily:'inherit', marginBottom:4,
    },
    /* error */
    errBox:{
      background:'#fef2f2', color:'#b3261e', border:'1px solid #f5c6c4',
      borderRadius:8, padding:'10px 13px', fontSize:12.5, lineHeight:1.5,
    },
    /* divider */
    divider:{
      display:'flex', alignItems:'center', gap:12,
      margin:'20px 0', color:'#8aa098', fontSize:12,
    },
    dividerLine:{ flex:1, height:1, background:'#e3ebe7' },
    /* footer */
    footer:{
      textAlign:'center', marginTop:22, fontSize:11,
      color:'#6b7f78', lineHeight:1.8,
    },
  };

  /* focus effect via state */
  const [focused, setFocused] = useState('');

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* ── Brand ── */}
        <div style={S.brandRow}>
          <div style={S.logoBox}>
            <span style={S.logoText}>M</span>
            <div style={S.logoDot}/>
          </div>
          <div>
            <div style={S.brandName}>
              Miyee<span style={S.brandAccent}>·</span>Books
            </div>
            <div style={S.brandTag}>MSME Accounting Suite</div>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div style={S.tabBar}>
          <button style={S.tab(tab==='login')}    onClick={()=>switchTab('login')}>Sign In</button>
          <button style={S.tab(tab==='register')} onClick={()=>switchTab('register')}>Create Account</button>
        </div>

        {/* ── Form ── */}
        <form style={S.form} onSubmit={handleSubmit}>
          {tab==='register' && (
            <div style={S.fieldWrap}>
              <label style={S.label}>Full Name</label>
              <input style={{...S.input, ...(focused==='name'?S.inputFocus:{})}}
                value={name} onChange={e=>setName(e.target.value)}
                onFocus={()=>setFocused('name')} onBlur={()=>setFocused('')}
                placeholder="Your name" autoFocus />
            </div>
          )}
          <div style={S.fieldWrap}>
            <label style={S.label}>Email Address</label>
            <input style={{...S.input, ...(focused==='email'?S.inputFocus:{})}}
              type="email" value={email} onChange={e=>setEmail(e.target.value)}
              onFocus={()=>setFocused('email')} onBlur={()=>setFocused('')}
              placeholder="you@company.com" required
              autoFocus={tab==='login'} />
          </div>
          <div style={S.fieldWrap}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <label style={S.label}>Password</label>
              {tab==='login' && (
                <span style={{fontSize:11, color:'#6b7f78', cursor:'default'}}>
                  6+ characters
                </span>
              )}
            </div>
            <div style={S.inputWrap}>
              <input style={{...S.input, paddingRight:42, ...(focused==='pw'?S.inputFocus:{})}}
                type={showPw?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)}
                onFocus={()=>setFocused('pw')} onBlur={()=>setFocused('')}
                placeholder={tab==='register'?'Minimum 6 characters':'Your password'}
                required minLength="6" />
              <button type="button" style={S.pwEye} onClick={()=>setShowPw(p=>!p)}
                title={showPw?'Hide password':'Show password'}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div style={S.errBox}>⚠ {error}</div>
          )}

          <button type="submit" style={S.btnPrimary(loading)} disabled={loading}>
            {loading
              ? <span>⏳ {tab==='login'?'Signing in…':'Creating account…'}</span>
              : tab==='login' ? '→ Sign In' : '✓ Create Account'
            }
          </button>
        </form>

        {/* ── Divider ── */}
        <div style={S.divider}>
          <div style={S.dividerLine}/><span>or continue with</span><div style={S.dividerLine}/>
        </div>

        {/* ── Google button ── */}
        <button style={S.btnGoogle} onClick={handleGoogle} disabled={gLoading}
          onMouseEnter={e=>{ e.currentTarget.style.borderColor='#0b6b4f'; e.currentTarget.style.background='#e6f3ee'; }}
          onMouseLeave={e=>{ e.currentTarget.style.borderColor='#cfdbd5'; e.currentTarget.style.background='#ffffff'; }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {gLoading ? '⏳ Signing in…' : 'Continue with Google'}
        </button>

        {/* ── Footer ── */}
        <div style={S.footer}>
          🔒 Your data is private  only you can access it<br/>
          Secured by <b style={{color:'#3a4f49'}}>Firebase Authentication</b> &amp; <b style={{color:'#3a4f49'}}>Firestore</b>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPANY SELECTOR
// ============================================================================
function CompanySelector({ user, onSelect, onSignOut, autoSelect=true }){
  const [companies,  setCompanies]  = useState(null);   // owned
  const [shared,     setShared]     = useState([]);      // shared with me
  const [creating,   setCreating]   = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [newName,    setNewName]    = useState('');
  const [newGstin,   setNewGstin]   = useState('');
  const [newParent,  setNewParent]  = useState('');   // ''=auto · 'holding' · 'standalone' · 'sub:<companyId>'
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [focusedF,   setFocusedF]   = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInvBox, setShowInvBox] = useState(false);
  const [invLoading, setInvLoading] = useState(false);
  const [invError,   setInvError]   = useState('');

  const PAGE_BG = 'linear-gradient(145deg, #0b6b4f 0%, #063d2d 55%, #021a12 100%)';
  const FONT    = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  const inp = (focused) => ({
    width:'100%', boxSizing:'border-box', padding:'10px 13px',
    border: focused?'1.5px solid #0b6b4f':'1.5px solid #cfdbd5',
    borderRadius:8, fontSize:14, background:'#fff', color:'#0e2a23',
    outline:'none', fontFamily:FONT, marginTop:5, display:'block',
  });
  const ROLE_CLR = { admin:'#1976d2', limited:'#f57c00', viewer:'#757575', employee:'#0b6b4f', manager:'#6a1b9a' };
  const ROLE_LBL = { admin:'Admin', limited:'Limited', viewer:'Viewer', employee:'Employee Portal', manager:'Manager Portal' };

  const load = () => {
    Promise.all([
      fbListCompanies(user.uid),
      fbListSharedCompanies(user.uid),
    ]).then(([owned, sh]) => {
      setCompanies(owned);
      setShared(sh);
      // Auto-open the only company on initial login - but NOT when the user
      // explicitly hit "Switch" (they want to see the list / add a subsidiary).
      if(autoSelect && owned.length + sh.length === 1){
        if(owned.length === 1) onSelect(owned[0].id, user.uid, 'owner');
        else onSelect(sh[0].companyId, sh[0].ownerId, sh[0].role);
      }
    }).catch(() => { setCompanies([]); setShared([]); });
  };
  useEffect(load, [user.uid]);

  // Group structure at creation (user's model): the FIRST company becomes the
  // Holding company automatically; every later company picks its parent Holding
  // from a list (inheriting the group), or can be another Holding / standalone.
  const holdings = (companies||[]).filter(c => c.isHolding);
  const isFirstCompany = (companies||[]).length === 0;
  const effParent = newParent || (isFirstCompany ? 'holding' : (holdings.length ? 'sub:'+holdings[0].id : 'holding'));

  const handleCreate = async (e) => {
    e.preventDefault();
    if(!newName.trim()){ setError('Business name is required.'); return; }
    setLoading(true); setError('');
    try {
      let grp = {};
      if(effParent === 'holding'){
        grp = { groupName: newName.trim(), isHolding: true };
      } else if(effParent.startsWith('sub:')){
        const parent = (companies||[]).find(c => c.id === effParent.slice(4));
        if(parent) grp = { groupName: parent.groupName || parent.name, isHolding: false, parentCompanyId: parent.id };
      } // 'standalone' → no group fields
      const id = await fbCreateCompany(user.uid,
        buildDefaultData({ name: newName.trim(), gstin: newGstin.trim().toUpperCase(), ...grp }));
      onSelect(id, user.uid, 'owner');
    } catch(err){
      setError('Failed to create company. Please try again.');
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('Delete this company and ALL its data? This cannot be undone.')) return;
    setDeleting(id);
    try { await fbDeleteCompany(user.uid, id); load(); }
    catch(e){ alert('Delete failed.'); }
    finally { setDeleting(null); }
  };

  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    if(!inviteCode.trim()){ setInvError('Enter an invite code.'); return; }
    setInvLoading(true); setInvError('');
    try {
      await fbAcceptInvite(inviteCode.trim(), user.uid, user.email||'', user.displayName||'');
      setInviteCode(''); setShowInvBox(false);
      load();
    } catch(err){
      setInvError(err.message);
    } finally { setInvLoading(false); }
  };

  const LoadingScreen = () => (
    <div style={{minHeight:'100vh',width:'100vw',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',gap:18,background:PAGE_BG,fontFamily:FONT}}>
      <div style={{width:40,height:40,border:'3px solid rgba(255,255,255,.25)',borderTopColor:'#fff',
        borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <div style={{color:'rgba(255,255,255,.8)',fontSize:14}}>Loading your companies…</div>
    </div>
  );

  if(companies === null) return <LoadingScreen />;

  const CompanyBtn = ({ c, onClick, onDel, showDel, role }) => (
    <div style={{position:'relative'}}>
      <button onClick={onClick}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',
          width:'100%',padding:'13px 46px 13px 16px',background:'#fff',
          border:'1.5px solid #e3ebe7',borderRadius:12,cursor:'pointer',
          textAlign:'left',boxSizing:'border-box',fontFamily:FONT,transition:'all .15s'}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='#0b6b4f';e.currentTarget.style.background='#e6f3ee';}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='#e3ebe7';e.currentTarget.style.background='#fff';}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:'#0e2a23'}}>
            {c.subLabel && <span style={{color:'#8aa098',fontWeight:400}}>↳ </span>}
            {c.name||c.companyName}
            {c.isHolding && <span style={{fontSize:9,background:'#fbf3d9',color:'#8a6d1a',borderRadius:20,padding:'2px 8px',fontWeight:800,marginLeft:8,letterSpacing:'.5px'}}>HOLDING</span>}
          </div>
          {c.subLabel && <div style={{fontSize:10,color:'#8aa098',marginTop:1}}>Subsidiary of {c.subLabel}</div>}
          {c.gstin && <div style={{fontSize:11,color:'#6b7f78',fontFamily:'monospace',marginTop:2}}>{c.gstin}</div>}
          {role && role !== 'owner' && (
            <span style={{fontSize:10,background:ROLE_CLR[role]+'22',color:ROLE_CLR[role],borderRadius:20,padding:'2px 8px',fontWeight:700,display:'inline-block',marginTop:4}}>
              {ROLE_LBL[role]||role}
            </span>
          )}
        </div>
        <span style={{color:'#0b6b4f',fontSize:18,flexShrink:0}}>→</span>
      </button>
      {showDel && (
        <button onClick={onDel} title="Delete company"
          style={{position:'absolute',top:'50%',right:12,transform:'translateY(-50%)',
            background:'none',border:'none',cursor:'pointer',fontSize:15,padding:'4px',
            color:'#b3261e',opacity:.5,lineHeight:1}}
          onMouseEnter={e=>e.currentTarget.style.opacity=1}
          onMouseLeave={e=>e.currentTarget.style.opacity=.5}>🗑</button>
      )}
    </div>
  );

  return (
    <div style={{minHeight:'100vh',width:'100vw',display:'flex',alignItems:'center',
      justifyContent:'center',background:PAGE_BG,fontFamily:FONT,padding:20,boxSizing:'border-box'}}>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 28px 24px',width:'100%',maxWidth:480,
        boxShadow:'0 32px 80px rgba(0,0,0,.4)',boxSizing:'border-box',maxHeight:'90vh',overflowY:'auto'}}>

        {/* header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:'#0e2a23',letterSpacing:'-.3px'}}>🏢 Select Company</div>
            <div style={{fontSize:12,color:'#6b7f78',marginTop:4}}>
              Signed in as <b style={{color:'#3a4f49'}}>{user.displayName||user.email}</b>
            </div>
          </div>
          <button onClick={onSignOut} style={{background:'none',border:'1px solid #cfdbd5',borderRadius:7,
            padding:'6px 12px',fontSize:12,color:'#6b7f78',cursor:'pointer',fontFamily:FONT,whiteSpace:'nowrap',flexShrink:0}}>
            ↩ Sign out
          </button>
        </div>

        {/* My companies */}
        {companies.length > 0 && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:'#6b7f78',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:8}}>My Companies</div>
            <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:16}}>
              {(() => {
                // Tree order: each holding followed by its subsidiaries, then the rest
                const byId = {}; companies.forEach(c => byId[c.id]=c);
                const subLabelOf = c => (c.parentCompanyId && byId[c.parentCompanyId]) ? byId[c.parentCompanyId].name
                  : (!c.isHolding && c.groupName) ? c.groupName : '';
                const ordered = [];
                companies.filter(c=>c.isHolding).forEach(h => {
                  ordered.push(h);
                  companies.filter(c => !c.isHolding && (c.parentCompanyId===h.id || (c.groupName && c.groupName===h.groupName))).forEach(s => ordered.push({...s, subLabel:subLabelOf(s)}));
                });
                companies.forEach(c => { if(!ordered.some(o=>o.id===c.id)) ordered.push(c.isHolding?c:{...c, subLabel:subLabelOf(c)}); });
                return ordered.map(c => (
                  <CompanyBtn key={c.id} c={c} role="owner"
                    onClick={()=>onSelect(c.id, user.uid, 'owner')}
                    onDel={()=>handleDelete(c.id)}
                    showDel={deleting !== c.id} />
                ));
              })()}
            </div>
          </>
        )}
        {companies.length === 0 && shared.length === 0 && (
          <div style={{textAlign:'center',padding:'24px 0 20px',color:'#6b7f78',fontSize:13}}>
            No companies yet  create your first one below ↓
          </div>
        )}

        {/* Shared with me */}
        {shared.length > 0 && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:'#6b7f78',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:8,marginTop:companies.length>0?4:0}}>Shared With Me</div>
            <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:16}}>
              {shared.map(s => (
                <CompanyBtn key={s.id} c={{name:s.companyName}} role={s.role}
                  onClick={()=>onSelect(s.companyId, s.ownerId, s.role)}
                  showDel={false} />
              ))}
            </div>
          </>
        )}

        {/* Add company */}
        {!creating ? (
          <button onClick={()=>setCreating(true)}
            style={{width:'100%',background:'transparent',border:'1.5px dashed #0b6b4f',
              borderRadius:10,padding:'11px',fontSize:13,fontWeight:600,
              color:'#0b6b4f',cursor:'pointer',fontFamily:FONT,transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='#e6f3ee';}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
            + Add New Company / Firm
          </button>
        ) : (
          <form onSubmit={handleCreate}
            style={{background:'#f9fbf9',borderRadius:12,padding:'18px 16px',border:'1px solid #e3ebe7'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#0e2a23',marginBottom:14}}>➕ New Company / Firm</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:600,color:'#3a4f49'}}>Business Name *</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)}
                onFocus={()=>setFocusedF('name')} onBlur={()=>setFocusedF('')}
                style={inp(focusedF==='name')} placeholder="e.g. Rajesh Traders Pvt Ltd" autoFocus />
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:'#3a4f49'}}>GSTIN <span style={{fontWeight:400,color:'#6b7f78'}}>(optional)</span></label>
              <input value={newGstin} onChange={e=>setNewGstin(e.target.value.toUpperCase())}
                onFocus={()=>setFocusedF('gstin')} onBlur={()=>setFocusedF('')}
                style={{...inp(focusedF==='gstin'),fontFamily:'monospace',letterSpacing:'.5px'}}
                placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
            {isFirstCompany ? (
              <div style={{background:'#e6f3ee',border:'1px solid #0b6b4f55',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#0b6b4f',marginBottom:14,lineHeight:1.5}}>
                🏢 <b>Your first company becomes the Holding (parent) company.</b><br/>
                <span style={{color:'#3a4f49'}}>Add subsidiaries under it later - they appear together in Group Consolidation.</span>
              </div>
            ) : (
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:'#3a4f49'}}>Company Structure</label>
                <select value={effParent} onChange={e=>setNewParent(e.target.value)} style={inp(false)}>
                  {holdings.map(h => <option key={h.id} value={'sub:'+h.id}>Subsidiary of {h.name}</option>)}
                  <option value="holding">New Holding company (starts its own group)</option>
                  <option value="standalone">Standalone (no group)</option>
                </select>
                <div style={{fontSize:11,color:'#6b7f78',marginTop:5,lineHeight:1.5}}>
                  {effParent.startsWith('sub:')
                    ? <>Will join <b>{(holdings.find(h=>'sub:'+h.id===effParent)||{}).name}</b>'s group - consolidated financials include it automatically.</>
                    : effParent==='holding'
                      ? 'This company will head its own group; add subsidiaries under it later.'
                      : 'Not part of any group - excluded from consolidation.'}
                </div>
              </div>
            )}
            {error && <div style={{background:'#fef2f2',color:'#b3261e',borderRadius:7,padding:'9px 12px',fontSize:12,marginBottom:12}}>⚠ {error}</div>}
            <div style={{display:'flex',gap:8}}>
              <button type="submit" disabled={loading}
                style={{flex:1,background:loading?'#8fb5a8':'#0b6b4f',color:'#fff',border:'none',
                  borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:loading?'not-allowed':'pointer',fontFamily:FONT}}>
                {loading?'Creating…':'✓ Create & Open'}
              </button>
              <button type="button" onClick={()=>{setCreating(false);setError('');}}
                style={{background:'#fff',color:'#3a4f49',border:'1.5px solid #cfdbd5',
                  borderRadius:9,padding:'11px 16px',fontSize:13,cursor:'pointer',fontFamily:FONT}}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Invite code entry */}
        <div style={{marginTop:16,borderTop:'1px solid #e3ebe7',paddingTop:14}}>
          {!showInvBox ? (
            <button onClick={()=>setShowInvBox(true)}
              style={{background:'none',border:'none',color:'#6b7f78',fontSize:12,cursor:'pointer',fontFamily:FONT,padding:0,textDecoration:'underline'}}>
              🔑 Have an invite code? Enter it here
            </button>
          ) : (
            <form onSubmit={handleAcceptInvite}>
              <div style={{fontSize:12,fontWeight:600,color:'#3a4f49',marginBottom:6}}>🔑 Enter Invite Code</div>
              <div style={{display:'flex',gap:8}}>
                <input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB3DE7FG" maxLength={8}
                  style={{...inp(true),marginTop:0,flex:1,fontFamily:'monospace',fontSize:16,letterSpacing:2,fontWeight:700}}
                  autoFocus />
                <button type="submit" disabled={invLoading}
                  style={{background:invLoading?'#8fb5a8':'#0b6b4f',color:'#fff',border:'none',borderRadius:8,padding:'10px 16px',fontSize:13,fontWeight:600,cursor:invLoading?'not-allowed':'pointer',fontFamily:FONT,whiteSpace:'nowrap'}}>
                  {invLoading?'…':'Join'}
                </button>
                <button type="button" onClick={()=>{setShowInvBox(false);setInviteCode('');setInvError('');}}
                  style={{background:'#fff',color:'#6b7f78',border:'1px solid #cfdbd5',borderRadius:8,padding:'10px',cursor:'pointer',fontFamily:FONT}}>✕</button>
              </div>
              {invError && <div style={{color:'#b3261e',fontSize:12,marginTop:7}}>⚠ {invError}</div>}
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// AUTH GATE  wraps everything; decides what to render
// ============================================================================
function AuthGate(){
  const [stage,     setStage]     = useState('loading'); // loading|unauth|select|ready|offline
  const [user,      setUser]      = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [ownerId,   setOwnerId]   = useState(null);  // may differ from user.uid for shared companies
  const [userRole,  setUserRole]  = useState('owner'); // owner|admin|limited|viewer
  const [switching, setSwitching] = useState(false);   // true when user explicitly hit "Switch" - suppresses auto-select

  useEffect(() => {
    if(!FB_CONFIGURED || !fbAuth){
      setStage('offline');
      return;
    }
    const unsub = fbAuth.onAuthStateChanged(u => {
      if(u){ setUser(u); setStage('select'); }
      else { setUser(null); setCompanyId(null); setOwnerId(null); setStage('unauth'); }
    });
    return unsub;
  }, []);

  const handleSignOut = async () => {
    try { await fbAuth.signOut(); } catch(e){}
    setUser(null); setCompanyId(null); setOwnerId(null); setUserRole('owner'); setStage('unauth');
  };

  // onSelect now receives (companyId, ownerId, role)
  const handleSelect = (cId, oId, role) => {
    setCompanyId(cId);
    setOwnerId(oId || user?.uid);
    setUserRole(role || 'owner');
    setSwitching(false);
    setStage('ready');
  };

  if(stage==='loading') return (
    <div style={{minHeight:'100vh',width:'100vw',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',gap:18,
      background:'linear-gradient(145deg,#0b6b4f 0%,#063d2d 55%,#021a12 100%)',
      fontFamily:'"Inter",-apple-system,sans-serif'}}>
      <div style={{width:40,height:40,border:'3px solid rgba(255,255,255,.25)',borderTopColor:'#fff',
        borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <div style={{color:'rgba(255,255,255,.8)',fontSize:14}}>Loading MiyeeBooks…</div>
    </div>
  );
  if(stage==='unauth')  return <LoginScreen onLogin={u=>{ setUser(u); setStage('select'); }} />;
  if(stage==='select')  return (
    <CompanySelector user={user} onSelect={handleSelect} onSignOut={handleSignOut} autoSelect={!switching} />
  );
  if(stage==='offline') return <App />;
  return <App user={user} companyId={companyId} ownerId={ownerId||user?.uid}
    userRole={userRole} onSignOut={handleSignOut}
    onSwitchCompany={()=>{ setCompanyId(null); setOwnerId(null); setUserRole('owner'); setSwitching(true); setStage('select'); }} />;
}
