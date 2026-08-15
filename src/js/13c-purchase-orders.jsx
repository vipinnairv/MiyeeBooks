// ============================================================================
// PURCHASE ORDERS  commit to a purchase before the bill arrives.
// ----------------------------------------------------------------------------
// Sales had quotations and challans; purchasing had no order document. A buyer
// could not raise a PO, see what was committed but not yet invoiced, or match a
// vendor's bill against what was ordered. This adds that missing half.
//
// A PO is a non-ledger document (like a quotation) - it commits nothing to the
// books. "Convert to Bill" is what posts: it raises a Purchase voucher (Dr the
// expense/purchase ledgers + Dr GST input, Cr the vendor) exactly as a manual
// purchase entry would, then marks the PO Billed so committed spend is visible.
// ============================================================================

const poRound = (n) => Math.round((n || 0) * 100) / 100;
const poTotal = (po) => {
  let t = 0;
  (po.items || []).forEach(it => {
    const amt = (it.qty || 0) * (it.rate || 0);
    t += amt + amt * (it.gstRate || 0) / 100;
  });
  return poRound(t);
};
const poNextNo = (data) => 'PO/' + String((data.purchaseOrders || []).length + 1).padStart(4, '0');

function PurchaseOrders({data, setData, showToast, readOnly=false}){
  const [modal, setModal]   = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const pos = data.purchaseOrders || [];
  const vendors = (data.parties || []).filter(p => p.type === 'Vendor' || p.type === 'Supplier' || p.type === 'Both');
  const vendorById = (id) => (data.parties || []).find(p => p.id === id) || {};

  const save = (po) => {
    const isNew = !pos.some(x => x.id === po.id);
    const rec = { ...po, id: po.id || uid(), number: po.number || poNextNo(data) };
    setData({ ...data,
      purchaseOrders: isNew ? [...pos, rec] : pos.map(x => x.id === rec.id ? rec : x),
      auditLog: [...(data.auditLog||[]), auditEntry(isNew?'PO_CREATE':'PO_EDIT', 'Purchase Order ' + rec.number)] });
    showToast('Purchase Order ' + (isNew ? 'created' : 'updated'));
    setModal(null);
  };
  const del = (po) => { if(!confirm('Delete Purchase Order ' + po.number + '?')) return;
    setData({ ...data, purchaseOrders: pos.filter(x => x.id !== po.id) }); showToast('Purchase Order deleted'); };
  const cancel = (po) => setData({ ...data, purchaseOrders: pos.map(x => x.id===po.id ? {...x, status:'Cancelled'} : x) });

  // Convert to a Purchase voucher - the only step that touches the ledger.
  const convertToBill = (po) => {
    const v = vendorById(po.vendorId);
    if(!v.id){ showToast('Pick a vendor on the PO first','error'); return; }
    if(isDateLocked(data.company, today())){ showToast(`Books are locked up to ${data.company.booksLockedUpto}`,'error'); return; }
    const inter = v.stateCode && v.stateCode !== data.company.stateCode && !v.isForeign;
    let taxable=0, cgst=0, sgst=0, igst=0; const amts=[];
    (po.items||[]).forEach(it => {
      const amt = poRound((it.qty||0)*(it.rate||0)); taxable = poRound(taxable+amt);
      const tax = poRound(amt*(it.gstRate||0)/100);
      if(inter) igst = poRound(igst+tax); else { cgst = poRound(cgst+poRound(tax/2)); sgst = poRound(sgst+poRound(tax/2)); }
      amts.push(amt);
    });
    const total = poRound(taxable+cgst+sgst+igst);
    const lines = [];
    (po.items||[]).forEach((it,i) => { if(amts[i]>0) lines.push({id:uid(), accountId: it.accountId||'4100', debit:amts[i], credit:0, narration:it.description||''}); });
    if(igst>0) lines.push({id:uid(), accountId:'2602', debit:igst, credit:0, narration:'IGST Input'});
    if(cgst>0) lines.push({id:uid(), accountId:'2600', debit:cgst, credit:0, narration:'CGST Input'});
    if(sgst>0) lines.push({id:uid(), accountId:'2601', debit:sgst, credit:0, narration:'SGST Input'});
    lines.push({id:uid(), accountId:'1300', debit:0, credit:total, narration:'To '+v.name, partyId:v.id});
    const status = data.company.makerChecker === true ? 'Pending' : 'Posted';
    const voucher = { id:uid(), type:'PUR', date:today(), number:nextVoucherNumber(data,'PUR'),
      partyId:v.id, partyName:v.name, reference:po.number, narration:'Against PO '+po.number,
      placeOfSupply:v.stateCode, items:(po.items||[]).map(it=>({...it,id:uid()})), taxable, cgst, sgst, igst,
      total, amount:total, isInterState:inter, lines, status, createdAt:new Date().toISOString() };
    setData({ ...data,
      vouchers:[...data.vouchers, voucher],
      purchaseOrders: pos.map(x => x.id===po.id ? {...x, status:'Billed', voucherId:voucher.id, voucherNumber:voucher.number} : x),
      auditLog:[...(data.auditLog||[]), auditEntry('PO_CONVERT', 'PO '+po.number+' → Purchase '+voucher.number+' ₹'+fmt(total))] });
    showToast('Purchase bill '+voucher.number+' raised from '+po.number+(status==='Pending'?' (pending approval)':'')+' - ₹'+fmt(total));
  };

  const filtered = pos.filter(p => statusFilter==='All' || (p.status||'Open')===statusFilter)
    .slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const committed = pos.filter(p => (p.status||'Open')==='Open').reduce((s,p)=>s+poTotal(p),0);
  const chip = (s) => { const m = {Open:'badge-gold', Billed:'badge-success', Cancelled:'badge-muted'}[s||'Open'] || 'badge-muted';
    return <span className={'badge '+m}>{s||'Open'}</span>; };

  const blank = () => ({ id:uid(), number:poNextNo(data), vendorId:vendors[0]?.id||'', date:today(), expectedDate:'',
    status:'Open', notes:'', items:[{id:uid(), description:'', qty:1, rate:0, gstRate:18, accountId:'4100'}], createdAt:new Date().toISOString() });

  return (<>
    <div className="page-head">
      <div><h1 className="page-title">Purchase Orders</h1>
        <div className="page-sub">Commit to a purchase before the bill arrives · convert to a purchase bill in one click</div></div>
      {!readOnly && <div className="page-actions">
        <button className="btn btn-primary" onClick={()=>setModal(blank())} disabled={vendors.length===0}>＋ New PO</button>
      </div>}
    </div>

    {vendors.length===0 && <div style={{background:'var(--accent-soft)',border:'1px solid var(--accent)',borderRadius:8,padding:'10px 16px',marginBottom:14,fontSize:12.5,color:'var(--warning)'}}>Add a vendor in <b>Customers &amp; Vendors</b> first.</div>}

    <div className="stat-grid" style={{marginBottom:16}}>
      <div className="stat stat-gold"><div className="stat-label">Open (committed)</div><div className="stat-value rupee">₹{fmt(committed)}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>{pos.filter(p=>(p.status||'Open')==='Open').length} orders</div></div>
      <div className="stat"><div className="stat-label">Billed</div><div className="stat-value">{pos.filter(p=>p.status==='Billed').length}</div></div>
      <div className="stat"><div className="stat-label">Total POs</div><div className="stat-value">{pos.length}</div></div>
    </div>

    <div className="filter-bar">
      <div className="field"><label>Status</label>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option>All</option><option>Open</option><option>Billed</option><option>Cancelled</option>
        </select></div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr><th>PO No.</th><th>Vendor</th><th>Date</th><th>Expected</th><th className="num">Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {filtered.length===0 ? <tr><td colSpan="7"><div className="empty"><div className="empty-ico">∅</div><div>No purchase orders yet.</div></div></td></tr>
          : filtered.map(po => (
            <tr key={po.id} style={{opacity:po.status==='Cancelled'?.6:1}}>
              <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{po.number}</td>
              <td>{vendorById(po.vendorId).name||'-'}</td>
              <td>{fmtDate(po.date)}</td>
              <td>{po.expectedDate?fmtDate(po.expectedDate):<span style={{color:'var(--ink-3)'}}>—</span>}</td>
              <td className="num bold">₹{fmt(poTotal(po))}</td>
              <td>{chip(po.status)}{po.voucherNumber && <div style={{fontSize:10,color:'var(--green)'}}>{po.voucherNumber}</div>}</td>
              <td className="actions">
                {!readOnly && (po.status||'Open')==='Open' && <>
                  <button className="btn btn-sm btn-ghost" onClick={()=>setModal({...po})}>Edit</button>
                  <button className="btn btn-sm" style={{background:'var(--green)',color:'#fff'}} onClick={()=>convertToBill(po)}>→ Bill</button>
                  <button className="btn btn-sm btn-ghost" onClick={()=>cancel(po)}>Cancel</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>del(po)}>×</button>
                </>}
                {po.status==='Billed' && <span style={{fontSize:11,color:'var(--green)'}}>✓ billed</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {modal && <PurchaseOrderModal po={modal} data={data} vendors={vendors} onSave={save} onClose={()=>setModal(null)} />}
  </>);
}

function PurchaseOrderModal({po, data, vendors, onSave, onClose}){
  const [f, setF] = useState(po);
  const expenseLedgers = data.coa.filter(a => a.type === 'Expense' || a.type === 'Asset');
  const setItem = (id, patch) => setF({...f, items: f.items.map(it => it.id===id ? {...it, ...patch} : it)});
  const addItem = () => setF({...f, items:[...(f.items||[]), {id:uid(), description:'', qty:1, rate:0, gstRate:18, accountId:'4100'}]});
  const rmItem  = (id) => setF({...f, items:(f.items||[]).filter(it=>it.id!==id)});
  const total = poTotal(f);
  const valid = f.vendorId && (f.items||[]).some(it => (it.qty||0)*(it.rate||0) > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h2 className="modal-title">{data.purchaseOrders?.some(x=>x.id===f.id)?'Edit':'New'} Purchase Order · {f.number}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body" style={{maxHeight:'74vh',overflowY:'auto'}}>
          <div className="form-grid">
            <div className="field required"><label>Vendor</label>
              <select value={f.vendorId} onChange={e=>setF({...f, vendorId:e.target.value})}>
                <option value="">Select…</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select></div>
            <div className="field"><label>PO Date</label><input type="date" value={f.date} onChange={e=>setF({...f, date:e.target.value})} /></div>
            <div className="field"><label>Expected Delivery</label><input type="date" value={f.expectedDate||''} onChange={e=>setF({...f, expectedDate:e.target.value})} /></div>
          </div>

          <div className="section-divider"><div className="label">Items</div><div className="line"></div></div>
          <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr>
              <th style={{textAlign:'left',padding:'4px 6px',color:'var(--ink-3)'}}>Description</th>
              <th style={{padding:'4px 6px',color:'var(--ink-3)',width:70}}>Qty</th>
              <th style={{padding:'4px 6px',color:'var(--ink-3)',width:100}}>Rate</th>
              <th style={{padding:'4px 6px',color:'var(--ink-3)',width:70}}>GST%</th>
              <th style={{textAlign:'left',padding:'4px 6px',color:'var(--ink-3)'}}>Book to</th>
              <th style={{padding:'4px 6px',color:'var(--ink-3)',width:90}}>Amount</th><th style={{width:30}}></th>
            </tr></thead>
            <tbody>
              {(f.items||[]).map(it=>{
                const amt = (it.qty||0)*(it.rate||0); const gross = amt + amt*(it.gstRate||0)/100;
                return (
                <tr key={it.id}>
                  <td style={{padding:'3px 6px'}}><input value={it.description} onChange={e=>setItem(it.id,{description:e.target.value})} placeholder="Item / service" style={{width:'100%'}} /></td>
                  <td style={{padding:'3px 6px'}}><input type="number" min="0" value={it.qty} onChange={e=>setItem(it.id,{qty:parseFloat(e.target.value)||0})} style={{width:'100%',textAlign:'right'}} /></td>
                  <td style={{padding:'3px 6px'}}><input type="number" min="0" step="0.01" value={it.rate} onChange={e=>setItem(it.id,{rate:parseFloat(e.target.value)||0})} style={{width:'100%',textAlign:'right'}} /></td>
                  <td style={{padding:'3px 6px'}}><select value={it.gstRate} onChange={e=>setItem(it.id,{gstRate:parseFloat(e.target.value)})} style={{width:'100%'}}>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                  <td style={{padding:'3px 6px'}}><select value={it.accountId} onChange={e=>setItem(it.id,{accountId:e.target.value})} style={{width:'100%'}}>{expenseLedgers.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}</select></td>
                  <td className="num" style={{padding:'3px 6px',textAlign:'right'}}>₹{fmt(gross)}</td>
                  <td style={{textAlign:'center'}}>{(f.items||[]).length>1 && <button className="btn btn-sm btn-danger" onClick={()=>rmItem(it.id)}>×</button>}</td>
                </tr>);
              })}
              <tr><td colSpan="5" style={{textAlign:'right',padding:'6px',fontWeight:700}}>Total (incl. GST)</td>
                <td className="num" style={{padding:'6px',fontWeight:700,textAlign:'right'}}>₹{fmt(total)}</td><td></td></tr>
            </tbody>
          </table>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={addItem}>＋ Add item</button>

          <div className="section-divider"><div className="label">Notes</div><div className="line"></div></div>
          <textarea rows="2" value={f.notes||''} onChange={e=>setF({...f, notes:e.target.value})} placeholder="Terms, delivery instructions…" style={{width:'100%',resize:'vertical'}} />
        </div>
        <div className="modal-foot" style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 18px',borderTop:'1px solid var(--line)'}}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave({...f})} disabled={!valid}>Save PO</button>
        </div>
      </div>
    </div>
  );
}
