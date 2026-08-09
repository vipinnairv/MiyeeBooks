
// ============================================================================
// VOUCHERS
// ============================================================================
function Vouchers({data, setData, showToast, readOnly=false}){
  const [editing, setEditing] = useState(null);
  const [dup, setDup] = useState(null);          // duplicate-source prefill (new voucher)
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showUpgradeGate, setShowUpgradeGate] = useState(false);

  // Open a NEW voucher pre-filled from an existing one (saves re-typing)
  const duplicate = (v) => {
    if(isAtLimit){ setShowUpgradeGate(true); return; }
    setDup({
      ...v, id:undefined, number:'', date:today(), status:'Posted',
      reference:'', irn:'', ackNo:'', ackDate:'', billTags:[], isAdvance:false, recurringMonthly:false,
      attachments:[],   // evidence belongs to the source voucher, never the copy
      lines:(v.lines||[]).map(l=>({...l, id:uid()})),
      items:(v.items||[]).map(it=>({...it, id:uid()})),
    });
    setEditing(null); setVtype(v.type); setShowModal(true);
  };

  // Free tier check
  const prem = isPremiumActive(data.company);
  const activeCount = useMemo(() => (data.vouchers||[]).filter(v=>v.status!=='Cancelled').length, [data.vouchers]);
  const isAtLimit = SUBSCRIPTION_ENABLED && !prem && activeCount >= FREE_VOUCHER_LIMIT;
  const [vtype, setVtype] = useState('JV');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const vPageSize = 50;
  useEffect(() => { setPage(1); }, [filter, search]);

  // Function-key shortcut (dispatched by the app shell) → open a new voucher of that type
  useEffect(() => {
    const h = (e) => {
      const t = e.detail && e.detail.type;
      if(!t || readOnly) return;
      if(isAtLimit){ setShowUpgradeGate(true); return; }
      setEditing(null); setDup(null); setVtype(t); setShowModal(true);
    };
    window.addEventListener('mb:newVoucher', h);
    return () => window.removeEventListener('mb:newVoucher', h);
  }, [readOnly, isAtLimit]);

  // NEW multi-line format: each CSV row = one journal line; rows grouped by (date+type+reference) = one voucher
  const VCHR_SAMPLE_HEADERS = ['date','type','reference','narration','accountCode','debit','credit','partyName','partyGSTIN','partyType','costCentre','department'];
  const VCHR_SAMPLE_ROWS = [
    // Voucher 1: Payment  Office Rent (two lines)
    {date:'2025-04-01',type:'PAY',reference:'APR-RENT',narration:'Office Rent April',accountCode:'4500',debit:'50000',credit:'',partyName:'Mr. Patel (Landlord)',partyGSTIN:'',partyType:'Vendor',costCentre:'',department:'OPS'},
    {date:'2025-04-01',type:'PAY',reference:'APR-RENT',narration:'Office Rent April',accountCode:'2510',debit:'',credit:'50000',partyName:'',partyGSTIN:'',partyType:'',costCentre:'',department:''},
    // Voucher 2: Receipt from customer (two lines)
    {date:'2025-04-02',type:'REC',reference:'REC-001',narration:'Receipt against Inv INV-001',accountCode:'2510',debit:'120000',credit:'',partyName:'Reliance Industries Ltd',partyGSTIN:'27AAACR5055K1ZZ',partyType:'Customer',costCentre:'',department:'SALES'},
    {date:'2025-04-02',type:'REC',reference:'REC-001',narration:'Receipt against Inv INV-001',accountCode:'2400',debit:'',credit:'120000',partyName:'',partyGSTIN:'',partyType:'',costCentre:'',department:''},
    // Voucher 3: Journal  Depreciation (two lines)
    {date:'2025-04-05',type:'JV',reference:'DEP-Q1',narration:'Depreciation Q1 FY2025-26',accountCode:'4400',debit:'25000',credit:'',partyName:'',partyGSTIN:'',partyType:'',costCentre:'CC-01',department:'FIN'},
    {date:'2025-04-05',type:'JV',reference:'DEP-Q1',narration:'Depreciation Q1 FY2025-26',accountCode:'2130',debit:'',credit:'25000',partyName:'',partyGSTIN:'',partyType:'',costCentre:'',department:''},
  ];

  const handleImportVouchers = (rows) => {
    if(isAtLimit){ setShowUpgradeGate(true); return; }
    const validTypes = VOUCHER_TYPES.map(v => v.code);
    const imported = [];
    const errors   = [];
    const newParties = []; // Parties auto-created during import

    // Group rows by (date + type + reference) → one voucher per group
    const groups = {};
    rows.forEach((r, i) => {
      const date = r['date']?.trim();
      const type = r['type']?.trim().toUpperCase();
      const ref  = r['reference']?.trim() || `ROW${i+2}`;
      if(!date || !type){ errors.push(`Row ${i+2}: date and type are required`); return; }
      if(!validTypes.includes(type)){ errors.push(`Row ${i+2}: invalid type "${type}"`); return; }
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){ errors.push(`Row ${i+2}: date must be YYYY-MM-DD`); return; }
      const key = `${date}|${type}|${ref}`;
      if(!groups[key]) groups[key] = {date, type, reference:ref, rows:[], key};
      groups[key].rows.push({...r, _rowNum: i+2});
    });

    Object.values(groups).forEach(grp => {
      if(isDateLocked(data.company, grp.date)){
        errors.push(`Group ${grp.reference} (${grp.date}): period is locked (books closed up to ${data.company.booksLockedUpto})`);
        return;
      }
      const lines = [];
      let vNarration = '', vPartyName = '', vPartyId = '';
      let totalDr = 0, totalCr = 0;

      grp.rows.forEach(r => {
        const accCode = r['accountCode']?.trim();
        const dr      = parseFloat(r['debit']) || 0;
        const cr      = parseFloat(r['credit']) || 0;
        const narr    = r['narration']?.trim() || '';

        if(!accCode){ errors.push(`Row ${r._rowNum}: accountCode is required`); return; }
        if(!data.coa.find(a => a.id === accCode)){
          errors.push(`Row ${r._rowNum}: account "${accCode}" not found in Chart of Accounts`); return;
        }
        if(dr===0 && cr===0){ errors.push(`Row ${r._rowNum}: both debit and credit are zero`); return; }

        // Resolve cost centre + department codes to IDs
        const ccCode   = r['costCentre']?.trim();
        const deptCode = r['department']?.trim();
        const ccId   = ccCode   ? (data.costCentres||[]).find(c=>c.code.toUpperCase()===ccCode.toUpperCase())?.id||'' : '';
        const deptId = deptCode ? (data.departments||[]).find(d=>d.code.toUpperCase()===deptCode.toUpperCase())?.id||'' : '';

        // Party lookup / auto-create
        const pName  = r['partyName']?.trim();
        const pGSTIN = r['partyGSTIN']?.trim();
        const pType  = r['partyType']?.trim() || 'Vendor';
        let   resolvedPartyId = '';
        if(pName){
          vPartyName = pName;
          let party = data.parties.find(p => p.name.toLowerCase()===pName.toLowerCase());
          if(!party) party = newParties.find(p => p.name.toLowerCase()===pName.toLowerCase());
          if(!party){
            party = {id:uid(), name:pName, type:pType==='Customer'?'Customer':'Vendor',
              gstin:pGSTIN||'', state:'Gujarat', stateCode:'24', address:'', email:'', phone:'',
              currency:'INR', balance:0, unregistered:!pGSTIN};
            newParties.push(party);
          }
          resolvedPartyId = party.id;
          vPartyId = party.id;
        }

        if(!vNarration && narr) vNarration = narr;
        totalDr += dr; totalCr += cr;
        lines.push({id:uid(), accountId:accCode, debit:dr, credit:cr, narration:narr,
          costCentreId:ccId, departmentId:deptId,
          ...(resolvedPartyId ? {partyId:resolvedPartyId} : {})});
      });

      if(lines.length === 0) return;
      if(Math.abs(totalDr-totalCr) > 0.01){
        errors.push(`Group ${grp.reference} (${grp.date}): Unbalanced  Dr ₹${fmt(totalDr)} ≠ Cr ₹${fmt(totalCr)}`);
        return;
      }

      imported.push({
        id:uid(), type:grp.type, date:grp.date, number:'',
        partyName:vPartyName, partyId:vPartyId,
        narration:vNarration, reference:grp.reference,
        lines, amount:totalDr, status:'Posted',
        createdAt: new Date().toISOString(),
      });
    });

    if(errors.length > 0 && imported.length === 0)
      return { count:0, error: errors.slice(0,5).join(' | ') };

    setData(prev => {
      // Add auto-created parties
      const updatedParties = [...prev.parties, ...newParties.filter(np =>
        !prev.parties.find(p=>p.name.toLowerCase()===np.name.toLowerCase()))];
      const numbered = imported.map(v => {
        const typeCount = [...prev.vouchers, ...imported.filter(x=>x!==v)].filter(x=>x.type===v.type).length;
        return {...v, number: v.type+'/'+String(typeCount+1).padStart(4,'0')};
      });
      return {...prev, vouchers:[...prev.vouchers,...numbered], parties:updatedParties,
        auditLog:[...(prev.auditLog||[]), auditEntry('IMPORT', `${numbered.length} vouchers via CSV import`)]};
    });
    const partiesMsg = newParties.length ? ` · ${newParties.length} new ${newParties.length===1?'party':'parties'} created` : '';
    showToast(`Imported ${imported.length} voucher${imported.length!==1?'s':''}${partiesMsg}${errors.length?` (${errors.length} issue${errors.length!==1?'s':''} skipped)`:''}`);
    return { count: imported.length };
  };

  const filteredVouchers = data.vouchers
    .filter(v => filter==='All' || v.type === filter)
    .filter(v => { if(!search) return true; const q=search.toLowerCase();
      return (v.number||'').toLowerCase().includes(q) || (v.partyName||'').toLowerCase().includes(q)
          || (v.narration||'').toLowerCase().includes(q) || (v.reference||'').toLowerCase().includes(q); })
    .sort((a,b) => b.date.localeCompare(a.date) || (b.number||'').localeCompare(a.number||''));
  const vTotalPages = Math.max(1, Math.ceil(filteredVouchers.length / vPageSize));
  const vCurPage    = Math.min(page, vTotalPages);
  const pageVouchers = filteredVouchers.slice((vCurPage-1)*vPageSize, vCurPage*vPageSize);

  const openNew = (type) => {
    if(isAtLimit){ setShowUpgradeGate(true); return; }
    setVtype(type);
    setEditing(null);
    setShowModal(true);
  };

  const handleSave = (v) => {
    // Period lock: no posting/editing into a closed FY
    if(isDateLocked(data.company, v.date)){
      showToast(`Books are locked up to ${data.company.booksLockedUpto}  cannot post on ${fmtDate(v.date)}`,'error');
      return;
    }
    if(editing && isDateLocked(data.company, editing.date)){
      showToast(`Voucher ${editing.number} is in a locked period and cannot be edited`,'error');
      return;
    }
    if(editing){
      setData(prev => ({...prev,
        vouchers: prev.vouchers.map(x => x.id === editing.id ? {...v, id:editing.id} : x),
        auditLog: [...(prev.auditLog||[]), auditEntry('EDIT', `${editing.number} (${v.type}) ₹${fmt(v.amount||0)} dt ${fmtDate(v.date)}`)],
      }));
      showToast('Voucher updated: ' + v.number);
    } else {
      setData(prev => {
        const num = nextVoucherNumber(prev, v.type);
        return {...prev,
          vouchers: [...prev.vouchers, {...v, id:uid(), number:v.number||num, createdAt:new Date().toISOString()}],
          auditLog: [...(prev.auditLog||[]), auditEntry('CREATE', `${v.number||num} (${v.type}) ₹${fmt(v.amount||0)} dt ${fmtDate(v.date)}`)],
        };
      });
      showToast('Voucher posted: ' + (v.number || v.type));
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (v) => {
    if(isDateLocked(data.company, v.date)){
      showToast(`Voucher ${v.number} is in a locked period and cannot be cancelled`,'error');
      return;
    }
    if(!confirm('Cancel voucher ' + v.number + '?')) return;
    setData({...data,
      vouchers: data.vouchers.map(x => x.id === v.id ? {...x, status:'Cancelled'} : x),
      auditLog: [...(data.auditLog||[]), auditEntry('CANCEL', `${v.number} (${v.type}) ₹${fmt(v.amount||0)} dt ${fmtDate(v.date)}`)],
    });
    showToast('Voucher cancelled');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Vouchers</h1>
          <div className="page-sub">Double-entry posting · GST-aware · {data.vouchers.length} entries</div>
        </div>
        {!readOnly && <div className="page-actions">
          <button className="btn" onClick={() => setShowImport(true)}>⬆ Bulk Import CSV</button>
        </div>}
      </div>

      {readOnly && <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:12,color:'#5d4037'}}>
        👁 <b>Viewer / Auditor mode</b>  you can view all entries but cannot create, edit or cancel vouchers.
      </div>}

      {/* Free tier usage banner */}
      {SUBSCRIPTION_ENABLED && !prem && !readOnly && (
        <div style={{
          background: isAtLimit ? 'linear-gradient(90deg,#c62828,#e53935)' : activeCount >= FREE_VOUCHER_LIMIT - 2 ? 'linear-gradient(90deg,#e65100,#f57c00)' : 'linear-gradient(90deg,#0b6b4f,#1a9a72)',
          color:'#fff', borderRadius:10, padding:'12px 18px', marginBottom:16,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:20}}>{isAtLimit ? '🚫' : activeCount >= FREE_VOUCHER_LIMIT - 2 ? '⚠️' : '⚡'}</span>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>
                {isAtLimit
                  ? `Free limit reached  ${activeCount}/${FREE_VOUCHER_LIMIT} entries used`
                  : `Free Plan · ${activeCount} of ${FREE_VOUCHER_LIMIT} free entries used`}
              </div>
              <div style={{fontSize:11,opacity:.88,marginTop:1}}>
                {isAtLimit
                  ? 'Upgrade to Premium (₹1,500/month) to post unlimited vouchers'
                  : `${FREE_VOUCHER_LIMIT - activeCount} entries remaining · Upgrade anytime for unlimited access`}
              </div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{background:'rgba(255,255,255,.2)',borderRadius:20,width:100,height:6,overflow:'hidden',flexShrink:0}}>
              <div style={{background:'#fff',height:'100%',borderRadius:20,width:`${Math.min(100,(activeCount/FREE_VOUCHER_LIMIT)*100)}%`,transition:'width .4s'}}></div>
            </div>
            <button onClick={()=>setShowUpgradeGate(true)}
              style={{background:'#fff',color:'var(--primary)',border:'none',borderRadius:20,padding:'6px 18px',fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 1px 4px #0002'}}>
              🚀 Upgrade Now
            </button>
          </div>
        </div>
      )}

      {!readOnly && <div className="voucher-types">
        {VOUCHER_TYPES.map(vt => (
          <button key={vt.code} className="vt-btn" onClick={() => openNew(vt.code)}>
            <div className="vt-icon">{vt.icon}</div>
            <div className="vt-name">{vt.name}</div>
            <div className="vt-desc">{vt.desc}</div>
          </button>
        ))}
      </div>}

      <div className="filter-bar">
        <div className="field"><label>Filter by Type</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option>All</option>
            {VOUCHER_TYPES.map(vt => <option key={vt.code} value={vt.code}>{vt.name} ({vt.code})</option>)}
          </select>
        </div>
        <div className="field" style={{flex:1,minWidth:200}}><label>Search</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Voucher no, party, narration, reference…" />
        </div>
        <div style={{marginLeft:'auto',alignSelf:'flex-end',fontSize:12,color:'var(--ink-3)',paddingBottom:6}}>
          {filteredVouchers.length} voucher{filteredVouchers.length!==1?'s':''}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th style={{width:90}}>Date</th><th>Voucher No.</th><th>Type</th><th>Party / Ref</th><th>Narration</th><th className="num">Amount</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filteredVouchers.length === 0 ? (
              <tr><td colSpan="8"><div className="empty"><div className="empty-ico">∅</div><div>{search||filter!=='All'?'No vouchers match your filter.':'No vouchers yet - pick a type above to start.'}</div></div></td></tr>
            ) : pageVouchers.map(v => (
              <tr key={v.id} style={{opacity:v.status==='Cancelled'?.5:1}}>
                <td>{fmtDate(v.date)}</td>
                <td style={{fontFamily:'var(--mono)', fontWeight:600}}>{v.number}{(v.attachments||[]).length>0 && <span title={(v.attachments||[]).length+' attachment(s)'} style={{marginLeft:5,fontSize:11}}>📎</span>}</td>
                <td><span className="badge badge-info">{v.type}</span></td>
                <td>{v.partyName || ''}</td>
                <td style={{maxWidth:280, fontSize:12, color:'var(--ink-2)'}}>{v.narration || ''}</td>
                <td className="num bold">₹{fmt(v.amount||0)}</td>
                <td><span className={'badge ' + (v.status==='Cancelled'?'badge-danger':'badge-success')}>{v.status||'Posted'}</span></td>
                <td className="actions">
                  {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(v); setVtype(v.type); setShowModal(true); }}>{v.status==='Cancelled'?'View':'Edit'}</button>}
                  {!readOnly && <button className="btn btn-sm btn-ghost" style={{color:'var(--ink-2)'}} title="Create a new voucher pre-filled from this one" onClick={() => duplicate(v)}>⧉ Copy</button>}
                  {['SAL','PUR','CRN','DBN'].includes(v.type) && v.status!=='Cancelled' && <button className="btn btn-sm btn-ghost" style={{color:'var(--primary)'}} onClick={() => generateInvoicePDF(v, data)}>⎙ PDF</button>}
                  {['SAL','CRN','DBN'].includes(v.type) && v.status!=='Cancelled' && (v.items||[]).length>0 && <button className="btn btn-sm btn-ghost" style={{color:'var(--info)'}} title="Download e-invoice IRP JSON" onClick={() => generateEInvoiceJSON(v, data)}>⊕ e-Inv</button>}
                  {['SAL','CRN'].includes(v.type) && v.status!=='Cancelled' && (v.items||[]).length>0 && (v.total||v.amount||0)>50000 && <button className="btn btn-sm btn-ghost" style={{color:'var(--warning)'}} title="Download NIC e-Way Bill JSON (consignment > ₹50,000)" onClick={() => generateEWayBillJSON(v, data)}>🚚 e-Way</button>}
                  {!readOnly && v.status!=='Cancelled' && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v)}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vTotalPages > 1 && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginTop:14,fontSize:13}}>
          <button className="btn btn-sm" disabled={vCurPage<=1} onClick={()=>setPage(1)}>« First</button>
          <button className="btn btn-sm" disabled={vCurPage<=1} onClick={()=>setPage(vCurPage-1)}>‹ Prev</button>
          <span style={{color:'var(--ink-3)'}}>Page <b style={{color:'var(--ink)'}}>{vCurPage}</b> of {vTotalPages}
            <span style={{marginLeft:8}}>({(vCurPage-1)*vPageSize+1}–{Math.min(vCurPage*vPageSize, filteredVouchers.length)} of {filteredVouchers.length})</span></span>
          <button className="btn btn-sm" disabled={vCurPage>=vTotalPages} onClick={()=>setPage(vCurPage+1)}>Next ›</button>
          <button className="btn btn-sm" disabled={vCurPage>=vTotalPages} onClick={()=>setPage(vTotalPages)}>Last »</button>
        </div>
      )}

      {showModal && <VoucherModal vtype={vtype} voucher={editing} prefill={dup} data={data} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); setDup(null); }} showToast={showToast} />}
      {showImport && <CsvImportModal title="Bulk Import Vouchers" sampleHeaders={VCHR_SAMPLE_HEADERS} sampleRows={VCHR_SAMPLE_ROWS} sampleFilename="vouchers_import_template.csv" onImport={handleImportVouchers} onClose={() => setShowImport(false)} />}
      {showUpgradeGate && (
        <UpgradeModal data={data} setData={setData} showToast={showToast}
          onClose={()=>setShowUpgradeGate(false)} triggerReason="limit" />
      )}
    </>
  );
}

// ============================================================================
// SEARCHABLE SELECT  typeahead for account/party pickers
// ============================================================================
function SearchableSelect({options, value, onChange, placeholder, style}){
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e) => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 40);

  return (
    <div ref={ref} style={{position:'relative', ...style}}>
      <div style={{display:'flex', border:'1px solid var(--line-2)', borderRadius:'var(--radius-sm)', background:'var(--surface)', overflow:'hidden'}}>
        <input
          value={open ? query : (selected ? selected.label : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true); if(!e.target.value) onChange(''); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          placeholder={placeholder || ' Search or select '}
          style={{flex:1, padding:'6px 8px', border:'none', outline:'none', fontSize:12, background:'transparent'}}
        />
        <span style={{padding:'0 8px', display:'flex', alignItems:'center', color:'var(--ink-3)', fontSize:10, cursor:'pointer', userSelect:'none'}} onClick={() => setOpen(!open)}>▾</span>
      </div>
      {open && (
        <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:200, background:'var(--surface)', border:'1px solid var(--line-2)', borderRadius:'var(--radius-sm)', boxShadow:'var(--shadow)', maxHeight:220, overflowY:'auto'}}>
          {filtered.length === 0 && <div style={{padding:'8px 12px', fontSize:11, color:'var(--ink-3)'}}>No results for "{query}"</div>}
          {filtered.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setQuery(''); setOpen(false); }}
              style={{padding:'6px 12px', fontSize:11.5, cursor:'pointer', background: o.value===value ? 'var(--primary-soft)' : 'transparent', color: o.value===value ? 'var(--primary)' : 'var(--ink-2)'}}
              onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = o.value===value ? 'var(--primary-soft)' : 'transparent'}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VoucherModal({vtype, voucher, prefill, data, onSave, onClose, showToast}){
  const vt = VOUCHER_TYPES.find(x => x.code === vtype);
  const [f, setF] = useState(voucher || prefill || {
    type: vtype,
    date: today(),
    number: '',
    partyId: '',
    partyName: '',
    narration: '',
    reference: '',
    currency: 'INR',
    fxRate: 1,
    placeOfSupply: data.company.stateCode,
    lines: [
      {id:uid(), accountId:'', debit:0, credit:0, narration:'', costCentreId:'', departmentId:''},
      {id:uid(), accountId:'', debit:0, credit:0, narration:'', costCentreId:'', departmentId:''},
    ],
    items: [],  // For sales/purchase: itemized lines
    amount: 0,
    status: 'Posted',
  });

  const isGstVoucher = ['SAL','PUR','CRN','DBN'].includes(vtype);
  const isCashType = ['PAY','REC','CON'].includes(vtype);

  // Auto-calc GST for sales/purchase
  useEffect(() => {
    if(!isGstVoucher) return;
    if(!f.items || f.items.length===0) return;
    const party = data.parties.find(p => p.id === f.partyId);
    const isInterState = party && party.stateCode !== data.company.stateCode && !party.isForeign;
    const isExport = party && party.isForeign;

    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    f.items.forEach(it => {
      const amt = (it.qty || 0) * (it.rate || 0);
      taxable += amt;
      const tax = amt * (it.gstRate || 0) / 100;
      if(isExport){ /* zero-rated */ }
      else if(isInterState){ igst += tax; }
      else { cgst += tax/2; sgst += tax/2; }
    });
    const total = taxable + cgst + sgst + igst;
    if(Math.abs((f.taxable||0) - taxable) > 0.01 || Math.abs((f.total||0) - total) > 0.01){
      // Generate lines for double-entry
      const lines = [];
      // Dr Customer / Cr Vendor for total
      if(vtype === 'SAL'){
        if(f.partyId){
          lines.push({id:uid(), accountId:'2400', debit:total, credit:0, narration:'To ' + (party?.name||'')});
        }
        f.items.forEach(it => {
          const amt = (it.qty||0)*(it.rate||0);
          if(amt>0) lines.push({id:uid(), accountId: it.accountId || '3100', debit:0, credit:amt, narration:it.description});
        });
        if(isInterState && igst>0) lines.push({id:uid(), accountId:'1312', debit:0, credit:igst, narration:'IGST Output'});
        if(!isInterState && cgst>0) lines.push({id:uid(), accountId:'1310', debit:0, credit:cgst, narration:'CGST Output'});
        if(!isInterState && sgst>0) lines.push({id:uid(), accountId:'1311', debit:0, credit:sgst, narration:'SGST Output'});
      } else if(vtype === 'PUR'){
        f.items.forEach(it => {
          const amt = (it.qty||0)*(it.rate||0);
          if(amt>0) lines.push({id:uid(), accountId: it.accountId || '4100', debit:amt, credit:0, narration:it.description});
        });
        if(isInterState && igst>0) lines.push({id:uid(), accountId:'2602', debit:igst, credit:0, narration:'IGST Input'});
        if(!isInterState && cgst>0) lines.push({id:uid(), accountId:'2600', debit:cgst, credit:0, narration:'CGST Input'});
        if(!isInterState && sgst>0) lines.push({id:uid(), accountId:'2601', debit:sgst, credit:0, narration:'SGST Input'});
        // Creditor = full invoice total (TDS will be split out on Post via submit)
        if(f.partyId){
          lines.push({id:uid(), accountId:'1300', debit:0, credit:total, narration:'To ' + (party?.name||'')});
        }
      } else if(vtype === 'CRN'){
        // Credit Note = reverse of a Sale: Dr income + Dr GST-output reversal, Cr Customer
        f.items.forEach(it => {
          const amt = (it.qty||0)*(it.rate||0);
          if(amt>0) lines.push({id:uid(), accountId: it.accountId || '3100', debit:amt, credit:0, narration:it.description||'Sales return'});
        });
        if(isInterState && igst>0) lines.push({id:uid(), accountId:'1312', debit:igst, credit:0, narration:'IGST reversal'});
        if(!isInterState && cgst>0) lines.push({id:uid(), accountId:'1310', debit:cgst, credit:0, narration:'CGST reversal'});
        if(!isInterState && sgst>0) lines.push({id:uid(), accountId:'1311', debit:sgst, credit:0, narration:'SGST reversal'});
        if(f.partyId) lines.push({id:uid(), accountId:'2400', debit:0, credit:total, narration:'To ' + (party?.name||''), partyId:f.partyId});
      } else if(vtype === 'DBN'){
        // Debit Note = reverse of a Purchase: Dr Vendor, Cr purchase + Cr GST-input reversal
        if(f.partyId) lines.push({id:uid(), accountId:'1300', debit:total, credit:0, narration:'To ' + (party?.name||''), partyId:f.partyId});
        f.items.forEach(it => {
          const amt = (it.qty||0)*(it.rate||0);
          if(amt>0) lines.push({id:uid(), accountId: it.accountId || '4100', debit:0, credit:amt, narration:it.description||'Purchase return'});
        });
        if(isInterState && igst>0) lines.push({id:uid(), accountId:'2602', debit:0, credit:igst, narration:'IGST reversal'});
        if(!isInterState && cgst>0) lines.push({id:uid(), accountId:'2600', debit:0, credit:cgst, narration:'CGST reversal'});
        if(!isInterState && sgst>0) lines.push({id:uid(), accountId:'2601', debit:0, credit:sgst, narration:'SGST reversal'});
      }
      // Stamp voucher-level Cost Centre / Department onto generated lines.
      // Reports only read CC from Income/Expense accounts, so stamping all
      // lines is safe  and survives line regeneration on item edits.
      const stamped = lines.map(l => ({...l,
        costCentreId: f.costCentreId || l.costCentreId || '',
        departmentId: f.departmentId || l.departmentId || ''}));

      // Round the invoice to the nearest rupee and book the paise difference to
      // the Round Off ledger (standard GST practice), so the amount receivable /
      // payable is a clean rupee and the entry stays balanced.
      const ROUNDOFF_ACCT = '4900';
      let finalLines = stamped, roundOff = 0, roundedTotal = total;
      const roundCfg = ({SAL:['2400','debit'], DBN:['1300','debit'], PUR:['1300','credit'], CRN:['2400','credit']})[vtype];
      const roEnabled = data.company.roundOff !== false && data.coa.some(a=>a.id===ROUNDOFF_ACCT);
      if(roEnabled && roundCfg){
        roundedTotal = Math.round(total);
        roundOff = Math.round((roundedTotal - total)*100)/100;
        const [pAcct, pSide] = roundCfg;
        const pLine = Math.abs(roundOff) >= 0.01 ? finalLines.find(l => l.accountId===pAcct && (l[pSide]||0) > 0) : null;
        if(pLine){
          finalLines = finalLines.map(l => l===pLine ? {...l, [pSide]: roundedTotal} : l);
          const dr = finalLines.reduce((s,l)=>s+(l.debit||0),0);
          const cr = finalLines.reduce((s,l)=>s+(l.credit||0),0);
          const d  = Math.round((dr-cr)*100)/100;   // + → need a credit; − → need a debit
          if(Math.abs(d) >= 0.01) finalLines = [...finalLines, {id:uid(), accountId:ROUNDOFF_ACCT,
            debit: d<0 ? -d : 0, credit: d>0 ? d : 0, narration:'Round Off',
            costCentreId:f.costCentreId||'', departmentId:f.departmentId||''}];
        } else { roundOff = 0; roundedTotal = total; }
      }
      setF(prev => ({...prev, lines: finalLines, taxable, cgst, sgst, igst, total,
        roundOff, grandTotal: roundedTotal, amount: roundedTotal, isInterState, isExport}));
    }
  }, [f.items, f.partyId]);

  // Re-stamp CC/Dept when changed on a GST voucher (lines table is hidden there,
  // so the voucher-level selection is the single source of truth)
  useEffect(() => {
    if(!isGstVoucher) return;
    setF(prev => ({...prev, lines: (prev.lines||[]).map(l => ({...l,
      costCentreId: prev.costCentreId || '',
      departmentId: prev.departmentId || ''}))}));
  }, [f.costCentreId, f.departmentId]);

  // Track last-used cost centre and department for auto-propagation
  const lastCC   = useRef('');
  const lastDept = useRef('');

  const addLine = () => {
    // Auto-fill CC + Dept from the last line that had them set
    const lastLine = [...f.lines].reverse().find(l => l.costCentreId || l.departmentId);
    setF({...f, lines:[...f.lines, {id:uid(), accountId:'', debit:0, credit:0, narration:'',
      costCentreId: lastCC.current || lastLine?.costCentreId || '',
      departmentId: lastDept.current || lastLine?.departmentId || ''}]});
  };
  const removeLine = (id) => setF({...f, lines:f.lines.filter(l => l.id !== id)});
  const updateLine = (id, field, value) => {
    // Track last CC / Dept selection for auto-propagate
    if(field==='costCentreId' && value) lastCC.current = value;
    if(field==='departmentId' && value) lastDept.current = value;
    // When user sets CC or Dept on one line, offer to apply to ALL blank lines
    if((field==='costCentreId'||field==='departmentId') && value){
      const blankOthers = f.lines.filter(l => l.id!==id && !l[field]);
      if(blankOthers.length > 0){
        // Silently auto-propagate to other blank lines (no prompt  easy to change)
        const lines = f.lines.map(l => {
          if(l.id===id) return {...l, [field]: value};
          if(!l[field]) return {...l, [field]: value}; // auto-fill blank lines
          return l;
        });
        const amt = lines.reduce((s,l)=>s+(l.debit||0),0);
        setF({...f, lines, amount:f.amount||amt});
        return;
      }
    }
    const lines = f.lines.map(l => l.id === id ? {...l, [field]: field==='debit'||field==='credit' ? (parseFloat(value)||0) : value} : l);
    // For non-GST manual entries, recalc amount
    const amt = lines.reduce((s,l) => s + (l.debit||0), 0);
    setF({...f, lines, amount: f.amount || amt});
  };

  const addItem = () => setF({...f, items:[...(f.items||[]), {id:uid(), description:'', hsn:'', qty:1, rate:0, gstRate:18, accountId: vtype==='SAL'?'3100':'4100', itemId:''}]});
  const removeItem = (id) => setF({...f, items:f.items.filter(i => i.id !== id)});
  const updateItem = (id, field, value) => {
    let items = f.items.map(i => {
      if(i.id !== id) return i;
      const updated = {...i, [field]: ['qty','rate','gstRate'].includes(field) ? (parseFloat(value)||0) : value};
      // When a stock item is selected, auto-fill description, HSN, GST Rate
      if(field === 'itemId' && value) {
        const si = (data.stockItems||[]).find(s => s.id === value);
        if(si) {
          updated.description = updated.description || si.name;
          updated.hsn = si.hsn || updated.hsn;
          updated.gstRate = si.gstRate != null ? si.gstRate : updated.gstRate;
        }
      }
      // When an HSN/SAC code is entered, look it up in the GST 2.0 master and
      // auto-fill the GST rate (and description if still blank).
      if(field === 'hsn' && value) {
        const m = hsnLookup(value);
        if(m && m.rate >= 0) {
          updated.gstRate = m.rate;
          if(!updated.description) updated.description = m.desc;
        }
      }
      return updated;
    });
    setF({...f, items});
  };

  const totalDr = f.lines.reduce((s,l) => s + (l.debit||0), 0);
  const totalCr = f.lines.reduce((s,l) => s + (l.credit||0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;
  // Esc closes the voucher modal - but not while focus is inside a field
  // (typing Esc there is often "dismiss suggestion", not "discard my entry")
  useEffect(() => {
    const h = (e) => {
      if(e.key !== 'Escape') return;
      const el = e.target;
      if(el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT')){ el.blur(); return; }
      onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Warn if another live voucher of the same type already uses this number
  const dupNumber = !!(f.number||'').trim() && (data.vouchers||[]).some(v =>
    v.id !== f.id && v.type === f.type && v.status !== 'Cancelled' &&
    (v.number||'').trim().toLowerCase() === (f.number||'').trim().toLowerCase());

  // ── Credit control (SAL): outstanding + this invoice vs the party's limit ──
  const creditCheck = useMemo(() => {
    if(vtype !== 'SAL' || !f.partyId) return null;
    const p = data.parties.find(x => x.id === f.partyId);
    if(!p) return null;
    const alloc = {};
    (data.vouchers||[]).forEach(v => {
      if(v.status==='Cancelled') return;
      (v.billTags||[]).forEach(bt => { alloc[bt.voucherId] = (alloc[bt.voucherId]||0) + (bt.allocated||0); });
    });
    let outstanding = 0, oldestOverdue = 0;
    const creditDays = p.creditDays != null ? p.creditDays : 30;
    (data.vouchers||[]).forEach(v => {
      if(v.type!=='SAL' || v.status==='Cancelled' || v.partyId!==f.partyId || v.id===f.id) return;
      const ctrl = (v.lines||[]).reduce((s,l)=> s + (l.accountId==='2400' ? (l.debit||0) : 0), 0);
      const out = Math.max(0, (ctrl || v.total || v.amount || 0) - (alloc[v.id]||0));
      if(out > 0.01){
        outstanding += out;
        const od = Math.floor((new Date(today()) - new Date(v.date))/86400000) - creditDays;
        if(od > oldestOverdue) oldestOverdue = od;
      }
    });
    const projected = outstanding + (f.total||f.amount||0);
    const limit = p.creditLimit || 0;
    return { name:p.name, outstanding, projected, limit, creditDays, oldestOverdue,
      overLimit: limit > 0 && projected > limit,
      hasOverdue: oldestOverdue > 0 };
  }, [vtype, f.partyId, f.total, f.amount, data.vouchers, data.parties]);

  // ── Smart suggestion: repeat the last similar entry ────────────────────────
  // When a party is picked on a NEW voucher, offer the most recent voucher of
  // the same type for that party as a one-click template (items, accounts,
  // narration, TDS setup) - most business entries repeat month after month.
  const [tplUsed, setTplUsed] = useState(false);
  const lastSimilar = useMemo(() => {
    if(voucher || !f.partyId) return null;
    const past = (data.vouchers||[])
      .filter(v => v.type === vtype && v.partyId === f.partyId && v.status !== 'Cancelled')
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
    return past[0] || null;
  }, [voucher, vtype, f.partyId, data.vouchers]);

  // ── Double-payment guard ──────────────────────────────────────────────────
  // Warn if a near-identical PAY/REC already exists (same party, same amount,
  // within ±4 days) - the classic "paid the same bill twice" mistake.
  const dupPayment = useMemo(() => {
    if(voucher || !['PAY','REC'].includes(vtype) || !f.partyId) return null;
    const amt = f.amount || 0; if(amt <= 0 || !f.date) return null;
    const d0 = new Date(f.date);
    return (data.vouchers||[]).find(v => v.type===vtype && v.status!=='Cancelled' && v.partyId===f.partyId
      && Math.abs((v.amount||0) - amt) < 0.5
      && Math.abs((new Date(v.date) - d0) / 86400000) <= 4) || null;
  }, [voucher, vtype, f.partyId, f.amount, f.date, data.vouchers]);
  const applyTemplate = () => {
    if(!lastSimilar) return;
    const L = lastSimilar;
    setF(prev => ({...prev,
      narration: L.narration || prev.narration,
      costCentreId: L.costCentreId || prev.costCentreId || '',
      departmentId: L.departmentId || prev.departmentId || '',
      items: (L.items||[]).map(it => ({...it, id:uid()})),
      lines: (L.lines||[]).map(l => ({...l, id:uid()})),
      amount: L.amount||0, taxable: L.taxable, cgst: L.cgst, sgst: L.sgst, igst: L.igst, total: L.total,
      isInterState: L.isInterState, isExport: L.isExport,
      tdsApplicable: L.tdsApplicable||false, tdsSection: L.tdsSection||'', tdsRate: L.tdsRate||0,
      tdsAmount: L.tdsAmount||0, tdsLedgerId: L.tdsLedgerId||'', tdsBaseAmount: L.tdsBaseAmount||0,
    }));
    setTplUsed(true);
  };
  useEffect(() => { setTplUsed(false); }, [f.partyId]);

  // ── Original Invoice link (CRN / DBN) ───────────────────────────────────
  // A Credit/Debit Note can be raised against ONE original Sales/Purchase
  // invoice - linking it reuses the same billTags mechanism as PAY/REC, so
  // Bill-wise Ageing, Collections and the credit-limit check all automatically
  // reduce that specific invoice's outstanding. "Self" = a general adjustment
  // (rate correction, discount) not tied to a specific bill.
  const isNoteType = ['CRN','DBN'].includes(vtype);
  const noteInvType = vtype==='CRN' ? 'SAL' : 'PUR';
  const [origInvoiceId, setOrigInvoiceId] = useState(voucher?.originalInvoiceId || '');
  const noteInvoices = useMemo(() => {
    if(!isNoteType || !f.partyId) return [];
    return data.vouchers.filter(v => v.type===noteInvType && v.status!=='Cancelled' && v.partyId===f.partyId)
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [isNoteType, noteInvType, f.partyId, data.vouchers]);
  useEffect(() => {
    if(!isNoteType) return;
    if(origInvoiceId && !noteInvoices.some(v=>v.id===origInvoiceId)) setOrigInvoiceId('');
  }, [f.partyId]);

  // Pull the original invoice's line items + place-of-supply into this note, so
  // a full return is one dropdown pick. Zeroing taxable/total forces the auto-GST
  // effect above to rebuild the reversal lines from the imported items.
  const importFromInvoice = (inv) => {
    if(!inv) return;
    setF(prev => ({...prev,
      placeOfSupply: inv.placeOfSupply || prev.placeOfSupply,
      reference: inv.number || prev.reference,
      narration: prev.narration || ((vtype==='CRN'?'Credit note against ':'Debit note against ')+(inv.number||'')),
      items: (inv.items||[]).map(it => ({...it, id:uid()})),
      taxable:0, cgst:0, sgst:0, igst:0, total:0, amount:0,
    }));
  };

  // ── Bill Tagging (PAY / REC) ─────────────────────────────────────────────
  const isBillType = ['PAY','REC'].includes(vtype);
  // PAY → outstanding PUR invoices; REC → outstanding SAL invoices
  const invType = vtype==='PAY' ? 'PUR' : 'SAL';
  const [billTags, setBillTags] = useState(voucher?.billTags || []);
  const [isAdvance, setIsAdvance] = useState(voucher?.isAdvance || false);

  // Compute outstanding invoices for selected party
  const outstandingInvoices = useMemo(() => {
    if(!isBillType || !f.partyId) return [];
    const invoices = data.vouchers.filter(v =>
      v.type === invType && v.status !== 'Cancelled' && v.partyId === f.partyId
    );
    // Sum all existing allocations from OTHER vouchers.
    // Cancelled payments/receipts release their allocations  the bill
    // becomes outstanding again.
    const allocMap = {};
    data.vouchers.forEach(v => {
      if(v.status === 'Cancelled') return;
      if(voucher && v.id === voucher.id) return;
      (v.billTags||[]).forEach(bt => {
        allocMap[bt.voucherId] = (allocMap[bt.voucherId]||0) + (bt.allocated||0);
      });
    });
    return invoices.map(inv => {
      // Amount actually owed = the party CONTROL-ACCOUNT line, NOT gross of all lines.
      // PUR: Cr on 1300 (Sundry Creditors)  already net of TDS deducted.
      // SAL: Dr on 2400 (Trade Receivables)  invoice value incl. GST.
      const ctrl = invType==='SAL' ? '2400' : '1300';
      const ctrlAmt = (inv.lines||[]).reduce((s,l) =>
        s + (l.accountId===ctrl ? (invType==='SAL' ? (l.debit||0) : (l.credit||0)) : 0), 0);
      const invTotal = ctrlAmt || inv.total || inv.amount || 0;
      const alreadyPaid = allocMap[inv.id] || 0;
      const outstanding = Math.max(0, invTotal - alreadyPaid);
      return {...inv, invTotal, alreadyPaid, outstanding};
    }).filter(inv => inv.outstanding > 0.01)
      .sort((a,b) => a.date.localeCompare(b.date));
  }, [isBillType, f.partyId, invType, data.vouchers, voucher]);

  const totalTagged = billTags.reduce((s,bt) => s+(bt.allocated||0), 0);

  const updateBillTag = (voucherId, allocated) => {
    const existing = billTags.find(bt => bt.voucherId === voucherId);
    if(allocated <= 0){
      setBillTags(billTags.filter(bt => bt.voucherId !== voucherId));
    } else if(existing){
      setBillTags(billTags.map(bt => bt.voucherId===voucherId ? {...bt, allocated} : bt));
    } else {
      setBillTags([...billTags, {voucherId, allocated}]);
    }
  };

  const submit = () => {
    let finalLines = [...f.lines];
    let finalData = {...f};

    if(f.tdsApplicable && f.tdsAmount > 0 && f.tdsLedgerId){
      // Remove any previously auto-added TDS lines
      finalLines = finalLines.filter(l => l._tdsAuto !== true);
      const drTotal = finalLines.reduce((s,l) => s+(l.debit||0),0);
      const netPayable = Math.round((drTotal - f.tdsAmount)*100)/100;

      if(vtype === 'JV'){
        // Find the main credit line (non-TDS)
        const credLine = finalLines.find(l => (l.credit||0) > 0 && !l._tdsAuto);
        if(credLine){
          // Always SET to Dr - TDS (idempotent  safe for new and update)
          credLine.credit = Math.round(Math.max(0, drTotal - f.tdsAmount)*100)/100;
        }
      }

      if(vtype === 'PUR'){
        // Always SET Creditor = invoice total - TDS (not reduce, to avoid repeated reduction on edit)
        const credLine = finalLines.find(l => l.accountId === '1300' && !l._tdsAuto);
        if(credLine){
          // f.total = invoice total (taxable + GST); net payable = total - TDS
          credLine.credit = Math.round(Math.max(0, (f.total||drTotal) - f.tdsAmount)*100)/100;
        }
      }

      // Inject TDS Payable credit line
      finalLines.push({id:uid(), accountId:f.tdsLedgerId, debit:0, credit:f.tdsAmount,
        narration:'TDS u/s '+(f.tdsSection||''), _tdsAuto:true});
      finalData = {...f, lines: finalLines};
    }

    // Remove empty lines (no account, no amounts) before posting
    finalData = {...finalData, lines: finalData.lines.filter(l => l.accountId && ((l.debit||0)>0 || (l.credit||0)>0))};
    const dr2 = finalData.lines.reduce((s,l) => s+(l.debit||0),0);
    const cr2 = finalData.lines.reduce((s,l) => s+(l.credit||0),0);
    if(Math.abs(dr2-cr2) > 0.01){
      showToast('Dr '+fmt(dr2)+' vs Cr '+fmt(cr2)+'  Difference: '+fmt(Math.abs(dr2-cr2))+'. Enter Cr amount or use Auto-Balance.','error');
      return;
    }
    if(dr2 === 0){ showToast('Cannot post a zero-value entry','error'); return; }

    // Budget enforcement for Cost Centres
    const ccBudgetWarnings = [];
    const ccBudgetBlocks   = [];
    const costCentres = data.costCentres || [];
    if(costCentres.length > 0){
      // Group expense debit amounts by costCentreId in this voucher
      const voucherCcSpend = {};
      finalData.lines.forEach(l => {
        if(!l.costCentreId) return;
        const acc = data.coa.find(a => a.id === l.accountId);
        if(!acc || acc.type !== 'Expense') return; // only track expense lines
        voucherCcSpend[l.costCentreId] = (voucherCcSpend[l.costCentreId] || 0) + (l.debit||0);
      });
      Object.entries(voucherCcSpend).forEach(([ccId, newAmt]) => {
        const cc = costCentres.find(c => c.id === ccId);
        if(!cc || !cc.budget || cc.budget <= 0) return;
        // Sum existing posted vouchers for this cost centre (excluding current voucher if editing)
        const existingSpend = (data.vouchers || []).reduce((total, v) => {
          if(voucher && v.id === voucher.id) return total; // skip self on edit
          return total + (v.lines||[]).reduce((ls, l) => {
            if(l.costCentreId !== ccId) return ls;
            const a = data.coa.find(a2 => a2.id === l.accountId);
            if(!a || a.type !== 'Expense') return ls;
            return ls + (l.debit||0);
          }, 0);
        }, 0);
        const projected = existingSpend + newAmt;
        const remaining = cc.budget - existingSpend;
        if(projected > cc.budget){
          const overBy = projected - cc.budget;
          if(cc.budgetEnforce === 'block'){
            ccBudgetBlocks.push(`Cost Centre "${cc.name}": Budget ₹${fmt(cc.budget)}, Spent ₹${fmt(existingSpend)}, This entry ₹${fmt(newAmt)}  OVER by ₹${fmt(overBy)}`);
          } else {
            ccBudgetWarnings.push(`Cost Centre "${cc.name}": Budget ₹${fmt(cc.budget)}, Spent ₹${fmt(existingSpend)}, This entry ₹${fmt(newAmt)} exceeds budget by ₹${fmt(overBy)}`);
          }
        }
      });
    }
    if(ccBudgetBlocks.length > 0){
      showToast('Budget Exceeded  Entry Blocked:\n' + ccBudgetBlocks.join('\n'), 'error');
      return;
    }
    if(ccBudgetWarnings.length > 0){
      const proceed = window.confirm('⚠ Budget Warning:\n\n' + ccBudgetWarnings.join('\n') + '\n\nDo you want to post anyway?');
      if(!proceed) return;
    }

    const party = data.parties.find(p => p.id === finalData.partyId);
    const noteInv = isNoteType ? data.vouchers.find(v=>v.id===origInvoiceId) : null;
    onSave({...finalData, partyName: party?.name||finalData.partyName, amount: dr2,
      billTags: isBillType ? billTags : (isNoteType && origInvoiceId ? [{voucherId:origInvoiceId, allocated:dr2}] : (finalData.billTags||[])),
      isAdvance: isBillType ? isAdvance : (finalData.isAdvance||false),
      originalInvoiceId: isNoteType ? (origInvoiceId||'') : (finalData.originalInvoiceId||''),
      originalInvoiceNumber: isNoteType ? (noteInv?.number||'') : (finalData.originalInvoiceNumber||''),
      originalInvoiceDate: isNoteType ? (noteInv?.date||'') : (finalData.originalInvoiceDate||''),
    });
  };

  // PAY/REC/CON  state lifted to avoid nested-component re-mount flicker
  const initBankAcc = () => {
    if(voucher && voucher.lines){
      if(vtype==='PAY') return voucher.lines.find(l=>(l.credit||0)>0)?.accountId || '2510';
      return voucher.lines.find(l=>(l.debit||0)>0)?.accountId || '2510';
    }
    return '2510';
  };
  const initContraAcc = () => {
    if(voucher && voucher.lines){
      if(vtype==='PAY') return voucher.lines.find(l=>(l.debit||0)>0)?.accountId || '';
      return voucher.lines.find(l=>(l.credit||0)>0)?.accountId || '';
    }
    return '';
  };
  const [spBank, setSpBank]     = useState(initBankAcc);
  const [spAmt,  setSpAmt]      = useState(voucher?.amount || 0);
  const [spContra, setSpContra] = useState(initContraAcc);

  useEffect(() => {
    if(!isCashType) return;
    const lines = [];
    if(vtype === 'PAY'){
      if(spContra) lines.push({id:'l1', accountId: spContra, debit: spAmt, credit: 0});
      if(spBank)   lines.push({id:'l2', accountId: spBank,   debit: 0, credit: spAmt});
    } else if(vtype === 'REC'){
      if(spBank)   lines.push({id:'l1', accountId: spBank,   debit: spAmt, credit: 0});
      if(spContra) lines.push({id:'l2', accountId: spContra, debit: 0, credit: spAmt});
    } else if(vtype === 'CON'){
      if(spBank)   lines.push({id:'l1', accountId: spBank,   debit: spAmt, credit: 0});
      if(spContra) lines.push({id:'l2', accountId: spContra, debit: 0, credit: spAmt});
    }
    setF(prev => ({...prev, lines, amount: spAmt}));
  }, [spBank, spAmt, spContra]);


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{vt.icon} {voucher ? 'Edit' : 'New'} {vt.name} {voucher && <span style={{fontFamily:'var(--mono)', fontSize:13, color:'var(--ink-3)'}}>· {voucher.number}</span>}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {creditCheck && (creditCheck.overLimit || creditCheck.hasOverdue) && (
            <div style={{background: creditCheck.overLimit ? 'var(--danger-soft)' : '#fff8e6',
              border:'1px solid '+(creditCheck.overLimit ? 'var(--danger)' : '#e0b84d'),
              borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12.5, lineHeight:1.6}}>
              <b style={{color: creditCheck.overLimit ? 'var(--danger)' : '#8a6d1a'}}>⚠ Credit control - {creditCheck.name}</b><br/>
              Current outstanding: <b>₹{fmt(creditCheck.outstanding)}</b>
              {(f.total||f.amount||0) > 0 && <> · With this invoice: <b>₹{fmt(creditCheck.projected)}</b></>}
              {creditCheck.limit > 0 && <> · Credit limit: <b>₹{fmt(creditCheck.limit)}</b></>}
              {creditCheck.overLimit && <span style={{color:'var(--danger)',fontWeight:700}}> - exceeds the limit by ₹{fmt(creditCheck.projected - creditCheck.limit)}</span>}
              {creditCheck.hasOverdue && <><br/>Oldest bill is <b>{creditCheck.oldestOverdue} days</b> past the {creditCheck.creditDays}-day credit period - consider collecting before extending more credit (see Collections page).</>}
            </div>
          )}
          {dupPayment && (
            <div style={{background:'var(--danger-soft)',border:'1px solid var(--danger)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12.5,lineHeight:1.6}}>
              <b style={{color:'var(--danger)'}}>⚠ Possible double payment</b><br/>
              A {VOUCHER_TYPES.find(x=>x.code===vtype)?.name || vtype} of <b>₹{fmt(dupPayment.amount||0)}</b> to this party already exists
              ({dupPayment.number} on {fmtDate(dupPayment.date)}). Check you're not paying the same bill twice.
            </div>
          )}
          {lastSimilar && !tplUsed && (
            <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--info-soft)',border:'1px solid var(--info)',
              borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:12,flexWrap:'wrap'}}>
              <span>💡 Last {VOUCHER_TYPES.find(x=>x.code===vtype)?.name || vtype} for this party:
                <b> ₹{fmt(lastSimilar.total||lastSimilar.amount||0)}</b> on {fmtDate(lastSimilar.date)}
                {lastSimilar.narration ? <span style={{color:'var(--ink-3)'}}> · “{lastSimilar.narration.slice(0,50)}{lastSimilar.narration.length>50?'…':''}”</span> : ''}
              </span>
              <button className="btn btn-sm btn-primary" style={{marginLeft:'auto'}} onClick={applyTemplate}
                title="Copies the items, accounts, narration and TDS setup - today's date, new number">↺ Use as template</button>
            </div>
          )}
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="field required"><label>Date</label><input type="date" value={f.date} onChange={e => setF({...f, date:e.target.value})} /></div>
            <div className="field"><label>Voucher No. {dupNumber && <span style={{color:'var(--danger)',fontWeight:700,fontSize:10}} title="Another voucher of this type already uses this number">⚠ Duplicate</span>}</label><input value={f.number} onChange={e => setF({...f, number:e.target.value})} placeholder="Auto-generated" style={dupNumber?{borderColor:'var(--danger)',boxShadow:'0 0 0 2px var(--danger-soft)'}:{}} /></div>
            <div className="field"><label>Reference</label><input value={f.reference} onChange={e => setF({...f, reference:e.target.value})} placeholder="PO#, Bill#, Chq#..." /></div>
            {(isGstVoucher || ['PAY','REC'].includes(vtype)) && (
              <div className="field">
                <label>
                  {vtype==='SAL'||vtype==='CRN'?'Customer':vtype==='PUR'||vtype==='DBN'?'Vendor':'Party'}
                  {['PAY','REC'].includes(vtype) && <span style={{fontWeight:400,fontSize:10,color:'var(--ink-3)',marginLeft:6}}> select to include in party statement</span>}
                </label>
                <SearchableSelect
                  options={data.parties.filter(p => isGstVoucher ? (vtype==='SAL'||vtype==='CRN' ? p.type==='Customer' : p.type==='Vendor') : true).map(p => ({value:p.id, label:p.name + (p.gstin?' · '+p.gstin:'')}))}
                  value={f.partyId}
                  onChange={v => {
                    const p = data.parties.find(x => x.id === v);
                    setF({...f, partyId:v, partyName: p?.name||'', currency: p?.currency||'INR', placeOfSupply: p?.stateCode || data.company.stateCode});
                  }}
                  placeholder="Type to search party…" />
              </div>
            )}
            {isNoteType && (
              <div className="field">
                <label>Against {noteInvType==='SAL'?'Sales':'Purchase'} Invoice</label>
                <select value={origInvoiceId}
                  onChange={e=>{
                    const id = e.target.value; setOrigInvoiceId(id);
                    if(!id) return;
                    const inv = noteInvoices.find(v=>v.id===id);
                    if(!inv) return;
                    const hasData = (f.items||[]).some(it => (it.description||'').trim() || (it.rate||0)>0);
                    if(hasData && !window.confirm('Import the line items from '+inv.number+'?\n\nThis replaces the current items on this note with the original invoice\'s items (you can then edit quantities for a partial return).')) return;
                    importFromInvoice(inv);
                  }}
                  disabled={!f.partyId}>
                  <option value="">- Self / Not against a specific invoice -</option>
                  {noteInvoices.map(inv => {
                    const ctrl = noteInvType==='SAL' ? '2400' : '1300';
                    const ctrlAmt = (inv.lines||[]).reduce((s,l)=> s + (l.accountId===ctrl ? (noteInvType==='SAL'?(l.debit||0):(l.credit||0)) : 0), 0);
                    const amt = ctrlAmt || inv.total || inv.amount || 0;
                    return <option key={inv.id} value={inv.id}>{inv.number} · {fmtDate(inv.date)} · ₹{fmt(amt)}</option>;
                  })}
                </select>
                <div className="help">
                  {origInvoiceId
                    ? "✓ Items imported from the invoice - edit quantities/rates for a partial return. Reduces the invoice's outstanding automatically."
                    : (f.partyId ? 'No invoice selected - this note adjusts the party balance generally (rate correction, discount not tied to one bill).' : 'Select the party first.')}
                </div>
              </div>
            )}
            {isGstVoucher && (
              <div className="field"><label>Place of Supply</label><input value={f.placeOfSupply} onChange={e => setF({...f, placeOfSupply:e.target.value})} maxLength="2" /></div>
            )}
            {isGstVoucher && (data.costCentres||[]).length > 0 && (
              <div className="field"><label>{['SAL','CRN'].includes(vtype)?'Profit Centre':'Cost Centre'}</label>
                <select value={f.costCentreId||''} onChange={e => setF({...f, costCentreId:e.target.value})}>
                  <option value=""> None </option>
                  {(data.costCentres||[]).filter(c=>c.active!==false).map(c=>(
                    <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {isGstVoucher && (data.departments||[]).length > 0 && (
              <div className="field"><label>Department</label>
                <select value={f.departmentId||''} onChange={e => setF({...f, departmentId:e.target.value})}>
                  <option value=""> None </option>
                  {(data.departments||[]).filter(d=>d.active!==false).map(d=>(
                    <option key={d.id} value={d.id}>[{d.code}] {d.name}</option>
                  ))}
                </select>
              </div>
            )}
            {f.currency && f.currency !== 'INR' && (
              <div className="field"><label>FX Rate (1 {f.currency} = ₹)</label><input type="number" step="0.0001" value={f.fxRate} onChange={e => setF({...f, fxRate:parseFloat(e.target.value)||1})} /></div>
            )}
          </div>

          {(vtype==='SAL' || vtype==='PUR' || vtype==='CRN' || vtype==='DBN') ? (
            <>
              {/* HSN/SAC autocomplete source  GST 2.0 master (auto-fills rate) */}
              <datalist id="hsn-sac-list">
                {HSN_SAC_MASTER.map((h,i) => (
                  <option key={i} value={`${h.code}  ${h.desc}`}>{h.kind} · {h.rate>=0?h.rate+'% GST':'Outside GST'}{h.cess?` +${h.cess}% cess`:''}</option>
                ))}
              </datalist>
              <div className="section-divider">
                <div className="label">Line Items</div>
                <div className="line"></div>
                <button className="btn btn-sm btn-ghost" onClick={addItem}>+ Add Item</button>
              </div>
              {(() => {
                const mod = data.company.modules || {};
                const hasStock = mod.trader || mod.factory;
                const stockItems = data.stockItems || [];
                return (
                <table className="lines-table">
                  <thead>
                    <tr>
                      {hasStock && <th style={{width:140}}>Stock Item</th>}
                      <th style={{width:'25%'}}>Description</th>
                      <th>Account</th>
                      <th style={{width:80}}>HSN/SAC</th>
                      <th style={{width:60}}>Qty</th>
                      <th style={{width:90}}>Rate</th>
                      <th style={{width:60}}>GST %</th>
                      <th className="num" style={{width:100}}>Taxable</th>
                      <th className="num" style={{width:100}}>Tax</th>
                      <th className="num" style={{width:110}}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(f.items||[]).map(it => {
                      const taxable = (it.qty||0) * (it.rate||0);
                      const tax = taxable * (it.gstRate||0) / 100;
                      return (
                        <tr key={it.id}>
                          {hasStock && (
                            <td>
                              <select value={it.itemId||''} onChange={e => updateItem(it.id, 'itemId', e.target.value)}
                                style={{fontSize:11}}>
                                <option value=""> none </option>
                                {stockItems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                          )}
                          <td><input value={it.description} onChange={e => updateItem(it.id, 'description', e.target.value)} placeholder="Item description" /></td>
                          <td><select value={it.accountId} onChange={e => updateItem(it.id, 'accountId', e.target.value)}>
                            {data.coa.filter(a => vtype==='SAL'||vtype==='CRN' ? a.type==='Income' : a.type==='Expense').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select></td>
                          <td style={{position:'relative'}}>
                            <input list="hsn-sac-list" value={it.hsn||''} onChange={e => updateItem(it.id, 'hsn', e.target.value.split(' ')[0].trim())}
                              placeholder="HSN/SAC" title={(() => { const m = hsnLookup(it.hsn); return m ? `${m.desc} · ${m.rate}% GST${m.cess?` + ${m.cess}% cess`:''}` : 'Type code or name'; })()} />
                            {(() => { const m = hsnLookup(it.hsn); return m && m.rate>=0 ? <span style={{position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',fontSize:9,color:'var(--primary)',fontWeight:700,pointerEvents:'none'}}>{m.rate}%</span> : null; })()}
                          </td>
                          <td><input type="number" value={it.qty} onChange={e => updateItem(it.id, 'qty', e.target.value)} /></td>
                          <td><input type="number" step="0.01" value={it.rate} onChange={e => updateItem(it.id, 'rate', e.target.value)} /></td>
                          <td><select value={it.gstRate} onChange={e => updateItem(it.id, 'gstRate', e.target.value)}>
                            <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                          </select></td>
                          <td className="num">{fmt(taxable)}</td>
                          <td className="num">{fmt(tax)}</td>
                          <td className="num bold">{fmt(taxable+tax)}</td>
                          <td><span className="row-del" onClick={() => removeItem(it.id)}>×</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                );
              })()}
              {(f.items||[]).length === 0 && <div className="empty" style={{padding:20}}>Click "+ Add Item" to add line items</div>}
              {(f.items||[]).length > 0 && (
                <div style={{marginTop:14, display:'grid', gridTemplateColumns:'1fr auto', gap:20}}>
                  <div></div>
                  <div style={{background:'var(--surface-2)', padding:14, borderRadius:8, minWidth:280}}>
                    <div style={{display:'flex', justifyContent:'space-between', padding:'3px 0'}}><span>Taxable Value:</span> <b className="rupee">₹{fmt(f.taxable||0)}</b></div>
                    {f.isExport ? <div style={{color:'var(--info)'}}>Export  Zero-rated supply</div> : f.isInterState ? (
                      <div style={{display:'flex', justifyContent:'space-between', padding:'3px 0'}}><span>IGST:</span> <b className="rupee">₹{fmt(f.igst||0)}</b></div>
                    ) : (<>
                      <div style={{display:'flex', justifyContent:'space-between', padding:'3px 0'}}><span>CGST:</span> <b className="rupee">₹{fmt(f.cgst||0)}</b></div>
                      <div style={{display:'flex', justifyContent:'space-between', padding:'3px 0'}}><span>SGST:</span> <b className="rupee">₹{fmt(f.sgst||0)}</b></div>
                    </>)}
                    {Math.abs(f.roundOff||0) >= 0.01 && (
                      <div style={{display:'flex', justifyContent:'space-between', padding:'3px 0', color:'var(--ink-3)'}}><span>Round Off:</span> <b className="rupee">{(f.roundOff>0?'+':'')}₹{fmt(f.roundOff||0)}</b></div>
                    )}
                    <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0 0', marginTop:6, borderTop:'2px solid var(--primary)', color:'var(--primary)', fontWeight:700, fontSize:14}}><span>Invoice Total:</span> <span className="rupee">₹{fmt((Math.abs(f.roundOff||0) >= 0.01 ? f.grandTotal : f.total)||0)}</span></div>
                  </div>
                </div>
              )}
            </>
          ) : isCashType ? (
            (() => {
              const bankCash = data.coa.filter(a =>
                a.isBank === true || a.schedule === 'Cash & Equivalents' ||
                a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')
              );
              const contraOptions = vtype === 'PAY'
                ? data.coa.filter(a => a.type==='Expense' || a.type==='Liability')
                : vtype === 'REC'
                ? data.coa.filter(a => a.type==='Asset' || a.type==='Income')
                : bankCash;
              const toName = data.coa.find(a => a.id === spBank)?.name || '';
              const frName = data.coa.find(a => a.id === spContra)?.name || '';
              return (
                <div style={{display:'flex', flexDirection:'column', gap:14}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 180px', gap:14}}>
                    <div className="field">
                      <label>{vtype==='CON' ? '↓ To (Dr)  Receiving Account' : vtype==='PAY' ? 'Pay From (Bank / Cash)' : 'Deposit To (Bank / Cash)'}</label>
                      <SearchableSelect
                        options={bankCash.map(a => ({value:a.id, label:a.id+' · '+a.name}))}
                        value={spBank} onChange={v => setSpBank(v)} placeholder="Type to search bank / cash…" />
                    </div>
                    <div className="field">
                      <label>{vtype==='CON' ? '↑ From (Cr)  Source Account' : vtype==='PAY' ? 'Pay To (Vendor / Expense)' : 'Receive From (Customer / Income)'}</label>
                      <SearchableSelect
                        options={contraOptions.map(a => ({value:a.id, label:a.id+' · '+a.name}))}
                        value={spContra} onChange={v => setSpContra(v)} placeholder="Type to search account…" />
                    </div>
                    <div className="field">
                      <label>Amount (₹)</label>
                      <input type="number" value={spAmt} onChange={e => setSpAmt(parseFloat(e.target.value)||0)}
                        style={{padding:'8px 10px', border:'1px solid var(--line-2)', borderRadius:6, fontSize:13, width:'100%'}} />
                    </div>
                  </div>
                  {spBank && spContra && spAmt > 0 && (
                    <div style={{padding:'10px 14px', background:'var(--primary-soft)', borderRadius:8, fontSize:12, color:'var(--primary)'}}>
                      <b>Entry: </b>
                      {vtype==='CON' && <span>Dr <b>{toName}</b> ₹{fmt(spAmt)} &nbsp;|&nbsp; Cr <b>{frName}</b> ₹{fmt(spAmt)}</span>}
                      {vtype==='PAY' && <span>Dr <b>{frName}</b> ₹{fmt(spAmt)} &nbsp;|&nbsp; Cr <b>{toName}</b> ₹{fmt(spAmt)}</span>}
                      {vtype==='REC' && <span>Dr <b>{toName}</b> ₹{fmt(spAmt)} &nbsp;|&nbsp; Cr <b>{frName}</b> ₹{fmt(spAmt)}</span>}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <>
              <div className="section-divider">
                <div className="label">Journal Lines (Dr/Cr)</div>
                <div className="line"></div>
                <button className="btn btn-sm btn-ghost" onClick={addLine}>+ Add Line</button>
              </div>
              <table className="lines-table">
                <thead>
                  <tr>
                    <th style={{width:'28%'}}>Account</th>
                    <th>Narration</th>
                    <th style={{width:120}}>Cost Centre</th>
                    <th style={{width:110}}>Department</th>
                    <th className="num" style={{width:110}}>Debit</th>
                    <th className="num" style={{width:110}}>Credit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {f.lines.map(l => {
                    const selAcc = data.coa.find(a => a.id === l.accountId);
                    const isPartyAcc = selAcc && (selAcc.name.toLowerCase().includes('creditor') || selAcc.name.toLowerCase().includes('debtor') || selAcc.name.toLowerCase().includes('receivable') || selAcc.name.toLowerCase().includes('payable') && !selAcc.name.toLowerCase().includes('tds') && !selAcc.name.toLowerCase().includes('gst'));
                    return (
                    <React.Fragment key={l.id}>
                    <tr>
                      <td>
                        <SearchableSelect
                          options={data.coa.map(a => ({value:a.id, label:a.id+' · '+a.name}))}
                          value={l.accountId}
                          onChange={v => updateLine(l.id, 'accountId', v)}
                          placeholder="Type to search account..."
                        />
                        <div style={{marginTop:3}}>
                          <button className="btn btn-sm btn-ghost" style={{fontSize:10, padding:'2px 6px', color:'var(--primary)'}} onClick={() => {
                            const name = prompt('New Ledger Name:'); if(!name) return;
                            const code = prompt('Account Code (e.g. 4570):'); if(!code) return;
                            if(data.coa.find(a => a.id === code)){ showToast('Code '+code+' already exists', 'error'); return; }
                            const type = prompt('Type (Asset/Liability/Income/Expense):','Expense') || 'Expense';
                            const newAcc = {id:code, name, type, group:'Other Expenses', schedule:'Other Expenses', opening:0};
                            // Use the parent setData via a custom event to avoid prop-drilling
                            const evt = new CustomEvent('miyeebooks-add-account', {detail: newAcc});
                            window.dispatchEvent(evt);
                            updateLine(l.id, 'accountId', code);
                            showToast('Ledger '+code+' created  save voucher to persist');
                          }}>+ New Ledger</button>
                        </div>
                      </td>
                      <td>
                        <input value={l.narration} onChange={e => updateLine(l.id, 'narration', e.target.value)} placeholder="Line narration" />
                      </td>
                      <td>
                        <select value={l.costCentreId||''} onChange={e => updateLine(l.id,'costCentreId',e.target.value)}
                          style={{width:'100%',padding:'5px 6px',border:'1px solid var(--line-2)',borderRadius:4,fontSize:12,background:'var(--surface)',color:'var(--ink)'}}>
                          <option value=""> None </option>
                          {(data.costCentres||[]).filter(c=>c.active!==false).map(c=>(
                            <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select value={l.departmentId||''} onChange={e => updateLine(l.id,'departmentId',e.target.value)}
                          style={{width:'100%',padding:'5px 6px',border:'1px solid var(--line-2)',borderRadius:4,fontSize:12,background:'var(--surface)',color:'var(--ink)'}}>
                          <option value=""> None </option>
                          {(data.departments||[]).filter(d=>d.active!==false).map(d=>(
                            <option key={d.id} value={d.id}>[{d.code}] {d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="number" step="0.01" value={l.debit||''} onChange={e => updateLine(l.id, 'debit', e.target.value)} style={{textAlign:'right'}} /></td>
                      <td><input type="number" step="0.01" value={l.credit||''} onChange={e => updateLine(l.id, 'credit', e.target.value)} style={{textAlign:'right'}} /></td>
                      <td><span className="row-del" onClick={() => removeLine(l.id)}>×</span></td>
                    </tr>
                    {isPartyAcc && (
                      <tr><td colSpan="7" style={{padding:'4px 8px', background:'var(--primary-soft)', borderBottom:'1px solid var(--line)'}}>
                        <div style={{display:'flex', gap:8, alignItems:'center', fontSize:11}}>
                          <span style={{color:'var(--primary)', fontWeight:600}}>↳ Select {selAcc.name.includes('Creditor')||selAcc.name.includes('Payable')?'Vendor':'Customer'}:</span>
                          <select value={l.partyId||f.partyId||''} onChange={e => {
                            const p = data.parties.find(x => x.id === e.target.value);
                            updateLine(l.id, 'partyId', e.target.value);
                            updateLine(l.id, 'narration', p ? (l.debit>0?'From ':'To ') + p.name : '');
                            if(p && !f.partyId) setF(prev => ({...prev, partyId:e.target.value, partyName:p.name}));
                          }} style={{flex:1, padding:'4px 6px', border:'1px solid var(--line)', borderRadius:4, fontSize:11}}>
                            <option value=""> Select Party </option>
                            {data.parties.filter(p => selAcc.name.includes('Creditor')||selAcc.name.includes('Payable') ? p.type==='Vendor' : p.type==='Customer').map(p => (
                              <option key={p.id} value={p.id}>{p.name}{p.gstin?' · '+p.gstin:''}</option>
                            ))}
                          </select>
                          <button className="btn btn-sm btn-ghost" style={{fontSize:10, padding:'2px 6px'}} onClick={() => {
                            const name = prompt('New Party Name:'); if(!name) return;
                            const type = selAcc.name.includes('Creditor')||selAcc.name.includes('Payable') ? 'Vendor' : 'Customer';
                            const gstin = prompt('GSTIN (15 chars, leave blank for URD):','');
                            const newParty = {id:uid(), name, type, gstin:gstin||'', state:'Gujarat', stateCode:'24', address:'', email:'', phone:'', currency:'INR', balance:0, unregistered:!gstin};
                            window.dispatchEvent(new CustomEvent('miyeebooks-add-party', {detail: newParty}));
                            updateLine(l.id, 'partyId', newParty.id);
                            updateLine(l.id, 'narration', (l.debit>0?'From ':'To ') + name);
                            setF(prev => ({...prev, partyId:newParty.id, partyName:name}));
                            showToast(type+' "'+name+'" created');
                          }}>+ New {selAcc.name.includes('Creditor')||selAcc.name.includes('Payable')?'Vendor':'Customer'}</button>
                        </div>
                      </td></tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                  <tr style={{background:'var(--surface-2)', fontWeight:700}}>
                    <td colSpan="4" style={{textAlign:'right', padding:'8px 12px'}}>TOTAL</td>
                    <td className="num bold" style={{padding:'8px 12px'}}>₹{fmt(totalDr)}</td>
                    <td className="num bold" style={{padding:'8px 12px'}}>₹{fmt(totalCr)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="7" style={{textAlign:'right', padding:'6px 12px', fontSize:12}}>
                      Difference: <b className={balanced?'pos':'neg'}>₹{fmt(totalDr-totalCr)}</b> {balanced && <span className="badge badge-success">Balanced</span>}
                      {!balanced && totalDr > 0 && (
                        <button className="btn btn-sm btn-primary" style={{marginLeft:10}} onClick={() => {
                          const tdsAmt = (f.tdsApplicable && f.tdsAmount > 0) ? f.tdsAmount : 0;
                          // Set Cr = Dr - TDS so that after Post adds TDS Payable Cr, total Cr = Dr
                          // i.e. Creditor Cr = 98000, then Post adds TDS Payable Cr 2000 = 100000 = Dr
                          const correctCr = Math.round((totalDr - tdsAmt) * 100) / 100;
                          const liabilityLine = f.lines.find(l =>
                            l.accountId && data.coa.find(a => a.id === l.accountId && a.type === 'Liability')
                          );
                          const creditorLine = f.lines.find(l =>
                            l.accountId && (l.accountId.startsWith('13') || l.accountId.startsWith('12'))
                          );
                          const anyAccLine = [...f.lines].reverse().find(l => l.accountId);
                          const target = liabilityLine || creditorLine || anyAccLine || f.lines[f.lines.length-1];
                          if(target){
                            const updated = f.lines.map(l =>
                              l.id === target.id ? {...l, credit: correctCr, debit: 0} : l
                            );
                            setF({...f, lines: updated});
                          }
                        }}>⚡ Auto-Balance Cr</button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* TDS Deduction Section  for PUR, JV, PAY */}
          {['PUR','JV','PAY'].includes(vtype) && (
            <div style={{marginTop:14, padding:14, border:'1px solid var(--accent)', borderRadius:8, background:'var(--accent-soft)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <span style={{fontWeight:600, fontSize:12, color:'var(--warning)'}}>§ TDS Deduction (New IT Act 2025)</span>
                <label style={{fontSize:11, display:'flex', alignItems:'center', gap:6}}>
                  <input type="checkbox" checked={f.tdsApplicable||false} onChange={e => setF({...f, tdsApplicable:e.target.checked, tdsSection:'', tdsRate:0, tdsAmount:0, tdsLedgerId:'', tdsBaseAmount:0})} /> Apply TDS
                </label>
              </div>
              {f.tdsApplicable && (
                <>
                  <div className="form-grid" style={{gridTemplateColumns:'1.5fr 120px 90px 120px'}}>
                    <div className="field">
                      <label>TDS Section</label>
                      <select value={f.tdsSectionId||''} onChange={e => {
                        const sec = (data.tdsSections||[]).find(s => s.id === e.target.value);
                        if(sec){
                          const base = f.tdsBaseAmount || f.taxable || f.total || f.amount || totalDr || 0;
                          const tdsAmt = Math.round(base * sec.rate / 100 * 100) / 100;
                          // ledgerId fallback: use sec.ledgerId, else find by name match in COA
                          let ledgerId = sec.ledgerId || '';
                          if(!ledgerId || !data.coa.find(a => a.id === ledgerId)){
                            const matched = data.coa.find(a => a.name.toLowerCase().includes('tds payable'));
                            ledgerId = matched ? matched.id : '1313';
                          }
                          const eff = f.tds206AB ? Math.max(sec.rate*2, 5) : sec.rate;
                          setF({...f, tdsSectionId:sec.id,
                            tdsSection: sec.section + (sec.oldSection ? ' (Old: '+sec.oldSection+')' : '') +'  '+sec.name,
                            tdsBaseRate: sec.rate, tdsRate: eff, tdsAmount: Math.round(base*eff/100*100)/100,
                            tdsLedgerId: ledgerId,
                            tdsNature: sec.nature,
                            tdsThreshold: sec.threshold||0,
                            tdsAnnualThreshold: sec.annualThreshold||0,
                            tdsBaseAmount: base || f.tdsBaseAmount
                          });
                        }
                      }}>
                        <option value=""> Select TDS Section </option>
                        {(data.tdsSections||[]).filter(s => !s.isSalary).map(s => (
                          <option key={s.id} value={s.id}>§{s.section}{s.oldSection?' (Old: '+s.oldSection+')':''}  {s.name} ({s.rate}%)</option>
                        ))}
                      </select>
                      {f.tdsSectionId && f.tdsThreshold > 0 && (f.tdsBaseAmount||0) < f.tdsThreshold && (
                        <div className="help" style={{color:'var(--warning)'}}>
                          ⚠ Below single-transaction threshold of ₹{fmt(f.tdsThreshold)}  TDS may not be required (verify aggregate{f.tdsAnnualThreshold?` / annual ₹${fmt(f.tdsAnnualThreshold)}`:''}).
                        </div>
                      )}
                      {f.tdsSectionId && f.tdsThreshold > 0 && (f.tdsBaseAmount||0) >= f.tdsThreshold && (
                        <div className="help" style={{color:'var(--primary)'}}>✓ Above ₹{fmt(f.tdsThreshold)} threshold  TDS applicable.</div>
                      )}
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,marginTop:6,cursor:'pointer',color:'var(--ink-2)'}}>
                        <input type="checkbox" checked={!!f.tds206AB} onChange={e=>{
                          const on=e.target.checked; const base=f.tdsBaseRate||f.tdsRate||0;
                          const eff = on ? Math.max(base*2, 5) : base;
                          setF({...f, tds206AB:on, tdsRate:eff, tdsAmount: Math.round((f.tdsBaseAmount||0)*eff/100*100)/100});
                        }} />
                        <span>206AB / 206CCA - deductee is a <b>non-filer / no PAN</b> → higher rate (2× or 5%, whichever higher{f.tds206AB?` = ${f.tdsRate}%`:''})</span>
                      </label>
                    </div>
                    <div className="field required">
                      <label>TDS Deducted On (₹)</label>
                      <input type="number" step="0.01" value={f.tdsBaseAmount||0} onChange={e => {
                        const base = parseFloat(e.target.value)||0;
                        const tdsAmt = Math.round(base * (f.tdsRate||0) / 100 * 100) / 100;
                        setF({...f, tdsBaseAmount:base, tdsAmount:tdsAmt});
                      }} placeholder="Base amount" />
                      <div className="help">Amount on which TDS is calculated</div>
                    </div>
                    <div className="field">
                      <label>Rate %</label>
                      <input type="number" step="0.01" value={f.tdsRate||0} onChange={e => {
                        const rate = parseFloat(e.target.value)||0;
                        const base = f.tdsBaseAmount || 0;
                        setF({...f, tdsRate:rate, tdsAmount: Math.round(base*rate/100*100)/100});
                      }} />
                    </div>
                    <div className="field">
                      <label>TDS Amount (₹)</label>
                      <input type="number" step="0.01" value={f.tdsAmount||0} onChange={e => setF({...f, tdsAmount:parseFloat(e.target.value)||0})} />
                    </div>
                  </div>
                  <div className="form-grid" style={{gridTemplateColumns:'1fr', marginTop:8}}>
                    <div className="field">
                      <label>TDS Payable Ledger (auto-fetched from section)</label>
                      <SearchableSelect
                        options={data.coa.filter(a => a.name.toLowerCase().includes('tds payable')).map(a => ({value:a.id, label:a.id+' · '+a.name}))}
                        value={f.tdsLedgerId||''}
                        onChange={v => setF({...f, tdsLedgerId:v})}
                        placeholder="Type to search TDS ledger..."
                      />
                    </div>
                  </div>
                </>
              )}
              {f.tdsApplicable && f.tdsAmount > 0 && (
                <div style={{marginTop:8, fontSize:11, color:'var(--ink-2)', padding:'10px 12px', background:'#fff', borderRadius:6, border:'1px solid var(--line)'}}>
                  <div style={{fontWeight:600, marginBottom:4, color:'var(--ink)'}}>TDS Entry Summary</div>
                  <div>📌 <b>Dr</b> {f.lines.find(l=>(l.debit||0)>0) ? (data.coa.find(a=>a.id===f.lines.find(l=>(l.debit||0)>0)?.accountId)?.name||'Expense A/c') : 'Expense A/c'} ₹{fmt(f.total||totalDr||0)}</div>
                  <div style={{marginTop:3}}>📌 <b>Cr</b> {data.coa.find(a=>a.id===f.tdsLedgerId)?.name||'TDS Payable'} ₹{fmt(f.tdsAmount)} <span style={{color:'var(--ink-3)'}}>(TDS u/s {f.tdsSection||''} @ {f.tdsRate}%)</span></div>
                  <div style={{marginTop:3}}>📌 <b>Cr</b> Sundry Creditors / Party <b style={{color:'var(--primary)'}}>₹{fmt(Math.max(0,(f.total||totalDr||0) - (f.tdsAmount||0)))}</b> <span style={{color:'var(--ink-3)'}}>(Net payable after TDS)</span></div>
                  {vtype==='JV' && (
                    <div style={{marginTop:6, padding:'6px 8px', background:'var(--accent-soft)', borderRadius:4, color:'var(--warning)', fontSize:11}}>
                      ⚡ Click <b>Auto-Balance Cr</b> above → sets Creditor = <b>₹{fmt(Math.max(0,(totalDr||0) - (f.tdsAmount||0)))}</b>. On Post, TDS Payable ₹{fmt(f.tdsAmount||0)} auto-credited → entry balanced.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* E-Invoice details (IRN)  Sales only */}
          {vtype==='SAL' && (
            <div style={{marginTop:14, padding:'12px 14px', background:'var(--surface-2)', borderRadius:8, border:'1px solid var(--line)'}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'var(--ink-2)'}}>🧾 E-Invoice Details <span style={{fontWeight:400,color:'var(--ink-3)'}}>(if applicable  turnover above e-invoice threshold)</span></div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
                <div className="field"><label style={{fontSize:10}}>IRN (64-char hash)</label>
                  <input value={f.irn||''} onChange={e=>setF({...f, irn:e.target.value})} placeholder="Invoice Reference Number" style={{fontFamily:'var(--mono)',fontSize:11}} /></div>
                <div className="field"><label style={{fontSize:10}}>Ack No.</label>
                  <input value={f.ackNo||''} onChange={e=>setF({...f, ackNo:e.target.value})} placeholder="Acknowledgement No." /></div>
                <div className="field"><label style={{fontSize:10}}>Ack Date</label>
                  <input type="date" value={f.ackDate||''} onChange={e=>setF({...f, ackDate:e.target.value})} /></div>
              </div>
            </div>
          )}

          <div className="field" style={{marginTop:14}}>
            <label>Narration</label>
            <textarea rows="2" value={f.narration} onChange={e => setF({...f, narration:e.target.value})} placeholder="Being..." style={{padding:8, border:'1px solid var(--line-2)', borderRadius:6, resize:'vertical'}} />
          </div>

          {/* ── Attachments (bill / receipt image or PDF, stored inline) ── */}
          <div style={{marginTop:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:12,fontWeight:600,color:'var(--ink-2)'}}>📎 Attachments</span>
              {(f.attachments||[]).length < 3 && (
                <label className="btn btn-sm" style={{fontSize:11,cursor:'pointer'}}>
                  + Attach bill / receipt
                  <input type="file" accept="image/*,application/pdf" style={{display:'none'}}
                    onChange={e => {
                      const file = e.target.files && e.target.files[0];
                      e.target.value = '';
                      if(!file) return;
                      if(file.size > 400*1024){ showToast('Max 400 KB per attachment - compress the image/PDF first','error'); return; }
                      const rd = new FileReader();
                      rd.onload = () => setF(prev => ({...prev, attachments:[...(prev.attachments||[]), {id:uid(), name:file.name, type:file.type, size:file.size, dataUrl:rd.result}]}));
                      rd.readAsDataURL(file);
                    }} />
                </label>
              )}
              <span style={{fontSize:10,color:'var(--ink-3)'}}>max 3 files · 400 KB each · stored inside the voucher</span>
            </div>
            {(f.attachments||[]).length > 0 && (
              <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                {f.attachments.map(a => (
                  <span key={a.id} style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:6,padding:'4px 10px',fontSize:11}}>
                    <a href="#" onClick={e=>{ e.preventDefault();
                      const w = window.open('','_blank');
                      if(w){ w.document.write('<html><head><title>'+a.name+'</title></head><body style="margin:0;background:#333;text-align:center">'+(a.type==='application/pdf'?'<iframe src="'+a.dataUrl+'" style="width:100%;height:100vh;border:none"></iframe>':'<img src="'+a.dataUrl+'" style="max-width:100%;margin-top:20px"/>')+'</body></html>'); w.document.close(); }
                    }} style={{color:'var(--info)',textDecoration:'none'}}>{a.type==='application/pdf'?'📄':'🖼'} {a.name}</a>
                    <span style={{color:'var(--ink-3)'}}>({Math.round(a.size/1024)} KB)</span>
                    <button onClick={()=>setF(prev=>({...prev, attachments:(prev.attachments||[]).filter(x=>x.id!==a.id)}))} style={{color:'var(--danger)',fontSize:12,padding:0}}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recurring flag  dashboard prompts to re-post each month */}
          <label style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:12,cursor:'pointer',color:'var(--ink-2)',
            background:f.recurringMonthly?'var(--primary-soft)':'transparent',padding:'8px 12px',borderRadius:6,
            border:f.recurringMonthly?'1px solid var(--primary)':'1px solid var(--line-2)',width:'fit-content'}}>
            <input type="checkbox" checked={!!f.recurringMonthly} onChange={e=>setF({...f, recurringMonthly:e.target.checked})} />
            <span>🔁 <b>Recurring monthly</b>  Dashboard will remind you to post this entry every month (rent, salary, EMI, subscriptions)</span>
          </label>

          {/* ── Bill Tagging for PAY / REC ─────────────────────────────── */}
          {isBillType && (
            <div style={{marginTop:16, padding:'14px 16px', background:'var(--surface-2)', borderRadius:8, border:'1px solid var(--line)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--ink)'}}>
                  {vtype==='PAY' ? '📋 Tag Outstanding Purchase Bills' : '📋 Tag Outstanding Sales Invoices'}
                </div>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',color:'var(--ink-2)'}}>
                  <input type="checkbox" checked={isAdvance} onChange={e=>{setIsAdvance(e.target.checked); if(e.target.checked) setBillTags([]);}} />
                  <b>Advance Payment</b> (no bill to tag)
                </label>
              </div>
              {isAdvance ? (
                <div style={{padding:'10px 12px',background:'#fff8e1',borderRadius:6,border:'1px solid #ffe082',fontSize:12,color:'#f57c00'}}>
                  ⚡ This {vtype==='PAY'?'payment':'receipt'} will be posted as an <b>Advance</b>  no invoice tagged. Reconcile later when the invoice arrives.
                </div>
              ) : !f.partyId ? (
                <div style={{fontSize:12,color:'var(--ink-3)',textAlign:'center',padding:'12px 0'}}>
                  Select a party above to see outstanding {vtype==='PAY'?'purchase bills':'sales invoices'}.
                </div>
              ) : outstandingInvoices.length === 0 ? (
                <div style={{fontSize:12,color:'var(--ink-3)',textAlign:'center',padding:'12px 0'}}>
                  ✓ No outstanding {vtype==='PAY'?'purchase bills':'invoices'} found for this party.
                  <button className="btn btn-sm" style={{marginLeft:8,fontSize:11}} onClick={()=>setIsAdvance(true)}>Post as Advance</button>
                </div>
              ) : (
                <>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead><tr style={{background:'var(--surface)',borderBottom:'1px solid var(--line)'}}>
                        <th style={{padding:'6px 8px',textAlign:'left'}}>Date</th>
                        <th style={{padding:'6px 8px',textAlign:'left'}}>Ref / Voucher No.</th>
                        <th style={{padding:'6px 8px',textAlign:'right'}}>{vtype==='PAY'?'Paid':'Received'} Till Date</th>
                        <th style={{padding:'6px 8px',textAlign:'right',color:'var(--danger)'}}>{vtype==='PAY'?'Balance Payable (₹)':'Balance Receivable (₹)'}</th>
                        <th style={{padding:'6px 8px',textAlign:'right',width:130,color:'var(--primary)'}}>Allocate Now (₹)</th>
                      </tr></thead>
                      <tbody>
                        {outstandingInvoices.map(inv => {
                          const tagged = billTags.find(bt=>bt.voucherId===inv.id);
                          return (
                            <tr key={inv.id} style={{borderBottom:'1px solid var(--line-2)',background:tagged?'var(--primary-soft)':''}}>
                              <td style={{padding:'6px 8px'}}>{inv.date}</td>
                              <td style={{padding:'6px 8px',fontFamily:'var(--mono)',color:'var(--primary)'}}>{inv.number}{inv.reference?` · ${inv.reference}`:''}</td>
                              <td style={{padding:'6px 8px',textAlign:'right',color:'var(--ink-3)',fontFamily:'var(--mono)'}}>{inv.alreadyPaid>0?fmt(inv.alreadyPaid):''}</td>
                              <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:'var(--danger)',fontFamily:'var(--mono)'}}>{fmt(inv.outstanding)}</td>
                              <td style={{padding:'4px 8px'}}>
                                <input type="number" min="0" max={inv.outstanding} step="0.01"
                                  value={tagged?.allocated||''}
                                  placeholder="0.00"
                                  onChange={e => updateBillTag(inv.id, parseFloat(e.target.value)||0)}
                                  style={{width:'100%',padding:'4px 8px',border:'1px solid var(--line)',borderRadius:4,textAlign:'right',fontSize:12,background:tagged?'#fff':''}}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end',gap:16,marginTop:10,fontSize:12,alignItems:'center'}}>
                    <span style={{color:'var(--ink-3)'}}>Payment Amount: <b style={{color:'var(--ink)'}}>₹{fmt(totalDr||totalCr)}</b></span>
                    <span style={{color:'var(--ink-3)'}}>Tagged: <b style={{color:'var(--primary)'}}>₹{fmt(totalTagged)}</b></span>
                    {Math.abs((totalDr||totalCr) - totalTagged) > 0.01 && (
                      <span style={{color:'var(--warning)',fontWeight:600}}>
                        Untagged: ₹{fmt(Math.abs((totalDr||totalCr) - totalTagged))}
                        <button className="btn btn-sm" style={{marginLeft:8,fontSize:10}} onClick={()=>setIsAdvance(true)}>→ Mark as Advance</button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          {['SAL','PUR','CRN','DBN'].includes(vtype) && <button className="btn btn-accent" onClick={() => generateInvoicePDF(f, data)}>⎙ Print GST Invoice PDF</button>}
          {voucher && voucher.status !== 'Cancelled' && <button className="btn btn-primary" onClick={submit}>{voucher.status==='Draft' ? '✓ Post Draft' : '✎ Update Voucher'}</button>}
          {!voucher && <button className="btn btn-primary" onClick={submit}>Post Voucher</button>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// P&L MONTHLY TREND (12-column FY view)
// ============================================================================
function PnLTrend({data}){
  const fyStart = data.company.fyStart || (new Date().getFullYear()+'-04-01');
  const fyYear  = parseInt(fyStart.slice(0,4));
  const months  = Array.from({length:12},(_,i)=>{
    const m = ((3+i)%12)+1, y = m>=4 ? fyYear : fyYear+1;
    return `${y}-${String(m).padStart(2,'0')}`;
  });
  const MLBL = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

  const monthly = useMemo(() => months.map(m => {
    const lastDay = new Date(parseInt(m.slice(0,4)), parseInt(m.slice(5,7)), 0).getDate();
    return computePeriodBals(data, m+'-01', m+'-'+String(lastDay).padStart(2,'0'));
  }), [data, fyStart]);

  const grp = (pb, filter) => data.coa.filter(filter).reduce((s,a)=>{
    const b = pb.period[a.id]||0; return s + (a.type==='Income' ? -b : b);
  }, 0);

  const ROWS = [
    {label:'Revenue from Operations', f:a=>a.type==='Income'&&a.group==='Revenue from Operations', inc:true},
    {label:'Other Income',            f:a=>a.type==='Income'&&a.group==='Other Income', inc:true},
    {label:'Cost of Materials / Purchases', f:a=>a.group==='Cost of Materials'||a.group==='Purchase of Stock-in-Trade'},
    {label:'Employee Benefits',       f:a=>a.group==='Employee Benefit Expenses'},
    {label:'Finance Costs',           f:a=>a.group==='Finance Costs'},
    {label:'Depreciation',            f:a=>a.group==='Depreciation'},
    {label:'Other Expenses',          f:a=>a.group==='Other Expenses'},
  ];
  const matrix = ROWS.map(r => ({...r, vals: monthly.map(pb => grp(pb, r.f))}));
  const pbtRow = monthly.map((_,i) =>
    matrix.filter(r=>r.inc).reduce((s,r)=>s+r.vals[i],0) -
    matrix.filter(r=>!r.inc).reduce((s,r)=>s+r.vals[i],0));
  const rowTotal = r => r.vals.reduce((s,v)=>s+v,0);

  const handleExcel = () => {
    exportXLSX(`PnL_Trend_FY${fyYear}.xlsx`, [{name:'P&L Trend', rows:[
      [`P&L Monthly Trend  ${data.company.name}  FY ${fyYear}-${String(fyYear+1).slice(2)}`],[],
      ['Particulars', ...MLBL, 'Total'],
      ...matrix.map(r => [r.label, ...r.vals, rowTotal(r)]),
      ['Profit Before Tax', ...pbtRow, pbtRow.reduce((s,v)=>s+v,0)],
    ]}]);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">P&L Monthly Trend</h1>
        <div className="page-sub">FY {fyYear}–{String(fyYear+1).slice(2)} · Month-by-month income & expense view</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>
    <div className="table-wrap" style={{overflowX:'auto'}}>
      <table style={{fontSize:12,minWidth:1100}}>
        <thead><tr>
          <th style={{minWidth:190,position:'sticky',left:0,background:'var(--surface-2)',zIndex:1}}>Particulars</th>
          {MLBL.map(m=><th key={m} className="num" style={{minWidth:78}}>{m}</th>)}
          <th className="num" style={{minWidth:95,background:'var(--primary-soft)'}}>Total</th>
        </tr></thead>
        <tbody>
          {matrix.map(r=>(
            <tr key={r.label} style={r.inc?{color:'var(--primary)'}:{}}>
              <td style={{position:'sticky',left:0,background:'var(--surface)',fontWeight:500}}>{r.label}</td>
              {r.vals.map((v,i)=><td key={i} className="num">{v?fmt(v):'·'}</td>)}
              <td className="num" style={{fontWeight:700,background:'var(--primary-soft)'}}>{fmt(rowTotal(r))}</td>
            </tr>
          ))}
          <tr className="total">
            <td style={{position:'sticky',left:0,background:'var(--surface-2)'}}>Profit Before Tax</td>
            {pbtRow.map((v,i)=><td key={i} className="num" style={{color:v>=0?'var(--primary)':'var(--danger)'}}>{fmt(v)}</td>)}
            <td className="num" style={{background:'var(--primary-soft)'}}>{fmt(pbtRow.reduce((s,v)=>s+v,0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </>);
}
