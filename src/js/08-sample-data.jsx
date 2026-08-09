
// ============================================================================
// SAMPLE DATA GENERATOR  a complete, fully-tallied FY 2025-26 dataset
// (covers SAL/PUR/PAY/REC/JV/CON/CRN/DBN, GST intra/inter/export, TDS 194C/J/I,
//  payroll with PF/PT/TDS, cost centres, departments, bill tagging)
// Invariant: sum(openings)=0 and every voucher Dr=Cr → Trial Balance & BS tally.
// ============================================================================
function buildSampleData(){
  const r2 = n => Math.round(n*100)/100;
  const gst = (t, rate, inter) => inter
    ? {cgst:0, sgst:0, igst:r2(t*rate/100)}
    : {cgst:r2(t*rate/200), sgst:r2(t*rate/200), igst:0};

  // ---- Chart of Accounts: SEED openings re-signed so the books tally ----
  const openOverrides = {'1100':-1000000,'1110':-200000,'1200':-500000,'1300':0,'2400':0};
  const coa = SEED_COA.map(a => a.id in openOverrides ? {...a, opening:openOverrides[a.id]} : a)
    .concat([
      {id:'4505', name:'Repairs & Maintenance', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, gstRate:18},
      {id:'4555', name:'Audit Fees', group:'Other Expenses', type:'Expense', schedule:'Other Expenses', opening:0, gstRate:18},
    ]);

  // ---- Parties (fixed ids for bill-tag references) ----
  const P = {
    reliance:'sp_rel', acme:'sp_acme', mahindra:'sp_mah', patel:'sp_patel', global:'sp_glob',
    steelco:'sp_steel', motorworld:'sp_motor', birla:'sp_birla', mahesh:'sp_mahesh',
    jio:'sp_jio', landlord:'sp_land', sharma:'sp_sharma', buildwell:'sp_build',
    retailGj:'sp_retgj', retailMh:'sp_retmh',   // unregistered (B2C) walk-in customers
    subco:'sp_subco',                            // group subsidiary (intercompany demo)
  };
  const parties = [
    {id:P.reliance, name:'Reliance Industries Ltd', type:'Customer', gstin:'27AAACR5055K1Z7', state:'Maharashtra', stateCode:'27', address:'Maker Chambers IV, Mumbai', email:'ap@ril.com', phone:'+91 22 3555 5000', currency:'INR', balance:0},
    {id:P.acme, name:'Acme Engineering Co.', type:'Customer', gstin:'24AABCA1234Z1ZA', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'info@acme.in', phone:'+91 79 2658 0000', currency:'INR', balance:0},
    {id:P.mahindra, name:'Mahindra & Mahindra Ltd', type:'Customer', gstin:'27AAACM3025E1ZZ', state:'Maharashtra', stateCode:'27', address:'Worli, Mumbai', email:'purchase@mahindra.com', phone:'+91 22 2490 0000', currency:'INR', balance:0},
    {id:P.patel, name:'Patel Hardware Traders', type:'Customer', gstin:'24AAEPP8765R1ZR', state:'Gujarat', stateCode:'24', address:'Rajkot', email:'patel@hardware.in', phone:'+91 281 245 6000', currency:'INR', balance:0},
    {id:P.global, name:'GlobalCorp Inc. (USA)', type:'Customer', gstin:'', state:'Outside India', stateCode:'97', address:'Delaware, USA', email:'ap@globalcorp.com', phone:'+1 302 555 0100', currency:'USD', balance:0, isForeign:true},
    {id:P.steelco, name:'Gujarat Steel Suppliers', type:'Vendor', gstin:'24AADCS5566F1ZC', state:'Gujarat', stateCode:'24', address:'Bhavnagar', email:'sales@gjsteel.in', phone:'+91 278 220 1000', currency:'INR', balance:0, msmeReg:'UDYAM-GJ-01-0012345'},
    {id:P.motorworld, name:'Motor World Pvt Ltd', type:'Vendor', gstin:'27AABCM7788H1ZY', state:'Maharashtra', stateCode:'27', address:'Pune', email:'sales@motorworld.in', phone:'+91 20 2567 8000', currency:'INR', balance:0},
    {id:P.birla, name:'Aditya Birla Supplies', type:'Vendor', gstin:'24AABCA9999B1ZJ', state:'Gujarat', stateCode:'24', address:'Surat', email:'sales@absupplies.in', phone:'+91 261 234 5000', currency:'INR', balance:0},
    {id:P.mahesh, name:'Mahesh Stationers', type:'Vendor', gstin:'24BBCDM4321A1Z5', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'mahesh@stat.in', phone:'+91 98765 12345', currency:'INR', balance:0, msmeReg:'UDYAM-GJ-01-0067890'},
    {id:P.jio, name:'Reliance Jio (Telecom)', type:'Vendor', gstin:'27AAACR5055K2Z6', state:'Maharashtra', stateCode:'27', address:'Mumbai', email:'support@jio.com', phone:'1800 889 9999', currency:'INR', balance:0},
    {id:P.landlord, name:'Factory Landlord  Mr. Patel', type:'Vendor', gstin:'', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'patel@landlord.in', phone:'+91 99999 11111', currency:'INR', balance:0, unregistered:true},
    {id:P.sharma, name:'Sharma & Associates (CA)', type:'Vendor', gstin:'24AAFFS1234K1ZC', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'ca@sharma.in', phone:'+91 79 4000 1111', currency:'INR', balance:0, pan:'AAFFS1234K'},
    {id:P.buildwell, name:'BuildWell Contractors Pvt Ltd', type:'Vendor', gstin:'24AABCB7777C1ZS', state:'Gujarat', stateCode:'24', address:'Gandhinagar', email:'works@buildwell.in', phone:'+91 79 5000 2222', currency:'INR', balance:0, pan:'AABCB7777C'},
    {id:P.retailGj, name:'Rahul Retail (Walk-in)', type:'Customer', gstin:'', state:'Gujarat', stateCode:'24', address:'Ahmedabad', email:'', phone:'+91 90000 12345', currency:'INR', balance:0, unregistered:true},
    {id:P.retailMh, name:'Deshmukh Stores (Unregistered)', type:'Customer', gstin:'', state:'Maharashtra', stateCode:'27', address:'Nagpur', email:'', phone:'+91 90000 67890', currency:'INR', balance:0, unregistered:true},
    // Group subsidiary - its GSTIN matches the subsidiary sample company's GSTIN,
    // so Group Consolidation auto-detects the intercompany relationship.
    {id:P.subco, name:'Demo Trading Co Pvt Ltd', type:'Customer', gstin:'24AABCD5678T1ZV', state:'Gujarat', stateCode:'24', address:'Vatva GIDC, Ahmedabad', email:'accounts@demotrading.in', phone:'+91 79 4900 5000', currency:'INR', balance:0},
  ];
  const partyOf = id => parties.find(p => p.id === id);

  // ---- Factory: Stock Items, BOMs ----
  const SI = {steel:'si_steel', motor:'si_motor', bolt:'si_bolt', paint:'si_paint', box:'si_box', pump:'si_pump', fan:'si_fan'};
  const stockItems = [
    {id:SI.steel, code:'RM-STEEL', name:'Steel Sheet', unit:'Kg', category:'Raw Material', hsn:'7208', gstRate:18, openingQty:500, openingValue:40000, reorderLevel:150, active:true},
    {id:SI.motor, code:'RM-MOTOR', name:'Electric Motor 1HP', unit:'Nos', category:'Raw Material', hsn:'8501', gstRate:18, openingQty:50, openingValue:50000, reorderLevel:20, active:true},
    {id:SI.bolt, code:'RM-BOLT', name:'Bolts & Fasteners', unit:'Nos', category:'Raw Material', hsn:'7318', gstRate:18, openingQty:2000, openingValue:10000, reorderLevel:500, active:true},
    {id:SI.paint, code:'RM-PAINT', name:'Industrial Paint', unit:'Lt', category:'Raw Material', hsn:'3208', gstRate:18, openingQty:100, openingValue:15000, reorderLevel:30, active:true},
    {id:SI.box, code:'PK-BOX', name:'Packing Box', unit:'Nos', category:'Packing Material', hsn:'4819', gstRate:12, openingQty:300, openingValue:6000, reorderLevel:100, active:true},
    {id:SI.pump, code:'FG-PUMP', name:'Water Pump 1HP', unit:'Nos', category:'Finished Goods', hsn:'8413', gstRate:18, openingQty:20, openingValue:60000, reorderLevel:10, active:true},
    {id:SI.fan, code:'FG-FAN', name:'Industrial Fan', unit:'Nos', category:'Finished Goods', hsn:'8414', gstRate:18, openingQty:15, openingValue:37500, reorderLevel:8, active:true},
  ];
  const siOf = id => stockItems.find(s=>s.id===id);
  const boms = [
    {id:'bom_pump', fgItemId:SI.pump, name:'Water Pump 1HP', description:'Standard pump assembly', yieldQty:1, components:[
      {itemId:SI.steel, qty:5,   uom:'Kg',  itemName:'Steel Sheet'},
      {itemId:SI.motor, qty:1,   uom:'Nos', itemName:'Electric Motor 1HP'},
      {itemId:SI.bolt,  qty:12,  uom:'Nos', itemName:'Bolts & Fasteners'},
      {itemId:SI.paint, qty:0.5, uom:'Lt',  itemName:'Industrial Paint'},
      {itemId:SI.box,   qty:1,   uom:'Nos', itemName:'Packing Box'},
    ]},
    {id:'bom_fan', fgItemId:SI.fan, name:'Industrial Fan', description:'Fan assembly', yieldQty:1, components:[
      {itemId:SI.steel, qty:3,   uom:'Kg',  itemName:'Steel Sheet'},
      {itemId:SI.motor, qty:1,   uom:'Nos', itemName:'Electric Motor 1HP'},
      {itemId:SI.bolt,  qty:8,   uom:'Nos', itemName:'Bolts & Fasteners'},
      {itemId:SI.paint, qty:0.3, uom:'Lt',  itemName:'Industrial Paint'},
      {itemId:SI.box,   qty:1,   uom:'Nos', itemName:'Packing Box'},
    ]},
  ];
  const scaleBOM = (bomId, qty) => {
    const b = boms.find(x=>x.id===bomId); const ratio = qty/(b.yieldQty||1);
    return b.components.map(c=>({itemId:c.itemId, itemName:c.itemName, qty:+(c.qty*ratio).toFixed(4), uom:c.uom}));
  };
  const productionOrders = [];

  // ---- Cost Centres & Departments ----
  const CC = {a:'sc_a', b:'sc_b'};
  const costCentres = [
    {id:CC.a, code:'PLANT-A', name:'Plant A  Manufacturing', description:'Main production unit', budget:1500000, budgetEnforce:'warn', active:true},
    {id:CC.b, code:'PLANT-B', name:'Plant B  Assembly', description:'Assembly & packaging', budget:900000, budgetEnforce:'warn', active:true},
  ];
  const D = {sales:'sd_sales', prod:'sd_prod', admin:'sd_admin'};
  const departments = [
    {id:D.sales, code:'SALES', name:'Sales & Marketing', active:true},
    {id:D.prod,  code:'PROD',  name:'Production', active:true},
    {id:D.admin, code:'ADMIN', name:'Administration', active:true},
  ];

  // ---- Employees ----
  const employees = [
    {id:'emp1', empCode:'EMP001', name:'Ramesh Sharma', designation:'Senior Manager', department:'Finance', doj:'2023-01-15', pan:'ABCDE1234F', uan:'100234567890', esicNo:'', bankAcc:'12345678901234', ifsc:'SBIN0001234', email:'ramesh@company.com', phone:'9876543210', status:'Active', basic:35000, hra:14000, da:0, sa:5000, allowances:[], pfApplicable:true, pfBase:35000, esicApplicable:false, ptAmount:200, tdsSalary:2000},
    {id:'emp2', empCode:'EMP002', name:'Priya Nair', designation:'Executive', department:'HR', doj:'2024-06-01', pan:'BCDFE5678G', uan:'100987654321', esicNo:'', bankAcc:'98765432109876', ifsc:'HDFC0002345', email:'priya@company.com', phone:'9988776655', status:'Active', basic:22000, hra:8800, da:0, sa:3200, allowances:[], pfApplicable:true, pfBase:22000, esicApplicable:false, ptAmount:200, tdsSalary:0},
    {id:'emp3', empCode:'EMP003', name:'Amit Patel', designation:'Production Lead', department:'Production', doj:'2023-09-10', pan:'CDEFG9012H', uan:'100456789012', esicNo:'', bankAcc:'45678901234567', ifsc:'ICIC0003456', email:'amit@company.com', phone:'9123456780', status:'Active', basic:28000, hra:11200, da:0, sa:4000, allowances:[], pfApplicable:true, pfBase:28000, esicApplicable:false, ptAmount:200, tdsSalary:500},
  ];

  // ---- Voucher builders (each guaranteed Dr = Cr) ----
  const vouchers = [], payrollRuns = [];
  const ctr = {};
  const vnum = t => { ctr[t]=(ctr[t]||0)+1; return t+'/'+String(ctr[t]).padStart(4,'0'); };
  const stamp = new Date().toISOString();

  const mkSale = (date, pid, salesAcc, taxable, rate, {inter=false, exp=false, cc='', dept=D.sales}={}) => {
    const g = exp ? {cgst:0,sgst:0,igst:0} : gst(taxable, rate, inter);
    const total = r2(taxable+g.cgst+g.sgst+g.igst);
    const p = partyOf(pid);
    const lines = [{id:uid(), accountId:'2400', debit:total, credit:0, narration:'To '+p.name, partyId:pid}];
    lines.push({id:uid(), accountId:salesAcc, debit:0, credit:taxable, narration:'Sales', costCentreId:cc, departmentId:dept});
    if(g.igst) lines.push({id:uid(), accountId:'1312', debit:0, credit:g.igst, narration:'IGST Output'});
    if(g.cgst) lines.push({id:uid(), accountId:'1310', debit:0, credit:g.cgst, narration:'CGST Output'});
    if(g.sgst) lines.push({id:uid(), accountId:'1311', debit:0, credit:g.sgst, narration:'SGST Output'});
    const v = {id:uid(), type:'SAL', date, number:vnum('SAL'), partyId:pid, partyName:p.name,
      narration:'Sales to '+p.name, reference:'', placeOfSupply:p.stateCode,
      items:[{id:uid(), description:exp?'Export Goods':'Goods/Services', hsn:'998311', qty:1, rate:taxable, gstRate:exp?0:rate, accountId:salesAcc}],
      taxable, cgst:g.cgst, sgst:g.sgst, igst:g.igst, total, amount:total, isInterState:inter, isExport:exp,
      costCentreId:cc, departmentId:dept, lines, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkPurchase = (date, pid, purAcc, taxable, rate, {inter=false, cc=CC.a, dept=D.prod}={}) => {
    const g = gst(taxable, rate, inter);
    const total = r2(taxable+g.cgst+g.sgst+g.igst);
    const p = partyOf(pid);
    const lines = [{id:uid(), accountId:purAcc, debit:taxable, credit:0, narration:'Purchase', costCentreId:cc, departmentId:dept}];
    if(g.igst) lines.push({id:uid(), accountId:'2602', debit:g.igst, credit:0, narration:'IGST Input'});
    if(g.cgst) lines.push({id:uid(), accountId:'2600', debit:g.cgst, credit:0, narration:'CGST Input'});
    if(g.sgst) lines.push({id:uid(), accountId:'2601', debit:g.sgst, credit:0, narration:'SGST Input'});
    lines.push({id:uid(), accountId:'1300', debit:0, credit:total, narration:'To '+p.name, partyId:pid});
    const v = {id:uid(), type:'PUR', date, number:vnum('PUR'), partyId:pid, partyName:p.name,
      narration:'Purchase from '+p.name, reference:'', placeOfSupply:p.stateCode,
      items:[{id:uid(), description:'Materials', hsn:'998311', qty:1, rate:taxable, gstRate:rate, accountId:purAcc}],
      taxable, cgst:g.cgst, sgst:g.sgst, igst:g.igst, total, amount:total, isInterState:inter,
      costCentreId:cc, departmentId:dept, lines, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkReceipt = (date, pid, amount, tagId, bank='2510') => {
    const p = partyOf(pid);
    const v = {id:uid(), type:'REC', date, number:vnum('REC'), partyId:pid, partyName:p.name,
      narration:'Receipt from '+p.name, reference:'', amount, status:'Posted',
      billTags: tagId?[{voucherId:tagId, allocated:amount}]:[], isAdvance:!tagId,
      lines:[{id:uid(), accountId:bank, debit:amount, credit:0, narration:'Received from '+p.name},
             {id:uid(), accountId:'2400', debit:0, credit:amount, narration:'From '+p.name, partyId:pid}],
      createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkPayVendor = (date, pid, amount, tagId, bank='2510') => {
    const p = partyOf(pid);
    const v = {id:uid(), type:'PAY', date, number:vnum('PAY'), partyId:pid, partyName:p.name,
      narration:'Payment to '+p.name, reference:'', amount, status:'Posted',
      billTags: tagId?[{voucherId:tagId, allocated:amount}]:[], isAdvance:!tagId,
      lines:[{id:uid(), accountId:'1300', debit:amount, credit:0, narration:'Paid to '+p.name, partyId:pid},
             {id:uid(), accountId:bank, debit:0, credit:amount, narration:'To '+p.name}],
      createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkExpTDS = (date, pid, expAcc, taxable, {gstRate=18, inter=false, tdsRate, tdsSection, tdsLedger, tdsNature, noGst=false, cc='', dept=D.admin, bank='2510'}) => {
    const g = noGst ? {cgst:0,sgst:0,igst:0} : gst(taxable, gstRate, inter);
    const tds = r2(taxable*tdsRate/100);
    const gstTot = g.cgst+g.sgst+g.igst;
    const net = r2(taxable+gstTot-tds);
    const p = partyOf(pid);
    const lines = [{id:uid(), accountId:expAcc, debit:taxable, credit:0, narration:tdsNature, costCentreId:cc, departmentId:dept}];
    if(g.igst) lines.push({id:uid(), accountId:'2602', debit:g.igst, credit:0, narration:'IGST Input'});
    if(g.cgst) lines.push({id:uid(), accountId:'2600', debit:g.cgst, credit:0, narration:'CGST Input'});
    if(g.sgst) lines.push({id:uid(), accountId:'2601', debit:g.sgst, credit:0, narration:'SGST Input'});
    lines.push({id:uid(), accountId:tdsLedger, debit:0, credit:tds, narration:'TDS '+tdsSection});
    lines.push({id:uid(), accountId:bank, debit:0, credit:net, narration:'Net paid to '+p.name});
    const v = {id:uid(), type:'PAY', date, number:vnum('PAY'), partyId:pid, partyName:p.name,
      narration:tdsNature+'  '+p.name, reference:'', amount:r2(taxable+gstTot), status:'Posted',
      tdsApplicable:true, tdsAmount:tds, tdsBaseAmount:taxable, tdsRate, tdsSection, tdsLedgerId:tdsLedger, tdsNature,
      costCentreId:cc, departmentId:dept, lines, createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkPay = (date, expAcc, amount, narr, {cc='', dept=D.admin, bank='2510', pid=''}={}) => {
    const v = {id:uid(), type:'PAY', date, number:vnum('PAY'), partyId:pid, partyName:pid?partyOf(pid)?.name||'':'',
      narration:narr, reference:'', amount, status:'Posted', costCentreId:cc, departmentId:dept,
      lines:[{id:uid(), accountId:expAcc, debit:amount, credit:0, narration:narr, costCentreId:cc, departmentId:dept},
             {id:uid(), accountId:bank, debit:0, credit:amount, narration:narr}],
      createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkJV = (date, lines, narr) => {
    const v = {id:uid(), type:'JV', date, number:vnum('JV'), partyName:'', narration:narr, reference:'',
      lines:lines.map(l=>({id:uid(), debit:0, credit:0, ...l})),
      amount:lines.reduce((s,l)=>s+(l.debit||0),0), status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkContra = (date, fromAcc, toAcc, amount, narr) => {
    const v = {id:uid(), type:'CON', date, number:vnum('CON'), partyName:'', narration:narr, reference:'',
      lines:[{id:uid(), accountId:toAcc, debit:amount, credit:0, narration:narr},
             {id:uid(), accountId:fromAcc, debit:0, credit:amount, narration:narr}],
      amount, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkCRN = (date, pid, salesAcc, taxable, rate, {inter=false, cc='', dept=D.sales}={}) => {
    const g = gst(taxable, rate, inter); const total = r2(taxable+g.cgst+g.sgst+g.igst); const p = partyOf(pid);
    const lines = [{id:uid(), accountId:salesAcc, debit:taxable, credit:0, narration:'Sales return', costCentreId:cc, departmentId:dept}];
    if(g.igst) lines.push({id:uid(), accountId:'1312', debit:g.igst, credit:0, narration:'IGST reversal'});
    if(g.cgst) lines.push({id:uid(), accountId:'1310', debit:g.cgst, credit:0, narration:'CGST reversal'});
    if(g.sgst) lines.push({id:uid(), accountId:'1311', debit:g.sgst, credit:0, narration:'SGST reversal'});
    lines.push({id:uid(), accountId:'2400', debit:0, credit:total, narration:'To '+p.name, partyId:pid});
    const v = {id:uid(), type:'CRN', date, number:vnum('CRN'), partyId:pid, partyName:p.name,
      narration:'Credit note to '+p.name, reference:'', placeOfSupply:p.stateCode,
      items:[{id:uid(), description:'Sales Return', hsn:'998311', qty:1, rate:taxable, gstRate:rate, accountId:salesAcc}],
      taxable, cgst:g.cgst, sgst:g.sgst, igst:g.igst, total, amount:total, isInterState:inter,
      lines, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkDBN = (date, pid, purAcc, taxable, rate, {inter=false, cc=CC.a, dept=D.prod}={}) => {
    const g = gst(taxable, rate, inter); const total = r2(taxable+g.cgst+g.sgst+g.igst); const p = partyOf(pid);
    const lines = [{id:uid(), accountId:'1300', debit:total, credit:0, narration:'To '+p.name, partyId:pid},
                   {id:uid(), accountId:purAcc, debit:0, credit:taxable, narration:'Purchase return', costCentreId:cc, departmentId:dept}];
    if(g.igst) lines.push({id:uid(), accountId:'2602', debit:0, credit:g.igst, narration:'IGST reversal'});
    if(g.cgst) lines.push({id:uid(), accountId:'2600', debit:0, credit:g.cgst, narration:'CGST reversal'});
    if(g.sgst) lines.push({id:uid(), accountId:'2601', debit:0, credit:g.sgst, narration:'SGST reversal'});
    const v = {id:uid(), type:'DBN', date, number:vnum('DBN'), partyId:pid, partyName:p.name,
      narration:'Debit note to '+p.name, reference:'', placeOfSupply:p.stateCode,
      items:[{id:uid(), description:'Purchase Return', hsn:'998311', qty:1, rate:taxable, gstRate:rate, accountId:purAcc}],
      taxable, cgst:g.cgst, sgst:g.sgst, igst:g.igst, total, amount:total, isInterState:inter,
      lines, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const runPayroll = (month) => {
    const rows = employees.map(e => {
      const gross = e.basic+e.hra+e.da+e.sa;
      const pfEe = e.pfApplicable ? Math.round(Math.min(e.pfBase||e.basic,15000)*0.12) : 0;
      const pfEr = pfEe, esicEe=0, esicEr=0, pt=e.ptAmount||200, tds=e.tdsSalary||0;
      const totalDed = pfEe+esicEe+pt+tds, net = gross-totalDed;
      return {empId:e.id, empCode:e.empCode, name:e.name, designation:e.designation, department:e.department,
        pan:e.pan, uan:e.uan, bankAcc:e.bankAcc, basic:e.basic, hra:e.hra, da:e.da, sa:e.sa, allowances:[],
        gross, pfEe, pfEr, esicEe, esicEr, pt, tds, totalDed, net};
    });
    const T = k => rows.reduce((s,l)=>s+l[k],0);
    const tGross=T('gross'), tPfEe=T('pfEe'), tPfEr=T('pfEr'), tPT=T('pt'), tTDS=T('tds'), tNet=T('net');
    const jl = [{id:uid(), accountId:'4200', debit:tGross, credit:0, narration:'Salary '+month, departmentId:D.admin}];
    if(tPfEr>0) jl.push({id:uid(), accountId:'4210', debit:tPfEr, credit:0, narration:'Employer PF'});
    if(tPfEe+tPfEr>0) jl.push({id:uid(), accountId:'1322', debit:0, credit:tPfEe+tPfEr, narration:'PF EE+ER'});
    if(tPT>0) jl.push({id:uid(), accountId:'1324', debit:0, credit:tPT, narration:'Professional Tax'});
    if(tTDS>0) jl.push({id:uid(), accountId:'1321', debit:0, credit:tTDS, narration:'TDS u/s 192'});
    jl.push({id:uid(), accountId:'1320', debit:0, credit:tNet, narration:'Net salary payable'});
    const jv = {id:uid(), type:'JV', date:month+'-28', number:vnum('JV'), partyName:'Payroll  '+month,
      narration:'Being salary for '+month+' (3 employees)', reference:'Payroll', lines:jl,
      amount:tGross+tPfEr, status:'Posted', createdAt:stamp};
    vouchers.push(jv);
    payrollRuns.push({id:uid(), month, processedAt:stamp, voucherId:jv.id, employees:rows,
      totalGross:tGross, totalNet:tNet, totalPfEe:tPfEe, totalPfEr:tPfEr, totalEsicEe:0, totalEsicEr:0, totalPT:tPT, totalTDS:tTDS});
    // Pay the net salary
    vouchers.push({id:uid(), type:'PAY', date:month+'-30', number:vnum('PAY'), partyName:'', reference:'',
      narration:'Net salary paid for '+month, amount:tNet, status:'Posted', createdAt:stamp,
      lines:[{id:uid(), accountId:'1320', debit:tNet, credit:0, narration:'Salary paid'},
             {id:uid(), accountId:'2510', debit:0, credit:tNet, narration:'Salary paid'}]});
  };

  // TDS preset shorthands
  const TDS_J = {tdsRate:10, tdsSection:'194J  Professional', tdsLedger:'1316', tdsNature:'Professional/Technical Fees'};
  const TDS_I = {tdsRate:10, tdsSection:'194I  Rent', tdsLedger:'1317', tdsNature:'Rent', noGst:true};
  const TDS_C = {tdsRate:2,  tdsSection:'194C  Contractor', tdsLedger:'1315', tdsNature:'Contractor Payments'};

  // ---- Stock-linked sale/purchase builders (carry itemId for inventory) ----
  const mkSaleFG = (date, pid, si, qty, unitRate, gstRate, {inter=false, exp=false, cc='', dept=D.sales}={}) => {
    const taxable=r2(qty*unitRate);
    const g = exp?{cgst:0,sgst:0,igst:0}:gst(taxable, gstRate, inter);
    const total=r2(taxable+g.cgst+g.sgst+g.igst); const p=partyOf(pid);
    const lines=[{id:uid(), accountId:'2400', debit:total, credit:0, narration:'To '+p.name, partyId:pid}];
    lines.push({id:uid(), accountId:'3100', debit:0, credit:taxable, narration:'Sale of '+si.name, costCentreId:cc, departmentId:dept});
    if(g.igst) lines.push({id:uid(), accountId:'1312', debit:0, credit:g.igst, narration:'IGST Output'});
    if(g.cgst) lines.push({id:uid(), accountId:'1310', debit:0, credit:g.cgst, narration:'CGST Output'});
    if(g.sgst) lines.push({id:uid(), accountId:'1311', debit:0, credit:g.sgst, narration:'SGST Output'});
    const v={id:uid(), type:'SAL', date, number:vnum('SAL'), partyId:pid, partyName:p.name,
      narration:'Sale of '+si.name+' to '+p.name, reference:'', placeOfSupply:p.stateCode,
      items:[{id:uid(), itemId:si.id, description:si.name, hsn:si.hsn, qty, rate:unitRate, gstRate:exp?0:gstRate, accountId:'3100'}],
      taxable, cgst:g.cgst, sgst:g.sgst, igst:g.igst, total, amount:total, isInterState:inter, isExport:exp,
      costCentreId:cc, departmentId:dept, lines, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };
  const mkPurchaseRM = (date, pid, si, qty, unitRate, gstRate, {inter=false, cc=CC.a, dept=D.prod}={}) => {
    const taxable=r2(qty*unitRate);
    const g=gst(taxable, gstRate, inter); const total=r2(taxable+g.cgst+g.sgst+g.igst); const p=partyOf(pid);
    const lines=[{id:uid(), accountId:'4100', debit:taxable, credit:0, narration:'Purchase of '+si.name, costCentreId:cc, departmentId:dept}];
    if(g.igst) lines.push({id:uid(), accountId:'2602', debit:g.igst, credit:0, narration:'IGST Input'});
    if(g.cgst) lines.push({id:uid(), accountId:'2600', debit:g.cgst, credit:0, narration:'CGST Input'});
    if(g.sgst) lines.push({id:uid(), accountId:'2601', debit:g.sgst, credit:0, narration:'SGST Input'});
    lines.push({id:uid(), accountId:'1300', debit:0, credit:total, narration:'To '+p.name, partyId:pid});
    const v={id:uid(), type:'PUR', date, number:vnum('PUR'), partyId:pid, partyName:p.name,
      narration:'Purchase of '+si.name+' from '+p.name, reference:'', placeOfSupply:p.stateCode,
      items:[{id:uid(), itemId:si.id, description:si.name, hsn:si.hsn, qty, rate:unitRate, gstRate, accountId:'4100'}],
      taxable, cgst:g.cgst, sgst:g.sgst, igst:g.igst, total, amount:total, isInterState:inter,
      costCentreId:cc, departmentId:dept, lines, status:'Posted', createdAt:stamp};
    vouchers.push(v); return v;
  };

  // ================= TRANSACTIONS (FY 2025-26) =================
  const MONTHS = [['2025-04',30],['2025-05',31],['2025-06',30],['2025-07',31],['2025-08',31],['2025-09',30],['2025-10',31],['2025-11',30],['2025-12',31],['2026-01',31],['2026-02',28],['2026-03',31]];
  const openSales=[], openPurch=[];
  let poNum=0;
  MONTHS.forEach(([mo,ld],i)=>{
    const d = day => `${mo}-${String(day).padStart(2,'0')}`;
    openPurch.push(mkPurchaseRM(d(3), P.steelco, siOf(SI.steel), 200+i*5, 80, 18, {cc:CC.a}));
    openPurch.push(mkPurchaseRM(d(5), P.motorworld, siOf(SI.motor), 20+(i%3)*5, 1000, 18, {inter:true, cc:CC.a}));
    if(i%2===0) openPurch.push(mkPurchaseRM(d(6), P.steelco, siOf(SI.paint), 30, 150, 18, {cc:CC.b}));
    if(i%2===1) mkPurchase(d(7), P.mahesh, '4540', 8000+i*400, 18, {cc:CC.b, dept:D.admin});
    poNum++; productionOrders.push({id:uid(), poNo:'PO-'+String(poNum).padStart(4,'0'), date:d(8), fgItemId:SI.pump, bomId:'bom_pump', fgQty:20, consumptions:scaleBOM('bom_pump',20), notes:'Monthly pump batch', status:'Posted', fgCost:1555, fgName:'Water Pump 1HP'});
    poNum++; productionOrders.push({id:uid(), poNo:'PO-'+String(poNum).padStart(4,'0'), date:d(9), fgItemId:SI.fan, bomId:'bom_fan', fgQty:15, consumptions:scaleBOM('bom_fan',15), notes:'Monthly fan batch', status:'Posted', fgCost:1345, fgName:'Industrial Fan'});
    openSales.push(mkSaleFG(d(10), P.acme, siOf(SI.pump), 12+(i%4), 3500, 18, {cc:CC.a}));
    openSales.push(mkSaleFG(d(13), P.mahindra, siOf(SI.fan), 10+(i%3), 2800, 18, {inter:true, cc:CC.b}));
    if(i%3===0) openSales.push(mkSaleFG(d(15), P.patel, siOf(SI.pump), 8, 3450, 18, {cc:CC.a}));
    if(i%4===2) mkSaleFG(d(16), P.global, siOf(SI.pump), 30, 3600, 0, {exp:true});
    if(openSales.length>3){ const s=openSales.shift(); mkReceipt(d(20), s.partyId, s.total, s.id); }
    if(openSales.length>3){ const s=openSales.shift(); mkReceipt(d(21), s.partyId, s.total, s.id); }
    if(openPurch.length>3){ const pu=openPurch.shift(); mkPayVendor(d(23), pu.partyId, pu.total, pu.id); }
    if(openPurch.length>3){ const pu=openPurch.shift(); mkPayVendor(d(24), pu.partyId, pu.total, pu.id); }
    const tt=i%4;
    if(tt===0) mkExpTDS(d(12), P.landlord, '4500', 50000, {...TDS_I, dept:D.admin});
    else if(tt===1) mkExpTDS(d(12), P.sharma, '4550', 40000, {...TDS_J, dept:D.admin});
    else if(tt===2) mkExpTDS(d(12), P.buildwell, '4505', 80000, {...TDS_C, cc:CC.a, dept:D.prod});
    else mkExpTDS(d(12), P.sharma, '4555', 30000, {...TDS_J, dept:D.admin});
    mkPay(d(18), '4510', 12000+i*300, 'Factory electricity', {dept:D.prod, cc:CC.a});
    if(i%3===0) mkPay(d(19), '4520', 9440, 'Telephone & Internet', {dept:D.admin});
    if(i%6===4) mkPay(d(17), '4310', 2500, 'Bank charges', {dept:D.admin});
    mkJV(d(28), [{accountId:'4400', debit:8000}, {accountId:'2130', credit:8000}], 'Depreciation for '+mo);
    if(i===5) mkCRN(d(25), P.acme, '3100', 21000, 18, {cc:CC.a});
    if(i===8) mkDBN(d(25), P.steelco, '4100', 16000, 18, {cc:CC.a});
    if(i%3===1) mkContra(d(26), '2500', '2510', 25000, 'Cash deposited to bank');
    if(i===11) mkJV(d(27), [{accountId:'4555', debit:30000},{accountId:'1330', credit:30000}], 'Year-end provision for audit fees');
    runPayroll(mo);
  });

  // ================= EXTRA GST INVOICES (rich GSTR-1 / GSTR-3B demo) =================
  // Covers B2B intra & inter, B2CL, B2CS, exports, services and multiple GST rates
  // (5 / 12 / 18 / 28%), plus registered & unregistered credit/debit notes.
  // ---- SALES ----
  mkSale('2025-05-14', P.acme,     '3100', 240000, 18, {cc:CC.a});            // B2B intra 18%
  mkSale('2025-06-09', P.patel,    '3100',  90000, 12, {cc:CC.a});            // B2B intra 12%
  mkSale('2025-06-22', P.mahindra, '3100', 320000, 18, {inter:true, cc:CC.b});// B2B inter 18%
  mkSale('2025-07-18', P.reliance, '3100', 180000, 28, {inter:true, cc:CC.b});// B2B inter 28%
  mkSale('2025-08-05', P.acme,     '3100', 150000,  5, {cc:CC.a});            // B2B intra 5%
  mkSale('2025-08-20', P.patel,    '3110',  75000, 18, {cc:CC.a, dept:D.sales}); // Services 18% intra
  const gexp1 = mkSale('2025-09-12', P.global, '3120', 540000, 0, {exp:true});   // Export (zero-rated)
  mkSale('2025-10-08', P.retailMh, '3100', 150000, 18, {inter:true});         // B2CL - inter-state B2C > ₹1L
  mkSale('2025-10-08', P.retailMh, '3100', 128000, 12, {inter:true});         // B2CL - 12%
  mkSale('2025-11-03', P.retailGj, '3100',  18000, 18, {});                    // B2CS intra 18%
  mkSale('2025-11-03', P.retailGj, '3100',   9500, 12, {});                    // B2CS intra 12%
  mkSale('2025-12-15', P.retailGj, '3100',   6000,  5, {});                    // B2CS intra 5%
  const bigSale = mkSale('2026-01-10', P.mahindra, '3100', 410000, 18, {inter:true, cc:CC.b}); // B2B inter 18%
  mkReceipt('2026-01-28', P.mahindra, bigSale.total, bigSale.id);              // ...settled
  mkCRN('2026-02-06', P.acme, '3100', 24000, 18, {cc:CC.a});                   // Registered credit note (sales return)
  // ---- PURCHASES ----
  mkPurchase('2025-05-11', P.steelco,    '4100', 160000, 18, {cc:CC.a});       // B2B intra 18%
  mkPurchase('2025-06-16', P.motorworld, '4100', 220000, 18, {inter:true});    // B2B inter 18%
  mkPurchase('2025-07-24', P.birla,      '4100',  95000, 28, {cc:CC.a});       // B2B intra 28%
  mkPurchase('2025-09-05', P.motorworld, '4100', 140000, 12, {inter:true});    // B2B inter 12%
  mkPurchase('2025-10-19', P.mahesh,     '4110',  48000,  5, {cc:CC.b, dept:D.admin}); // Trading goods 5%
  const bigPur = mkPurchase('2026-01-14', P.steelco, '4100', 120000, 18, {cc:CC.a});
  mkPayVendor('2026-02-02', P.steelco, bigPur.total, bigPur.id);               // ...paid
  mkDBN('2026-02-11', P.steelco, '4100', 16000, 18, {cc:CC.a});                // Debit note (purchase return)

  // ================= INTERCOMPANY (with Demo Trading Co - the subsidiary) =================
  // Mirrored in buildSampleSubsidiaryData(): load that sample in a company created as
  // "Subsidiary of Demo Manufacturing Co", then open Group Consolidation → Eliminations.
  const icSale = mkSale('2026-01-20', P.subco, '3100', 200000, 18, {cc:CC.a}); // H sells goods ₹2,00,000+18% to sub → total 2,36,000
  mkReceipt('2026-02-10', P.subco, 118000, icSale.id);                          // part collection → AR ₹1,18,000 stays open
  mkPurchase('2026-02-05', P.subco, '4110', 50000, 18, {cc:CC.b, dept:D.admin});// H buys services/goods ₹50,000+18% from sub → AP ₹59,000 open

  return {
    // NOTE: upiId left blank intentionally - a fake demo VPA makes UPI apps show
    // "payee not registered" when scanned. Users must enter their own active ID.
    company: {...DEFAULT_COMPANY, name:'Demo Manufacturing Co Pvt Ltd', upiId:'',
      groupName:'Demo Group', isHolding:true,
      modules:{gst:true, tds:true, payroll:true, factory:true, trader:true, service:false}},
    coa, parties, vouchers,
    forexRates: FOREX_RATES, gstr2bData: [],
    employees, payrollRuns,
    tdsSections: SEED_TDS_SECTIONS.map(s => ({...s, id: uid()})),
    stockItems, boms, productionOrders,
    quotations: [
      {id:uid(), docType:'Quotation', number:'QTN/0001', date:'2026-02-10', validTill:'2026-03-10',
       partyId:P.acme, partyName:'Acme Engineering Co.', reference:'ACME-RFQ-88', status:'Sent',
       notes:'Prices valid 30 days. Delivery within 2 weeks of PO. Payment: 50% advance, 50% on delivery.',
       items:[{id:uid(), itemId:SI.pump, description:'Water Pump 1HP', hsn:'8413', qty:25, rate:3450, gstRate:18},
              {id:uid(), itemId:SI.fan, description:'Industrial Fan', hsn:'8414', qty:10, rate:2750, gstRate:18}]},
      {id:uid(), docType:'Proforma Invoice', number:'PRF/0001', date:'2026-02-18', validTill:'2026-03-18',
       partyId:P.patel, partyName:'Patel Hardware Traders', reference:'', status:'Accepted',
       notes:'Proforma for advance payment. Goods dispatch after credit of advance.',
       items:[{id:uid(), itemId:SI.pump, description:'Water Pump 1HP', hsn:'8413', qty:15, rate:3500, gstRate:18}]},
      {id:uid(), docType:'Delivery Challan', number:'DCH/0001', date:'2026-03-05',
       partyId:P.mahindra, partyName:'Mahindra & Mahindra Ltd', reference:'Job-work approval', status:'Sent',
       notes:'Goods sent on approval basis - returnable within 30 days.',
       items:[{id:uid(), itemId:SI.fan, description:'Industrial Fan', hsn:'8414', qty:5, rate:2800, gstRate:18}]},
    ],
    costCentres, departments, bankRecon: [], allocations: [], bankRules: [],
    fixedAssets: [], budgets: {}, amortizations: [],
    auditLog: [auditEntry('SAMPLE_DATA', `Loaded factory sample dataset · ${vouchers.length} vouchers · FY 2025-26`)],
  };
};

// ============================================================================
// SUBSIDIARY SAMPLE DATA  "Demo Trading Co Pvt Ltd"
// The mirror side of the holding sample's intercompany entries. Setup flow:
// 1) Load the main sample in the holding company. 2) ⇌ Switch → + Add New
// Company → "Subsidiary of Demo Manufacturing Co". 3) In the new company:
// Export/Import → Load Subsidiary Sample. 4) Open Group Consolidation →
// Eliminations: sales↔purchases (₹2,00,000 & ₹50,000) and AR↔AP (₹1,18,000 &
// ₹59,000) auto-match via GSTIN and eliminate cleanly.
// ============================================================================
function buildSampleSubsidiaryData(){
  const r2 = n => Math.round(n*100)/100;
  const stamp = new Date().toISOString();
  const ctr = {}; const vnum = t => { ctr[t]=(ctr[t]||0)+1; return t+'/'+String(ctr[t]).padStart(4,'0'); };
  // Clean COA: zero every seed opening, then Capital −3L / Bank +3L (sums to 0 → tallies)
  const coa = SEED_COA.map(a => ({...a, opening: a.id==='1100' ? -300000 : a.id==='2510' ? 300000 : 0}));
  const P_HOLD = 'sp_hold', P_CUST = 'sp_cust';
  const parties = [
    // The holding company - GSTIN matches Demo Manufacturing's, enabling auto-detection
    {id:P_HOLD, name:'Demo Manufacturing Co Pvt Ltd', type:'Vendor', gstin:'24ABCDE1234F1Z6', state:'Gujarat', stateCode:'24', address:'45 Industrial Estate, Ahmedabad', email:'accounts@mymsme.in', phone:'+91 79 2658 9999', currency:'INR', balance:0},
    {id:P_CUST, name:'Shree Distributors', type:'Customer', gstin:'24AAEPP8765R1ZR', state:'Gujarat', stateCode:'24', address:'Naroda, Ahmedabad', email:'shree@dist.in', phone:'+91 98790 11111', currency:'INR', balance:0, creditDays:30},
  ];
  const vouchers = [];
  // ── Intercompany purchase from the holding: ₹2,00,000 + 18% GST (mirrors the holding's sale)
  const icPur = {id:uid(), type:'PUR', date:'2026-01-20', number:vnum('PUR'), partyId:P_HOLD, partyName:'Demo Manufacturing Co Pvt Ltd',
    narration:'Purchase of pumps & fans from group holding', reference:'IC-2026-01', placeOfSupply:'24',
    items:[{id:uid(), description:'Water Pumps & Fans (group transfer)', hsn:'8413', qty:60, rate:3333.33, gstRate:18, accountId:'4110'}],
    taxable:200000, cgst:18000, sgst:18000, igst:0, total:236000, amount:236000, isInterState:false,
    lines:[{id:uid(), accountId:'4110', debit:200000, credit:0, narration:'Trading goods from holding'},
           {id:uid(), accountId:'2600', debit:18000, credit:0, narration:'CGST Input'},
           {id:uid(), accountId:'2601', debit:18000, credit:0, narration:'SGST Input'},
           {id:uid(), accountId:'1300', debit:0, credit:236000, narration:'To Demo Manufacturing Co', partyId:P_HOLD}],
    status:'Posted', createdAt:stamp};
  vouchers.push(icPur);
  // Part payment ₹1,18,000 → AP to holding stays at ₹1,18,000 (mirrors holding's open AR)
  vouchers.push({id:uid(), type:'PAY', date:'2026-02-10', number:vnum('PAY'), partyId:P_HOLD, partyName:'Demo Manufacturing Co Pvt Ltd',
    narration:'Part payment to holding against IC-2026-01', amount:118000, billTags:[{voucherId:icPur.id, allocated:118000}],
    lines:[{id:uid(), accountId:'1300', debit:118000, credit:0, narration:'Paid to holding', partyId:P_HOLD},
           {id:uid(), accountId:'2510', debit:0, credit:118000, narration:'Bank payment'}],
    status:'Posted', createdAt:stamp});
  // ── Intercompany sale of services to the holding: ₹50,000 + 18% (mirrors holding's purchase) - unpaid
  vouchers.push({id:uid(), type:'SAL', date:'2026-02-05', number:vnum('SAL'), partyId:P_HOLD, partyName:'Demo Manufacturing Co Pvt Ltd',
    narration:'Logistics & distribution services to holding', reference:'IC-SVC-01', placeOfSupply:'24',
    items:[{id:uid(), description:'Distribution & logistics services', hsn:'9967', qty:1, rate:50000, gstRate:18, accountId:'3110'}],
    taxable:50000, cgst:4500, sgst:4500, igst:0, total:59000, amount:59000, isInterState:false,
    lines:[{id:uid(), accountId:'2400', debit:59000, credit:0, narration:'To Demo Manufacturing Co', partyId:P_HOLD},
           {id:uid(), accountId:'3110', debit:0, credit:50000, narration:'Service income'},
           {id:uid(), accountId:'1310', debit:0, credit:4500, narration:'CGST Output'},
           {id:uid(), accountId:'1311', debit:0, credit:4500, narration:'SGST Output'}],
    status:'Posted', createdAt:stamp});
  // ── External trade so the subsidiary has its own P&L
  const extSale = {id:uid(), type:'SAL', date:'2026-02-15', number:vnum('SAL'), partyId:P_CUST, partyName:'Shree Distributors',
    narration:'Sale of pumps to Shree Distributors', reference:'', placeOfSupply:'24',
    items:[{id:uid(), description:'Water Pump 1HP', hsn:'8413', qty:60, rate:4166.67, gstRate:18, accountId:'3100'}],
    taxable:250000, cgst:22500, sgst:22500, igst:0, total:295000, amount:295000, isInterState:false,
    lines:[{id:uid(), accountId:'2400', debit:295000, credit:0, narration:'To Shree Distributors', partyId:P_CUST},
           {id:uid(), accountId:'3100', debit:0, credit:250000, narration:'Sales'},
           {id:uid(), accountId:'1310', debit:0, credit:22500, narration:'CGST Output'},
           {id:uid(), accountId:'1311', debit:0, credit:22500, narration:'SGST Output'}],
    status:'Posted', createdAt:stamp};
  vouchers.push(extSale);
  vouchers.push({id:uid(), type:'REC', date:'2026-03-01', number:vnum('REC'), partyId:P_CUST, partyName:'Shree Distributors',
    narration:'Receipt from Shree Distributors', amount:295000, billTags:[{voucherId:extSale.id, allocated:295000}],
    lines:[{id:uid(), accountId:'2510', debit:295000, credit:0, narration:'Bank receipt'},
           {id:uid(), accountId:'2400', debit:0, credit:295000, narration:'From Shree Distributors', partyId:P_CUST}],
    status:'Posted', createdAt:stamp});
  vouchers.push({id:uid(), type:'PAY', date:'2026-02-28', number:vnum('PAY'), partyName:'',
    narration:'Godown rent February', amount:20000,
    lines:[{id:uid(), accountId:'4500', debit:20000, credit:0, narration:'Godown rent'},
           {id:uid(), accountId:'2510', debit:0, credit:20000, narration:'Bank payment'}],
    status:'Posted', createdAt:stamp});

  return {
    company: {...DEFAULT_COMPANY, name:'Demo Trading Co Pvt Ltd', gstin:'24AABCD5678T1ZV',
      address:'Vatva GIDC, Ahmedabad, Gujarat 382445', upiId:'',
      groupName:'Demo Group', isHolding:false,
      modules:{gst:true, tds:true, payroll:false, factory:false, trader:true, service:false}},
    coa, parties, vouchers,
    forexRates: FOREX_RATES, gstr2bData: [],
    employees: [], payrollRuns: [],
    tdsSections: SEED_TDS_SECTIONS.map(s => ({...s, id: uid()})),
    stockItems: [], boms: [], productionOrders: [], quotations: [],
    costCentres: [], departments: [], bankRecon: [], allocations: [], bankRules: [],
    fixedAssets: [], budgets: {}, amortizations: [],
    auditLog: [auditEntry('SAMPLE_DATA', `Loaded subsidiary sample dataset · ${vouchers.length} vouchers · intercompany with Demo Manufacturing Co`)],
  };
}
