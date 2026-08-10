
// ============================================================================
// MAIN APP
// ============================================================================
function App({ user=null, companyId=null, ownerId=null, userRole='owner', onSignOut=null, onSwitchCompany=null }){
  const [data, setData] = useState(() => {
    const saved = loadData();
    if(saved){
      // Migrate: ensure TDS sections have ledgerId (older saves may lack it)
      const sectionMap = {};
      SEED_TDS_SECTIONS.forEach(s => { sectionMap[s.section+'|'+s.name] = s.ledgerId; });
      if(saved.tdsSections){
        saved.tdsSections = saved.tdsSections.map(s => ({
          ...s,
          ledgerId: s.ledgerId || sectionMap[s.section+'|'+s.name] || '1313',
          oldSection: s.oldSection || s.section,
        }));
      }
      // Migrate: ensure inventory fields exist
      if(!saved.stockItems) saved.stockItems = [];
      if(!saved.boms) saved.boms = [];
      if(!saved.productionOrders) saved.productionOrders = [];
      // Migrate: ensure cost centres & departments
      if(!saved.costCentres) saved.costCentres = [];
      if(!saved.departments) saved.departments = [];
      if(!saved.bankRecon)   saved.bankRecon   = [];
      if(!saved.periodCloses) saved.periodCloses = [];
      if(!saved.allocations) saved.allocations = [];
      if(!saved.bankRules)   saved.bankRules   = [];
      if(!saved.auditLog)    saved.auditLog    = [];
      if(!saved.fixedAssets) saved.fixedAssets = [];
      if(!saved.budgets)     saved.budgets     = {};
      if(!saved.amortizations) saved.amortizations = [];
      if(!saved.company.numberingSeries) saved.company.numberingSeries = {};
      if(saved.company.isPremium === undefined) saved.company.isPremium = false;
      if(!saved.company.premiumSince) saved.company.premiumSince = '';
      if(!saved.company.booksLockedUpto) saved.company.booksLockedUpto = '';
      if(!saved.company.invoiceTemplate) saved.company.invoiceTemplate = 'classic';
      // Migrate: ensure new TDS-payable ledgers (ITA-2025 sections) + the
      // Round Off ledger exist
      ['1325','1326','1327','1328','1329','4900'].forEach(id => {
        if(saved.coa && !saved.coa.find(a => a.id === id)){
          const seed = SEED_COA.find(a => a.id === id);
          if(seed) saved.coa.push({...seed});
        }
      });
      // Migrate: invoice round-off defaults ON (best practice; GST amounts are
      // rounded to the nearest rupee)
      if(saved.company.roundOff === undefined) saved.company.roundOff = true;
      // Migrate: controls default OFF for existing books (opt-in, so an existing
      // workflow is never suddenly blocked)
      if(saved.company.makerChecker === undefined)    saved.company.makerChecker = false;
      if(saved.company.requireNarration === undefined) saved.company.requireNarration = false;
      // Migrate: ensure modules config exists (preserve existing true for legacy installs)
      if(!saved.company.modules) {
        saved.company.modules = { gst:true, tds:true, payroll:true, factory:false, trader:false, service:false };
      } else {
        const dm = DEFAULT_COMPANY.modules;
        saved.company.modules = { ...dm, ...saved.company.modules };
      }
      return saved;
    }
    return {
      company: DEFAULT_COMPANY,
      coa: SEED_COA,
      parties: SEED_PARTIES,
      vouchers: [],
      forexRates: FOREX_RATES,
      gstr2bData: [],
      employees: [],
      payrollRuns: [],
      tdsSections: SEED_TDS_SECTIONS,
      stockItems: [],
      boms: [],
      productionOrders: [],
      costCentres: [],
      departments: [],
      bankRecon: [],
      allocations: [],
      bankRules: [],
      auditLog: [],
      fixedAssets: [],
      budgets: {},
      amortizations: [],
    };
  });
  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('limit');

  // Dark mode - persisted per browser
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem('mb_theme')==='dark'; } catch(e){ return false; } });
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    try { localStorage.setItem('mb_theme', darkMode?'dark':'light'); } catch(e){}
  }, [darkMode]);

  // Tally-style function keys: F4 Contra · F5 Payment · F6 Receipt · F7 Journal · F8 Sales · F9 Purchase
  useEffect(() => {
    const KEYMAP = {F4:'CON', F5:'PAY', F6:'REC', F7:'JV', F8:'SAL', F9:'PUR'};
    const h = (e) => {
      if(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = KEYMAP[e.key];
      if(!t) return;
      // Never steal keys while the user is typing or has any modal open -
      // otherwise F5 muscle-memory would wipe an in-progress voucher.
      const el = e.target;
      if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.isContentEditable)) return;
      if(document.querySelector('.modal-overlay')) return;
      e.preventDefault();
      setPage('vouchers');
      setTimeout(() => window.dispatchEvent(new CustomEvent('mb:newVoucher', {detail:{type:t}})), 60);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const triggerUpgrade = (reason='limit') => { setUpgradeReason(reason); setShowUpgrade(true); };
  const activeVoucherCount = useMemo(() => (data.vouchers||[]).filter(v=>v.status!=='Cancelled').length, [data.vouchers]);
  const isPrem = isPremiumActive(data.company);

  // Expose user identity for audit-trail entries written deep in components
  useEffect(() => { window.__miyeeUserEmail = user?.email || 'local'; }, [user]);

  // ── Weekly auto-backup: download a JSON snapshot if the last one is >7 days old
  useEffect(() => {
    try {
      const last = localStorage.getItem('miyee_last_backup');
      const now  = Date.now();
      if(last && now - parseInt(last) < 7*24*60*60*1000) return;
      if((data.vouchers||[]).length === 0) return;   // nothing worth backing up yet
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `MiyeeBooks_AutoBackup_${today()}.json`; a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem('miyee_last_backup', String(now));
      setTimeout(() => showToast('📦 Weekly auto-backup downloaded  keep it safe'), 600);
    } catch(e){ /* backups must never break the app */ }
  }, []);

  // Quick-create handlers from VoucherModal (avoids prop-drilling setData)
  useEffect(() => {
    const addAcc = (e) => setData(prev => ({...prev, coa: [...prev.coa, e.detail]}));
    const addParty = (e) => setData(prev => ({...prev, parties: [...prev.parties, e.detail]}));
    window.addEventListener('miyeebooks-add-account', addAcc);
    window.addEventListener('miyeebooks-add-party', addParty);
    return () => {
      window.removeEventListener('miyeebooks-add-account', addAcc);
      window.removeEventListener('miyeebooks-add-party', addParty);
    };
  }, []);

  // ── Cloud sync ─────────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState('local'); // local|syncing|saved|error
  const saveTimerRef = useRef(null);
  const justLoaded   = useRef(false);   // flag: skip auto-save right after Firestore load

  // viewer/limited = read-only setData (viewers can't modify data)
  const isViewer   = userRole === 'viewer';
  const canWrite   = !isViewer;
  const safeSetData = canWrite ? setData : () => {};

  // On login/company switch → load from Firestore (overwrites local state)
  // Uses ownerId (may differ from user.uid for shared companies)
  const effectiveOwner = ownerId || user?.uid;
  useEffect(() => {
    if(!user || !companyId) return;
    setSyncStatus('syncing');
    fbLoadCompany(effectiveOwner, companyId).then(cloudData => {
      if(cloudData){
        // Apply same migrations as local load
        if(!cloudData.stockItems)        cloudData.stockItems = [];
        if(!cloudData.boms)              cloudData.boms = [];
        if(!cloudData.productionOrders)  cloudData.productionOrders = [];
        if(!cloudData.costCentres)       cloudData.costCentres = [];
        if(!cloudData.departments)       cloudData.departments = [];
        if(!cloudData.bankRecon)         cloudData.bankRecon   = [];
        if(!cloudData.allocations)       cloudData.allocations = [];
        if(!cloudData.bankRules)         cloudData.bankRules   = [];
        if(!cloudData.auditLog)          cloudData.auditLog    = [];
        if(!cloudData.fixedAssets)       cloudData.fixedAssets = [];
        if(!cloudData.budgets)           cloudData.budgets     = {};
        if(!cloudData.amortizations)     cloudData.amortizations = [];
        if(!cloudData.company.numberingSeries) cloudData.company.numberingSeries = {};
        if(cloudData.company.isPremium === undefined) cloudData.company.isPremium = false;
        if(!cloudData.company.premiumSince) cloudData.company.premiumSince = '';
        if(!cloudData.company.booksLockedUpto) cloudData.company.booksLockedUpto = '';
        if(!cloudData.company.invoiceTemplate) cloudData.company.invoiceTemplate = 'classic';
        ['1325','1326','1327','1328','1329'].forEach(id => {
          if(cloudData.coa && !cloudData.coa.find(a => a.id === id)){
            const seed = SEED_COA.find(a => a.id === id);
            if(seed) cloudData.coa.push({...seed});
          }
        });
        if(!cloudData.tdsSections)       cloudData.tdsSections = SEED_TDS_SECTIONS;
        if(!cloudData.company.modules){
          cloudData.company.modules = { gst:true, tds:true, payroll:true, factory:false, trader:false, service:false };
        } else {
          cloudData.company.modules = { ...DEFAULT_COMPANY.modules, ...cloudData.company.modules };
        }
        justLoaded.current = true;
        setData(cloudData);
        saveData(cloudData);    // warm-up localStorage cache
      }
      setSyncStatus('saved');
    }).catch(() => setSyncStatus('error'));
  }, [user?.uid, companyId, effectiveOwner]);

  // On any data change → save to localStorage immediately, then debounce Firestore save
  // Viewers cannot save (read-only)
  useEffect(() => {
    saveData(data);
    if(!user || !companyId || isViewer) return;
    if(justLoaded.current){ justLoaded.current = false; return; }
    setSyncStatus('syncing');
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fbSaveCompany(effectiveOwner, companyId, data);
        setSyncStatus('saved');
      } catch(e){
        setSyncStatus('error');
      }
    }, 2000);
    return () => { if(saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [data]);
  // ───────────────────────────────────────────────────────────────────────────

  // Redirect to dashboard when the current page belongs to a now-disabled module
  useEffect(() => {
    const m = data.company.modules || {};
    const gstPages    = ['gstr1','gstr3b','gstr2b'];
    const payrollPages = ['hr_employees','hr_payroll','hr_payslips'];
    const tdsPages    = ['tds_sections','tds_report'];
    const invPages    = ['inv_items','inv_ledger','inv_bom','inv_production','inv_movement'];
    if(gstPages.includes(page)     && m.gst     !== true) setPage('dashboard');
    if(payrollPages.includes(page) && m.payroll  !== true) setPage('dashboard');
    if(tdsPages.includes(page)     && m.tds      !== true) setPage('dashboard');
    if(invPages.includes(page)     && !(m.trader || m.factory)) setPage('dashboard');
  }, [data.company.modules, page]);

  const showToast = (msg, type='success') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 2500);
  };

  // ----- Derived: ledger balances --------------------------------------------
  const ledgerBalances = useMemo(() => {
    const bal = {};
    data.coa.forEach(a => { bal[a.id] = a.opening || 0; });
    data.vouchers.forEach(v => {
      if(!affectsLedger(v)) return;
      (v.lines||[]).forEach(l => {
        if(!bal[l.accountId]) bal[l.accountId] = 0;
        // Debits positive for Asset/Expense; Credits positive for Liability/Equity/Income
        // We store as: dr increases bal, cr decreases bal (raw)
        bal[l.accountId] = (bal[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0);
      });
    });
    return bal;
  }, [data.coa, data.vouchers]);

  const mod = data.company.modules || {};
  const hasInventory = mod.factory || mod.trader;
  const invItems = [
    ...(mod.trader||mod.factory ? [{id:'inv_items', label:'Stock Items', ico:'▣'},{id:'inv_ledger', label:'Stock Ledger', ico:'▤'}] : []),
    ...(mod.factory ? [{id:'inv_bom', label:'Bill of Materials', ico:'⊞'},{id:'inv_production', label:'Production Orders', ico:'⚙'}] : []),
    ...(mod.trader||mod.factory ? [{id:'inv_movement', label:'Inventory Movements', ico:'⇌'},{id:'inv_valuation', label:'Stock Valuation', ico:'⚖'}] : []),
  ];

  // Role-based navigation: sections grouped the way a finance team divides work
  const nav = [
    {section:'Overview', items:[
      {id:'dashboard', label:'Dashboard', ico:'◈'},
      {id:'ceo', label:'CEO Dashboard', ico:'★'},
    ]},
    {section:'👨‍💻 Accountant', items:[
      {id:'vouchers', label:'Vouchers / Entry', ico:'✎'},
      {id:'salesdocs', label:'Quotations & Challans', ico:'📄'},
      {id:'collections', label:'Collections / Reminders', ico:'📢'},
      {id:'daybook', label:'Day Book', ico:'☷'},
      {id:'bank_recon', label:'Bank Reconciliation', ico:'🏦'},
      {id:'billwise', label:'Bill-wise Outstanding', ico:'📋'},
      {id:'parties', label:'Customers & Vendors', ico:'◉'},
      {id:'forex', label:'Forex / Multi-Currency', ico:'$'},
    ]},
    {section:'📊 Account Manager', items:[
      {id:'trial', label:'Trial Balance', ico:'⊟'},
      {id:'pnl', label:'Profit & Loss', ico:'⊞'},
      {id:'pnl_trend', label:'P&L Monthly Trend', ico:'📈'},
      {id:'bs', label:'Balance Sheet', ico:'⊠'},
      {id:'cashflow', label:'Cash Flow (AS-3)', ico:'⊜'},
      {id:'fund_flow', label:'Fund Flow Statement', ico:'⇅'},
      {id:'cash_forecast', label:'13-Week Cash Forecast', ico:'⛅'},
      {id:'budget', label:'Budget vs Actual', ico:'◳'},
      {id:'profitability', label:'Profitability Analysis', ico:'◴'},
      {id:'ledger_stmt', label:'Ledger Statement', ico:'≡'},
      {id:'debtor_stmt', label:'Debtors Statement', ico:'↗'},
      {id:'vendor_stmt', label:'Vendor Statement', ico:'↙'},
      {id:'mis', label:'CFO Dashboard', ico:'◇'},
      {id:'valuation', label:'Valuation / Financial Model', ico:'💹'},
      {id:'consolidation', label:'Group Consolidation', ico:'🏢'},
      {id:'mis_ratios', label:'Financial Ratios', ico:'▦'},
      {id:'mis_aging', label:'Aging Analysis', ico:'◫'},
    ]},
    {section:'🎯 Cost Accountant', items:[
      {id:'cost_centres', label:'Cost Centres', ico:'🎯'},
      {id:'departments', label:'Departments', ico:'🏢'},
      {id:'cc_report', label:'Cost / Profit Centre P&L', ico:'⊞'},
      {id:'dept_report', label:'Department Expenses', ico:'▤'},
      ...invItems,
    ]},
    {section:'🧾 Taxation', items:[
      ...(mod.gst===true ? [
        {id:'gstr1', label:'GSTR-1', ico:'◐'},
        {id:'gstr3b', label:'GSTR-3B', ico:'◑'},
        {id:'gstr2b', label:'GSTR-2B Recon.', ico:'◓'},
        {id:'gst_recon', label:'GST 3-Way Recon', ico:'⚖'},
        {id:'gstr9', label:'GSTR-9 Annual', ico:'◍'},
        {id:'sp_register', label:'Sales / Purchase Register', ico:'📑'},
        {id:'hsn_finder', label:'HSN / SAC Rate Finder', ico:'🔍'},
        {id:'tax_rates', label:'Tax Rate Reference', ico:'📖'},
      ] : []),
      {id:'compliance', label:'Compliance Calendar', ico:'📅'},
      {id:'period_close', label:'Period Close', ico:'🔄'},
      ...(mod.tds===true ? [
        {id:'tds_sections', label:'TDS Sections', ico:'§'},
        {id:'tds_report', label:'TDS Deducted Report', ico:'⊞'},
      ] : []),
      {id:'msme_dues', label:'MSME Dues - 43B(h)', ico:'⏱'},
      {id:'fixed_assets', label:'Fixed Asset Register', ico:'🏭'},
      {id:'amortization', label:'Prepaid Amortization', ico:'🗓'},
      {id:'adv_tax', label:'Advance Tax Estimator', ico:'₹'},
      {id:'startup', label:'Startup Reliefs & ROC', ico:'🚀'},
    ]},
    ...(mod.payroll===true ? [{section:'👥 HR & Payroll', items:[
      {id:'hr_employees', label:'Employee Master', ico:'☺'},
      {id:'hr_payroll', label:'Run Payroll', ico:'⊕'},
      {id:'hr_payslips', label:'Payslips', ico:'⊡'},
    ]}] : []),
    {section:'🔍 Auditor', items:[
      {id:'health', label:'Data Health Check', ico:'❤'},
      {id:'audit_log', label:'Audit Trail', ico:'🔍'},
      {id:'year_end', label:'Year-End Closing', ico:'🔒'},
      {id:'datamanage', label:'Export / Import', ico:'⇋'},
    ]},
    {section:'⚙ Admin', items:[
      {id:'coa', label:'Chart of Accounts', ico:'☰'},
      {id:'company', label:'Company Settings', ico:'⚙'},
      ...(FB_CONFIGURED && user ? [{id:'team', label:'Team Members', ico:'👥'}] : []),
      {id:'gdrive', label:'Google Drive Sync', ico:'☁'},
      ...(SUBSCRIPTION_ENABLED ? [{id:'upgrade', label: isPrem ? '✦ Premium Active' : '🚀 Upgrade to Premium', ico: isPrem ? '✦' : '⚡'}] : []),
      {id:'help', label:'Help & Guide', ico:'?'},
    ]},
  ];

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <button className="nav-toggle" onClick={()=>document.body.classList.toggle('navopen')} title="Menu">☰</button>
          <span className="brand-mark">Miyee<span className="dot">·</span>Books</span>
          <span className="brand-tag">MSME Accounting Suite</span>
        </div>
        <div className="topbar-right">
          <button onClick={()=>setDarkMode(d=>!d)} title={darkMode?'Switch to light mode':'Switch to dark mode'}
            style={{background:'transparent',border:'1px solid #2a4039',borderRadius:20,padding:'3px 10px',fontSize:12,color:'#b5c5be'}}>
            {darkMode?'☀':'🌙'}
          </button>
          <span className="pill">FY {data.company.fyStart?.slice(0,4)}–{data.company.fyEnd?.slice(2,4)}</span>
          <span>{data.company.name}</span>
          {data.company.gstin && <><span style={{color:'#5a7068'}}>•</span><span>GSTIN: {data.company.gstin}</span></>}
          {user && (<>
            <span style={{color:'#5a7068'}}>•</span>
            {syncStatus==='syncing' && <span className="sync-pill syncing" title="Saving to cloud…">☁ Saving…</span>}
            {syncStatus==='saved'   && <span className="sync-pill saved"   title="All changes saved to cloud">☁ Saved</span>}
            {syncStatus==='error'   && <span className="sync-pill error"   title="Cloud sync failed  data is safe locally">☁ Sync error</span>}
            {syncStatus==='local'   && <span className="sync-pill local"   title="Working in local mode">☁ Local</span>}
            {userRole && userRole !== 'owner' && (
              <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,
                background: userRole==='admin'?'#e3f0ff':userRole==='limited'?'#fff3e0':'#f5f5f5',
                color:      userRole==='admin'?'#1565c0':userRole==='limited'?'#e65100':'#757575'}}>
                {userRole.charAt(0).toUpperCase()+userRole.slice(1)}
              </span>
            )}
            {isViewer && <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#f5f5f5',color:'#757575'}}>👁 Read-Only</span>}
          {SUBSCRIPTION_ENABLED && (isPrem
            ? <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,background:'linear-gradient(90deg,#c9a227,#e6be4e)',color:'#5a3e00',cursor:'pointer',whiteSpace:'nowrap'}}
                onClick={()=>triggerUpgrade('manage')} title="Premium active  click to view plan">✦ Premium</span>
            : <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,background:'#fff3e0',color:'#e65100',cursor:'pointer',border:'1px solid #ffcc80',whiteSpace:'nowrap'}}
                onClick={()=>triggerUpgrade('topbar')} title={`Free plan · ${activeVoucherCount}/${FREE_VOUCHER_LIMIT} entries used`}>
                ⚡ Free {activeVoucherCount}/{FREE_VOUCHER_LIMIT}
              </span>
          )}
            <span style={{fontSize:11,color:'#eaf2fe',fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={user.email}>
              {user.displayName || user.email}
            </span>
            {onSwitchCompany && (
              <button className="btn btn-sm btn-ghost" onClick={onSwitchCompany}
                style={{fontSize:11,padding:'3px 9px'}} title="Switch to another company">⇌ Switch</button>
            )}
            {onSignOut && (
              <button className="btn btn-sm btn-ghost" onClick={onSignOut}
                style={{fontSize:11,padding:'3px 9px',color:'#ffe1e1',borderColor:'rgba(255,180,180,.5)'}} title="Sign out">Sign out</button>
            )}
          </>)}
        </div>
      </div>
      <div className="app">
        <aside className="sidebar">
          {nav.map(sec => (
            <div className="nav-section" key={sec.section}>
              <div className="nav-section-title">{sec.section}</div>
              {sec.items.map(it => (
                <div key={it.id} className={'nav-item' + (page===it.id?' active':'')} onClick={() => { setPage(it.id); document.body.classList.remove('navopen'); }}>
                  <span className="ico">{it.ico}</span>
                  <span>{it.label}</span>
                </div>
              ))}
            </div>
          ))}
          {/* Premium status card at sidebar bottom */}
          {SUBSCRIPTION_ENABLED && <div style={{padding:'10px 12px 14px',marginTop:'auto'}}>
            {isPrem ? (
              <div onClick={()=>triggerUpgrade('manage')} style={{background:'linear-gradient(135deg,#c9a227,#e6be4e)',borderRadius:10,padding:'11px 14px',cursor:'pointer',boxShadow:'0 2px 8px #c9a22730'}}>
                <div style={{fontWeight:800,fontSize:12,color:'#3d2c00',letterSpacing:'.3px'}}>✦ PREMIUM ACTIVE</div>
                <div style={{fontSize:10,color:'#5a3e00',marginTop:2}}>Unlimited entries · All modules</div>
                <div style={{fontSize:9,color:'#7a5e00',marginTop:1}}>Since: {data.company.premiumSince||''}</div>
              </div>
            ) : (
              <div onClick={()=>triggerUpgrade('sidebar')} style={{background:'linear-gradient(135deg,#0b6b4f,#1a9a72)',borderRadius:10,padding:'11px 14px',cursor:'pointer',boxShadow:'0 2px 8px #0b6b4f30'}}>
                <div style={{fontWeight:800,fontSize:11,color:'#fff',letterSpacing:'.4px'}}>⚡ UPGRADE TO PREMIUM</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,.8)',marginTop:3}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <div style={{flex:1,height:4,background:'rgba(255,255,255,.25)',borderRadius:4}}>
                      <div style={{height:'100%',background:'#fff',borderRadius:4,width:`${Math.min(100,(activeVoucherCount/FREE_VOUCHER_LIMIT)*100)}%`}}></div>
                    </div>
                    <span style={{fontSize:9,fontWeight:700,whiteSpace:'nowrap'}}>{activeVoucherCount}/{FREE_VOUCHER_LIMIT}</span>
                  </div>
                  ₹1,500/month · Unlimited entries
                </div>
              </div>
            )}
          </div>}
        </aside>
        <div className="nav-overlay" onClick={()=>document.body.classList.remove('navopen')}></div>
        <main className="main">
          {page==='dashboard' && <Dashboard data={data} balances={ledgerBalances} setPage={setPage} setData={canWrite?setData:()=>{}} showToast={showToast} />}
          {page==='coa' && <ChartOfAccounts data={data} setData={canWrite?setData:()=>{}} balances={ledgerBalances} showToast={showToast} readOnly={isViewer} />}
          {page==='parties' && <Parties data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='company' && <CompanySettings data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='team'         && <TeamMembers data={data} user={user} companyId={companyId} userRole={userRole} />}
          {page==='cost_centres' && <CostCentreMaster data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='departments'  && <DepartmentMaster data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='cc_report'    && <CostCentreReport data={data} />}
          {page==='dept_report'  && <DepartmentReport data={data} />}
          {page==='vouchers' && <Vouchers data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} userRole={userRole} />}
          {page==='salesdocs' && <SalesDocs data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='collections' && <Collections data={data} showToast={showToast} />}
          {page==='daybook' && <DayBook data={data} />}
          {page==='trial' && <TrialBalance data={data} balances={ledgerBalances} />}
          {page==='pnl' && <ProfitLoss data={data} balances={ledgerBalances} />}
          {page==='bs' && <BalanceSheet data={data} balances={ledgerBalances} />}
          {page==='cashflow' && <CashFlow data={data} balances={ledgerBalances} />}
          {page==='fund_flow' && <FundFlow data={data} />}
          {page==='cash_forecast' && <CashForecast data={data} balances={ledgerBalances} />}
          {page==='gstr1' && <GSTR1 data={data} />}
          {page==='gstr3b' && <GSTR3B data={data} balances={ledgerBalances} />}
          {page==='gstr2b' && <GSTR2B data={data} setData={setData} showToast={showToast} />}
          {page==='gst_recon' && <GSTRecon data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='tax_rates' && <TaxRates data={data} />}
          {page==='budget' && <BudgetVsActual data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='profitability' && <ProfitabilityReport data={data} />}
          {page==='sp_register' && <SalesPurchaseRegister data={data} />}
          {page==='gstr9' && <GSTR9 data={data} />}
          {page==='period_close' && <PeriodClose data={data} setData={canWrite?setData:()=>{}} showToast={showToast} setPage={setPage} readOnly={isViewer} />}
          {page==='compliance' && <ComplianceCalendar data={data} setPage={setPage} />}
          {page==='hsn_finder' && <HSNFinder data={data} />}
          {page==='forex' && <Forex data={data} setData={setData} showToast={showToast} />}
          {page==='ceo' && <CEODashboard data={data} balances={ledgerBalances} setPage={setPage} />}
          {page==='mis' && <MISDashboard data={data} balances={ledgerBalances} setPage={setPage} />}
          {page==='valuation' && <FinancialModel data={data} balances={ledgerBalances} />}
          {page==='consolidation' && <GroupConsolidation data={data} user={user} ownerId={ownerId||user?.uid} companyId={companyId} />}
          {page==='mis_ratios' && <FinancialRatios data={data} balances={ledgerBalances} />}
          {page==='mis_aging' && <AgingAnalysis data={data} balances={ledgerBalances} />}
          {page==='datamanage' && <DataManagement data={data} setData={setData} showToast={showToast} />}
          {page==='gdrive' && <GoogleDriveSync data={data} setData={setData} showToast={showToast} />}
          {page==='hr_employees' && <EmployeeMaster data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='hr_payroll' && <RunPayroll data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='hr_payslips' && <Payslips data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='tds_sections' && <TDSSections data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='tds_report' && <TDSReport data={data} />}
          {page==='bank_recon' && <BankReconciliation data={data} setData={canWrite?setData:()=>{}} showToast={showToast} />}
          {page==='pnl_trend' && <PnLTrend data={data} />}
          {page==='billwise' && <BillwiseAgeing data={data} />}
          {page==='fixed_assets' && <FixedAssets data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='amortization' && <PrepaidAmortization data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='adv_tax' && <AdvanceTax data={data} />}
          {page==='msme_dues' && <MSMEDues data={data} />}
          {page==='startup' && <StartupReliefs data={data} setData={canWrite?setData:()=>{}} showToast={showToast} readOnly={isViewer} />}
          {page==='health' && <HealthCheck data={data} setPage={setPage} />}
          {page==='audit_log' && <AuditLog data={data} />}
          {page==='year_end' && <YearEndClose data={data} setData={canWrite?setData:()=>{}} showToast={showToast} />}
          {page==='ledger_stmt' && <LedgerStatement data={data} balances={ledgerBalances} />}
          {page==='debtor_stmt' && <DebtorStatement data={data} />}
          {page==='vendor_stmt' && <VendorStatement data={data} />}
          {page==='inv_items' && <InventoryMaster data={data} setData={setData} showToast={showToast} />}
          {page==='inv_ledger' && <StockLedger data={data} />}
          {page==='inv_bom' && <FactoryBOM data={data} setData={setData} showToast={showToast} />}
          {page==='inv_production' && <ProductionOrders data={data} setData={setData} showToast={showToast} />}
          {page==='inv_movement' && <InventoryMovements data={data} />}
          {page==='inv_valuation' && <StockValuation data={data} setData={canWrite?setData:()=>{}} showToast={showToast} balances={ledgerBalances} readOnly={isViewer} />}
          {page==='help' && <HelpGuide setPage={setPage} />}
          {page==='upgrade' && (
            <div style={{maxWidth:720,margin:'0 auto'}}>
              <div className="page-head">
                <div>
                  <h1 className="page-title">🚀 MiyeeBooks Premium</h1>
                  <div className="page-sub">Upgrade for unlimited entries, all modules, and priority support</div>
                </div>
              </div>
              <UpgradeModal data={data} setData={setData} showToast={showToast}
                companyId={companyId} userUid={user?.uid}
                onClose={()=>setPage('dashboard')} triggerReason="settings" />
            </div>
          )}
          <div className="credit">
            <div><b>Miyee<span style={{color:'var(--accent)'}}>·</span>Books</b> &nbsp;·&nbsp; MSME Accounting Suite &nbsp;·&nbsp; Built by <b>Vipin Nair</b> &nbsp;·&nbsp; MYeeCFO Series</div>
          </div>
        </main>
      </div>
      {toast && <div className={'toast ' + (toast.type==='error'?'error':'success')}>{toast.msg}</div>}
      {showUpgrade && (
        <UpgradeModal data={data} setData={setData} showToast={showToast}
          companyId={companyId} userUid={user?.uid}
          onClose={()=>setShowUpgrade(false)} triggerReason={upgradeReason} />
      )}
    </>
  );
}
