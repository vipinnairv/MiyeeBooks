
// ============================================================================
// MSME 45-DAY DUES  Sec 43B(h) of the Income-tax Act
// Payments to Micro & Small Enterprises unpaid beyond the MSMED-Act limit
// (45 days where a written agreement exists, else 15 days) are DISALLOWED as a
// deduction until actually paid. This report flags such exposure.
// ============================================================================
function MSMEDues({data}){
  const asOf = today();
  const [limit, setLimit] = useState(45);   // 45 (with agreement) or 15 (without)

  const partyById = useMemo(() => {
    const m = {}; (data.parties||[]).forEach(p => m[p.id] = p); return m;
  }, [data.parties]);

  const allocMap = useMemo(() => {
    const m = {};
    (data.vouchers||[]).forEach(v => {
      if(v.status==='Cancelled') return;
      (v.billTags||[]).forEach(bt => { m[bt.voucherId] = (m[bt.voucherId]||0) + (bt.allocated||0); });
    });
    return m;
  }, [data.vouchers]);

  // Outstanding purchase bills owed to MSME-flagged vendors
  const bills = useMemo(() => (data.vouchers||[])
    .filter(v => v.type==='PUR' && v.status!=='Cancelled')
    .map(inv => {
      const p = partyById[inv.partyId];
      const isMsme = !!(p && p.msmeReg);
      const ctrlAmt = (inv.lines||[]).reduce((s,l)=> s + (l.accountId==='1300' ? (l.credit||0) : 0), 0);
      const total = ctrlAmt || inv.total || inv.amount || 0;
      const paid = allocMap[inv.id] || 0;
      const out  = Math.max(0, total - paid);
      const days = Math.floor((new Date(asOf) - new Date(inv.date)) / 86400000);
      return {id:inv.id, date:inv.date, number:inv.number, party:inv.partyName||'',
        msmeType:'Micro/Small', udyam:(p&&p.msmeReg)||'', isMsme,
        total, paid, out, days, overdue: days>limit};
    })
    .filter(r => r.isMsme && r.out>0.01)
    .sort((a,b)=> b.days - a.days), [data.vouchers, partyById, allocMap, asOf, limit]);

  const overdue = bills.filter(b=>b.overdue);
  const totalOut = bills.reduce((s,b)=>s+b.out,0);
  const totalDisallow = overdue.reduce((s,b)=>s+b.out,0);
  const anyFlagged = (data.parties||[]).some(p => p.msmeReg);

  const handleExcel = () => {
    exportXLSX(`MSME_43Bh_Dues_${asOf}.xlsx`, [{
      name:'MSME 43B(h) Dues',
      rows:[
        [`MSME Sec 43B(h) Exposure  ${data.company.name}  as on ${asOf}  limit ${limit} days`],[],
        ['Vendor','Udyam','Bill Date','Bill No','Outstanding (₹)','Age (days)','Status'],
        ...bills.map(b=>[b.party,b.udyam,b.date,b.number,b.out,b.days, b.overdue?'DISALLOWED (overdue)':'Within limit']),
        [],['','','','Total Outstanding',totalOut,'',''],
        ['','','','Disallowable u/s 43B(h)',totalDisallow,'',''],
      ],
    }]);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">MSME Dues - Sec 43B(h)</h1>
        <div className="page-sub">Micro & Small vendor payments overdue beyond {limit} days · as on {asOf}</div>
      </div>
      <div className="page-actions">
        <span style={{fontSize:12,color:'var(--ink-3)',marginRight:6}}>Limit:</span>
        <button className={'btn btn-sm'+(limit===45?' btn-primary':'')} onClick={()=>setLimit(45)} title="Written agreement exists">45 days</button>
        <button className={'btn btn-sm'+(limit===15?' btn-primary':'')} onClick={()=>setLimit(15)} title="No written agreement">15 days</button>
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    {!anyFlagged && (
      <div className="card" style={{marginBottom:14,borderLeft:'4px solid var(--accent)'}}>
        <div className="card-body" style={{fontSize:13,lineHeight:1.6}}>
          <b>No vendors are tagged as MSME yet.</b> Open <b>Customers & Vendors</b>, edit a supplier and fill the
          <b> MSME / Udyam Reg. No.</b> field. This report then tracks payments that
          must clear within {limit} days to stay deductible under <b>Section 43B(h)</b>. Until then it shows no exposure.
        </div>
      </div>
    )}

    <div className="stat-grid" style={{marginBottom:14}}>
      <div className="stat"><div className="stat-label">MSME Bills Open</div><div className="stat-value rupee">₹{fmt(totalOut)}</div></div>
      <div className="stat stat-danger"><div className="stat-label">Overdue &gt; {limit} days</div><div className="stat-value rupee">₹{fmt(totalDisallow)}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Bills Flagged</div><div className="stat-value">{bills.length}</div></div>
      <div className="stat stat-info"><div className="stat-label">Overdue Count</div><div className="stat-value">{overdue.length}</div></div>
    </div>

    <div className="card" style={{marginBottom:14,borderLeft:'4px solid var(--danger)'}}>
      <div className="card-body" style={{fontSize:12.5,lineHeight:1.6,color:'var(--ink-2)'}}>
        ⚠ Under <b>Sec 43B(h)</b>, any amount payable to a Micro or Small enterprise still unpaid beyond the MSMED-Act
        time limit ({limit} days) is <b>not allowed as a deduction</b> in the year of accrual - it becomes deductible only
        in the year of actual payment. Clear the overdue bills below before 31-Mar to avoid the add-back.
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Vendor</th><th style={{width:120}}>Udyam</th><th style={{width:92}}>Bill Date</th>
          <th style={{width:100}}>Bill No</th><th className="num" style={{width:120}}>Outstanding (₹)</th>
          <th className="num" style={{width:70}}>Age</th><th style={{width:150}}>Status</th>
        </tr></thead>
        <tbody>
          {bills.length===0 ? (
            <tr><td colSpan="7"><div className="empty"><div className="empty-ico">✓</div>
              <div>{anyFlagged?'No outstanding bills to MSME vendors. 🎉':'Tag MSME vendors to begin tracking.'}</div>
            </div></td></tr>
          ) : bills.map(b=>(
            <tr key={b.id} style={b.overdue?{background:'#fef2f2'}:{}}>
              <td style={{fontWeight:500}}>{b.party} <span style={{fontSize:10,color:'var(--ink-3)'}}>({b.msmeType})</span></td>
              <td style={{fontFamily:'var(--mono)',fontSize:11}}>{b.udyam||'-'}</td>
              <td>{fmtDate(b.date)}</td>
              <td>{b.number}</td>
              <td className="num bold">₹{fmt(b.out)}</td>
              <td className="num">{b.days}</td>
              <td>{b.overdue
                ? <span style={{color:'var(--danger)',fontWeight:700,fontSize:11}}>● Disallowed (overdue)</span>
                : <span style={{color:'var(--primary)',fontSize:11}}>Within limit</span>}</td>
            </tr>
          ))}
        </tbody>
        {bills.length>0 && (
          <tfoot><tr style={{fontWeight:700,borderTop:'2px solid var(--line)'}}>
            <td colSpan="4">Disallowable u/s 43B(h) (overdue)</td>
            <td className="num" style={{color:'var(--danger)'}}>₹{fmt(totalDisallow)}</td>
            <td colSpan="2"></td>
          </tr></tfoot>
        )}
      </table>
    </div>
  </>);
}

// ============================================================================
// STARTUP RELIEFS & COMPLIANCE  DPIIT / 80-IAC / angel tax / ROC tracker
// ============================================================================
function StartupReliefs({data, setData, showToast, readOnly}){
  const sp = (data.company && data.company.startupProfile) || {};
  const setSP = (patch) => {
    if(readOnly) return;
    setData(d => ({...d, company:{...d.company, startupProfile:{...((d.company&&d.company.startupProfile)||{}), ...patch}}}));
  };
  const incDate = sp.incorporationDate || data.company.incorporationDate || '';
  const ageYears = incDate ? ((new Date() - new Date(incDate))/ (365.25*86400000)) : null;

  const reliefs = [
    {t:'DPIIT Recognition', cond: !!sp.dpiitNumber,
     d:'Recognition by DPIIT (Startup India) is the gateway to most startup benefits. Apply on startupindia.gov.in.',
     meta: sp.dpiitNumber ? 'DPIIT No: '+sp.dpiitNumber : 'Not recognised yet'},
    {t:'Sec 80-IAC - 3-year tax holiday', cond: ageYears!=null && ageYears<=10 && !!sp.dpiitNumber,
     d:'100% deduction of profits for any 3 consecutive years out of the first 10, for DPIIT startups incorporated up to the notified cut-off and turnover ≤ ₹100 cr. Needs separate inter-ministerial-board approval.',
     meta: ageYears!=null ? ('Company age: '+ageYears.toFixed(1)+' yrs') : 'Set incorporation date below'},
    {t:'Sec 56(2)(viib) - Angel-tax exemption', cond: !!sp.angelTaxExempt,
     d:'DPIIT-recognised startups filing Form-2 self-declaration are exempt from angel tax on share premium from eligible investors.',
     meta: sp.angelTaxExempt ? 'Form-2 filed' : 'Not declared'},
    {t:'Sec 79 - Carry-forward of losses', cond: ageYears!=null && ageYears<=10,
     d:'Eligible startups can carry forward losses even with a change in shareholding, provided original promoters continue (relaxed condition).',
     meta:'Keep founder shareholding records'},
    {t:'MSME / Udyam registration', cond: !!sp.udyamNumber,
     d:'Udyam registration unlocks the 45-day payment protection (Sec 43B(h) for your buyers), collateral-free loans and subsidies.',
     meta: sp.udyamNumber ? 'Udyam: '+sp.udyamNumber : 'Not registered'},
  ];

  // ROC / statutory annual checklist
  const checklist = sp.checklist || {};
  const tick = (k) => setSP({checklist:{...checklist, [k]:!checklist[k]}});
  const rocItems = [
    ['inc20a','INC-20A - Commencement of Business (within 180 days of incorporation)'],
    ['auditor','ADT-1 - Auditor appointment (within 30 days)'],
    ['aoc4','AOC-4 - Financial statements (within 30 days of AGM)'],
    ['mgt7','MGT-7 / 7A - Annual Return (within 60 days of AGM)'],
    ['dpt3','DPT-3 - Return of deposits / loans (by 30 June)'],
    ['dir3kyc','DIR-3 KYC - Director KYC (by 30 September)'],
    ['itr','Income-tax Return (by 31 Oct for audit cases)'],
    ['dpiit','Startup India DPIIT annual update'],
  ];
  const done = rocItems.filter(([k])=>checklist[k]).length;

  const Field = ({label, k, ph, type='text'}) => (
    <label style={{display:'block',marginBottom:10}}>
      <span style={{display:'block',fontSize:11,fontWeight:600,color:'var(--ink-3)',marginBottom:3}}>{label}</span>
      <input className="inp" type={type} placeholder={ph} value={sp[k]||''} disabled={readOnly}
        onChange={e=>setSP({[k]:e.target.value})} style={{width:'100%'}} />
    </label>
  );

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Startup Reliefs & Compliance</h1>
        <div className="page-sub">DPIIT benefits, tax holidays and ROC annual-filing tracker</div>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:18}}>
      <div className="card">
        <div className="card-head"><h3 className="card-title">Eligible Reliefs & Exemptions</h3></div>
        <div className="card-body">
          {reliefs.map((r,i)=>(
            <div key={i} style={{display:'flex',gap:12,padding:'12px 0',borderBottom:i<reliefs.length-1?'1px solid var(--line)':'none'}}>
              <div style={{fontSize:20,lineHeight:1}}>{r.cond?'✅':'⬜'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{r.t}</div>
                <div style={{fontSize:12,color:'var(--ink-2)',marginTop:2,lineHeight:1.5}}>{r.d}</div>
                <div style={{fontSize:11,color: r.cond?'var(--primary)':'var(--ink-3)',marginTop:3,fontWeight:600}}>{r.meta}</div>
              </div>
            </div>
          ))}
          <div style={{fontSize:10.5,color:'var(--ink-3)',marginTop:10,lineHeight:1.5}}>
            Informational only - eligibility depends on the conditions in force for your incorporation year. Confirm with a professional before claiming.
          </div>
        </div>
      </div>

      <div>
        <div className="card" style={{marginBottom:18}}>
          <div className="card-head"><h3 className="card-title">Startup Profile</h3></div>
          <div className="card-body">
            <Field label="Incorporation Date" k="incorporationDate" type="date" />
            <Field label="DPIIT Recognition No." k="dpiitNumber" ph="DIPP-XXXXX" />
            <Field label="Udyam Registration No." k="udyamNumber" ph="UDYAM-XX-00-0000000" />
            <Field label="CIN" k="cin" ph="U72900GJ2025PTC000000" />
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginTop:4,cursor:readOnly?'default':'pointer'}}>
              <input type="checkbox" checked={!!sp.angelTaxExempt} disabled={readOnly} onChange={e=>setSP({angelTaxExempt:e.target.checked})} />
              Angel-tax exemption (Form-2) filed
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">ROC / Statutory Checklist</h3>
            <span style={{fontSize:11,color:'var(--ink-3)'}}>{done}/{rocItems.length} done</span>
          </div>
          <div className="card-body">
            {rocItems.map(([k,label])=>(
              <label key={k} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 0',fontSize:12,cursor:readOnly?'default':'pointer'}}>
                <input type="checkbox" checked={!!checklist[k]} disabled={readOnly} onChange={()=>tick(k)} style={{marginTop:2}} />
                <span style={{textDecoration:checklist[k]?'line-through':'none',color:checklist[k]?'var(--ink-3)':'var(--ink-1)'}}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>);
}

// ============================================================================
// 13-WEEK CASH-FLOW FORECAST  the classic CFO survival tool
// Projects weekly cash: opening bank+cash, receivable inflows on their due
// dates (invoice date + customer credit days), payable outflows likewise,
// recurring monthly entries, average payroll, and GST/TDS statutory dues.
// ============================================================================
function CashForecast({data, balances}){
  const r2 = n => Math.round((n||0)*100)/100;
  const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

  const fc = useMemo(() => {
    // Week buckets: 13 weeks starting Monday of the current week
    const now = new Date(today());
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7));
    const weeks = [];
    for(let i=0;i<13;i++){
      const from = new Date(monday); from.setDate(monday.getDate()+i*7);
      const to = new Date(from); to.setDate(from.getDate()+6);
      weeks.push({ i, from:from.toISOString().slice(0,10), to:to.toISOString().slice(0,10),
        arIn:0, recIn:0, apOut:0, recOut:0, payroll:0, statutory:0 });
    }
    const bucketOf = (iso) => {
      if(!iso) return null;
      if(iso < weeks[0].from) return weeks[0];              // overdue → assume now
      return weeks.find(w => iso >= w.from && iso <= w.to) || null;  // beyond horizon → ignored
    };
    const partyById = {}; (data.parties||[]).forEach(p => partyById[p.id]=p);

    // Opening cash & bank
    const opening = (data.coa||[]).filter(a => a.isBank || a.id==='2500').reduce((s,a)=>s+(balances[a.id]||0),0);

    // Bill-tag allocations (settled amounts)
    const alloc = {};
    (data.vouchers||[]).forEach(v => { if(v.status==='Cancelled') return;
      (v.billTags||[]).forEach(bt => { alloc[bt.voucherId]=(alloc[bt.voucherId]||0)+(bt.allocated||0); }); });

    // Open receivables / payables on their due dates
    (data.vouchers||[]).forEach(v => {
      if(v.status==='Cancelled' || (v.type!=='SAL' && v.type!=='PUR')) return;
      const isAR = v.type==='SAL';
      const ctrl = (v.lines||[]).reduce((s,l)=> s + (l.accountId===(isAR?'2400':'1300') ? (isAR?(l.debit||0):(l.credit||0)) : 0), 0);
      const out = Math.max(0, (ctrl || v.total || v.amount || 0) - (alloc[v.id]||0));
      if(out <= 0.01) return;
      const p = partyById[v.partyId];
      const cd = p && p.creditDays != null ? p.creditDays : 30;
      const w = bucketOf(addDays(v.date, cd));
      if(w){ if(isAR) w.arIn += out; else w.apOut += out; }
    });

    // Recurring monthly entries → repeat on the same day-of-month across the horizon
    (data.vouchers||[]).forEach(v => {
      if(!v.recurringMonthly || v.status==='Cancelled') return;
      const amt = v.total || v.amount || 0; if(amt<=0) return;
      const day = parseInt((v.date||'').slice(8,10)) || 1;
      for(let m=0;m<4;m++){
        const base = new Date(weeks[0].from); base.setMonth(base.getMonth()+m);
        const dt = new Date(base.getFullYear(), base.getMonth(), Math.min(day,28)).toISOString().slice(0,10);
        const w = bucketOf(dt); if(!w || dt < weeks[0].from) continue;
        if(v.type==='SAL'||v.type==='REC') w.recIn += amt;
        else if(v.type==='PUR'||v.type==='PAY') w.recOut += amt;
      }
    });

    // Payroll: average net of the last 3 runs, on the 30th (capped 28th) monthly
    const runs = (data.payrollRuns||[]).slice(-3);
    const avgPayroll = runs.length ? runs.reduce((s,r)=>s+(r.totalNet||0),0)/runs.length : 0;
    if(avgPayroll>0) for(let m=0;m<4;m++){
      const base = new Date(weeks[0].from); base.setMonth(base.getMonth()+m);
      const dt = new Date(base.getFullYear(), base.getMonth(), 28).toISOString().slice(0,10);
      const w = bucketOf(dt); if(w && dt >= weeks[0].from) w.payroll += avgPayroll;
    }

    // Statutory: current net GST payable due next 20th; TDS payable due next 7th
    const gstOut = -( (balances['1310']||0)+(balances['1311']||0)+(balances['1312']||0) );
    const gstItc = (balances['2600']||0)+(balances['2601']||0)+(balances['2602']||0);
    const gstNet = Math.max(0, gstOut - gstItc);
    const tdsNet = Math.max(0, -(data.coa||[]).filter(a=>/tds\s*payable/i.test(a.name||'')).reduce((s,a)=>s+(balances[a.id]||0),0));
    const nextDue = (dayN) => { const d=new Date(weeks[0].from); const dt=new Date(d.getFullYear(), d.getMonth(), dayN); if(dt < d) dt.setMonth(dt.getMonth()+1); return dt.toISOString().slice(0,10); };
    if(gstNet>0){ const w=bucketOf(nextDue(20)); if(w) w.statutory += gstNet; }
    if(tdsNet>0){ const w=bucketOf(nextDue(7));  if(w) w.statutory += tdsNet; }

    // Running closing balance
    let run = opening; let minClose = {bal:Infinity, week:null};
    weeks.forEach(w => {
      w.in  = r2(w.arIn + w.recIn);
      w.out = r2(w.apOut + w.recOut + w.payroll + w.statutory);
      w.net = r2(w.in - w.out);
      run = r2(run + w.net); w.close = run;
      if(run < minClose.bal) minClose = {bal:run, week:w};
    });
    const totIn = r2(weeks.reduce((s,w)=>s+w.in,0)), totOut = r2(weeks.reduce((s,w)=>s+w.out,0));
    return { weeks, opening:r2(opening), totIn, totOut, closing:run, minClose, gstNet, tdsNet, avgPayroll:r2(avgPayroll) };
  }, [data, balances]);

  const handleExcel = () => exportXLSX(`Cash_Forecast_13W_${today()}.xlsx`, [{
    name:'13-Week Forecast',
    rows:[
      [`13-Week Cash-Flow Forecast  ${data.company.name}  prepared ${today()}`],[],
      ['Week','From','To','AR Collections','Recurring In','Total In','AP Payments','Recurring Out','Payroll','GST/TDS','Total Out','Net','Closing Cash'],
      ...fc.weeks.map(w=>[`W${w.i+1}`, w.from, w.to, w.arIn, w.recIn, w.in, w.apOut, w.recOut, w.payroll, w.statutory, w.out, w.net, w.close]),
      [],['Opening Cash', fc.opening],['Total Inflows', fc.totIn],['Total Outflows', fc.totOut],['Closing (W13)', fc.closing],
    ],
  }]);

  const neg = fc.minClose.bal < 0;
  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">13-Week Cash Forecast</h1>
        <div className="page-sub">Weekly cash runway from receivable/payable due dates, recurring entries, payroll & statutory dues</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    <div className="stat-grid" style={{marginBottom:14}}>
      <div className="stat stat-teal"><div className="stat-label">Opening Cash & Bank</div><div className="stat-value rupee">₹{fmt(fc.opening)}</div></div>
      <div className="stat stat-green"><div className="stat-label">Expected Inflows (13w)</div><div className="stat-value rupee">₹{fmt(fc.totIn)}</div></div>
      <div className="stat stat-danger"><div className="stat-label">Expected Outflows (13w)</div><div className="stat-value rupee">₹{fmt(fc.totOut)}</div></div>
      <div className={'stat '+(neg?'stat-danger':'stat-info')}>
        <div className="stat-label">Lowest Point</div>
        <div className="stat-value rupee">₹{fmt(fc.minClose.bal===Infinity?0:fc.minClose.bal)}</div>
        <div className="stat-delta">{fc.minClose.week ? 'Week of '+fmtDate(fc.minClose.week.from) : ''}{neg ? ' - cash gap!' : ''}</div>
      </div>
    </div>

    {neg && (
      <div className="card" style={{marginBottom:14,borderLeft:'4px solid var(--danger)'}}>
        <div className="card-body" style={{fontSize:12.5,lineHeight:1.6}}>
          ⚠ <b>Projected cash gap of ₹{fmt(Math.abs(fc.minClose.bal))}</b> in the week of {fmtDate(fc.minClose.week.from)}.
          Options: chase overdue receivables (Collections page), delay discretionary payables, or arrange a short-term facility before that week.
        </div>
      </div>
    )}

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th style={{width:52}}>Week</th><th style={{width:100}}>Starting</th>
          <th className="num">AR In</th><th className="num">Recur. In</th>
          <th className="num">AP Out</th><th className="num">Recur. Out</th>
          <th className="num">Payroll</th><th className="num">GST/TDS</th>
          <th className="num" style={{width:110}}>Net</th><th className="num" style={{width:120}}>Closing</th>
        </tr></thead>
        <tbody>
          {fc.weeks.map(w=>(
            <tr key={w.i} style={w.close<0?{background:'var(--danger-soft)'}:{}}>
              <td style={{fontWeight:700}}>W{w.i+1}</td>
              <td>{fmtDate(w.from)}</td>
              <td className="num" style={{color:w.arIn>0?'var(--green)':'var(--ink-3)'}}>{w.arIn>0?fmt(w.arIn):'-'}</td>
              <td className="num" style={{color:w.recIn>0?'var(--green)':'var(--ink-3)'}}>{w.recIn>0?fmt(w.recIn):'-'}</td>
              <td className="num" style={{color:w.apOut>0?'var(--danger)':'var(--ink-3)'}}>{w.apOut>0?fmt(w.apOut):'-'}</td>
              <td className="num" style={{color:w.recOut>0?'var(--danger)':'var(--ink-3)'}}>{w.recOut>0?fmt(w.recOut):'-'}</td>
              <td className="num" style={{color:w.payroll>0?'var(--danger)':'var(--ink-3)'}}>{w.payroll>0?fmt(w.payroll):'-'}</td>
              <td className="num" style={{color:w.statutory>0?'var(--warning)':'var(--ink-3)'}}>{w.statutory>0?fmt(w.statutory):'-'}</td>
              <td className="num bold" style={{color:w.net>=0?'var(--green)':'var(--danger)'}}>{fmt(w.net)}</td>
              <td className="num bold" style={{color:w.close>=0?'var(--ink)':'var(--danger)'}}>₹{fmt(w.close)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="card" style={{marginTop:14,borderLeft:'4px solid var(--info)'}}>
      <div className="card-body" style={{fontSize:11.5,color:'var(--ink-2)',lineHeight:1.7}}>
        <b>Assumptions:</b> receivables collect on invoice date + the customer's credit days (overdue → this week);
        payables paid likewise; recurring-monthly vouchers repeat on their day-of-month; payroll = average of the last 3 runs (₹{fmt(fc.avgPayroll)}/month, on the 28th);
        current GST net payable (₹{fmt(fc.gstNet)}) hits the next 20th and TDS payable (₹{fmt(fc.tdsNet)}) the next 7th.
        It's a projection - actual collections depend on customer behaviour; tighten it weekly.
      </div>
    </div>
  </>);
}

// ============================================================================
// GROUP CONSOLIDATION  Holding + Subsidiaries combined financials & CFO view
// Loads every company in the same Group Name from the cloud, reduces each to its
// headline figures (computeEntityFinancials) and sums them. Simple aggregation -
// intercompany balances are NOT eliminated (post those as JVs before viewing).
// ============================================================================
function GroupConsolidation({data, user, ownerId, companyId}){
  const [st, setSt] = useState({loading:true, entities:[], error:''});
  const [tab, setTab] = useState('overview');
  const [applyElim, setApplyElim] = useState(true);
  const groupName = ((data.company&&data.company.groupName)||'').trim();
  const r2 = n => Math.round((n||0)*100)/100;

  useEffect(() => {
    let alive = true;
    (async () => {
      if(!user || typeof fbListCompanies!=='function' || !fbDb){
        if(alive) setSt({loading:false, entities:[], error:'local'});
        return;
      }
      try {
        const list = await fbListCompanies(ownerId);
        const out = [];
        for(const c of list){
          // Use the live in-memory data for the current company (may have unsaved edits)
          const d = (c.id===companyId) ? data : await fbLoadCompany(ownerId, c.id);
          const fin = computeEntityFinancials(d);
          // Carry the doc-meta relationship fields (parentCompanyId lives only on
          // the Firestore doc, not the payload) so grouping can use parent/child links.
          if(fin) out.push({id:c.id, ...fin, data:d, isCurrent:c.id===companyId,
            parentCompanyId: c.parentCompanyId || '',
            isHolding: fin.isHolding || !!c.isHolding,
            groupName: (fin.groupName || c.groupName || '') });
        }
        if(alive) setSt({loading:false, entities:out, error:''});
      } catch(e){ if(alive) setSt({loading:false, entities:[], error:String(e)}); }
    })();
    return () => { alive = false; };
  }, [ownerId, companyId, groupName]);

  // Robust group membership: an entity belongs to this group if it shares the
  // (non-empty) group name OR is linked by a holding↔subsidiary relationship
  // (parent/child/sibling). This survives a group-name mismatch, which is why a
  // holding could previously appear alone with no subsidiary column.
  const cur = st.entities.find(e => e.isCurrent) || st.entities[0];
  const gkey = e => ((e && e.groupName)||'').trim().toLowerCase();
  const inGroup = (e) => {
    if(!cur) return false;
    if(e.id === cur.id) return true;
    if(gkey(e) && gkey(e) === gkey(cur)) return true;                       // same group name
    if(e.parentCompanyId && e.parentCompanyId === cur.id) return true;      // e is a subsidiary of current
    if(cur.parentCompanyId && cur.parentCompanyId === e.id) return true;    // current is a subsidiary of e
    if(e.parentCompanyId && cur.parentCompanyId && e.parentCompanyId === cur.parentCompanyId) return true; // siblings
    return false;
  };
  const group = st.entities.filter(inGroup)
    // Holding first, then subsidiaries alphabetically → columns read Holding | Subsidiary | … | Consolidated
    .sort((a,b) => (b.isHolding?1:0)-(a.isHolding?1:0) || a.name.localeCompare(b.name));
  const holding = group.find(e=>e.isHolding);

  // ── Account-level consolidation worksheet ─────────────────────────────────
  // Merge every entity's account balances by account id, compute the
  // intercompany elimination column, and derive TB / P&L / BS from the result.
  const elims = useMemo(() => computeEliminations(group.map(e=>({id:e.id, name:e.name, gstin:e.gstin, data:e.data||{coa:[],vouchers:[],parties:[]}}))), [group]);
  const rows = useMemo(() => {
    const m = {};
    group.forEach(e => {
      const eb = e.data ? computeEntityBalances(e.data) : null;
      if(!eb) return;
      Object.keys(eb.bal).forEach(id => {
        if(!m[id]) m[id] = {id, name:eb.meta[id].name, type:eb.meta[id].type, grp:eb.meta[id].group, per:{}, total:0};
        m[id].per[e.id] = r2(eb.bal[id]);
        m[id].total = r2(m[id].total + eb.bal[id]);
      });
    });
    return Object.values(m)
      .map(a => { const elim = elims.adj[a.id]||0; return {...a, elim, adj: r2(a.total + (applyElim ? elim : 0))}; })
      .filter(a => Math.abs(a.total)>0.005 || Math.abs(a.elim)>0.005)
      .sort((a,b)=> a.id < b.id ? -1 : 1);
  }, [group, elims, applyElim]);

  const tSum = (t, sign) => r2(rows.filter(a=>a.type===t).reduce((s,a)=>s+sign*a.adj,0));
  const conIncome = tSum('Income',-1), conExpense = tSum('Expense',1), conProfit = r2(conIncome-conExpense);
  const conAssets = tSum('Asset',1), conLiab = tSum('Liability',-1), conEquity = r2(tSum('Equity',-1)+conProfit);
  const tbDr = r2(rows.reduce((s,a)=>s+(a.adj>0?a.adj:0),0));
  const tbCr = r2(rows.reduce((s,a)=>s+(a.adj<0?-a.adj:0),0));
  const sum = k => group.reduce((s,e)=>s+(e[k]||0), 0);
  const con = { income:conIncome, expense:conExpense, profit:conProfit, assets:conAssets, liab:conLiab, equity:conEquity,
    cash:sum('cash'), debtors:r2(sum('debtors')+(applyElim?(elims.adj['2400']||0):0)), creditors:r2(sum('creditors')-(applyElim?(elims.adj['1300']||0):0)) };
  const hasElims = elims.rows.length > 0;
  const elimTotal = r2(Object.values(elims.adj).reduce((s,v)=>s+Math.abs(v),0)/2);

  // Statement helpers
  const plRows = (t) => rows.filter(a=>a.type===t && (Math.abs(a.adj)>0.005 || Math.abs(a.elim)>0.005));
  const bsRows = (t) => plRows(t);
  const sgn = (t) => (t==='Income'||t==='Liability'||t==='Equity') ? -1 : 1;

  const handleExcel = () => {
    const entCols = group.map(e=>e.name);
    const stmtSheet = (types, signMap) => rows.filter(a=>types.includes(a.type)).map(a=>[
      a.id, a.name, a.type, ...group.map(e=>r2(signMap(a.type)*(a.per[e.id]||0))), r2(signMap(a.type)*a.elim), r2(signMap(a.type)*a.adj)]);
    exportXLSX(`Consolidated_${(groupName||'Group').replace(/\W/g,'_')}_${today()}.xlsx`, [
      {name:'Entity Summary', rows:[
        [`Consolidated Financials  ${groupName||(data.company&&data.company.name)}  as on ${today()}  ${applyElim?'(after eliminations)':'(before eliminations)'}`],[],
        ['Entity','Holding?','Revenue','Expenses','Net Profit','Assets','Liabilities','Equity','Cash'],
        ...group.map(e=>[e.name, e.isHolding?'Yes':'', e.income, e.expense, e.profit, e.assets, e.liab, e.equity, e.cash]),
        [],['CONSOLIDATED','', con.income, con.expense, con.profit, con.assets, con.liab, con.equity, con.cash],
      ]},
      {name:'Trial Balance', rows:[
        ['Code','Account','Type', ...entCols, 'Eliminations', 'Consolidated Dr', 'Consolidated Cr'],
        ...rows.map(a=>[a.id, a.name, a.type, ...group.map(e=>a.per[e.id]||0), a.elim, a.adj>0?a.adj:0, a.adj<0?-a.adj:0]),
        ['','TOTAL','', ...group.map(()=>''), '', tbDr, tbCr],
      ]},
      {name:'PnL', rows:[
        ['Code','Account','Type', ...entCols, 'Elim.', 'Consolidated'],
        ...stmtSheet(['Income','Expense'], t=>t==='Income'?-1:1),
        [],['','Net Profit','','','',''.padEnd(0), conProfit],
      ]},
      {name:'Balance Sheet', rows:[
        ['Code','Account','Type', ...entCols, 'Elim.', 'Consolidated'],
        ...stmtSheet(['Equity','Liability','Asset'], t=>t==='Asset'?1:-1),
        ['','Current-year Profit (to Reserves)','Equity', ...group.map(e=>e.profit), '', conProfit],
        [],['','Total Assets','','','','', conAssets],['','Total Equity + Liabilities','','','','', r2(conEquity+conLiab)],
      ]},
      {name:'Eliminations', rows:[
        ['Entity A','Entity B','A→B Sales','B recorded Purchases','Eliminated','Mismatch','B→A Sales','A recorded Purchases','Eliminated','Mismatch','A Receivable from B','B Payable to A','Eliminated','Mismatch'],
        ...elims.rows.map(x=>[x.a,x.b,x.salesAB,x.purchBA,x.elimTradeAB,x.tradeMismatchAB,x.salesBA,x.purchAB,x.elimTradeBA,x.tradeMismatchBA,x.arAB,x.apBA,x.elimBalAB,x.balMismatchAB]),
      ]},
    ]);
  };

  const kpi = (label, val, cls) => (
    <div className={'stat '+(cls||'')}><div className="stat-label">{label}</div><div className="stat-value rupee">₹{fmt(val)}</div></div>
  );
  // Shared entity-columns table header
  const entTh = group.map(e=><th key={e.id} className="num" style={{width:110}} title={e.name}>{e.name.length>14?e.name.slice(0,13)+'…':e.name}</th>);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Group Consolidation</h1>
        <div className="page-sub">{group.length>0 ? <>Group: <b>{groupName || (holding&&holding.name) || 'Ungrouped'}</b> · {group.length} entit{group.length===1?'y':'ies'} · {group.map(e=>e.name).join(' + ')}</> : 'Combined financials across your holding & subsidiaries'}</div>
      </div>
      {group.length>0 && <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>}
    </div>

    {st.loading && <div className="empty" style={{padding:50}}><div className="empty-ico">⏳</div><div>Loading group companies from the cloud…</div></div>}

    {!st.loading && st.error==='local' && (
      <div className="card" style={{borderLeft:'4px solid var(--accent)'}}>
        <div className="card-body" style={{fontSize:13,lineHeight:1.7}}>
          <b>Group consolidation needs cloud sign-in.</b><br/>
          Consolidation combines <i>multiple</i> companies, so it reads them from your cloud account.
          Sign in with Google/email, create your holding and subsidiary companies, give them all the <b>same Group Name</b>
          (Company Settings → Company Group), then reopen this page.
        </div>
      </div>
    )}

    {!st.loading && st.error && st.error!=='local' && (
      <div className="card" style={{borderLeft:'4px solid var(--danger)'}}><div className="card-body" style={{fontSize:13}}>Couldn't load group companies: {st.error}</div></div>
    )}

    {!st.loading && !st.error && group.length<=1 && st.entities.length>1 && (
      <div className="card" style={{borderLeft:'4px solid var(--accent)',marginBottom:16}}>
        <div className="card-body" style={{fontSize:13,lineHeight:1.7}}>
          <b>Only this company is in the group.</b> To link others, create each subsidiary via <b>⇌ Switch → + Add New Company → “Subsidiary of …”</b>,
          or give them the <b>same Group Name</b> (Company Settings → Company Group). Then they appear here as separate columns.
        </div>
      </div>
    )}
    {!st.loading && !st.error && group.length<=1 && st.entities.length<=1 && (
      <div className="card" style={{borderLeft:'4px solid var(--accent)',marginBottom:16}}>
        <div className="card-body" style={{fontSize:13,lineHeight:1.7}}>
          <b>You have only one company.</b> Add a subsidiary via <b>⇌ Switch → + Add New Company → “Subsidiary of {(data.company&&data.company.name)||'this company'}”</b> to see consolidated figures across both.
        </div>
      </div>
    )}

    {!st.loading && !st.error && group.length>0 && (<>
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10,flexWrap:'wrap'}}>
        {holding && <span style={{fontSize:12,color:'var(--ink-3)'}}>Holding: <b style={{color:'var(--ink)'}}>{holding.name}</b></span>}
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',marginLeft:'auto',
          background:applyElim?'var(--primary-soft)':'var(--surface-2)',border:'1px solid '+(applyElim?'var(--primary)':'var(--line-2)'),borderRadius:20,padding:'5px 14px'}}>
          <input type="checkbox" checked={applyElim} onChange={e=>setApplyElim(e.target.checked)} />
          <b>Apply intercompany eliminations</b>
          {hasElims ? <span style={{color:'var(--ink-3)'}}>(₹{fmt(elimTotal)} matched)</span> : <span style={{color:'var(--ink-3)'}}>(none detected)</span>}
        </label>
      </div>

      <div className="tabs">
        {[['overview','Overview'],['tb','Trial Balance'],['pnl','Profit & Loss'],['bs','Balance Sheet'],['elim','Eliminations'+(hasElims?' ('+elims.rows.length+')':'')]].map(([k,l])=>(
          <div key={k} className={'tab'+(tab===k?' active':'')} onClick={()=>setTab(k)}>{l}</div>
        ))}
      </div>

      {tab==='overview' && (<>
        <div className="stat-grid">
          {kpi('Group Revenue', con.income, 'stat-green')}
          {kpi('Group Expenses', con.expense, 'stat-danger')}
          {kpi('Group Net Profit', con.profit, con.profit>=0?'stat-teal':'stat-danger')}
          {kpi('Group Assets', con.assets, 'stat-info')}
          {kpi('Group Equity', con.equity, 'stat-purple')}
          {kpi('Group Cash & Bank', con.cash, 'stat-gold')}
          {kpi('Group Receivables', con.debtors, 'stat-info')}
          {kpi('Group Payables', con.creditors, 'stat-pink')}
        </div>
        <div className="card" style={{marginTop:8}}>
          <div className="card-head"><h3 className="card-title">Entity-wise Contribution</h3><span style={{fontSize:11,color:'var(--ink-3)'}}>{applyElim?'Consolidated row is after eliminations':'Before eliminations'}</span></div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr>
                <th>Entity</th><th className="num">Revenue</th><th className="num">Expenses</th>
                <th className="num">Net Profit</th><th className="num">Assets</th><th className="num">Equity</th><th className="num">Cash</th>
              </tr></thead>
              <tbody>
                {group.map(e=>(
                  <tr key={e.id}>
                    <td style={{fontWeight:600}}>{e.name}{e.isHolding && <span className="badge badge-info" style={{marginLeft:6,fontSize:9}}>HOLDING</span>}{e.isCurrent && <span className="badge badge-muted" style={{marginLeft:6,fontSize:9}}>CURRENT</span>}</td>
                    <td className="num">₹{fmt(e.income)}</td>
                    <td className="num">₹{fmt(e.expense)}</td>
                    <td className="num" style={{color:e.profit>=0?'var(--green)':'var(--danger)',fontWeight:600}}>₹{fmt(e.profit)}</td>
                    <td className="num">₹{fmt(e.assets)}</td>
                    <td className="num">₹{fmt(e.equity)}</td>
                    <td className="num">₹{fmt(e.cash)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{fontWeight:800,borderTop:'2px solid var(--line)',background:'var(--surface-2)'}}>
                <td>CONSOLIDATED</td>
                <td className="num">₹{fmt(con.income)}</td>
                <td className="num">₹{fmt(con.expense)}</td>
                <td className="num" style={{color:con.profit>=0?'var(--green)':'var(--danger)'}}>₹{fmt(con.profit)}</td>
                <td className="num">₹{fmt(con.assets)}</td>
                <td className="num">₹{fmt(con.equity)}</td>
                <td className="num">₹{fmt(con.cash)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      </>)}

      {tab==='tb' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Consolidated Trial Balance</h3>
            <span className={'badge '+(Math.abs(tbDr-tbCr)<1?'badge-success':'badge-danger')}>{Math.abs(tbDr-tbCr)<1?'✓ Tallies':'⚠ Off by ₹'+fmt(tbDr-tbCr)}</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{fontSize:12}}>
              <thead><tr>
                <th style={{width:60}}>Code</th><th>Account</th>{entTh}
                {hasElims && <th className="num" style={{width:100}}>Eliminations</th>}
                <th className="num" style={{width:110}}>Debit</th><th className="num" style={{width:110}}>Credit</th>
              </tr></thead>
              <tbody>
                {rows.map(a=>(
                  <tr key={a.id}>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{a.id}</td>
                    <td>{a.name}</td>
                    {group.map(e=><td key={e.id} className="num" style={{color:(a.per[e.id]||0)<0?'var(--info)':'inherit'}}>{a.per[e.id]?fmt(a.per[e.id]):'-'}</td>)}
                    {hasElims && <td className="num" style={{color:'var(--warning)'}}>{a.elim?fmt(a.elim):'-'}</td>}
                    <td className="num bold">{a.adj>0.005?fmt(a.adj):''}</td>
                    <td className="num bold">{a.adj<-0.005?fmt(-a.adj):''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{fontWeight:800,borderTop:'2px solid var(--line)',background:'var(--surface-2)'}}>
                <td colSpan={2}>TOTAL</td>
                {group.map(e=><td key={e.id}></td>)}
                {hasElims && <td></td>}
                <td className="num">₹{fmt(tbDr)}</td><td className="num">₹{fmt(tbCr)}</td>
              </tr></tfoot>
            </table>
          </div>
          <div style={{padding:'8px 16px',fontSize:10.5,color:'var(--ink-3)'}}>Entity columns show raw net balances (negative = credit). Eliminations column nets to zero by construction, so the consolidated TB always tallies.</div>
        </div>
      )}

      {tab==='pnl' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Consolidated Profit &amp; Loss</h3><span style={{fontSize:11,color:'var(--ink-3)'}}>{applyElim?'After':'Before'} intercompany eliminations</span></div>
          <div style={{overflowX:'auto'}}>
            <table style={{fontSize:12}}>
              <thead><tr><th style={{width:60}}>Code</th><th>Account</th>{entTh}{hasElims && <th className="num" style={{width:100}}>Elim.</th>}<th className="num" style={{width:120}}>Consolidated</th></tr></thead>
              <tbody>
                <tr className="group"><td colSpan={2+group.length+(hasElims?2:1)}>INCOME</td></tr>
                {plRows('Income').map(a=>(
                  <tr key={a.id}><td style={{fontFamily:'var(--mono)',fontSize:11}}>{a.id}</td><td>{a.name}</td>
                    {group.map(e=><td key={e.id} className="num">{a.per[e.id]?fmt(-(a.per[e.id])):'-'}</td>)}
                    {hasElims && <td className="num" style={{color:'var(--warning)'}}>{a.elim?fmt(-a.elim):'-'}</td>}
                    <td className="num bold">₹{fmt(-a.adj)}</td></tr>
                ))}
                <tr className="subtotal"><td colSpan={2}>Total Income</td>{group.map(e=><td key={e.id} className="num">₹{fmt(e.income)}</td>)}{hasElims && <td></td>}<td className="num">₹{fmt(conIncome)}</td></tr>
                <tr className="group"><td colSpan={2+group.length+(hasElims?2:1)}>EXPENSES</td></tr>
                {plRows('Expense').map(a=>(
                  <tr key={a.id}><td style={{fontFamily:'var(--mono)',fontSize:11}}>{a.id}</td><td>{a.name}</td>
                    {group.map(e=><td key={e.id} className="num">{a.per[e.id]?fmt(a.per[e.id]):'-'}</td>)}
                    {hasElims && <td className="num" style={{color:'var(--warning)'}}>{a.elim?fmt(a.elim):'-'}</td>}
                    <td className="num bold">₹{fmt(a.adj)}</td></tr>
                ))}
                <tr className="subtotal"><td colSpan={2}>Total Expenses</td>{group.map(e=><td key={e.id} className="num">₹{fmt(e.expense)}</td>)}{hasElims && <td></td>}<td className="num">₹{fmt(conExpense)}</td></tr>
              </tbody>
              <tfoot><tr className="total"><td colSpan={2}>GROUP NET PROFIT / (LOSS)</td>
                {group.map(e=><td key={e.id} className="num">₹{fmt(e.profit)}</td>)}{hasElims && <td></td>}
                <td className="num" style={{fontSize:13}}>₹{fmt(conProfit)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {tab==='bs' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Consolidated Balance Sheet</h3>
            <span className={'badge '+(Math.abs(conAssets-(conEquity+conLiab))<1?'badge-success':'badge-danger')}>{Math.abs(conAssets-(conEquity+conLiab))<1?'✓ Tallies':'⚠ Off by ₹'+fmt(conAssets-(conEquity+conLiab))}</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{fontSize:12}}>
              <thead><tr><th style={{width:60}}>Code</th><th>Account</th>{entTh}{hasElims && <th className="num" style={{width:100}}>Elim.</th>}<th className="num" style={{width:120}}>Consolidated</th></tr></thead>
              <tbody>
                <tr className="group"><td colSpan={2+group.length+(hasElims?2:1)}>EQUITY &amp; LIABILITIES</td></tr>
                {bsRows('Equity').map(a=>(
                  <tr key={a.id}><td style={{fontFamily:'var(--mono)',fontSize:11}}>{a.id}</td><td>{a.name}</td>
                    {group.map(e=><td key={e.id} className="num">{a.per[e.id]?fmt(-(a.per[e.id])):'-'}</td>)}
                    {hasElims && <td className="num">{a.elim?fmt(-a.elim):'-'}</td>}
                    <td className="num bold">₹{fmt(-a.adj)}</td></tr>
                ))}
                <tr><td></td><td style={{fontStyle:'italic'}}>Current-year Profit (to Reserves)</td>
                  {group.map(e=><td key={e.id} className="num" style={{fontStyle:'italic'}}>₹{fmt(e.profit)}</td>)}
                  {hasElims && <td></td>}
                  <td className="num bold" style={{fontStyle:'italic'}}>₹{fmt(conProfit)}</td></tr>
                {bsRows('Liability').map(a=>(
                  <tr key={a.id}><td style={{fontFamily:'var(--mono)',fontSize:11}}>{a.id}</td><td>{a.name}</td>
                    {group.map(e=><td key={e.id} className="num">{a.per[e.id]?fmt(-(a.per[e.id])):'-'}</td>)}
                    {hasElims && <td className="num" style={{color:'var(--warning)'}}>{a.elim?fmt(-a.elim):'-'}</td>}
                    <td className="num bold">₹{fmt(-a.adj)}</td></tr>
                ))}
                <tr className="subtotal"><td colSpan={2}>Total Equity &amp; Liabilities</td>{group.map(e=><td key={e.id}></td>)}{hasElims && <td></td>}<td className="num">₹{fmt(r2(conEquity+conLiab))}</td></tr>
                <tr className="group"><td colSpan={2+group.length+(hasElims?2:1)}>ASSETS</td></tr>
                {bsRows('Asset').map(a=>(
                  <tr key={a.id}><td style={{fontFamily:'var(--mono)',fontSize:11}}>{a.id}</td><td>{a.name}</td>
                    {group.map(e=><td key={e.id} className="num">{a.per[e.id]?fmt(a.per[e.id]):'-'}</td>)}
                    {hasElims && <td className="num" style={{color:'var(--warning)'}}>{a.elim?fmt(a.elim):'-'}</td>}
                    <td className="num bold">₹{fmt(a.adj)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="total"><td colSpan={2}>TOTAL ASSETS</td>{group.map(e=><td key={e.id}></td>)}{hasElims && <td></td>}<td className="num" style={{fontSize:13}}>₹{fmt(conAssets)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {tab==='elim' && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Intercompany Eliminations</h3><span style={{fontSize:11,color:'var(--ink-3)'}}>Auto-detected by matching party GSTIN / name to group entities</span></div>
          {!hasElims ? (
            <div className="empty" style={{padding:40}}>
              <div className="empty-ico">⇄</div>
              <div>No intercompany relationships detected.</div>
              <div style={{fontSize:11,marginTop:8,color:'var(--ink-3)',maxWidth:520,margin:'8px auto 0',lineHeight:1.6}}>
                For auto-detection, add the other group company as a <b>party</b> in each entity's books with its <b>GSTIN</b>
                (or the exact same name). E.g. in the subsidiary, create a customer "{(holding&&holding.name)||'Holding Co'}" with the holding's GSTIN,
                and book intercompany sales/purchases against it.
              </div>
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{fontSize:12}}>
                <thead><tr>
                  <th>Pair</th><th className="num">Sales A→B</th><th className="num">B's Purchases</th><th className="num">Trade Elim.</th>
                  <th className="num">Sales B→A</th><th className="num">A's Purchases</th><th className="num">Trade Elim.</th>
                  <th className="num">A's Recv. ↔ B's Payable</th><th className="num">Balance Elim.</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {elims.rows.map((x,i)=>{
                    const mm = x.tradeMismatchAB>1 || x.tradeMismatchBA>1 || x.balMismatchAB>1 || x.balMismatchBA>1;
                    return (
                      <tr key={i} style={mm?{background:'#fff8e6'}:{}}>
                        <td style={{fontWeight:600}}>{x.a} ⇄ {x.b}</td>
                        <td className="num">₹{fmt(x.salesAB)}</td><td className="num">₹{fmt(x.purchBA)}</td>
                        <td className="num bold" style={{color:'var(--warning)'}}>₹{fmt(x.elimTradeAB)}</td>
                        <td className="num">₹{fmt(x.salesBA)}</td><td className="num">₹{fmt(x.purchAB)}</td>
                        <td className="num bold" style={{color:'var(--warning)'}}>₹{fmt(x.elimTradeBA)}</td>
                        <td className="num">₹{fmt(x.arAB)} ↔ ₹{fmt(x.apBA)}</td>
                        <td className="num bold" style={{color:'var(--warning)'}}>₹{fmt(x.elimBalAB)}</td>
                        <td>{mm ? <span className="badge badge-gold" title="The two sides don't record the same amount - check for missing/mispriced intercompany entries">⚠ Mismatch</span> : <span className="badge badge-success">Matched</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{padding:'10px 16px',fontSize:11,color:'var(--ink-3)',lineHeight:1.6,borderTop:'1px solid var(--line)'}}>
            Only the <b>matched</b> (lower) amount of each pair is eliminated - mismatches are flagged, never silently removed.
            Eliminations adjust Sales (3100) ↔ Purchases (4100) and Receivables (2400) ↔ Payables (1300) in the consolidated columns; each adjustment nets to zero so the TB stays tallied.
            Unrealised profit in closing stock and minority interest are not computed - pass those as manual JVs for statutory filing (AS-21 / Ind-AS 110).
          </div>
        </div>
      )}
    </>)}
  </>);
}

// ============================================================================
// FINANCIAL MODELING / VALUATION  DCF · Comparable Multiples · Funding Round
// A founder-facing valuation workbench. Historicals are pulled from closed-year
// snapshots (company.priorYears, incl. the current run-rate); every assumption
// is editable with a sensible auto-computed default. Indicative only - not a
// substitute for a registered valuer's report (Companies Act / FEMA / Income
// Tax purposes require one).
// ============================================================================
function FinancialModel({data, balances}){
  const r2 = n => Math.round((n||0)*100)/100;
  const getBal = id => balances[id] || 0;
  const [tab, setTab] = useState('overview');

  // ── Current-year (run-rate) financials from the live ledger ───────────────
  const income  = data.coa.filter(a=>a.type==='Income').reduce((s,a)=>s+(-getBal(a.id)),0);
  const expense = data.coa.filter(a=>a.type==='Expense').reduce((s,a)=>s+getBal(a.id),0);
  const profitCurrent = r2(income - expense);
  const finCost = data.coa.filter(a=>a.group==='Finance Costs').reduce((s,a)=>s+getBal(a.id),0);
  const deprCurrent = getBal('4400');
  const ebitdaCurrent = r2(profitCurrent + finCost + deprCurrent);
  const cash = getBal('2500')+getBal('2510')+getBal('2511')+getBal('2520');
  const ltDebt = -getBal('1200');
  const netDebt = r2(ltDebt - cash);   // +ve = net debt (reduces equity value); -ve = net cash (adds to it)

  const fyStart = data.company.fyStart || (today().slice(0,4)+'-04-01');
  const [y0,m0] = fyStart.slice(0,7).split('-').map(Number);
  const [y1,m1] = today().slice(0,7).split('-').map(Number);
  const monthsElapsed = Math.max(1, Math.min(12, (y1-y0)*12 + (m1-m0) + 1));
  const annualize = v => monthsElapsed>=12 ? r2(v) : r2(v * 12 / monthsElapsed);
  const revenueRunRate = annualize(income);
  const ebitdaRunRate  = annualize(ebitdaCurrent);

  // ── Historicals from closed years + current run-rate ───────────────────────
  const priorYears = (data.company.priorYears||[]).slice().sort((a,b)=>a.fyStart.localeCompare(b.fyStart));
  const historyRows = [
    ...priorYears.map(p=>({label:'FY '+p.year, revenue:p.income||0, ebitda:(p.ebitda!=null?p.ebitda:p.profit)||0, profit:p.profit||0, closed:true})),
    {label:'Current FY (run-rate)', revenue:revenueRunRate, ebitda:ebitdaRunRate, profit:annualize(profitCurrent), closed:false},
  ];
  const revSeries = historyRows.filter(r=>r.revenue>0).map(r=>r.revenue);
  let historicalCAGR = null;
  if(revSeries.length>=2){
    const n = revSeries.length-1, first = revSeries[0], last = revSeries[revSeries.length-1];
    if(first>0 && n>0) historicalCAGR = r2((Math.pow(last/first,1/n)-1)*100);
  }
  const defaultGrowthY1 = historicalCAGR!=null ? Math.max(0, Math.min(80, historicalCAGR)) : 20;
  const defaultMargin = revenueRunRate>0 ? r2(ebitdaRunRate/revenueRunRate*100) : 15;

  // ── DCF assumptions (editable; null = auto-computed default) ──────────────
  const [revOverride, setRevOverride] = useState(null);
  const [growthY1, setGrowthY1] = useState(null);
  const [marginOverride, setMarginOverride] = useState(null);
  const [marginY5, setMarginY5] = useState(null);
  const [taxRate, setTaxRate] = useState(25);
  const [daPct, setDaPct] = useState(3);
  const [capexPct, setCapexPct] = useState(3);
  const [nwcPct, setNwcPct] = useState(8);
  const [discountRate, setDiscountRate] = useState(18);
  const [terminalMethod, setTerminalMethod] = useState('growth');   // 'growth' | 'multiple'
  const [terminalGrowth, setTerminalGrowth] = useState(4);
  const [exitMultiple, setExitMultiple] = useState(8);
  const [shares, setShares] = useState(0);

  const effRevenue = revOverride!=null ? revOverride : revenueRunRate;
  const effGrowthY1 = growthY1!=null ? growthY1 : defaultGrowthY1;
  const effMarginCurrent = marginOverride!=null ? marginOverride : defaultMargin;
  const effMarginY5 = marginY5!=null ? marginY5 : defaultMargin;

  // ── 5-year FCFF projection ──────────────────────────────────────────────
  const projection = useMemo(() => {
    const rows = []; let prevRev = effRevenue;
    for(let y=1;y<=5;y++){
      const t = (y-1)/4;
      const g = effGrowthY1 + (terminalGrowth-effGrowthY1)*t;
      const m = effMarginCurrent + (effMarginY5-effMarginCurrent)*t;
      const revenue = r2(prevRev*(1+g/100));
      const ebitdaY = r2(revenue*m/100);
      const daY = r2(revenue*daPct/100);
      const ebit = r2(ebitdaY-daY);
      const nopat = r2(ebit*(1-taxRate/100));
      const capexY = r2(revenue*capexPct/100);
      const deltaNwc = r2((revenue-prevRev)*nwcPct/100);
      const fcff = r2(nopat+daY-capexY-deltaNwc);
      const disc = Math.pow(1+discountRate/100, y);
      rows.push({y, growth:r2(g), margin:r2(m), revenue, ebitda:ebitdaY, da:daY, ebit, nopat, capex:capexY, deltaNwc, fcff, disc:r2(disc), pv:r2(fcff/disc)});
      prevRev = revenue;
    }
    return rows;
  }, [effRevenue, effGrowthY1, terminalGrowth, effMarginCurrent, effMarginY5, daPct, taxRate, capexPct, nwcPct, discountRate]);

  const year5 = projection[4];
  const sumPvFcff = r2(projection.reduce((s,r)=>s+r.pv,0));
  const tvGordon = discountRate>terminalGrowth ? r2(year5.fcff*(1+terminalGrowth/100)/((discountRate-terminalGrowth)/100)) : null;
  const tvMultiple = r2(year5.ebitda*exitMultiple);
  const terminalValue = terminalMethod==='growth' ? tvGordon : tvMultiple;
  const pvTerminal = terminalValue!=null ? r2(terminalValue/Math.pow(1+discountRate/100,5)) : 0;
  const enterpriseValue = terminalValue!=null ? r2(sumPvFcff+pvTerminal) : null;
  const equityValue = enterpriseValue!=null ? r2(enterpriseValue-netDebt) : null;
  const perShare = (equityValue!=null && shares>0) ? r2(equityValue/shares) : null;

  // Present value at an alternate discount rate (FCFF is rate-independent - only
  // the discounting changes) - used for the football-field sensitivity band.
  const pvAt = (rate) => {
    let sumPv=0; projection.forEach(r=>{ sumPv+=r.fcff/Math.pow(1+rate/100,r.y); });
    const tv = terminalMethod==='growth'
      ? (rate>terminalGrowth ? year5.fcff*(1+terminalGrowth/100)/((rate-terminalGrowth)/100) : null)
      : tvMultiple;
    if(tv==null) return null;
    const pvTv = tv/Math.pow(1+rate/100,5);
    return r2(sumPv+pvTv-netDebt);
  };
  const dcfHigh = pvAt(Math.max(terminalGrowth+1, discountRate-2));
  const dcfLow  = pvAt(discountRate+2);

  // ── Comparable multiples (trailing / current-year basis) ──────────────────
  const [evRevLow, setEvRevLow] = useState(2);
  const [evRevHigh, setEvRevHigh] = useState(4);
  const [evEbitdaLow, setEvEbitdaLow] = useState(8);
  const [evEbitdaHigh, setEvEbitdaHigh] = useState(14);
  const compRevenue = effRevenue;
  const compEbitda = r2(effRevenue*effMarginCurrent/100);
  const compEvRevLow = r2(compRevenue*evRevLow), compEvRevHigh = r2(compRevenue*evRevHigh);
  const compEvEbitdaLow = r2(compEbitda*evEbitdaLow), compEvEbitdaHigh = r2(compEbitda*evEbitdaHigh);
  const compEqRevLow = r2(compEvRevLow-netDebt), compEqRevHigh = r2(compEvRevHigh-netDebt);
  const compEqEbitdaLow = r2(compEvEbitdaLow-netDebt), compEqEbitdaHigh = r2(compEvEbitdaHigh-netDebt);

  // ── Football field (summary range across methods) ─────────────────────────
  const methods = [
    {label:'DCF (FCFF)', low:dcfLow, high:dcfHigh, mid:equityValue},
    {label:'EV / Revenue Comps', low:compEqRevLow, high:compEqRevHigh, mid:r2((compEqRevLow+compEqRevHigh)/2)},
    {label:'EV / EBITDA Comps', low:compEqEbitdaLow, high:compEqEbitdaHigh, mid:r2((compEqEbitdaLow+compEqEbitdaHigh)/2)},
  ].filter(m=>m.low!=null && m.high!=null);
  const fieldMax = Math.max(1, ...methods.map(m=>m.high));
  const fieldMin = Math.min(0, ...methods.map(m=>m.low));
  const blendedMid = methods.length ? r2(methods.reduce((s,m)=>s+m.mid,0)/methods.length) : 0;

  // ── Funding round / cap table ──────────────────────────────────────────────
  const [preMoneyOverride, setPreMoneyOverride] = useState(null);
  const [investment, setInvestment] = useState(0);
  const [existingShares, setExistingShares] = useState(0);
  const effPreMoney = preMoneyOverride!=null ? preMoneyOverride : blendedMid;
  const postMoney = r2(effPreMoney+investment);
  const newInvestorPct = postMoney>0 ? r2(investment/postMoney*100) : 0;
  const foundersPct = r2(100-newInvestorPct);
  const pricePerShare = existingShares>0 ? r2(effPreMoney/existingShares) : null;
  const newShares = (pricePerShare && pricePerShare>0) ? Math.round(investment/pricePerShare) : null;
  const totalSharesPost = (existingShares>0 && newShares!=null) ? existingShares+newShares : null;

  // ── VC Method (early-stage sanity check) ──────────────────────────────────
  const [exitValueOverride, setExitValueOverride] = useState(null);
  const [targetMultiple, setTargetMultiple] = useState(10);
  const effExitValue = exitValueOverride!=null ? exitValueOverride : (terminalValue||0);
  const vcPostMoney = targetMultiple>0 ? r2(effExitValue/targetMultiple) : 0;
  const vcPreMoney = r2(vcPostMoney-investment);
  const vcOwnership = vcPostMoney>0 ? r2(investment/vcPostMoney*100) : 0;

  const handleExcel = () => exportXLSX(`Valuation_Model_${today()}.xlsx`, [
    {name:'Assumptions', rows:[
      [`Financial Model  ${data.company.name}  ${today()}`],[],
      ['Base Revenue (run-rate)', effRevenue],['Year 1 Growth %', effGrowthY1],['Terminal Growth %', terminalGrowth],
      ['Current EBITDA Margin %', effMarginCurrent],['Year 5 EBITDA Margin %', effMarginY5],
      ['Tax Rate %', taxRate],['D&A % of Revenue', daPct],['CapEx % of Revenue', capexPct],['ΔNWC % of Δ Revenue', nwcPct],
      ['Discount Rate (WACC) %', discountRate],['Terminal Method', terminalMethod==='growth'?'Gordon Growth':'Exit Multiple'],
      ['Exit EBITDA Multiple', exitMultiple],['Net Debt / (Net Cash)', netDebt],
    ]},
    {name:'DCF Projection', rows:[
      ['Year','Growth %','Margin %','Revenue','EBITDA','D&A','EBIT','NOPAT','CapEx','Δ NWC','FCFF','Discount Factor','PV of FCFF'],
      ...projection.map(r=>[r.y,r.growth,r.margin,r.revenue,r.ebitda,r.da,r.ebit,r.nopat,r.capex,r.deltaNwc,r.fcff,r.disc,r.pv]),
      [],['Sum PV of FCFF', sumPvFcff],['Terminal Value', terminalValue],['PV of Terminal Value', pvTerminal],
      ['Enterprise Value', enterpriseValue],['Less: Net Debt', netDebt],['Equity Value (DCF)', equityValue],
    ]},
    {name:'Comparables', rows:[
      ['Method','Base','Low Multiple','High Multiple','EV Low','EV High','Equity Value Low','Equity Value High'],
      ['EV / Revenue', compRevenue, evRevLow, evRevHigh, compEvRevLow, compEvRevHigh, compEqRevLow, compEqRevHigh],
      ['EV / EBITDA', compEbitda, evEbitdaLow, evEbitdaHigh, compEvEbitdaLow, compEvEbitdaHigh, compEqEbitdaLow, compEqEbitdaHigh],
    ]},
    {name:'Football Field', rows:[
      ['Method','Low','Mid','High'],
      ...methods.map(m=>[m.label,m.low,m.mid,m.high]),
      [],['Blended Midpoint', blendedMid],
    ]},
    {name:'Funding Round', rows:[
      ['Pre-Money Valuation', effPreMoney],['Investment Amount', investment],['Post-Money Valuation', postMoney],
      ['New Investor %', newInvestorPct],['Existing Shareholders %', foundersPct],
      ['Existing Shares', existingShares],['Price / Share', pricePerShare],['New Shares Issued', newShares],['Total Shares Post-Round', totalSharesPost],
      [],['VC METHOD',''],['Target Exit Value', effExitValue],['Target Return Multiple', targetMultiple],
      ['VC-Method Post-Money', vcPostMoney],['VC-Method Pre-Money', vcPreMoney],['Investor Ownership Required %', vcOwnership],
    ]},
  ]);

  const Row = ({label, val, bold, sub}) => (
    <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)',fontWeight:bold?700:400}}>
      <span>{label}{sub && <div style={{fontSize:10.5,color:'var(--ink-3)',fontWeight:400}}>{sub}</div>}</span>
      <span className="rupee">₹{fmt(val)}</span>
    </div>
  );

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Valuation / Financial Model</h1>
        <div className="page-sub">DCF · comparable multiples · funding-round math &mdash; indicative, founder-facing</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    <div className="card" style={{marginBottom:14,borderLeft:'4px solid var(--accent)'}}>
      <div className="card-body" style={{fontSize:12,color:'var(--ink-2)',lineHeight:1.6}}>
        ⚠ <b>Indicative only.</b> This is a founder's working model, not a formal valuation report. For Companies Act (Sec 56(2)(viib)), FEMA (FDI pricing), Income-tax or M&amp;A purposes, engage a Registered Valuer / Merchant Banker for a DCF under Rule 11UA.
      </div>
    </div>

    <div className="tabs">
      {[['overview','Overview'],['dcf','DCF Model'],['comps','Comparables'],['round','Funding Round']].map(([k,l])=>(
        <div key={k} className={'tab'+(tab===k?' active':'')} onClick={()=>setTab(k)}>{l}</div>
      ))}
    </div>

    {tab==='overview' && (<>
      <div className="stat-grid" style={{marginBottom:14}}>
        <div className="stat stat-info"><div className="stat-label">Revenue Run-Rate</div><div className="stat-value rupee">₹{fmt(revenueRunRate)}</div><div className="stat-delta">Annualised from {monthsElapsed} month{monthsElapsed>1?'s':''}</div></div>
        <div className="stat stat-gold"><div className="stat-label">EBITDA Run-Rate</div><div className="stat-value rupee">₹{fmt(ebitdaRunRate)}</div><div className="stat-delta">Margin {fmt(defaultMargin,1)}%</div></div>
        <div className="stat"><div className="stat-label">Historical CAGR</div><div className="stat-value">{historicalCAGR!=null?fmt(historicalCAGR,1)+'%':'-'}</div><div className="stat-delta">{priorYears.length} closed year{priorYears.length===1?'':'s'} on record</div></div>
        <div className="stat stat-teal"><div className="stat-label">Blended Valuation (mid)</div><div className="stat-value rupee">₹{fmt(blendedMid)}</div><div className="stat-delta">Average of DCF &amp; Comps</div></div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">Football Field &mdash; Valuation Range by Method</h3></div>
        <div className="card-body">
          {methods.length===0 ? <div className="empty" style={{padding:20}}>Set assumptions on the DCF / Comparables tabs to see a range.</div> : methods.map((m,i)=>{
            const lo = Math.max(0, ((m.low-fieldMin)/(fieldMax-fieldMin))*100);
            const hi = Math.max(0, ((m.high-fieldMin)/(fieldMax-fieldMin))*100);
            const midPct = Math.max(0, ((m.mid-fieldMin)/(fieldMax-fieldMin))*100);
            return (
              <div key={i} style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <b>{m.label}</b>
                  <span style={{fontFamily:'var(--mono)',color:'var(--ink-2)'}}>₹{fmt(m.low)} &ndash; ₹{fmt(m.high)}</span>
                </div>
                <div style={{position:'relative',height:14,background:'var(--surface-2)',borderRadius:8,overflow:'hidden'}}>
                  <div style={{position:'absolute',left:lo+'%',width:Math.max(1,hi-lo)+'%',top:0,bottom:0,background:'var(--primary)',opacity:.75,borderRadius:8}}></div>
                  <div style={{position:'absolute',left:midPct+'%',top:-2,bottom:-2,width:2,background:'var(--gold, var(--accent))'}}></div>
                </div>
              </div>
            );
          })}
          <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--line)',display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:13}}>
            <span>Blended Midpoint (simple average)</span><span className="rupee">₹{fmt(blendedMid)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="card-title">Historical &amp; Run-Rate Financials</h3></div>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Period</th><th className="num">Revenue</th><th className="num">EBITDA</th><th className="num">EBITDA Margin</th><th className="num">Net Profit</th></tr></thead>
            <tbody>
              {historyRows.map((r,i)=>(
                <tr key={i} style={!r.closed?{background:'var(--primary-soft)'}:{}}>
                  <td style={{fontWeight:600}}>{r.label}{!r.closed && <span className="badge badge-info" style={{marginLeft:6,fontSize:9}}>RUN-RATE</span>}</td>
                  <td className="num">₹{fmt(r.revenue)}</td>
                  <td className="num">₹{fmt(r.ebitda)}</td>
                  <td className="num">{r.revenue>0?fmt(r.ebitda/r.revenue*100,1)+'%':'-'}</td>
                  <td className="num">₹{fmt(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)'}}>Closed years come from Year-End Closing snapshots; the run-rate row annualises the current, still-open FY.</div>
      </div>
    </>)}

    {tab==='dcf' && (<>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">Assumptions</h3></div>
        <div className="card-body" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          <div className="field"><label>Base Revenue (run-rate)</label><input type="number" value={effRevenue} onChange={e=>setRevOverride(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Year 1 Growth %</label><input type="number" value={effGrowthY1} onChange={e=>setGrowthY1(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Terminal Growth % <span style={{fontWeight:400,color:'var(--ink-3)'}}>(Y5 target &amp; perpetual)</span></label><input type="number" value={terminalGrowth} onChange={e=>setTerminalGrowth(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Current EBITDA Margin %</label><input type="number" value={effMarginCurrent} onChange={e=>setMarginOverride(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Year 5 EBITDA Margin %</label><input type="number" value={effMarginY5} onChange={e=>setMarginY5(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Tax Rate %</label><input type="number" value={taxRate} onChange={e=>setTaxRate(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>D&amp;A % of Revenue</label><input type="number" value={daPct} onChange={e=>setDaPct(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>CapEx % of Revenue</label><input type="number" value={capexPct} onChange={e=>setCapexPct(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Δ Working Capital % of Δ Revenue</label><input type="number" value={nwcPct} onChange={e=>setNwcPct(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Discount Rate (WACC) %</label><input type="number" value={discountRate} onChange={e=>setDiscountRate(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>Terminal Value Method</label>
            <select value={terminalMethod} onChange={e=>setTerminalMethod(e.target.value)}>
              <option value="growth">Gordon Growth (perpetuity)</option>
              <option value="multiple">Exit EBITDA Multiple</option>
            </select>
          </div>
          {terminalMethod==='multiple' && <div className="field"><label>Exit EBITDA Multiple (x)</label><input type="number" value={exitMultiple} onChange={e=>setExitMultiple(parseFloat(e.target.value)||0)} /></div>}
          <div className="field"><label>Shares Outstanding <span style={{fontWeight:400,color:'var(--ink-3)'}}>(optional, for per-share)</span></label><input type="number" value={shares} onChange={e=>setShares(parseFloat(e.target.value)||0)} /></div>
        </div>
      </div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">5-Year Free Cash Flow Projection</h3></div>
        <div style={{overflowX:'auto'}}>
          <table style={{fontSize:12}}>
            <thead><tr><th>Year</th><th className="num">Growth</th><th className="num">Margin</th><th className="num">Revenue</th><th className="num">EBITDA</th><th className="num">D&amp;A</th><th className="num">EBIT</th><th className="num">NOPAT</th><th className="num">CapEx</th><th className="num">Δ NWC</th><th className="num">FCFF</th><th className="num">PV @ {discountRate}%</th></tr></thead>
            <tbody>
              {projection.map(r=>(
                <tr key={r.y}>
                  <td style={{fontWeight:700}}>Y{r.y}</td>
                  <td className="num">{fmt(r.growth,1)}%</td><td className="num">{fmt(r.margin,1)}%</td>
                  <td className="num">₹{fmt(r.revenue)}</td><td className="num">₹{fmt(r.ebitda)}</td><td className="num">₹{fmt(r.da)}</td>
                  <td className="num">₹{fmt(r.ebit)}</td><td className="num">₹{fmt(r.nopat)}</td><td className="num">₹{fmt(r.capex)}</td>
                  <td className="num">₹{fmt(r.deltaNwc)}</td><td className="num bold">₹{fmt(r.fcff)}</td><td className="num bold">₹{fmt(r.pv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <div className="card">
          <div className="card-head"><h3 className="card-title">Enterprise &amp; Equity Value</h3></div>
          <div className="card-body">
            <Row label="Sum of PV - Explicit FCFF (Y1–Y5)" val={sumPvFcff} />
            <Row label={'Terminal Value ('+(terminalMethod==='growth'?'Gordon Growth':'Exit Multiple '+exitMultiple+'x')+')'} val={terminalValue||0}
              sub={terminalValue==null?'⚠ Discount rate must exceed terminal growth':''} />
            <Row label="PV of Terminal Value" val={pvTerminal} />
            <Row label="Enterprise Value" val={enterpriseValue||0} bold />
            <Row label={netDebt>=0?'Less: Net Debt':'Add: Net Cash'} val={-netDebt} />
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontWeight:800,fontSize:15,color:'var(--primary)'}}>
              <span>Equity Value (DCF)</span><span className="rupee">₹{fmt(equityValue||0)}</span>
            </div>
            {perShare!=null && <div style={{fontSize:12,color:'var(--ink-3)',textAlign:'right'}}>≈ ₹{fmt(perShare)} / share ({fmt(shares,0)} shares)</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3 className="card-title">Sensitivity - Value vs Discount Rate</h3></div>
          <div className="card-body">
            {[discountRate-2, discountRate-1, discountRate, discountRate+1, discountRate+2].map((rate,i)=>{
              const v = pvAt(rate);
              return (
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--line)',
                  background:rate===discountRate?'var(--primary-soft)':'transparent',fontWeight:rate===discountRate?700:400}}>
                  <span>{fmt(rate,1)}% WACC</span>
                  <span className="rupee">{v!=null?'₹'+fmt(v):'-'}</span>
                </div>
              );
            })}
            <div style={{marginTop:10,fontSize:11,color:'var(--ink-3)',lineHeight:1.6}}>A 1-point swing in the discount rate typically moves equity value by several percent - this is the single most sensitive assumption in a DCF.</div>
          </div>
        </div>
      </div>
    </>)}

    {tab==='comps' && (<>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">Multiple Assumptions</h3></div>
        <div className="card-body" style={{fontSize:12.5,color:'var(--ink-2)',marginBottom:10}}>
          Applied to current-year (trailing) revenue of ₹{fmt(compRevenue)} and EBITDA of ₹{fmt(compEbitda)}. Set ranges from recent deals or listed peers in your sector.
        </div>
        <div className="card-body" style={{paddingTop:0,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14}}>
          <div className="field"><label>EV / Revenue &mdash; Low (x)</label><input type="number" value={evRevLow} onChange={e=>setEvRevLow(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>EV / Revenue &mdash; High (x)</label><input type="number" value={evRevHigh} onChange={e=>setEvRevHigh(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>EV / EBITDA &mdash; Low (x)</label><input type="number" value={evEbitdaLow} onChange={e=>setEvEbitdaLow(parseFloat(e.target.value)||0)} /></div>
          <div className="field"><label>EV / EBITDA &mdash; High (x)</label><input type="number" value={evEbitdaHigh} onChange={e=>setEvEbitdaHigh(parseFloat(e.target.value)||0)} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="card-title">Implied Valuation Range</h3></div>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Method</th><th className="num">Multiple Range</th><th className="num">EV Low</th><th className="num">EV High</th><th className="num">Equity Value Low</th><th className="num">Equity Value High</th></tr></thead>
            <tbody>
              <tr>
                <td style={{fontWeight:600}}>EV / Revenue</td>
                <td className="num">{evRevLow}x &ndash; {evRevHigh}x</td>
                <td className="num">₹{fmt(compEvRevLow)}</td><td className="num">₹{fmt(compEvRevHigh)}</td>
                <td className="num bold">₹{fmt(compEqRevLow)}</td><td className="num bold">₹{fmt(compEqRevHigh)}</td>
              </tr>
              <tr>
                <td style={{fontWeight:600}}>EV / EBITDA</td>
                <td className="num">{evEbitdaLow}x &ndash; {evEbitdaHigh}x</td>
                <td className="num">₹{fmt(compEvEbitdaLow)}</td><td className="num">₹{fmt(compEvEbitdaHigh)}</td>
                <td className="num bold">₹{fmt(compEqEbitdaLow)}</td><td className="num bold">₹{fmt(compEqEbitdaHigh)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)'}}>Equity Value = Enterprise Value &minus; Net Debt (or + Net Cash). Net debt used: ₹{fmt(netDebt)}.</div>
      </div>
    </>)}

    {tab==='round' && (<>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
        <div className="card">
          <div className="card-head"><h3 className="card-title">Priced Round &amp; Cap Table Math</h3></div>
          <div className="card-body">
            <div className="field" style={{marginBottom:12}}><label>Pre-Money Valuation <span style={{fontWeight:400,color:'var(--ink-3)'}}>(defaults to blended midpoint)</span></label>
              <input type="number" value={effPreMoney} onChange={e=>setPreMoneyOverride(parseFloat(e.target.value)||0)} /></div>
            <div className="field" style={{marginBottom:12}}><label>Investment Amount</label>
              <input type="number" value={investment} onChange={e=>setInvestment(parseFloat(e.target.value)||0)} /></div>
            <div className="field" style={{marginBottom:14}}><label>Existing Shares Outstanding <span style={{fontWeight:400,color:'var(--ink-3)'}}>(optional, for price/share)</span></label>
              <input type="number" value={existingShares} onChange={e=>setExistingShares(parseFloat(e.target.value)||0)} /></div>
            <Row label="Post-Money Valuation" val={postMoney} bold />
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)'}}><span>New Investor Ownership</span><b>{fmt(newInvestorPct,1)}%</b></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)'}}><span>Existing Shareholders (post-dilution)</span><b>{fmt(foundersPct,1)}%</b></div>
            {pricePerShare!=null && <>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)'}}><span>Price / Share</span><b className="rupee">₹{fmt(pricePerShare)}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)'}}><span>New Shares Issued</span><b>{fmt(newShares,0)}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}><span>Total Shares Post-Round</span><b>{fmt(totalSharesPost,0)}</b></div>
            </>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="card-title">VC Method <span style={{fontSize:11,color:'var(--ink-3)',fontWeight:400}}>&mdash; early-stage sanity check</span></h3></div>
          <div className="card-body">
            <div className="field" style={{marginBottom:12}}><label>Target Exit Value <span style={{fontWeight:400,color:'var(--ink-3)'}}>(defaults to DCF terminal value)</span></label>
              <input type="number" value={effExitValue} onChange={e=>setExitValueOverride(parseFloat(e.target.value)||0)} /></div>
            <div className="field" style={{marginBottom:14}}><label>Target Return Multiple (x)</label>
              <input type="number" value={targetMultiple} onChange={e=>setTargetMultiple(parseFloat(e.target.value)||0)} /></div>
            <Row label="Implied Post-Money" val={vcPostMoney} bold />
            <Row label="Implied Pre-Money" val={vcPreMoney} />
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontWeight:800,fontSize:14,color:'var(--primary)'}}>
              <span>Ownership Required</span><span>{fmt(vcOwnership,1)}%</span>
            </div>
            <div style={{marginTop:8,fontSize:11,color:'var(--ink-3)',lineHeight:1.6}}>
              Post-Money = Exit Value ÷ Target Multiple. Pre-Money = Post-Money &minus; Investment. Investors typically use this to
              sanity-check a DCF/comps-derived valuation against the return they need for their fund.
            </div>
          </div>
        </div>
      </div>
    </>)}
  </>);
}

// ============================================================================
// MIS DASHBOARD  CFO / Management View
// ============================================================================
function MISDashboard({data, balances, setPage}){
  const getBal = (id) => balances[id] || 0;
  const opening = (id) => (data.coa.find(a => a.id === id)?.opening || 0);
  
  // Revenue & Expense
  const income = data.coa.filter(a => a.type==='Income').reduce((s,a) => s + (-getBal(a.id)), 0);
  const expense = data.coa.filter(a => a.type==='Expense').reduce((s,a) => s + getBal(a.id), 0);
  const profit = income - expense;
  const revOps = data.coa.filter(a => a.group==='Revenue from Operations').reduce((s,a) => s + (-getBal(a.id)), 0);
  const costMat = data.coa.filter(a => a.group==='Cost of Materials' || a.group==='Purchase of Stock-in-Trade').reduce((s,a) => s + getBal(a.id), 0);
  const grossProfit = revOps - costMat;
  const empCost = data.coa.filter(a => a.group==='Employee Benefit Expenses').reduce((s,a) => s + getBal(a.id), 0);
  const finCost = data.coa.filter(a => a.group==='Finance Costs').reduce((s,a) => s + getBal(a.id), 0);
  const depr = getBal('4400');
  const otherExp = data.coa.filter(a => a.group==='Other Expenses').reduce((s,a) => s + getBal(a.id), 0);
  const ebitda = profit + finCost + depr;
  const ebit = profit + finCost;

  // Balance sheet items
  const cash = getBal('2500') + getBal('2510') + getBal('2511') + getBal('2520');
  const debtors = getBal('2400');
  const creditors = -getBal('1300');
  const inventory = getBal('2300') + getBal('2310');
  const totalAssets = data.coa.filter(a => a.type==='Asset' && !a.contra).reduce((s,a) => s + getBal(a.id), 0) + getBal('2130');
  const totalLiab = data.coa.filter(a => a.type==='Liability').reduce((s,a) => s + (-getBal(a.id)), 0);
  const totalEquity = data.coa.filter(a => a.type==='Equity').reduce((s,a) => s + (-getBal(a.id)), 0) + profit;
  const ltBorrow = -getBal('1200');
  const currentAssets = data.coa.filter(a => a.type==='Asset' && (a.group==='Current Assets')).reduce((s,a) => s + getBal(a.id), 0);
  const currentLiab = data.coa.filter(a => a.type==='Liability' && a.group==='Current Liabilities').reduce((s,a) => s + (-getBal(a.id)), 0);
  
  // GST position
  const gstOutput = -(getBal('1310')+getBal('1311')+getBal('1312'));
  const gstInput = getBal('2600')+getBal('2601')+getBal('2602');
  const gstNet = gstOutput - gstInput;

  // Monthly revenue trend from vouchers
  const monthlyData = useMemo(() => {
    const months = {};
    for(let m = 4; m <= 12; m++){
      const key = data.company.fyStart?.slice(0,4) + '-' + String(m).padStart(2,'0');
      months[key] = {revenue:0, expense:0, profit:0, vouchers:0};
    }
    for(let m = 1; m <= 3; m++){
      const year = parseInt(data.company.fyStart?.slice(0,4)||2025) + 1;
      const key = year + '-' + String(m).padStart(2,'0');
      months[key] = {revenue:0, expense:0, profit:0, vouchers:0};
    }
    data.vouchers.filter(v => v.status !== 'Cancelled').forEach(v => {
      const key = v.date.slice(0,7);
      if(months[key]){
        months[key].vouchers++;
        if(v.type === 'SAL' || v.type === 'CRN'){
          months[key].revenue += v.total || v.amount || 0;
        }
        if(v.type === 'PUR' || v.type === 'DBN'){
          months[key].expense += v.total || v.amount || 0;
        }
      }
    });
    Object.values(months).forEach(m => m.profit = m.revenue - m.expense);
    return months;
  }, [data.vouchers, data.company.fyStart]);

  const maxRevenue = Math.max(1, ...Object.values(monthlyData).map(m => Math.max(m.revenue, m.expense)));

  // ── Cash Runway & Burn (startup-critical MIS) ──
  const activeMonths   = Math.max(1, Object.values(monthlyData).filter(m => m.vouchers > 0).length);
  const avgMonthlyExp  = expense / activeMonths;
  const avgMonthlyInc  = income / activeMonths;
  const monthlyBurn    = avgMonthlyExp - avgMonthlyInc;            // >0 ⇒ burning cash
  const runwayMonths   = monthlyBurn > 0 ? cash / monthlyBurn : Infinity;
  const runwayLabel    = monthlyBurn <= 0 ? 'Cash-positive' : (runwayMonths >= 99 ? '99+ mo' : runwayMonths.toFixed(1) + ' mo');

  // One-click MIS pack - bundles the core management reports into one workbook
  const monNames3 = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const handleMISPack = () => {
    const hdr = `CFO MIS Pack  ${data.company.name}  FY ${data.company.fyStart?.slice(0,4)}–${data.company.fyEnd?.slice(2,4)}  as on ${today()}`;
    exportXLSX(`MIS_Pack_${today()}.xlsx`, [
      {name:'KPIs', rows:[
        [hdr],[],
        ['Metric','Value (₹)'],
        ['Revenue', income],['Gross Profit', grossProfit],['EBITDA', ebitda],['EBIT', ebit],
        ['Net Profit', profit],['Total Expenses', expense],[],
        ['Cash & Bank', cash],['Trade Receivables', debtors],['Trade Payables', creditors],
        ['Inventory', inventory],['Working Capital', currentAssets-currentLiab],['GST Net Payable', gstNet],[],
        ['Avg Monthly Burn', monthlyBurn>0?monthlyBurn:0],
        ['Cash Runway (months)', monthlyBurn>0?Number(runwayMonths.toFixed(1)):'No burn'],
        ['Avg Monthly Revenue', avgMonthlyInc],
      ]},
      {name:'Monthly Trend', rows:[
        ['Month','Revenue','Expense','Net','Vouchers'],
        ...Object.entries(monthlyData).map(([k,m])=>[monNames3[parseInt(k.slice(5))]+' '+k.slice(0,4), m.revenue, m.expense, m.profit, m.vouchers]),
      ]},
      {name:'Top Parties', rows:[
        ['Party','Sales','Purchases','Total Value'],
        ...topParties.map(p=>[p.name, p.sales, p.purchases, p.sales+p.purchases]),
      ]},
      {name:'Expense Breakdown', rows:[
        ['Expense Group','Amount','% of Total'],
        ...expBreakdown.map(([g,a])=>[g, a, expense>0?Number((a/expense*100).toFixed(1)):0]),
      ]},
    ]);
  };

  // Top customers / vendors
  const topParties = useMemo(() => {
    const map = {};
    data.vouchers.filter(v => v.status !== 'Cancelled' && v.partyId).forEach(v => {
      if(!map[v.partyId]) map[v.partyId] = {name: v.partyName, sales:0, purchases:0};
      if(v.type==='SAL') map[v.partyId].sales += v.total || v.amount || 0;
      if(v.type==='PUR') map[v.partyId].purchases += v.total || v.amount || 0;
    });
    return Object.values(map).sort((a,b) => (b.sales+b.purchases) - (a.sales+a.purchases)).slice(0,5);
  }, [data.vouchers]);

  // Expense breakdown
  const expBreakdown = useMemo(() => {
    const groups = {};
    data.coa.filter(a => a.type==='Expense').forEach(a => {
      const bal = getBal(a.id);
      if(bal > 0){
        if(!groups[a.group]) groups[a.group] = 0;
        groups[a.group] += bal;
      }
    });
    return Object.entries(groups).sort((a,b) => b[1] - a[1]);
  }, [data.coa, balances]);

  // DSO / DPO trend - rolling receivable & payable days at each month-end (YTD basis)
  const cycleTrend = useMemo(() => {
    const keys = Object.keys(monthlyData);          // FY order Apr → Mar
    const openAR =  (data.coa.find(a=>a.id==='2400')||{}).opening || 0;
    const openAP = -((data.coa.find(a=>a.id==='1300')||{}).opening || 0);
    const fyStart = new Date(data.company.fyStart || (keys[0]+'-01'));
    let cumAR = openAR, cumAP = openAP, cumSales = 0, cumPurch = 0;
    return keys.map(key => {
      let arMove = 0, apMove = 0, saleM = 0, purM = 0;
      (data.vouchers||[]).forEach(v => {
        if(v.status==='Cancelled' || v.date.slice(0,7)!==key) return;
        (v.lines||[]).forEach(l => {
          if(l.accountId==='2400') arMove += (l.debit||0)-(l.credit||0);
          if(l.accountId==='1300') apMove += (l.credit||0)-(l.debit||0);
        });
        if(v.type==='SAL') saleM += v.total||v.amount||0;
        if(v.type==='PUR') purM += v.total||v.amount||0;
      });
      cumAR += arMove; cumAP += apMove; cumSales += saleM; cumPurch += purM;
      const [y,mo] = key.split('-').map(Number);
      const monthEnd = new Date(y, mo, 0);
      const days = Math.max(1, Math.round((monthEnd - fyStart)/86400000));
      return { key, mon:mo,
        dso: cumSales>0 ? Math.max(0, Math.round(cumAR/cumSales*days)) : 0,
        dpo: cumPurch>0 ? Math.max(0, Math.round(cumAP/cumPurch*days)) : 0,
        active: saleM>0 || purM>0 };
    });
  }, [data.vouchers, data.coa, data.company.fyStart, monthlyData]);

  const pctOf = (part, whole) => whole ? ((part/whole)*100).toFixed(1) + '%' : '0%';
  const kpiCard = (label, value, sub, cls='') => (
    React.createElement('div', {className:'stat ' + cls},
      React.createElement('div', {className:'stat-label'}, label),
      React.createElement('div', {className:'stat-value rupee'}, value),
      sub && React.createElement('div', {className:'stat-delta'}, sub)
    )
  );

  const barWidth = (v) => Math.max(2, (v/maxRevenue)*100) + '%';
  const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">CFO Dashboard</h1>
          <div className="page-sub">MIS analytics · {data.company.name} · FY {data.company.fyStart?.slice(0,4)}–{data.company.fyEnd?.slice(2,4)}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setPage('mis_ratios')}>▦ Financial Ratios</button>
          <button className="btn" onClick={() => setPage('mis_aging')}>◫ Aging</button>
          <button className="btn btn-primary" onClick={handleMISPack}>⬇ MIS Pack (Excel)</button>
          <button className="btn btn-primary" onClick={() => generateReportBundle(data, balances)}>⎙ PDF Bundle</button>
          <button className="btn" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      {/* P&L KPIs */}
      <div style={{marginBottom:6, display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, color:'var(--ink-3)'}}>Profitability</span>
        <span style={{flex:1, height:1, background:'var(--line)'}}></span>
      </div>
      <div className="stat-grid" style={{gridTemplateColumns:'repeat(6,1fr)'}}>
        {kpiCard('Revenue', '₹'+fmt(income), 'All income streams')}
        {kpiCard('Gross Profit', '₹'+fmt(grossProfit), 'GP Margin: ' + pctOf(grossProfit, revOps), 'stat-gold')}
        {kpiCard('EBITDA', '₹'+fmt(ebitda), 'EBITDA Margin: ' + pctOf(ebitda, income), 'stat-info')}
        {kpiCard('EBIT', '₹'+fmt(ebit), 'Operating margin')}
        {kpiCard('Net Profit', '₹'+fmt(profit), 'PAT Margin: ' + pctOf(profit, income), profit>=0?'':'stat-danger')}
        {kpiCard('Total Expenses', '₹'+fmt(expense), 'Expense ratio: ' + pctOf(expense, income), 'stat-danger')}
      </div>

      {/* Balance Sheet KPIs */}
      <div style={{marginBottom:6, marginTop:18, display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, color:'var(--ink-3)'}}>Balance Sheet & Liquidity</span>
        <span style={{flex:1, height:1, background:'var(--line)'}}></span>
      </div>
      <div className="stat-grid" style={{gridTemplateColumns:'repeat(6,1fr)'}}>
        {kpiCard('Cash & Bank', '₹'+fmt(cash), 'Liquid assets')}
        {kpiCard('Trade Receivables', '₹'+fmt(debtors), 'Days: ' + (revOps>0 ? Math.round(debtors/revOps*365) : '∞'), 'stat-info')}
        {kpiCard('Trade Payables', '₹'+fmt(creditors), 'Days: ' + (costMat>0 ? Math.round(creditors/costMat*365) : '∞'), 'stat-gold')}
        {kpiCard('Inventory', '₹'+fmt(inventory), 'Turnover days: ' + (costMat>0 ? Math.round(inventory/costMat*365) : '∞'))}
        {kpiCard('Working Capital', '₹'+fmt(currentAssets-currentLiab), currentAssets-currentLiab>0?'Healthy':'Stretched', currentAssets-currentLiab>=0?'':'stat-danger')}
        {kpiCard('GST Net Payable', '₹'+fmt(gstNet), 'Output: ₹'+fmt(gstOutput)+' | ITC: ₹'+fmt(gstInput), 'stat-gold')}
      </div>

      {/* Startup Liquidity: Cash Runway & Burn */}
      <div style={{marginBottom:6, marginTop:18, display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600, color:'var(--ink-3)'}}>Cash Runway & Burn</span>
        <span style={{flex:1, height:1, background:'var(--line)'}}></span>
      </div>
      <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {kpiCard('Avg Monthly Burn', monthlyBurn>0?'₹'+fmt(monthlyBurn):'₹0', monthlyBurn>0?'Net cash outflow / month':'Operating cash-positive', monthlyBurn>0?'stat-danger':'')}
        {kpiCard('Cash Runway', runwayLabel, monthlyBurn>0?'At current burn rate':'No burn - not cash-constrained', (monthlyBurn>0&&runwayMonths<6)?'stat-danger':'stat-info')}
        {kpiCard('Avg Monthly Revenue', '₹'+fmt(avgMonthlyInc), 'Over '+activeMonths+' active month'+(activeMonths>1?'s':''))}
        {kpiCard('Cash on Hand', '₹'+fmt(cash), monthlyBurn>0?('Covers '+runwayMonths.toFixed(1)+' months'):'Liquid runway healthy', 'stat-gold')}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'5fr 3fr', gap:18, marginTop:18}}>
        {/* Monthly Revenue vs Expense chart */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Monthly Revenue vs Expenses</h3></div>
          <div className="card-body" style={{padding:'14px 18px'}}>
            <div style={{display:'flex', gap:14, marginBottom:12, fontSize:11}}>
              <span><span style={{display:'inline-block',width:10,height:10,background:'var(--primary)',borderRadius:2,marginRight:4}}></span> Revenue</span>
              <span><span style={{display:'inline-block',width:10,height:10,background:'var(--danger)',borderRadius:2,marginRight:4}}></span> Expenses</span>
              <span><span style={{display:'inline-block',width:10,height:10,background:'var(--accent)',borderRadius:2,marginRight:4}}></span> Net</span>
            </div>
            {Object.entries(monthlyData).map(([key, m]) => {
              const mon = parseInt(key.slice(5));
              return (
                <div key={key} style={{display:'flex', alignItems:'center', gap:8, marginBottom:5}}>
                  <span style={{width:35, fontSize:11, color:'var(--ink-3)', fontWeight:600, textAlign:'right'}}>{monthNames[mon]}</span>
                  <div style={{flex:1, position:'relative', height:18}}>
                    <div style={{position:'absolute', top:0, left:0, height:8, width:barWidth(m.revenue), background:'var(--primary)', borderRadius:3, opacity:.85}}></div>
                    <div style={{position:'absolute', top:9, left:0, height:8, width:barWidth(m.expense), background:'var(--danger)', borderRadius:3, opacity:.7}}></div>
                  </div>
                  <span style={{width:70, fontSize:10.5, fontFamily:'var(--mono)', textAlign:'right', color:m.revenue>0?'var(--ink-2)':'var(--ink-3)'}}>{m.revenue>0?'₹'+fmt(m.revenue,0):''}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Expense Breakdown</h3></div>
          <div className="card-body" style={{padding:'14px 18px'}}>
            {expBreakdown.length === 0 ? (
              <div className="empty" style={{padding:30}}>No expenses recorded yet</div>
            ) : (
              expBreakdown.map(([group, amt], i) => {
                const colors = ['var(--primary)','var(--accent)','var(--info)','var(--danger)','#6b7f78','#c9a227'];
                const pct = expense > 0 ? (amt/expense*100) : 0;
                return (
                  <div key={group} style={{marginBottom:10}}>
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3}}>
                      <span style={{fontWeight:500}}>{group}</span>
                      <span style={{fontFamily:'var(--mono)', color:'var(--ink-2)'}}>₹{fmt(amt)} <span style={{color:'var(--ink-3)', fontSize:10}}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{height:6, background:'var(--line)', borderRadius:3, overflow:'hidden'}}>
                      <div style={{height:'100%', width:pct+'%', background:colors[i%colors.length], borderRadius:3, transition:'width .3s'}}></div>
                    </div>
                  </div>
                );
              })
            )}
            {expense > 0 && (
              <div style={{marginTop:14, paddingTop:10, borderTop:'1px solid var(--line)', fontWeight:600, display:'flex', justifyContent:'space-between', fontSize:13}}>
                <span>Total Expenses</span>
                <span className="rupee">₹{fmt(expense)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginTop:18}}>
        {/* Top parties */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Top Customers & Vendors</h3></div>
          <div style={{overflow:'auto'}}>
            <table>
              <thead><tr><th>Party</th><th className="num">Sales</th><th className="num">Purchases</th><th className="num">Total Value</th></tr></thead>
              <tbody>
                {topParties.length === 0 ? <tr><td colSpan="4"><div className="empty" style={{padding:20}}>No party transactions yet</div></td></tr> :
                topParties.map((p,i) => (
                  <tr key={i}>
                    <td><b>{p.name}</b></td>
                    <td className="num">{p.sales>0?'₹'+fmt(p.sales):''}</td>
                    <td className="num">{p.purchases>0?'₹'+fmt(p.purchases):''}</td>
                    <td className="num bold">₹{fmt(p.sales+p.purchases)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capital structure */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Capital Structure & Leverage</h3></div>
          <div className="card-body">
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div style={{background:'var(--primary-soft)', padding:14, borderRadius:8, textAlign:'center'}}>
                <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:1, color:'var(--primary)', fontWeight:600, marginBottom:4}}>Total Equity</div>
                <div style={{fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'var(--primary)'}}>₹{fmt(totalEquity)}</div>
              </div>
              <div style={{background:'var(--danger-soft)', padding:14, borderRadius:8, textAlign:'center'}}>
                <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:1, color:'var(--danger)', fontWeight:600, marginBottom:4}}>Total Debt</div>
                <div style={{fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'var(--danger)'}}>₹{fmt(ltBorrow)}</div>
              </div>
            </div>
            <div style={{marginTop:14}}>
              <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line)', fontSize:12}}>
                <span>Debt-to-Equity</span>
                <b style={{fontFamily:'var(--mono)'}}>{totalEquity>0?(ltBorrow/totalEquity).toFixed(2):'N/A'}</b>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line)', fontSize:12}}>
                <span>Interest Coverage (EBIT/Interest)</span>
                <b style={{fontFamily:'var(--mono)'}}>{finCost>0?(ebit/finCost).toFixed(2):'∞'}</b>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--line)', fontSize:12}}>
                <span>ROE (PAT/Equity)</span>
                <b style={{fontFamily:'var(--mono)'}}>{totalEquity>0?((profit/totalEquity)*100).toFixed(1)+'%':'N/A'}</b>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:12}}>
                <span>ROA (PAT/Total Assets)</span>
                <b style={{fontFamily:'var(--mono)'}}>{totalAssets>0?((profit/totalAssets)*100).toFixed(1)+'%':'N/A'}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash position waterfall */}
      <div className="card" style={{marginTop:18}}>
        <div className="card-head"><h3 className="card-title">Cash & Bank  Account-wise Breakdown</h3></div>
        <div style={{overflow:'auto'}}>
          <table>
            <thead><tr><th>Account</th><th className="num">Opening</th><th className="num">Current</th><th className="num">Movement</th><th>% of Total Cash</th></tr></thead>
            <tbody>
              {data.coa.filter(a => a.schedule === 'Cash & Equivalents').map(a => {
                const curr = getBal(a.id);
                const op = a.opening || 0;
                const mov = curr - op;
                return (
                  <tr key={a.id}>
                    <td><b>{a.name}</b>{a.currency && a.currency!=='INR' && <span className="badge badge-gold" style={{marginLeft:6}}>{a.currency}</span>}</td>
                    <td className="num">₹{fmt(op)}</td>
                    <td className="num bold">₹{fmt(curr)}</td>
                    <td className={'num '+(mov>=0?'pos':'neg')}>₹{fmt(mov)}</td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div style={{flex:1, height:6, background:'var(--line)', borderRadius:3, overflow:'hidden'}}>
                          <div style={{height:'100%', width:(cash>0?(Math.abs(curr)/cash*100):0)+'%', background:'var(--primary)', borderRadius:3}}></div>
                        </div>
                        <span style={{fontFamily:'var(--mono)', fontSize:11, minWidth:40, textAlign:'right'}}>{cash>0?((Math.abs(curr)/cash)*100).toFixed(0)+'%':''}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="total">
                <td>Total Cash & Bank</td>
                <td className="num">₹{fmt(data.coa.filter(a => a.schedule==='Cash & Equivalents').reduce((s,a) => s + (a.opening||0), 0))}</td>
                <td className="num">₹{fmt(cash)}</td>
                <td className="num">₹{fmt(cash - data.coa.filter(a => a.schedule==='Cash & Equivalents').reduce((s,a) => s + (a.opening||0), 0))}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Working-capital cycle - DSO vs DPO trend */}
      <div className="card" style={{marginTop:18}}>
        <div className="card-head"><h3 className="card-title">Working-Capital Cycle - DSO vs DPO (YTD trend)</h3></div>
        <div className="card-body" style={{padding:'14px 18px'}}>
          {(() => {
            const pts = cycleTrend.filter(r=>r.active);
            if(pts.length < 2) return <div className="empty" style={{padding:24}}>Not enough monthly data yet to plot a trend.</div>;
            const W=680, H=210, padL=34, padR=12, padT=14, padB=26;
            const maxV = Math.max(30, ...pts.map(r=>Math.max(r.dso, r.dpo)));
            const xx = i => padL + (i/(pts.length-1))*(W-padL-padR);
            const yy = v => padT + (1 - v/maxV)*(H-padT-padB);
            const poly = key => pts.map((r,i)=>`${xx(i).toFixed(1)},${yy(r[key]).toFixed(1)}`).join(' ');
            const grid = [0,0.25,0.5,0.75,1].map(f => ({v: Math.round(maxV*(1-f)), y: padT + f*(H-padT-padB)}));
            const last = pts[pts.length-1];
            return (<>
              <div style={{display:'flex',gap:16,marginBottom:8,fontSize:11,flexWrap:'wrap'}}>
                <span><span style={{display:'inline-block',width:12,height:3,background:'var(--info)',marginRight:5,verticalAlign:'middle'}}></span>DSO - collection days</span>
                <span><span style={{display:'inline-block',width:12,height:3,background:'var(--accent)',marginRight:5,verticalAlign:'middle'}}></span>DPO - payment days</span>
                <span style={{marginLeft:'auto',color:'var(--ink-3)'}}>Lower DSO & higher DPO ⇒ healthier cash cycle</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}}>
                {grid.map((g,i)=>(
                  <g key={i}>
                    <line x1={padL} y1={g.y} x2={W-padR} y2={g.y} stroke="var(--line)" strokeWidth="1" />
                    <text x={padL-6} y={g.y+3} textAnchor="end" fontSize="9" fill="var(--ink-3)">{g.v}</text>
                  </g>
                ))}
                {pts.map((r,i)=>(<text key={i} x={xx(i)} y={H-8} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{monthNames[r.mon]}</text>))}
                <polyline points={poly('dpo')} fill="none" stroke="var(--accent)" strokeWidth="2" />
                <polyline points={poly('dso')} fill="none" stroke="var(--info)" strokeWidth="2" />
                {pts.map((r,i)=>(<circle key={'p'+i} cx={xx(i)} cy={yy(r.dpo)} r="2.5" fill="var(--accent)" />))}
                {pts.map((r,i)=>(<circle key={'s'+i} cx={xx(i)} cy={yy(r.dso)} r="2.5" fill="var(--info)" />))}
              </svg>
              <div style={{display:'flex',justifyContent:'space-around',marginTop:8,fontSize:12,flexWrap:'wrap',gap:8}}>
                <span>Latest DSO: <b style={{color:'var(--info)'}}>{last.dso} days</b></span>
                <span>Latest DPO: <b style={{color:'var(--accent)'}}>{last.dpo} days</b></span>
                <span>Net cash gap (DSO−DPO): <b style={{color: last.dso-last.dpo>0?'var(--danger)':'var(--primary)'}}>{last.dso-last.dpo} days</b></span>
              </div>
            </>);
          })()}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// FINANCIAL RATIOS
// ============================================================================
function FinancialRatios({data, balances}){
  const getBal = (id) => balances[id] || 0;
  const income = data.coa.filter(a => a.type==='Income').reduce((s,a) => s + (-getBal(a.id)), 0);
  const expense = data.coa.filter(a => a.type==='Expense').reduce((s,a) => s + getBal(a.id), 0);
  const profit = income - expense;
  const revOps = data.coa.filter(a => a.group==='Revenue from Operations').reduce((s,a) => s + (-getBal(a.id)), 0);
  const costMat = data.coa.filter(a => a.group==='Cost of Materials' || a.group==='Purchase of Stock-in-Trade').reduce((s,a) => s + getBal(a.id), 0);
  const grossProfit = revOps - costMat;
  const finCost = data.coa.filter(a => a.group==='Finance Costs').reduce((s,a) => s + getBal(a.id), 0);
  const depr = getBal('4400');
  const ebitda = profit + finCost + depr;
  const ebit = profit + finCost;
  const cash = getBal('2500') + getBal('2510') + getBal('2511') + getBal('2520');
  const debtors = getBal('2400');
  const creditors = -getBal('1300');
  const inventory = getBal('2300') + getBal('2310');
  const totalAssets = data.coa.filter(a => a.type==='Asset' && !a.contra).reduce((s,a) => s + getBal(a.id), 0) + getBal('2130');
  const totalEquity = data.coa.filter(a => a.type==='Equity').reduce((s,a) => s + (-getBal(a.id)), 0) + profit;
  const ltBorrow = -getBal('1200');
  const currentAssets = data.coa.filter(a => a.type==='Asset' && a.group==='Current Assets').reduce((s,a) => s + getBal(a.id), 0);
  const currentLiab = data.coa.filter(a => a.type==='Liability' && a.group==='Current Liabilities').reduce((s,a) => s + (-getBal(a.id)), 0);

  const calcRatio = (n, d, dec=2) => d > 0 ? (n/d).toFixed(dec) : 'N/A';
  const calcPct = (n, d) => d > 0 ? ((n/d)*100).toFixed(1)+'%' : 'N/A';

  const categories = [
    {name: 'Profitability Ratios', ratios: [
      {name:'Gross Profit Margin', value:calcPct(grossProfit, revOps), formula:'Gross Profit / Revenue from Ops', benchmark:'30-50%', status: revOps>0&&grossProfit/revOps>.25 ? 'good' : 'warn'},
      {name:'EBITDA Margin', value:calcPct(ebitda, income), formula:'EBITDA / Total Income', benchmark:'15-25%', status: income>0&&ebitda/income>.12 ? 'good' : 'warn'},
      {name:'Net Profit Margin', value:calcPct(profit, income), formula:'PAT / Total Income', benchmark:'8-15%', status: income>0&&profit/income>.05 ? 'good' : 'warn'},
      {name:'Return on Equity (ROE)', value:calcPct(profit, totalEquity), formula:'PAT / Shareholders Funds', benchmark:'> 15%', status: totalEquity>0&&profit/totalEquity>.12 ? 'good' : 'warn'},
      {name:'Return on Assets (ROA)', value:calcPct(profit, totalAssets), formula:'PAT / Total Assets', benchmark:'> 5%', status: totalAssets>0&&profit/totalAssets>.04 ? 'good' : 'warn'},
      {name:'Return on Capital Employed', value:calcPct(ebit, totalEquity + ltBorrow), formula:'EBIT / (Equity + LT Debt)', benchmark:'> 12%', status: 'info'},
    ]},
    {name: 'Liquidity Ratios', ratios: [
      {name:'Current Ratio', value:calcRatio(currentAssets, currentLiab), formula:'Current Assets / Current Liabilities', benchmark:'1.5 - 2.5', status: currentLiab>0&&currentAssets/currentLiab>=1.2 ? 'good' : 'warn'},
      {name:'Quick Ratio (Acid Test)', value:calcRatio(currentAssets - inventory, currentLiab), formula:'(Current Assets − Inventory) / CL', benchmark:'> 1.0', status: currentLiab>0&&(currentAssets-inventory)/currentLiab>=1 ? 'good' : 'warn'},
      {name:'Cash Ratio', value:calcRatio(cash, currentLiab), formula:'Cash & Bank / Current Liabilities', benchmark:'> 0.2', status: 'info'},
      {name:'Working Capital', value:'₹'+fmt(currentAssets-currentLiab), formula:'Current Assets − Current Liabilities', benchmark:'Positive', status: currentAssets>=currentLiab ? 'good' : 'warn'},
    ]},
    {name: 'Activity / Efficiency Ratios', ratios: [
      {name:'Debtor Days (DSO)', value: revOps>0 ? Math.round(debtors/revOps*365)+' days' : 'N/A', formula:'Trade Receivables / Revenue × 365', benchmark:'< 45 days', status: revOps>0&&debtors/revOps*365<60 ? 'good' : 'warn'},
      {name:'Creditor Days (DPO)', value: costMat>0 ? Math.round(creditors/costMat*365)+' days' : 'N/A', formula:'Trade Payables / Purchases × 365', benchmark:'30-60 days', status: 'info'},
      {name:'Inventory Turnover Days', value: costMat>0 ? Math.round(inventory/costMat*365)+' days' : 'N/A', formula:'Inventory / COGS × 365', benchmark:'< 60 days', status: costMat>0&&inventory/costMat*365<90 ? 'good' : 'warn'},
      {name:'Cash Conversion Cycle', value: revOps>0&&costMat>0 ? Math.round(debtors/revOps*365 + inventory/costMat*365 - creditors/costMat*365)+' days' : 'N/A', formula:'DSO + Inv.Days − DPO', benchmark:'< 45 days', status: 'info'},
      {name:'Asset Turnover', value:calcRatio(income, totalAssets)+'x', formula:'Revenue / Total Assets', benchmark:'> 1.0x', status: 'info'},
    ]},
    {name: 'Leverage / Solvency Ratios', ratios: [
      {name:'Debt-to-Equity Ratio', value:calcRatio(ltBorrow, totalEquity), formula:'Long-term Debt / Equity', benchmark:'< 1.0', status: totalEquity>0&&ltBorrow/totalEquity<1.5 ? 'good' : 'warn'},
      {name:'Interest Coverage Ratio', value:calcRatio(ebit, finCost)+'x', formula:'EBIT / Finance Costs', benchmark:'> 3x', status: finCost>0&&ebit/finCost>2 ? 'good' : 'warn'},
      {name:'Debt Service Coverage', value:calcRatio(ebitda, finCost)+'x', formula:'EBITDA / Interest', benchmark:'> 2x', status: 'info'},
      {name:'Equity Ratio', value:calcPct(totalEquity, totalAssets), formula:'Equity / Total Assets', benchmark:'> 50%', status: 'info'},
    ]},
    {name: 'MSME-Specific Ratios', ratios: [
      {name:'Employee Cost to Revenue', value:calcPct(data.coa.filter(a => a.group==='Employee Benefit Expenses').reduce((s,a) => s + getBal(a.id), 0), income), formula:'Employee Costs / Revenue', benchmark:'20-40%', status: 'info'},
      {name:'Rent to Revenue', value:calcPct(getBal('4500'), income), formula:'Rent / Revenue', benchmark:'< 10%', status: income>0&&getBal('4500')/income<.1 ? 'good' : 'warn'},
      {name:'GST ITC Utilisation', value: (-(getBal('1310')+getBal('1311')+getBal('1312')))>0 ? calcPct(getBal('2600')+getBal('2601')+getBal('2602'), -(getBal('1310')+getBal('1311')+getBal('1312'))) : 'N/A', formula:'ITC Claimed / Output Tax', benchmark:'70-90%', status: 'info'},
      {name:'Cash Runway (months)', value: expense>0 ? (cash/(expense/12)).toFixed(1)+' mo' : '∞', formula:'Cash ÷ Monthly Burn', benchmark:'> 3 months', status: expense>0&&cash/(expense/12)>=3 ? 'good' : 'warn'},
    ]},
  ];

  const statusBadge = (s) => s==='good' ? 'badge-success' : s==='warn' ? 'badge-gold' : 'badge-info';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Financial Ratios</h1>
          <div className="page-sub">27 key ratios · Benchmarked for MSME · As on {today()}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      {categories.map(cat => (
        <div className="card" style={{marginBottom:14}} key={cat.name}>
          <div className="card-head"><h3 className="card-title">{cat.name}</h3></div>
          <div style={{overflow:'auto'}}>
            <table>
              <thead><tr><th>Ratio</th><th className="num" style={{width:120}}>Value</th><th>Formula</th><th>MSME Benchmark</th><th style={{width:60}}>Status</th></tr></thead>
              <tbody>
                {cat.ratios.map((r,i) => (
                  <tr key={i}>
                    <td><b>{r.name}</b></td>
                    <td className="num" style={{fontFamily:'var(--mono)', fontWeight:600, fontSize:14}}>{r.value}</td>
                    <td style={{fontSize:11, color:'var(--ink-3)', fontStyle:'italic'}}>{r.formula}</td>
                    <td style={{fontSize:12}}>{r.benchmark}</td>
                    <td><span className={'badge ' + statusBadge(r.status)}>{r.status==='good'?'✓':r.status==='warn'?'⚠':'ℹ'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

// ============================================================================
// AGING ANALYSIS
// ============================================================================
function AgingAnalysis({data, balances}){
  const [view, setView] = useState('receivable');

  const agingBuckets = ['0-30','31-60','61-90','91-180','180+'];
  const todayDate = new Date();

  const vouchers = data.vouchers.filter(v => v.status !== 'Cancelled' && 
    (view === 'receivable' ? v.type === 'SAL' : v.type === 'PUR')
  );

  // Group by party, compute aging on OUTSTANDING amounts (control-account line
  // net of payments/receipts allocated via bill tagging), not gross invoice value
  const partyAging = useMemo(() => {
    // Allocations against each invoice from PAY/REC billTags
    const allocMap = {};
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      (v.billTags||[]).forEach(bt => { allocMap[bt.voucherId] = (allocMap[bt.voucherId]||0) + (bt.allocated||0); });
    });
    const ctrl = view === 'receivable' ? '2400' : '1300';
    const map = {};
    vouchers.forEach(v => {
      // Owed = control-account line (PUR net of TDS) less allocated payments
      const ctrlAmt = (v.lines||[]).reduce((s,l) =>
        s + (l.accountId===ctrl ? (view==='receivable' ? (l.debit||0) : (l.credit||0)) : 0), 0);
      const owed = ctrlAmt || v.total || v.amount || 0;
      const amt = Math.max(0, owed - (allocMap[v.id]||0));
      if(amt <= 0.01) return;   // fully settled  out of ageing
      const party = data.parties.find(p => p.id === v.partyId);
      const name = party?.name || v.partyName || 'Unknown';
      if(!map[name]) map[name] = {name, gstin: party?.gstin||'', buckets:[0,0,0,0,0], total:0};
      const diffDays = Math.floor((todayDate - new Date(v.date)) / (1000*60*60*24));
      let idx = 0;
      if(diffDays <= 30) idx = 0;
      else if(diffDays <= 60) idx = 1;
      else if(diffDays <= 90) idx = 2;
      else if(diffDays <= 180) idx = 3;
      else idx = 4;
      map[name].buckets[idx] += amt;
      map[name].total += amt;
    });
    return Object.values(map).sort((a,b) => b.total - a.total);
  }, [vouchers, data.parties, data.vouchers, view]);

  const totals = agingBuckets.map((_, i) => partyAging.reduce((s, p) => s + p.buckets[i], 0));
  const grandTotal = partyAging.reduce((s, p) => s + p.total, 0);
  const overdue = totals[2] + totals[3] + totals[4];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Aging Analysis</h1>
          <div className="page-sub">{view === 'receivable' ? 'Accounts Receivable' : 'Accounts Payable'} aging schedule · As on {today()}</div>
        </div>
        <div className="page-actions">
          <button className={'btn ' + (view==='receivable'?'btn-primary':'')} onClick={() => setView('receivable')}>Receivables</button>
          <button className={'btn ' + (view==='payable'?'btn-primary':'')} onClick={() => setView('payable')}>Payables</button>
          <button className="btn" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Total Outstanding</div><div className="stat-value rupee">₹{fmt(grandTotal)}</div></div>
        <div className="stat"><div className="stat-label">Current (0-30d)</div><div className="stat-value rupee pos">₹{fmt(totals[0])}</div></div>
        <div className="stat stat-gold"><div className="stat-label">31-60 Days</div><div className="stat-value rupee">₹{fmt(totals[1])}</div></div>
        <div className="stat stat-danger"><div className="stat-label">Overdue (60+ Days)</div><div className="stat-value rupee neg">₹{fmt(overdue)}</div><div className="stat-delta">{grandTotal > 0 ? ((overdue/grandTotal)*100).toFixed(1) : 0}% of total</div></div>
      </div>

      <div className="report" style={{marginTop:14}}>
        <div className="report-head">
          {data.company.logo && <img className="report-logo" src={data.company.logo} alt="Logo" />}
          <div className="report-co">{data.company.name}</div>
          <div className="report-title">{view === 'receivable' ? 'Accounts Receivable' : 'Accounts Payable'} Aging Schedule</div>
          <div className="report-period">As on {today()}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Party</th>
              <th style={{fontSize:10}}>GSTIN</th>
              {agingBuckets.map(b => <th key={b} className="num">{b} days</th>)}
              <th className="num">Total</th>
              <th style={{width:100}}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {partyAging.length === 0 ? (
              <tr><td colSpan={agingBuckets.length+3}><div className="empty" style={{padding:30}}>No {view === 'receivable' ? 'sales' : 'purchase'} invoices found. Post invoices via Vouchers to see aging.</div></td></tr>
            ) : partyAging.map((p, i) => {
              const overdueAmt = p.buckets[2]+p.buckets[3]+p.buckets[4];
              const risk = overdueAmt > p.total*0.5 ? 'High' : overdueAmt > 0 ? 'Medium' : 'Low';
              return (
                <tr key={i}>
                  <td><b>{p.name}</b></td>
                  <td style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-3)'}}>{p.gstin||'URD'}</td>
                  {p.buckets.map((b,j) => <td key={j} className="num" style={{color: j>=2 && b>0 ? 'var(--danger)' : 'inherit'}}>{b>0?fmt(b):''}</td>)}
                  <td className="num bold">₹{fmt(p.total)}</td>
                  <td><span className={'badge ' + (risk==='High'?'badge-danger':risk==='Medium'?'badge-gold':'badge-success')}>{risk}</span></td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan="2">TOTAL</td>
              {totals.map((t,i) => <td key={i} className="num">₹{fmt(t)}</td>)}
              <td className="num">₹{fmt(grandTotal)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div className="report-foot">
          <span>MiyeeBooks Aging Report · Generated {new Date().toLocaleString('en-IN')}</span>
          <span>Follow up on 60+ day overdue amounts immediately</span>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// DATA MANAGEMENT  Export / Import JSON
// ============================================================================
function DataManagement({data, setData, showToast}){
  const fileRef = useRef(null);

  const exportJSON = () => {
    const exportData = {
      ...data,
      _meta: {
        app: 'MiyeeBooks',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'MiyeeBooks MSME Accounting Suite · Built by Vipin Nair',
        company: data.company.name,
        gstin: data.company.gstin,
        fy: data.company.fyStart + ' to ' + data.company.fyEnd,
      }
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MiyeeBooks_' + data.company.name.replace(/[^a-zA-Z0-9]/g,'_') + '_' + today() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        // Validate structure
        if(!imported.company || !imported.coa || !imported.vouchers){
          showToast('Invalid file: missing required fields (company, coa, vouchers)', 'error');
          return;
        }
        if(!confirm('This will REPLACE all current data with the imported file.\n\nCompany: ' + (imported.company.name||'Unknown') + '\nAccounts: ' + (imported.coa?.length||0) + '\nVouchers: ' + (imported.vouchers?.length||0) + '\n\nProceed?')) return;
        // Remove meta before setting
        const {_meta, ...cleanData} = imported;
        setData(cleanData);
        showToast('Data imported: ' + (imported.company.name||'') + '  ' + (imported.vouchers?.length||0) + ' vouchers');
      } catch(err){
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportCSVVouchers = () => {
    const headers = ['Date','Number','Type','Party','Narration','Amount','Status','Account','Debit','Credit'];
    const rows = [];
    data.vouchers.forEach(v => {
      (v.lines||[]).forEach((l,i) => {
        const acc = data.coa.find(a => a.id === l.accountId);
        rows.push([
          v.date, v.number, v.type, v.partyName||'', i===0?(v.narration||''):'',
          i===0?(v.amount||0):'', v.status||'Posted',
          (acc?.name||l.accountId), l.debit||0, l.credit||0
        ].map(c => '"' + String(c).replace(/"/g,'""') + '"').join(','));
      });
    });
    const csv = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MiyeeBooks_Vouchers_' + today() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Vouchers exported as CSV');
  };

  const exportCSVCOA = () => {
    const headers = ['Code','Name','Type','Group','Schedule','Opening Balance'];
    const rows = data.coa.map(a => [a.id, a.name, a.type, a.group, a.schedule, a.opening||0].map(c => '"' + String(c).replace(/"/g,'""') + '"').join(','));
    const csv = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MiyeeBooks_COA_' + today() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chart of Accounts exported as CSV');
  };

  // Data summary
  const sizeKB = (new Blob([JSON.stringify(data)])).size / 1024;

  const loadSample = () => {
    const sample = buildSampleData();
    // Self-check: confirm the books tally before loading
    const bal = {};
    sample.coa.forEach(a => { bal[a.id] = a.opening || 0; });
    sample.vouchers.forEach(v => { if(v.status!=='Cancelled') (v.lines||[]).forEach(l => {
      bal[l.accountId] = (bal[l.accountId]||0) + (l.debit||0) - (l.credit||0);
    });});
    const totalDr = Object.values(bal).reduce((s,b)=>s+(b>0?b:0),0);
    const totalCr = Object.values(bal).reduce((s,b)=>s+(b<0?-b:0),0);
    const diff = Math.round((totalDr-totalCr)*100)/100;
    if(Math.abs(diff) > 0.01){
      showToast('Sample data tally error: Dr ₹'+fmt(totalDr)+' vs Cr ₹'+fmt(totalCr)+' (diff '+fmt(diff)+')', 'error');
      return;
    }
    if(!confirm(
      'Load complete SAMPLE DATA?\n\n'+
      'This REPLACES all current data with a fully-tallied demo company:\n'+
      '• '+sample.vouchers.length+' vouchers (Sales, Purchase, Payment, Receipt, JV, Contra, Credit/Debit Notes)\n'+
      '• GST: intra-state, inter-state & export · TDS: 194C / 194J / 194I\n'+
      '• 4 months payroll (PF, PT, TDS) · '+sample.employees.length+' employees\n'+
      '• Cost Centres, Departments, bill-tagged receipts/payments\n\n'+
      '✓ Trial Balance tallies: Dr = Cr = ₹'+fmt(totalDr)+'\n\n'+
      'Proceed? (Export a backup first if you have real data.)'
    )) return;
    setData(sample);
    showToast('✓ Sample data loaded  '+sample.vouchers.length+' vouchers · Books tally at ₹'+fmt(totalDr));
  };

  // Subsidiary sample - the mirror side of the holding sample's intercompany entries
  const loadSubSample = () => {
    const sample = buildSampleSubsidiaryData();
    const bal = {};
    sample.coa.forEach(a => { bal[a.id] = a.opening || 0; });
    sample.vouchers.forEach(v => { if(v.status!=='Cancelled') (v.lines||[]).forEach(l => {
      bal[l.accountId] = (bal[l.accountId]||0) + (l.debit||0) - (l.credit||0);
    });});
    const totalDr = Object.values(bal).reduce((s,b)=>s+(b>0?b:0),0);
    const totalCr = Object.values(bal).reduce((s,b)=>s+(b<0?-b:0),0);
    if(Math.abs(totalDr-totalCr) > 0.01){ showToast('Subsidiary sample tally error: Dr ₹'+fmt(totalDr)+' vs Cr ₹'+fmt(totalCr), 'error'); return; }
    if(!confirm(
      'Load SUBSIDIARY sample data ("Demo Trading Co Pvt Ltd")?\n\n'+
      'This REPLACES this company\'s data with the mirror side of the holding\n'+
      'sample\'s intercompany entries:\n'+
      '• Purchases ₹2,00,000 from Demo Manufacturing Co (part-paid, ₹1,18,000 open)\n'+
      '• Services billed ₹50,000 to the holding (unpaid)\n'+
      '• Plus its own external sale & expenses\n\n'+
      'Load it in a company created as "Subsidiary of Demo Manufacturing Co",\n'+
      'then open Group Consolidation → Eliminations to see the auto-matching.\n\n'+
      '✓ Books tally: Dr = Cr = ₹'+fmt(totalDr)
    )) return;
    setData(sample);
    showToast('✓ Subsidiary sample loaded - open Group Consolidation to see eliminations');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Data Management</h1>
          <div className="page-sub">Export, import & backup your MiyeeBooks data</div>
        </div>
      </div>

      {/* Sample data loader */}
      <div className="card" style={{marginBottom:18, border:'1px solid var(--primary)', background:'var(--primary-soft)'}}>
        <div className="card-body" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
          <div>
            <div style={{fontWeight:700, fontSize:14, marginBottom:3}}>🎁 Load Complete Sample Data</div>
            <div style={{fontSize:12, color:'var(--ink-2)', maxWidth:620}}>
              A fully-tallied FY 2025-26 demo company  50+ vouchers across every type, GST (intra/inter/export),
              TDS (194C/J/I), 4 months of payroll, cost centres &amp; departments, and bill-tagged settlements.
              Perfect for exploring every report. <b>Replaces current data.</b>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button className="btn btn-primary" onClick={loadSample} style={{padding:'12px 22px', fontWeight:700, whiteSpace:'nowrap'}}>
              🎁 Load Sample Data
            </button>
            <button className="btn" onClick={loadSubSample} style={{whiteSpace:'nowrap',fontSize:11.5}}
              title="Mirror books for the intercompany demo - load this in a company created as 'Subsidiary of Demo Manufacturing Co'">
              🏢 Load Subsidiary Sample
            </button>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Accounts</div><div className="stat-value">{data.coa.length}</div></div>
        <div className="stat stat-info"><div className="stat-label">Parties</div><div className="stat-value">{data.parties.length}</div></div>
        <div className="stat stat-gold"><div className="stat-label">Vouchers</div><div className="stat-value">{data.vouchers.length}</div></div>
        <div className="stat"><div className="stat-label">Data Size</div><div className="stat-value">{sizeKB.toFixed(1)} KB</div><div className="stat-delta">localStorage</div></div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginTop:18}}>
        {/* Export */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Export Data</h3></div>
          <div className="card-body">
            <p style={{fontSize:12, color:'var(--ink-2)', marginBottom:14}}>Download a complete backup of all your MiyeeBooks data. The JSON file contains company profile, chart of accounts, parties, vouchers, forex rates, and GST data.</p>
            
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <button className="btn btn-primary" onClick={exportJSON} style={{justifyContent:'center', padding:'12px 16px'}}>
                ⬇ Export Full Backup (JSON)
              </button>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                <button className="btn" onClick={exportCSVVouchers}>⬇ Vouchers CSV</button>
                <button className="btn" onClick={exportCSVCOA}>⬇ COA CSV</button>
              </div>
            </div>
            
            <div style={{marginTop:14, padding:12, background:'var(--surface-2)', borderRadius:8, fontSize:11, color:'var(--ink-3)'}}>
              <b>Tip:</b> Take a backup before importing data or making bulk changes. The JSON export includes all masters and transactions  you can restore from it anytime.
            </div>
          </div>
        </div>

        {/* Import */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Import Data</h3></div>
          <div className="card-body">
            <p style={{fontSize:12, color:'var(--ink-2)', marginBottom:14}}>Restore from a previously exported MiyeeBooks JSON backup. This will <b style={{color:'var(--danger)'}}>replace all current data</b>  export a backup first if needed.</p>

            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{display:'none'}} />
            <button className="btn btn-accent" onClick={() => fileRef.current?.click()} style={{justifyContent:'center', padding:'12px 16px', width:'100%'}}>
              ⬆ Import from JSON File
            </button>

            <div style={{marginTop:18, padding:14, border:'2px dashed var(--line-2)', borderRadius:8, textAlign:'center', cursor:'pointer', color:'var(--ink-3)'}} onClick={() => fileRef.current?.click()}>
              <div style={{fontSize:28, opacity:.3, marginBottom:6}}>☁</div>
              <div style={{fontSize:12}}>Drag & drop your backup JSON here</div>
              <div style={{fontSize:11, marginTop:4}}>or click to browse</div>
            </div>

            <div style={{marginTop:14, padding:12, background:'var(--danger-soft)', borderRadius:8, fontSize:11, color:'var(--danger)'}}>
              <b>Warning:</b> Import replaces ALL existing data including accounts, parties, vouchers, and settings. A confirmation prompt will be shown with data summary.
            </div>
          </div>
        </div>
      </div>

      {/* Data integrity checks */}
      <div className="card" style={{marginTop:18}}>
        <div className="card-head"><h3 className="card-title">Data Integrity Check</h3></div>
        <div className="card-body">
          {(() => {
            const checks = [];
            // Check all voucher lines reference valid accounts
            let orphanLines = 0;
            data.vouchers.forEach(v => (v.lines||[]).forEach(l => {
              if(!data.coa.find(a => a.id === l.accountId)) orphanLines++;
            }));
            checks.push({label:'Voucher line references', ok: orphanLines === 0, detail: orphanLines === 0 ? 'All lines reference valid accounts' : orphanLines + ' lines reference missing accounts'});

            // Check Dr = Cr on all posted vouchers
            let unbalanced = 0;
            data.vouchers.filter(v => v.status !== 'Cancelled').forEach(v => {
              const dr = (v.lines||[]).reduce((s,l) => s + (l.debit||0), 0);
              const cr = (v.lines||[]).reduce((s,l) => s + (l.credit||0), 0);
              if(Math.abs(dr-cr) > 0.01) unbalanced++;
            });
            checks.push({label:'Double-entry balance', ok: unbalanced === 0, detail: unbalanced === 0 ? 'All vouchers are balanced (Dr = Cr)' : unbalanced + ' vouchers are unbalanced'});

            // Check unique account codes
            const dupes = data.coa.length - new Set(data.coa.map(a => a.id)).size;
            checks.push({label:'Account code uniqueness', ok: dupes === 0, detail: dupes === 0 ? 'All account codes are unique' : dupes + ' duplicate codes found'});

            // Party GSTIN format
            const badGstin = data.parties.filter(p => p.gstin && p.gstin.length !== 15).length;
            checks.push({label:'GSTIN format (15 chars)', ok: badGstin === 0, detail: badGstin === 0 ? 'All GSTINs are valid length' : badGstin + ' parties have invalid GSTIN length'});

            // Check localStorage size
            const storageSize = new Blob([JSON.stringify(data)]).size;
            checks.push({label:'Storage utilisation', ok: storageSize < 4000000, detail: (storageSize/1024).toFixed(1) + ' KB of ~5 MB limit'});

            return (
              <table>
                <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>
                  {checks.map((c,i) => (
                    <tr key={i}>
                      <td><b>{c.label}</b></td>
                      <td><span className={'badge ' + (c.ok?'badge-success':'badge-danger')}>{c.ok?'✓ Pass':'✗ Fail'}</span></td>
                      <td style={{fontSize:12, color:'var(--ink-2)'}}>{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </>
  );
}
