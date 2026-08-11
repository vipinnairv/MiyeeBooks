
// ============================================================================
// SEED DATA  Schedule III aligned Chart of Accounts
// ============================================================================
const SEED_COA = [
  // EQUITY & LIABILITIES
  {id:'1100', name:'Equity Share Capital', group:'Shareholders Funds', type:'Equity', schedule:'Equity', opening:1000000},
  {id:'1110', name:'Reserves & Surplus', group:'Shareholders Funds', type:'Equity', schedule:'Equity', opening:0},
  {id:'1200', name:'Long Term Borrowings - Bank Loan', group:'Non-Current Liabilities', type:'Liability', schedule:'Non-Current Liab.', opening:500000},
  {id:'1210', name:'Deferred Tax Liability', group:'Non-Current Liabilities', type:'Liability', schedule:'Non-Current Liab.', opening:0},
  {id:'1300', name:'Sundry Creditors - Trade', group:'Current Liabilities', type:'Liability', schedule:'Trade Payables', opening:185000},
  {id:'1310', name:'CGST Payable', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1311', name:'SGST Payable', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1312', name:'IGST Payable', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1313', name:'TDS Payable', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1314', name:'TDS Payable  194C Contractor', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1315', name:'TDS Payable  194C Others', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1316', name:'TDS Payable  194J Professional', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1317', name:'TDS Payable  194I Rent', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1318', name:'TDS Payable  194H Commission', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1319', name:'TDS Payable  194A Interest', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1320B', name:'TDS Payable  194Q Purchase', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1321', name:'TDS Payable  192 Salary', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1325', name:'TDS Payable  194O E-commerce', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1326', name:'TDS Payable  194T Partner Remuneration', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1327', name:'TDS Payable  194R Perquisites', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1328', name:'TDS Payable  194 Dividend', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1329', name:'TDS Payable  Other Sections', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1322', name:'PF Payable (Employee + Employer)', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1323', name:'ESIC Payable (Employee + Employer)', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1324', name:'Professional Tax Payable', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1320', name:'Salary Payable', group:'Current Liabilities', type:'Liability', schedule:'Other Current Liab.', opening:0},
  {id:'1330', name:'Provision for Expenses', group:'Current Liabilities', type:'Liability', schedule:'Short-term Provisions', opening:0},
  // ASSETS
  {id:'2100', name:'Plant & Machinery', group:'Fixed Assets', type:'Asset', schedule:'PPE', opening:600000},
  {id:'2110', name:'Furniture & Fixtures', group:'Fixed Assets', type:'Asset', schedule:'PPE', opening:150000},
  {id:'2120', name:'Computers', group:'Fixed Assets', type:'Asset', schedule:'PPE', opening:120000},
  {id:'2130', name:'Accumulated Depreciation', group:'Fixed Assets', type:'Asset', schedule:'PPE', opening:-90000, contra:true},
  {id:'2200', name:'Investments - Mutual Funds', group:'Non-Current Investments', type:'Asset', schedule:'Investments', opening:200000},
  {id:'2300', name:'Inventory - Raw Materials', group:'Current Assets', type:'Asset', schedule:'Inventories', opening:120000},
  {id:'2310', name:'Inventory - Finished Goods', group:'Current Assets', type:'Asset', schedule:'Inventories', opening:85000},
  {id:'2400', name:'Sundry Debtors - Trade', group:'Current Assets', type:'Asset', schedule:'Trade Receivables', opening:240000},
  {id:'2500', name:'Cash in Hand', group:'Current Assets', type:'Asset', schedule:'Cash & Equivalents', opening:25000},
  {id:'2510', name:'Bank - Kotak Mahindra A/c', group:'Current Assets', type:'Asset', schedule:'Cash & Equivalents', opening:340000, isBank:true},
  {id:'2511', name:'Bank - HDFC A/c', group:'Current Assets', type:'Asset', schedule:'Cash & Equivalents', opening:150000, isBank:true},
  {id:'2520', name:'Bank - USD Account (Forex)', group:'Current Assets', type:'Asset', schedule:'Cash & Equivalents', opening:0, isBank:true, currency:'USD'},
  {id:'2600', name:'CGST Input Credit', group:'Current Assets', type:'Asset', schedule:'Other Current Assets', opening:0},
  {id:'2601', name:'SGST Input Credit', group:'Current Assets', type:'Asset', schedule:'Other Current Assets', opening:0},
  {id:'2602', name:'IGST Input Credit', group:'Current Assets', type:'Asset', schedule:'Other Current Assets', opening:0},
  {id:'2700', name:'TDS Receivable', group:'Current Assets', type:'Asset', schedule:'Other Current Assets', opening:0},
  // INCOME
  {id:'3100', name:'Sales - Domestic (Goods)', group:'Revenue from Operations', type:'Income', schedule:'Revenue', opening:0, hsn:'998311', gstRate:18},
  {id:'3110', name:'Sales - Services', group:'Revenue from Operations', type:'Income', schedule:'Revenue', opening:0, hsn:'998314', gstRate:18},
  {id:'3120', name:'Export Sales (Zero-Rated)', group:'Revenue from Operations', type:'Income', schedule:'Revenue', opening:0, gstRate:0, isExport:true},
  {id:'3200', name:'Interest Income', group:'Other Income', type:'Income', schedule:'Other Income', opening:0},
  {id:'3210', name:'Forex Gain', group:'Other Income', type:'Income', schedule:'Other Income', opening:0},
  // EXPENSES
  {id:'4100', name:'Purchase - Raw Materials', group:'Cost of Materials', type:'Expense', schedule:'Cost of Materials', opening:0, gstRate:18},
  {id:'4110', name:'Purchase - Trading Goods', group:'Purchase of Stock-in-Trade', type:'Expense', schedule:'Purchases', opening:0, gstRate:18},
  {id:'4200', name:'Salaries & Wages', group:'Employee Benefit Expenses', type:'Expense', schedule:'Employee Benefits', opening:0},
  {id:'4210', name:'PF & ESI Contribution', group:'Employee Benefit Expenses', type:'Expense', schedule:'Employee Benefits', opening:0},
  {id:'4300', name:'Interest on Loan', group:'Finance Costs', type:'Expense', schedule:'Finance Costs', opening:0},
  {id:'4310', name:'Bank Charges', group:'Finance Costs', type:'Expense', schedule:'Finance Costs', opening:0},
  {id:'4400', name:'Depreciation', group:'Depreciation', type:'Expense', schedule:'Depreciation', opening:0},
  {id:'4500', name:'Rent', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, gstRate:18},
  {id:'4510', name:'Electricity', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0},
  {id:'4520', name:'Telephone & Internet', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, gstRate:18},
  {id:'4530', name:'Travelling & Conveyance', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0},
  {id:'4540', name:'Office Supplies', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, gstRate:18},
  {id:'4550', name:'Professional Fees', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, gstRate:18},
  {id:'4560', name:'Forex Loss', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0},
  {id:'4900', name:'Round Off', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, system:true},
];

const SEED_PARTIES = [
  {id:uid(), name:'Reliance Industries Ltd', type:'Customer', gstin:'27AAACR5055K1Z7', state:'Maharashtra', stateCode:'27', address:'Maker Chambers IV, Mumbai', email:'ap@ril.com', phone:'+91 22 3555 5000', currency:'INR', balance:120000},
  {id:uid(), name:'Tata Consultancy Services', type:'Customer', gstin:'27AAACT2727Q1ZW', state:'Maharashtra', stateCode:'27', address:'TCS House, Mumbai', email:'vendor@tcs.com', phone:'+91 22 6778 9999', currency:'INR', balance:80000},
  {id:uid(), name:'Acme Trading Co.', type:'Customer', gstin:'24AABCA1234Z1ZA', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'info@acme.in', phone:'+91 79 2658 0000', currency:'INR', balance:40000},
  {id:uid(), name:'GlobalCorp Inc. (USA)', type:'Customer', gstin:'', state:'Outside India', stateCode:'97', address:'Delaware, USA', email:'ap@globalcorp.com', phone:'+1 302 555 0100', currency:'USD', balance:0, isForeign:true},
  {id:uid(), name:'Aditya Birla Supplies', type:'Vendor', gstin:'24AABCA9999B1ZJ', state:'Gujarat', stateCode:'24', address:'Surat', email:'sales@absupplies.in', phone:'+91 261 234 5000', currency:'INR', balance:85000},
  {id:uid(), name:'Mahesh Stationers', type:'Vendor', gstin:'24BBCDM4321A1Z5', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'mahesh@stat.in', phone:'+91 98765 12345', currency:'INR', balance:25000},
  {id:uid(), name:'Reliance Jio (Telecom)', type:'Vendor', gstin:'27AAACR5055K2Z6', state:'Maharashtra', stateCode:'27', address:'Mumbai', email:'support@jio.com', phone:'1800 889 9999', currency:'INR', balance:0},
  {id:uid(), name:'Office Landlord  Mr. Patel', type:'Vendor', gstin:'', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'patel@landlord.in', phone:'+91 99999 11111', currency:'INR', balance:0, unregistered:true},
];

const DEFAULT_COMPANY = {
  name:'My MSME Enterprises Pvt Ltd',
  address:'45 Industrial Estate, Ahmedabad, Gujarat 380001',
  gstin:'24ABCDE1234F1Z6',
  pan:'ABCDE1234F',
  cin:'U72200GJ2020PTC123456',
  email:'accounts@mymsme.in',
  phone:'+91 79 2658 9999',
  state:'Gujarat',
  stateCode:'24',
  baseCurrency:'INR',
  fyStart:'2025-04-01',
  fyEnd:'2026-03-31',
  modules: {
    gst:     true,   // GST Module  GSTR-1, GSTR-3B, GSTR-2B
    tds:     true,   // TDS Module  Sections, Deduction Report
    payroll: true,   // HR & Payroll  Employee Master, Payroll, Payslips
    factory: false,  // Factory / Manufacturer  BOM, Production Orders
    trader:  false,  // Trader  Stock Items, Stock Ledger, Inventory Movements
    service: false,  // Service Sector  Service-specific features
  },
  isPremium:    false,
  premiumSince: '',
  booksLockedUpto: '',   // vouchers on/before this date cannot be added/edited/cancelled
  invoiceTemplate: 'classic',
  upiId: '',             // e.g. name@okhdfcbank - prints a Pay-Now QR on sales invoices
  numberingSeries: {},   // per voucher type: {SAL:{prefix,padding,includeFY}}
  taxRate: 25,           // income-tax % for the P&L / Balance Sheet estimate
  roundOff: true,        // round GST invoices to the nearest rupee
  makerChecker: false,   // require approval (owner/admin) before entries post
  requireNarration: false, // every voucher must carry a narration or reference
};

// A clean, fresh dataset (used on first load AND by Reset). Deep-copies seeds so
// nothing shares a reference with the module-level constants.
const makeFreshData = (overrides={}) => ({
  company: {...DEFAULT_COMPANY, modules:{...DEFAULT_COMPANY.modules}, ...(overrides.company||{})},
  coa: SEED_COA.map(a=>({...a})),
  parties: SEED_PARTIES.map(p=>({...p})),
  vouchers: [],
  forexRates: FOREX_RATES,
  gstr2bData: [],
  employees: [],
  payrollRuns: [],
  reimbursements: [], projects: [],
  tdsSections: SEED_TDS_SECTIONS,
  stockItems: [], boms: [], productionOrders: [], quotations: [],
  costCentres: [], departments: [],
  bankRecon: [], allocations: [], bankRules: [],
  auditLog: [], fixedAssets: [], budgets: {}, amortizations: [],
  ...overrides,
});

// ── Group consolidation ──────────────────────────────────────────────────────
// Reduce one company's full dataset to the headline figures used for group
// consolidation. Pure & COA-agnostic (sums by account TYPE), so it works on any
// entity's data. Intercompany eliminations are NOT applied (documented - MSME
// groups typically post those as manual JVs before consolidating).
const computeEntityFinancials = (d) => {
  if(!d || !d.coa) return null;
  const bal = {};
  d.coa.forEach(a => { bal[a.id] = a.opening || 0; });
  (d.vouchers||[]).forEach(v => {
    if(v.status==='Cancelled') return;
    (v.lines||[]).forEach(l => {
      if(l.accountId==null) return;
      if(!(l.accountId in bal)) bal[l.accountId] = 0;
      bal[l.accountId] += (l.debit||0) - (l.credit||0);
    });
  });
  const raw = id => bal[id] || 0;
  const byType = (t, sign) => d.coa.filter(a=>a.type===t).reduce((s,a)=> s + sign*(bal[a.id]||0), 0);
  const income  = byType('Income', -1);
  const expense = byType('Expense', 1);
  const profit  = income - expense;
  const assets  = byType('Asset', 1);
  const liab    = byType('Liability', -1);
  const equity  = byType('Equity', -1) + profit;
  const cash    = d.coa.filter(a=>a.isBank || a.id==='2500').reduce((s,a)=>s+(bal[a.id]||0),0);
  return {
    name:(d.company&&d.company.name)||'', gstin:(d.company&&d.company.gstin)||'',
    groupName:((d.company&&d.company.groupName)||'').trim(), isHolding:!!(d.company&&d.company.isHolding),
    income, expense, profit, assets, liab, equity, cash,
    debtors: raw('2400'), creditors: -raw('1300'),
    vouchers:(d.vouchers||[]).filter(v=>v.status!=='Cancelled').length,
  };
};

// Account-level balances for one entity: raw balance (opening + Dr − Cr) per
// account id, plus name/type/group metadata - the building block for the
// consolidated Trial Balance / P&L / Balance Sheet.
function computeEntityBalances(d){
  if(!d || !d.coa) return null;
  const bal = {}, meta = {};
  d.coa.forEach(a => { bal[a.id] = a.opening || 0; meta[a.id] = {name:a.name, type:a.type, group:a.group||''}; });
  (d.vouchers||[]).forEach(v => {
    if(v.status==='Cancelled') return;
    (v.lines||[]).forEach(l => {
      if(l.accountId==null) return;
      if(!(l.accountId in bal)){ bal[l.accountId]=0; meta[l.accountId]={name:String(l.accountId), type:'Asset', group:''}; }
      bal[l.accountId] += (l.debit||0) - (l.credit||0);
    });
  });
  return {bal, meta};
}

// Intercompany elimination engine (AS-21 style consolidation worksheet).
// entities: [{id, name, gstin, data}]. A party inside entity A is recognised as
// "intercompany" when its GSTIN matches another group entity's GSTIN (fallback:
// exact name match). For each entity pair it measures both trading directions
// (A→B sales vs B's recorded purchases) and the AR↔AP mirror balances, and
// eliminates the MATCHED amount (the lower of the two sides - the difference is
// reported as a mismatch for the accountant to fix, never silently eliminated).
// Returns {rows, adj} where adj is a per-account raw-balance adjustment map that
// always nets to zero (so the consolidated TB still tallies after applying it).
function computeEliminations(entities){
  const r2 = n => Math.round((n||0)*100)/100;
  const legs = [];
  entities.forEach(A => {
    (A.data.parties||[]).forEach(p => {
      const B = entities.find(e => e.id !== A.id && (
        (p.gstin && e.gstin && String(p.gstin).toUpperCase() === String(e.gstin).toUpperCase()) ||
        ((p.name||'').trim().toLowerCase() !== '' && (p.name||'').trim().toLowerCase() === (e.name||'').trim().toLowerCase())));
      if(!B) return;
      let sales=0, purch=0, ar=0, ap=0;
      (A.data.vouchers||[]).forEach(v => {
        if(v.status==='Cancelled' || v.partyId !== p.id) return;
        if(v.type==='SAL') sales += v.taxable||0;
        if(v.type==='CRN') sales -= v.taxable||0;
        if(v.type==='PUR') purch += v.taxable||0;
        if(v.type==='DBN') purch -= v.taxable||0;
        (v.lines||[]).forEach(l => {
          if(l.accountId==='2400') ar += (l.debit||0)-(l.credit||0);
          if(l.accountId==='1300') ap += (l.credit||0)-(l.debit||0);
        });
      });
      legs.push({fromId:A.id, fromName:A.name, toId:B.id, toName:B.name, party:p.name,
        sales:r2(sales), purch:r2(purch), ar:r2(Math.max(0,ar)), ap:r2(Math.max(0,ap))});
    });
  });
  const rows = [], adj = {};
  const add = (id, delta) => { adj[id] = r2((adj[id]||0) + delta); };
  const seen = new Set();
  legs.forEach(L => {
    const k1 = L.fromId+'>'+L.toId, k2 = L.toId+'>'+L.fromId;
    if(seen.has(k1) || seen.has(k2)) return;
    seen.add(k1); seen.add(k2);
    const M = legs.find(x => x.fromId===L.toId && x.toId===L.fromId) || {sales:0, purch:0, ar:0, ap:0};
    // Direction 1: L.from sells to L.to (matched against M's purchases)
    const t1 = r2(Math.min(L.sales, M.purch));
    // Direction 2: L.to sells to L.from
    const t2 = r2(Math.min(M.sales, L.purch));
    // Balances: L.from's receivable vs L.to's payable, and vice-versa
    const b1 = r2(Math.min(L.ar, M.ap));
    const b2 = r2(Math.min(M.ar, L.ap));
    // Raw-balance sign convention: income negative → +T shrinks it; expense positive → −T;
    // asset positive → −B; liability negative → +B. Each pair nets to zero → TB stays tallied.
    if(t1>0){ add('3100', t1); add('4100', -t1); }
    if(t2>0){ add('3100', t2); add('4100', -t2); }
    if(b1>0){ add('2400', -b1); add('1300', b1); }
    if(b2>0){ add('2400', -b2); add('1300', b2); }
    rows.push({a:L.fromName, b:L.toName,
      salesAB:L.sales, purchBA:M.purch, elimTradeAB:t1, tradeMismatchAB:r2(Math.abs(L.sales-M.purch)),
      salesBA:M.sales, purchAB:L.purch, elimTradeBA:t2, tradeMismatchBA:r2(Math.abs(M.sales-L.purch)),
      arAB:L.ar, apBA:M.ap, elimBalAB:b1, balMismatchAB:r2(Math.abs(L.ar-M.ap)),
      arBA:M.ar, apAB:L.ap, elimBalBA:b2, balMismatchBA:r2(Math.abs(M.ar-L.ap))});
  });
  return {rows, adj};
}

// ── Audit trail helper ───────────────────────────────────────────────────────
// Records who did what, when. User email is set globally by App on login.
const auditEntry = (action, detail) => ({
  ts: new Date().toISOString(),
  user: window.__miyeeUserEmail || 'local',
  action, detail,
});
// Returns true if the date falls in a locked period (and shows why via toast fn)
const isDateLocked = (company, date) =>
  !!(company?.booksLockedUpto && date && date <= company.booksLockedUpto);

// ── Party sub-ledger builder ─────────────────────────────────────────────────
// Extracts every movement for a party against its control account
// (2400 Trade Receivables for customers, 1300 Trade Payables for vendors).
// Party is matched at LINE level first (CSV imports tag lines), voucher level second.
// Falls back to voucher amount when a party voucher has no control-account line.
const partyLedgerMoves = (data, partyId, ctrlAcc) => {
  const moves = [];
  (data.vouchers||[]).forEach(v => {
    if(v.status === 'Cancelled') return;
    let found = false;
    (v.lines||[]).forEach(l => {
      const lParty = l.partyId || v.partyId;
      if(lParty !== partyId) return;
      if(l.accountId !== ctrlAcc) return;
      found = true;
      moves.push({date:v.date, vno:v.number||v.id.slice(0,8), type:v.type,
        narration:l.narration||v.narration||'', dr:l.debit||0, cr:l.credit||0});
    });
    // Fallback for vouchers tied to the party but posted without a control line
    if(!found && v.partyId === partyId){
      const amt = v.total || v.amount || 0;
      if(amt <= 0) return;
      const isDebtor = ctrlAcc === '2400';
      let dr=0, cr=0;
      if(isDebtor){
        if(['SAL','DBN'].includes(v.type)) dr = amt;
        else if(['REC','CRN'].includes(v.type)) cr = amt;
        else return;
      } else {
        if(['PUR','CRN'].includes(v.type)) cr = amt;
        else if(['PAY','DBN'].includes(v.type)) dr = amt;
        else return;
      }
      moves.push({date:v.date, vno:v.number||v.id.slice(0,8), type:v.type,
        narration:v.narration||'', dr, cr});
    }
  });
  moves.sort((a,b) => a.date.localeCompare(b.date) || a.vno.localeCompare(b.vno));
  return moves;
};

// Closing balance for a party as on a date (receivable: Dr+ve · payable: Cr+ve)
const partyClosingBal = (data, party, ctrlAcc, uptoDate) => {
  const isDebtor = ctrlAcc === '2400';
  let bal = (party.balance||0) * (isDebtor ? 1 : 1); // master opening (signed as entered)
  partyLedgerMoves(data, party.id, ctrlAcc).forEach(m => {
    if(uptoDate && m.date > uptoDate) return;
    bal += isDebtor ? (m.dr - m.cr) : (m.cr - m.dr);
  });
  return bal;
};

const VOUCHER_TYPES = [
  {code:'JV', name:'Journal Entry', icon:'≡', desc:'General journal entry', double:true},
  {code:'PUR', name:'Purchase', icon:'⇣', desc:'Purchase invoice with GST', double:true},
  {code:'SAL', name:'Sales', icon:'⇡', desc:'Sales invoice with GST', double:true},
  {code:'PAY', name:'Payment', icon:'→', desc:'Payment to vendor/expense', double:false},
  {code:'REC', name:'Receipt', icon:'←', desc:'Receipt from customer', double:false},
  {code:'CON', name:'Contra', icon:'⇄', desc:'Cash/bank transfer', double:false},
  {code:'CRN', name:'Credit Note', icon:'⊖', desc:'Sales return / credit', double:true},
  {code:'DBN', name:'Debit Note', icon:'⊕', desc:'Purchase return / debit', double:true},
];

// ── PREMIUM / FREEMIUM ───────────────────────────────────────────────────────
const SUBSCRIPTION_ENABLED = false;      // master switch: false = no limits, no upgrade UI
const FREE_VOUCHER_LIMIT  = 100;         // max active vouchers in free tier (only when subscription enabled)
const PREMIUM_PRICE_INR   = 1500;        // ₹1500 / month
const PREMIUM_CONTACT     = 'audit.vipin@gmail.com';
const PREMIUM_PHONE       = '+91 81602 03197';
const PREMIUM_UPI         = 'audit.vipin@okicici';   // UPI for payment

// Premium status is set ONLY by the developer in Firebase Firestore.
// There is no client-side key or algorithm  this is a single-file app and
// any client-side "key generator" would be visible to all users.
// Activation path: customer pays → developer sets isPremium:true in Firestore
// for that company document → app reads it on next sync.
const isPremiumActive = (company) => company?.isPremium === true;

const FOREX_RATES = {
  USD: 83.50, EUR: 89.20, GBP: 105.75, AED: 22.75, SGD: 61.40, JPY: 0.56,
};

// ── HSN / SAC GST RATE MASTER (GST 2.0 · Notif. 9/2025-CT(Rate) · w.e.f. 22-Sep-2025) ──
// Tuple: [code, kind('HSN'|'SAC'), description, igstRate(-1 = outside GST), cess%, schedule]
const HSN_SAC_RAW = [
  // ── GOODS ──
  ['0101','HSN','Live horses, asses, mules',5,0,'I'],
  ['0102','HSN','Live bovine animals (cattle, buffalo)',0,0,'NIL'],
  ['0103','HSN','Live swine',0,0,'NIL'],
  ['0105','HSN','Live poultry',0,0,'NIL'],
  ['0201','HSN','Meat of bovine  fresh/chilled',0,0,'NIL'],
  ['0201','HSN','Meat of bovine  frozen, packed & labelled',5,0,'I'],
  ['0207','HSN','Poultry meat  fresh/chilled',0,0,'NIL'],
  ['0207','HSN','Poultry meat  frozen, packed & labelled',5,0,'I'],
  ['0302','HSN','Fish  fresh/chilled',0,0,'NIL'],
  ['0303','HSN','Fish  frozen, packed & labelled',5,0,'I'],
  ['0306','HSN','Crustaceans (shrimps, prawns)  fresh/chilled',0,0,'NIL'],
  ['0306','HSN','Crustaceans  frozen, packed & labelled',5,0,'I'],
  ['0401','HSN','Milk and cream (unconcentrated, no sugar)',0,0,'NIL'],
  ['0402','HSN','Milk and cream  concentrated or sweetened',5,0,'I'],
  ['0403','HSN','Yoghurt / curd  pre-packed & labelled',5,0,'I'],
  ['0403','HSN','Yoghurt / curd  loose / unbranded',0,0,'NIL'],
  ['0406','HSN','Cheese',12,0,'II'],
  ['0407','HSN','Eggs (in shell, fresh)',0,0,'NIL'],
  ['0408','HSN','Egg yolks, dried / processed',5,0,'I'],
  ['0409','HSN','Natural honey  pre-packed & labelled',5,0,'I'],
  ['0409','HSN','Natural honey  unpacked',0,0,'NIL'],
  ['0501','HSN','Human hair (unworked)',0,0,'NIL'],
  ['0601','HSN','Bulbs, tubers, roots (planting)',0,0,'NIL'],
  ['0602','HSN','Live plants, cuttings, slips',0,0,'NIL'],
  ['0701','HSN','Potatoes  fresh / chilled',0,0,'NIL'],
  ['0702','HSN','Tomatoes  fresh / chilled',0,0,'NIL'],
  ['0703','HSN','Onions, garlic  fresh / chilled',0,0,'NIL'],
  ['0714','HSN','Manioc, sweet potato (fresh/dried)',0,0,'NIL'],
  ['0801','HSN','Coconuts, cashew, brazil nuts  fresh',0,0,'NIL'],
  ['0801','HSN','Cashew (processed / roasted)',5,0,'I'],
  ['0802','HSN','Almonds, walnuts  in shell',5,0,'I'],
  ['0803','HSN','Bananas  fresh / dried',0,0,'NIL'],
  ['0901','HSN','Coffee  not roasted',0,0,'NIL'],
  ['0901','HSN','Coffee  roasted (not decaffeinated)',5,0,'I'],
  ['0902','HSN','Tea (black, green)  pre-packed & labelled',5,0,'I'],
  ['0902','HSN','Tea  loose / unbranded',0,0,'NIL'],
  ['0910','HSN','Ginger, saffron, turmeric (fresh/dried)',0,0,'NIL'],
  ['1001','HSN','Wheat and meslin',0,0,'NIL'],
  ['1006','HSN','Rice  unbranded loose',0,0,'NIL'],
  ['1006','HSN','Rice  pre-packed & labelled',5,0,'I'],
  ['1101','HSN','Wheat flour (atta)  unbranded',0,0,'NIL'],
  ['1101','HSN','Wheat flour (atta)  branded / packed',5,0,'I'],
  ['1701','HSN','Cane / beet sugar (refined)',5,0,'I'],
  ['1702','HSN','Jaggery (gur)  all types',5,0,'I'],
  ['1901','HSN','Malt extract, food preps of flour/meal',12,0,'II'],
  ['1905','HSN','Bread (unpackaged)',0,0,'NIL'],
  ['1905','HSN','Bread (branded/packaged), rusks, toasted',5,0,'I'],
  ['2001','HSN','Vegetables & fruit  prepared / preserved',12,0,'II'],
  ['2009','HSN','Fruit juices (unfermented)',12,0,'II'],
  ['2101','HSN','Extracts / essences of coffee',18,0,'III'],
  ['2101','HSN','Extracts / essences of tea',18,0,'III'],
  ['2103','HSN','Sauces, condiments, mixed seasonings',12,0,'II'],
  ['2106','HSN','Food preparations NEC (protein concentrates)',18,0,'III'],
  ['2202','HSN','Waters  flavoured/sweetened (mineral water)',12,0,'II'],
  ['2202','HSN','Aerated drinks / carbonated beverages',28,12,'IV'],
  ['2203','HSN','Beer made from malt',28,0,'IV'],
  ['2208','HSN','Spirits, liqueurs & spirituous beverages',28,0,'IV'],
  ['2401','HSN','Unmanufactured tobacco',28,0,'IV'],
  ['2402','HSN','Cigars, cheroots, cigarillos, cigarettes',28,0,'IV'],
  ['2501','HSN','Salt (for human consumption)',0,0,'NIL'],
  ['2516','HSN','Granite, sandstone, porphyry (worked)',12,0,'II'],
  ['2517','HSN','Sand (natural)',5,0,'I'],
  ['2523','HSN','Portland cement, aluminous cement',18,0,'III'],
  ['2601','HSN','Iron ore',0,0,'NIL'],
  ['2709','HSN','Crude petroleum oils',-1,0,'Outside GST'],
  ['2710','HSN','Motor spirit (petrol)',-1,0,'Outside GST'],
  ['2710','HSN','High speed diesel (HSD)',-1,0,'Outside GST'],
  ['2711','HSN','LPG  for domestic use',0,0,'NIL'],
  ['2711','HSN','LPG  for commercial use',12,0,'II'],
  ['2801','HSN','Fluorine, chlorine, bromine, iodine',5,0,'I'],
  ['2835','HSN','Phosphinates, phosphonates',12,0,'II'],
  ['2933','HSN','Medicaments  pharma bulk APIs',12,0,'II'],
  ['3001','HSN','Life saving drugs (notified)',0,0,'NIL'],
  ['3004','HSN','Medicines / medicaments (general)',12,0,'II'],
  ['3401','HSN','Soap (household)',5,0,'I'],
  ['3402','HSN','Detergents, washing preparations',18,0,'III'],
  ['3507','HSN','Enzymes, prepared enzymes',18,0,'III'],
  ['3601','HSN','Propellant powders, prepared explosives',18,0,'III'],
  ['3808','HSN','Insecticides, fungicides, herbicides',18,0,'III'],
  ['3901','HSN','Polymers of ethylene (primary form)',18,0,'III'],
  ['3926','HSN','Plastic articles NEC',18,0,'III'],
  ['4002','HSN','Synthetic rubber',5,0,'I'],
  ['4011','HSN','New pneumatic tyres (rubber)',28,0,'IV'],
  ['4107','HSN','Leather  prepared (full grain)',5,0,'I'],
  ['4202','HSN','Trunks, suitcases, handbags  of leather',18,0,'III'],
  ['5007','HSN','Woven fabrics of silk',5,0,'I'],
  ['5208','HSN','Woven fabrics of cotton (≤ ₹1000/piece)',5,0,'I'],
  ['5208','HSN','Woven fabrics of cotton (> ₹1000/piece)',12,0,'II'],
  ['5402','HSN','Synthetic filament yarn',12,0,'II'],
  ['6101','HSN',"Men's overcoats, jackets (≤ ₹1000)",5,0,'I'],
  ['6101','HSN',"Men's overcoats, jackets (> ₹1000)",12,0,'II'],
  ['6104','HSN',"Women's suits, jackets (> ₹1000)",12,0,'II'],
  ['6204','HSN',"Women's suits, jackets (woven, > ₹1000)",12,0,'II'],
  ['6401','HSN','Waterproof footwear',18,0,'III'],
  ['6403','HSN','Footwear, rubber/plastic soles (≤ ₹1000)',5,0,'I'],
  ['6403','HSN','Footwear (> ₹1000)',18,0,'III'],
  ['6810','HSN','Articles of cement, concrete (bricks, blocks)',12,0,'II'],
  ['6901','HSN','Bricks (fly ash / soil)',5,0,'I'],
  ['7101','HSN','Natural pearls (graded, not strung)',0,0,'NIL'],
  ['7102','HSN','Natural diamonds (rough/unworked)',0.25,0,'Special'],
  ['7103','HSN','Semi-precious stones (worked)',3,0,'Precious'],
  ['7108','HSN','Gold (unwrought / semi-manufactured)',3,0,'Precious'],
  ['7113','HSN','Jewellery  gold / silver / platinum',3,0,'Precious'],
  ['7201','HSN','Pig iron',5,0,'I'],
  ['7206','HSN','Iron / steel billets, ingots',18,0,'III'],
  ['7213','HSN','Bars / rods (iron / steel)  hot rolled',18,0,'III'],
  ['7308','HSN','Structures of iron / steel (bridges, towers)',18,0,'III'],
  ['7401','HSN','Copper mattes / cement copper',5,0,'I'],
  ['7601','HSN','Aluminium  unwrought',5,0,'I'],
  ['7608','HSN','Aluminium tubes / pipes',18,0,'III'],
  ['8414','HSN','Air pumps, vacuum pumps, air compressors',12,0,'II'],
  ['8415','HSN','Air-conditioning machines (split / window)',28,0,'IV'],
  ['8418','HSN','Refrigerators, freezers, heat pumps',18,0,'III'],
  ['8419','HSN','Water heaters, boilers (industrial)',18,0,'III'],
  ['8443','HSN','Printing machinery',12,0,'II'],
  ['8450','HSN','Washing machines (household ≤ 10 kg)',28,0,'IV'],
  ['8471','HSN','Computers / laptops / tablets',18,0,'III'],
  ['8504','HSN','Transformers, static converters (≤ 1 kVA)',18,0,'III'],
  ['8507','HSN','Electric accumulators / li-ion batteries',18,0,'III'],
  ['8517','HSN','Telephones, smartphones, feature phones',18,0,'III'],
  ['8524','HSN','Flat panel display modules',18,0,'III'],
  ['8525','HSN','Transmission apparatus (radio, TV)',18,0,'III'],
  ['8528','HSN','TV monitors and projectors (≤ 32 in)',18,0,'III'],
  ['8528','HSN','TV monitors and projectors (> 32 in)',28,0,'IV'],
  ['8544','HSN','Insulated wires, cables, conductors',18,0,'III'],
  ['8701','HSN','Tractors (≤ 1800 cc engine)',12,0,'II'],
  ['8702','HSN','Motor vehicles  public transport (bus)',12,0,'II'],
  ['8703','HSN','Cars  petrol ≤ 1200 cc',28,1,'IV'],
  ['8703','HSN','Cars  diesel ≤ 1500 cc',28,3,'IV'],
  ['8703','HSN','Cars  above 1500 cc / SUV',28,20,'IV'],
  ['8711','HSN','Motorcycles  engine > 350 cc',28,0,'IV'],
  ['8711','HSN','Motorcycles  engine ≤ 350 cc',28,0,'IV'],
  ['8714','HSN','Parts for motorcycles / cycles',28,0,'IV'],
  ['8716','HSN','Non-motorised vehicles (carts, cycles)',12,0,'II'],
  ['8802','HSN','Aircraft, spacecraft (civilian use)',5,0,'I'],
  ['8903','HSN','Yachts, recreational boats',28,0,'IV'],
  ['9006','HSN','Photographic cameras',18,0,'III'],
  ['9018','HSN','Medical / surgical instruments',12,0,'II'],
  ['9021','HSN','Orthopaedic appliances, hearing aids',5,0,'I'],
  ['9021','HSN','Cochlear implants',0,0,'NIL'],
  ['9026','HSN','Instruments  flow, level, pressure',18,0,'III'],
  ['9030','HSN','Oscilloscopes, spectrum analysers',18,0,'III'],
  ['9301','HSN','Military weapons (tanks, combat vehicles)',0,0,'NIL'],
  ['9401','HSN','Seats (chairs, sofas  household)',18,0,'III'],
  ['9403','HSN','Furniture  wooden, metal, plastic',18,0,'III'],
  ['9503','HSN','Toys  tricycles, scooters, toy cars',18,0,'III'],
  ['9504','HSN','Video game consoles / machines',28,0,'IV'],
  ['9601','HSN','Worked ivory, bone, tortoise-shell, coral',5,0,'I'],
  ['9619','HSN','Sanitary towels, tampons, diapers',12,0,'II'],
  // ── SERVICES (SAC) ──
  ['995411','SAC','Construction  residential (affordable ≤ 45L)',0,0,'NIL'],
  ['995411','SAC','Construction  other residential buildings',5,0,'I'],
  ['995412','SAC','Construction  commercial / industrial',18,0,'III'],
  ['995421','SAC','Road and highway construction',12,0,'II'],
  ['995425','SAC','Construction  mines and industrial plants',18,0,'III'],
  ['995431','SAC','Electrical installation services',18,0,'III'],
  ['995432','SAC','Plumbing, heating, AC  installation',18,0,'III'],
  ['995450','SAC','Building completion & finishing services',18,0,'III'],
  ['997212','SAC','Rental  residential property (tenant unregistered)',0,0,'NIL'],
  ['997212','SAC','Rental  residential to GST registrant (RCM)',18,0,'III'],
  ['997221','SAC','Rental / leasing of commercial property',18,0,'III'],
  ['997111','SAC','Interest income from loans / advances',0,0,'NIL'],
  ['997120','SAC','Life insurance  risk cover premium',5,0,'I'],
  ['997120','SAC','General insurance  motor, health, property',18,0,'III'],
  ['997130','SAC','Pension fund management services',0,0,'NIL'],
  ['997140','SAC','Stock / commodity brokers',18,0,'III'],
  ['997150','SAC','Portfolio management / investment advisory',18,0,'III'],
  ['997159','SAC','Foreign exchange dealing / money changing',18,0,'III'],
  ['998211','SAC','Legal advisory / consultation services',18,0,'III'],
  ['998213','SAC','Legal documentation  patents, copyrights',18,0,'III'],
  ['998221','SAC','Accounting / bookkeeping services',18,0,'III'],
  ['998222','SAC','Tax consulting and return filing services',18,0,'III'],
  ['998223','SAC','Statutory audit services',18,0,'III'],
  ['998231','SAC','Management consulting services',18,0,'III'],
  ['998232','SAC','Business process outsourcing (BPO)',18,0,'III'],
  ['998241','SAC','Architectural services',18,0,'III'],
  ['998242','SAC','Engineering design and advisory',18,0,'III'],
  ['998251','SAC','Advertising / market research services',18,0,'III'],
  ['998313','SAC','IT software design and development',18,0,'III'],
  ['998314','SAC','IT infrastructure / support services',18,0,'III'],
  ['999210','SAC','Pre-primary education',0,0,'NIL'],
  ['999220','SAC','Primary education services',0,0,'NIL'],
  ['999230','SAC','Secondary education services',0,0,'NIL'],
  ['999240','SAC','Higher education (university / college)',0,0,'NIL'],
  ['999241','SAC','Vocational training services',0,0,'NIL'],
  ['999290','SAC','Other education / coaching (private)',18,0,'III'],
  ['999300','SAC','Human health services  govt. hospitals',0,0,'NIL'],
  ['999311','SAC','In-patient health services  private hospitals',0,0,'NIL'],
  ['999312','SAC','Medical consultation  private practitioners',0,0,'NIL'],
  ['999315','SAC','Ambulance services',0,0,'NIL'],
  ['999321','SAC','Residential care  nursing homes (elderly)',0,0,'NIL'],
  ['999411','SAC','Sewerage / sanitation services',0,0,'NIL'],
  ['999510','SAC','Postal services  basic (India Post)',0,0,'NIL'],
  ['999511','SAC','Courier / express delivery services',18,0,'III'],
  ['996411','SAC','Rail transport  passengers (AC)',5,0,'I'],
  ['996411','SAC','Rail transport  passengers (non-AC)',0,0,'NIL'],
  ['996421','SAC','Road transport  metered taxi / auto',0,0,'NIL'],
  ['996421','SAC','Road transport  rent-a-cab / aggregator',5,0,'I'],
  ['996431','SAC','Water transport  coastal shipping (goods)',5,0,'I'],
  ['996441','SAC','Air transport  economy class',5,0,'I'],
  ['996441','SAC','Air transport  business class',12,0,'II'],
  ['996511','SAC','Goods transport by road  GTA (RCM)',5,0,'I'],
  ['996531','SAC','Goods transport by air',18,0,'III'],
  ['996311','SAC','Restaurant services (standalone, AC)',5,0,'I'],
  ['996311','SAC','Restaurant in hotel (tariff < ₹7500)',5,0,'I'],
  ['996311','SAC','Restaurant in hotel (tariff ≥ ₹7500)',18,0,'III'],
  ['996321','SAC','Hotel accommodation (room < ₹1000/night)',0,0,'NIL'],
  ['996321','SAC','Hotel accommodation (₹1001–7500/night)',12,0,'II'],
  ['996321','SAC','Hotel accommodation (> ₹7500/night)',18,0,'III'],
  ['999190','SAC','Telecom  voice / data / internet',18,0,'III'],
  ['999191','SAC','DTH / cable TV services',18,0,'III'],
  ['999192','SAC','Internet access services (ISP)',18,0,'III'],
  ['999193','SAC','IPTV / OTT streaming services',18,0,'III'],
  ['999614','SAC','Online information services (SaaS, cloud)',18,0,'III'],
  ['999631','SAC','Amusement parks & theme parks',18,0,'III'],
  ['999633','SAC','Event management services',18,0,'III'],
  ['999634','SAC','Cultural, sports, live events (ticket ≤ ₹250)',0,0,'NIL'],
  ['999634','SAC','Cultural, sports, live events (ticket > ₹250)',18,0,'III'],
  ['999641','SAC','Film distribution services',18,0,'III'],
  ['997911','SAC','R&D services (scientific  Govt.)',0,0,'NIL'],
  ['997911','SAC','R&D services (commercial / private)',18,0,'III'],
  ['998511','SAC','Employment services / placement agencies',18,0,'III'],
  ['998531','SAC','Investigation / security guard services',18,0,'III'],
  ['998561','SAC','Cleaning services  commercial premises',18,0,'III'],
  ['998591','SAC','Packaging services',18,0,'III'],
  ['999713','SAC','RWA monthly contribution (> ₹7500)',18,0,'III'],
  ['999713','SAC','RWA monthly contribution (≤ ₹7500)',0,0,'NIL'],
  ['999717','SAC','Charitable / religious trust services',0,0,'NIL'],
  ['997151','SAC','Fund management (SEBI-registered MF)',18,0,'III'],
];
const HSN_SAC_MASTER = HSN_SAC_RAW.map(([code,kind,desc,rate,cess,sch]) => ({code,kind,desc,rate,cess:cess||0,sch}));
// Resolve a typed HSN/SAC code → best matching master entry (exact code; first match)
const hsnLookup = (code) => {
  if(!code) return null;
  const c = String(code).trim();
  return HSN_SAC_MASTER.find(h => h.code === c)
      || HSN_SAC_MASTER.find(h => h.code.startsWith(c) && c.length >= 4)
      || null;
};

// TDS Sections seed  Income Tax Act 2025 (Sections 392 / 393), w.e.f. 01-Apr-2026.
// `section` = new ITA-2025 reference · `oldSection` = familiar ITA-1961 (194x).
const SEED_TDS_SECTIONS = [
  {id:uid(), section:'392', oldSection:'192', name:'Salary (TDS on Salary)', rate:0, threshold:0, annualThreshold:0, ledgerId:'1321', nature:'Salary', isSalary:true},
  {id:uid(), section:'393(1)·6(i)D(a)', oldSection:'194C', name:'Contractor / Sub-contractor (Individual/HUF)', rate:1, threshold:30000, annualThreshold:100000, ledgerId:'1314', nature:'Contractor Payments'},
  {id:uid(), section:'393(1)·6(i)D(b)', oldSection:'194C', name:'Contractor / Sub-contractor (Others)', rate:2, threshold:30000, annualThreshold:100000, ledgerId:'1315', nature:'Contractor Payments'},
  {id:uid(), section:'393(1)·6(iii)D(a)', oldSection:'194J(a)', name:'Fees for Technical Services / Call Centre', rate:2, threshold:50000, annualThreshold:0, ledgerId:'1316', nature:'Technical Services'},
  {id:uid(), section:'393(1)·6(iii)D(b)', oldSection:'194J(b)', name:'Fees for Professional Services', rate:10, threshold:50000, annualThreshold:0, ledgerId:'1316', nature:'Professional Fees'},
  {id:uid(), section:'393(1)·6(iii)D(b)', oldSection:'194J', name:'Director Remuneration / Sitting Fees', rate:10, threshold:0, annualThreshold:0, ledgerId:'1316', nature:'Director Remuneration'},
  {id:uid(), section:'393(1)·2(ii)D(a)', oldSection:'194I(a)', name:'Rent  Plant, Machinery or Equipment', rate:2, threshold:50000, annualThreshold:0, ledgerId:'1317', nature:'Rent'},
  {id:uid(), section:'393(1)·2(ii)D(b)', oldSection:'194I(b)', name:'Rent  Land / Building / Furniture', rate:10, threshold:50000, annualThreshold:0, ledgerId:'1317', nature:'Rent'},
  {id:uid(), section:'393(1)·1(ii)', oldSection:'194H', name:'Commission / Brokerage (non-insurance)', rate:2, threshold:20000, annualThreshold:0, ledgerId:'1318', nature:'Commission'},
  {id:uid(), section:'393(1)·1(i)', oldSection:'194D', name:'Insurance Commission (Others)', rate:10, threshold:20000, annualThreshold:0, ledgerId:'1318', nature:'Insurance Commission'},
  {id:uid(), section:'393(1)·5(ii)D(b)', oldSection:'194A', name:'Interest other than on Securities', rate:10, threshold:50000, annualThreshold:0, ledgerId:'1319', nature:'Interest'},
  {id:uid(), section:'393(1)·5(i)', oldSection:'193', name:'Interest on Securities', rate:10, threshold:10000, annualThreshold:0, ledgerId:'1319', nature:'Interest on Securities'},
  {id:uid(), section:'393(1)·8(ii)', oldSection:'194Q', name:'Purchase of Goods (turnover > 50L)', rate:0.1, threshold:5000000, annualThreshold:0, ledgerId:'1320B', nature:'Purchase of Goods'},
  {id:uid(), section:'393(1)·8(v)', oldSection:'194O', name:'E-commerce  Sale of Goods/Services', rate:0.1, threshold:500000, annualThreshold:0, ledgerId:'1325', nature:'E-commerce'},
  {id:uid(), section:'393(1)·8(iv)', oldSection:'194R', name:'Benefit / Perquisite from Business', rate:10, threshold:20000, annualThreshold:0, ledgerId:'1327', nature:'Business Perquisite'},
  {id:uid(), section:'393(3)·7', oldSection:'194T', name:'Partner  Salary / Remuneration / Interest (NEW)', rate:10, threshold:20000, annualThreshold:0, ledgerId:'1326', nature:'Partner Remuneration'},
  {id:uid(), section:'393(1)·7', oldSection:'194', name:'Dividend', rate:10, threshold:10000, annualThreshold:0, ledgerId:'1328', nature:'Dividend'},
  {id:uid(), section:'393(1)·4(i)', oldSection:'194K', name:'Income from Mutual Fund Units', rate:10, threshold:10000, annualThreshold:0, ledgerId:'1329', nature:'Mutual Fund Income'},
  {id:uid(), section:'393(1)·8(vi)', oldSection:'194S', name:'Transfer of Virtual Digital Asset (Crypto)', rate:1, threshold:10000, annualThreshold:0, ledgerId:'1329', nature:'VDA / Crypto'},
  {id:uid(), section:'393(1)·8(i)', oldSection:'194DA', name:'Life Insurance Policy Payout', rate:2, threshold:100000, annualThreshold:0, ledgerId:'1329', nature:'LI Payout'},
  {id:uid(), section:'393(3)·5D(b)', oldSection:'194N', name:'Cash Withdrawal (> ₹1 Cr)', rate:2, threshold:10000000, annualThreshold:0, ledgerId:'1329', nature:'Cash Withdrawal'},
  {id:uid(), section:'393(3)·1', oldSection:'194B', name:'Winnings  Lottery / Gambling / Betting', rate:30, threshold:10000, annualThreshold:0, ledgerId:'1329', nature:'Winnings'},
  {id:uid(), section:'393(3)·2', oldSection:'194BA', name:'Winnings  Online Games', rate:30, threshold:0, annualThreshold:0, ledgerId:'1329', nature:'Online Gaming'},
];

// Default full dataset  used when creating a new company (Firebase flow)
const buildDefaultData = (companyOverrides = {}) => ({
  company: { ...DEFAULT_COMPANY, ...companyOverrides },
  coa: SEED_COA,
  parties: SEED_PARTIES,
  vouchers: [],
  forexRates: FOREX_RATES,
  gstr2bData: [],
  employees: [],
  payrollRuns: [],
  tdsSections: SEED_TDS_SECTIONS.map(s => ({...s, id: uid()})),
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
});
