
// ============================================================================
// PERIOD-CLOSE - month/quarter-end checklist + GST set-off JV
// ============================================================================
function PeriodClose({data, setData, showToast, setPage, readOnly=false}){
  const [month,setMonth] = useState(today().slice(0,7));
  const last = new Date(parseInt(month.slice(0,4)),parseInt(month.slice(5,7)),0).getDate();
  const pStart = month+'-01', pEnd = month+'-'+String(last).padStart(2,'0');
  const pb = useMemo(()=>computePeriodBals(data,pStart,pEnd).period,[data,month]);

  const heads = [
    {name:'CGST', out:'1310', inp:'2600'},
    {name:'SGST', out:'1311', inp:'2601'},
    {name:'IGST', out:'1312', inp:'2602'},
  ].map(h=>{
    const output = Math.max(0, -(pb[h.out]||0));
    const input  = Math.max(0,  (pb[h.inp]||0));
    const setoff = Math.min(output, input);
    return {...h, output, input, setoff, net: output-setoff};
  });
  const totSetoff = heads.reduce((s,h)=>s+h.setoff,0);
  const totNet    = heads.reduce((s,h)=>s+h.net,0);

  const postSetoff = () => {
    if(totSetoff<=0) return showToast('No ITC set-off available for this period','error');
    if(isDateLocked(data.company,pEnd)) return showToast('Period is locked','error');
    const lines=[];
    heads.forEach(h=>{ if(h.setoff>0){
      lines.push({id:uid(),accountId:h.out,debit:Math.round(h.setoff),credit:0,narration:'Set-off output '+h.name});
      lines.push({id:uid(),accountId:h.inp,debit:0,credit:Math.round(h.setoff),narration:'Set-off input '+h.name});
    }});
    if(!confirm(`Post GST ITC set-off JV for ${month}?\n\nSets off ₹${fmt(totSetoff)} of input credit against output liability (head-wise). Net cash payable after set-off: ₹${fmt(totNet)}.`)) return;
    const num = nextVoucherNumber(data,'JV');
    const v={id:uid(),type:'JV',date:pEnd,number:num,partyName:'',reference:'GST Set-off',
      narration:`GST ITC set-off for ${month} (head-wise)`,lines,amount:Math.round(totSetoff),status:'Posted',createdAt:new Date().toISOString()};
    setData({...data,vouchers:[...(data.vouchers||[]),v],
      auditLog:[...(data.auditLog||[]),auditEntry('CREATE',`${num} (JV) GST set-off ${month} ₹${fmt(totSetoff)}`)]});
    showToast(`✓ GST set-off JV ${num} posted ₹${fmt(totSetoff)}`);
  };

  const checklist = [
    {label:'Depreciation posted for the period', detail:'Use the Fixed Asset Register to compute & post depreciation.', page:'fixed_assets'},
    {label:'Prepaid / accrual amortization run', detail:'Post this month’s prepaid portions.', page:'amortization'},
    {label:'Bank accounts reconciled', detail:'Match the bank statement and clear unreconciled items.', page:'bank_recon'},
    {label:'GST set-off posted & GSTR-3B filed', detail:'Set off ITC (below) and file the return.', page:'gstr3b'},
    {label:'TDS deducted, deposited & 26Q ready', detail:'Check the TDS register and challans.', page:'tds_report'},
    {label:'Statutory dues (PF/ESIC/PT) paid', detail:'See the Compliance Calendar for due dates.', page:'compliance'},
    {label:'Provisions & closing stock entries passed', detail:'Pass month-end provisions and value closing stock.', page:'vouchers'},
  ];

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Period Close</h1>
        <div className="page-sub">Month / quarter-end checklist &amp; GST ITC set-off · {month}</div>
      </div>
      <div className="page-actions">
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
      </div>
    </div>

    <div className="card" style={{marginBottom:18}}>
      <div className="card-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 className="card-title">GST ITC Set-off - {month}</h3>
        {!readOnly && totSetoff>0 && <button className="btn btn-sm btn-primary" onClick={postSetoff}>⊕ Post Set-off JV (₹{fmt(totSetoff)})</button>}
      </div>
      <div className="card-body" style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
            <th style={{padding:'8px 16px',textAlign:'left'}}>Head</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>Output Liability</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>Input Credit</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>Set-off</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>Net Payable</th>
          </tr></thead>
          <tbody>
            {heads.map(h=>(
              <tr key={h.name} style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'8px 16px',fontWeight:600}}>{h.name}</td>
                <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(h.output)}</td>
                <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(h.input)}</td>
                <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--primary)'}}>{fmt(h.setoff)}</td>
                <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600,color:h.net>0?'var(--danger)':'var(--primary)'}}>{fmt(h.net)}</td>
              </tr>
            ))}
            <tr className="total"><td style={{padding:'9px 16px'}}>TOTAL</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(heads.reduce((s,h)=>s+h.output,0))}</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(heads.reduce((s,h)=>s+h.input,0))}</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(totSetoff)}</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(totNet)}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)'}}>
        Head-wise set-off (CGST↔CGST, SGST↔SGST, IGST↔IGST). The JV clears input against output per head; "Net Payable" is the cash GST for the month. IGST surplus cross-utilisation against CGST/SGST is left for manual review to stay safe.
      </div>
    </div>

    <div className="card">
      <div className="card-head"><h3 className="card-title">Period-Close Checklist</h3></div>
      <div className="card-body" style={{padding:0}}>
        {checklist.map((c,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 18px',borderBottom:i<checklist.length-1?'1px solid var(--line-2)':'none'}}>
            <span style={{fontSize:16,color:'var(--ink-3)'}}>☐</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13}}>{c.label}</div>
              <div style={{fontSize:11.5,color:'var(--ink-3)'}}>{c.detail}</div>
            </div>
            <button className="btn btn-sm" onClick={()=>setPage && c.page && setPage(c.page)}>Open</button>
          </div>
        ))}
      </div>
    </div>
  </>);
}

// ============================================================================
// PROFITABILITY ANALYSIS (by Item / Customer / HSN)
// ============================================================================
function ProfitabilityReport({data}){
  const fyStart = data.company.fyStart || '';
  const [from, setFrom] = useState(fyStart);
  const [to,   setTo]   = useState(today());
  const [view, setView] = useState('item');   // item | customer | hsn

  const inP = v => v.date>=from && v.date<=to && v.status!=='Cancelled';
  // Average purchase cost per HSN / description (for COGS estimate)
  const costMap = useMemo(() => {
    const m = {};
    data.vouchers.filter(v=>v.type==='PUR' && inP(v)).forEach(v=>(v.items||[]).forEach(it=>{
      [(it.hsn||'').toLowerCase(), (it.description||'').toLowerCase()].forEach(k=>{
        if(!k) return; if(!m[k]) m[k]={qty:0,amt:0}; m[k].qty+=(it.qty||0); m[k].amt+=(it.qty||0)*(it.rate||0);
      });
    }));
    const out={}; Object.entries(m).forEach(([k,x])=>{ out[k]=x.qty? x.amt/x.qty : 0; }); return out;
  }, [data.vouchers, from, to]);
  const costFor = it => costMap[(it.hsn||'').toLowerCase()] || costMap[(it.description||'').toLowerCase()] || 0;

  const rows = useMemo(() => {
    const m = {};
    data.vouchers.filter(v=>(v.type==='SAL'||v.type==='CRN') && inP(v)).forEach(v=>{
      const sgn = v.type==='CRN' ? -1 : 1;
      (v.items||[]).forEach(it=>{
        const key = view==='customer' ? (v.partyName||'-') : view==='hsn' ? (it.hsn||'NA') : (it.description||'Item');
        if(!m[key]) m[key]={key, qty:0, rev:0, cogs:0};
        const amt=(it.qty||0)*(it.rate||0)*sgn;
        m[key].qty  += (it.qty||0)*sgn;
        m[key].rev  += amt;
        m[key].cogs += (it.qty||0)*sgn*costFor(it);
      });
    });
    return Object.values(m).map(r=>({...r, margin:r.rev-r.cogs, marginPct: r.rev? (r.rev-r.cogs)/r.rev*100 : 0}))
      .sort((a,b)=>b.rev-a.rev);
  }, [data.vouchers, from, to, view, costMap]);

  const T = k => rows.reduce((s,r)=>s+r[k],0);
  const handleExcel = () => exportXLSX(`Profitability_${view}_${from}_${to}.xlsx`, [{name:'Profitability', rows:[
    [`Profitability by ${view} - ${data.company.name}`],[`Period: ${fmtDate(from)} to ${fmtDate(to)}`],[],
    [view==='customer'?'Customer':view==='hsn'?'HSN/SAC':'Item','Qty','Revenue','COGS (est)','Margin','Margin %'],
    ...rows.map(r=>[r.key, r.qty, r.rev, r.cogs, r.margin, r.marginPct.toFixed(1)]),
    [],['TOTAL', T('qty'), T('rev'), T('cogs'), T('margin'), (T('rev')?(T('margin')/T('rev')*100).toFixed(1):'')],
  ]}]);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Profitability Analysis</h1>
        <div className="page-sub">Revenue &amp; gross margin by {view} · COGS estimated from average purchase cost</div>
      </div>
      <div className="page-actions"><button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button></div>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:12}}>
      {[['item','By Item'],['customer','By Customer'],['hsn','By HSN/SAC']].map(([k,l])=>(
        <button key={k} className={'btn'+(view===k?' btn-primary':'')} onClick={()=>setView(k)}>{l}</button>
      ))}
    </div>
    <div className="filter-bar">
      <div className="field"><label>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
      <div className="field"><label>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>{view==='customer'?'Customer':view==='hsn'?'HSN / SAC':'Item'}</th>
          <th className="num" style={{width:90}}>Qty</th>
          <th className="num" style={{width:130}}>Revenue (₹)</th>
          <th className="num" style={{width:130}}>COGS est. (₹)</th>
          <th className="num" style={{width:130}}>Margin (₹)</th>
          <th className="num" style={{width:90}}>Margin %</th>
        </tr></thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td colSpan="6"><div className="empty"><div className="empty-ico">∅</div><div>No itemised sales in this period.</div></div></td></tr>
          ) : rows.map((r,i)=>(
            <tr key={i}>
              <td style={{fontWeight:500}}>{r.key}</td>
              <td className="num">{fmt(r.qty,2)}</td>
              <td className="num">{fmt(r.rev)}</td>
              <td className="num" style={{color:'var(--ink-3)'}}>{r.cogs?fmt(r.cogs):'-'}</td>
              <td className="num" style={{fontWeight:600,color:r.margin>=0?'var(--primary)':'var(--danger)'}}>{fmt(r.margin)}</td>
              <td className="num" style={{color:r.marginPct>=0?'var(--primary)':'var(--danger)'}}>{r.cogs?r.marginPct.toFixed(1)+'%':'-'}</td>
            </tr>
          ))}
          {rows.length>0 && (
            <tr className="total">
              <td style={{textAlign:'right'}}>TOTAL</td>
              <td className="num">{fmt(T('qty'),2)}</td><td className="num">₹{fmt(T('rev'))}</td>
              <td className="num">₹{fmt(T('cogs'))}</td><td className="num">₹{fmt(T('margin'))}</td>
              <td className="num">{T('rev')?(T('margin')/T('rev')*100).toFixed(1)+'%':'-'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <div style={{marginTop:10,fontSize:11,color:'var(--ink-3)'}}>COGS is estimated using the average purchase rate per HSN/item in the period - accurate where you record purchases with matching HSN/descriptions. Items without a purchase match show margin as revenue.</div>
  </>);
}

// ============================================================================
// BUDGET vs ACTUAL (P&L)
// ============================================================================
function BudgetVsActual({data, setData, showToast, readOnly=false}){
  const fyStart = data.company.fyStart || '';
  const [from, setFrom] = useState(fyStart);
  const [to,   setTo]   = useState(today());
  const [budgets, setBudgets] = useState(data.budgets || {});
  const pb = useMemo(() => computePeriodBals(data, from, to), [data, from, to]);

  const days = Math.max(1, Math.round((new Date(to)-new Date(from))/86400000)+1);
  const proRata = days/365;

  const accts = data.coa.filter(a=>a.type==='Income'||a.type==='Expense');
  const rows = accts.map(a=>{
    const actual = a.type==='Income' ? -(pb.period[a.id]||0) : (pb.period[a.id]||0);
    const annual = parseFloat(budgets[a.id])||0;
    const prorated = Math.round(annual*proRata);
    // Favourable: income above budget, expense below budget
    const variance = a.type==='Income' ? (actual - prorated) : (prorated - actual);
    return {...a, actual, annual, prorated, variance, variancePct: prorated? (variance/prorated*100):0};
  }).filter(r=>Math.abs(r.actual)>0.5 || r.annual>0);

  const grp = (type) => rows.filter(r=>r.type===type);
  const sum = (arr,k)=>arr.reduce((s,r)=>s+r[k],0);

  const save = () => { setData({...data, budgets}); showToast('Budgets saved'); };
  const handleExcel = () => exportXLSX(`BudgetVsActual_${from}_${to}.xlsx`, [{name:'Budget vs Actual', rows:[
    [`Budget vs Actual - ${data.company.name}`],[`Period: ${fmtDate(from)} to ${fmtDate(to)} (${days} days, budget pro-rated ${(proRata*100).toFixed(0)}%)`],[],
    ['Account','Type','Annual Budget','Period Budget','Actual','Variance','Variance %'],
    ...rows.map(r=>[r.name, r.type, r.annual, r.prorated, r.actual, r.variance, r.variancePct.toFixed(1)]),
  ]}]);

  const section = (label, type) => {
    const g = grp(type);
    if(!g.length) return null;
    return (<>
      <tr className="group"><td colSpan="6">{label}</td></tr>
      {g.map(r=>(
        <tr key={r.id}>
          <td>{r.name}</td>
          <td style={{width:150}}>{!readOnly
            ? <input type="number" value={budgets[r.id]||''} placeholder="0"
                onChange={e=>setBudgets({...budgets, [r.id]:e.target.value})}
                style={{width:'100%',textAlign:'right',padding:'4px 8px',border:'1px solid var(--line-2)',borderRadius:5,fontSize:12,fontFamily:'var(--mono)'}} />
            : <span className="num">{fmt(r.annual)}</span>}</td>
          <td className="num" style={{color:'var(--ink-3)'}}>{fmt(r.prorated)}</td>
          <td className="num" style={{fontWeight:600}}>{fmt(r.actual)}</td>
          <td className="num" style={{fontWeight:600,color:r.variance>=0?'var(--primary)':'var(--danger)'}}>{r.variance>=0?'+':''}{fmt(r.variance)}</td>
          <td className="num" style={{color:r.variance>=0?'var(--primary)':'var(--danger)'}}>{r.prorated?(r.variance>=0?'+':'')+r.variancePct.toFixed(0)+'%':'-'}</td>
        </tr>
      ))}
    </>);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Budget vs Actual</h1>
        <div className="page-sub">Set annual budgets per P&amp;L account · variance vs period actuals (budget pro-rated to period)</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        {!readOnly && <button className="btn btn-sm btn-primary" onClick={save}>💾 Save Budgets</button>}
      </div>
    </div>
    <div className="filter-bar">
      <div className="field"><label>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
      <div className="field"><label>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
      <div style={{alignSelf:'flex-end',paddingBottom:6,fontSize:11,color:'var(--ink-3)'}}>Budget shown for period = annual × {(proRata*100).toFixed(0)}%</div>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Account</th><th className="num" style={{width:150}}>Annual Budget (₹)</th>
          <th className="num" style={{width:120}}>Period Budget</th><th className="num" style={{width:120}}>Actual</th>
          <th className="num" style={{width:120}}>Variance</th><th className="num" style={{width:90}}>Var %</th>
        </tr></thead>
        <tbody>
          {section('INCOME','Income')}
          <tr className="total"><td style={{textAlign:'right'}}>Total Income</td><td className="num">₹{fmt(sum(grp('Income'),'annual'))}</td>
            <td className="num">₹{fmt(sum(grp('Income'),'prorated'))}</td><td className="num">₹{fmt(sum(grp('Income'),'actual'))}</td>
            <td className="num">₹{fmt(sum(grp('Income'),'variance'))}</td><td></td></tr>
          {section('EXPENSES','Expense')}
          <tr className="total"><td style={{textAlign:'right'}}>Total Expenses</td><td className="num">₹{fmt(sum(grp('Expense'),'annual'))}</td>
            <td className="num">₹{fmt(sum(grp('Expense'),'prorated'))}</td><td className="num">₹{fmt(sum(grp('Expense'),'actual'))}</td>
            <td className="num">₹{fmt(sum(grp('Expense'),'variance'))}</td><td></td></tr>
        </tbody>
      </table>
    </div>
    <div style={{marginTop:10,fontSize:11,color:'var(--ink-3)'}}>Positive variance = favourable (income above / expense below budget). Enter annual budgets and Save - they persist with your data.</div>
  </>);
}

// ============================================================================
// SALES & PURCHASE REGISTERS (GST format)
// ============================================================================
function SalesPurchaseRegister({data}){
  const fyStart = data.company.fyStart || '';
  const [tab, setTab]   = useState('sales');   // sales | purchase
  const [from, setFrom] = useState(fyStart);
  const [to,   setTo]   = useState(today());

  const isSales = tab==='sales';
  const types = isSales ? ['SAL','CRN'] : ['PUR','DBN'];
  const rows = useMemo(() => data.vouchers
    .filter(v => v.status!=='Cancelled' && types.includes(v.type) && v.date>=from && v.date<=to)
    .sort((a,b)=>a.date.localeCompare(b.date) || (a.number||'').localeCompare(b.number||''))
    .map(v => {
      const p = data.parties.find(x=>x.id===v.partyId);
      const sgn = (v.type==='CRN'||v.type==='DBN') ? -1 : 1;
      return { id:v.id, date:v.date, number:v.number, type:v.type, party:v.partyName||p?.name||'-',
        gstin:p?.gstin||'', pos:v.placeOfSupply||p?.stateCode||'',
        taxable:sgn*(v.taxable||0), cgst:sgn*(v.cgst||0), sgst:sgn*(v.sgst||0), igst:sgn*(v.igst||0),
        total:sgn*(v.total||v.amount||0) };
    }), [data.vouchers, data.parties, tab, from, to]);

  const T = (k)=>rows.reduce((s,r)=>s+r[k],0);
  const handleExcel = () => exportXLSX(`${isSales?'Sales':'Purchase'}Register_${from}_${to}.xlsx`, [{
    name: isSales?'Sales Register':'Purchase Register',
    rows: [
      [`${isSales?'Sales':'Purchase'} Register - ${data.company.name}`],[`Period: ${fmtDate(from)} to ${fmtDate(to)}`],[],
      ['Date','Invoice No','Type','Party','GSTIN','POS','Taxable','CGST','SGST','IGST','Invoice Value'],
      ...rows.map(r=>[r.date,r.number,r.type,r.party,r.gstin,r.pos,r.taxable,r.cgst,r.sgst,r.igst,r.total]),
      [],['','','','TOTAL','','',T('taxable'),T('cgst'),T('sgst'),T('igst'),T('total')],
    ]
  }]);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">{isSales?'Sales':'Purchase'} Register</h1>
        <div className="page-sub">GST-format invoice register · {rows.length} documents · {fmtDate(from)} → {fmtDate(to)}</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:12}}>
      <button className={'btn'+(isSales?' btn-primary':'')} onClick={()=>setTab('sales')}>↗ Sales Register</button>
      <button className={'btn'+(!isSales?' btn-primary':'')} onClick={()=>setTab('purchase')}>↘ Purchase Register</button>
    </div>
    <div className="filter-bar">
      <div className="field"><label>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
      <div className="field"><label>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
    </div>
    <div className="table-wrap">
      <table style={{fontSize:12.5}}>
        <thead><tr>
          <th style={{width:90}}>Date</th><th style={{width:100}}>Invoice No</th><th style={{width:46}}>Type</th>
          <th>Party</th><th style={{width:150}}>GSTIN</th><th style={{width:42}}>POS</th>
          <th className="num" style={{width:110}}>Taxable</th><th className="num" style={{width:90}}>CGST</th>
          <th className="num" style={{width:90}}>SGST</th><th className="num" style={{width:90}}>IGST</th>
          <th className="num" style={{width:120}}>Invoice Value</th>
        </tr></thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td colSpan="11"><div className="empty"><div className="empty-ico">∅</div><div>No {isSales?'sales':'purchase'} documents in this period.</div></div></td></tr>
          ) : rows.map(r=>(
            <tr key={r.id}>
              <td style={{whiteSpace:'nowrap'}}>{fmtDate(r.date)}</td>
              <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{r.number}</td>
              <td><span className={'badge '+(r.type==='CRN'||r.type==='DBN'?'badge-danger':'badge-info')} style={{fontSize:10}}>{r.type}</span></td>
              <td>{r.party}</td>
              <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{r.gstin||'-'}</td>
              <td>{r.pos}</td>
              <td className="num">{fmt(r.taxable)}</td><td className="num">{r.cgst?fmt(r.cgst):''}</td>
              <td className="num">{r.sgst?fmt(r.sgst):''}</td><td className="num">{r.igst?fmt(r.igst):''}</td>
              <td className="num bold">₹{fmt(r.total)}</td>
            </tr>
          ))}
          {rows.length>0 && (
            <tr className="total">
              <td colSpan="6" style={{textAlign:'right'}}>TOTAL</td>
              <td className="num">₹{fmt(T('taxable'))}</td><td className="num">₹{fmt(T('cgst'))}</td>
              <td className="num">₹{fmt(T('sgst'))}</td><td className="num">₹{fmt(T('igst'))}</td>
              <td className="num">₹{fmt(T('total'))}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <div style={{marginTop:10,fontSize:11,color:'var(--ink-3)'}}>Credit/Debit notes shown as negatives. This register is the source for GSTR-1 (outward) / GSTR-3B ITC (inward).</div>
  </>);
}

// ============================================================================
// COMPLIANCE CALENDAR & STATUTORY DUES
// ============================================================================
function ComplianceCalendar({data, setPage}){
  const fyStart = data.company.fyStart || '2025-04-01';
  const fyYear  = parseInt(fyStart.slice(0,4));
  const t = today();
  const base = new Date(t+'T00:00:00');

  // Build the actual filing/payment deadlines around today, each carrying that
  // PERIOD'S liability (not a misleading cumulative figure).
  const deadlines = useMemo(() => {
    const outIds=[...acctIdSet(data,'gst_output')], inIds=[...acctIdSet(data,'gst_input')];
    const tdsIds=(data.coa||[]).filter(a=>/tds\s*payable/i.test(a.name||'')).map(a=>a.id);
    const pfId=(data.coa||[]).find(a=>/pf\s*payable|provident/i.test(a.name||''))?.id||'1322';
    const esicId=(data.coa||[]).find(a=>/esic/i.test(a.name||''))?.id||'1323';
    const ptId=(data.coa||[]).find(a=>/professional\s*tax/i.test(a.name||''))?.id||'1324';
    const rows=[];
    for(let off=-3; off<=2; off++){               // period months around now
      const d  = new Date(base.getFullYear(), base.getMonth()+off, 1);
      const mo = d.toISOString().slice(0,7);
      const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
      const pb = computePeriodBals(data, mo+'-01', mo+'-'+String(last).padStart(2,'0')).period;
      const sm = (ids,sg)=>ids.reduce((s,id)=>s+sg*(pb[id]||0),0);
      const gst = Math.round(Math.max(0, sm(outIds,-1)-sm(inIds,1)));
      const tds = Math.round(sm(tdsIds,-1));
      const pf  = Math.round(-(pb[pfId]||0)-(pb[esicId]||0));
      const pt  = Math.round(-(pb[ptId]||0));
      const fileM = new Date(d.getFullYear(), d.getMonth()+1, 1);   // filed next month
      const dd = day => new Date(fileM.getFullYear(), fileM.getMonth(), day).toISOString().slice(0,10);
      rows.push({form:'TDS Payment - Challan ITNS-281', period:mo, due:dd(7),  amount:tds, page:'tds_report'});
      rows.push({form:'GSTR-1 - Outward supplies',       period:mo, due:dd(11), amount:null, always:true, page:'gstr1'});
      rows.push({form:'PF & ESIC - ECR upload',          period:mo, due:dd(15), amount:pf,  page:null});
      rows.push({form:'GSTR-3B + GST payment',           period:mo, due:dd(20), amount:gst, always:true, page:'gstr3b'});
      rows.push({form:'Professional Tax payment',        period:mo, due:dd(21), amount:pt,  page:null});
    }
    // Quarterly TDS return (26Q) + Advance tax
    const qEnds=[[`${fyYear}-07-31`,'Q1'],[`${fyYear}-10-31`,'Q2'],[`${fyYear+1}-01-31`,'Q3'],[`${fyYear+1}-05-31`,'Q4']];
    qEnds.forEach(([due,q])=>rows.push({form:`TDS Return - Form 26Q (${q})`, period:q, due, amount:null, page:'tds_report'}));
    [['06-15','1st · 15%'],['09-15','2nd · 45%'],['12-15','3rd · 75%']].forEach(([md,l])=>
      rows.push({form:`Advance Tax - ${l}`, period:`FY${fyYear}`, due:`${fyYear}-${md}`, amount:null, page:'adv_tax'}));
    rows.push({form:'Advance Tax - 4th · 100%', period:`FY${fyYear}`, due:`${fyYear+1}-03-15`, amount:null, page:'adv_tax'});
    rows.push({form:'GSTR-9 - Annual Return', period:`FY${fyYear}`, due:`${fyYear+1}-12-31`, amount:null, page:'gstr9'});

    const lo=new Date(base); lo.setDate(lo.getDate()-45);
    const hi=new Date(base); hi.setDate(hi.getDate()+90);
    return rows
      .filter(x => { const dt=new Date(x.due); return dt>=lo && dt<=hi; })
      .filter(x => x.always || x.amount===null || x.amount>0.5)
      .map(x => ({...x, days: Math.round((new Date(x.due)-base)/86400000)}))
      .sort((a,b)=>a.due.localeCompare(b.due));
  }, [data, t]);

  const overdue = deadlines.filter(d=>d.days<0 && (d.amount===null?false:d.amount>0));
  const dueSoon = deadlines.filter(d=>d.days>=0 && d.days<=10);
  const totalUpcoming = deadlines.filter(d=>d.days>=0 && d.amount).reduce((s,d)=>s+d.amount,0);

  const statusBadge = (d) => {
    if(d.days<0) return <span className="badge badge-danger" style={{fontSize:10}}>{-d.days}d overdue</span>;
    if(d.days<=7) return <span className="badge" style={{fontSize:10,background:'#fff3e0',color:'#e65100'}}>due in {d.days}d</span>;
    return <span className="badge badge-info" style={{fontSize:10}}>in {d.days}d</span>;
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Compliance Calendar</h1>
        <div className="page-sub">FY {fyYear}–{String(fyYear+1).slice(2)} · upcoming GST · TDS · PF/ESIC/PT · Advance-tax deadlines with the amount due</div>
      </div>
    </div>

    <div className="stat-grid" style={{marginBottom:18}}>
      <div className={'stat '+(overdue.length?'stat-danger':'')}><div className="stat-label">Overdue</div>
        <div className="stat-value" style={{color:overdue.length?'var(--danger)':'var(--primary)'}}>{overdue.length?overdue.length:'✓ 0'}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Due within 10 days</div><div className="stat-value">{dueSoon.length}</div></div>
      <div className="stat stat-info"><div className="stat-label">Upcoming payable (est.)</div><div className="stat-value rupee">₹{fmt(totalUpcoming)}</div></div>
    </div>

    <div className="card">
      <div className="card-head"><h3 className="card-title">Upcoming &amp; Recent Deadlines</h3>
        <span style={{fontSize:11,color:'var(--ink-3)'}}>next 90 days · last 45 days</span></div>
      <div className="card-body" style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
            <th style={{padding:'9px 16px',textAlign:'left'}}>Return / Payment</th>
            <th style={{padding:'9px 16px',textAlign:'left',width:90}}>Period</th>
            <th style={{padding:'9px 16px',textAlign:'left',width:110}}>Due Date</th>
            <th style={{padding:'9px 16px',textAlign:'right',width:140}}>Amount (₹)</th>
            <th style={{padding:'9px 16px',textAlign:'center',width:120}}>Status</th>
            <th style={{padding:'9px 16px',width:60}}></th>
          </tr></thead>
          <tbody>
            {deadlines.length===0 ? (
              <tr><td colSpan="6" style={{padding:24,textAlign:'center',color:'var(--ink-3)'}}>No deadlines in this window.</td></tr>
            ) : deadlines.map((d,i)=>(
              <tr key={i} style={{borderBottom:'1px solid var(--line-2)', background:d.days<0&&d.amount?'#fdecea':d.days>=0&&d.days<=7?'#fff8e1':'transparent'}}>
                <td style={{padding:'8px 16px',fontWeight:500}}>{d.form}</td>
                <td style={{padding:'8px 16px',fontSize:12,color:'var(--ink-3)'}}>{d.period}</td>
                <td style={{padding:'8px 16px',whiteSpace:'nowrap'}}>{fmtDate(d.due)}</td>
                <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600}}>{d.amount===null?'-':d.amount>0?fmt(d.amount):'Nil'}</td>
                <td style={{padding:'8px 16px',textAlign:'center'}}>{statusBadge(d)}</td>
                <td style={{padding:'8px 16px',textAlign:'center'}}>{d.page && setPage && <button className="btn btn-sm btn-ghost" style={{fontSize:11}} onClick={()=>setPage(d.page)}>Open</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)'}}>
        "Amount" is that period's liability from your ledgers (-  = filing only, Nil = nothing payable). GST = net output tax after ITC. Always verify the challan/return was actually filed; this is a reminder, not a confirmation of filing.
      </div>
    </div>
  </>);
}

// ============================================================================
// HSN / SAC RATE FINDER  searchable GST 2.0 rate master
// ============================================================================
function HSNFinder({data}){
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('All');     // All | HSN | SAC
  const [rate, setRate] = useState('All');

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return HSN_SAC_MASTER.filter(h =>
      (kind==='All' || h.kind===kind) &&
      (rate==='All' || String(h.rate)===rate) &&
      (!s || h.code.includes(s) || h.desc.toLowerCase().includes(s))
    );
  }, [q, kind, rate]);

  const rateColor = r => r<0?'#6b7280':r===0?'#6b7280':r<=5?'#0b6b4f':r<=12?'#1976d2':r<=18?'#e65100':'#c62828';
  const handleExcel = () => exportXLSX(`HSN_SAC_Master_${today()}.xlsx`, [{
    name:'HSN-SAC Master', rows:[
      ['HSN/SAC GST Rate Master  GST 2.0 (Notif. 9/2025) · w.e.f. 22-Sep-2025'],[],
      ['Code','Type','Description','GST Rate %','Cess %','Schedule'],
      ...results.map(h => [h.code, h.kind, h.desc, h.rate<0?'Outside GST':h.rate, h.cess, h.sch]),
    ]
  }]);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">HSN / SAC Rate Finder</h1>
        <div className="page-sub">GST 2.0 master · Notif. 9/2025-CT(Rate) · {HSN_SAC_MASTER.length} codes · search by code or description</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
      </div>
    </div>

    <div className="filter-bar">
      <div className="field" style={{flex:1,minWidth:240}}><label>Search</label>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g. 8471, laptop, cement, audit, hotel…" autoFocus />
      </div>
      <div className="field"><label>Type</label>
        <select value={kind} onChange={e=>setKind(e.target.value)}>
          <option>All</option><option value="HSN">HSN (Goods)</option><option value="SAC">SAC (Services)</option>
        </select>
      </div>
      <div className="field"><label>GST Rate</label>
        <select value={rate} onChange={e=>setRate(e.target.value)}>
          <option value="All">All Rates</option>
          <option value="0">0% (Nil/Exempt)</option><option value="0.25">0.25%</option><option value="3">3%</option>
          <option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
          <option value="-1">Outside GST</option>
        </select>
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th style={{width:90}}>Code</th><th style={{width:60}}>Type</th><th>Description</th>
          <th className="num" style={{width:90}}>GST %</th><th className="num" style={{width:70}}>Cess %</th>
          <th style={{width:90}}>Schedule</th>
        </tr></thead>
        <tbody>
          {results.length===0 ? (
            <tr><td colSpan="6"><div className="empty"><div className="empty-ico">🔍</div><div>No match. Try a 4-digit HSN, a SAC like 9982, or a keyword.</div></div></td></tr>
          ) : results.slice(0,400).map((h,i)=>(
            <tr key={i}>
              <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{h.code}</td>
              <td><span className={'badge '+(h.kind==='HSN'?'badge-info':'badge-gold')} style={{fontSize:10}}>{h.kind}</span></td>
              <td>{h.desc}</td>
              <td className="num" style={{fontWeight:700,color:rateColor(h.rate)}}>{h.rate<0?'':h.rate+'%'}</td>
              <td className="num" style={{color:h.cess?'var(--danger)':'var(--ink-3)'}}>{h.cess?h.cess+'%':''}</td>
              <td style={{fontSize:11,color:'var(--ink-3)'}}>{h.sch}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length>400 && <div style={{padding:'8px 12px',fontSize:11,color:'var(--ink-3)'}}>Showing first 400 of {results.length}  refine your search.</div>}
    </div>
    <div style={{marginTop:12,fontSize:11,color:'var(--ink-3)'}}>
      ℹ Tip: in any Sales/Purchase voucher, type the HSN/SAC code in the line's HSN field  the GST rate auto-fills from this master. Rates per GST 2.0 (22-Sep-2025); always verify against the CBIC notification before filing.
    </div>
  </>);
}

// ============================================================================
// GSTR-1  Full Implementation
// ============================================================================
// ============================================================================
// GST THREE-WAY RECONCILIATION  Books (ledger) vs GSTR-1 (invoices) vs GSTR-3B
// Catches invoices whose tax never hit the GST ledgers, manual JV drift, and
// under/over-reporting vs what was actually filed - before you file.
// ============================================================================
// ============================================================================
// TAX RATE REFERENCE  quick-reference card for the current FY (GST / IT / TDS)
// A convenience reference - always verify against the latest Finance Act /
// CBIC notification for your period.
// ============================================================================
function TaxRates({data}){
  const fyY = parseInt((data.company.fyStart||'2025-04-01').slice(0,4));
  const fyLabel = `${fyY}-${String(fyY+1).slice(2)}`;
  const Section = ({title, headers, rows, note}) => (
    <div className="card" style={{marginBottom:16}}>
      <div className="card-head"><h3 className="card-title">{title}</h3></div>
      <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr>{headers.map((h,i)=><th key={i} className={i>0?'num':''}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i}>{r.map((c,j)=><td key={j} className={j>0?'num':''} style={j===0?{fontWeight:500}:{}}>{c}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      {note && <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)',lineHeight:1.6}}>{note}</div>}
    </div>
  );
  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Tax Rate Reference</h1>
        <div className="page-sub">Common rates for FY {fyLabel} · verify against the latest notification for your period</div>
      </div>
      <div className="page-actions"><button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button></div>
    </div>

    <div className="card" style={{marginBottom:16,borderLeft:'4px solid var(--accent)'}}>
      <div className="card-body" style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.6}}>
        ⚠ These are the <b>commonly-applicable</b> rates for ready reference. GST slabs, TDS rates, surcharge thresholds and
        income-tax options change with each Budget/notification - <b>confirm the current rate for your exact case</b> before filing.
      </div>
    </div>

    <Section title="GST Rate Slabs" headers={['Slab','Typical supplies']} rows={[
      ['0% / Exempt','Fresh produce, milk, education, healthcare, most unbranded food'],
      ['5%','Essential goods, transport, small restaurants, job work (some)'],
      ['12%','Processed food, business-class travel, some machinery/parts'],
      ['18%','Most goods & services - the standard rate (electronics, services)'],
      ['28%','Luxury / sin goods - cars, ACs, aerated drinks, tobacco (+ cess)'],
    ]} note="Composition scheme: 1% (traders/mfrs), 5% (restaurants), 6% (services ≤ ₹50L turnover)." />

    <Section title="Company / Business Income-Tax Options" headers={['Regime','Rate','Applies to']} rows={[
      ['Domestic co. (turnover ≤ ₹400 cr)','25%','MSME companies on normal provisions'],
      ['Sec 115BAA','22%','Domestic co. opting out of most exemptions'],
      ['Sec 115BAB','15%','New manufacturing companies (conditions apply)'],
      ['Other domestic company','30%','Turnover > ₹400 cr on normal provisions'],
      ['Partnership firm / LLP','30%','Flat'],
    ]} note="Add surcharge (7% / 12% for companies by income band; 10–37% for individuals/firms by slab) + Health & Education Cess 4% on (tax + surcharge). 115BAA/BAB carry a flat 10% surcharge." />

    <Section title="Common TDS Sections" headers={['Section','Nature','Rate','Threshold (₹/yr)']} rows={[
      ['194C','Contractor / sub-contractor','1% (indiv/HUF) · 2% (others)','30,000 single / 1,00,000 aggregate'],
      ['194J','Professional / technical fees','10% (2% for technical)','30,000'],
      ['194I','Rent - plant & machinery','2%','2,40,000'],
      ['194I','Rent - land / building','10%','2,40,000'],
      ['194H','Commission / brokerage','2% (from Oct-24)','20,000'],
      ['194A','Interest (other than securities)','10%','40,000 (50,000 seniors) - banks'],
      ['194Q','Purchase of goods > ₹50L','0.1%','on value above 50,00,000'],
      ['192','Salary','As per slab','Basic exemption'],
    ]} note="Deduct at 20% (or 2× the rate) if the deductee has no PAN. Higher rate applies under 206AB for non-filers. Deposit by the 7th of the next month." />
  </>);
}

function GSTRecon({data, setData, showToast, readOnly=false}){
  const [month, setMonth] = useState(today().slice(0,7));
  const r2 = n => Math.round((n||0)*100)/100;
  const from = month + '-01';
  const to = month + '-' + String(new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0).getDate()).padStart(2,'0');

  const pb = useMemo(() => computePeriodBals(data, from, to).period, [data, from, to]);
  // Books / ledger: output GST is the CREDIT movement in the output ledgers.
  const ledger = { igst:r2(-(pb['1312']||0)), cgst:r2(-(pb['1310']||0)), sgst:r2(-(pb['1311']||0)) };

  // GSTR-1 / invoices: tax from outward invoices (SAL − CRN) in the period.
  const inv = useMemo(() => {
    let igst=0, cgst=0, sgst=0, taxable=0;
    (data.vouchers||[]).forEach(v => {
      if(v.status==='Cancelled' || !v.date.startsWith(month)) return;
      const s = v.type==='SAL' ? 1 : v.type==='CRN' ? -1 : 0;
      if(!s) return;
      igst += s*(v.igst||0); cgst += s*(v.cgst||0); sgst += s*(v.sgst||0); taxable += s*(v.taxable||0);
    });
    return { igst:r2(igst), cgst:r2(cgst), sgst:r2(sgst), taxable:r2(taxable) };
  }, [data.vouchers, month]);

  // GSTR-3B as FILED on the portal - editable, persisted per month. Defaults to invoices.
  const filedAll = (data.gstFiled||{});
  const filed = filedAll[month] || { igst:inv.igst, cgst:inv.cgst, sgst:inv.sgst };
  const setFiled = (patch) => {
    if(readOnly) return;
    setData({...data, gstFiled:{...filedAll, [month]:{ igst:filed.igst, cgst:filed.cgst, sgst:filed.sgst, ...patch }}});
  };

  const heads = [
    {k:'igst', label:'IGST'},
    {k:'cgst', label:'CGST'},
    {k:'sgst', label:'SGST'},
  ];
  const rowStatus = (h) => {
    const vals = [ledger[h], inv[h], filed[h]].map(r2);
    const max = Math.max(...vals), min = Math.min(...vals);
    return { ok: (max-min) < 1, spread: r2(max-min) };
  };
  const totLedger = r2(ledger.igst+ledger.cgst+ledger.sgst);
  const totInv    = r2(inv.igst+inv.cgst+inv.sgst);
  const totFiled  = r2((filed.igst||0)+(filed.cgst||0)+(filed.sgst||0));
  const anyMismatch = heads.some(h => !rowStatus(h.k).ok) || Math.abs(totLedger-totInv) >= 1 || Math.abs(totInv-totFiled) >= 1;

  const handleExcel = () => exportXLSX(`GST_3Way_Recon_${month}.xlsx`, [{
    name:'GST Reconciliation',
    rows:[
      [`GST Three-Way Reconciliation  ${data.company.name}  ${month}`],[],
      ['Head','Books (Ledger)','GSTR-1 (Invoices)','GSTR-3B (As Filed)','Max Spread','Status'],
      ...heads.map(h=>[h.label, ledger[h.k], inv[h.k], filed[h.k]||0, rowStatus(h.k).spread, rowStatus(h.k).ok?'OK':'MISMATCH']),
      ['Total', totLedger, totInv, totFiled, '', anyMismatch?'CHECK':'OK'],
      [],['Taxable turnover (invoices)', inv.taxable],
    ],
  }]);

  const cell = (v) => '₹'+fmt(v);
  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">GST Reconciliation (3-Way)</h1>
        <div className="page-sub">Books vs GSTR-1 vs GSTR-3B · {month} · catch mismatches before filing</div>
      </div>
      <div className="page-actions">
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    <div className="stat-grid" style={{marginBottom:14}}>
      <div className="stat stat-info"><div className="stat-label">Books Output Tax</div><div className="stat-value rupee">₹{fmt(totLedger)}</div><div className="stat-delta">from GST ledgers</div></div>
      <div className="stat"><div className="stat-label">GSTR-1 (Invoices)</div><div className="stat-value rupee">₹{fmt(totInv)}</div><div className="stat-delta">Taxable ₹{fmt(inv.taxable)}</div></div>
      <div className="stat stat-gold"><div className="stat-label">GSTR-3B (As Filed)</div><div className="stat-value rupee">₹{fmt(totFiled)}</div><div className="stat-delta">editable below</div></div>
      <div className={'stat '+(anyMismatch?'stat-danger':'')}>
        <div className="stat-label">Status</div>
        <div className="stat-value">{anyMismatch ? '⚠ Mismatch' : '✓ Reconciled'}</div>
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Tax Head</th>
          <th className="num">Books (Ledger)</th>
          <th className="num">GSTR-1 (Invoices)</th>
          <th className="num" style={{width:150}}>GSTR-3B (As Filed)</th>
          <th className="num">Max Spread</th>
          <th style={{width:120}}>Status</th>
        </tr></thead>
        <tbody>
          {heads.map(h=>{
            const st = rowStatus(h.k);
            return (
              <tr key={h.k} style={st.ok?{}:{background:'#fff8e6'}}>
                <td style={{fontWeight:600}}>{h.label}</td>
                <td className="num">{cell(ledger[h.k])}</td>
                <td className="num">{cell(inv[h.k])}</td>
                <td className="num">
                  <input type="number" value={filed[h.k]||0} disabled={readOnly}
                    onChange={e=>setFiled({[h.k]: r2(parseFloat(e.target.value)||0)})}
                    style={{width:130,textAlign:'right',padding:'4px 8px',border:'1px solid var(--line-2)',borderRadius:5,fontFamily:'var(--mono)',fontSize:12}} />
                </td>
                <td className="num" style={{color:st.ok?'var(--ink-3)':'var(--danger)',fontWeight:st.ok?400:700}}>{fmt(st.spread)}</td>
                <td>{st.ok ? <span className="badge badge-success">Matched</span> : <span className="badge badge-gold">⚠ Check</span>}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr style={{fontWeight:800,borderTop:'2px solid var(--line)',background:'var(--surface-2)'}}>
          <td>TOTAL</td>
          <td className="num">₹{fmt(totLedger)}</td>
          <td className="num">₹{fmt(totInv)}</td>
          <td className="num">₹{fmt(totFiled)}</td>
          <td></td>
          <td>{anyMismatch ? <span className="badge badge-danger">Reconcile</span> : <span className="badge badge-success">✓</span>}</td>
        </tr></tfoot>
      </table>
    </div>

    <div className="card" style={{marginTop:14,borderLeft:'4px solid var(--info)'}}>
      <div className="card-body" style={{fontSize:12,color:'var(--ink-2)',lineHeight:1.7}}>
        <b>How to read this:</b>
        <b> Books</b> = tax actually posted to your CGST/SGST/IGST output ledgers.
        <b> GSTR-1</b> = tax computed from your outward invoices (Sales − Credit Notes).
        <b> GSTR-3B (As Filed)</b> = what you reported on the portal (type it in to reconcile against your books).
        Books ≠ GSTR-1 usually means an <b>invoice carries tax that never hit the GST ledgers</b> (fix the voucher), or a manual JV moved the ledger.
        GSTR-1 ≠ As Filed means you <b>under/over-reported</b> - amend before the deadline.
      </div>
    </div>
  </>);
}

function GSTR1({data}){
  const [periodType, setPeriodType] = useState('monthly');
  const [month, setMonth] = useState(today().slice(0,7));
  const [quarter, setQuarter] = useState('Q4');
  const [activeTab, setActiveTab] = useState('b2b');

  const fyYear = parseInt((data.company.fyStart||'2025-04-01').slice(0,4));
  const quarters = {
    Q1:[`${fyYear}-04`,`${fyYear}-05`,`${fyYear}-06`],
    Q2:[`${fyYear}-07`,`${fyYear}-08`,`${fyYear}-09`],
    Q3:[`${fyYear}-10`,`${fyYear}-11`,`${fyYear}-12`],
    Q4:[`${fyYear+1}-01`,`${fyYear+1}-02`,`${fyYear+1}-03`],
  };
  const activePeriods = periodType==='monthly' ? [month] : (quarters[quarter]||[]);
  const periodLabel = periodType==='monthly' ? month : `${quarter} (${activePeriods[0]} – ${activePeriods[2]})`;

  const allSales = data.vouchers.filter(v =>
    v.status !== 'Cancelled' &&
    (v.type==='SAL'||v.type==='CRN'||v.type==='DBN') &&
    activePeriods.some(p => v.date.startsWith(p)) &&
    (v.items||[]).length > 0
  );
  const sales = allSales.filter(v => v.type==='SAL');
  const cdn   = allSales.filter(v => v.type==='CRN'||v.type==='DBN');

  const b2b = sales.filter(v => { const p=data.parties.find(x=>x.id===v.partyId); return p&&p.gstin&&!p.isForeign; });
  const exports_ = sales.filter(v => { const p=data.parties.find(x=>x.id===v.partyId); return p&&p.isForeign; });
  const b2cAll = sales.filter(v => { const p=data.parties.find(x=>x.id===v.partyId); return !p||(!p.gstin&&!p.isForeign); });
  const b2cl = b2cAll.filter(v => v.isInterState && (v.total||0)>B2CL_THRESHOLD);
  const b2cs = b2cAll.filter(v => !v.isInterState || (v.total||0)<=B2CL_THRESHOLD);
  const cdnr = cdn.filter(v => { const p=data.parties.find(x=>x.id===v.partyId); return p&&p.gstin; });
  const cdnur= cdn.filter(v => { const p=data.parties.find(x=>x.id===v.partyId); return !p||!p.gstin; });

  const r2 = n => Math.round((n||0)*100)/100;
  const posOf = (v) => { const p=data.parties.find(x=>x.id===v.partyId); return String(v.placeOfSupply||p?.stateCode||data.company.stateCode||'24').padStart(2,'0'); };
  // Split a voucher's items into per-GST-rate tax groups (offline tool reports one row per rate).
  const rateSplit = (v) => {
    const g = {};
    (v.items||[]).forEach(it => {
      const rate = +(it.gstRate||0), tx = (it.qty||0)*(it.rate||0);
      if(!g[rate]) g[rate] = {rate, txval:0, igst:0, cgst:0, sgst:0, cess:0, qty:0};
      g[rate].txval += tx; g[rate].qty += it.qty||0;
      const tax = tx*rate/100;
      if(v.isInterState||v.isExport) g[rate].igst += tax; else { g[rate].cgst += tax/2; g[rate].sgst += tax/2; }
    });
    return Object.values(g).map(x=>({...x, txval:r2(x.txval), igst:r2(x.igst), cgst:r2(x.cgst), sgst:r2(x.sgst)}));
  };

  // B2CS (7): aggregate by (POS, rate) - the level GST requires (not one lump).
  const b2csGroups = useMemo(() => {
    const m = {};
    b2cs.forEach(v => { const pos = posOf(v);
      rateSplit(v).forEach(rg => {
        const key = pos+'|'+rg.rate;
        if(!m[key]) m[key] = {pos, rate:rg.rate, sply_ty: v.isInterState?'INTER':'INTRA', typ:'OE', txval:0, igst:0, cgst:0, sgst:0, cess:0};
        m[key].txval=r2(m[key].txval+rg.txval); m[key].igst=r2(m[key].igst+rg.igst); m[key].cgst=r2(m[key].cgst+rg.cgst); m[key].sgst=r2(m[key].sgst+rg.sgst);
      });
    });
    return Object.values(m);
  }, [b2cs]);

  // HSN (12): aggregate by (HSN, rate) - split into B2B and B2C (new GSTR-1 format).
  const hsnAgg = (invs) => {
    const m = {};
    invs.forEach(v => { const inter = v.isInterState||v.isExport;
      (v.items||[]).forEach(it => {
        const rate=+(it.gstRate||0), hsn=it.hsn||'', tx=(it.qty||0)*(it.rate||0), tax=tx*rate/100;
        const key = hsn+'|'+rate;
        if(!m[key]) m[key]={hsn, desc:it.description||'', uqc:'NOS-NUMBERS', rate, qty:0, txval:0, igst:0, cgst:0, sgst:0, cess:0};
        m[key].qty+=it.qty||0; m[key].txval+=tx;
        if(inter) m[key].igst+=tax; else { m[key].cgst+=tax/2; m[key].sgst+=tax/2; }
      });
    });
    return Object.values(m).map(h=>({...h, txval:r2(h.txval), igst:r2(h.igst), cgst:r2(h.cgst), sgst:r2(h.sgst), val:r2(h.txval+h.igst+h.cgst+h.sgst)}));
  };
  const hsnB2B = useMemo(()=>hsnAgg(b2b.concat(exports_).concat(cdnr)), [b2b, exports_, cdnr]);
  const hsnB2C = useMemo(()=>hsnAgg(b2cl.concat(b2cs).concat(cdnur)), [b2cl, b2cs, cdnur]);
  // Combined HSN for the on-screen tab (existing display)
  const hsnSummary = {};
  hsnB2B.concat(hsnB2C).forEach(h => {
    const k=h.hsn||'NA'; if(!hsnSummary[k]) hsnSummary[k]={hsn:h.hsn||'NA',desc:h.desc,uqc:'NOS',qty:0,taxable:0,igst:0,cgst:0,sgst:0};
    hsnSummary[k].qty+=h.qty; hsnSummary[k].taxable+=h.txval; hsnSummary[k].igst+=h.igst; hsnSummary[k].cgst+=h.cgst; hsnSummary[k].sgst+=h.sgst;
  });

  // Nil / exempt / non-GST (8): 0% domestic supplies (informational bucket).
  const exemptTaxable = r2(b2cAll.concat(b2b).reduce((s,v)=> s + (v.isExport?0:(v.items||[]).filter(it=>+(it.gstRate||0)===0).reduce((t,it)=>t+(it.qty||0)*(it.rate||0),0)), 0));

  // Documents issued (13): serial range of outward invoices + credit/debit notes.
  const docRanges = (() => {
    const rng = (arr) => { const nums=arr.map(v=>v.number||'').filter(Boolean).sort(); return {from:nums[0]||'', to:nums[nums.length-1]||'', num:nums.length, cancelled:arr.filter(v=>v.status==='Cancelled').length}; };
    return [
      {nature:'Invoices for outward supply', ...rng(sales)},
      {nature:'Credit Note', ...rng(cdn.filter(v=>v.type==='CRN'))},
      {nature:'Debit Note', ...rng(cdn.filter(v=>v.type==='DBN'))},
    ].filter(d=>d.num>0);
  })();

  const sumField = (arr,f) => arr.reduce((s,v)=>s+(v[f]||0),0);
  const totalTaxable=sumField(sales,'taxable'), totalCgst=sumField(sales,'cgst'), totalSgst=sumField(sales,'sgst'), totalIgst=sumField(sales,'igst');

  const exportJSON = () => {
    const payload = {
      gstin: data.company.gstin,
      fp: activePeriods[activePeriods.length-1].replace('-',''),
      gt: r2(totalTaxable+totalCgst+totalSgst+totalIgst), cur_gt: r2(totalTaxable+totalCgst+totalSgst+totalIgst),
      b2b: b2b.map(v => {
        const p=data.parties.find(x=>x.id===v.partyId);
        return { ctin:p?.gstin||'', inv:[{
          inum:v.number||'', idt:fmtDate(v.date), val:r2(v.total||0),
          pos:posOf(v), rchrg:'N', inv_typ:'R',
          itms:rateSplit(v).map((rg,i)=>({num:i+1,itm_det:{rt:rg.rate,txval:rg.txval,igst:rg.igst,camt:rg.cgst,samt:rg.sgst,csamt:0}}))
        }]};
      }),
      b2cl: b2cl.map(v=>({pos:posOf(v), inv:[{inum:v.number||'',idt:fmtDate(v.date),val:r2(v.total||0),
        itms:rateSplit(v).map((rg,i)=>({num:i+1,itm_det:{rt:rg.rate,txval:rg.txval,igst:rg.igst,csamt:0}}))}]})),
      b2cs: b2csGroups.map(g=>({sply_ty:g.sply_ty, pos:g.pos, typ:'OE', rt:g.rate, txval:g.txval, igst:g.igst, camt:g.cgst, samt:g.sgst, csamt:0})),
      exp: exports_.map(v=>({exp_typ:'WOPAY',inv:[{inum:v.number||'',idt:fmtDate(v.date),val:r2(v.total||0),sbpcode:'',sbnum:'',sbdt:'',itms:[{txval:r2(v.taxable||0),rt:0,igst:0,csamt:0}]}]})),
      cdnr: cdnr.map(v=>{const p=data.parties.find(x=>x.id===v.partyId);return{ctin:p?.gstin||'',nt:[{ntty:v.type==='CRN'?'C':'D',nt_num:v.number||'',nt_dt:fmtDate(v.date),val:r2(v.total||0),pos:posOf(v),rchrg:'N',inv_typ:'R',itms:rateSplit(v).map((rg,i)=>({num:i+1,itm_det:{rt:rg.rate,txval:rg.txval,igst:rg.igst,camt:rg.cgst,samt:rg.sgst,csamt:0}}))}]};}),
      cdnur: cdnur.map(v=>({typ: v.isInterState?'B2CL':'B2CS', ntty:v.type==='CRN'?'C':'D', nt_num:v.number||'', nt_dt:fmtDate(v.date), val:r2(v.total||0), pos:posOf(v), itms:rateSplit(v).map((rg,i)=>({num:i+1,itm_det:{rt:rg.rate,txval:rg.txval,igst:rg.igst,camt:rg.cgst,samt:rg.sgst,csamt:0}}))})),
      hsn:{data:hsnB2B.concat(hsnB2C).map((h,i)=>({num:i+1,hsn_sc:h.hsn,desc:h.desc,uqc:'NOS',qty:h.qty,val:h.val,txval:h.txval,iamt:h.igst,camt:h.cgst,samt:h.sgst,csamt:0,rt:h.rate}))},
      nil:{ inv:[{sply_ty:'INTRB2C', expt_amt:exemptTaxable, nil_amt:0, ngsup_amt:0}] },
      doc_issue:{ doc_det:[{doc_num:1, docs:docRanges.map((d,i)=>({num:i+1,from:d.from,to:d.to,totnum:d.num,cancel:d.cancelled,net_issue:d.num-d.cancelled}))}] },
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=`GSTR1_${data.company.gstin}_${periodLabel.replace(/\s/g,'_')}.json`; a.click(); URL.revokeObjectURL(url);
  };

  // Export in the GST **offline-tool** workbook layout: one sheet per section with
  // the exact sheet names & column headers the Returns Offline Tool imports.
  const gd = iso => { const d=new Date(iso); const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return isNaN(d)? '' : `${String(d.getDate()).padStart(2,'0')}-${M[d.getMonth()]}-${d.getFullYear()}`; };
  const exportOfflineExcel = () => {
    const b2bRows=[]; b2b.forEach(v=>{ const p=data.parties.find(x=>x.id===v.partyId);
      rateSplit(v).forEach(rg=> b2bRows.push([p?.gstin||'', p?.name||v.partyName||'', v.number||'', gd(v.date), r2(v.total||0), posLabel(posOf(v)), 'N', '', 'Regular B2B', '', rg.rate, rg.txval, 0])); });
    const b2clRows=[]; b2cl.forEach(v=> rateSplit(v).forEach(rg=> b2clRows.push([v.number||'', gd(v.date), r2(v.total||0), posLabel(posOf(v)), '', rg.rate, rg.txval, 0, ''])));
    const b2csRows = b2csGroups.map(g=>['OE', posLabel(g.pos), '', g.rate, g.txval, 0, '']);
    const cdnrRows=[]; cdnr.forEach(v=>{ const p=data.parties.find(x=>x.id===v.partyId);
      rateSplit(v).forEach(rg=> cdnrRows.push([p?.gstin||'', p?.name||v.partyName||'', v.number||'', gd(v.date), v.type==='CRN'?'C':'D', posLabel(posOf(v)), 'N', 'Regular B2B', r2(v.total||0), '', rg.rate, rg.txval, 0])); });
    const cdnurRows=[]; cdnur.forEach(v=> rateSplit(v).forEach(rg=> cdnurRows.push([v.isInterState?'B2CL':'B2CS', v.number||'', gd(v.date), v.type==='CRN'?'C':'D', posLabel(posOf(v)), r2(v.total||0), '', rg.rate, rg.txval, 0])));
    const expRows=[]; exports_.forEach(v=> expRows.push(['WOPAY', v.number||'', gd(v.date), r2(v.total||0), '', '', '', 0, r2(v.taxable||0), 0]));
    const hsnRow = h => [h.hsn, h.desc, 'NOS-NUMBERS', h.qty, h.val, h.rate, h.txval, h.igst, h.cgst, h.sgst, 0];
    const docsRows = docRanges.map(d=>[d.nature, d.from, d.to, d.num, d.cancelled]);
    const H = {
      b2b:['GSTIN/UIN of Recipient','Receiver Name','Invoice Number','Invoice date','Invoice Value','Place Of Supply','Reverse Charge','Applicable % of Tax Rate','Invoice Type','E-Commerce GSTIN','Rate','Taxable Value','Cess Amount'],
      b2cl:['Invoice Number','Invoice date','Invoice Value','Place Of Supply','Applicable % of Tax Rate','Rate','Taxable Value','Cess Amount','E-Commerce GSTIN'],
      b2cs:['Type','Place Of Supply','Applicable % of Tax Rate','Rate','Taxable Value','Cess Amount','E-Commerce GSTIN'],
      cdnr:['GSTIN/UIN of Recipient','Receiver Name','Note Number','Note Date','Note Type','Place Of Supply','Reverse Charge','Note Supply Type','Note Value','Applicable % of Tax Rate','Rate','Taxable Value','Cess Amount'],
      cdnur:['UR Type','Note Number','Note Date','Note Type','Place Of Supply','Note Value','Applicable % of Tax Rate','Rate','Taxable Value','Cess Amount'],
      exp:['Export Type','Invoice Number','Invoice date','Invoice Value','Port Code','Shipping Bill Number','Shipping Bill Date','Rate','Taxable Value','Cess Amount'],
      exemp:['Description','Nil Rated Supplies','Exempted(other than nil rated/non GST supply)','Non-GST Supplies'],
      hsn:['HSN','Description','UQC','Total Quantity','Total Value','Rate','Taxable Value','Integrated Tax Amount','Central Tax Amount','State/UT Tax Amount','Cess Amount'],
      docs:['Nature of Document','Sr. No. From','Sr. No. To','Total Number','Cancelled'],
    };
    exportXLSX(`GSTR1_OfflineTool_${data.company.gstin}_${periodLabel.replace(/\s/g,'_')}.xlsx`, [
      {name:'b2b,sez,de', rows:[H.b2b, ...b2bRows]},
      {name:'b2cl',       rows:[H.b2cl, ...b2clRows]},
      {name:'b2cs',       rows:[H.b2cs, ...b2csRows]},
      {name:'cdnr',       rows:[H.cdnr, ...cdnrRows]},
      {name:'cdnur',      rows:[H.cdnur, ...cdnurRows]},
      {name:'exp',        rows:[H.exp, ...expRows]},
      {name:'exemp',      rows:[H.exemp, ['Inter-State supplies to unregistered persons', 0, exemptTaxable, 0]]},
      {name:'hsn(b2b)',   rows:[H.hsn, ...hsnB2B.map(hsnRow)]},
      {name:'hsn(b2c)',   rows:[H.hsn, ...hsnB2C.map(hsnRow)]},
      {name:'docs',       rows:[H.docs, ...docsRows]},
    ]);
  };

  const tabs=[
    {id:'b2b',label:`4A B2B (${b2b.length})`},
    {id:'b2cl',label:`5 B2CL (${b2cl.length})`},
    {id:'exports',label:`6A Exports (${exports_.length})`},
    {id:'b2cs',label:`7 B2CS (${b2cs.length})`},
    {id:'cdn',label:`9B CDN (${cdn.length})`},
    {id:'hsn',label:'12 HSN'},
    {id:'summary',label:'Summary'},
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">GSTR-1</h1>
          <div className="page-sub">Outward supplies return · {periodLabel} · GSTIN: {data.company.gstin}</div>
        </div>
        <div className="page-actions">
          <select value={periodType} onChange={e=>setPeriodType(e.target.value)} className="btn" style={{padding:'6px 10px'}}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly (QRMP)</option>
          </select>
          {periodType==='monthly'
            ? <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
            : <select value={quarter} onChange={e=>setQuarter(e.target.value)} className="btn" style={{padding:'6px 10px'}}>
                <option value="Q1">Q1 Apr–Jun</option><option value="Q2">Q2 Jul–Sep</option>
                <option value="Q3">Q3 Oct–Dec</option><option value="Q4">Q4 Jan–Mar</option>
              </select>}
          <button className="btn" onClick={()=>window.print()}>⎙ Print</button>
          <button className="btn" onClick={exportOfflineExcel} title="Multi-sheet workbook matching the GST Returns Offline Tool (b2b, b2cl, b2cs, cdnr, cdnur, exp, hsn, docs)">⬇ Offline-Tool Excel</button>
          <button className="btn btn-primary" onClick={exportJSON}>⬇ Export JSON</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Total Invoices</div><div className="stat-value">{sales.length}</div></div>
        <div className="stat stat-info"><div className="stat-label">B2B (Registered)</div><div className="stat-value">{b2b.length}</div></div>
        <div className="stat stat-gold"><div className="stat-label">B2C (Unregistered)</div><div className="stat-value">{b2cl.length+b2cs.length}</div></div>
        <div className="stat"><div className="stat-label">Exports</div><div className="stat-value">{exports_.length}</div></div>
        <div className="stat stat-info"><div className="stat-label">Total Taxable Value</div><div className="stat-value rupee">₹{fmt(totalTaxable)}</div></div>
        <div className="stat stat-gold"><div className="stat-label">Total Tax (CGST+SGST+IGST)</div><div className="stat-value rupee">₹{fmt(totalCgst+totalSgst+totalIgst)}</div></div>
        <div className="stat"><div className="stat-label">CDN Issued</div><div className="stat-value">{cdn.length}</div></div>
        <div className="stat"><div className="stat-label">Invoice Value</div><div className="stat-value rupee">₹{fmt(totalTaxable+totalCgst+totalSgst+totalIgst)}</div></div>
      </div>

      <div className="tabs">{tabs.map(t=><div key={t.id} className={'tab'+(activeTab===t.id?' active':'')} onClick={()=>setActiveTab(t.id)}>{t.label}</div>)}</div>

      {activeTab==='b2b' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Table 4A  B2B Regular Invoices (Registered Recipients)</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>GSTIN of Recipient</th><th>Receiver Name</th><th>Invoice No.</th><th>Date</th><th>Place of Supply</th><th>Rev.Charge</th><th className="num">Invoice Value</th><th className="num">Taxable (₹)</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th></tr></thead>
            <tbody>
              {b2b.length===0 ? <tr><td colSpan="11"><div className="empty">No B2B invoices in this period</div></td></tr> :
              b2b.map(v=>{ const p=data.parties.find(x=>x.id===v.partyId); return(
                <tr key={v.id}>
                  <td style={{fontFamily:'var(--mono)',fontSize:11}}>{p?.gstin||''}</td>
                  <td>{p?.name||v.partyName}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{v.number}</td>
                  <td>{fmtDate(v.date)}</td>
                  <td>{v.placeOfSupply||p?.stateCode}</td>
                  <td><span className="badge badge-muted">N</span></td>
                  <td className="num">{fmt(v.total||0)}</td>
                  <td className="num">{fmt(v.taxable||0)}</td>
                  <td className="num">{fmt(v.igst||0)}</td>
                  <td className="num">{fmt(v.cgst||0)}</td>
                  <td className="num">{fmt(v.sgst||0)}</td>
                </tr>
              );})}
              {b2b.length>0&&<tr className="subtotal"><td colSpan="7">Total ({b2b.length} invoices)</td><td className="num">{fmt(sumField(b2b,'taxable'))}</td><td className="num">{fmt(sumField(b2b,'igst'))}</td><td className="num">{fmt(sumField(b2b,'cgst'))}</td><td className="num">{fmt(sumField(b2b,'sgst'))}</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='b2cl' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Table 5  B2CL (Large)  Unregistered, Inter-State, Invoice Value &gt; ₹2.5 Lakh</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Invoice No.</th><th>Date</th><th>Place of Supply</th><th className="num">Invoice Value</th><th className="num">Taxable (₹)</th><th className="num">IGST</th><th className="num">Cess</th></tr></thead>
            <tbody>
              {b2cl.length===0 ? <tr><td colSpan="7"><div className="empty">No large inter-state B2C invoices in this period (requires value &gt; ₹2.5L)</div></td></tr> :
              b2cl.map(v=>(
                <tr key={v.id}><td style={{fontFamily:'var(--mono)'}}>{v.number}</td><td>{fmtDate(v.date)}</td><td>{v.placeOfSupply}</td>
                  <td className="num">{fmt(v.total||0)}</td><td className="num">{fmt(v.taxable||0)}</td><td className="num">{fmt(v.igst||0)}</td><td className="num">0.00</td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='exports' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Table 6A  Exports (With / Without Payment of Tax)</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Export Type</th><th>Invoice No.</th><th>Date</th><th className="num">Invoice Value (₹)</th><th className="num">Taxable (₹)</th><th className="num">IGST Paid</th><th>Shipping Bill</th><th>SB Date</th><th>Port Code</th></tr></thead>
            <tbody>
              {exports_.length===0 ? <tr><td colSpan="9"><div className="empty">No exports in this period</div></td></tr> :
              exports_.map(v=>(
                <tr key={v.id}><td><span className="badge badge-info">EXPWOP</span></td><td style={{fontFamily:'var(--mono)'}}>{v.number}</td><td>{fmtDate(v.date)}</td>
                  <td className="num">{fmt(v.total||0)}</td><td className="num">{fmt(v.taxable||0)}</td><td className="num">0.00</td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='b2cs' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Table 7  B2CS (Others)  Supplies to Unregistered Persons (Rate-wise)</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Type</th><th>Place of Supply</th><th className="num">Rate (%)</th><th className="num">Taxable Value</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">Cess</th></tr></thead>
            <tbody>
              {b2cs.length===0 ? <tr><td colSpan="8"><div className="empty">No B2CS supplies in this period</div></td></tr> :
              (() => {
                const g={};
                b2cs.forEach(v=>(v.items||[]).forEach(it=>{
                  const pos=v.placeOfSupply||data.company.stateCode||'24', key=pos+'|'+(it.gstRate||0);
                  if(!g[key]) g[key]={pos,rate:it.gstRate||0,taxable:0,igst:0,cgst:0,sgst:0};
                  const t=(it.qty||0)*(it.rate||0),tax=t*(it.gstRate||0)/100;
                  g[key].taxable+=t;
                  if(v.isInterState) g[key].igst+=tax; else {g[key].cgst+=tax/2;g[key].sgst+=tax/2;}
                }));
                return Object.values(g).map((r,i)=>(
                  <tr key={i}><td>OE</td><td>{r.pos}</td><td className="num">{r.rate}%</td>
                    <td className="num">{fmt(r.taxable)}</td><td className="num">{fmt(r.igst)}</td>
                    <td className="num">{fmt(r.cgst)}</td><td className="num">{fmt(r.sgst)}</td><td className="num">0.00</td></tr>
                ));
              })()}
              {b2cs.length>0&&<tr className="subtotal"><td colSpan="3">Total ({b2cs.length} invoices)</td><td className="num">{fmt(sumField(b2cs,'taxable'))}</td><td className="num">{fmt(sumField(b2cs,'igst'))}</td><td className="num">{fmt(sumField(b2cs,'cgst'))}</td><td className="num">{fmt(sumField(b2cs,'sgst'))}</td><td className="num">0.00</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='cdn' && (
        <>
          <div className="card" style={{marginBottom:14}}>
            <div className="card-head"><h3 className="card-title">Table 9B  Credit/Debit Notes (Registered)  CDNR</h3></div>
            <div style={{overflow:'auto'}}><table>
              <thead><tr><th>GSTIN of Recipient</th><th>Note Type</th><th>Note No.</th><th>Note Date</th><th>Against Invoice</th><th>Supply Type</th><th className="num">Note Value</th><th className="num">Taxable</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th></tr></thead>
              <tbody>
                {cdnr.length===0 ? <tr><td colSpan="11"><div className="empty">No registered CDN in this period</div></td></tr> :
                cdnr.map(v=>{const p=data.parties.find(x=>x.id===v.partyId);return(
                  <tr key={v.id}>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{p?.gstin}</td>
                    <td><span className={'badge '+(v.type==='CRN'?'badge-danger':'badge-info')}>{v.type==='CRN'?'Credit Note':'Debit Note'}</span></td>
                    <td style={{fontFamily:'var(--mono)'}}>{v.number}</td><td>{fmtDate(v.date)}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{v.originalInvoiceNumber ? v.originalInvoiceNumber+' · '+fmtDate(v.originalInvoiceDate) : <span style={{color:'var(--ink-3)',fontStyle:'italic'}}>Self</span>}</td>
                    <td>{v.isInterState?'Inter-State':'Intra-State'}</td>
                    <td className="num">{fmt(v.total||0)}</td><td className="num">{fmt(v.taxable||0)}</td>
                    <td className="num">{fmt(v.igst||0)}</td><td className="num">{fmt(v.cgst||0)}</td><td className="num">{fmt(v.sgst||0)}</td>
                  </tr>
                );})}
              </tbody>
            </table></div>
          </div>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Table 9B  Credit/Debit Notes (Unregistered)  CDNUR</h3></div>
            <div style={{overflow:'auto'}}><table>
              <thead><tr><th>UR Type</th><th>Note Type</th><th>Note No.</th><th>Date</th><th>Place of Supply</th><th className="num">Note Value</th><th className="num">Taxable</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th></tr></thead>
              <tbody>
                {cdnur.length===0 ? <tr><td colSpan="10"><div className="empty">No unregistered CDN in this period</div></td></tr> :
                cdnur.map(v=>(
                  <tr key={v.id}><td>B2CL</td>
                    <td><span className={'badge '+(v.type==='CRN'?'badge-danger':'badge-info')}>{v.type==='CRN'?'Credit Note':'Debit Note'}</span></td>
                    <td style={{fontFamily:'var(--mono)'}}>{v.number}</td><td>{fmtDate(v.date)}</td><td>{v.placeOfSupply}</td>
                    <td className="num">{fmt(v.total||0)}</td><td className="num">{fmt(v.taxable||0)}</td>
                    <td className="num">{fmt(v.igst||0)}</td><td className="num">{fmt(v.cgst||0)}</td><td className="num">{fmt(v.sgst||0)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {activeTab==='hsn' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Table 12  HSN/SAC-Wise Summary of Outward Supplies</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>HSN/SAC</th><th>Description</th><th>UQC</th><th className="num">Total Qty</th><th className="num">Total Value</th><th className="num">Taxable Value</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">Cess</th></tr></thead>
            <tbody>
              {Object.values(hsnSummary).length===0 ? <tr><td colSpan="10"><div className="empty">No HSN data in this period</div></td></tr> :
              Object.values(hsnSummary).map(h=>(
                <tr key={h.hsn}><td style={{fontFamily:'var(--mono)'}}>{h.hsn}</td><td>{h.desc}</td><td>{h.uqc}</td>
                  <td className="num">{fmt(h.qty,2)}</td><td className="num">{fmt(h.taxable+h.igst+h.cgst+h.sgst)}</td>
                  <td className="num">{fmt(h.taxable)}</td><td className="num">{fmt(h.igst)}</td>
                  <td className="num">{fmt(h.cgst)}</td><td className="num">{fmt(h.sgst)}</td><td className="num">0.00</td></tr>
              ))}
              {Object.values(hsnSummary).length>0&&<tr className="subtotal"><td colSpan="5">Total</td>
                <td className="num">{fmt(Object.values(hsnSummary).reduce((s,h)=>s+h.taxable,0))}</td>
                <td className="num">{fmt(Object.values(hsnSummary).reduce((s,h)=>s+h.igst,0))}</td>
                <td className="num">{fmt(Object.values(hsnSummary).reduce((s,h)=>s+h.cgst,0))}</td>
                <td className="num">{fmt(Object.values(hsnSummary).reduce((s,h)=>s+h.sgst,0))}</td>
                <td className="num">0.00</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='summary' && (
        <div className="report">
          <div className="report-head">
            {data.company.logo&&<img className="report-logo" src={data.company.logo} alt="Logo" />}
            <div className="report-co">{data.company.name}</div>
            <div style={{fontSize:11,color:'var(--ink-3)'}}>GSTIN: {data.company.gstin} · PAN: {data.company.pan}</div>
            <div className="report-title">FORM GSTR-1  Summary</div>
            <div className="report-period">Period: {periodLabel} · FY {fyYear}-{String(fyYear+1).slice(2)}</div>
          </div>
          <table style={{marginBottom:14}}>
            <thead><tr><th>Table</th><th>Description</th><th className="num">No. of Records</th><th className="num">Taxable Value (₹)</th><th className="num">IGST (₹)</th><th className="num">CGST (₹)</th><th className="num">SGST (₹)</th></tr></thead>
            <tbody>
              <tr><td>4A</td><td>B2B Regular (Registered)</td><td className="num">{b2b.length}</td><td className="num">{fmt(sumField(b2b,'taxable'))}</td><td className="num">{fmt(sumField(b2b,'igst'))}</td><td className="num">{fmt(sumField(b2b,'cgst'))}</td><td className="num">{fmt(sumField(b2b,'sgst'))}</td></tr>
              <tr><td>5</td><td>B2CL (Large  Unregistered, Inter-State &gt;₹2.5L)</td><td className="num">{b2cl.length}</td><td className="num">{fmt(sumField(b2cl,'taxable'))}</td><td className="num">{fmt(sumField(b2cl,'igst'))}</td><td className="num"></td><td className="num"></td></tr>
              <tr><td>6A</td><td>Exports (EXPWOP / EXPWP)</td><td className="num">{exports_.length}</td><td className="num">{fmt(sumField(exports_,'taxable'))}</td><td className="num">0.00</td><td className="num"></td><td className="num"></td></tr>
              <tr><td>7</td><td>B2CS (Others  Unregistered, Small)</td><td className="num">{b2cs.length}</td><td className="num">{fmt(sumField(b2cs,'taxable'))}</td><td className="num">{fmt(sumField(b2cs,'igst'))}</td><td className="num">{fmt(sumField(b2cs,'cgst'))}</td><td className="num">{fmt(sumField(b2cs,'sgst'))}</td></tr>
              <tr><td>9B</td><td>Credit/Debit Notes (CDNR + CDNUR)</td><td className="num">{cdn.length}</td><td className="num neg">{fmt(sumField(cdn,'taxable'))}</td><td className="num neg">{fmt(sumField(cdn,'igst'))}</td><td className="num neg">{fmt(sumField(cdn,'cgst'))}</td><td className="num neg">{fmt(sumField(cdn,'sgst'))}</td></tr>
              <tr className="total"><td colSpan="2"><b>Total Liability (Outward Supplies other than Reverse Charge)</b></td><td className="num">{sales.length}</td><td className="num">₹{fmt(totalTaxable)}</td><td className="num">₹{fmt(totalIgst)}</td><td className="num">₹{fmt(totalCgst)}</td><td className="num">₹{fmt(totalSgst)}</td></tr>
            </tbody>
          </table>
          <div className="report-foot">
            <span>Verification: I hereby solemnly affirm and declare that the information given herein is true and correct to the best of my knowledge and belief.</span>
            <span>For {data.company.name}  Authorised Signatory</span>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// GSTR-3B  Full Implementation
// ============================================================================
function GSTR3B({data, balances}){
  const [periodType, setPeriodType] = useState('monthly');
  const [month, setMonth] = useState(today().slice(0,7));
  const [quarter, setQuarter] = useState('Q4');

  const fyYear = parseInt((data.company.fyStart||'2025-04-01').slice(0,4));
  const quarters = {
    Q1:[`${fyYear}-04`,`${fyYear}-05`,`${fyYear}-06`],
    Q2:[`${fyYear}-07`,`${fyYear}-08`,`${fyYear}-09`],
    Q3:[`${fyYear}-10`,`${fyYear}-11`,`${fyYear}-12`],
    Q4:[`${fyYear+1}-01`,`${fyYear+1}-02`,`${fyYear+1}-03`],
  };
  const activePeriods = periodType==='monthly' ? [month] : (quarters[quarter]||[]);
  const periodLabel = periodType==='monthly' ? month : `${quarter} FY${fyYear}-${String(fyYear+1).slice(2)}`;

  const sales = data.vouchers.filter(v => v.status!=='Cancelled' && (v.type==='SAL'||v.type==='CRN') && activePeriods.some(p=>v.date.startsWith(p)));
  const purchases = data.vouchers.filter(v => v.status!=='Cancelled' && (v.type==='PUR'||v.type==='DBN') && activePeriods.some(p=>v.date.startsWith(p)));

  // 3.1 Outward supplies (net of credit notes)
  const sign = v => v.type==='CRN' ? -1 : 1;
  const taxableSales = sales.reduce((s,v)=>s+sign(v)*(v.taxable||0),0);
  const outCgst = sales.reduce((s,v)=>s+sign(v)*(v.cgst||0),0);
  const outSgst = sales.reduce((s,v)=>s+sign(v)*(v.sgst||0),0);
  const outIgst = sales.reduce((s,v)=>s+sign(v)*(v.igst||0),0);
  const zeroRated = sales.filter(v=>{ const p=data.parties.find(x=>x.id===v.partyId); return p?.isForeign; }).reduce((s,v)=>s+(v.taxable||0),0);
  const taxableOther = Math.max(0, taxableSales - zeroRated);

  // 3.2 Interstate supplies breakdown
  const interStateUnreg = sales.filter(v=>v.isInterState&&v.type!=='CRN'&&(()=>{const p=data.parties.find(x=>x.id===v.partyId);return !p||!p.gstin;})());

  // Period ledger movements (needed for ledger-based ITC)
  const periodStart = activePeriods[0] + '-01';
  const lastP = activePeriods[activePeriods.length-1];
  const periodEnd = lastP + '-' + String(new Date(parseInt(lastP.slice(0,4)), parseInt(lastP.slice(5,7)), 0).getDate()).padStart(2,'0');
  const pbLedger = useMemo(() => computePeriodBals(data, periodStart, periodEnd), [data, periodStart, periodEnd]);
  const ledgerMv = (id, isOutput) => isOutput ? -(pbLedger.period[id]||0) : (pbLedger.period[id]||0);

  // 4. ITC available = INPUT GST LEDGER movements for the period.
  // This is the legally claimable ITC - it includes input GST on PURCHASES *and*
  // on expenses (rent, professional fees, telephone, repairs with GST), which are
  // posted via Payment/Journal vouchers. Restricting ITC to purchase invoices
  // alone understates the claim and causes a false books-vs-return mismatch.
  const itcIgst = ledgerMv('2602', false);
  const itcCgst = ledgerMv('2600', false);
  const itcSgst = ledgerMv('2601', false);
  // Invoice-only ITC (PUR/DBN vouchers) - for the data-quality reconciliation below
  const signP = v => v.type==='DBN' ? -1 : 1;
  const itcCgstInv = purchases.reduce((s,v)=>s+signP(v)*(v.cgst||0),0);
  const itcSgstInv = purchases.reduce((s,v)=>s+signP(v)*(v.sgst||0),0);
  const itcIgstInv = purchases.reduce((s,v)=>s+signP(v)*(v.igst||0),0);

  // ITC set-off order per Rule 88A / Sec 49A & 49B (IGST credit fully first, then
  // CGST/SGST against own head, then IGST):
  //   IGST ITC → IGST liab, then CGST, then SGST
  //   CGST ITC → CGST liab, then IGST · SGST ITC → SGST liab, then IGST
  let liabIgst=Math.max(0,outIgst), liabCgst=Math.max(0,outCgst), liabSgst=Math.max(0,outSgst);
  let remIgst=itcIgst, remCgst=itcCgst, remSgst=itcSgst;

  const use=(liab,avail)=>{const u=Math.min(liab,avail);return{used:u,rem:avail-u,liabLeft:liab-u};};
  let r;
  r=use(liabIgst,remIgst); const igstFromIgst=r.used; liabIgst=r.liabLeft; remIgst=r.rem;
  r=use(liabCgst,remIgst); const cgstFromIgst=r.used; liabCgst=r.liabLeft; remIgst=r.rem;
  r=use(liabSgst,remIgst); const sgstFromIgst=r.used; liabSgst=r.liabLeft; remIgst=r.rem;
  r=use(liabCgst,remCgst); const cgstFromCgst=r.used; liabCgst=r.liabLeft; remCgst=r.rem;
  r=use(liabIgst,remCgst); const igstFromCgst=r.used; liabIgst=r.liabLeft; remCgst=r.rem;
  r=use(liabSgst,remSgst); const sgstFromSgst=r.used; liabSgst=r.liabLeft; remSgst=r.rem;
  r=use(liabIgst,remSgst); const igstFromSgst=r.used; liabIgst=r.liabLeft; remSgst=r.rem;

  const cashIgst=liabIgst, cashCgst=liabCgst, cashSgst=liabSgst;
  const totalCash=cashIgst+cashCgst+cashSgst;
  const itcUsedIgst=igstFromIgst+igstFromCgst+igstFromSgst, itcUsedCgst=cgstFromIgst+cgstFromCgst, itcUsedSgst=sgstFromIgst+sgstFromSgst;
  const itcBalIgst=remIgst, itcBalCgst=remCgst, itcBalSgst=remSgst;   // carry-forward credit

  // ── Books reconciliation: invoices vs ledger ──
  // Output: invoice tax must equal output-GST ledger (else a sale was posted as JV).
  // ITC: ledger ≥ purchase-invoice ITC is NORMAL (the excess is expense ITC).
  const reconRows = [
    {label:'Output CGST', kind:'output', ledger:ledgerMv('1310',true), inv:Math.max(0,outCgst)},
    {label:'Output SGST', kind:'output', ledger:ledgerMv('1311',true), inv:Math.max(0,outSgst)},
    {label:'Output IGST', kind:'output', ledger:ledgerMv('1312',true), inv:Math.max(0,outIgst)},
    {label:'ITC - CGST Input', kind:'itc', ledger:ledgerMv('2600',false), inv:itcCgstInv},
    {label:'ITC - SGST Input', kind:'itc', ledger:ledgerMv('2601',false), inv:itcSgstInv},
    {label:'ITC - IGST Input', kind:'itc', ledger:ledgerMv('2602',false), inv:itcIgstInv},
  ].map(r => {
    const diff = r.ledger - r.inv;   // +ve for ITC = expense ITC (good); for output should be 0
    const isError = r.kind==='output' ? Math.abs(diff) >= 1 : diff < -1; // ITC: invoice exceeding ledger = error
    return {...r, diff, isError, expenseITC: r.kind==='itc' && diff > 1 ? diff : 0};
  });
  const reconOk = reconRows.every(r => !r.isError);
  const totalExpenseITC = reconRows.reduce((s,r)=>s+(r.expenseITC||0),0);

  const row3=(label,taxable,igst,cgst,sgst,cess=0)=>(
    <tr><td>{label}</td><td className="num">{fmt(taxable)}</td><td className="num">{fmt(igst)}</td><td className="num">{fmt(cgst)}</td><td className="num">{fmt(sgst)}</td><td className="num">{fmt(cess)}</td></tr>
  );

  // GSTN portal offline-utility JSON for GSTR-3B
  const exportJSON3B = () => {
    const lastM = activePeriods[activePeriods.length-1];           // YYYY-MM
    const r2 = n => Math.round(n*100)/100;
    const payload = {
      gstin: data.company.gstin,
      ret_period: lastM.slice(5,7) + lastM.slice(0,4),             // MMYYYY
      sup_details: {
        osup_det:      { txval:r2(taxableOther), iamt:r2(Math.max(0,outIgst)), camt:r2(Math.max(0,outCgst)), samt:r2(Math.max(0,outSgst)), csamt:0 },
        osup_zero:     { txval:r2(zeroRated), iamt:0, csamt:0 },
        osup_nil_exmp: { txval:0 },
        isup_rev:      { txval:0, iamt:0, camt:0, samt:0, csamt:0 },
        osup_nongst:   { txval:0 },
      },
      inter_sup: {
        unreg_details: interStateUnreg.map(v=>({pos:v.placeOfSupply||'', txval:r2(v.taxable||0), iamt:r2(v.igst||0)})),
        comp_details: [], uin_details: [],
      },
      itc_elg: {
        itc_avl: [{ ty:'OTH', iamt:r2(itcIgst), camt:r2(itcCgst), samt:r2(itcSgst), csamt:0 }],
        itc_rev: [], itc_net:{ iamt:r2(itcIgst), camt:r2(itcCgst), samt:r2(itcSgst), csamt:0 }, itc_inelg: [],
      },
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=`GSTR3B_${data.company.gstin}_${payload.ret_period}.json`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">GSTR-3B</h1>
          <div className="page-sub">Summary return · {periodLabel} · GSTIN: {data.company.gstin}</div>
        </div>
        <div className="page-actions">
          <select value={periodType} onChange={e=>setPeriodType(e.target.value)} className="btn" style={{padding:'6px 10px'}}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly (QRMP)</option>
          </select>
          {periodType==='monthly'
            ? <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
            : <select value={quarter} onChange={e=>setQuarter(e.target.value)} className="btn" style={{padding:'6px 10px'}}>
                <option value="Q1">Q1 Apr–Jun</option><option value="Q2">Q2 Jul–Sep</option>
                <option value="Q3">Q3 Oct–Dec</option><option value="Q4">Q4 Jan–Mar</option>
              </select>}
          <button className="btn" onClick={()=>window.print()}>⎙ Print</button>
          <button className="btn btn-primary" onClick={exportJSON3B}>⬇ Export JSON</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat stat-info"><div className="stat-label">Output Tax Liability</div><div className="stat-value rupee">₹{fmt(Math.max(0,outCgst)+Math.max(0,outSgst)+Math.max(0,outIgst))}</div></div>
        <div className="stat stat-gold"><div className="stat-label">ITC Available</div><div className="stat-value rupee">₹{fmt(itcIgst+itcCgst+itcSgst)}</div></div>
        <div className="stat"><div className="stat-label">ITC Utilised</div><div className="stat-value rupee">₹{fmt(itcUsedIgst+itcUsedCgst+itcUsedSgst)}</div></div>
        <div className="stat stat-danger"><div className="stat-label">Net Cash to Pay</div><div className="stat-value rupee">₹{fmt(totalCash)}</div></div>
      </div>

      {/* Books reconciliation: invoices vs ledger */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 className="card-title">⚖ GST Books Reconciliation - {periodLabel}</h3>
          {reconOk
            ? <span className="badge badge-success">✓ Reconciled</span>
            : <span className="badge badge-danger">⚠ Error - check entries</span>}
        </div>
        <div className="card-body" style={{padding:0,overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
              <th style={{padding:'9px 16px',textAlign:'left'}}>Particulars</th>
              <th style={{padding:'9px 16px',textAlign:'right',width:150}}>Per Invoices (₹)</th>
              <th style={{padding:'9px 16px',textAlign:'right',width:150}}>Per Ledger (₹)</th>
              <th style={{padding:'9px 16px',textAlign:'right',width:170}}>Difference (₹)</th>
            </tr></thead>
            <tbody>
              {reconRows.map(r=>(
                <tr key={r.label} style={{borderBottom:'1px solid var(--line-2)',
                  background:r.isError?'#fdecea':r.expenseITC?'#e8f5e9':'transparent'}}>
                  <td style={{padding:'8px 16px'}}>{r.label}</td>
                  <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(r.inv)}</td>
                  <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(r.ledger)}</td>
                  <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600,
                    color:r.isError?'var(--danger)':r.expenseITC?'var(--primary)':'var(--primary)'}}>
                    {r.isError ? fmt(r.diff)
                      : r.expenseITC ? '+'+fmt(r.expenseITC)+' ITC on expenses'
                      : '✓ 0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)',borderTop:'1px solid var(--line-2)'}}>
          {reconOk
            ? <>✓ Output tax matches invoices.{totalExpenseITC>0 ? <> Ledger ITC is ₹{fmt(totalExpenseITC)} higher than purchase invoices - this is <b>input GST on expenses</b> (rent, professional fees, telephone, repairs), which is legitimately claimable.</> : ''}</>
            : <>⚠ An <b>output-tax</b> difference means a sale was posted as a Journal (bypassing GST ledgers), or ITC in a purchase invoice did not hit the input-GST ledger. Check the period's JV entries.</>}
        </div>
      </div>

      <div className="report">
        <div className="report-head">
          {data.company.logo&&<img className="report-logo" src={data.company.logo} alt="Logo" />}
          <div className="report-co">{data.company.name}</div>
          <div style={{fontSize:11,color:'var(--ink-3)'}}>GSTIN: {data.company.gstin}</div>
          <div className="report-title">Form GSTR-3B</div>
          <div className="report-period">Return for: {periodLabel}</div>
        </div>

        <h3 style={{fontFamily:'var(--serif)',marginTop:20,marginBottom:8}}>3.1 Details of Outward Supplies & Inward Supplies Liable to Reverse Charge</h3>
        <table style={{marginBottom:16}}>
          <thead><tr><th>Nature of Supplies</th><th className="num">Total Taxable Value</th><th className="num">Integrated Tax</th><th className="num">Central Tax</th><th className="num">State/UT Tax</th><th className="num">Cess</th></tr></thead>
          <tbody>
            {row3('(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', taxableOther, outIgst, outCgst, outSgst)}
            {row3('(b) Outward taxable supplies (zero rated)', zeroRated, 0, 0, 0)}
            {row3('(c) Other outward supplies (Nil rated, Exempted)', 0, 0, 0, 0)}
            {row3('(d) Inward supplies (liable to Reverse Charge)', 0, 0, 0, 0)}
            {row3('(e) Non-GST outward supplies', 0, 0, 0, 0)}
          </tbody>
        </table>

        <h3 style={{fontFamily:'var(--serif)',marginTop:16,marginBottom:8}}>3.2 Out of Supplies in 3.1(a)  Details of Inter-State Supplies Made</h3>
        <table style={{marginBottom:16}}>
          <thead><tr><th>Nature of Supplies</th><th className="num">Total Taxable Value</th><th className="num">Integrated Tax</th></tr></thead>
          <tbody>
            <tr><td>Supplies made to Unregistered Persons</td><td className="num">{fmt(interStateUnreg.reduce((s,v)=>s+(v.taxable||0),0))}</td><td className="num">{fmt(interStateUnreg.reduce((s,v)=>s+(v.igst||0),0))}</td></tr>
            <tr><td>Supplies made to Composition Taxable Persons</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr><td>Supplies made to UIN Holders</td><td className="num">0.00</td><td className="num">0.00</td></tr>
          </tbody>
        </table>

        <h3 style={{fontFamily:'var(--serif)',marginTop:16,marginBottom:8}}>4. Eligible ITC</h3>
        <table style={{marginBottom:16}}>
          <thead><tr><th>Details</th><th className="num">Integrated Tax</th><th className="num">Central Tax</th><th className="num">State/UT Tax</th><th className="num">Cess</th></tr></thead>
          <tbody>
            <tr><td colSpan="5" style={{fontWeight:600,background:'var(--surface-2)',padding:'8px 12px'}}>A. ITC Available (whether in full or part)</td></tr>
            <tr><td style={{paddingLeft:28}}>(1) Import of goods</td><td className="num">0.00</td><td className="num"></td><td className="num"></td><td className="num">0.00</td></tr>
            <tr><td style={{paddingLeft:28}}>(2) Import of services</td><td className="num">0.00</td><td className="num"></td><td className="num"></td><td className="num">0.00</td></tr>
            <tr><td style={{paddingLeft:28}}>(3) Inward supplies liable to reverse charge (other than 1 & 2 above)</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr><td style={{paddingLeft:28}}>(4) Inward supplies from ISD</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr style={{fontWeight:600}}><td style={{paddingLeft:28}}>(5) All other ITC (Purchase Register)</td><td className="num">{fmt(itcIgst)}</td><td className="num">{fmt(itcCgst)}</td><td className="num">{fmt(itcSgst)}</td><td className="num">0.00</td></tr>
            <tr><td colSpan="5" style={{fontWeight:600,background:'var(--surface-2)',padding:'8px 12px'}}>B. ITC Reversed</td></tr>
            <tr><td style={{paddingLeft:28}}>(1) As per rules 38, 42 & 43 of CGST Rules and section 17(5)</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr><td style={{paddingLeft:28}}>(2) Others</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr style={{fontWeight:700,background:'var(--primary-soft)',color:'var(--primary)'}}><td>(C) Net ITC Available (A − B)</td><td className="num">{fmt(itcIgst)}</td><td className="num">{fmt(itcCgst)}</td><td className="num">{fmt(itcSgst)}</td><td className="num">0.00</td></tr>
          </tbody>
        </table>

        <h3 style={{fontFamily:'var(--serif)',marginTop:16,marginBottom:8}}>5. Values of Exempt, Nil-Rated and Non-GST Inward Supplies</h3>
        <table style={{marginBottom:16}}>
          <thead><tr><th>Nature of Supplies</th><th className="num">Inter-State Supplies</th><th className="num">Intra-State Supplies</th></tr></thead>
          <tbody>
            <tr><td>From a supplier under composition scheme, Exempt, Nil rated supply</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr><td>Non-GST supply</td><td className="num">0.00</td><td className="num">0.00</td></tr>
          </tbody>
        </table>

        <h3 style={{fontFamily:'var(--serif)',marginTop:16,marginBottom:8}}>5.1 Interest and Late Fee for Previous Tax Period</h3>
        <table style={{marginBottom:16}}>
          <thead><tr><th>Details</th><th className="num">Integrated Tax</th><th className="num">Central Tax</th><th className="num">State/UT Tax</th><th className="num">Cess</th></tr></thead>
          <tbody>
            <tr><td>Interest Paid</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td><td className="num">0.00</td></tr>
            <tr><td>Late Fee</td><td className="num"></td><td className="num">0.00</td><td className="num">0.00</td><td className="num"></td></tr>
          </tbody>
        </table>

        <h3 style={{fontFamily:'var(--serif)',marginTop:16,marginBottom:8}}>6.1 Payment of Tax</h3>
        <table style={{marginBottom:16}}>
          <thead>
            <tr><th>Description</th><th className="num">Tax Payable</th><th className="num">ITC (IGST)</th><th className="num">ITC (CGST)</th><th className="num">ITC (SGST)</th><th className="num">Tax Paid in Cash</th></tr>
          </thead>
          <tbody>
            <tr><td><b>Integrated Tax (IGST)</b></td><td className="num">{fmt(Math.max(0,outIgst))}</td><td className="num">{fmt(igstFromIgst)}</td><td className="num"></td><td className="num"></td><td className="num">{fmt(cashIgst)}</td></tr>
            <tr><td><b>Central Tax (CGST)</b></td><td className="num">{fmt(Math.max(0,outCgst))}</td><td className="num">{fmt(cgstFromIgst)}</td><td className="num">{fmt(cgstFromCgst)}</td><td className="num"></td><td className="num">{fmt(cashCgst)}</td></tr>
            <tr><td><b>State/UT Tax (SGST)</b></td><td className="num">{fmt(Math.max(0,outSgst))}</td><td className="num">{fmt(sgstFromIgst)}</td><td className="num"></td><td className="num">{fmt(sgstFromSgst)}</td><td className="num">{fmt(cashSgst)}</td></tr>
            <tr className="total">
              <td><b>Total</b></td>
              <td className="num">₹{fmt(Math.max(0,outIgst)+Math.max(0,outCgst)+Math.max(0,outSgst))}</td>
              <td className="num">₹{fmt(itcUsedIgst)}</td>
              <td className="num">₹{fmt(itcUsedCgst)}</td>
              <td className="num">₹{fmt(itcUsedSgst)}</td>
              <td className="num">₹{fmt(totalCash)}</td>
            </tr>
          </tbody>
        </table>

        <div className="report-foot">
          <span>Verification: I hereby solemnly affirm and declare that the information given herein is true and correct to the best of my knowledge and belief and nothing has been concealed there from.</span>
          <span>For {data.company.name}  Authorised Signatory</span>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// GSTR-2B  Full Reconciliation Implementation
// ============================================================================
function GSTR2B({data, setData, showToast}){
  const [month, setMonth] = useState(today().slice(0,7));
  const [activeTab, setActiveTab] = useState('matched');
  const fileInputRef = useRef(null);

  const myPurchases = useMemo(() => {
    return data.vouchers
      .filter(v => v.status!=='Cancelled' && (v.type==='PUR'||v.type==='DBN') && v.date.startsWith(month))
      .map(v => {
        const p = data.parties.find(x => x.id===v.partyId);
        return { voucherId:v.id, gstin:p?.gstin||'', partyName:p?.name||v.partyName||'', invNum:v.number||'',
          invDate:v.date, taxable:v.taxable||0, igst:v.igst||0, cgst:v.cgst||0, sgst:v.sgst||0, total:v.total||0 };
      });
  }, [data.vouchers, month, data.parties]);

  const gstr2bRecords = useMemo(() =>
    (data.gstr2bData||[]).filter(r => r.invDate && r.invDate.startsWith(month)),
    [data.gstr2bData, month]);

  const recon = useMemo(() => {
    const matched=[], amountDiff=[], invNoDiff=[], inBooksOnly=[], in2bOnly=[];
    const used2b = new Set();
    myPurchases.forEach(mp => {
      // 1. Exact: GSTIN + Inv# + total within ₹1
      const ei = gstr2bRecords.findIndex((rb,i) => !used2b.has(i) && rb.gstin===mp.gstin && rb.invNum===mp.invNum && Math.abs(rb.total-mp.total)<1);
      if(ei>=0){ used2b.add(ei); matched.push({mine:mp,portal:gstr2bRecords[ei],status:'Matched'}); return; }
      // 2. Same Inv# but different amount
      const ii = gstr2bRecords.findIndex((rb,i) => !used2b.has(i) && rb.gstin===mp.gstin && rb.invNum===mp.invNum);
      if(ii>=0){ used2b.add(ii); amountDiff.push({mine:mp,portal:gstr2bRecords[ii],status:'Amount Mismatch',diff:gstr2bRecords[ii].total-mp.total}); return; }
      // 3. Same GSTIN + amount but different Inv#
      const ai = gstr2bRecords.findIndex((rb,i) => !used2b.has(i) && rb.gstin===mp.gstin && Math.abs(rb.total-mp.total)<10);
      if(ai>=0){ used2b.add(ai); invNoDiff.push({mine:mp,portal:gstr2bRecords[ai],status:'Inv# Mismatch'}); return; }
      inBooksOnly.push({mine:mp,status:'In Books Only'});
    });
    gstr2bRecords.forEach((rb,i) => { if(!used2b.has(i)) in2bOnly.push({portal:rb,status:'In 2B Only'}); });
    return {matched,amountDiff,invNoDiff,inBooksOnly,in2bOnly};
  }, [myPurchases, gstr2bRecords]);

  const parseGSTR2BJSON = (json) => {
    const records=[];
    try {
      const root=json.data||json, docdata=root.docdata||root;
      // B2B
      (docdata.b2b||[]).forEach(sup => {
        const gstin=sup.ctin||sup.gstin||'', name=sup.trdnm||sup.lgnm||'';
        (sup.inv||[]).forEach(inv => {
          const taxable=(inv.itms||[]).reduce((s,it)=>s+(it.txval||it.itm_det?.txval||0),0);
          const igst=(inv.itms||[]).reduce((s,it)=>s+(it.igst||it.itm_det?.igst||0),0);
          const cgst=(inv.itms||[]).reduce((s,it)=>s+(it.cgst||it.itm_det?.cgst||0),0);
          const sgst=(inv.itms||[]).reduce((s,it)=>s+(it.sgst||it.itm_det?.sgst||0),0);
          let dt=inv.idt||''; if(dt.includes('-')&&dt.split('-')[0].length===2) dt=dt.split('-').reverse().join('-');
          records.push({gstin,partyName:name,invNum:inv.inum||'',invDate:dt||month+'-01',docType:'B2B',taxable,igst,cgst,sgst,total:inv.val||(taxable+igst+cgst+sgst),reverseCharge:inv.rchrg==='Y'});
        });
      });
      // CDNR
      (docdata.cdnr||[]).forEach(sup => {
        const gstin=sup.ctin||'';
        (sup.nt||[]).forEach(nt => {
          const taxable=(nt.itms||[]).reduce((s,it)=>s+(it.txval||it.itm_det?.txval||0),0);
          const igst=(nt.itms||[]).reduce((s,it)=>s+(it.igst||it.itm_det?.igst||0),0);
          const cgst=(nt.itms||[]).reduce((s,it)=>s+(it.cgst||it.itm_det?.cgst||0),0);
          const sgst=(nt.itms||[]).reduce((s,it)=>s+(it.sgst||it.itm_det?.sgst||0),0);
          let dt=nt.nt_dt||''; if(dt.includes('-')&&dt.split('-')[0].length===2) dt=dt.split('-').reverse().join('-');
          records.push({gstin,partyName:sup.trdnm||'',invNum:nt.nt_num||nt.ntnum||'',invDate:dt||month+'-01',docType:nt.ntty==='C'?'CDN-Credit':'CDN-Debit',taxable,igst,cgst,sgst,total:taxable+igst+cgst+sgst});
        });
      });
      // ISD
      (docdata.isd||[]).forEach(d => {
        (d.doclist||[]).forEach(doc => {
          let dt=doc.docdt||''; if(dt.includes('-')&&dt.split('-')[0].length===2) dt=dt.split('-').reverse().join('-');
          records.push({gstin:d.isdgstin||'',partyName:d.trdnm||'',invNum:doc.docnum||'',invDate:dt||month+'-01',docType:'ISD',taxable:0,igst:doc.igst||0,cgst:doc.cgst||0,sgst:doc.sgst||0,total:(doc.igst||0)+(doc.cgst||0)+(doc.sgst||0)});
        });
      });
    } catch(e){ console.error(e); }
    return records;
  };

  const parseCSV = (txt) => {
    const lines=txt.split('\n').filter(l=>l.trim());
    if(lines.length<2) return [];
    const hdr=lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase());
    const col=(...names)=>{for(const n of names){const i=hdr.findIndex(h=>h.includes(n.toLowerCase()));if(i>=0)return i;}return -1;};
    const gCol=col('gstin of supplier','supplier gstin','gstin'), nCol=col('trade/legal name','supplier name','legal name','trade name');
    const iCol=col('invoice number','document number','inv no'), dCol=col('invoice date','document date');
    const tCol=col('taxable value','taxable amount'), igCol=col('integrated tax','igst'), cgCol=col('central tax','cgst'), sgCol=col('state/ut tax','sgst'), vCol=col('invoice value','total value');
    const records=[];
    for(let i=1;i<lines.length;i++){
      const c=lines[i].split(',').map(x=>x.trim().replace(/"/g,''));
      if(c.length<3) continue;
      const gv=(idx)=>idx>=0&&c[idx]?parseFloat(c[idx].replace(/,/g,''))||0:0;
      const gs=(idx)=>idx>=0&&c[idx]?c[idx]:'';
      const taxable=gv(tCol),igst=gv(igCol),cgst=gv(cgCol),sgst=gv(sgCol);
      let total=gv(vCol)||taxable+igst+cgst+sgst;
      let dt=gs(dCol);
      if(dt.includes('/')&&dt.split('/')[0].length<=2){const p=dt.split('/');dt=`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}
      else if(dt.includes('-')&&dt.split('-')[0].length<=2){const p=dt.split('-');dt=`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;}
      if(!dt||dt.length<7) dt=month+'-01';
      records.push({gstin:gs(gCol),partyName:gs(nCol),invNum:gs(iCol),invDate:dt,docType:'B2B',taxable,igst,cgst,sgst,total});
    }
    return records;
  };

  const handleFile = (e) => {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try {
        let records=[];
        if(file.name.toLowerCase().endsWith('.json')) records=parseGSTR2BJSON(JSON.parse(ev.target.result));
        else if(file.name.toLowerCase().match(/\.(csv|txt)$/)) records=parseCSV(ev.target.result);
        else { showToast('Upload .json or .csv file','error'); return; }
        if(!records.length){ showToast('No records found  check file format','error'); return; }
        const other=(data.gstr2bData||[]).filter(r=>!r.invDate.startsWith(month));
        setData({...data,gstr2bData:[...other,...records]});
        showToast(`Loaded ${records.length} GSTR-2B records for ${month}`);
      } catch(err){ showToast('Parse error: '+err.message,'error'); }
    };
    reader.readAsText(file); e.target.value='';
  };

  const loadSample = () => {
    const mock=[
      {gstin:'24AABCA9999B1ZJ',partyName:'Aditya Birla Supplies',invNum:'ABS/2026/001',invDate:month+'-15',docType:'B2B',taxable:50000,igst:0,cgst:4500,sgst:4500,total:59000},
      {gstin:'24BBCDM4321A1Z5',partyName:'Mahesh Stationers',invNum:'MS/INV/2026/88',invDate:month+'-18',docType:'B2B',taxable:8000,igst:0,cgst:720,sgst:720,total:9440},
      {gstin:'29XYZAB1234C1ZQ',partyName:'Karnataka Tech Vendor',invNum:'KTV/2026/445',invDate:month+'-22',docType:'B2B',taxable:25000,igst:4500,cgst:0,sgst:0,total:29500},
      {gstin:'27AAACR5055K1Z7',partyName:'Reliance Industries',invNum:'RIL/GST/7892',invDate:month+'-05',docType:'B2B',taxable:120000,igst:0,cgst:10800,sgst:10800,total:141600},
    ];
    const other=(data.gstr2bData||[]).filter(r=>!r.invDate.startsWith(month));
    setData({...data,gstr2bData:[...other,...mock]});
    showToast('Sample GSTR-2B loaded (4 records)');
  };

  const clearMonth = () => {
    if(!confirm(`Clear all GSTR-2B data for ${month}?`)) return;
    setData({...data,gstr2bData:(data.gstr2bData||[]).filter(r=>!r.invDate.startsWith(month))});
    showToast('Cleared GSTR-2B data for '+month);
  };

  const exportCSV = () => {
    const rows=[
      ...recon.matched.map(r=>({...r.mine,status:'Matched',p_inv:r.portal.invNum,p_total:r.portal.total,diff:0})),
      ...recon.amountDiff.map(r=>({...r.mine,status:'Amount Mismatch',p_inv:r.portal.invNum,p_total:r.portal.total,diff:r.diff})),
      ...recon.invNoDiff.map(r=>({...r.mine,status:'Inv# Mismatch',p_inv:r.portal.invNum,p_total:r.portal.total,diff:0})),
      ...recon.inBooksOnly.map(r=>({...r.mine,status:'In Books Only  ITC at Risk',p_inv:'',p_total:0,diff:0})),
      ...recon.in2bOnly.map(r=>({...r.portal,status:'In 2B Only  Book Entry Required',p_inv:r.portal.invNum,p_total:r.portal.total,diff:0})),
    ];
    const hdr='Status,Vendor,GSTIN,Books Inv#,Portal Inv#,Date,Taxable,IGST,CGST,SGST,Books Total,Portal Total,Diff';
    const csv=[hdr,...rows.map(r=>[r.status,r.partyName,r.gstin,r.invNum||'',r.p_inv||'',r.invDate||'',r.taxable||0,r.igst||0,r.cgst||0,r.sgst||0,r.total||0,r.p_total||0,r.diff||0].map(v=>`"${v}"`).join(','))].join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})), a=document.createElement('a');
    a.href=url; a.download=`GSTR2B_Recon_${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Auto-draft a purchase voucher straight from the GSTR-2B record
  const bookEntry = (r) => {
    const p = r.portal;
    if(!isPremiumActive(data.company) && (data.vouchers||[]).filter(v=>v.status!=='Cancelled').length >= FREE_VOUCHER_LIMIT){
      showToast(`Free limit (${FREE_VOUCHER_LIMIT} entries) reached  upgrade to Premium`,'error'); return;
    }
    if(isDateLocked(data.company, p.invDate)){ showToast('Period is locked  cannot post on '+p.invDate,'error'); return; }
    if(!confirm(`Auto-create purchase entry?\n\nVendor: ${p.partyName}\nInvoice: ${p.invNum} dt ${p.invDate}\nTaxable ₹${fmt(p.taxable)} + GST ₹${fmt(p.igst+p.cgst+p.sgst)} = ₹${fmt(p.total)}\n\nDr Purchases + ITC ledgers · Cr Sundry Creditors`)) return;
    setData(prev => {
      // Resolve / auto-create vendor by GSTIN
      let party = prev.parties.find(x => x.gstin === p.gstin);
      let parties = prev.parties;
      if(!party){
        party = {id:uid(), name:p.partyName||('Vendor '+p.gstin), type:'Vendor', gstin:p.gstin,
          state:'', stateCode:p.gstin?.slice(0,2)||'', address:'', email:'', phone:'',
          currency:'INR', balance:0, unregistered:false};
        parties = [...parties, party];
      }
      const lines = [{id:uid(), accountId:'4100', debit:p.taxable, credit:0, narration:'Purchases  '+p.invNum}];
      if(p.igst>0) lines.push({id:uid(), accountId:'2602', debit:p.igst, credit:0, narration:'IGST Input'});
      if(p.cgst>0) lines.push({id:uid(), accountId:'2600', debit:p.cgst, credit:0, narration:'CGST Input'});
      if(p.sgst>0) lines.push({id:uid(), accountId:'2601', debit:p.sgst, credit:0, narration:'SGST Input'});
      lines.push({id:uid(), accountId:'1300', debit:0, credit:p.total, narration:'To '+party.name});
      const typeCount = prev.vouchers.filter(x=>x.type==='PUR').length;
      const num = 'PUR/' + String(typeCount+1).padStart(4,'0');
      const v = {id:uid(), type:'PUR', date:p.invDate, number:num, partyId:party.id, partyName:party.name,
        narration:`Purchase as per GSTR-2B  Inv ${p.invNum}`, reference:p.invNum,
        taxable:p.taxable, igst:p.igst, cgst:p.cgst, sgst:p.sgst, total:p.total, amount:p.total,
        isInterState:p.igst>0, lines, items:[], status:'Posted', createdAt:new Date().toISOString()};
      return {...prev, vouchers:[...prev.vouchers, v], parties,
        auditLog:[...(prev.auditLog||[]), auditEntry('GSTR2B', `${num} auto-booked from 2B  ${party.name} ₹${fmt(p.total)}`)]};
    });
    showToast(`✓ Purchase entry booked from GSTR-2B  ${p.invNum}`);
  };

  const itcMatched   = recon.matched.reduce((s,r)=>s+r.portal.igst+r.portal.cgst+r.portal.sgst,0);
  const itcRisk      = recon.inBooksOnly.reduce((s,r)=>s+r.mine.igst+r.mine.cgst+r.mine.sgst,0);
  const itcMissing   = recon.in2bOnly.reduce((s,r)=>s+r.portal.igst+r.portal.cgst+r.portal.sgst,0);
  const totalIssues  = recon.amountDiff.length+recon.invNoDiff.length+recon.inBooksOnly.length+recon.in2bOnly.length;

  const tabs=[
    {id:'matched',label:`✓ Matched (${recon.matched.length})`},
    {id:'amtdiff',label:`⚡ Amt Diff (${recon.amountDiff.length})`},
    {id:'invdiff',label:`⚠ Inv# Diff (${recon.invNoDiff.length})`},
    {id:'booksonly',label:`⊘ Books Only (${recon.inBooksOnly.length})`},
    {id:'2bonly',label:`↓ 2B Only (${recon.in2bOnly.length})`},
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">GSTR-2B vs Purchase Register</h1>
          <div className="page-sub">ITC reconciliation · {month} · {gstr2bRecords.length} portal records · {myPurchases.length} in books</div>
        </div>
        <div className="page-actions">
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
          <input type="file" ref={fileInputRef} style={{display:'none'}} accept=".json,.csv,.txt" onChange={handleFile} />
          <button className="btn" onClick={()=>fileInputRef.current.click()}>⬆ Upload 2B (JSON / CSV)</button>
          <button className="btn" onClick={loadSample}>Load Sample</button>
          {gstr2bRecords.length>0 && <button className="btn btn-danger" onClick={clearMonth}>Clear {month}</button>}
          {(recon.matched.length+totalIssues)>0 && <button className="btn btn-primary" onClick={exportCSV}>⬇ Export CSV</button>}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Purchase Register</div><div className="stat-value">{myPurchases.length}</div><div className="stat-delta">In your books</div></div>
        <div className="stat stat-info"><div className="stat-label">GSTR-2B Records</div><div className="stat-value">{gstr2bRecords.length}</div><div className="stat-delta">From portal</div></div>
        <div className="stat stat-gold"><div className="stat-label">✓ Matched</div><div className="stat-value">{recon.matched.length}</div><div className="stat-delta">ITC: ₹{fmt(itcMatched)}</div></div>
        <div className="stat stat-danger"><div className="stat-label">Issues</div><div className="stat-value">{totalIssues}</div><div className="stat-delta">{recon.amountDiff.length} amt · {recon.invNoDiff.length} inv# mismatch</div></div>
        <div className="stat stat-danger"><div className="stat-label">ITC at Risk</div><div className="stat-value rupee">₹{fmt(itcRisk)}</div><div className="stat-delta">{recon.inBooksOnly.length} not in 2B</div></div>
        <div className="stat stat-info"><div className="stat-label">Unclaimed ITC</div><div className="stat-value rupee">₹{fmt(itcMissing)}</div><div className="stat-delta">{recon.in2bOnly.length} not in books</div></div>
      </div>

      {gstr2bRecords.length===0 && (
        <div className="card" style={{marginBottom:14}}>
          <div className="card-body">
            <div className="empty">
              <div className="empty-ico">☁</div>
              <div style={{marginBottom:8,fontWeight:600}}>No GSTR-2B data loaded for {month}</div>
              <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:16,maxWidth:480,margin:'0 auto 16px'}}>
                Download GSTR-2B from GST portal → Returns → GSTR-2B → Download JSON or CSV export.<br/>
                Supported: <b>GSTN official JSON</b> (gstr2b.json) · <b>Portal CSV export</b> (with header row)
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                <button className="btn btn-primary" onClick={()=>fileInputRef.current.click()}>⬆ Upload GSTR-2B File</button>
                <button className="btn" onClick={loadSample}>Load Sample Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">{tabs.map(t=><div key={t.id} className={'tab'+(activeTab===t.id?' active':'')} onClick={()=>setActiveTab(t.id)}>{t.label}</div>)}</div>

      {activeTab==='matched' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title" style={{color:'var(--primary)'}}>✓ Fully Matched Records  ITC Eligible: ₹{fmt(itcMatched)}</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>Books Inv#</th><th>Portal Inv#</th><th>Date</th><th className="num">Taxable</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">Total</th></tr></thead>
            <tbody>
              {recon.matched.length===0 ? <tr><td colSpan="10"><div className="empty">No matched records for {month}</div></td></tr> :
              recon.matched.map((r,i)=>(
                <tr key={i}><td>{r.mine.partyName}</td><td style={{fontFamily:'var(--mono)',fontSize:11}}>{r.mine.gstin}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{r.mine.invNum}</td>
                  <td style={{fontFamily:'var(--mono)',color:'var(--ink-3)'}}>{r.portal.invNum}</td>
                  <td>{r.mine.invDate}</td><td className="num">{fmt(r.mine.taxable)}</td>
                  <td className="num">{fmt(r.portal.igst)}</td><td className="num">{fmt(r.portal.cgst)}</td><td className="num">{fmt(r.portal.sgst)}</td>
                  <td className="num bold">{fmt(r.portal.total)}</td></tr>
              ))}
              {recon.matched.length>0&&<tr className="subtotal"><td colSpan="5">Total ({recon.matched.length})</td>
                <td className="num">{fmt(recon.matched.reduce((s,r)=>s+r.mine.taxable,0))}</td>
                <td className="num">{fmt(recon.matched.reduce((s,r)=>s+r.portal.igst,0))}</td>
                <td className="num">{fmt(recon.matched.reduce((s,r)=>s+r.portal.cgst,0))}</td>
                <td className="num">{fmt(recon.matched.reduce((s,r)=>s+r.portal.sgst,0))}</td>
                <td className="num">₹{fmt(itcMatched)}</td></tr>}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='amtdiff' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title" style={{color:'var(--warning)'}}>⚡ Amount Mismatch  Same Invoice#, Different Value</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>Inv#</th><th>Date</th><th className="num">Books Total</th><th className="num">Portal Total</th><th className="num">Difference</th><th className="num">ITC Diff</th><th>Action</th></tr></thead>
            <tbody>
              {recon.amountDiff.length===0 ? <tr><td colSpan="9"><div className="empty">No amount mismatches</div></td></tr> :
              recon.amountDiff.map((r,i)=>(
                <tr key={i}><td>{r.mine.partyName}</td><td style={{fontFamily:'var(--mono)',fontSize:11}}>{r.mine.gstin}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{r.mine.invNum}</td><td>{r.mine.invDate}</td>
                  <td className="num">{fmt(r.mine.total)}</td><td className="num">{fmt(r.portal.total)}</td>
                  <td className={'num '+(r.diff>0?'pos':'neg')}>{r.diff>0?'+':''}{fmt(r.diff)}</td>
                  <td className={'num '+(r.diff>0?'pos':'neg')}>{r.diff>0?'+':''}{fmt((r.portal.igst+r.portal.cgst+r.portal.sgst)-(r.mine.igst+r.mine.cgst+r.mine.sgst))}</td>
                  <td><span className="badge badge-gold">Check Voucher</span></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='invdiff' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title" style={{color:'var(--warning)'}}>⚠ Invoice# Mismatch  GSTIN & Amount Match, Inv# Differs</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>Books Inv#</th><th>Portal Inv#</th><th>Date</th><th className="num">Books Total</th><th className="num">Portal Total</th><th>Action</th></tr></thead>
            <tbody>
              {recon.invNoDiff.length===0 ? <tr><td colSpan="8"><div className="empty">No invoice number mismatches</div></td></tr> :
              recon.invNoDiff.map((r,i)=>(
                <tr key={i}><td>{r.mine.partyName}</td><td style={{fontFamily:'var(--mono)',fontSize:11}}>{r.mine.gstin}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{r.mine.invNum}</td>
                  <td style={{fontFamily:'var(--mono)',color:'var(--danger)'}}>{r.portal.invNum}</td>
                  <td>{r.mine.invDate}</td><td className="num">{fmt(r.mine.total)}</td><td className="num">{fmt(r.portal.total)}</td>
                  <td><span className="badge badge-gold">Update Books</span></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='booksonly' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title" style={{color:'var(--danger)'}}>⊘ In Books Only  ITC at Risk: ₹{fmt(itcRisk)}</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>Inv. No.</th><th>Date</th><th className="num">Taxable</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">ITC Claimed</th><th>Action</th></tr></thead>
            <tbody>
              {recon.inBooksOnly.length===0 ? <tr><td colSpan="10"><div className="empty">No unmatched purchases  great job!</div></td></tr> :
              recon.inBooksOnly.map((r,i)=>(
                <tr key={i}><td>{r.mine.partyName}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:11}}>{r.mine.gstin||<span className="badge badge-muted">No GSTIN</span>}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{r.mine.invNum}</td><td>{r.mine.invDate}</td>
                  <td className="num">{fmt(r.mine.taxable)}</td><td className="num">{fmt(r.mine.igst)}</td>
                  <td className="num">{fmt(r.mine.cgst)}</td><td className="num">{fmt(r.mine.sgst)}</td>
                  <td className="num neg bold">₹{fmt(r.mine.igst+r.mine.cgst+r.mine.sgst)}</td>
                  <td><span className="badge badge-danger">Follow Up</span></td></tr>
              ))}
              {recon.inBooksOnly.length>0&&<tr className="total"><td colSpan="4">Total ITC at Risk ({recon.inBooksOnly.length})</td>
                <td className="num">{fmt(recon.inBooksOnly.reduce((s,r)=>s+r.mine.taxable,0))}</td>
                <td colSpan="3"></td><td className="num neg">₹{fmt(itcRisk)}</td><td></td></tr>}
            </tbody>
          </table></div>
        </div>
      )}

      {activeTab==='2bonly' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title" style={{color:'var(--info)'}}>↓ In 2B Only  Unclaimed ITC: ₹{fmt(itcMissing)}</h3></div>
          <div style={{overflow:'auto'}}><table>
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>Inv. No.</th><th>Date</th><th>Type</th><th className="num">Taxable</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th><th className="num">ITC Available</th><th>Action</th></tr></thead>
            <tbody>
              {recon.in2bOnly.length===0 ? <tr><td colSpan="11"><div className="empty">All 2B records are booked</div></td></tr> :
              recon.in2bOnly.map((r,i)=>(
                <tr key={i}><td>{r.portal.partyName}</td><td style={{fontFamily:'var(--mono)',fontSize:11}}>{r.portal.gstin}</td>
                  <td style={{fontFamily:'var(--mono)'}}>{r.portal.invNum}</td><td>{r.portal.invDate}</td>
                  <td><span className="badge badge-info">{r.portal.docType||'B2B'}</span></td>
                  <td className="num">{fmt(r.portal.taxable)}</td><td className="num">{fmt(r.portal.igst)}</td>
                  <td className="num">{fmt(r.portal.cgst)}</td><td className="num">{fmt(r.portal.sgst)}</td>
                  <td className="num pos bold">₹{fmt(r.portal.igst+r.portal.cgst+r.portal.sgst)}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={()=>bookEntry(r)}>+ Book Entry</button></td></tr>
              ))}
              {recon.in2bOnly.length>0&&<tr className="total"><td colSpan="5">Total Unclaimed ({recon.in2bOnly.length})</td>
                <td className="num">{fmt(recon.in2bOnly.reduce((s,r)=>s+r.portal.taxable,0))}</td>
                <td colSpan="3"></td><td className="num pos">₹{fmt(itcMissing)}</td><td></td></tr>}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// FOREX
// ============================================================================
function Forex({data, setData, showToast}){
  const [rates, setRates] = useState(data.forexRates || FOREX_RATES);

  const fxVouchers = data.vouchers.filter(v => v.currency && v.currency !== 'INR' && v.status !== 'Cancelled');
  const fxParties = data.parties.filter(p => p.currency && p.currency !== 'INR');
  const fxAccounts = data.coa.filter(a => a.currency && a.currency !== 'INR');

  const saveRates = () => {
    setData({...data, forexRates: rates});
    showToast('Forex rates updated');
  };

  const fxExposure = fxParties.reduce((acc, p) => {
    if(!acc[p.currency]) acc[p.currency] = 0;
    acc[p.currency] += p.balance || 0;
    return acc;
  }, {});

  const totalForexGain = -(data.coa.find(a => a.id === '3210') ? (data.coa.find(a => a.id === '3210').opening || 0) : 0);
  const totalForexLoss = (data.coa.find(a => a.id === '4560') ? (data.coa.find(a => a.id === '4560').opening || 0) : 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Forex / Multi-Currency</h1>
          <div className="page-sub">AS-11 compliant · Foreign exchange rates & monetary item revaluation</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Forex Transactions</div><div className="stat-value">{fxVouchers.length}</div></div>
        <div className="stat stat-gold"><div className="stat-label">Foreign Parties</div><div className="stat-value">{fxParties.length}</div></div>
        <div className="stat stat-info"><div className="stat-label">Forex Accounts</div><div className="stat-value">{fxAccounts.length}</div></div>
        <div className="stat"><div className="stat-label">Realised Gain (YTD)</div><div className="stat-value rupee pos">₹{fmt(totalForexGain)}</div></div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head">
          <h3 className="card-title">Live Exchange Rates (vs INR)</h3>
          <button className="btn btn-sm btn-primary" onClick={saveRates}>Save Rates</button>
        </div>
        <div className="card-body">
          <div className="form-grid">
            {Object.keys(rates).map(ccy => (
              <div className="field" key={ccy}>
                <label>1 {ccy} =</label>
                <input type="number" step="0.0001" value={rates[ccy]} onChange={e => setRates({...rates, [ccy]: parseFloat(e.target.value)||0})} />
                <div className="help">₹ per {ccy}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">Foreign Currency Exposure (Open Balances)</h3></div>
        <div style={{overflow:'auto'}}>
          <table>
            <thead><tr><th>Currency</th><th className="num">Net Exposure (FX)</th><th className="num">Rate</th><th className="num">INR Equivalent</th><th>Hedging</th></tr></thead>
            <tbody>
              {Object.keys(fxExposure).length === 0 ? <tr><td colSpan="5"><div className="empty">No open forex exposure</div></td></tr> :
              Object.entries(fxExposure).map(([ccy, amt]) => (
                <tr key={ccy}>
                  <td><b>{ccy}</b></td>
                  <td className="num">{ccy} {fmt(amt)}</td>
                  <td className="num">₹{fmt(rates[ccy] || 0, 4)}</td>
                  <td className="num bold">₹{fmt((amt) * (rates[ccy]||0))}</td>
                  <td><span className="badge badge-muted">Unhedged</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">Foreign Currency Transactions</h3></div>
        <div style={{overflow:'auto'}}>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Voucher</th><th>Party</th><th>FX Amount</th><th className="num">FX Rate</th><th className="num">INR Equivalent</th></tr></thead>
            <tbody>
              {fxVouchers.length === 0 ? <tr><td colSpan="7"><div className="empty">No foreign currency vouchers yet. Create a sales/purchase invoice with a foreign party.</div></td></tr> :
              fxVouchers.map(v => {
                const inr = (v.total || v.amount || 0);
                const fxAmt = inr / (v.fxRate || 1);
                return (
                  <tr key={v.id}>
                    <td>{fmtDate(v.date)}</td>
                    <td><span className="badge badge-info">{v.type}</span></td>
                    <td style={{fontFamily:'var(--mono)'}}>{v.number}</td>
                    <td>{v.partyName}</td>
                    <td>{v.currency} {fmt(fxAmt)}</td>
                    <td className="num">₹{fmt(v.fxRate||1, 4)}</td>
                    <td className="num bold">₹{fmt(inr)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="card-title">AS-11 Year-End Revaluation Notes</h3></div>
        <div className="card-body">
          <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.7}}>
            <p><b>Monetary Items:</b> Foreign currency receivables, payables, cash, and loans must be restated at the closing rate on the reporting date. The resulting exchange differences are recognised as <b>Forex Gain / Loss</b> in the P&L.</p>
            <p><b>Non-Monetary Items:</b> Fixed assets and inventories carried at historical cost are not restated.</p>
            <p><b>Forward Contracts:</b> Premium/discount is amortised over the period of the contract. Mark-to-market changes go to P&L unless designated as a hedge under Ind AS 109.</p>
            <p><b>Recommended action at FY-end:</b> Pass a Journal Voucher to revalue the USD/EUR/GBP balances of debtors, creditors, and foreign bank accounts using the RBI reference rate as on 31-Mar.</p>
          </div>
          <div className="chip-list" style={{marginTop:14}}>
            <span className="chip">AS-11</span>
            <span className="chip">Ind AS 21</span>
            <span className="chip">Closing rate method</span>
            <span className="chip">Monetary vs non-monetary</span>
            <span className="chip">Realised vs Unrealised</span>
          </div>
        </div>
      </div>
    </>
  );
}
