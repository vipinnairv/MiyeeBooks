
// ============================================================================
// LEDGER STATEMENT
// ============================================================================
function LedgerStatement({data, balances}){
  const [acId, setAcId] = useState('');
  const [from, setFrom] = useState(data.company.fyStart || '');
  const [to, setTo] = useState(data.company.fyEnd || '');

  const account = data.coa.find(a => a.id === acId);

  const rows = useMemo(() => {
    if(!acId) return [];
    const lines = [];
    data.vouchers.forEach(v => {
      if(v.status === 'Cancelled') return;
      if(v.date < from || v.date > to) return;
      (v.lines || []).forEach(l => {
        if(l.accountId !== acId) return;
        lines.push({
          date: v.date,
          vno: v.number || v.id.slice(0,8),
          type: v.type,
          narration: v.narration || '',
          dr: l.debit || 0,
          cr: l.credit || 0,
        });
      });
    });
    lines.sort((a,b) => a.date.localeCompare(b.date));
    return lines;
  }, [acId, from, to, data.vouchers]);

  // Opening balance = starting balance before 'from' date
  const openingBal = useMemo(() => {
    if(!acId) return 0;
    let bal = account?.opening || 0;
    data.vouchers.forEach(v => {
      if(v.status === 'Cancelled') return;
      if(v.date >= from) return;
      (v.lines || []).forEach(l => {
        if(l.accountId !== acId) return;
        bal += (l.debit || 0) - (l.credit || 0);
      });
    });
    return bal;
  }, [acId, from, data.vouchers, account]);

  let runBal = openingBal;
  const tableRows = rows.map(r => {
    runBal += r.dr - r.cr;
    return {...r, bal: runBal};
  });

  const totalDr = rows.reduce((s,r) => s+r.dr, 0);
  const totalCr = rows.reduce((s,r) => s+r.cr, 0);
  const closingBal = openingBal + totalDr - totalCr;

  const handlePrint = () => window.print();
  const handleCSV = () => {
    const hdr = 'Date,Voucher No,Type,Narration,Debit,Credit,Balance\n';
    const body = tableRows.map(r =>
      `${fmtDate(r.date)},${r.vno},${r.type},"${r.narration}",${r.dr.toFixed(2)},${r.cr.toFixed(2)},${r.bal.toFixed(2)}`
    ).join('\n');
    const blob = new Blob([hdr + body], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`Ledger_${account?.name||acId}_${from}_${to}.csv`; a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Ledger Statement</h1>
          <div className="page-sub">Account-wise transaction history with running balance</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>
          <button className="btn btn-sm btn-primary" onClick={handlePrint}>🖨 Print</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Account</label>
              <select className="form-control" value={acId} onChange={e=>setAcId(e.target.value)} style={{minWidth:220,padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                <option value=""> Select Account </option>
                {data.coa.map(a => <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
          </div>
        </div>
      </div>

      {acId && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">{account?.name}  [{account?.code}]</h3>
            <span style={{fontSize:12,color:'var(--ink-3)'}}>{account?.group} | {account?.type}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Voucher No</th><th>Type</th><th>Narration</th>
                  <th style={{textAlign:'right'}}>Debit (₹)</th>
                  <th style={{textAlign:'right'}}>Credit (₹)</th>
                  <th style={{textAlign:'right'}}>Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{background:'var(--primary-soft)'}}>
                  <td colSpan={4}><b>Opening Balance</b></td>
                  <td style={{textAlign:'right'}}></td>
                  <td style={{textAlign:'right'}}></td>
                  <td style={{textAlign:'right',fontWeight:600,fontFamily:'var(--mono)'}}>{fmt(openingBal)}</td>
                </tr>
                {tableRows.length === 0 && (
                  <tr><td colSpan={7} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No transactions in selected period</td></tr>
                )}
                {tableRows.map((r,i) => (
                  <tr key={i}>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtDate(r.date)}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{r.vno}</td>
                    <td><span style={{background:'var(--primary-soft)',color:'var(--primary)',padding:'1px 7px',borderRadius:10,fontSize:11,fontWeight:600}}>{r.type}</span></td>
                    <td style={{maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.narration}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.dr>0?'var(--primary)':'var(--ink-3)'}}>{r.dr>0?fmt(r.dr):''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.cr>0?'var(--danger)':'var(--ink-3)'}}>{r.cr>0?fmt(r.cr):''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:500}}>{fmt(r.bal)}</td>
                  </tr>
                ))}
                <tr style={{background:'var(--surface-2)',fontWeight:700}}>
                  <td colSpan={4}><b>Total / Closing Balance</b></td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(totalDr)}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(totalCr)}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',color:closingBal>=0?'var(--primary)':'var(--danger)'}}>{fmt(closingBal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!acId && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
            <div style={{fontSize:32,marginBottom:10}}>≡</div>
            <div>Select an account above to view its ledger statement</div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// DEBTORS STATEMENT / CONFIRMATION
// ============================================================================
function DebtorStatement({data}){
  const [partyId, setPartyId] = useState('');
  const [from, setFrom] = useState(data.company.fyStart || '');
  const [to, setTo] = useState(data.company.fyEnd || '');
  const [showLetter, setShowLetter] = useState(false);

  const debtors = data.parties.filter(p => p.type==='Customer' || p.type==='Both');
  const party = data.parties.find(p => p.id === partyId);

  // All movements for this party against Trade Receivables (line-level, all voucher types)
  const allMoves = useMemo(() =>
    partyId ? partyLedgerMoves(data, partyId, '2400') : [],
    [partyId, data.vouchers]);

  const rows = useMemo(() =>
    allMoves.filter(m => m.date >= from && m.date <= to),
    [allMoves, from, to]);

  const openingBal = useMemo(() => {
    if(!partyId) return 0;
    let bal = party?.balance || 0;   // opening from party master
    allMoves.forEach(m => { if(m.date < from) bal += m.dr - m.cr; });
    return bal;
  }, [partyId, allMoves, from, party]);

  // Summary of ALL debtors with balances (shown when no party selected)
  const allDebtorBals = useMemo(() =>
    debtors.map(p => ({...p, closing: partyClosingBal(data, p, '2400', to)}))
      .sort((a,b) => b.closing - a.closing),
    [debtors, data.vouchers, to]);

  let runBal = openingBal;
  const tableRows = rows.map(r => {
    runBal += r.dr - r.cr;
    return {...r, bal: runBal};
  });
  const totalDr = rows.reduce((s,r)=>s+r.dr,0);
  const totalCr = rows.reduce((s,r)=>s+r.cr,0);
  const closingBal = openingBal + totalDr - totalCr;

  const companyName = data.company.name;
  const today = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});

  const handleCSV = () => {
    const hdr = 'Date,Voucher No,Type,Narration,Debit,Credit,Balance\n';
    const body = tableRows.map(r => `${fmtDate(r.date)},${r.vno},${r.type},"${r.narration}",${r.dr.toFixed(2)},${r.cr.toFixed(2)},${r.bal.toFixed(2)}`).join('\n');
    const blob = new Blob([hdr+body],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`Debtor_${party?.name||partyId}_${from}_${to}.csv`; a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Debtors Statement</h1>
          <div className="page-sub">Customer account statement & confirmation letter</div>
        </div>
        <div className="page-actions">
          {partyId && <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>}
          {partyId && <button className="btn btn-sm" onClick={()=>{setShowLetter(!showLetter)}}>{showLetter?'Hide':'Show'} Confirmation Letter</button>}
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>🖨 Print</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Customer</label>
              <select value={partyId} onChange={e=>setPartyId(e.target.value)} style={{minWidth:220,padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                <option value=""> Select Customer </option>
                {debtors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
          </div>
        </div>
      </div>

      {partyId && showLetter && (
        <div className="card" style={{marginBottom:18,border:'2px solid var(--primary)'}}>
          <div className="card-body" style={{fontFamily:'var(--serif)',fontSize:14,lineHeight:1.8}}>
            <div style={{textAlign:'right',marginBottom:16}}>
              <b>{companyName}</b><br/>
              {data.company.address || ''}<br/>
              GSTIN: {data.company.gstin}<br/>
              Date: {today}
            </div>
            <div style={{marginBottom:16}}>
              <b>To,</b><br/>
              {party?.name}<br/>
              {party?.address || ''}<br/>
              {party?.gstin ? `GSTIN: ${party.gstin}` : ''}
            </div>
            <p><b>Sub: Balance Confirmation as on {to}</b></p>
            <p>Dear Sir / Madam,</p>
            <p>As per our books of accounts, the balance outstanding in your account as on <b>{to}</b> is as under:</p>
            <div style={{margin:'16px 0',padding:'12px 16px',background:'var(--primary-soft)',borderRadius:'var(--radius)',textAlign:'center'}}>
              <b style={{fontSize:18,fontFamily:'var(--mono)'}}>₹ {fmt(closingBal)}</b>
              <span style={{color:closingBal>=0?'var(--primary)':'var(--danger)',marginLeft:8,fontSize:12}}>{closingBal>=0?'(Debit  Amount Receivable)':'(Credit  Amount Payable)'}</span>
            </div>
            <p>We request you to kindly confirm the above balance by signing and returning a copy of this letter. In case of any discrepancy, please communicate the same to us within <b>15 days</b> of receipt of this letter.</p>
            <div style={{marginTop:32,display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}}>
              <div>
                <p style={{borderTop:'1px solid #333',paddingTop:8,marginTop:40}}>Authorised Signatory<br/><b>{companyName}</b></p>
              </div>
              <div>
                <p style={{borderTop:'1px solid #333',paddingTop:8,marginTop:40}}>Confirmed &amp; Accepted<br/><b>{party?.name}</b><br/><span style={{fontSize:11}}>Name, Designation &amp; Seal</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {partyId && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">{party?.name}</h3>
            <span style={{fontSize:12,color:'var(--ink-3)'}}>{party?.gstin || 'Unregistered'}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Voucher No</th><th>Type</th><th>Narration</th>
                  <th style={{textAlign:'right'}}>Debit (₹)</th>
                  <th style={{textAlign:'right'}}>Credit (₹)</th>
                  <th style={{textAlign:'right'}}>Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{background:'var(--primary-soft)'}}>
                  <td colSpan={4}><b>Opening Balance</b></td>
                  <td colSpan={2}></td>
                  <td style={{textAlign:'right',fontWeight:600,fontFamily:'var(--mono)'}}>{fmt(openingBal)}</td>
                </tr>
                {tableRows.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No transactions in period</td></tr>}
                {tableRows.map((r,i)=>(
                  <tr key={i}>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtDate(r.date)}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{r.vno}</td>
                    <td><span style={{background:'var(--primary-soft)',color:'var(--primary)',padding:'1px 7px',borderRadius:10,fontSize:11,fontWeight:600}}>{r.type}</span></td>
                    <td>{r.narration}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.dr>0?'var(--primary)':'var(--ink-3)'}}>{r.dr>0?fmt(r.dr):''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.cr>0?'var(--danger)':'var(--ink-3)'}}>{r.cr>0?fmt(r.cr):''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:500,color:r.bal>=0?'var(--primary)':'var(--danger)'}}>{fmt(r.bal)}</td>
                  </tr>
                ))}
                <tr style={{background:'var(--surface-2)',fontWeight:700}}>
                  <td colSpan={4}><b>Closing Balance</b></td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(totalDr)}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(totalCr)}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',color:closingBal>=0?'var(--primary)':'var(--danger)'}}>{fmt(closingBal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!partyId && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">All Customers  Balances as on {to}</h3></div>
          <div className="card-body" style={{padding:0}}>
            {allDebtorBals.length===0 ? (
              <div style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
                No customers found. Add them under Masters → Customers &amp; Vendors.
              </div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
                  <th style={{padding:'9px 16px',textAlign:'left',width:40}}>Sr</th>
                  <th style={{padding:'9px 16px',textAlign:'left'}}>Customer</th>
                  <th style={{padding:'9px 16px',textAlign:'left',width:160}}>GSTIN</th>
                  <th style={{padding:'9px 16px',textAlign:'right',width:150}}>Receivable (₹)</th>
                  <th style={{padding:'9px 16px',width:90}}></th>
                </tr></thead>
                <tbody>
                  {allDebtorBals.map((p,i)=>(
                    <tr key={p.id} className="hover-row" style={{borderBottom:'1px solid var(--line-2)',cursor:'pointer'}}
                      onClick={()=>setPartyId(p.id)}>
                      <td style={{padding:'8px 16px',color:'var(--ink-3)',fontSize:12}}>{i+1}</td>
                      <td style={{padding:'8px 16px',fontWeight:600,color:'var(--primary)'}}>{p.name}</td>
                      <td style={{padding:'8px 16px',fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{p.gstin||''}</td>
                      <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600,
                        color:p.closing>0?'var(--primary)':p.closing<0?'var(--danger)':'var(--ink-3)'}}>
                        {fmt(Math.abs(p.closing))}{p.closing<0?' Cr':p.closing>0?' Dr':''}
                      </td>
                      <td style={{padding:'8px 16px',textAlign:'center'}}>
                        <span style={{fontSize:11,color:'var(--primary)'}}>View →</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="total"><td colSpan="3" style={{padding:'9px 16px',textAlign:'right'}}>TOTAL RECEIVABLE</td>
                    <td style={{padding:'9px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>₹{fmt(allDebtorBals.reduce((s,p)=>s+p.closing,0))}</td><td></td></tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// VENDOR STATEMENT / CONFIRMATION
// ============================================================================
function VendorStatement({data}){
  const [partyId, setPartyId] = useState('');
  const [from, setFrom] = useState(data.company.fyStart || '');
  const [to, setTo] = useState(data.company.fyEnd || '');
  const [showLetter, setShowLetter] = useState(false);

  const vendors = data.parties.filter(p => p.type==='Vendor' || p.type==='Both');
  const party = data.parties.find(p => p.id === partyId);

  // All movements for this party against Trade Payables (line-level, all voucher types)
  const allMoves = useMemo(() =>
    partyId ? partyLedgerMoves(data, partyId, '1300') : [],
    [partyId, data.vouchers]);

  const rows = useMemo(() =>
    allMoves.filter(m => m.date >= from && m.date <= to),
    [allMoves, from, to]);

  const openingBal = useMemo(() => {
    if(!partyId) return 0;
    let bal = party?.balance || 0;   // opening from party master
    // Payable convention: credit increases what we owe
    allMoves.forEach(m => { if(m.date < from) bal += m.cr - m.dr; });
    return bal;
  }, [partyId, allMoves, from, party]);

  // Summary of ALL vendors with balances (shown when no party selected)
  const allVendorBals = useMemo(() =>
    vendors.map(p => ({...p, closing: partyClosingBal(data, p, '1300', to)}))
      .sort((a,b) => b.closing - a.closing),
    [vendors, data.vouchers, to]);

  let runBal = openingBal;
  const tableRows = rows.map(r => {
    runBal += r.cr - r.dr;     // payable grows with credits (purchases), shrinks with debits (payments)
    return {...r, bal: runBal};
  });
  const totalDr = rows.reduce((s,r)=>s+r.dr,0);
  const totalCr = rows.reduce((s,r)=>s+r.cr,0);
  const closingBal = openingBal + totalCr - totalDr;   // payable: Cr-positive

  const companyName = data.company.name;
  const today = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});

  const handleCSV = () => {
    const hdr = 'Date,Voucher No,Type,Narration,Debit,Credit,Balance\n';
    const body = tableRows.map(r => `${fmtDate(r.date)},${r.vno},${r.type},"${r.narration}",${r.dr.toFixed(2)},${r.cr.toFixed(2)},${r.bal.toFixed(2)}`).join('\n');
    const blob = new Blob([hdr+body],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`Vendor_${party?.name||partyId}_${from}_${to}.csv`; a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Vendor Statement</h1>
          <div className="page-sub">Supplier account statement & confirmation letter</div>
        </div>
        <div className="page-actions">
          {partyId && <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>}
          {partyId && <button className="btn btn-sm" onClick={()=>setShowLetter(!showLetter)}>{showLetter?'Hide':'Show'} Confirmation Letter</button>}
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>🖨 Print</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Vendor</label>
              <select value={partyId} onChange={e=>setPartyId(e.target.value)} style={{minWidth:220,padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                <option value=""> Select Vendor </option>
                {vendors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
          </div>
        </div>
      </div>

      {partyId && showLetter && (
        <div className="card" style={{marginBottom:18,border:'2px solid var(--primary)'}}>
          <div className="card-body" style={{fontFamily:'var(--serif)',fontSize:14,lineHeight:1.8}}>
            <div style={{textAlign:'right',marginBottom:16}}>
              <b>{companyName}</b><br/>
              {data.company.address || ''}<br/>
              GSTIN: {data.company.gstin}<br/>
              Date: {today}
            </div>
            <div style={{marginBottom:16}}>
              <b>To,</b><br/>
              {party?.name}<br/>
              {party?.address || ''}<br/>
              {party?.gstin ? `GSTIN: ${party.gstin}` : ''}
            </div>
            <p><b>Sub: Balance Confirmation as on {to}</b></p>
            <p>Dear Sir / Madam,</p>
            <p>As per our books of accounts, the balance outstanding in your account as on <b>{to}</b> is as under:</p>
            <div style={{margin:'16px 0',padding:'12px 16px',background:'var(--accent-soft)',borderRadius:'var(--radius)',textAlign:'center'}}>
              <b style={{fontSize:18,fontFamily:'var(--mono)'}}>₹ {fmt(closingBal)}</b>
              <span style={{color:closingBal>=0?'var(--primary)':'var(--danger)',marginLeft:8,fontSize:12}}>{closingBal>=0?'(Debit  Amount Receivable)':'(Credit  Amount Payable)'}</span>
            </div>
            <p>We request you to kindly confirm the above balance by signing and returning a copy of this letter within <b>15 days</b>. In case of discrepancy please notify us immediately.</p>
            <div style={{marginTop:32,display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}}>
              <div>
                <p style={{borderTop:'1px solid #333',paddingTop:8,marginTop:40}}>Authorised Signatory<br/><b>{companyName}</b></p>
              </div>
              <div>
                <p style={{borderTop:'1px solid #333',paddingTop:8,marginTop:40}}>Confirmed &amp; Accepted<br/><b>{party?.name}</b><br/><span style={{fontSize:11}}>Name, Designation &amp; Seal</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {partyId && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">{party?.name}</h3>
            <span style={{fontSize:12,color:'var(--ink-3)'}}>{party?.gstin || 'Unregistered'}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Voucher No</th><th>Type</th><th>Narration</th>
                  <th style={{textAlign:'right'}}>Debit (₹)</th>
                  <th style={{textAlign:'right'}}>Credit (₹)</th>
                  <th style={{textAlign:'right'}}>Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{background:'var(--accent-soft)'}}>
                  <td colSpan={4}><b>Opening Balance</b></td>
                  <td colSpan={2}></td>
                  <td style={{textAlign:'right',fontWeight:600,fontFamily:'var(--mono)'}}>{fmt(openingBal)}</td>
                </tr>
                {tableRows.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No transactions in period</td></tr>}
                {tableRows.map((r,i)=>(
                  <tr key={i}>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtDate(r.date)}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{r.vno}</td>
                    <td><span style={{background:'var(--accent-soft)',color:'var(--warning)',padding:'1px 7px',borderRadius:10,fontSize:11,fontWeight:600}}>{r.type}</span></td>
                    <td>{r.narration}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.dr>0?'var(--primary)':'var(--ink-3)'}}>{r.dr>0?fmt(r.dr):''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.cr>0?'var(--danger)':'var(--ink-3)'}}>{r.cr>0?fmt(r.cr):''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:500,color:r.bal>=0?'var(--primary)':'var(--danger)'}}>{fmt(r.bal)}</td>
                  </tr>
                ))}
                <tr style={{background:'var(--surface-2)',fontWeight:700}}>
                  <td colSpan={4}><b>Closing Balance</b></td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(totalDr)}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(totalCr)}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',color:closingBal>=0?'var(--primary)':'var(--danger)'}}>{fmt(closingBal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!partyId && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">All Vendors  Balances as on {to}</h3></div>
          <div className="card-body" style={{padding:0}}>
            {allVendorBals.length===0 ? (
              <div style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
                No vendors found. Add them under Masters → Customers &amp; Vendors.
              </div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
                  <th style={{padding:'9px 16px',textAlign:'left',width:40}}>Sr</th>
                  <th style={{padding:'9px 16px',textAlign:'left'}}>Vendor</th>
                  <th style={{padding:'9px 16px',textAlign:'left',width:160}}>GSTIN</th>
                  <th style={{padding:'9px 16px',textAlign:'right',width:150}}>Payable (₹)</th>
                  <th style={{padding:'9px 16px',width:90}}></th>
                </tr></thead>
                <tbody>
                  {allVendorBals.map((p,i)=>(
                    <tr key={p.id} className="hover-row" style={{borderBottom:'1px solid var(--line-2)',cursor:'pointer'}}
                      onClick={()=>setPartyId(p.id)}>
                      <td style={{padding:'8px 16px',color:'var(--ink-3)',fontSize:12}}>{i+1}</td>
                      <td style={{padding:'8px 16px',fontWeight:600,color:'var(--primary)'}}>{p.name}</td>
                      <td style={{padding:'8px 16px',fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{p.gstin||''}</td>
                      <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600,
                        color:p.closing>0?'var(--danger)':p.closing<0?'var(--primary)':'var(--ink-3)'}}>
                        {fmt(Math.abs(p.closing))}{p.closing>0?' Cr':p.closing<0?' Dr':''}
                      </td>
                      <td style={{padding:'8px 16px',textAlign:'center'}}>
                        <span style={{fontSize:11,color:'var(--primary)'}}>View →</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="total"><td colSpan="3" style={{padding:'9px 16px',textAlign:'right'}}>TOTAL PAYABLE</td>
                    <td style={{padding:'9px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>₹{fmt(allVendorBals.reduce((s,p)=>s+p.closing,0))}</td><td></td></tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// INVENTORY MASTER (Stock Items)
// ============================================================================
function InventoryMaster({data, setData, showToast}){
  const UNITS = ['Nos','Kg','Gm','Lt','Ml','Mtr','Cm','Sqft','Box','Bag','Pcs','Set','Pair','Roll','Ton'];
  const CATS = ['Raw Material','Semi-Finished','Finished Goods','Consumable','Packing Material','Trading Goods','Service'];

  const empty = {id:'', code:'', name:'', unit:'Nos', category:'Trading Goods', hsn:'', gstRate:18, openingQty:0, openingValue:0, reorderLevel:0, active:true};
  const [form, setForm] = useState({...empty});
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');

  const items = data.stockItems || [];
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.code||'').toLowerCase().includes(search.toLowerCase()));

  const save = () => {
    if(!form.name.trim()) { showToast('Item name is required','error'); return; }
    if(!form.code.trim()) { showToast('Item code is required','error'); return; }
    if(items.find(i => i.code===form.code.trim() && i.id!==form.id)) { showToast('Item code already exists','error'); return; }
    if(editing) {
      setData(p => ({...p, stockItems: p.stockItems.map(i => i.id===form.id ? {...form} : i)}));
      showToast('Stock item updated');
    } else {
      const newItem = {...form, id: uid()};
      setData(p => ({...p, stockItems: [...(p.stockItems||[]), newItem]}));
      showToast('Stock item added');
    }
    setForm({...empty}); setEditing(false);
  };

  const edit = (item) => { setForm({...item}); setEditing(true); };
  const del = (id) => {
    if(!confirm('Delete this stock item?')) return;
    setData(p => ({...p, stockItems: p.stockItems.filter(i => i.id!==id)}));
    showToast('Stock item deleted');
  };
  const cancel = () => { setForm({...empty}); setEditing(false); };

  const f = (k, v) => setForm(p => ({...p, [k]: v}));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Stock Items</h1>
          <div className="page-sub">Inventory item master  products, raw materials &amp; consumables</div>
        </div>
        <div className="page-actions">
          <span style={{fontSize:12,color:'var(--ink-3)'}}>{items.length} items</span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:18,alignItems:'start'}}>
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Stock Items</h3>
            <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{padding:'5px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',fontSize:12,width:180}} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>HSN</th>
                  <th>GST%</th><th style={{textAlign:'right'}}>Opening Qty</th>
                  <th style={{textAlign:'right'}}>Reorder</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No items. Add one →</td></tr>}
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{item.code}</td>
                    <td style={{fontWeight:500}}>{item.name}</td>
                    <td><span style={{fontSize:10,background:'var(--primary-soft)',color:'var(--primary)',padding:'1px 6px',borderRadius:10}}>{item.category}</span></td>
                    <td>{item.unit}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>{item.hsn}</td>
                    <td>{item.gstRate}%</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{item.openingQty}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{item.reorderLevel}</td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={()=>edit(item)}>✎</button>
                      <button className="btn btn-sm btn-ghost btn-danger" onClick={()=>del(item.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{position:'sticky',top:10}}>
          <div className="card-head">
            <h3 className="card-title">{editing?'Edit Item':'Add Item'}</h3>
          </div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            {[['code','Item Code'],['name','Item Name']].map(([k,lbl])=>(
              <div key={k}>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>{lbl}</label>
                <input value={form[k]} onChange={e=>f(k,e.target.value)} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
            ))}
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Category</label>
              <select value={form.category} onChange={e=>f('category',e.target.value)} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Unit of Measure</label>
              <select value={form.unit} onChange={e=>f('unit',e.target.value)} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>HSN / SAC</label>
                <input value={form.hsn} onChange={e=>f('hsn',e.target.value)} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>GST Rate %</label>
                <select value={form.gstRate} onChange={e=>f('gstRate',Number(e.target.value))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                  {[0,0.25,1,1.5,3,5,6,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Opening Qty</label>
                <input type="number" value={form.openingQty} onChange={e=>f('openingQty',Number(e.target.value))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Opening Value ₹</label>
                <input type="number" value={form.openingValue} onChange={e=>f('openingValue',Number(e.target.value))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Reorder Level (Qty)</label>
              <input type="number" value={form.reorderLevel} onChange={e=>f('reorderLevel',Number(e.target.value))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={save}>{editing?'Update':'Add Item'}</button>
              {editing && <button className="btn" onClick={cancel}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// STOCK LEDGER  item-wise movement report
// ============================================================================
// ============================================================================
// STOCK VALUATION  Weighted Average Cost
// Chronological pass over all movements: purchases add value at cost, issues
// (sales / production consumption) leave at the running average, production
// receipts absorb the consumed RM value. Closing value can be posted to the
// books as a closing-stock JV so the P&L reflects true COGS.
// ============================================================================
function StockValuation({data, setData, showToast, balances, readOnly=false}){
  const items = (data.stockItems||[]).filter(i=>i.active!==false);
  const r2 = n => Math.round(n*100)/100;

  const valuation = useMemo(() => {
    const st = {};   // itemId → {qty, value}
    items.forEach(i => { st[i.id] = {qty:i.openingQty||0, value:i.openingValue||0}; });
    const avg = id => st[id] && st[id].qty > 0.0001 ? st[id].value/st[id].qty : 0;

    // Build one global, date-ordered movement list
    const mvts = [];
    (data.vouchers||[]).forEach(v => {
      if(v.status==='Cancelled') return;
      (v.items||[]).forEach(it => {
        if(!it.itemId || !(it.itemId in st)) return;
        if(v.type==='PUR') mvts.push({date:v.date, k:'in',  id:it.itemId, qty:it.qty||0, rate:it.rate||0});
        if(v.type==='SAL') mvts.push({date:v.date, k:'out', id:it.itemId, qty:it.qty||0});
        if(v.type==='CRN') mvts.push({date:v.date, k:'in',  id:it.itemId, qty:it.qty||0, rate:it.rate||0}); // sales return → back in at return rate
        if(v.type==='DBN') mvts.push({date:v.date, k:'out', id:it.itemId, qty:it.qty||0});                 // purchase return → out at avg
      });
    });
    (data.productionOrders||[]).forEach(po => {
      if(po.status!=='Posted' || !po.date) return;
      mvts.push({date:po.date, k:'po', po});
    });
    mvts.sort((a,b) => a.date.localeCompare(b.date));

    mvts.forEach(m => {
      if(m.k==='in'){ st[m.id].qty += m.qty; st[m.id].value += m.qty*m.rate; }
      else if(m.k==='out'){ const a=avg(m.id); const q=Math.min(m.qty, Math.max(0,st[m.id].qty)); st[m.id].qty -= m.qty; st[m.id].value = r2(st[m.id].value - q*a); if(st[m.id].qty<=0.0001) st[m.id].value = Math.max(0, st[m.id].value); }
      else { // production order: consume RM at avg, receive FG at absorbed cost
        let consumed = 0;
        (m.po.consumptions||[]).forEach(c => {
          if(!(c.itemId in st)) return;
          const a=avg(c.itemId); const q=Math.min(c.qty||0, Math.max(0,st[c.itemId].qty));
          st[c.itemId].qty -= c.qty||0;
          st[c.itemId].value = r2(st[c.itemId].value - q*a);
          consumed += q*a;
        });
        if(m.po.fgItemId in st){ st[m.po.fgItemId].qty += m.po.fgQty||0; st[m.po.fgItemId].value = r2(st[m.po.fgItemId].value + consumed); }
      }
    });

    const rows = items.map(i => ({
      ...i, closingQty: r2(st[i.id].qty), closingValue: r2(Math.max(0, st[i.id].value)),
      avgRate: st[i.id].qty>0.0001 ? r2(st[i.id].value/st[i.id].qty) : 0,
      isFG: i.category==='Finished Goods',
    })).sort((a,b)=>(a.category||'').localeCompare(b.category||'') || a.name.localeCompare(b.name));
    const totFG = rows.filter(r=>r.isFG).reduce((s,r)=>s+r.closingValue,0);
    const totRM = rows.filter(r=>!r.isFG).reduce((s,r)=>s+r.closingValue,0);
    return {rows, totFG:r2(totFG), totRM:r2(totRM), total:r2(totFG+totRM)};
  }, [data.stockItems, data.vouchers, data.productionOrders]);

  const bookRM = (balances['2300']||0), bookFG = (balances['2310']||0);
  const diffRM = r2(valuation.totRM - bookRM), diffFG = r2(valuation.totFG - bookFG);
  const needsJV = Math.abs(diffRM) > 0.5 || Math.abs(diffFG) > 0.5;

  const postClosingJV = () => {
    if(readOnly) return;
    if(!needsJV){ showToast('Books already match the computed valuation'); return; }
    let coa = data.coa;
    if(!coa.find(a=>a.id==='4120')){
      coa = [...coa, {id:'4120', name:'Changes in Inventories (Closing Stock Adj)', group:'Cost of Materials', type:'Expense', schedule:'Cost of Materials', opening:0}];
    }
    const lines = [];
    // Increase in stock: Dr inventory asset, Cr 4120 (reduces expense → correct COGS)
    if(Math.abs(diffRM)>0.5) lines.push({id:uid(), accountId:'2300', debit:diffRM>0?diffRM:0, credit:diffRM<0?-diffRM:0, narration:'RM/stores closing stock adjustment'});
    if(Math.abs(diffFG)>0.5) lines.push({id:uid(), accountId:'2310', debit:diffFG>0?diffFG:0, credit:diffFG<0?-diffFG:0, narration:'Finished goods closing stock adjustment'});
    const net = r2(diffRM + diffFG);
    lines.push({id:uid(), accountId:'4120', debit:net<0?-net:0, credit:net>0?net:0, narration:'Changes in inventories'});
    const jv = {id:uid(), type:'JV', date:today(), number:nextVoucherNumber({...data, coa}, 'JV'),
      narration:'Closing stock valuation (weighted average) as on '+today()+' - RM ₹'+fmt(valuation.totRM)+', FG ₹'+fmt(valuation.totFG),
      reference:'Stock Valuation', lines, amount:Math.abs(net), status:'Posted', createdAt:new Date().toISOString()};
    if(!confirm('Post closing-stock JV?\n\nRM adjustment: ₹'+fmt(diffRM)+'\nFG adjustment: ₹'+fmt(diffFG)+'\nNet P&L impact: ₹'+fmt(net)+' '+(net>0?'(profit increases)':'(profit decreases)'))) return;
    setData({...data, coa, vouchers:[...data.vouchers, jv],
      auditLog:[...(data.auditLog||[]), auditEntry('STOCK_JV', 'Closing stock JV '+jv.number+' net ₹'+fmt(net))]});
    showToast('Closing-stock JV '+jv.number+' posted');
  };

  const handleExcel = () => {
    exportXLSX(`Stock_Valuation_${today()}.xlsx`, [{
      name:'Stock Valuation',
      rows:[
        [`Stock Valuation (Weighted Average)  ${data.company.name}  as on ${today()}`],[],
        ['Code','Item','Category','Unit','Closing Qty','Avg Rate (₹)','Closing Value (₹)'],
        ...valuation.rows.map(r=>[r.code,r.name,r.category,r.unit,r.closingQty,r.avgRate,r.closingValue]),
        [],['','','','','','Raw Material & Others',valuation.totRM],
        ['','','','','','Finished Goods',valuation.totFG],
        ['','','','','','TOTAL',valuation.total],
      ],
    }]);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Stock Valuation</h1>
        <div className="page-sub">Weighted-average cost · production absorbs consumed material value · as on {fmtDate(today())}</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        {!readOnly && <button className={'btn btn-sm '+(needsJV?'btn-primary':'')} onClick={postClosingJV} title="Adjust Inventory ledgers to the computed valuation via a JV">⚖ Post Closing-Stock JV</button>}
      </div>
    </div>

    <div className="stat-grid" style={{marginBottom:14}}>
      <div className="stat"><div className="stat-label">Raw Material & Others</div><div className="stat-value rupee">₹{fmt(valuation.totRM)}</div><div className="stat-delta">Books: ₹{fmt(bookRM)}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Finished Goods</div><div className="stat-value rupee">₹{fmt(valuation.totFG)}</div><div className="stat-delta">Books: ₹{fmt(bookFG)}</div></div>
      <div className="stat stat-info"><div className="stat-label">Total Closing Stock</div><div className="stat-value rupee">₹{fmt(valuation.total)}</div></div>
      <div className={'stat '+(needsJV?'stat-danger':'')}>
        <div className="stat-label">Books vs Computed</div>
        <div className="stat-value rupee">₹{fmt(r2(diffRM+diffFG))}</div>
        <div className="stat-delta">{needsJV?'Post the closing-stock JV →':'✓ In sync'}</div>
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th style={{width:90}}>Code</th><th>Item</th><th style={{width:130}}>Category</th>
          <th className="num" style={{width:100}}>Closing Qty</th><th style={{width:56}}>Unit</th>
          <th className="num" style={{width:110}}>Avg Rate (₹)</th><th className="num" style={{width:130}}>Closing Value (₹)</th>
        </tr></thead>
        <tbody>
          {valuation.rows.length===0 ? (
            <tr><td colSpan="7"><div className="empty"><div className="empty-ico">▣</div><div>No stock items yet - add them under Stock Items.</div></div></td></tr>
          ) : valuation.rows.map(r=>(
            <tr key={r.id} style={r.closingQty<0?{background:'#fef2f2'}:{}}>
              <td style={{fontFamily:'var(--mono)',fontSize:11}}>{r.code}</td>
              <td style={{fontWeight:500}}>{r.name}{r.closingQty<0 && <span style={{color:'var(--danger)',fontSize:10,marginLeft:6}}>⚠ negative stock</span>}</td>
              <td><span className="badge badge-muted" style={{fontSize:10}}>{r.category}</span></td>
              <td className="num">{r.closingQty}</td>
              <td>{r.unit}</td>
              <td className="num">₹{fmt(r.avgRate)}</td>
              <td className="num bold">₹{fmt(r.closingValue)}</td>
            </tr>
          ))}
        </tbody>
        {valuation.rows.length>0 && (
          <tfoot><tr style={{fontWeight:800,borderTop:'2px solid var(--line)'}}>
            <td colSpan="6">TOTAL CLOSING STOCK</td>
            <td className="num">₹{fmt(valuation.total)}</td>
          </tr></tfoot>
        )}
      </table>
    </div>

    <div className="card" style={{marginTop:14,borderLeft:'4px solid var(--accent)'}}>
      <div className="card-body" style={{fontSize:12,color:'var(--ink-2)',lineHeight:1.6}}>
        <b>How the JV works:</b> the computed closing value is compared with the Inventory ledgers (2300 Raw Materials, 2310 Finished Goods).
        The difference posts as Dr/Cr Inventory against <b>Changes in Inventories (4120)</b> - increasing closing stock reduces COGS (profit ↑), and vice-versa.
        Post it at period-end (after entering all purchases, sales and production orders), typically before Period Close.
      </div>
    </div>
  </>);
}

function StockLedger({data}){
  const [itemId, setItemId] = useState('');
  const [from, setFrom] = useState(data.company.fyStart || '');
  const [to, setTo] = useState(data.company.fyEnd || '');

  const items = data.stockItems || [];
  const item = items.find(i => i.id === itemId);

  // Collect movements from vouchers (PUR = in, SAL = out) and production orders (consumption = out of RM, production = in for FG)
  const movements = useMemo(() => {
    const mvts = [];
    // From vouchers  read stockLines[] (legacy) OR items[].itemId (current)
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      if(v.date < from || v.date > to) return;
      // Legacy stockLines path
      (v.stockLines || []).forEach(sl => {
        if(sl.itemId !== itemId) return;
        mvts.push({
          date: v.date,
          ref: v.number || v.id.slice(0,8),
          type: v.type,
          narration: v.narration || '',
          in: ['PUR','PROD_IN','CRN'].includes(v.type) ? (sl.qty||0) : 0,   // CRN = sales return → goods back in
          out: ['SAL','CONS_OUT','PROD_OUT','DBN'].includes(v.type) ? (sl.qty||0) : 0, // DBN = purchase return → goods out
          rate: sl.rate || 0,
        });
      });
      // Current path: items[].itemId (set via VoucherModal stock picker)
      if((v.stockLines||[]).length === 0) {
        (v.items || []).forEach(it => {
          if(!it.itemId || it.itemId !== itemId) return;
          mvts.push({
            date: v.date,
            ref: v.number || v.id.slice(0,8),
            type: v.type,
            narration: v.narration || '',
            in: (v.type === 'PUR' || v.type === 'CRN') ? (it.qty||0) : 0,   // CRN = sales return → back in
            out: (v.type === 'SAL' || v.type === 'DBN') ? (it.qty||0) : 0, // DBN = purchase return → out
            rate: it.rate || 0,
          });
        });
      }
    });
    // From production orders
    (data.productionOrders || []).forEach(po => {
      if(po.status!=='Posted') return;
      if(!po.date || po.date < from || po.date > to) return;
      // BOM consumption lines
      (po.consumptions || []).forEach(c => {
        if(c.itemId !== itemId) return;
        mvts.push({date:po.date, ref:po.poNo||po.id.slice(0,8), type:'Consumption', narration:`PO: ${po.poNo||''}  ${po.fgName||'FG'}`, in:0, out:c.qty||0, rate:0});
      });
      // Finished goods production
      if(po.fgItemId === itemId) {
        mvts.push({date:po.date, ref:po.poNo||po.id.slice(0,8), type:'Production', narration:`PO: ${po.poNo||''}  Finished Good`, in:po.fgQty||0, out:0, rate:po.fgCost||0});
      }
    });
    mvts.sort((a,b) => a.date.localeCompare(b.date));
    return mvts;
  }, [itemId, from, to, data.vouchers, data.productionOrders]);

  const openingQty = useMemo(() => {
    if(!item) return 0;
    let qty = item.openingQty || 0;
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      if(v.date >= from) return;
      // Legacy stockLines path
      (v.stockLines||[]).forEach(sl => {
        if(sl.itemId!==itemId) return;
        if(['PUR','PROD_IN','CRN'].includes(v.type)) qty += sl.qty||0;
        else qty -= sl.qty||0;
      });
      // Current items[].itemId path
      if((v.stockLines||[]).length === 0) {
        (v.items||[]).forEach(it => {
          if(!it.itemId || it.itemId !== itemId) return;
          if(v.type === 'PUR' || v.type === 'CRN') qty += it.qty||0;
          else if(v.type === 'SAL' || v.type === 'DBN') qty -= it.qty||0;
        });
      }
    });
    (data.productionOrders||[]).forEach(po => {
      if(po.status!=='Posted') return;
      if(!po.date || po.date >= from) return;
      (po.consumptions||[]).forEach(c => { if(c.itemId===itemId) qty -= c.qty||0; });
      if(po.fgItemId===itemId) qty += po.fgQty||0;
    });
    return qty;
  }, [itemId, from, item, data.vouchers, data.productionOrders]);

  let runQty = openingQty;
  const tableRows = movements.map(m => {
    runQty += m.in - m.out;
    return {...m, balance: runQty};
  });
  const totalIn = movements.reduce((s,m)=>s+m.in,0);
  const totalOut = movements.reduce((s,m)=>s+m.out,0);
  const closingQty = openingQty + totalIn - totalOut;

  const handleCSV = () => {
    const hdr = 'Date,Reference,Type,Narration,In,Out,Balance\n';
    const body = tableRows.map(r=>`${fmtDate(r.date)},${r.ref},${r.type},"${r.narration}",${r.in},${r.out},${r.balance}`).join('\n');
    const blob = new Blob([hdr+body],{type:'text/csv'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`StockLedger_${item?.name||itemId}.csv`; a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Stock Ledger</h1>
          <div className="page-sub">Item-wise inventory movements  receipts, issues &amp; balance</div>
        </div>
        <div className="page-actions">
          {itemId && <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>}
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>🖨 Print</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Stock Item</label>
              <select value={itemId} onChange={e=>setItemId(e.target.value)} style={{minWidth:220,padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                <option value=""> Select Item </option>
                {items.map(i => <option key={i.id} value={i.id}>[{i.code}] {i.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
          </div>
        </div>
      </div>

      {itemId && (
        <>
          <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:18}}>
            <div className="stat"><div className="stat-label">Opening Balance</div><div className="stat-value">{openingQty} <small style={{fontSize:14}}>{item?.unit}</small></div></div>
            <div className="stat stat-info"><div className="stat-label">Total In (Receipts)</div><div className="stat-value" style={{color:'var(--primary)'}}>{totalIn} <small style={{fontSize:14}}>{item?.unit}</small></div></div>
            <div className="stat stat-danger"><div className="stat-label">Total Out (Issues)</div><div className="stat-value" style={{color:'var(--danger)'}}>{totalOut} <small style={{fontSize:14}}>{item?.unit}</small></div></div>
            <div className="stat stat-gold"><div className="stat-label">Closing Balance</div><div className="stat-value" style={{color:closingQty<=item?.reorderLevel?'var(--danger)':'var(--ink)'}}>{closingQty} <small style={{fontSize:14}}>{item?.unit}</small></div><div className="stat-delta">{closingQty<=(item?.reorderLevel||0)?'⚠ Below Reorder Level':''}</div></div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">{item?.name}  [{item?.code}]</h3>
              <span style={{fontSize:12,color:'var(--ink-3)'}}>HSN: {item?.hsn} | GST: {item?.gstRate}% | Unit: {item?.unit}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Reference</th><th>Type</th><th>Narration</th>
                    <th style={{textAlign:'right'}}>In ({item?.unit})</th>
                    <th style={{textAlign:'right'}}>Out ({item?.unit})</th>
                    <th style={{textAlign:'right'}}>Balance ({item?.unit})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{background:'var(--primary-soft)'}}>
                    <td colSpan={4}><b>Opening Balance</b></td>
                    <td colSpan={2}></td>
                    <td style={{textAlign:'right',fontWeight:600,fontFamily:'var(--mono)'}}>{openingQty}</td>
                  </tr>
                  {tableRows.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No stock movements in period</td></tr>}
                  {tableRows.map((r,i)=>(
                    <tr key={i}>
                      <td style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtDate(r.date)}</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:12}}>{r.ref}</td>
                      <td><span style={{fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600,
                        background:r.in>0?'var(--primary-soft)':'var(--danger-soft)',
                        color:r.in>0?'var(--primary)':'var(--danger)'}}>{r.type}</span></td>
                      <td>{r.narration}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.in>0?'var(--primary)':'var(--ink-3)'}}>{r.in>0?r.in:''}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',color:r.out>0?'var(--danger)':'var(--ink-3)'}}>{r.out>0?r.out:''}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:500,color:r.balance<=(item?.reorderLevel||0)?'var(--danger)':'var(--ink)'}}>{r.balance}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--surface-2)',fontWeight:700}}>
                    <td colSpan={4}><b>Closing Balance</b></td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{totalIn}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{totalOut}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',color:closingQty<=(item?.reorderLevel||0)?'var(--danger)':'var(--primary)'}}>{closingQty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {!itemId && (
        <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
          <div style={{fontSize:32,marginBottom:10}}>▣</div>
          <div>Select a stock item above to view its movement ledger</div>
        </div></div>
      )}
    </>
  );
}

// ============================================================================
// FACTORY  BILL OF MATERIALS (BOM)
// ============================================================================
function FactoryBOM({data, setData, showToast}){
  const items = data.stockItems || [];
  const fgItems = items.filter(i => i.category==='Finished Goods' || i.category==='Semi-Finished');
  const rmItems = items.filter(i => ['Raw Material','Semi-Finished','Consumable','Packing Material'].includes(i.category));

  const emptyBOM = {id:'', fgItemId:'', name:'', description:'', components:[], yieldQty:1};
  const [form, setForm] = useState({...emptyBOM, components:[]});
  const [editing, setEditing] = useState(false);
  const [compLine, setCompLine] = useState({itemId:'', qty:1, uom:''});

  const boms = data.boms || [];

  const addComponent = () => {
    if(!compLine.itemId) return;
    const itm = items.find(i=>i.id===compLine.itemId);
    setForm(p => ({...p, components:[...p.components, {...compLine, uom: itm?.unit||'Nos', itemName: itm?.name||''}]}));
    setCompLine({itemId:'', qty:1, uom:''});
  };
  const removeComp = (idx) => setForm(p=>({...p,components:p.components.filter((_,i)=>i!==idx)}));

  const save = () => {
    if(!form.fgItemId) { showToast('Select finished good item','error'); return; }
    if(form.components.length===0) { showToast('Add at least one component','error'); return; }
    const fgItem = items.find(i=>i.id===form.fgItemId);
    const record = {...form, name: form.name||fgItem?.name||'BOM', id: form.id || uid()};
    if(editing) {
      setData(p=>({...p, boms: p.boms.map(b=>b.id===record.id?record:b)}));
      showToast('BOM updated');
    } else {
      setData(p=>({...p, boms:[...(p.boms||[]), record]}));
      showToast('BOM created');
    }
    setForm({...emptyBOM, components:[]}); setEditing(false);
  };

  const edit = (bom) => { setForm({...bom, components:[...bom.components]}); setEditing(true); };
  const del = (id) => { if(!confirm('Delete this BOM?')) return; setData(p=>({...p,boms:p.boms.filter(b=>b.id!==id)})); showToast('BOM deleted'); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bill of Materials</h1>
          <div className="page-sub">Define raw material components required to produce finished goods</div>
        </div>
        <div className="page-actions">
          <span style={{fontSize:12,color:'var(--ink-3)'}}>{boms.length} BOM(s)</span>
        </div>
      </div>

      {fgItems.length===0 && (
        <div className="card" style={{marginBottom:18,border:'1px solid var(--accent)'}}>
          <div className="card-body" style={{color:'var(--warning)'}}>
            ⚠ No Finished Goods or Semi-Finished items found. Please add stock items with category "Finished Goods" or "Semi-Finished" first.
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 400px',gap:18,alignItems:'start'}}>
        <div>
          {boms.map(bom => {
            const fg = items.find(i=>i.id===bom.fgItemId);
            return (
              <div key={bom.id} className="card" style={{marginBottom:14}}>
                <div className="card-head">
                  <h3 className="card-title">{bom.name}</h3>
                  <div style={{display:'flex',gap:8}}>
                    <span style={{fontSize:12,color:'var(--ink-3)'}}>Yield: {bom.yieldQty} {fg?.unit||'Nos'}</span>
                    <button className="btn btn-sm" onClick={()=>edit(bom)}>✎ Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>del(bom.id)}>✕</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Component Item</th><th>Qty Required</th><th>UOM</th></tr></thead>
                    <tbody>
                      {bom.components.map((c,i)=>(
                        <tr key={i}>
                          <td>{i+1}</td>
                          <td>{c.itemName || items.find(x=>x.id===c.itemId)?.name}</td>
                          <td style={{fontFamily:'var(--mono)'}}>{c.qty}</td>
                          <td>{c.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bom.description && <div style={{padding:'8px 16px',fontSize:12,color:'var(--ink-3)',borderTop:'1px solid var(--line)'}}>{bom.description}</div>}
              </div>
            );
          })}
          {boms.length===0 && (
            <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
              <div style={{fontSize:32,marginBottom:10}}>⊞</div>
              <div>No BOMs yet. Create one →</div>
            </div></div>
          )}
        </div>

        <div className="card" style={{position:'sticky',top:10}}>
          <div className="card-head"><h3 className="card-title">{editing?'Edit BOM':'New BOM'}</h3></div>
          <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>BOM Name <span style={{fontWeight:400}}>(leave blank to use FG item name)</span></label>
              <input value={form.name||''} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Standard Mix v2" style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Finished / Output Item</label>
              <select value={form.fgItemId} onChange={e=>setForm(p=>({...p,fgItemId:e.target.value}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                <option value=""> Select FG Item </option>
                {fgItems.map(i=><option key={i.id} value={i.id}>[{i.code}] {i.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Yield Qty per Production Run</label>
              <input type="number" min={0.01} step={0.01} value={form.yieldQty} onChange={e=>setForm(p=>({...p,yieldQty:Number(e.target.value)}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Description (optional)</label>
              <input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div style={{background:'var(--surface-2)',padding:10,borderRadius:'var(--radius-sm)'}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--ink-2)',marginBottom:8}}>Components (Raw Materials)</div>
              {form.components.map((c,i)=>{
                const itm = items.find(x=>x.id===c.itemId);
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid var(--line)',fontSize:12}}>
                    <span>{itm?.name||c.itemName}</span>
                    <span style={{fontFamily:'var(--mono)'}}>{c.qty} {c.uom}</span>
                    <button className="btn btn-sm btn-ghost btn-danger" onClick={()=>removeComp(i)}>✕</button>
                  </div>
                );
              })}
              <div style={{display:'grid',gridTemplateColumns:'1fr 80px 50px',gap:5,marginTop:8}}>
                <select value={compLine.itemId} onChange={e=>setCompLine(p=>({...p,itemId:e.target.value}))} style={{padding:'5px 8px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',fontSize:11}}>
                  <option value="">RM Item</option>
                  {rmItems.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input type="number" min={0.01} step={0.01} value={compLine.qty} onChange={e=>setCompLine(p=>({...p,qty:Number(e.target.value)}))} placeholder="Qty" style={{padding:'5px 8px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',fontSize:11}} />
                <button className="btn btn-sm btn-primary" onClick={addComponent}>+</button>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={save}>{editing?'Update BOM':'Save BOM'}</button>
              {editing && <button className="btn" onClick={()=>{setForm({...emptyBOM,components:[]});setEditing(false);}}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// PRODUCTION ORDERS
// ============================================================================
function ProductionOrders({data, setData, showToast}){
  const items = data.stockItems || [];
  const boms = data.boms || [];
  const pos = data.productionOrders || [];

  const fgItems = items.filter(i=>i.category==='Finished Goods'||i.category==='Semi-Finished');

  const emptyPO = {id:'', poNo:'', date: new Date().toISOString().slice(0,10), fgItemId:'', bomId:'', fgQty:1, consumptions:[], notes:'', status:'Draft', fgCost:0};
  const [form, setForm] = useState({...emptyPO, consumptions:[]});
  const [showForm, setShowForm] = useState(false);

  // Auto-calculate consumptions from BOM when fgQty or bomId changes
  const recalcConsumptions = (bomId, fgQty, yieldQty) => {
    const bom = boms.find(b=>b.id===bomId);
    if(!bom) return [];
    const ratio = fgQty / (yieldQty||bom.yieldQty||1);
    return bom.components.map(c=>({
      itemId: c.itemId,
      itemName: c.itemName || items.find(x=>x.id===c.itemId)?.name||'',
      qty: +(c.qty * ratio).toFixed(4),
      uom: c.uom,
    }));
  };

  const handleBOMChange = (bomId) => {
    const bom = boms.find(b=>b.id===bomId);
    const fgItem = bom ? items.find(i=>i.id===bom.fgItemId) : null;
    setForm(p=>({...p, bomId, fgItemId: bom?.fgItemId||p.fgItemId,
      consumptions: recalcConsumptions(bomId, p.fgQty, bom?.yieldQty||1)}));
  };

  const handleQtyChange = (qty) => {
    const bom = boms.find(b=>b.id===form.bomId);
    setForm(p=>({...p, fgQty:Number(qty), consumptions: recalcConsumptions(form.bomId, Number(qty), bom?.yieldQty||1)}));
  };

  const handlePost = (po) => {
    if(!confirm(`Post Production Order ${po.poNo}? This will update stock quantities.`)) return;
    setData(p => {
      const updatedPOs = p.productionOrders.map(o => o.id===po.id?{...o,status:'Posted'}:o);
      return {...p, productionOrders: updatedPOs};
    });
    showToast(`PO ${po.poNo} posted  stock updated`);
  };

  const save = () => {
    if(!form.fgItemId) { showToast('Select finished good item','error'); return; }
    if(!form.date) { showToast('Date required','error'); return; }
    if(form.fgQty<=0) { showToast('Quantity must be positive','error'); return; }
    const nextNo = `PO-${String((pos.length+1)).padStart(4,'0')}`;
    const record = {...form, id: form.id||uid(), poNo: form.poNo||nextNo, fgName: items.find(i=>i.id===form.fgItemId)?.name||''};
    if(form.id) {
      setData(p=>({...p,productionOrders:p.productionOrders.map(o=>o.id===record.id?record:o)}));
      showToast('Production order updated');
    } else {
      setData(p=>({...p,productionOrders:[...(p.productionOrders||[]),record]}));
      showToast('Production order created');
    }
    setForm({...emptyPO,consumptions:[]}); setShowForm(false);
  };

  const del = (id) => {
    if(!confirm('Delete this production order?')) return;
    setData(p=>({...p,productionOrders:p.productionOrders.filter(o=>o.id!==id)}));
    showToast('Production order deleted');
  };

  const statusColor = {Draft:'var(--ink-3)', Posted:'var(--primary)', Cancelled:'var(--danger)'};
  const statusBg = {Draft:'var(--surface-2)', Posted:'var(--primary-soft)', Cancelled:'var(--danger-soft)'};

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Production Orders</h1>
          <div className="page-sub">Plan &amp; post finished goods production  raw material consumption → FG output</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?'✕ Cancel':'+ New Production Order'}</button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:18}}>
          <div className="card-head"><h3 className="card-title">New Production Order</h3></div>
          <div className="card-body">
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>PO Number</label>
                <input value={form.poNo} onChange={e=>setForm(p=>({...p,poNo:e.target.value}))} placeholder={`PO-${String((pos.length+1)).padStart(4,'0')}`} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Date</label>
                <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Production Qty</label>
                <input type="number" min={0.01} step={0.01} value={form.fgQty} onChange={e=>handleQtyChange(e.target.value)} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Select BOM</label>
                <select value={form.bomId} onChange={e=>handleBOMChange(e.target.value)} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                  <option value=""> Select BOM (optional) </option>
                  {boms.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Finished Good Item</label>
                <select value={form.fgItemId} onChange={e=>setForm(p=>({...p,fgItemId:e.target.value}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}}>
                  <option value=""> Select FG </option>
                  {fgItems.map(i=><option key={i.id} value={i.id}>[{i.code}] {i.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>FG Cost / Unit (₹) <span style={{fontWeight:400,color:'var(--ink-3)'}}> for valuation</span></label>
                <input type="number" min={0} step={0.01} value={form.fgCost} onChange={e=>setForm(p=>({...p,fgCost:parseFloat(e.target.value)||0}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:3}}>Notes</label>
                <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{width:'100%',padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
              </div>
            </div>

            {form.consumptions.length>0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'var(--ink-2)'}}>RM Consumption (auto-calculated from BOM)</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Item</th><th style={{textAlign:'right'}}>Qty Required</th><th>UOM</th></tr></thead>
                    <tbody>
                      {form.consumptions.map((c,i)=>(
                        <tr key={i}>
                          <td>{c.itemName}</td>
                          <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{c.qty}</td>
                          <td>{c.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" onClick={save}>Save Production Order</button>
              <button className="btn" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3 className="card-title">Production Orders</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO No</th><th>Date</th><th>Finished Good</th>
                <th style={{textAlign:'right'}}>FG Qty</th>
                <th>Status</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pos.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No production orders yet</td></tr>}
              {pos.map(po=>{
                const fg = items.find(i=>i.id===po.fgItemId);
                return (
                  <tr key={po.id}>
                    <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{po.poNo}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{po.date}</td>
                    <td>{po.fgName || fg?.name}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{po.fgQty} {fg?.unit||''}</td>
                    <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:600,
                      background:statusBg[po.status]||'var(--surface-2)',
                      color:statusColor[po.status]||'var(--ink-3)'}}>{po.status}</span></td>
                    <td style={{fontSize:11,color:'var(--ink-3)'}}>{po.notes}</td>
                    <td>
                      {po.status==='Draft' && <button className="btn btn-sm btn-primary" style={{marginRight:4}} onClick={()=>handlePost(po)}>▶ Post</button>}
                      {po.status==='Draft' && <button className="btn btn-sm btn-danger" onClick={()=>del(po.id)}>✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// INVENTORY MOVEMENTS  comprehensive movement log
// ============================================================================
function InventoryMovements({data}){
  const [from, setFrom] = useState(data.company.fyStart || '');
  const [to, setTo] = useState(data.company.fyEnd || '');
  const [filterItem, setFilterItem] = useState('');
  const [filterType, setFilterType] = useState('');

  const items = data.stockItems || [];

  const allMovements = useMemo(() => {
    const mvts = [];
    // From vouchers  support both legacy stockLines[] and current items[].itemId
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      const hasStockLines = (v.stockLines||[]).length > 0;
      // Legacy stockLines path
      (v.stockLines||[]).forEach(sl => {
        const itm = items.find(i=>i.id===sl.itemId);
        mvts.push({
          date: v.date,
          ref: v.number || v.id.slice(0,8),
          itemId: sl.itemId,
          itemName: itm?.name || sl.itemId,
          itemCode: itm?.code || '',
          type: v.type==='PUR'?'Purchase In':(v.type==='SAL'?'Sale Out':v.type),
          in: v.type==='PUR'?(sl.qty||0):0,
          out: v.type==='SAL'?(sl.qty||0):0,
          uom: itm?.unit||'',
          narration: v.narration||'',
        });
      });
      // Current path: items[].itemId (stock picker in VoucherModal)
      if(!hasStockLines) {
        (v.items||[]).forEach(it => {
          if(!it.itemId) return;
          const itm = items.find(i=>i.id===it.itemId);
          mvts.push({
            date: v.date,
            ref: v.number || v.id.slice(0,8),
            itemId: it.itemId,
            itemName: itm?.name || it.description || it.itemId,
            itemCode: itm?.code || '',
            type: v.type==='PUR'?'Purchase In':(v.type==='SAL'?'Sale Out':v.type),
            in: v.type==='PUR'?(it.qty||0):0,
            out: v.type==='SAL'?(it.qty||0):0,
            uom: itm?.unit||'',
            narration: v.narration||'',
          });
        });
      }
    });
    // From production orders
    (data.productionOrders||[]).forEach(po => {
      if(po.status!=='Posted') return;
      (po.consumptions||[]).forEach(c => {
        const itm = items.find(i=>i.id===c.itemId);
        mvts.push({date:po.date, ref:po.poNo||po.id.slice(0,8), itemId:c.itemId, itemName:c.itemName||itm?.name||'', itemCode:itm?.code||'', type:'Consumption', in:0, out:c.qty||0, uom:c.uom||itm?.unit||'', narration:`PO: ${po.poNo||''}`});
      });
      const fg = items.find(i=>i.id===po.fgItemId);
      mvts.push({date:po.date, ref:po.poNo||po.id.slice(0,8), itemId:po.fgItemId, itemName:po.fgName||fg?.name||'', itemCode:fg?.code||'', type:'Production', in:po.fgQty||0, out:0, uom:fg?.unit||'', narration:`PO: ${po.poNo||''}`});
    });
    return mvts;
  }, [data.vouchers, data.productionOrders, items]);

  const filtered = useMemo(() => {
    return allMovements.filter(m => {
      if(m.date < from || m.date > to) return false;
      if(filterItem && m.itemId!==filterItem) return false;
      if(filterType && m.type!==filterType) return false;
      return true;
    }).sort((a,b)=>a.date.localeCompare(b.date));
  }, [allMovements, from, to, filterItem, filterType]);

  const types = [...new Set(allMovements.map(m=>m.type))];
  const totalIn = filtered.reduce((s,m)=>s+m.in,0);
  const totalOut = filtered.reduce((s,m)=>s+m.out,0);

  const handleCSV = () => {
    const hdr = 'Date,Reference,Item Code,Item Name,Type,In,Out,UOM,Narration\n';
    const body = filtered.map(m=>`${m.date},${m.ref},${m.itemCode},"${m.itemName}",${m.type},${m.in},${m.out},${m.uom},"${m.narration}"`).join('\n');
    const blob = new Blob([hdr+body],{type:'text/csv'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`InventoryMovements_${from}_${to}.csv`; a.click();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Inventory Movements</h1>
          <div className="page-sub">All stock-in and stock-out across purchases, sales &amp; production</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>🖨 Print</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Item</label>
              <select value={filterItem} onChange={e=>setFilterItem(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',minWidth:160}}>
                <option value="">All Items</option>
                {items.map(i=><option key={i.id} value={i.id}>[{i.code}] {i.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Movement Type</label>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',minWidth:130}}>
                <option value="">All Types</option>
                {types.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:18}}>
        <div className="stat stat-info"><div className="stat-label">Total Movements</div><div className="stat-value">{filtered.length}</div></div>
        <div className="stat"><div className="stat-label">Total Inward</div><div className="stat-value" style={{color:'var(--primary)',fontSize:18}}>{totalIn.toLocaleString('en-IN')}</div><div className="stat-delta">units received</div></div>
        <div className="stat stat-danger"><div className="stat-label">Total Outward</div><div className="stat-value" style={{color:'var(--danger)',fontSize:18}}>{totalOut.toLocaleString('en-IN')}</div><div className="stat-delta">units issued</div></div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Reference</th><th>Code</th><th>Item Name</th>
                <th>Type</th>
                <th style={{textAlign:'right'}}>In</th>
                <th style={{textAlign:'right'}}>Out</th>
                <th>UOM</th><th>Narration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'var(--ink-3)',padding:20}}>No movements in selected period / filters</td></tr>}
              {filtered.map((m,i)=>(
                <tr key={i}>
                  <td style={{fontFamily:'var(--mono)',fontSize:12}}>{m.date}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:12}}>{m.ref}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{m.itemCode}</td>
                  <td style={{fontWeight:500}}>{m.itemName}</td>
                  <td><span style={{fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600,
                    background:m.in>0?'var(--primary-soft)':'var(--danger-soft)',
                    color:m.in>0?'var(--primary)':'var(--danger)'}}>{m.type}</span></td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',color:m.in>0?'var(--primary)':'var(--ink-3)'}}>{m.in>0?m.in:''}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--mono)',color:m.out>0?'var(--danger)':'var(--ink-3)'}}>{m.out>0?m.out:''}</td>
                  <td style={{fontSize:11,color:'var(--ink-3)'}}>{m.uom}</td>
                  <td style={{fontSize:11,color:'var(--ink-3)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.narration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// MOUNT
// ============================================================================
// Preload local data from IndexedDB (and run the one-time localStorage
// migration) BEFORE first render, so loadData() stays synchronous. .finally()
// guarantees the app renders even if IndexedDB is blocked - loadData() then
// falls back to the original localStorage path.
idbPreload().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(<AuthGate />);
});
