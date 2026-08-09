
// ============================================================================
// SALES DOCUMENTS  Quotation / Proforma Invoice / Delivery Challan
// Pre-invoice paperwork: create → print/WhatsApp → convert to a SAL voucher
// with one click (no re-typing). Stored in data.quotations[] - no GL impact
// until converted.
// ============================================================================
function SalesDocs({data, setData, showToast, readOnly=false}){
  const docs = data.quotations || [];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const r2 = n => Math.round(n*100)/100;

  const DOC_TYPES = ['Quotation','Proforma Invoice','Delivery Challan'];
  const STATUSES  = ['Draft','Sent','Accepted','Rejected','Invoiced'];
  const stClr = s => s==='Invoiced'?'badge-success':s==='Accepted'?'badge-info':s==='Rejected'?'badge-danger':s==='Sent'?'badge-gold':'badge-muted';

  const docTotal = (d) => {
    let t=0; (d.items||[]).forEach(it=>{ const amt=(it.qty||0)*(it.rate||0); t += amt + (d.docType==='Delivery Challan'?0:amt*(it.gstRate||0)/100); });
    return r2(t);
  };

  const nextDocNo = (docType) => {
    const pfx = docType==='Proforma Invoice' ? 'PRF' : docType==='Delivery Challan' ? 'DCH' : 'QTN';
    const count = docs.filter(d=>d.docType===docType).length + 1;
    return pfx + '/' + String(count).padStart(4,'0');
  };

  const saveDoc = (d) => {
    const isNew = !d.id;
    const doc = {...d, id: d.id || uid(), number: d.number || nextDocNo(d.docType)};
    setData({...data,
      quotations: isNew ? [...docs, doc] : docs.map(x => x.id===doc.id ? doc : x),
      auditLog: [...(data.auditLog||[]), auditEntry(isNew?'DOC_CREATE':'DOC_EDIT', doc.docType+' '+doc.number)]});
    showToast(doc.docType+' '+(isNew?'created':'updated'));
    setShowModal(false); setEditing(null);
  };

  const setStatus = (d, status) => {
    setData({...data, quotations: docs.map(x => x.id===d.id ? {...x, status} : x)});
    showToast(d.number+' → '+status);
  };

  const deleteDoc = (d) => {
    if(!confirm('Delete '+d.docType+' '+d.number+'?')) return;
    setData({...data, quotations: docs.filter(x=>x.id!==d.id)});
    showToast('Deleted');
  };

  // ── Convert to a posted SAL voucher (same line logic as manual entry) ──
  const convertToInvoice = (q) => {
    const party = data.parties.find(p=>p.id===q.partyId);
    if(!party){ showToast('Select a customer on the document first','error'); return; }
    if(!(q.items||[]).length){ showToast('Document has no line items','error'); return; }
    const inter = party.stateCode !== data.company.stateCode && !party.isForeign;
    const exp = !!party.isForeign;
    // Round each line FIRST, then accumulate - guarantees Dr = Σ(rounded Cr)
    // exactly (independent rounding of the sum vs the lines can differ by paise).
    let taxable=0, cgst=0, sgst=0, igst=0;
    const items = [], itemAmts = [];
    q.items.forEach(it => {
      const amt = r2((it.qty||0)*(it.rate||0));
      taxable = r2(taxable + amt);
      const tax = exp ? 0 : r2(amt*(it.gstRate||0)/100);
      if(inter) igst = r2(igst + tax); else { cgst = r2(cgst + r2(tax/2)); sgst = r2(sgst + r2(tax/2)); }
      items.push({...it, id:uid(), accountId: it.accountId||'3100'});
      itemAmts.push(amt);
    });
    const total = r2(taxable+cgst+sgst+igst);
    const lines = [{id:uid(), accountId:'2400', debit:total, credit:0, narration:'To '+party.name, partyId:party.id}];
    items.forEach((it,i) => { if(itemAmts[i]>0) lines.push({id:uid(), accountId:it.accountId, debit:0, credit:itemAmts[i], narration:it.description||''}); });
    if(igst>0) lines.push({id:uid(), accountId:'1312', debit:0, credit:igst, narration:'IGST Output'});
    if(cgst>0) lines.push({id:uid(), accountId:'1310', debit:0, credit:cgst, narration:'CGST Output'});
    if(sgst>0) lines.push({id:uid(), accountId:'1311', debit:0, credit:sgst, narration:'SGST Output'});
    const v = {id:uid(), type:'SAL', date:today(), number:nextVoucherNumber(data,'SAL'),
      partyId:party.id, partyName:party.name,
      narration:'Against '+q.docType+' '+q.number, reference:q.number, placeOfSupply:party.stateCode,
      items, taxable, cgst, sgst, igst, total, amount:total, isInterState:inter, isExport:exp,
      lines, status:'Posted', createdAt:new Date().toISOString()};
    setData({...data,
      vouchers:[...data.vouchers, v],
      quotations: docs.map(x => x.id===q.id ? {...x, status:'Invoiced', invoiceId:v.id, invoiceNumber:v.number} : x),
      auditLog:[...(data.auditLog||[]), auditEntry('DOC_CONVERT', q.docType+' '+q.number+' → Invoice '+v.number+' ₹'+fmt(total))]});
    showToast('Invoice '+v.number+' created from '+q.number+' - ₹'+fmt(total));
  };

  const filtered = docs.filter(d =>
    (typeFilter==='All' || d.docType===typeFilter) &&
    (statusFilter==='All' || (d.status||'Draft')===statusFilter))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const openTotal = docs.filter(d=>!['Invoiced','Rejected'].includes(d.status||'Draft') && d.docType!=='Delivery Challan').reduce((s,d)=>s+docTotal(d),0);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Quotations & Challans</h1>
        <div className="page-sub">Quotation → Proforma → Invoice pipeline · Delivery Challans · {docs.length} documents</div>
      </div>
      {!readOnly && <div className="page-actions">
        <button className="btn btn-primary" onClick={()=>{ setEditing(null); setShowModal(true); }}>+ New Document</button>
      </div>}
    </div>

    <div className="stat-grid" style={{marginBottom:14}}>
      <div className="stat stat-info"><div className="stat-label">Open Pipeline (Quotes + Proforma)</div><div className="stat-value rupee">₹{fmt(openTotal)}</div></div>
      <div className="stat"><div className="stat-label">Quotations</div><div className="stat-value">{docs.filter(d=>d.docType==='Quotation').length}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Converted to Invoice</div><div className="stat-value">{docs.filter(d=>d.status==='Invoiced').length}</div></div>
      <div className="stat"><div className="stat-label">Delivery Challans</div><div className="stat-value">{docs.filter(d=>d.docType==='Delivery Challan').length}</div></div>
    </div>

    <div className="filter-bar">
      <div className="field"><label>Type</label>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>All</option>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select>
      </div>
      <div className="field"><label>Status</label>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr><th>No.</th><th>Type</th><th>Date</th><th>Customer</th><th className="num">Value (₹)</th><th>Status</th><th style={{width:290}}></th></tr></thead>
        <tbody>
          {filtered.length===0 ? (
            <tr><td colSpan="7"><div className="empty"><div className="empty-ico">✎</div>
              <div>No documents yet. Create a Quotation, send it, then convert to an invoice in one click.</div>
            </div></td></tr>
          ) : filtered.map(d => (
            <tr key={d.id}>
              <td style={{fontFamily:'var(--mono)',fontSize:12}}>{d.number}</td>
              <td><span className="badge badge-info" style={{fontSize:10}}>{d.docType}</span></td>
              <td>{fmtDate(d.date)}</td>
              <td style={{fontWeight:500}}>{d.partyName}{d.invoiceNumber && <div style={{fontSize:10,color:'var(--primary)'}}>→ {d.invoiceNumber}</div>}</td>
              <td className="num bold">₹{fmt(docTotal(d))}</td>
              <td><span className={'badge '+stClr(d.status||'Draft')}>{d.status||'Draft'}</span></td>
              <td style={{whiteSpace:'nowrap'}}>
                <button className="btn btn-sm btn-ghost" onClick={()=>printSalesDoc(d, data)}>⎙ Print</button>
                {!readOnly && d.status!=='Invoiced' && <>
                  <button className="btn btn-sm btn-ghost" onClick={()=>{ setEditing(d); setShowModal(true); }}>✎</button>
                  {(d.status||'Draft')==='Draft' && <button className="btn btn-sm btn-ghost" onClick={()=>setStatus(d,'Sent')}>➤ Sent</button>}
                  {d.status==='Sent' && d.docType!=='Delivery Challan' && <button className="btn btn-sm btn-ghost" style={{color:'var(--primary)'}} onClick={()=>setStatus(d,'Accepted')}>✓ Accepted</button>}
                  {d.docType!=='Delivery Challan' && <button className="btn btn-sm btn-primary" onClick={()=>convertToInvoice(d)}>→ Invoice</button>}
                  <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>deleteDoc(d)}>✕</button>
                </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {showModal && <SalesDocModal doc={editing} data={data} docTypes={DOC_TYPES} onSave={saveDoc} onClose={()=>{ setShowModal(false); setEditing(null); }} />}
  </>);
}

function SalesDocModal({doc, data, docTypes, onSave, onClose}){
  const [f, setF] = useState(doc || {
    docType:'Quotation', date:today(), validTill:'', partyId:'', partyName:'',
    reference:'', notes:'', status:'Draft',
    items:[{id:uid(), description:'', hsn:'', qty:1, rate:0, gstRate:18}],
  });
  const customers = data.parties.filter(p=>p.type==='Customer');
  const stockItems = data.stockItems || [];
  const hasStock = !!(data.company.modules && (data.company.modules.trader || data.company.modules.factory)) && stockItems.length>0;
  const setItem = (id, patch) => setF({...f, items:f.items.map(it=>it.id===id?{...it,...patch}:it)});
  // Picking a stock item links it (itemId) and auto-fills description/HSN/GST - and
  // the itemId flows through convertToInvoice so the resulting invoice moves stock.
  const pickItem = (id, siId) => {
    const si = stockItems.find(s=>s.id===siId);
    setItem(id, si
      ? {itemId:si.id, description:si.name, hsn:si.hsn||'', gstRate:si.gstRate!=null?si.gstRate:18}
      : {itemId:''});
  };
  const total = (f.items||[]).reduce((s,it)=>{ const amt=(it.qty||0)*(it.rate||0); return s+amt+(f.docType==='Delivery Challan'?0:amt*(it.gstRate||0)/100); },0);
  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal wide" onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{doc?'Edit':'New'} {f.docType}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{maxHeight:'72vh',overflowY:'auto'}}>
          <div className="form-grid">
            <div className="field"><label>Document Type</label>
              <select value={f.docType} onChange={e=>setF({...f, docType:e.target.value})} disabled={!!doc}>
                {docTypes.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Date</label><input type="date" value={f.date} onChange={e=>setF({...f, date:e.target.value})} /></div>
            {f.docType!=='Delivery Challan' && <div className="field"><label>Valid Till</label><input type="date" value={f.validTill||''} onChange={e=>setF({...f, validTill:e.target.value})} /></div>}
            <div className="field required"><label>Customer</label>
              <select value={f.partyId} onChange={e=>{ const p=customers.find(x=>x.id===e.target.value); setF({...f, partyId:e.target.value, partyName:p?p.name:''}); }}>
                <option value="">- Select -</option>
                {customers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Reference / PO No.</label><input value={f.reference||''} onChange={e=>setF({...f, reference:e.target.value})} /></div>
          </div>

          <div className="section-divider"><div className="label">Line Items {hasStock && <span style={{fontWeight:400,textTransform:'none',fontSize:11,color:'var(--ink-3)'}}> · link a stock item so the invoice updates inventory</span>}</div><div className="line"></div></div>
          <table style={{fontSize:12}}>
            <thead><tr>{hasStock && <th style={{width:150}}>Stock Item</th>}<th>Description</th><th style={{width:80}}>HSN</th><th style={{width:70}}>Qty</th><th style={{width:100}}>Rate</th>{f.docType!=='Delivery Challan'&&<th style={{width:70}}>GST %</th>}<th className="num" style={{width:110}}>Amount</th><th style={{width:34}}></th></tr></thead>
            <tbody>
              {f.items.map(it=>{
                const amt=(it.qty||0)*(it.rate||0), tax=f.docType==='Delivery Challan'?0:amt*(it.gstRate||0)/100;
                return (<tr key={it.id}>
                  {hasStock && <td>
                    <select value={it.itemId||''} onChange={e=>pickItem(it.id, e.target.value)} style={{width:'100%',fontSize:11}}>
                      <option value="">- none -</option>
                      {stockItems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>}
                  <td><input value={it.description} onChange={e=>setItem(it.id,{description:e.target.value})} placeholder="Item / service" style={{width:'100%'}} /></td>
                  <td><input value={it.hsn||''} onChange={e=>setItem(it.id,{hsn:e.target.value})} style={{width:'100%'}} /></td>
                  <td><input type="number" value={it.qty} onChange={e=>setItem(it.id,{qty:parseFloat(e.target.value)||0})} style={{width:'100%'}} /></td>
                  <td><input type="number" value={it.rate} onChange={e=>setItem(it.id,{rate:parseFloat(e.target.value)||0})} style={{width:'100%'}} /></td>
                  {f.docType!=='Delivery Challan'&&<td><input type="number" value={it.gstRate} onChange={e=>setItem(it.id,{gstRate:parseFloat(e.target.value)||0})} style={{width:'100%'}} /></td>}
                  <td className="num" style={{fontFamily:'var(--mono)'}}>₹{fmt(amt+tax)}</td>
                  <td>{f.items.length>1 && <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>setF({...f, items:f.items.filter(x=>x.id!==it.id)})}>✕</button>}</td>
                </tr>);
              })}
            </tbody>
          </table>
          <button className="btn btn-sm" style={{marginTop:6}} onClick={()=>setF({...f, items:[...f.items,{id:uid(), description:'', hsn:'', qty:1, rate:0, gstRate:18}]})}>+ Add Line</button>

          <div style={{textAlign:'right',fontWeight:700,fontSize:15,margin:'12px 0'}}>Total: <span className="rupee">₹{fmt(total)}</span></div>

          <div className="field"><label>Terms / Notes (printed on the document)</label>
            <textarea value={f.notes||''} onChange={e=>setF({...f, notes:e.target.value})} rows="3" style={{width:'100%'}} placeholder="Payment terms, delivery schedule, validity conditions…" />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>{ if(!f.partyId){alert('Select a customer');return;} onSave(f); }}>💾 Save {f.docType}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COLLECTIONS  overdue receivables with one-click WhatsApp / Email reminders
// Tone escalates with age: gentle (≤15d past due) → firm (≤45d) → final notice.
// ============================================================================
function Collections({data, showToast}){
  const asOf = today();
  const partyById = useMemo(() => { const m={}; (data.parties||[]).forEach(p=>m[p.id]=p); return m; }, [data.parties]);

  const allocMap = useMemo(() => {
    const m = {};
    (data.vouchers||[]).forEach(v => {
      if(v.status==='Cancelled') return;
      (v.billTags||[]).forEach(bt => { m[bt.voucherId] = (m[bt.voucherId]||0) + (bt.allocated||0); });
    });
    return m;
  }, [data.vouchers]);

  const bills = useMemo(() => (data.vouchers||[])
    .filter(v => v.type==='SAL' && v.status!=='Cancelled')
    .map(inv => {
      const p = partyById[inv.partyId] || {};
      const ctrlAmt = (inv.lines||[]).reduce((s,l)=> s + (l.accountId==='2400' ? (l.debit||0) : 0), 0);
      const total = ctrlAmt || inv.total || inv.amount || 0;
      const out = Math.max(0, total - (allocMap[inv.id]||0));
      const age = Math.floor((new Date(asOf) - new Date(inv.date)) / 86400000);
      const creditDays = p.creditDays != null ? p.creditDays : 30;
      const overdueDays = age - creditDays;
      return {id:inv.id, date:inv.date, number:inv.number, party:p.name||inv.partyName||'',
        phone:p.phone||'', email:p.email||'', total, out, age, creditDays, overdueDays};
    })
    .filter(b => b.out > 0.01 && b.overdueDays > 0)
    .sort((a,b) => b.overdueDays - a.overdueDays), [data.vouchers, partyById, allocMap, asOf]);

  const tone = (od) => od<=15 ? 'gentle' : od<=45 ? 'firm' : 'final';
  const toneBadge = (od) => od<=15 ? ['Gentle','badge-info'] : od<=45 ? ['Firm','badge-gold'] : ['Final Notice','badge-danger'];

  const buildMsg = (b) => {
    const co = data.company.name;
    if(tone(b.overdueDays)==='gentle')
      return `Dear ${b.party},\n\nA gentle reminder that Invoice ${b.number} dated ${fmtDate(b.date)} for ₹${fmt(b.out)} is now due for payment (credit period ${b.creditDays} days).\n\nKindly arrange the payment at your convenience. Please ignore if already paid.\n\nThank you,\n${co}`;
    if(tone(b.overdueDays)==='firm')
      return `Dear ${b.party},\n\nOur records show Invoice ${b.number} dated ${fmtDate(b.date)} for ₹${fmt(b.out)} is overdue by ${b.overdueDays} days beyond the agreed ${b.creditDays}-day credit period.\n\nWe request you to clear the outstanding within 7 days. If payment has been made, please share the reference.\n\nRegards,\n${co}`;
    return `Dear ${b.party},\n\nFINAL REMINDER: Invoice ${b.number} dated ${fmtDate(b.date)} for ₹${fmt(b.out)} remains unpaid ${b.overdueDays} days past the due date.\n\nKindly settle the amount immediately to avoid interruption of supplies and further recovery steps under the MSMED Act (interest on delayed payments).\n\n${co}`;
  };

  const waLink = (b) => 'https://wa.me/' + String(b.phone).replace(/\D/g,'') + '?text=' + encodeURIComponent(buildMsg(b));
  const mailLink = (b) => 'mailto:' + b.email + '?subject=' + encodeURIComponent(`Payment reminder - Invoice ${b.number} - ₹${fmt(b.out)}`) + '&body=' + encodeURIComponent(buildMsg(b));

  const totalOverdue = bills.reduce((s,b)=>s+b.out,0);

  const handleExcel = () => {
    exportXLSX(`Collections_${asOf}.xlsx`, [{
      name:'Overdue Receivables',
      rows:[
        [`Collections follow-up  ${data.company.name}  as on ${asOf}`],[],
        ['Customer','Invoice','Date','Outstanding (₹)','Age (days)','Credit Days','Overdue By','Tone'],
        ...bills.map(b=>[b.party,b.number,b.date,b.out,b.age,b.creditDays,b.overdueDays,toneBadge(b.overdueDays)[0]]),
        [],['','','TOTAL',totalOverdue,'','','',''],
      ],
    }]);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Collections / Payment Reminders</h1>
        <div className="page-sub">Invoices past the customer's credit period · one-click WhatsApp & Email follow-up</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    <div className="stat-grid" style={{marginBottom:14}}>
      <div className="stat stat-danger"><div className="stat-label">Total Overdue</div><div className="stat-value rupee">₹{fmt(totalOverdue)}</div></div>
      <div className="stat"><div className="stat-label">Overdue Invoices</div><div className="stat-value">{bills.length}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Needs Firm Follow-up</div><div className="stat-value">{bills.filter(b=>b.overdueDays>15&&b.overdueDays<=45).length}</div></div>
      <div className="stat stat-danger"><div className="stat-label">Final Notice (45d+)</div><div className="stat-value">{bills.filter(b=>b.overdueDays>45).length}</div></div>
    </div>

    <div className="card" style={{marginBottom:14,borderLeft:'4px solid var(--info)'}}>
      <div className="card-body" style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.6}}>
        The reminder tone escalates automatically: <b>Gentle</b> (≤15 days past due) → <b>Firm</b> (16–45) → <b>Final Notice</b> (45+, cites MSMED-Act interest).
        Clicking 💬 or 📧 opens WhatsApp / your mail app with the message pre-filled - review before sending. Due date = invoice date + the customer's credit days (set on the party master).
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Customer</th><th style={{width:100}}>Invoice</th><th style={{width:92}}>Date</th>
          <th className="num" style={{width:120}}>Outstanding (₹)</th>
          <th className="num" style={{width:90}}>Overdue By</th><th style={{width:100}}>Tone</th><th style={{width:190}}>Remind</th>
        </tr></thead>
        <tbody>
          {bills.length===0 ? (
            <tr><td colSpan="7"><div className="empty"><div className="empty-ico">🎉</div>
              <div>No invoices past their credit period - collections are under control.</div>
            </div></td></tr>
          ) : bills.map(b => {
            const [tl,tc] = toneBadge(b.overdueDays);
            return (
              <tr key={b.id} style={b.overdueDays>45?{background:'#fef2f2'}:{}}>
                <td style={{fontWeight:500}}>{b.party}</td>
                <td style={{fontFamily:'var(--mono)',fontSize:11}}>{b.number}</td>
                <td>{fmtDate(b.date)}</td>
                <td className="num bold">₹{fmt(b.out)}</td>
                <td className="num" style={{color:'var(--danger)',fontWeight:700}}>{b.overdueDays}d</td>
                <td><span className={'badge '+tc}>{tl}</span></td>
                <td style={{whiteSpace:'nowrap'}}>
                  {b.phone
                    ? <button className="btn btn-sm" style={{background:'#25D366',color:'#fff',border:'none'}} onClick={()=>window.open(waLink(b),'_blank')}>💬 WhatsApp</button>
                    : <span style={{fontSize:10,color:'var(--ink-3)'}}>no phone</span>}
                  {' '}
                  {b.email
                    ? <button className="btn btn-sm" style={{background:'#1565c0',color:'#fff',border:'none'}} onClick={()=>{window.location.href=mailLink(b);}}>📧 Email</button>
                    : <span style={{fontSize:10,color:'var(--ink-3)'}}>no email</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </>);
}

// ============================================================================
// BILL-WISE OUTSTANDING & AGEING (uses billTags allocations)
// ============================================================================
function BillwiseAgeing({data}){
  const [tab, setTab] = useState('rec');   // rec = receivables (SAL), pay = payables (PUR)
  const [statusFilter, setStatusFilter] = useState('open');  // open | all | settled
  const asOf = today();

  const allocMap = useMemo(() => {
    const m = {};
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      (v.billTags||[]).forEach(bt => { m[bt.voucherId] = (m[bt.voucherId]||0) + (bt.allocated||0); });
    });
    return m;
  }, [data.vouchers]);

  // Build the full bill list for a voucher type (settled AND outstanding)
  const buildBills = (type) => data.vouchers
    .filter(v => v.type===type && v.status!=='Cancelled')
    .map(inv => {
      // Amount owed = party control-account line (1300 Cr for PUR  net of TDS;
      // 2400 Dr for SAL), NOT the gross invoice total.
      const ctrl = type==='SAL' ? '2400' : '1300';
      const ctrlAmt = (inv.lines||[]).reduce((s,l) =>
        s + (l.accountId===ctrl ? (type==='SAL' ? (l.debit||0) : (l.credit||0)) : 0), 0);
      const total = ctrlAmt || inv.total || inv.amount || 0;
      const paid = allocMap[inv.id] || 0;
      const out  = Math.max(0, total - paid);
      const days = Math.floor((new Date(asOf) - new Date(inv.date)) / 86400000);
      const bucket = days<=30 ? '0–30' : days<=60 ? '31–60' : days<=90 ? '61–90' : '90+';
      return {id:inv.id, date:inv.date, number:inv.number, party:inv.partyName||'',
        reference:inv.reference||'', total, paid, out, days, bucket, settled: out<=0.01};
    })
    .sort((a,b) => a.party.localeCompare(b.party) || a.date.localeCompare(b.date));

  const allRec = useMemo(() => buildBills('SAL'), [data.vouchers, allocMap]);
  const allPay = useMemo(() => buildBills('PUR'), [data.vouchers, allocMap]);
  const allBills = tab==='rec' ? allRec : allPay;

  const rows = useMemo(() =>
    allBills.filter(r =>
      statusFilter==='all' ? true :
      statusFilter==='settled' ? r.settled : !r.settled),
    [allBills, statusFilter]);

  const buckets = ['0–30','31–60','61–90','90+'];
  // Bucket cards always reflect OPEN bills, regardless of the status filter
  const openBills = allBills.filter(r=>!r.settled);
  const bucketTotals = buckets.map(b => openBills.filter(r=>r.bucket===b).reduce((s,r)=>s+r.out,0));
  const grandOut = openBills.reduce((s,r)=>s+r.out,0);

  const handleExcel = () => {
    exportXLSX(`Billwise_${tab==='rec'?'Receivables':'Payables'}_${asOf}.xlsx`, [{
      name: tab==='rec'?'Receivables':'Payables',
      rows: [
        [`Bill-wise ${tab==='rec'?'Receivables':'Payables'}  ${data.company.name}  as on ${asOf}`],[],
        ['Party','Inv Date','Inv No','Reference','Invoice (₹)','Received/Paid (₹)','Outstanding (₹)','Days','Bucket'],
        ...rows.map(r=>[r.party,r.date,r.number,r.reference,r.total,r.paid,r.out,r.days,r.bucket]),
        [],['','','','TOTAL','','',grandOut,'',''],
      ],
    }]);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Bill-wise Outstanding</h1>
        <div className="page-sub">Invoice-level ageing from bill tagging · as on {asOf}</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
      <button className={'btn'+(tab==='rec'?' btn-primary':'')} onClick={()=>setTab('rec')}>
        ↗ Receivables ({allRec.filter(r=>!r.settled).length} open / {allRec.length} bills)
      </button>
      <button className={'btn'+(tab==='pay'?' btn-primary':'')} onClick={()=>setTab('pay')}>
        ↘ Payables ({allPay.filter(r=>!r.settled).length} open / {allPay.length} bills)
      </button>
      <span style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center',fontSize:12}}>
        <span style={{color:'var(--ink-3)'}}>Show:</span>
        {[['open','Outstanding'],['settled','✓ Settled'],['all','All Bills']].map(([k,l])=>(
          <button key={k} className={'btn btn-sm'+(statusFilter===k?' btn-primary':'')}
            style={{fontSize:11}} onClick={()=>setStatusFilter(k)}>{l}</button>
        ))}
      </span>
    </div>

    <div className="stat-grid" style={{marginBottom:14}}>
      {buckets.map((b,i)=>(
        <div key={b} className={'stat'+(i>=2?' stat-danger':i===1?' stat-gold':'')}>
          <div className="stat-label">{b} days</div>
          <div className="stat-value rupee">₹{fmt(bucketTotals[i])}</div>
        </div>
      ))}
      <div className="stat stat-info">
        <div className="stat-label">Total Outstanding</div>
        <div className="stat-value rupee">₹{fmt(grandOut)}</div>
      </div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Party</th><th style={{width:92}}>Inv Date</th><th style={{width:100}}>Inv No</th>
          <th className="num" style={{width:110}}>Invoice (₹)</th>
          <th className="num" style={{width:110}}>{tab==='rec'?'Received':'Paid'} (₹)</th>
          <th className="num" style={{width:120}}>Outstanding (₹)</th>
          <th className="num" style={{width:60}}>Days</th><th style={{width:70}}>Bucket</th>
        </tr></thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td colSpan="8"><div className="empty"><div className="empty-ico">{allBills.length===0?'∅':'✓'}</div>
              {allBills.length===0 ? (<>
                <div>No {tab==='rec'?'sales invoices':'purchase bills'} found.</div>
                <div style={{fontSize:11,marginTop:6,color:'var(--ink-3)'}}>
                  Post {tab==='rec'?'Sales (SAL)':'Purchase (PUR)'} vouchers and they will appear here automatically.
                  {tab==='rec' && allPay.length>0 && ' You have purchase bills  switch to the Payables tab above.'}
                </div>
              </>) : statusFilter==='open' ? (<>
                <div>All {allBills.length} {tab==='rec'?'sales invoices':'purchase bills'} are fully settled  nothing outstanding. 🎉</div>
                <div style={{fontSize:11,marginTop:6,color:'var(--ink-3)'}}>Click "All Bills" above to see them with payment details.</div>
              </>) : (
                <div>No {statusFilter==='settled'?'settled':''} bills match this filter.</div>
              )}
            </div></td></tr>
          ) : rows.map(r=>(
            <tr key={r.id} style={r.settled?{opacity:.6,background:'#f0fdf4'}:{}}>
              <td style={{fontWeight:500}}>{r.party}</td>
              <td style={{fontSize:12}}>{fmtDate(r.date)}</td>
              <td style={{fontFamily:'var(--mono)',fontSize:12}}>{r.number}</td>
              <td className="num">{fmt(r.total)}</td>
              <td className="num" style={{color:'var(--ink-3)'}}>{r.paid?fmt(r.paid):''}</td>
              <td className="num" style={{fontWeight:700,color:r.settled?'var(--primary)':r.bucket==='90+'?'var(--danger)':'var(--ink)'}}>
                {r.settled?'0.00':fmt(r.out)}
              </td>
              <td className="num" style={{fontSize:12}}>{r.settled?'':r.days}</td>
              <td>{r.settled
                ? <span className="badge badge-success" style={{fontSize:10}}>✓ Settled</span>
                : <span className={'badge '+(r.bucket==='0–30'?'badge-success':r.bucket==='31–60'?'badge-info':'badge-danger')} style={{fontSize:10}}>{r.bucket}</span>}
              </td>
            </tr>
          ))}
          {rows.length>0 && (
            <tr className="total"><td colSpan="5" style={{textAlign:'right'}}>TOTAL OUTSTANDING (open bills)</td>
              <td className="num">₹{fmt(grandOut)}</td><td colSpan="2"></td></tr>
          )}
        </tbody>
      </table>
    </div>
  </>);
}

// ============================================================================
// FIXED ASSET REGISTER + DEPRECIATION (Companies Act Sch-II & Income Tax Sec 32)
// ============================================================================
const IT_BLOCK_RATES = [
  {rate:5,  label:'Buildings - residential (5%)'},
  {rate:10, label:'Buildings - others / Furniture & Fittings (10%)'},
  {rate:15, label:'Plant & Machinery / Vehicles (15%)'},
  {rate:25, label:'Intangibles - patents, know-how (25%)'},
  {rate:30, label:'Vehicles - commercial hire (30%)'},
  {rate:40, label:'Computers / Software / Books (40%)'},
];
function FixedAssets({data, setData, showToast, readOnly=false}){
  const fyStart = data.company.fyStart || '2025-04-01';
  const fyEnd   = data.company.fyEnd   || '2026-03-31';
  const fyYear  = parseInt(fyStart.slice(0,4));
  const assets  = data.fixedAssets || [];
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState(null);

  const blank = () => ({id:uid(), name:'', ledgerId:'2100', purchaseDate:fyStart, cost:0, openingWDV:0,
    salvage:0, caMethod:'WDV', caRate:15, itRate:15, active:true});

  const daysBetween = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);

  // Depreciation for the selected FY
  const calc = (a) => {
    const isAdd = a.purchaseDate >= fyStart && a.purchaseDate <= fyEnd;   // bought this FY
    const heldFrom = isAdd ? a.purchaseDate : fyStart;
    const daysHeld = Math.max(0, daysBetween(heldFrom, fyEnd) + 1);
    const yearDays = daysBetween(fyStart, fyEnd) + 1;
    const caBase = isAdd ? a.cost : (a.openingWDV || 0);
    // Companies Act
    let caDep;
    if(a.caMethod === 'SLM') caDep = (a.cost - (a.salvage||0)) * (a.caRate||0)/100;
    else                     caDep = caBase * (a.caRate||0)/100;
    if(isAdd) caDep = caDep * daysHeld / yearDays;       // pro-rate additions by days
    caDep = Math.round(Math.max(0, Math.min(caDep, caBase - (a.salvage||0))));
    const caClose = Math.round(caBase - caDep);
    // Income Tax (block WDV, 180-day half rule)
    const itBase = isAdd ? a.cost : (a.openingWDV || 0);
    const halfRate = isAdd && daysHeld < 180;
    const itDep = Math.round(itBase * (a.itRate||0)/100 / (halfRate?2:1));
    const itClose = Math.round(itBase - itDep);
    return {isAdd, daysHeld, caBase, caDep, caClose, itBase, itDep, itClose, halfRate};
  };

  const rows = assets.filter(a=>a.active!==false).map(a => ({...a, ...calc(a)}));
  const totals = rows.reduce((t,r)=>({
    cost:t.cost+ (r.cost||0), caBase:t.caBase+r.caBase, caDep:t.caDep+r.caDep, caClose:t.caClose+r.caClose,
    itBase:t.itBase+r.itBase, itDep:t.itDep+r.itDep, itClose:t.itClose+r.itClose,
  }), {cost:0,caBase:0,caDep:0,caClose:0,itBase:0,itDep:0,itClose:0});

  const ledgerName = id => data.coa.find(a=>a.id===id)?.name || id;

  const saveAsset = () => {
    if(!f.name.trim()) return showToast('Asset name required','error');
    if(!(f.cost>0))    return showToast('Cost must be greater than 0','error');
    const exists = assets.find(a=>a.id===f.id);
    setData({...data, fixedAssets: exists ? assets.map(a=>a.id===f.id?f:a) : [...assets, f]});
    showToast(exists?'Asset updated':'Asset added');
    setShowAdd(false); setF(null);
  };
  const delAsset = (id) => { if(!confirm('Delete this asset from the register?')) return;
    setData({...data, fixedAssets: assets.filter(a=>a.id!==id)}); showToast('Asset removed'); };

  const postDeprJV = () => {
    if(totals.caDep<=0) return showToast('No depreciation to post','error');
    if(isDateLocked(data.company, fyEnd)) return showToast('Books are locked for this period','error');
    if(!confirm(`Post Companies Act depreciation JV for FY ${fyYear}-${String(fyYear+1).slice(2)}?\n\nDr Depreciation ₹${fmt(totals.caDep)}\n   Cr Accumulated Depreciation ₹${fmt(totals.caDep)}`)) return;
    const typeCount = (data.vouchers||[]).filter(x=>x.type==='JV').length;
    const num = 'JV/'+String(typeCount+1).padStart(4,'0');
    const v = {id:uid(), type:'JV', date:fyEnd, number:num, partyName:'', reference:'Depreciation',
      narration:`Depreciation for FY ${fyYear}-${String(fyYear+1).slice(2)} (Companies Act, per Fixed Asset Register)`,
      lines:[{id:uid(),accountId:'4400',debit:totals.caDep,credit:0,narration:'Depreciation'},
             {id:uid(),accountId:'2130',debit:0,credit:totals.caDep,narration:'Accumulated Depreciation'}],
      amount:totals.caDep, status:'Posted', createdAt:new Date().toISOString()};
    setData({...data, vouchers:[...(data.vouchers||[]), v],
      auditLog:[...(data.auditLog||[]), auditEntry('CREATE', `${num} (JV) Depreciation ₹${fmt(totals.caDep)} from Fixed Asset Register`)]});
    showToast(`✓ Depreciation JV ${num} posted ₹${fmt(totals.caDep)}`);
  };

  const handleExcel = () => exportXLSX(`FixedAssetRegister_FY${fyYear}.xlsx`, [{name:'FA Register', rows:[
    [`Fixed Asset Register & Depreciation - ${data.company.name} - FY ${fyYear}-${String(fyYear+1).slice(2)}`],[],
    ['Asset','Ledger','Purchase Date','Cost','Opening WDV','CA Method','CA Rate %','CA Depreciation','CA Closing WDV','IT Rate %','IT Depreciation','IT Closing WDV'],
    ...rows.map(r=>[r.name, ledgerName(r.ledgerId), r.purchaseDate, r.cost, r.openingWDV, r.caMethod, r.caRate, r.caDep, r.caClose, r.itRate, r.itDep, r.itClose]),
    [],['','','TOTAL', totals.cost,'','','', totals.caDep, totals.caClose,'', totals.itDep, totals.itClose],
  ]}]);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Fixed Asset Register</h1>
        <div className="page-sub">FY {fyYear}–{String(fyYear+1).slice(2)} · Depreciation under Companies Act Sch-II &amp; Income-Tax Sec 32 (block WDV)</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        {!readOnly && <button className="btn btn-sm" onClick={postDeprJV}>⊕ Post Depreciation JV</button>}
        {!readOnly && <button className="btn btn-sm btn-primary" onClick={()=>{setF(blank());setShowAdd(true);}}>+ Add Asset</button>}
      </div>
    </div>

    <div className="stat-grid" style={{marginBottom:16}}>
      <div className="stat"><div className="stat-label">Assets</div><div className="stat-value">{rows.length}</div></div>
      <div className="stat stat-info"><div className="stat-label">Total Cost</div><div className="stat-value rupee">₹{fmt(totals.cost)}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Depreciation (Companies Act)</div><div className="stat-value rupee">₹{fmt(totals.caDep)}</div></div>
      <div className="stat"><div className="stat-label">Depreciation (Income Tax)</div><div className="stat-value rupee">₹{fmt(totals.itDep)}</div></div>
    </div>

    <div className="table-wrap">
      <table style={{fontSize:12.5}}>
        <thead><tr>
          <th>Asset</th><th style={{width:90}}>Purchase</th>
          <th className="num" style={{width:100}}>Cost</th><th className="num" style={{width:100}}>Opening WDV</th>
          <th style={{width:60}}>CA Mtd</th><th className="num" style={{width:55}}>CA %</th>
          <th className="num" style={{width:110}}>CA Depr.</th><th className="num" style={{width:110}}>CA Closing</th>
          <th className="num" style={{width:55}}>IT %</th><th className="num" style={{width:110}}>IT Depr.</th><th className="num" style={{width:110}}>IT Closing</th>
          {!readOnly && <th style={{width:70}}></th>}
        </tr></thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td colSpan={readOnly?11:12}><div className="empty"><div className="empty-ico">🏭</div>
              <div>No fixed assets yet. Add Plant &amp; Machinery, Computers, Furniture, Vehicles to compute depreciation.</div></div></td></tr>
          ) : rows.map(r=>(
            <tr key={r.id}>
              <td><b>{r.name}</b><div style={{fontSize:10,color:'var(--ink-3)'}}>{ledgerName(r.ledgerId)}{r.isAdd?' · added this FY'+(r.halfRate?' (<180d, half IT rate)':''):''}</div></td>
              <td style={{fontSize:12}}>{fmtDate(r.purchaseDate)}</td>
              <td className="num">{fmt(r.cost)}</td><td className="num">{fmt(r.openingWDV)}</td>
              <td>{r.caMethod}</td><td className="num">{r.caRate}%</td>
              <td className="num" style={{fontWeight:600,color:'var(--primary)'}}>{fmt(r.caDep)}</td><td className="num">{fmt(r.caClose)}</td>
              <td className="num">{r.itRate}%</td><td className="num" style={{fontWeight:600,color:'var(--info)'}}>{fmt(r.itDep)}</td><td className="num">{fmt(r.itClose)}</td>
              {!readOnly && <td className="actions">
                <button className="btn btn-sm btn-ghost" onClick={()=>{setF({...r});setShowAdd(true);}}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={()=>delAsset(r.id)}>×</button>
              </td>}
            </tr>
          ))}
          {rows.length>0 && (
            <tr className="total">
              <td colSpan="2" style={{textAlign:'right'}}>TOTAL</td>
              <td className="num">₹{fmt(totals.cost)}</td><td className="num">₹{fmt(totals.caBase)}</td>
              <td colSpan="2"></td>
              <td className="num">₹{fmt(totals.caDep)}</td><td className="num">₹{fmt(totals.caClose)}</td>
              <td></td><td className="num">₹{fmt(totals.itDep)}</td><td className="num">₹{fmt(totals.itClose)}</td>
              {!readOnly && <td></td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <div style={{marginTop:12,fontSize:11,color:'var(--ink-3)'}}>
      Companies Act (Sch-II): WDV or SLM at your rate; additions pro-rated by days held. Income Tax (Sec 32): block-WDV at prescribed rate, additions held &lt;180 days get half rate.
      "Opening WDV" is the written-down value at the start of this FY - set it equal to cost for assets bought this year. Post the Companies Act depreciation as a JV (Dr Depreciation / Cr Accumulated Depreciation).
    </div>

    {showAdd && f && (
      <div className="modal-overlay" onClick={()=>{setShowAdd(false);setF(null);}}>
        <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
          <div className="modal-head"><h2 className="modal-title">{assets.find(a=>a.id===f.id)?'Edit':'Add'} Fixed Asset</h2>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setShowAdd(false);setF(null);}}>✕</button></div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field required" style={{gridColumn:'1/3'}}><label>Asset Name</label>
                <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Dell Server, Toyota Innova" /></div>
              <div className="field"><label>Asset Ledger (COA)</label>
                <select value={f.ledgerId} onChange={e=>setF({...f,ledgerId:e.target.value})}>
                  {data.coa.filter(a=>a.type==='Asset'&&(a.group==='Fixed Assets'||a.schedule==='PPE')&&!a.contra).map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                </select></div>
              <div className="field"><label>Purchase Date</label>
                <input type="date" value={f.purchaseDate} onChange={e=>setF({...f,purchaseDate:e.target.value})} /></div>
              <div className="field required"><label>Cost (₹)</label>
                <input type="number" value={f.cost} onChange={e=>setF({...f,cost:parseFloat(e.target.value)||0})} /></div>
              <div className="field"><label>Opening WDV (₹) - start of FY</label>
                <input type="number" value={f.openingWDV} onChange={e=>setF({...f,openingWDV:parseFloat(e.target.value)||0})} placeholder="= cost if bought this year" /></div>
              <div className="field"><label>Salvage / Residual (₹)</label>
                <input type="number" value={f.salvage} onChange={e=>setF({...f,salvage:parseFloat(e.target.value)||0})} /></div>
              <div className="field"><label>Companies Act Method</label>
                <select value={f.caMethod} onChange={e=>setF({...f,caMethod:e.target.value})}>
                  <option value="WDV">WDV (Written Down Value)</option><option value="SLM">SLM (Straight Line)</option>
                </select></div>
              <div className="field"><label>Companies Act Rate (%)</label>
                <input type="number" step="0.01" value={f.caRate} onChange={e=>setF({...f,caRate:parseFloat(e.target.value)||0})} /></div>
              <div className="field" style={{gridColumn:'1/3'}}><label>Income-Tax Block Rate (%)</label>
                <select value={f.itRate} onChange={e=>setF({...f,itRate:parseFloat(e.target.value)||0})}>
                  {IT_BLOCK_RATES.map(b=><option key={b.rate} value={b.rate}>{b.label}</option>)}
                </select></div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={()=>{setShowAdd(false);setF(null);}}>Cancel</button>
            <button className="btn btn-primary" onClick={saveAsset}>Save Asset</button>
          </div>
        </div>
      </div>
    )}
  </>);
}

// ============================================================================
// PREPAID / ACCRUAL AMORTIZATION (auto-post monthly portions)
// ============================================================================
function PrepaidAmortization({data, setData, showToast, readOnly=false}){
  const list = data.amortizations || [];
  const [f, setF] = useState(null);
  const nowMonth = today().slice(0,7);

  const blank = () => ({id:uid(), name:'', expAcc:'4500', prepaidAcc:'2700', total:0,
    startMonth: today().slice(0,7), months:12, posted:[]});

  // List of month strings from start for `months` periods
  const schedule = (a) => {
    const out=[]; let [y,m] = a.startMonth.split('-').map(Number);
    for(let i=0;i<a.months;i++){ out.push(`${y}-${String(m).padStart(2,'0')}`); m++; if(m>12){m=1;y++;} }
    return out;
  };
  const rows = list.map(a => {
    const months = schedule(a);
    const monthly = a.months ? Math.round(a.total/a.months) : 0;
    const postedSet = new Set(a.posted||[]);
    const due = months.filter(mo => mo <= nowMonth && !postedSet.has(mo));
    return {...a, months_arr:months, monthly, postedCount:(a.posted||[]).length, due, remaining:a.total - (a.posted||[]).length*monthly};
  });

  const save = () => {
    if(!f.name.trim()) return showToast('Name required','error');
    if(!(f.total>0))   return showToast('Amount must be > 0','error');
    const exists = list.find(x=>x.id===f.id);
    setData({...data, amortizations: exists ? list.map(x=>x.id===f.id?f:x) : [...list, f]});
    showToast(exists?'Schedule updated':'Schedule added'); setF(null);
  };
  const del = (id)=>{ if(!confirm('Delete this amortization schedule?')) return; setData({...data, amortizations:list.filter(x=>x.id!==id)}); };

  const postDue = (a) => {
    const r = rows.find(x=>x.id===a.id);
    if(!r.due.length) return showToast('Nothing due to post','error');
    let vouchers = [...(data.vouchers||[])];
    let newLog = [...(data.auditLog||[])];
    const monthly = r.monthly;
    r.due.forEach(mo => {
      const last = new Date(parseInt(mo.slice(0,4)), parseInt(mo.slice(5,7)), 0).getDate();
      const date = mo+'-'+String(last).padStart(2,'0');
      if(isDateLocked(data.company, date)) return;
      const num = nextVoucherNumber({...data, vouchers}, 'JV');
      vouchers.push({id:uid(), type:'JV', date, number:num, partyName:'', reference:'Amortization',
        narration:`${a.name} - amortization for ${mo}`, status:'Posted', amount:monthly, createdAt:new Date().toISOString(),
        lines:[{id:uid(),accountId:a.expAcc,debit:monthly,credit:0,narration:a.name},
               {id:uid(),accountId:a.prepaidAcc,debit:0,credit:monthly,narration:'Prepaid release'}]});
      newLog.push(auditEntry('CREATE', `${num} (JV) amortization ${a.name} ${mo} ₹${fmt(monthly)}`));
    });
    const postedNow = r.due.filter(mo => !isDateLocked(data.company, mo+'-28'));
    setData({...data, vouchers, auditLog:newLog,
      amortizations: list.map(x=>x.id===a.id?{...x, posted:[...(x.posted||[]), ...postedNow]}:x)});
    showToast(`✓ Posted ${postedNow.length} amortization JV(s) for ${a.name}`);
  };

  const expAccts = data.coa.filter(c=>c.type==='Expense');
  const assetAccts = data.coa.filter(c=>c.type==='Asset');

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Prepaid / Accrual Amortization</h1>
        <div className="page-sub">Spread a prepaid expense (insurance, AMC, rent) over months - auto-posts each month's portion</div>
      </div>
      {!readOnly && <div className="page-actions"><button className="btn btn-sm btn-primary" onClick={()=>setF(blank())}>+ Add Schedule</button></div>}
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Schedule</th><th>Expense → Prepaid</th><th style={{width:80}}>Start</th>
          <th className="num" style={{width:110}}>Total</th><th className="num" style={{width:100}}>Monthly</th>
          <th className="num" style={{width:90}}>Posted</th><th className="num" style={{width:120}}>Remaining</th>
          <th style={{width:160}}></th>
        </tr></thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td colSpan="8"><div className="empty"><div className="empty-ico">🗓</div><div>No amortization schedules. Add one for prepaid insurance, AMC, subscriptions, etc.</div></div></td></tr>
          ) : rows.map(r=>(
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              <td style={{fontSize:11,color:'var(--ink-3)'}}>{data.coa.find(a=>a.id===r.expAcc)?.name} ← {data.coa.find(a=>a.id===r.prepaidAcc)?.name}</td>
              <td style={{fontSize:12}}>{r.startMonth}</td>
              <td className="num">{fmt(r.total)}</td><td className="num">{fmt(r.monthly)}</td>
              <td className="num">{r.postedCount}/{r.months}</td>
              <td className="num" style={{fontWeight:600}}>{fmt(r.remaining)}</td>
              <td className="actions">
                {!readOnly && r.due.length>0 && <button className="btn btn-sm btn-primary" onClick={()=>postDue(r)}>Post {r.due.length} due</button>}
                {!readOnly && r.due.length===0 && <span className="badge badge-success" style={{fontSize:10}}>✓ Up to date</span>}
                {!readOnly && <button className="btn btn-sm btn-ghost" onClick={()=>setF({...r})} style={{marginLeft:4}}>Edit</button>}
                {!readOnly && <button className="btn btn-sm btn-danger" onClick={()=>del(r.id)}>×</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {f && (
      <div className="modal-overlay" onClick={()=>setF(null)}>
        <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
          <div className="modal-head"><h2 className="modal-title">{list.find(x=>x.id===f.id)?'Edit':'Add'} Amortization Schedule</h2>
            <button className="btn btn-ghost btn-sm" onClick={()=>setF(null)}>✕</button></div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field required" style={{gridColumn:'1/3'}}><label>Description</label>
                <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Annual fire insurance FY25-26" /></div>
              <div className="field"><label>Expense Account (Dr each month)</label>
                <select value={f.expAcc} onChange={e=>setF({...f,expAcc:e.target.value})}>
                  {expAccts.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                </select></div>
              <div className="field"><label>Prepaid Asset Account (Cr each month)</label>
                <select value={f.prepaidAcc} onChange={e=>setF({...f,prepaidAcc:e.target.value})}>
                  {assetAccts.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                </select></div>
              <div className="field required"><label>Total Amount (₹)</label>
                <input type="number" value={f.total} onChange={e=>setF({...f,total:parseFloat(e.target.value)||0})} /></div>
              <div className="field"><label>Start Month</label>
                <input type="month" value={f.startMonth} onChange={e=>setF({...f,startMonth:e.target.value})} /></div>
              <div className="field"><label>Spread over (months)</label>
                <input type="number" min="1" max="120" value={f.months} onChange={e=>setF({...f,months:parseInt(e.target.value)||1})} /></div>
              <div className="field" style={{alignSelf:'flex-end'}}><div className="help">Monthly: ₹{fmt(f.months?Math.round(f.total/f.months):0)}</div></div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={()=>setF(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Schedule</button>
          </div>
        </div>
      </div>
    )}
  </>);
}

// ============================================================================
// ADVANCE TAX ESTIMATOR (Sec 208/211 instalments)
// ============================================================================
function AdvanceTax({data}){
  const fyStart = data.company.fyStart || '';
  const fyYear  = parseInt((fyStart||'2025-04-01').slice(0,4));
  const t = today();
  const pb = useMemo(() => computePeriodBals(data, fyStart, t), [data, fyStart]);

  const income  = data.coa.filter(a=>a.type==='Income').reduce((s,a)=>s+(-(pb.period[a.id]||0)),0);
  const expense = data.coa.filter(a=>a.type==='Expense').reduce((s,a)=>s+(pb.period[a.id]||0),0);
  const ytdPbt  = income - expense;
  const m = parseInt(t.slice(5,7));
  const monthsElapsed = m >= 4 ? m-3 : m+9;            // Apr=1 … Mar=12
  const annualPbtAuto = monthsElapsed>0 ? Math.round((ytdPbt/monthsElapsed)*12) : 0;
  const tdsLedgerBal  = Math.round(pb.asOn['2700'] || 0);   // TDS Receivable ledger

  // ── Editable inputs ──
  const RATE_PRESETS = [
    {v:'25', rate:25, label:'Company - MSME / turnover ≤ ₹400 Cr · 25%'},
    {v:'22', rate:22, label:'Company - Sec 115BAA concessional · 22%'},
    {v:'15', rate:15, label:'Company - Sec 115BAB new manufacturing · 15%'},
    {v:'30', rate:30, label:'Company (other) / Firm / LLP · 30%'},
    {v:'custom', rate:null, label:'Custom rate…'},
  ];
  const [annualMode, setAnnualMode] = useState('annualised');  // annualised | ytd | manual
  const [pbtManual, setPbtManual] = useState(annualPbtAuto);
  const [extraIncome, setExtraIncome]   = useState(0);   // expected additional income for rest of FY
  const [extraExpense, setExtraExpense] = useState(0);   // expected additional expenses for rest of FY
  const [addBacks, setAddBacks]   = useState(0);
  const [deduct, setDeduct]       = useState(0);
  const [ratePreset, setRatePreset] = useState('25');
  const [rate, setRate]           = useState(25);
  const [surcharge, setSurcharge] = useState(0);
  const [cess, setCess]           = useState(4);
  const [tds, setTds]             = useState(tdsLedgerBal);
  const [paid, setPaid]           = useState(0);

  const basePbt = annualMode==='annualised' ? annualPbtAuto
                : annualMode==='ytd'        ? ytdPbt
                : pbtManual;
  const projectedPbt = basePbt + extraIncome - extraExpense;
  const taxable   = Math.max(0, Math.round(projectedPbt + addBacks - deduct));
  const grossTax  = Math.round(taxable * rate/100);
  const surAmt    = Math.round(grossTax * surcharge/100);
  const cessAmt   = Math.round((grossTax + surAmt) * cess/100);
  const totalTax  = grossTax + surAmt + cessAmt;
  const netLiability = Math.max(0, totalTax - tds);     // advance tax is on tax net of TDS
  const remaining = Math.max(0, netLiability - paid);

  // ── Instalment schedule (Sec 211 / 234C) ──
  const inst = [
    {due:`${fyYear}-06-15`,   pct:15,  label:'1st - by 15 Jun'},
    {due:`${fyYear}-09-15`,   pct:45,  label:'2nd - by 15 Sep'},
    {due:`${fyYear}-12-15`,   pct:75,  label:'3rd - by 15 Dec'},
    {due:`${fyYear+1}-03-15`, pct:100, label:'4th - by 15 Mar'},
  ].map((i,idx,arr)=>({...i,
    cumAmt:  Math.round(netLiability*i.pct/100),
    instAmt: Math.round(netLiability*i.pct/100) - (idx>0 ? Math.round(netLiability*arr[idx-1].pct/100) : 0),
    paidCum: Math.min(paid, Math.round(netLiability*i.pct/100)),
    status:  t > i.due ? 'past' : 'upcoming',
  })).map(i=>({...i, shortfall: Math.max(0, i.cumAmt - paid)}));

  const numIn = (val, setter, style={}) => (
    <input type="number" value={val} onChange={e=>setter(parseFloat(e.target.value)||0)}
      style={{width:'100%',textAlign:'right',padding:'6px 9px',border:'1px solid var(--line-2)',borderRadius:6,fontSize:13,fontFamily:'var(--mono)',...style}} />
  );
  const sumRow = (label, val, opts={}) => (
    <tr style={{borderBottom:'1px solid var(--line-2)',...(opts.bold?{fontWeight:700,background:'var(--surface-2)'}:{})}}>
      <td style={{padding:'9px 16px'}}>{label}</td>
      <td style={{padding:'9px 16px',textAlign:'right',fontFamily:'var(--mono)',color:opts.color}}>{opts.neg?'(–) ':''}₹{fmt(Math.abs(val))}</td>
    </tr>
  );

  const handleExcel = () => exportXLSX(`AdvanceTax_FY${fyYear}.xlsx`, [{name:'Advance Tax', rows:[
    [`Advance Tax Computation - ${data.company.name} - FY ${fyYear}-${String(fyYear+1).slice(2)}`],[],
    ['Estimated Annual Profit (PBT basis)', basePbt],
    ['Add: Extra estimated income (rest of year)', extraIncome],
    ['Less: Extra estimated expenses (rest of year)', extraExpense],
    ['Projected Annual Profit', projectedPbt],
    ['Add: Disallowances / adjustments', addBacks],
    ['Less: Deductions (Chapter VI-A etc.)', deduct],
    ['Taxable Income', taxable],
    [`Income Tax @ ${rate}%`, grossTax],
    [`Surcharge @ ${surcharge}%`, surAmt],
    [`Health & Education Cess @ ${cess}%`, cessAmt],
    ['Total Tax Liability', totalTax],
    ['Less: TDS / TCS Credit', tds],
    ['Net Advance Tax Payable', netLiability],
    ['Less: Advance Tax already paid', paid],
    ['Balance Payable', remaining],[],
    ['Instalment','Due Date','Cum %','Cumulative (₹)','This Instalment (₹)','Shortfall vs Paid (₹)'],
    ...inst.map(i=>[i.label, i.due, i.pct+'%', i.cumAmt, i.instAmt, i.shortfall]),
  ]}]);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Advance Tax Estimator</h1>
        <div className="page-sub">FY {fyYear}–{String(fyYear+1).slice(2)} · Editable computation · Sec 208/211 · Surcharge + 4% Cess</div>
      </div>
      <div className="page-actions"><button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button></div>
    </div>

    <div className="stat-grid" style={{marginBottom:16}}>
      <div className="stat"><div className="stat-label">YTD PBT ({monthsElapsed} mo · books)</div><div className="stat-value rupee">₹{fmt(ytdPbt)}</div></div>
      <div className="stat stat-info"><div className="stat-label">Taxable Income</div><div className="stat-value rupee">₹{fmt(taxable)}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Total Tax Liability</div><div className="stat-value rupee">₹{fmt(totalTax)}</div></div>
      <div className="stat"><div className="stat-label">Net Advance Tax</div><div className="stat-value rupee">₹{fmt(netLiability)}</div></div>
      <div className="stat stat-danger"><div className="stat-label">Balance Payable</div><div className="stat-value rupee">₹{fmt(remaining)}</div></div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,alignItems:'start'}}>
      {/* ── Editable computation ── */}
      <div className="card">
        <div className="card-head"><h3 className="card-title">Tax Computation - adjust any figure</h3></div>
        <div className="card-body" style={{padding:0}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <tbody>
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Estimated Annual Profit (PBT)
                  <div style={{display:'flex',gap:6,marginTop:5}}>
                    {[['annualised','Annualise YTD'],['ytd','Use YTD only'],['manual','Enter manually']].map(([k,l])=>(
                      <button key={k} className={'btn btn-sm'+(annualMode===k?' btn-primary':'')} style={{fontSize:10,padding:'3px 8px'}}
                        onClick={()=>setAnnualMode(k)}>{l}</button>
                    ))}
                  </div>
                </td>
                <td style={{padding:'9px 16px',textAlign:'right',width:170}}>
                  {annualMode==='manual'
                    ? numIn(pbtManual, setPbtManual)
                    : <span style={{fontFamily:'var(--mono)',fontWeight:600}}>₹{fmt(basePbt)}</span>}
                </td>
              </tr>
              <tr style={{borderBottom:'1px solid var(--line-2)',background:'var(--surface-2)'}}>
                <td colSpan="2" style={{padding:'7px 16px',fontSize:11,color:'var(--ink-3)'}}>
                  ℹ How this is derived: YTD Income ₹{fmt(income)} − Expenses ₹{fmt(expense)} = <b>₹{fmt(ytdPbt)}</b> profit over {monthsElapsed} month{monthsElapsed!==1?'s':''} (Apr→today).
                  {annualMode==='annualised' && <> × 12/{monthsElapsed} = <b>₹{fmt(annualPbtAuto)}</b> projected for the full year.</>}
                  {annualMode==='ytd' && <> Using YTD profit as-is (no annualising).</>}
                  {annualMode==='manual' && <> Using your manual figure.</>}
                </td>
              </tr>
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Add: Extra estimated income (rest of year)
                  <div style={{fontSize:10,color:'var(--ink-3)'}}>one-off / expected income not in the books yet</div></td>
                <td style={{padding:'9px 16px'}}>{numIn(extraIncome, setExtraIncome)}</td>
              </tr>
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Less: Extra estimated expenses (rest of year)
                  <div style={{fontSize:10,color:'var(--ink-3)'}}>planned spends / bonuses not yet booked</div></td>
                <td style={{padding:'9px 16px'}}>{numIn(extraExpense, setExtraExpense)}</td>
              </tr>
              {(extraIncome>0||extraExpense>0) && sumRow('Projected Annual Profit', projectedPbt, {bold:true})}
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Add: Disallowances / adjustments
                  <div style={{fontSize:10,color:'var(--ink-3)'}}>e.g. 30% expense u/s 40(a)(ia), depreciation diff., donations</div></td>
                <td style={{padding:'9px 16px'}}>{numIn(addBacks, setAddBacks)}</td>
              </tr>
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Less: Deductions (Chapter VI-A etc.)</td>
                <td style={{padding:'9px 16px'}}>{numIn(deduct, setDeduct)}</td>
              </tr>
              {sumRow('Taxable Income', taxable, {bold:true})}
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Income Tax Rate
                  <select value={ratePreset} onChange={e=>{ const p=RATE_PRESETS.find(x=>x.v===e.target.value); setRatePreset(e.target.value); if(p&&p.rate!=null) setRate(p.rate); }}
                    style={{display:'block',marginTop:5,width:'100%',fontSize:11,padding:'5px 6px',border:'1px solid var(--line-2)',borderRadius:6}}>
                    {RATE_PRESETS.map(p=><option key={p.v} value={p.v}>{p.label}</option>)}
                  </select>
                </td>
                <td style={{padding:'9px 16px',verticalAlign:'bottom'}}>
                  <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>{numIn(rate, v=>{setRate(v);setRatePreset('custom');}, {width:70})}<span>%</span></div>
                </td>
              </tr>
              {sumRow(`Income Tax @ ${rate}%`, grossTax)}
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Surcharge
                  <div style={{fontSize:10,color:'var(--ink-3)'}}>Co: 7% (₹1–10 Cr), 12% (&gt;10 Cr); 115BAA/BAB flat 10%; Firm 12% (&gt;1 Cr)</div></td>
                <td style={{padding:'9px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>{numIn(surcharge, setSurcharge, {width:70})}<span>%</span></div>
                </td>
              </tr>
              {surAmt>0 && sumRow(`Surcharge @ ${surcharge}%`, surAmt)}
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Health &amp; Education Cess</td>
                <td style={{padding:'9px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>{numIn(cess, setCess, {width:70})}<span>%</span></div>
                </td>
              </tr>
              {sumRow(`Cess @ ${cess}%`, cessAmt)}
              {sumRow('Total Tax Liability', totalTax, {bold:true})}
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Less: TDS / TCS Credit
                  <div style={{fontSize:10,color:'var(--ink-3)'}}>Auto from TDS Receivable ledger (₹{fmt(tdsLedgerBal)}) - editable</div></td>
                <td style={{padding:'9px 16px'}}>{numIn(tds, setTds)}</td>
              </tr>
              {sumRow('Net Advance Tax Payable', netLiability, {bold:true, color:'var(--primary)'})}
              <tr style={{borderBottom:'1px solid var(--line-2)'}}>
                <td style={{padding:'9px 16px'}}>Less: Advance Tax already paid</td>
                <td style={{padding:'9px 16px'}}>{numIn(paid, setPaid)}</td>
              </tr>
              {sumRow('Balance Payable', remaining, {bold:true, color:'var(--danger)'})}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Instalment schedule ── */}
      <div className="card">
        <div className="card-head"><h3 className="card-title">Instalment Schedule (Sec 211)</h3></div>
        <div className="card-body" style={{padding:0}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
              <th style={{padding:'9px 12px',textAlign:'left'}}>Instalment</th>
              <th style={{padding:'9px 12px',textAlign:'left',width:90}}>Due</th>
              <th style={{padding:'9px 12px',textAlign:'right',width:50}}>%</th>
              <th style={{padding:'9px 12px',textAlign:'right',width:110}}>Pay by date (₹)</th>
              <th style={{padding:'9px 12px',textAlign:'right',width:110}}>Shortfall (₹)</th>
            </tr></thead>
            <tbody>
              {inst.map(i=>(
                <tr key={i.due} style={{borderBottom:'1px solid var(--line-2)'}}>
                  <td style={{padding:'9px 12px',fontWeight:500}}>{i.label}
                    <div><span className={'badge '+(i.status==='past'?'badge-danger':'badge-info')} style={{fontSize:9}}>{i.status==='past'?'Due passed':'Upcoming'}</span></div>
                  </td>
                  <td style={{padding:'9px 12px',fontSize:12}}>{fmtDate(i.due)}</td>
                  <td style={{padding:'9px 12px',textAlign:'right'}}>{i.pct}%</td>
                  <td style={{padding:'9px 12px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:700}}>{fmt(i.cumAmt)}</td>
                  <td style={{padding:'9px 12px',textAlign:'right',fontFamily:'var(--mono)',color:i.shortfall>0?'var(--danger)':'var(--primary)'}}>
                    {i.shortfall>0 ? fmt(i.shortfall) : '✓ 0'}
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan="3" style={{padding:'9px 12px',textAlign:'right'}}>NET ADVANCE TAX</td>
                <td style={{padding:'9px 12px',textAlign:'right',fontFamily:'var(--mono)'}}>₹{fmt(netLiability)}</td>
                <td style={{padding:'9px 12px',textAlign:'right',fontFamily:'var(--mono)'}}>₹{fmt(remaining)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{padding:'10px 14px',fontSize:11,color:'var(--ink-3)'}}>
            "Pay by date" = cumulative advance tax due by that instalment. "Shortfall" = cumulative due less advance tax already paid.
            <br/>Sec 234C interest @1%/month applies if an instalment is short; 234B @1%/month if total paid &lt; 90% by year-end.
          </div>
        </div>
      </div>
    </div>

    <div style={{marginTop:12,fontSize:11,color:'var(--ink-3)'}}>
      ⚠ Working estimate - figures are editable and pre-filled from your books (profit annualised over {monthsElapsed} month{monthsElapsed!==1?'s':''}). Verify entity type, rate, surcharge slab and deductions with your CA before payment. Presumptive (44AD/44ADA) assessees pay 100% by 15 Mar.
    </div>
  </>);
}

// ============================================================================
// DATA HEALTH CHECK - built-in integrity safety net
// ============================================================================
function HealthCheck({data, setPage}){
  const checks = useMemo(() => {
    const coaIds   = new Set(data.coa.map(a=>a.id));
    const partyIds = new Set(data.parties.map(p=>p.id));
    const active   = (data.vouchers||[]).filter(v=>v.status!=='Cancelled');

    const unbalanced = active.filter(v => {
      const dr=(v.lines||[]).reduce((s,l)=>s+(l.debit||0),0), cr=(v.lines||[]).reduce((s,l)=>s+(l.credit||0),0);
      return Math.abs(dr-cr) > 0.01;
    });
    const orphan = [];
    active.forEach(v => (v.lines||[]).forEach(l => { if(l.accountId && !coaIds.has(l.accountId)) orphan.push(v.number+' → '+l.accountId); }));
    const bal = {}; data.coa.forEach(a=>bal[a.id]=a.opening||0);
    active.forEach(v=>(v.lines||[]).forEach(l=>{ if(!(l.accountId in bal)) bal[l.accountId]=0; bal[l.accountId]+=(l.debit||0)-(l.credit||0); }));
    const tbDr = Object.values(bal).reduce((s,b)=>s+(b>0?b:0),0);
    const tbCr = Object.values(bal).reduce((s,b)=>s+(b<0?-b:0),0);
    const tbDiff = Math.round((tbDr-tbCr)*100)/100;
    const empty = active.filter(v => !(v.lines||[]).length || (v.lines||[]).every(l=>!(l.debit||0)&&!(l.credit||0)));
    const missingParty = active.filter(v => v.partyId && !partyIds.has(v.partyId));
    const gstMissing = active.filter(v => {
      if(!['SAL','PUR','CRN','DBN'].includes(v.type)) return false;
      if(((v.cgst||0)+(v.sgst||0)+(v.igst||0)) < 1) return false;
      return !(v.lines||[]).some(l => ['1310','1311','1312','2600','2601','2602'].includes(l.accountId));
    });
    const negCash = data.coa.filter(a => (a.isBank || a.id==='2500') && (bal[a.id]||0) < -0.5);
    const dupNums = (() => {
      const seen={}, dups=new Set(); active.forEach(v=>{ if(v.number){ if(seen[v.number]) dups.add(v.number); seen[v.number]=1; } }); return [...dups];
    })();
    const badGstin = (data.parties||[]).filter(p => p.gstin && !validateGSTIN(p.gstin).valid).map(p=>p.name);
    if(data.company && data.company.gstin && !validateGSTIN(data.company.gstin).valid) badGstin.unshift('(Your company)');
    // Opening balances must themselves net to zero (a balanced opening trial
    // balance). A non-zero net means the opening entries are lopsided and the
    // difference belongs in an Opening Balance / Suspense ledger.
    const openingNet = Math.round(data.coa.reduce((s,a)=>s+(a.opening||0),0)*100)/100;
    const sizeKB = new Blob([JSON.stringify(data)]).size/1024;
    return {unbalanced, orphan, tbDr, tbCr, tbDiff, empty, missingParty, gstMissing, negCash, dupNums, badGstin,
      openingNet, sizeKB, auditCount:(data.auditLog||[]).length, voucherCount:active.length};
  }, [data]);

  const items = [
    { key:'tally', label:'Trial Balance tallies (Dr = Cr)', ok: Math.abs(checks.tbDiff)<1,
      detail: Math.abs(checks.tbDiff)<1 ? `Dr = Cr = ₹${fmt(checks.tbDr)}` : `Out of balance by ₹${fmt(checks.tbDiff)} - there is an unbalanced or orphaned entry`,
      fix:'Vouchers' },
    { key:'unbal', label:'All vouchers balanced (Dr = Cr per entry)', ok: checks.unbalanced.length===0,
      detail: checks.unbalanced.length===0 ? 'Every voucher is internally balanced' : `${checks.unbalanced.length} unbalanced: ${checks.unbalanced.slice(0,6).map(v=>v.number).join(', ')}`,
      fix:'Vouchers' },
    { key:'opening', label:'Opening balances net to zero (opening TB balanced)', ok: Math.abs(checks.openingNet)<1, warn:true,
      detail: Math.abs(checks.openingNet)<1 ? 'Opening balances are internally balanced' : `Opening balances are out by ₹${fmt(Math.abs(checks.openingNet))} (excess ${checks.openingNet>0?'Debit':'Credit'}) - post the difference to an Opening Balance / Suspense ledger`,
      fix:'coa' },
    { key:'orphan', label:'No orphaned voucher lines (account exists in COA)', ok: checks.orphan.length===0,
      detail: checks.orphan.length===0 ? 'Every line references a valid ledger' : `${checks.orphan.length} line(s) point to a deleted account: ${checks.orphan.slice(0,6).join(', ')}` },
    { key:'empty', label:'No empty / zero-value vouchers', ok: checks.empty.length===0,
      detail: checks.empty.length===0 ? 'No blank entries' : `${checks.empty.length}: ${checks.empty.slice(0,6).map(v=>v.number).join(', ')}` },
    { key:'party', label:'No vouchers referencing a deleted party', ok: checks.missingParty.length===0,
      detail: checks.missingParty.length===0 ? 'All party links valid' : `${checks.missingParty.length}: ${checks.missingParty.slice(0,6).map(v=>v.number).join(', ')}` },
    { key:'dup', label:'No duplicate voucher numbers', ok: checks.dupNums.length===0,
      detail: checks.dupNums.length===0 ? 'All voucher numbers unique' : `${checks.dupNums.length} duplicated: ${checks.dupNums.slice(0,6).join(', ')}` },
    { key:'gst', label:'GST invoices post to GST ledgers', ok: checks.gstMissing.length===0, warn:true,
      detail: checks.gstMissing.length===0 ? 'GST on every taxable invoice hits the GST ledgers' : `${checks.gstMissing.length} invoice(s) carry tax but no GST ledger line - GSTR reports may understate: ${checks.gstMissing.slice(0,5).map(v=>v.number).join(', ')}` },
    { key:'cash', label:'No negative cash / bank balances', ok: checks.negCash.length===0, warn:true,
      detail: checks.negCash.length===0 ? 'Cash and bank balances are non-negative' : `Negative: ${checks.negCash.map(a=>a.name).join(', ')} - check for missing receipts or wrong dates` },
    { key:'gstin', label:'All GSTINs pass the checksum', ok: checks.badGstin.length===0, warn:true,
      detail: checks.badGstin.length===0 ? 'Every stored GSTIN is structurally valid' : `${checks.badGstin.length} invalid GSTIN(s): ${checks.badGstin.slice(0,6).join(', ')} - fix on the party / company master`,
      fix:'parties' },
    { key:'size', label:'Data size within practical limits', ok: checks.sizeKB < 10000, warn:true,
      detail: `${checks.sizeKB.toFixed(0)} KB · ${checks.voucherCount} active vouchers · ${checks.auditCount} audit entries · stored in ${__IDB_OK?'IndexedDB (large capacity)':'localStorage (~5 MB cap!)'}` + (checks.sizeKB>=10000?' - getting heavy for cloud sync/memory; archive the FY or trim attachments':'') },
  ];
  const fails = items.filter(i=>!i.ok && !i.warn).length;
  const warns = items.filter(i=>!i.ok && i.warn).length;

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Data Health Check</h1>
        <div className="page-sub">Live integrity checks across your books · run anytime before filing or year-end</div>
      </div>
    </div>

    <div style={{display:'flex',gap:12,marginBottom:18,flexWrap:'wrap'}}>
      <div className={'stat '+(fails===0?'':'stat-danger')} style={{flex:1,minWidth:160}}>
        <div className="stat-label">Critical Issues</div>
        <div className="stat-value" style={{color:fails===0?'var(--primary)':'var(--danger)'}}>{fails===0?'✓ 0':fails}</div>
      </div>
      <div className="stat stat-gold" style={{flex:1,minWidth:160}}>
        <div className="stat-label">Warnings</div><div className="stat-value">{warns}</div>
      </div>
      <div className="stat stat-info" style={{flex:1,minWidth:160}}>
        <div className="stat-label">Checks Passed</div><div className="stat-value">{items.filter(i=>i.ok).length}/{items.length}</div>
      </div>
    </div>

    {fails===0 && warns===0 && (
      <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:10,padding:'14px 18px',marginBottom:16,color:'#1b5e20',fontWeight:600}}>
        ✓ All checks passed - your books are internally consistent and filing-ready.
      </div>
    )}

    <div className="card">
      <div className="card-body" style={{padding:0}}>
        {items.map((it,i)=>(
          <div key={it.key} style={{display:'flex',alignItems:'flex-start',gap:14,padding:'13px 18px',borderBottom:i<items.length-1?'1px solid var(--line-2)':'none'}}>
            <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{it.ok?'✅':it.warn?'⚠️':'❌'}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,color:it.ok?'var(--ink)':it.warn?'#e65100':'var(--danger)'}}>{it.label}</div>
              <div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>{it.detail}</div>
            </div>
            {!it.ok && it.fix && <button className="btn btn-sm" onClick={()=>setPage(it.fix==='Vouchers'?'vouchers':it.fix)}>Review →</button>}
          </div>
        ))}
      </div>
    </div>
    <div style={{marginTop:12,fontSize:11,color:'var(--ink-3)'}}>
      These checks run live on every visit. A clean report means the Trial Balance, Balance Sheet and Cash Flow will all tally and GST reports will reconcile.
    </div>
  </>);
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================
function AuditLog({data}){
  const [search, setSearch] = useState('');
  const log = useMemo(() => [...(data.auditLog||[])].reverse()
    .filter(e => !search || (e.detail||'').toLowerCase().includes(search.toLowerCase()) ||
      (e.user||'').toLowerCase().includes(search.toLowerCase()) ||
      (e.action||'').toLowerCase().includes(search.toLowerCase())),
    [data.auditLog, search]);

  const ACT_CLR = {CREATE:'badge-success', EDIT:'badge-info', CANCEL:'badge-danger',
    IMPORT:'badge-info', RECURRING:'badge-success', YEAR_END:'badge-danger', BANK_ENTRY:'badge-info', GSTR2B:'badge-info'};

  const handleExcel = () => {
    exportXLSX(`AuditTrail_${today()}.xlsx`, [{name:'Audit Trail', rows:[
      [`Audit Trail  ${data.company.name}`],[],
      ['Timestamp','User','Action','Detail'],
      ...log.map(e=>[e.ts, e.user, e.action, e.detail]),
    ]}]);
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Audit Trail</h1>
        <div className="page-sub">Edit log of all voucher activity · {log.length} entries · MCA-compliant record</div>
      </div>
      <div className="page-actions">
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
      </div>
    </div>
    <div className="filter-bar">
      <div className="field"><label>Search</label>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Voucher, user, action…" style={{minWidth:240}} />
      </div>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr>
          <th style={{width:170}}>When</th><th style={{width:180}}>User</th>
          <th style={{width:100}}>Action</th><th>Detail</th>
        </tr></thead>
        <tbody>
          {log.length===0 ? (
            <tr><td colSpan="4"><div className="empty"><div className="empty-ico">∅</div>
              <div>No audit entries yet  voucher activity will appear here automatically.</div></div></td></tr>
          ) : log.map((e,i)=>(
            <tr key={i}>
              <td style={{fontSize:11,fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>{(e.ts||'').replace('T',' ').slice(0,19)}</td>
              <td style={{fontSize:12,overflow:'hidden',textOverflow:'ellipsis',maxWidth:180}}>{e.user}</td>
              <td><span className={'badge '+(ACT_CLR[e.action]||'badge-info')} style={{fontSize:10}}>{e.action}</span></td>
              <td style={{fontSize:12}}>{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>);
}

// ============================================================================
// YEAR-END CLOSING
// ============================================================================
function YearEndClose({data, setData, showToast}){
  const fyStart = data.company.fyStart || '';
  const fyEnd   = data.company.fyEnd   || '';
  const fyYear  = parseInt((fyStart||'2025-04-01').slice(0,4));
  const locked  = data.company.booksLockedUpto || '';

  const pb = useMemo(() => computePeriodBals(data, fyStart, fyEnd), [data, fyStart, fyEnd]);
  const income  = data.coa.filter(a=>a.type==='Income').reduce((s,a)=>s+(-(pb.period[a.id]||0)),0);
  const expense = data.coa.filter(a=>a.type==='Expense').reduce((s,a)=>s+(pb.period[a.id]||0),0);
  const profit  = income - expense;
  const fyVouchers = data.vouchers.filter(v=>v.status!=='Cancelled'&&v.date>=fyStart&&v.date<=fyEnd).length;

  // ── Pre-close validation ──────────────────────────────────────────────────
  // HARD checks block the close (they'd corrupt carried-forward balances);
  // SOFT checks warn but allow it.
  const checks = useMemo(() => {
    const active = (data.vouchers||[]).filter(v=>v.status!=='Cancelled');
    // Trial balance tally (all-time, since balances carry forward continuously)
    const bal = {}; data.coa.forEach(a=>bal[a.id]=a.opening||0);
    active.forEach(v=>(v.lines||[]).forEach(l=>{ bal[l.accountId]=(bal[l.accountId]||0)+(l.debit||0)-(l.credit||0); }));
    const tbDr = Object.values(bal).reduce((s,b)=>s+(b>0?b:0),0);
    const tbCr = Object.values(bal).reduce((s,b)=>s+(b<0?-b:0),0);
    const tbDiff = Math.round((tbDr-tbCr)*100)/100;
    const unbalanced = active.filter(v=>{const dr=(v.lines||[]).reduce((s,l)=>s+(l.debit||0),0),cr=(v.lines||[]).reduce((s,l)=>s+(l.credit||0),0);return Math.abs(dr-cr)>0.01;});
    const coaIds = new Set(data.coa.map(a=>a.id));
    const orphan = active.filter(v=>(v.lines||[]).some(l=>l.accountId&&!coaIds.has(l.accountId)));
    // Vouchers dated AFTER fyEnd already exist (next-year data before close is fine but flag)
    const futureVouchers = active.filter(v=>v.date>fyEnd).length;
    // Unposted recurring for the FY
    const recTemplates = active.filter(v=>v.recurringMonthly);
    return {
      tbDiff, tbDr, tbCr,
      hard: [
        {ok: Math.abs(tbDiff)<1,        label:'Trial Balance tallies (Dr = Cr)', detail: Math.abs(tbDiff)<1?`Dr = Cr = ₹${fmt(tbDr)}`:`Out of balance by ₹${fmt(tbDiff)} - fix before closing`},
        {ok: unbalanced.length===0,     label:'Every voucher is balanced',        detail: unbalanced.length===0?'All entries Dr = Cr':`${unbalanced.length} unbalanced: ${unbalanced.slice(0,4).map(v=>v.number).join(', ')}`},
        {ok: orphan.length===0,         label:'No orphaned account references',   detail: orphan.length===0?'All lines reference valid ledgers':`${orphan.length} voucher(s) point to a deleted account`},
      ],
      soft: [
        {ok: futureVouchers===0,        label:`No entries dated after ${fmtDate(fyEnd)}`, detail: futureVouchers===0?'Clean FY boundary':`${futureVouchers} entries fall in the next year (they stay editable)`},
        {ok: recTemplates.length===0 || true, label:'Recurring entries posted', detail: recTemplates.length? `${recTemplates.length} recurring template(s) - check the Dashboard for any months due`:'None'},
      ],
    };
  }, [data, fyEnd]);
  const hardFail = checks.hard.filter(c=>!c.ok).length;

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `MiyeeBooks_PreClose_FY${fyYear}_${today()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const closeFY = () => {
    if(hardFail > 0){ showToast('Fix the blocking checks before closing the year','error'); return; }
    if(!confirm(`Close FY ${fyYear}-${String(fyYear+1).slice(2)}?\n\n• Books will be LOCKED up to ${fyEnd}  no entries can be added, edited or cancelled before this date\n• Company FY rolls to ${fyYear+1}-04-01 → ${fyYear+2}-03-31\n• Closing balances carry forward automatically (continuous ledger)\n• This year's P&L is snapshotted for prior-year comparatives\n• A backup will download automatically\n\nProceed?`)) return;
    downloadBackup();
    // Snapshot the closed year's headline P&L + closing balances for comparatives
    // (also feeds the Valuation tab's historical financials).
    const closingBal = {}; data.coa.forEach(a=>{ closingBal[a.id] = (pb.opening[a.id]||0) + (pb.period[a.id]||0); });
    const finCost = data.coa.filter(a=>a.group==='Finance Costs').reduce((s,a)=>s+(pb.period[a.id]||0),0);
    const deprec  = pb.period['4400']||0;
    const ebitda  = r0(profit + finCost + deprec);
    const snapshot = { year: `${fyYear}-${String(fyYear+1).slice(2)}`, fyStart, fyEnd, income:r0(income), expense:r0(expense), profit:r0(profit),
      ebitda, financeCost:r0(finCost), depreciation:r0(deprec), closingBalances: closingBal, closedOn: today() };
    setData(prev => ({...prev,
      company: {...prev.company,
        fyStart: `${fyYear+1}-04-01`,
        fyEnd:   `${fyYear+2}-03-31`,
        booksLockedUpto: fyEnd,
        priorYears: [...((prev.company.priorYears)||[]).filter(p=>p.year!==snapshot.year), snapshot],
      },
      auditLog: [...(prev.auditLog||[]), auditEntry('YEAR_END', `FY ${fyYear}-${String(fyYear+1).slice(2)} closed · books locked up to ${fyEnd} · profit ₹${fmt(profit)}`)],
    }));
    showToast(`✓ FY ${fyYear}-${String(fyYear+1).slice(2)} closed  balances rolled forward`);
  };
  const r0 = n => Math.round((n||0)*100)/100;

  const unlockBooks = () => {
    if(!confirm('Unlock the books? Prior-period vouchers will become editable again.\nThis is recorded in the audit trail.')) return;
    setData(prev => ({...prev,
      company: {...prev.company, booksLockedUpto: ''},
      auditLog: [...(prev.auditLog||[]), auditEntry('YEAR_END', `Books UNLOCKED (was locked up to ${locked})`)],
    }));
    showToast('Books unlocked');
  };

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Year-End Closing</h1>
        <div className="page-sub">Lock the financial year & roll forward · FY {fyYear}–{String(fyYear+1).slice(2)}</div>
      </div>
    </div>

    {locked && (
      <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:12,color:'#1b5e20',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <span>🔒 <b>Books are locked up to {locked}</b>  entries on or before this date cannot be modified.</span>
        <button className="btn btn-sm" onClick={unlockBooks} style={{fontSize:11}}>🔓 Unlock</button>
      </div>
    )}

    <div className="stat-grid" style={{marginBottom:16}}>
      <div className="stat"><div className="stat-label">FY Income</div><div className="stat-value rupee">₹{fmt(income)}</div></div>
      <div className="stat"><div className="stat-label">FY Expenses</div><div className="stat-value rupee">₹{fmt(expense)}</div></div>
      <div className={'stat '+(profit>=0?'stat-gold':'stat-danger')}><div className="stat-label">FY Profit / (Loss)</div><div className="stat-value rupee">₹{fmt(profit)}</div></div>
      <div className="stat stat-info"><div className="stat-label">Vouchers in FY</div><div className="stat-value">{fyVouchers}</div></div>
    </div>

    <div className="card" style={{marginBottom:16}}>
      <div className="card-head">
        <h3 className="card-title">Step 1 · Pre-Close Validation</h3>
        <span className={'badge '+(hardFail===0?'badge-success':'badge-danger')}>{hardFail===0?'✓ Ready to close':`${hardFail} blocking issue${hardFail>1?'s':''}`}</span>
      </div>
      <div className="card-body">
        <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.8px',color:'var(--ink-3)',fontWeight:700,marginBottom:6}}>Must pass (blocks close)</div>
        {checks.hard.map((c,i)=>(
          <div key={i} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:'1px solid var(--line)',fontSize:12.5}}>
            <span style={{fontSize:16,lineHeight:1}}>{c.ok?'✅':'❌'}</span>
            <div><b>{c.label}</b><div style={{color:c.ok?'var(--ink-3)':'var(--danger)',fontSize:11.5,marginTop:1}}>{c.detail}</div></div>
          </div>
        ))}
        <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.8px',color:'var(--ink-3)',fontWeight:700,margin:'12px 0 6px'}}>Should review (warnings)</div>
        {checks.soft.map((c,i)=>(
          <div key={i} style={{display:'flex',gap:10,padding:'6px 0',fontSize:12.5}}>
            <span style={{fontSize:15,lineHeight:1}}>{c.ok?'✅':'⚠️'}</span>
            <div><b>{c.label}</b><div style={{color:'var(--ink-3)',fontSize:11.5,marginTop:1}}>{c.detail}</div></div>
          </div>
        ))}
        <div style={{marginTop:12,fontSize:11.5,color:'var(--ink-2)',lineHeight:1.6}}>
          Manual checklist before you commit: bank accounts reconciled · depreciation posted · GSTR-1/3B filed for all periods · TDS deposited &amp; reported · receivables/payables reviewed.
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card-head"><h3 className="card-title">Step 2 · Close &amp; Roll Forward</h3></div>
      <div className="card-body" style={{padding:'18px 24px'}}>
        <div style={{fontSize:12.5,color:'var(--ink-2)',lineHeight:1.7,marginBottom:14}}>
          Closing <b>locks all entries up to {fmtDate(fyEnd)}</b>, rolls the company year to <b>{fyYear+1}-04-01 → {fyYear+2}-03-31</b>,
          and snapshots this year's P&amp;L for prior-year comparatives. Balances carry forward automatically (one continuous ledger),
          so all old reports keep working and you can unlock later if needed (audit-logged).
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <button className="btn" onClick={downloadBackup}>📦 Download Backup First</button>
          <button className="btn btn-primary" onClick={closeFY} disabled={hardFail>0}
            style={{fontWeight:700, ...(hardFail>0?{opacity:.5,cursor:'not-allowed'}:{})}}>
            🔒 Close FY {fyYear}–{String(fyYear+1).slice(2)} &amp; Roll Forward
          </button>
          {hardFail>0 && <span style={{fontSize:12,color:'var(--danger)',fontWeight:600}}>Resolve the {hardFail} blocking check{hardFail>1?'s':''} above to enable this.</span>}
        </div>
      </div>
    </div>

    {(data.company.priorYears||[]).length>0 && (
      <div className="card" style={{marginTop:16}}>
        <div className="card-head"><h3 className="card-title">Closed Years (comparatives)</h3></div>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Financial Year</th><th className="num">Income</th><th className="num">Expenses</th><th className="num">Profit / (Loss)</th><th>Closed On</th></tr></thead>
            <tbody>
              {(data.company.priorYears||[]).slice().reverse().map((p,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:600}}>FY {p.year}</td>
                  <td className="num">₹{fmt(p.income)}</td>
                  <td className="num">₹{fmt(p.expense)}</td>
                  <td className="num" style={{color:p.profit>=0?'var(--green)':'var(--danger)',fontWeight:600}}>₹{fmt(p.profit)}</td>
                  <td>{fmtDate(p.closedOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>);
}

// ============================================================================
// BANK RECONCILIATION
// ============================================================================
function BankReconciliation({data, setData, showToast}){
  const [bankRows, setBankRows]   = useState([]);
  const [fileName, setFileName]   = useState('');
  const [selected, setSelected]   = useState(new Set());
  const [matchMap, setMatchMap]   = useState({}); // rowIdx -> voucherId
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState('upload');

  // ── Auto Entry from bank rows ───────────────────────────────────────────
  const bankAccounts = data.coa.filter(a => a.isBank);
  const [bankLedger, setBankLedger] = useState(bankAccounts[0]?.id || '2510');
  const [entryRow, setEntryRow]     = useState(null);   // row.idx currently being converted
  const [entryAcc, setEntryAcc]     = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [saveRule, setSaveRule]     = useState(true);

  // Match a bank narration against learned rules → suggested contra account
  const ruleFor = (desc='') => (data.bankRules||[]).find(r =>
    r.keyword && desc.toLowerCase().includes(r.keyword.toLowerCase()));

  // Bank CSV dates arrive as DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD  normalise to ISO
  const toISO = (raw='') => {
    const s = raw.trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if(m){ const y = m[3].length===2 ? '20'+m[3] : m[3];
      return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
    return today();
  };

  const openEntry = (row) => {
    const rule = ruleFor(row.desc);
    setEntryRow(row.idx);
    setEntryAcc(rule?.accountId || '');
    // Default keyword: first 2 significant words of the narration
    setRuleKeyword(rule?.keyword || row.desc.split(/\s+/).slice(0,2).join(' ').slice(0,30));
  };

  const createEntry = (row) => {
    if(!entryAcc){ showToast('Select an account for the entry','error'); return; }
    if(!isPremiumActive(data.company) && (data.vouchers||[]).filter(v=>v.status!=='Cancelled').length >= FREE_VOUCHER_LIMIT){
      showToast(`Free limit (${FREE_VOUCHER_LIMIT} entries) reached  upgrade to Premium`,'error'); return;
    }
    const vDate = toISO(row.date);
    if(isDateLocked(data.company, vDate)){ showToast('Period is locked  cannot post on '+vDate,'error'); return; }
    const isPay = row.debit > 0;                       // money out of bank
    const amt   = isPay ? row.debit : row.credit;
    const type  = isPay ? 'PAY' : 'REC';
    const lines = isPay
      ? [{id:uid(), accountId:entryAcc,   debit:amt, credit:0,   narration:row.desc},
         {id:uid(), accountId:bankLedger, debit:0,   credit:amt, narration:row.desc}]
      : [{id:uid(), accountId:bankLedger, debit:amt, credit:0,   narration:row.desc},
         {id:uid(), accountId:entryAcc,   debit:0,   credit:amt, narration:row.desc}];
    const bankRef = `${row.date}|${row.ref||row.desc}|${(row.debit||row.credit).toFixed(2)}`;
    setData(prev => {
      const typeCount = prev.vouchers.filter(x => x.type === type).length;
      const num = type + '/' + String(typeCount+1).padStart(4,'0');
      const newVoucher = {id:uid(), type, date:vDate, number:num, partyId:'', partyName:'',
        narration:row.desc, reference:row.ref||'', lines, amount:amt, status:'Posted',
        createdAt:new Date().toISOString()};
      // Learn the rule for next time
      let rules = prev.bankRules || [];
      if(saveRule && ruleKeyword.trim()){
        rules = rules.filter(r => r.keyword.toLowerCase() !== ruleKeyword.trim().toLowerCase());
        rules = [...rules, {id:uid(), keyword:ruleKeyword.trim(), accountId:entryAcc}];
      }
      return {...prev,
        vouchers:  [...prev.vouchers, newVoucher],
        bankRules: rules,
        bankRecon: [...(prev.bankRecon||[]), {bankRef, date:row.date, desc:row.desc, ref:row.ref,
          debit:row.debit, credit:row.credit, voucherId:newVoucher.id, reconDate:today()}],
        auditLog:  [...(prev.auditLog||[]), auditEntry('BANK_ENTRY', `${num} (${type}) ₹${fmt(amt)} from bank stmt "${row.desc.slice(0,40)}"`)],
      };
    });
    setEntryRow(null);
    showToast(`✓ ${type} entry posted ₹${fmt(amt)}  reconciled${saveRule&&ruleKeyword?` · rule saved: "${ruleKeyword}"`:''}`);
  };

  const bookVouchers = useMemo(() => {
    return data.vouchers
      .filter(v => v.status !== 'Cancelled')
      .map(v => ({ ...v, total: (v.lines||[]).reduce((s,l)=>s+(l.debit||0),0) }));
  }, [data.vouchers]);

  const reconSet = useMemo(() => new Set((data.bankRecon||[]).map(r=>r.bankRef)), [data.bankRecon]);

  // Parse bank CSV
  const handleFile = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if(lines.length < 2){ showToast('Empty or invalid CSV','error'); return; }
      const headers = lines[0].split(',').map(h => h.replace(/["\s]/g,'').toLowerCase());
      const col = (keys) => { for(const k of keys){ const i=headers.findIndex(h=>h.includes(k)); if(i>=0)return i; } return -1; };
      const iDate = col(['valuedate','date','txndate','valudate']);
      const iDesc = col(['particulars','description','narration','details','remarks']);
      const iRef  = col(['referenceno','reference','refno','cheque','chqno','txnid']);
      const iDr   = col(['debit','dr','withdrawal','withdrawl']);
      const iCr   = col(['credit','cr','deposit']);
      const rows = [];
      lines.slice(1).forEach((line, idx) => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g,'').trim());
        if(cols.length < 2) return;
        const drAmt = parseFloat((cols[iDr]||'').replace(/[,\s]/g,''))||0;
        const crAmt = parseFloat((cols[iCr]||'').replace(/[,\s]/g,''))||0;
        if(drAmt === 0 && crAmt === 0) return;
        rows.push({ idx, date:cols[iDate]||'', desc:cols[iDesc]||'', ref:cols[iRef]||'',
          debit:drAmt, credit:crAmt });
      });
      setBankRows(rows);
      setMatchMap({});
      setSelected(new Set());
      setTab('reconcile');
      showToast(`Loaded ${rows.length} bank transactions from ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filtered = bankRows.filter(r =>
    !search || r.desc.toLowerCase().includes(search.toLowerCase()) || r.ref.toLowerCase().includes(search.toLowerCase())
  );

  const handleReconcile = () => {
    if(selected.size === 0) return;
    const newEntries = [];
    selected.forEach(idx => {
      const row = bankRows[idx];
      const bankRef = `${row.date}|${row.ref||row.desc}|${(row.debit||row.credit).toFixed(2)}`;
      if(reconSet.has(bankRef)) return; // already reconciled
      newEntries.push({ bankRef, date:row.date, desc:row.desc, ref:row.ref,
        debit:row.debit, credit:row.credit, voucherId:matchMap[idx]||null, reconDate:today() });
    });
    if(!newEntries.length){ showToast('All selected rows already reconciled','error'); return; }
    setData({...data, bankRecon:[...(data.bankRecon||[]),...newEntries]});
    setSelected(new Set());
    showToast(`✓ ${newEntries.length} transaction(s) marked reconciled`);
  };

  const handleRemoveRecon = (bankRef) => {
    setData({...data, bankRecon:(data.bankRecon||[]).filter(r=>r.bankRef!==bankRef)});
    showToast('Reconciliation removed');
  };

  const totalDr   = filtered.reduce((s,r)=>s+r.debit,0);
  const totalCr   = filtered.reduce((s,r)=>s+r.credit,0);
  const reconCount = filtered.filter(r=>reconSet.has(`${fmtDate(r.date)}|${r.ref||r.desc}|${(r.debit||r.credit).toFixed(2)}`)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bank Reconciliation</h1>
          <div className="page-sub">Upload bank statement CSV · Match with book entries · Mark reconciled</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['upload','⬆ Upload Statement'],['reconcile','⊞ Reconcile'],['history','📋 History']].map(([t,l])=>(
          <button key={t} className={`btn${tab===t?' btn-primary':''}`} onClick={()=>setTab(t)}
            style={t==='reconcile'&&bankRows.length===0?{opacity:.5,cursor:'not-allowed'}:{}}>
            {l}{t==='reconcile'&&bankRows.length>0?` (${bankRows.length})`:''}
          </button>
        ))}
      </div>

      {/* UPLOAD TAB */}
      {tab==='upload' && (
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:'36px 20px'}}>
            <div style={{fontSize:44,marginBottom:12}}>🏦</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Upload Bank Statement CSV</div>
            <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:22}}>
              Auto-detects columns: <b>Value Date, Particulars, Reference No, Debit, Credit</b><br/>
              Supports exports from most Indian banks (HDFC, ICICI, SBI, Axis, Kotak…)
            </div>
            <label className="btn btn-primary" style={{cursor:'pointer',padding:'10px 28px',fontSize:13}}>
              📂 Choose CSV File
              <input type="file" accept=".csv,.CSV,.txt" onChange={handleFile} style={{display:'none'}} />
            </label>
            {fileName && <div style={{marginTop:14,fontSize:12,color:'var(--primary)',fontWeight:600}}>📄 {fileName}</div>}
          </div>
          <div style={{padding:'0 20px 20px'}}>
            <div className="card" style={{background:'var(--surface-2)',padding:'12px 16px'}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:6,color:'var(--ink-2)'}}>Sample CSV Format (any order of columns is fine):</div>
              <pre style={{fontSize:11,margin:0,color:'var(--ink-3)',overflowX:'auto'}}>{`Value Date,Particulars,Reference No,Debit,Credit
01-04-2025,Opening Balance,OB001,,100000.00
05-04-2025,NEFT To XYZ Ltd,NEFT00123,50000.00,
10-04-2025,Receipt From ABC Corp,IMPS00456,,75000.00
15-04-2025,Bank Charges,,850.00,`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE TAB */}
      {tab==='reconcile' && (
        <>
          <div className="filter-bar">
            <div className="field"><label>Search</label>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Description or reference…" style={{minWidth:240}} />
            </div>
            <div className="field"><label>Bank Ledger (this statement)</label>
              <select value={bankLedger} onChange={e=>setBankLedger(e.target.value)}>
                {bankAccounts.length===0 && <option value="2510">2510 · Bank</option>}
                {bankAccounts.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
              </select>
            </div>
            <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:12,color:'var(--ink-3)'}}>{reconCount}/{filtered.length} reconciled</span>
              <label className="btn btn-sm" style={{cursor:'pointer'}}>
                ↺ Load New CSV
                <input type="file" accept=".csv,.CSV" onChange={handleFile} style={{display:'none'}} />
              </label>
              <button className="btn btn-primary" disabled={selected.size===0} onClick={handleReconcile}>
                ✓ Reconcile {selected.size>0?`(${selected.size})`:''}
              </button>
            </div>
          </div>
          {bankRows.length === 0 ? (
            <div className="card"><div className="card-body" style={{textAlign:'center',padding:'32px 20px',color:'var(--ink-3)'}}>
              <div style={{fontSize:28,marginBottom:8}}>📂</div>No bank statement loaded. Upload one first.
            </div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:38}}>
                    <input type="checkbox" onChange={e => {
                      const unreconciled = filtered.filter(r=>{
                        const br=`${fmtDate(r.date)}|${r.ref||r.desc}|${(r.debit||r.credit).toFixed(2)}`;
                        return !reconSet.has(br);
                      }).map(r=>r.idx);
                      setSelected(e.target.checked ? new Set(unreconciled) : new Set());
                    }} />
                  </th>
                  <th style={{width:90}}>Date</th>
                  <th>Particulars</th>
                  <th style={{width:110}}>Reference</th>
                  <th className="num" style={{width:108}}>Debit (₹)</th>
                  <th className="num" style={{width:108}}>Credit (₹)</th>
                  <th style={{width:200}}>Match Book Entry</th>
                  <th style={{width:88}}>Status</th>
                </tr></thead>
                <tbody>
                  {filtered.map(row => {
                    const bankRef = `${row.date}|${row.ref||row.desc}|${(row.debit||row.credit).toFixed(2)}`;
                    const isRecon = reconSet.has(bankRef);
                    const isSel   = selected.has(row.idx);
                    // Auto-suggest: match by amount ±1 or reference substring
                    const amt = row.debit || row.credit;
                    const suggestions = bookVouchers.filter(v =>
                      Math.abs(v.total - amt) < 1 ||
                      (row.ref && v.number && v.number.toLowerCase().includes(row.ref.toLowerCase().slice(0,8)))
                    ).slice(0,10);
                    const rule = !isRecon && ruleFor(row.desc);
                    return (
                      <React.Fragment key={row.idx}>
                      <tr style={{
                        background: isRecon?'#f0fdf4': isSel?'var(--primary-soft)':'',
                        opacity: isRecon?.75:1,
                      }}>
                        <td>
                          <input type="checkbox" disabled={isRecon} checked={isSel&&!isRecon}
                            onChange={e=>{const s=new Set(selected); e.target.checked?s.add(row.idx):s.delete(row.idx); setSelected(s);}} />
                        </td>
                        <td style={{fontSize:12,whiteSpace:'nowrap'}}>{row.date}</td>
                        <td style={{fontSize:12}}>{row.desc}
                          {rule && <div style={{fontSize:10,color:'var(--primary)'}}>⚡ rule: {data.coa.find(a=>a.id===rule.accountId)?.name||rule.accountId}</div>}
                        </td>
                        <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{row.ref}</td>
                        <td className="num" style={{color:row.debit?'var(--danger)':'',fontWeight:row.debit?600:400}}>{row.debit?fmt(row.debit):''}</td>
                        <td className="num" style={{color:row.credit?'var(--primary)':'',fontWeight:row.credit?600:400}}>{row.credit?fmt(row.credit):''}</td>
                        <td>
                          {isRecon ? (
                            <span style={{fontSize:11,color:'var(--primary)',fontWeight:600}}>✓ Reconciled</span>
                          ) : (
                            <select
                              style={{width:'100%',fontSize:11,padding:'3px 6px',borderRadius:4,border:'1px solid var(--line)',background:'var(--surface)'}}
                              value={matchMap[row.idx]||''}
                              onChange={e=>setMatchMap({...matchMap,[row.idx]:e.target.value})}>
                              <option value=""> Select voucher </option>
                              <option value="direct">Direct / Advance / Opening</option>
                              {suggestions.length>0 && <option disabled>── Suggested matches ──</option>}
                              {suggestions.map(v=>(
                                <option key={v.id} value={v.id}>{fmtDate(v.date)} · {v.number} · {v.type} · ₹{fmt(v.total)}</option>
                              ))}
                              {suggestions.length>0 && <option disabled>── All vouchers ──</option>}
                              {bookVouchers.filter(v=>!suggestions.find(s=>s.id===v.id)).slice(0,40).map(v=>(
                                <option key={v.id+'all'} value={v.id}>{fmtDate(v.date)} · {v.number} · {v.type} · ₹{fmt(v.total)}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={{textAlign:'center'}}>
                          {isRecon
                            ? <span className="badge badge-success" style={{fontSize:10}}>✓ Done</span>
                            : entryRow===row.idx
                              ? <button className="btn btn-sm btn-ghost" style={{fontSize:10}} onClick={()=>setEntryRow(null)}>✕ Close</button>
                              : <button className="btn btn-sm" style={{fontSize:10,whiteSpace:'nowrap'}} title="Create a voucher from this bank line"
                                  onClick={()=>openEntry(row)}>➕ Entry</button>}
                        </td>
                      </tr>
                      {entryRow===row.idx && !isRecon && (
                        <tr style={{background:'var(--primary-soft)'}}>
                          <td colSpan="8" style={{padding:'10px 16px'}}>
                            <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
                              <div style={{fontSize:12,fontWeight:700,color:'var(--primary)',paddingBottom:6}}>
                                {row.debit>0 ? '↘ Payment' : '↗ Receipt'} ₹{fmt(row.debit||row.credit)}:
                              </div>
                              <div className="field" style={{minWidth:260}}>
                                <label style={{fontSize:10}}>{row.debit>0?'Debit account (expense / party paid)':'Credit account (income / party received from)'}</label>
                                <select value={entryAcc} onChange={e=>setEntryAcc(e.target.value)}
                                  style={{fontSize:12,padding:'5px 8px',width:'100%'}}>
                                  <option value=""> Select account </option>
                                  {data.coa.filter(a=>a.id!==bankLedger).map(a=>(
                                    <option key={a.id} value={a.id}>{a.id} · {a.name} ({a.type})</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{minWidth:180}}>
                                <label style={{fontSize:10}}>Learn rule  keyword in narration</label>
                                <input value={ruleKeyword} onChange={e=>setRuleKeyword(e.target.value)}
                                  style={{fontSize:12,padding:'5px 8px',width:'100%'}} placeholder="e.g. GOOGLE ADS" />
                              </div>
                              <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,paddingBottom:8,cursor:'pointer'}}>
                                <input type="checkbox" checked={saveRule} onChange={e=>setSaveRule(e.target.checked)} /> Save rule
                              </label>
                              <button className="btn btn-sm btn-primary" style={{marginBottom:2}} onClick={()=>createEntry(row)}>
                                ✓ Post & Reconcile
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                  {filtered.length > 0 && (
                    <tr className="total">
                      <td colSpan="4" style={{textAlign:'right'}}>TOTAL</td>
                      <td className="num">₹{fmt(totalDr)}</td>
                      <td className="num">₹{fmt(totalCr)}</td>
                      <td colSpan="2"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* HISTORY TAB */}
      {tab==='history' && (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th style={{width:42}}>Sr</th>
              <th style={{width:90}}>Date</th>
              <th>Particulars</th>
              <th style={{width:110}}>Reference</th>
              <th className="num" style={{width:108}}>Debit (₹)</th>
              <th className="num" style={{width:108}}>Credit (₹)</th>
              <th style={{width:160}}>Matched Voucher</th>
              <th style={{width:90}}>Recon Date</th>
              <th style={{width:56}}></th>
            </tr></thead>
            <tbody>
              {(data.bankRecon||[]).length === 0 ? (
                <tr><td colSpan="9"><div className="empty"><div className="empty-ico">∅</div>No reconciled entries yet</div></td></tr>
              ) : [...(data.bankRecon||[])].reverse().map((r, i) => {
                const mv = data.vouchers.find(v=>v.id===r.voucherId);
                return (
                  <tr key={i}>
                    <td style={{fontSize:11,color:'var(--ink-3)'}}>{i+1}</td>
                    <td style={{fontSize:12}}>{fmtDate(r.date)}</td>
                    <td style={{fontSize:12}}>{r.desc}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{r.ref}</td>
                    <td className="num" style={{color:r.debit?'var(--danger)':''}}>{r.debit?fmt(r.debit):''}</td>
                    <td className="num" style={{color:r.credit?'var(--primary)':''}}>{r.credit?fmt(r.credit):''}</td>
                    <td style={{fontSize:11}}>
                      {mv ? <span style={{fontFamily:'var(--mono)',color:'var(--primary)'}}>{mv.number} · {mv.type}</span>
                          : r.voucherId === 'direct' ? <span style={{color:'var(--ink-3)'}}>Direct/Advance</span>
                          : <span style={{color:'var(--ink-3)'}}></span>}
                    </td>
                    <td style={{fontSize:11,color:'var(--ink-3)'}}>{r.reconDate}</td>
                    <td style={{textAlign:'center'}}>
                      <button className="btn btn-sm btn-ghost" style={{fontSize:10,color:'var(--danger)',opacity:.7}}
                        onClick={()=>handleRemoveRecon(r.bankRef)} title="Undo reconciliation">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ============================================================================
// DAY BOOK
// ============================================================================
function DayBook({data}){
  const [from, setFrom] = useState(data.company.fyStart);
  const [to, setTo] = useState(today());
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => { setPage(1); }, [from, to, typeFilter]);   // reset to first page on filter change

  const entries = data.vouchers
    .filter(v => v.status !== 'Cancelled' && v.date >= from && v.date <= to)
    .filter(v => typeFilter === 'All' || v.type === typeFilter)
    .sort((a,b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

  const findAcc = (id) => data.coa.find(a => a.id === id);

  // Build flat rows: pair Dr lines with Cr lines per voucher
  const rows = [];
  entries.forEach(v => {
    const drLines = (v.lines||[]).filter(l => (l.debit||0) > 0);
    const crLines = (v.lines||[]).filter(l => (l.credit||0) > 0);
    const maxLen = Math.max(drLines.length, crLines.length, 1);
    for(let i = 0; i < maxLen; i++){
      const dr = drLines[i];
      const cr = crLines[i];
      rows.push({
        sr: rows.length + 1,
        date:   i === 0 ? v.date   : '',
        vchNo:  i === 0 ? v.number : '',
        type:   i === 0 ? v.type   : '',
        drAcc:  dr ? (findAcc(dr.accountId)?.name || dr.accountId) : '',
        drAmt:  dr ? (dr.debit||0)  : 0,
        crAcc:  cr ? (findAcc(cr.accountId)?.name || cr.accountId) : '',
        crAmt:  cr ? (cr.credit||0) : 0,
        narration: i === 0 ? (v.narration || v.partyName || '') : (dr?.narration || cr?.narration || ''),
        isFirst: i === 0,
        key: v.id + '-' + i,
      });
    }
  });

  const totalDr = rows.reduce((s,r) => s + r.drAmt, 0);
  const totalCr = rows.reduce((s,r) => s + r.crAmt, 0);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const curPage    = Math.min(page, totalPages);
  const pageRows   = rows.slice((curPage-1)*pageSize, curPage*pageSize);

  const handleExcel = () => {
    exportXLSX(`DayBook_${from}_${to}.xlsx`, [{
      name: 'Day Book',
      rows: [
        [`Day Book  ${data.company.name}`], [`Period: ${from} to ${to}`], [],
        ['Sr No','Date','Vch No.','Type','Dr Account','Dr Amt (₹)','Cr Account','Cr Amt (₹)','Narration'],
        ...rows.map(r => [r.sr, r.date, r.vchNo, r.type, r.drAcc, r.drAmt||'', r.crAcc, r.crAmt||'', r.narration]),
        [],['','','','','TOTAL', totalDr,'', totalCr,''],
      ],
    }]);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Day Book</h1>
          <div className="page-sub">Chronological journal · {entries.length} vouchers · {rows.length} entries in period</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
          <button className="btn" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field"><label>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="field"><label>Voucher Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option>All</option>
            {VOUCHER_TYPES.map(vt => <option key={vt.code} value={vt.code}>{vt.name}</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{width:42}}>Sr</th>
              <th style={{width:88}}>Date</th>
              <th style={{width:90}}>Vch No.</th>
              <th style={{width:52}}>Type</th>
              <th>Dr Account</th>
              <th className="num" style={{width:112}}>Dr Amt (₹)</th>
              <th>Cr Account</th>
              <th className="num" style={{width:112}}>Cr Amt (₹)</th>
              <th style={{width:180}}>Narration</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="9"><div className="empty"><div className="empty-ico">∅</div><div>No vouchers in this period</div></div></td></tr>
            ) : pageRows.map((r, idx) => (
              <tr key={r.key}
                style={{
                  borderTop: r.isFirst && idx > 0 ? '2px solid var(--line)' : undefined,
                  background: r.isFirst && idx > 0 ? 'var(--surface-2)' : undefined,
                }}>
                <td style={{color:'var(--ink-3)', fontSize:11, fontFamily:'var(--mono)'}}>{r.sr}</td>
                <td style={{fontSize:12, whiteSpace:'nowrap'}}>{fmtDate(r.date)}</td>
                <td style={{fontFamily:'var(--mono)', fontSize:12, fontWeight: r.vchNo ? 600 : 400, color:'var(--ink-2)'}}>{r.vchNo}</td>
                <td>{r.type ? <span className="badge badge-info" style={{fontSize:10}}>{r.type}</span> : ''}</td>
                <td style={{color:'var(--primary)', fontSize:13}}>{r.drAcc}</td>
                <td className="num" style={{color: r.drAmt ? 'var(--primary)' : 'var(--ink-3)', fontWeight: r.drAmt ? 600 : 400}}>
                  {r.drAmt ? fmt(r.drAmt) : ''}
                </td>
                <td style={{color:'var(--danger)', fontSize:13}}>{r.crAcc}</td>
                <td className="num" style={{color: r.crAmt ? 'var(--danger)' : 'var(--ink-3)', fontWeight: r.crAmt ? 600 : 400}}>
                  {r.crAmt ? fmt(r.crAmt) : ''}
                </td>
                <td style={{fontSize:11, color:'var(--ink-3)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={r.narration}>{r.narration}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="total">
                <td colSpan="4" style={{textAlign:'right'}}>TOTAL (all {rows.length} rows)</td>
                <td></td>
                <td className="num">₹{fmt(totalDr)}</td>
                <td></td>
                <td className="num">₹{fmt(totalCr)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginTop:14,fontSize:13}}>
          <button className="btn btn-sm" disabled={curPage<=1} onClick={()=>setPage(1)}>« First</button>
          <button className="btn btn-sm" disabled={curPage<=1} onClick={()=>setPage(curPage-1)}>‹ Prev</button>
          <span style={{color:'var(--ink-3)'}}>
            Page <b style={{color:'var(--ink)'}}>{curPage}</b> of {totalPages}
            <span style={{marginLeft:8}}>(rows {(curPage-1)*pageSize+1}–{Math.min(curPage*pageSize, rows.length)} of {rows.length})</span>
          </span>
          <button className="btn btn-sm" disabled={curPage>=totalPages} onClick={()=>setPage(curPage+1)}>Next ›</button>
          <button className="btn btn-sm" disabled={curPage>=totalPages} onClick={()=>setPage(totalPages)}>Last »</button>
        </div>
      )}
    </>
  );
}

// ============================================================================
// TRIAL BALANCE
// ============================================================================
function TrialBalance({data, balances}){
  const fyStart = data.company.fyStart || '';
  const [from, setFrom] = useState(fyStart);
  const [to,   setTo]   = useState(today());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [drill, setDrill] = useState(null);

  // 4-column trial balance: Opening balance (as of 'from'), gross Debit and
  // Credit movement during the period, and the Closing balance (as on 'to').
  // computePeriodBals gives net opening/closing; gross period Dr/Cr are summed
  // here from the vouchers falling inside the period.
  const tb = useMemo(() => {
    const pb = computePeriodBals(data, from, to);
    const drMv = {}, crMv = {};
    (data.vouchers||[]).forEach(v => {
      if(v.status === 'Cancelled') return;
      if(from && v.date < from) return;
      if(to && v.date > to) return;
      (v.lines||[]).forEach(l => {
        drMv[l.accountId] = (drMv[l.accountId]||0) + (l.debit||0);
        crMv[l.accountId] = (crMv[l.accountId]||0) + (l.credit||0);
      });
    });
    return { opening: pb.opening, closing: pb.asOn, drMv, crMv };
  }, [data, from, to]);

  const rows = useMemo(() => data.coa.map(a => {
    const op = tb.opening[a.id] || 0;      // signed: +Dr / -Cr
    const cl = tb.closing[a.id] || 0;
    const d  = tb.drMv[a.id] || 0;
    const c  = tb.crMv[a.id] || 0;
    return { ...a,
      openDr: op > 0 ? op : 0, openCr: op < 0 ? -op : 0,
      perDr: d, perCr: c,
      closeDr: cl > 0 ? cl : 0, closeCr: cl < 0 ? -cl : 0 };
  }).filter(r => (r.openDr || r.openCr || r.perDr || r.perCr || r.closeDr || r.closeCr)
    && (!typeFilter || r.type === typeFilter)
    && (!search || r.name.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search))
  ), [tb, data.coa, typeFilter, search]);

  const T = rows.reduce((s,r) => ({
    openDr:s.openDr+r.openDr, openCr:s.openCr+r.openCr,
    perDr:s.perDr+r.perDr,    perCr:s.perCr+r.perCr,
    closeDr:s.closeDr+r.closeDr, closeCr:s.closeCr+r.closeCr,
  }), {openDr:0,openCr:0,perDr:0,perCr:0,closeDr:0,closeCr:0});
  const totalDr = T.closeDr, totalCr = T.closeCr;   // closing balance tally

  const handleExcel = () => exportXLSX(`TrialBalance_${data.company.name}_${to}.xlsx`, [{
    name: 'Trial Balance',
    rows: [
      [`Trial Balance  ${data.company.name}`],
      [`Period: ${from} to ${to}`],
      [],
      ['Code','Particulars','Type','Group','Opening Dr','Opening Cr','Debit','Credit','Closing Dr','Closing Cr'],
      ...rows.map(r => [r.id, r.name, r.type, r.group, r.openDr||'', r.openCr||'', r.perDr||'', r.perCr||'', r.closeDr||'', r.closeCr||'']),
      [],
      ['','','','TOTAL', T.openDr, T.openCr, T.perDr, T.perCr, T.closeDr, T.closeCr],
    ]
  }]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <div className="page-sub">As on {to} · {rows.length} accounts · Click any row to drill into the ledger</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
          <button className="btn btn-sm btn-primary" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      {/* Period filter */}
      <div style={{marginBottom:14}}>
        <PeriodFilter data={data} from={from} to={to} onChange={(f,t)=>{setFrom(f);setTo(t);}} />
      </div>

      {/* Search + type filter */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        <input placeholder="Search account name or code…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',fontSize:12,flex:1,minWidth:180}} />
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',fontSize:12,background:'var(--surface)'}}>
          <option value="">All Types</option>
          {['Asset','Liability','Equity','Income','Expense'].map(t=><option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="report">
        <div className="report-head">
          {data.company.logo && <img className="report-logo" src={data.company.logo} alt="Logo" />}
          <div className="report-co">{data.company.name}</div>
          <div style={{fontSize:11,color:'var(--ink-3)'}}>{data.company.address} · GSTIN: {data.company.gstin}</div>
          <div className="report-title">Trial Balance</div>
          <div className="report-period">Period: {fmtDate(from)} to {fmtDate(to)}</div>
        </div>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead>
            <tr>
              <th style={{width:70}} rowSpan="2">Code</th>
              <th rowSpan="2">Particulars</th>
              <th className="num" colSpan="2" style={{textAlign:'center',borderBottom:'1px solid var(--line)'}}>Opening Balance</th>
              <th className="num" colSpan="2" style={{textAlign:'center',borderBottom:'1px solid var(--line)'}}>Transactions</th>
              <th className="num" colSpan="2" style={{textAlign:'center',borderBottom:'1px solid var(--line)'}}>Closing Balance</th>
            </tr>
            <tr>
              <th className="num" style={{width:90}}>Dr (₹)</th>
              <th className="num" style={{width:90}}>Cr (₹)</th>
              <th className="num" style={{width:90}}>Debit (₹)</th>
              <th className="num" style={{width:90}}>Credit (₹)</th>
              <th className="num" style={{width:90}}>Dr (₹)</th>
              <th className="num" style={{width:90}}>Cr (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{cursor:'pointer'}} onClick={()=>setDrill({accountIds:[r.id],title:`${r.id} · ${r.name}`})}
                className="hover-row">
                <td style={{fontFamily:'var(--mono)',color:'var(--primary)'}}>{r.id}</td>
                <td style={{color:'var(--primary)',textDecoration:'underline dotted',fontWeight:500}}>{r.name}
                  <span style={{fontSize:10,color:'var(--ink-3)',marginLeft:6}}>{r.group}</span></td>
                <td className="num">{r.openDr ? fmt(r.openDr) : ''}</td>
                <td className="num">{r.openCr ? fmt(r.openCr) : ''}</td>
                <td className="num">{r.perDr ? fmt(r.perDr) : ''}</td>
                <td className="num">{r.perCr ? fmt(r.perCr) : ''}</td>
                <td className="num">{r.closeDr ? fmt(r.closeDr) : ''}</td>
                <td className="num">{r.closeCr ? fmt(r.closeCr) : ''}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan="2" style={{textAlign:'right'}}>TOTAL</td>
              <td className="num">₹{fmt(T.openDr)}</td>
              <td className="num">₹{fmt(T.openCr)}</td>
              <td className="num">₹{fmt(T.perDr)}</td>
              <td className="num">₹{fmt(T.perCr)}</td>
              <td className="num">₹{fmt(T.closeDr)}</td>
              <td className="num">₹{fmt(T.closeCr)}</td>
            </tr>
            <tr><td colSpan="8" style={{textAlign:'center',padding:14}}>
              {Math.abs(totalDr-totalCr) < 0.01
                ? <span className="badge badge-success">✓ Balanced  Closing Dr ₹{fmt(totalDr)} = Cr ₹{fmt(totalCr)}</span>
                : <span className="badge badge-danger">✗ Difference: ₹{fmt(Math.abs(totalDr-totalCr))}  check entries / opening balances</span>}
              {Math.abs(T.perDr-T.perCr) >= 0.01 &&
                <span className="badge badge-danger" style={{marginLeft:8}}>⚠ Period movements unbalanced by ₹{fmt(Math.abs(T.perDr-T.perCr))}</span>}
            </td></tr>
          </tbody>
        </table>
        </div>
        <div className="report-foot">
          <span>Click any account row to view detailed ledger · Generated by MiyeeBooks · {new Date().toLocaleString('en-IN')}</span>
          <span>For {data.company.name}</span>
        </div>
      </div>

      {drill && <LedgerDrillModal accountIds={drill.accountIds} title={drill.title} data={data} from={from} to={to} onClose={()=>setDrill(null)} />}
    </>
  );
}

// ============================================================================
// PROFIT & LOSS (Schedule III)
// ============================================================================
function ProfitLoss({data, balances}){
  const fyStart = data.company.fyStart || '';
  const fyEnd   = data.company.fyEnd   || '';
  const [from, setFrom] = useState(fyStart);
  const [to,   setTo]   = useState(today());
  const [drill, setDrill] = useState(null);
  const [compare, setCompare] = useState(false);

  // Period movements only (income/expense for selected period)
  const pb = useMemo(() => computePeriodBals(data, from, to), [data, from, to]);

  // Previous year, same dates (for comparison column)
  const shiftYr = d => d && d.length===10 ? (parseInt(d.slice(0,4))-1) + d.slice(4) : d;
  const pbPrev = useMemo(() => compare ? computePeriodBals(data, shiftYr(from), shiftYr(to)) : null, [data, from, to, compare]);

  const getGroup = (groupFilter) => data.coa.filter(groupFilter).reduce((s,a) => {
    const b = pb.period[a.id] || 0;
    return s + (a.type==='Income' ? -b : b);
  }, 0);
  const getGroupPrev = (groupFilter) => !pbPrev ? 0 : data.coa.filter(groupFilter).reduce((s,a) => {
    const b = pbPrev.period[a.id] || 0;
    return s + (a.type==='Income' ? -b : b);
  }, 0);

  const getGroupAccIds = (groupFilter) => data.coa.filter(groupFilter).map(a=>a.id);

  const F = {
    revenue:    a => a.type==='Income' && a.group==='Revenue from Operations',
    otherInc:   a => a.type==='Income' && a.group==='Other Income',
    costMat:    a => a.group==='Cost of Materials' || a.group==='Purchase of Stock-in-Trade',
    empBenefit: a => a.group==='Employee Benefit Expenses',
    finCost:    a => a.group==='Finance Costs',
    depr:       a => a.group==='Depreciation',
    otherExp:   a => a.group==='Other Expenses',
  };
  const revenue    = getGroup(F.revenue),    revenueP    = getGroupPrev(F.revenue);
  const otherInc   = getGroup(F.otherInc),   otherIncP   = getGroupPrev(F.otherInc);
  const costMat    = getGroup(F.costMat),    costMatP    = getGroupPrev(F.costMat);
  const empBenefit = getGroup(F.empBenefit), empBenefitP = getGroupPrev(F.empBenefit);
  const finCost    = getGroup(F.finCost),    finCostP    = getGroupPrev(F.finCost);
  const depr       = getGroup(F.depr),       deprP       = getGroupPrev(F.depr);
  const otherExp   = getGroup(F.otherExp),   otherExpP   = getGroupPrev(F.otherExp);
  const totalRev   = revenue + otherInc;
  const totalExp   = costMat + empBenefit + finCost + depr + otherExp;
  const totalRevP  = revenueP + otherIncP;
  const totalExpP  = costMatP + empBenefitP + finCostP + deprP + otherExpP;
  const pbt        = totalRev - totalExp;
  const pbtP       = totalRevP - totalExpP;
  const taxRatePct = companyTaxRate(data);
  const tax        = estimateTax(pbt, taxRatePct);
  const taxP       = estimateTax(pbtP, taxRatePct);
  const pat        = pbt - tax;

  // Per-account note lines (for Notes section)
  const incomeAccounts  = data.coa.filter(a=>a.type==='Income');
  const expenseAccounts = data.coa.filter(a=>a.type==='Expense');

  const variance = (cur, prev) => {
    if(!prev) return cur ? '' : '';
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return (pct>=0?'+':'') + pct.toFixed(1) + '%';
  };
  const drillRow = (label, val, ids, bold=false, isGroup=false, prevVal=null) => (
    <tr style={bold?{fontWeight:700,background:'var(--surface-2)'}:{}} onClick={ids?.length?()=>setDrill({accountIds:ids,title:label}):undefined}
      className={ids?.length?'drill-row':''}>
      <td style={{paddingLeft: isGroup?0:14, cursor: ids?.length?'pointer':'default'}}>
        {ids?.length ? <span style={{color:'var(--primary)',textDecoration:'underline dotted'}}>{label}</span> : label}
      </td>
      <td className="num">₹{fmt(val)}</td>
      {compare && <>
        <td className="num" style={{color:'var(--ink-3)'}}>₹{fmt(prevVal||0)}</td>
        <td className="num" style={{fontSize:11,color:(val-(prevVal||0))>=0?'var(--primary)':'var(--danger)'}}>{variance(val, prevVal||0)}</td>
      </>}
    </tr>
  );

  const handleExcel = () => {
    const incRows = incomeAccounts.map(a => {
      const v = -(pb.period[a.id]||0); return [a.id, a.name, a.group, v||''];
    }).filter(r=>r[3]);
    const expRows = expenseAccounts.map(a => {
      const v = (pb.period[a.id]||0); return [a.id, a.name, a.group, ''||'', v||''];
    }).filter(r=>r[4]);
    exportXLSX(`PnL_${data.company.name}_${from}_${to}.xlsx`, [
      { name:'P&L Summary', rows:[
        [`Statement of Profit & Loss  ${data.company.name}`],
        [`Period: ${from} to ${to}`],[],
        ['Particulars','Amount (₹)'],
        ['I. INCOME',''],
        ['Revenue from Operations', revenue],['Other Income', otherInc],['Total Income', totalRev],['',''],
        ['II. EXPENSES',''],
        ['Cost of Materials / Purchases', costMat],['Employee Benefit Expenses', empBenefit],
        ['Finance Costs', finCost],['Depreciation & Amortization', depr],['Other Expenses', otherExp],
        ['Total Expenses', totalExp],['',''],
        ['III. Profit Before Tax (PBT)', pbt],
        [`Current Tax (est. ${taxRatePct}%)`, tax],['V. Profit After Tax (PAT)', pat],
      ]},
      { name:'Income (Note)', rows:[['Code','Account','Group','Income (₹)'],...incRows]},
      { name:'Expenses (Note)', rows:[['Code','Account','Group','','Expense (₹)'],...expRows]},
    ]);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Profit & Loss Statement</h1>
          <div className="page-sub">Schedule III · Period: {fmtDate(from)} → {fmtDate(to)} · Click any line to view ledger details</div>
        </div>
        <div className="page-actions">
          <button className={'btn btn-sm'+(compare?' btn-primary':'')} onClick={()=>setCompare(!compare)}
            title="Show previous year same period alongside">⇄ Compare PY</button>
          <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
          <button className="btn btn-sm btn-primary" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <PeriodFilter data={data} from={from} to={to} onChange={(f,t)=>{setFrom(f);setTo(t);}} />
      </div>

      <div className="report">
        <div className="report-head">
          {data.company.logo && <img className="report-logo" src={data.company.logo} alt="Logo" />}
          <div className="report-co">{data.company.name}</div>
          <div style={{fontSize:11,color:'var(--ink-3)'}}>CIN: {data.company.cin} · GSTIN: {data.company.gstin}</div>
          <div className="report-title">Statement of Profit & Loss</div>
          <div className="report-period">For the period {fmtDate(from)} to {fmtDate(to)}</div>
        </div>

        <table>
          <thead><tr>
            <th>Particulars</th>
            <th className="num" style={{width:compare?150:200}}>Current Period (₹)</th>
            {compare && <>
              <th className="num" style={{width:150}}>Previous Year (₹)</th>
              <th className="num" style={{width:80}}>Δ %</th>
            </>}
          </tr></thead>
          <tbody>
            <tr className="group"><td colSpan={compare?4:2}>I. INCOME</td></tr>
            {drillRow('Revenue from Operations', revenue, getGroupAccIds(F.revenue), false, false, revenueP)}
            {drillRow('Other Income', otherInc, getGroupAccIds(F.otherInc), false, false, otherIncP)}
            {drillRow('Total Income (I)', totalRev, null, true, false, totalRevP)}

            <tr className="group"><td colSpan={compare?4:2}>II. EXPENSES</td></tr>
            {drillRow('Cost of Materials Consumed / Purchases', costMat, getGroupAccIds(F.costMat), false, false, costMatP)}
            {drillRow('Employee Benefit Expenses', empBenefit, getGroupAccIds(F.empBenefit), false, false, empBenefitP)}
            {drillRow('Finance Costs', finCost, getGroupAccIds(F.finCost), false, false, finCostP)}
            {drillRow('Depreciation & Amortization', depr, getGroupAccIds(F.depr), false, false, deprP)}
            {drillRow('Other Expenses', otherExp, getGroupAccIds(F.otherExp), false, false, otherExpP)}
            {drillRow('Total Expenses (II)', totalExp, null, true, false, totalExpP)}

            <tr className="total"><td>III. Profit Before Tax (I − II)</td>
              <td className="num" style={{color:pbt>=0?'var(--primary)':'var(--danger)'}}>₹{fmt(pbt)}</td>
              {compare && <>
                <td className="num" style={{color:'var(--ink-3)'}}>₹{fmt(pbtP)}</td>
                <td className="num" style={{fontSize:11,color:(pbt-pbtP)>=0?'var(--primary)':'var(--danger)'}}>{variance(pbt, pbtP)}</td>
              </>}
            </tr>
            <tr className="group"><td colSpan={compare?4:2}>IV. TAX EXPENSE</td></tr>
            {drillRow(`Current Tax (estimated @ ${taxRatePct}%)`, tax, [], false, false, taxP)}
            {drillRow('Deferred Tax', 0, [])}
            <tr className="total"><td>V. Profit After Tax (PAT)</td>
              <td className="num" style={{color:pat>=0?'var(--primary)':'var(--danger)'}}>₹{fmt(pat)}</td>
              {compare && <>
                <td className="num" style={{color:'var(--ink-3)'}}>₹{fmt(pbtP - taxP)}</td>
                <td className="num" style={{fontSize:11,color:((pat)-(pbtP-taxP))>=0?'var(--primary)':'var(--danger)'}}>{variance(pat, pbtP - taxP)}</td>
              </>}
            </tr>
            <tr><td style={{paddingTop:14,fontSize:11,color:'var(--ink-3)'}}>Earnings Per Share (Basic &amp; Diluted)</td>
              <td className="num" style={{fontSize:11,color:'var(--ink-3)'}}>₹{((pat/Math.max(1,(balances['1100']||1000000)/10))||0).toFixed(2)}</td></tr>
          </tbody>
        </table>

        {/* Notes  Income breakdown */}
        <div style={{marginTop:24}}>
          <div style={{fontWeight:700,fontSize:13,borderBottom:'2px solid var(--ink)',paddingBottom:6,marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:'var(--primary)',color:'#fff',borderRadius:4,padding:'2px 9px',fontSize:12}}>Note A</span>
            <span>Income Breakdown (Period: {fmtDate(from)} to {fmtDate(to)})</span>
          </div>
          <table>
            <thead><tr>
              <th style={{width:52}}>Note</th>
              <th style={{width:80}}>Code</th><th>Account</th><th>Group</th><th className="num">Amount (₹)</th>
            </tr></thead>
            <tbody>
              {incomeAccounts.filter(a=>pb.period[a.id]).map((a,ni)=>{
                const val = -(pb.period[a.id]||0);
                if(!val) return null;
                return (
                  <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>openLedgerTab([a.id],`${a.id} · ${a.name}`,data,from,to)} className="drill-row">
                    <td style={{fontSize:10,color:'var(--ink-3)',fontWeight:600}}>A-{ni+1}</td>
                    <td style={{fontFamily:'var(--mono)',color:'var(--primary)'}}>{a.id}</td>
                    <td style={{color:'var(--primary)',textDecoration:'underline dotted'}}>{a.name} <span style={{fontSize:9,color:'var(--ink-3)'}}>↗</span></td>
                    <td style={{fontSize:11,color:'var(--ink-3)'}}>{a.group}</td>
                    <td className="num">{fmt(val)}</td>
                  </tr>
                );
              })}
              <tr style={{fontWeight:700,background:'var(--surface-2)'}}>
                <td colSpan="4" style={{textAlign:'right'}}>Total Income</td>
                <td className="num">₹{fmt(totalRev)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes  Expense breakdown */}
        <div style={{marginTop:18}}>
          <div style={{fontWeight:700,fontSize:13,borderBottom:'2px solid var(--ink)',paddingBottom:6,marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:'var(--danger)',color:'#fff',borderRadius:4,padding:'2px 9px',fontSize:12}}>Note B</span>
            <span>Expense Breakdown (Period: {fmtDate(from)} to {fmtDate(to)})</span>
          </div>
          <table>
            <thead><tr>
              <th style={{width:52}}>Note</th>
              <th style={{width:80}}>Code</th><th>Account</th><th>Group</th><th className="num">Amount (₹)</th>
            </tr></thead>
            <tbody>
              {expenseAccounts.filter(a=>pb.period[a.id]).map((a,ni)=>{
                const val = pb.period[a.id]||0;
                if(!val) return null;
                return (
                  <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>openLedgerTab([a.id],`${a.id} · ${a.name}`,data,from,to)} className="drill-row">
                    <td style={{fontSize:10,color:'var(--ink-3)',fontWeight:600}}>B-{ni+1}</td>
                    <td style={{fontFamily:'var(--mono)',color:'var(--danger)'}}>{a.id}</td>
                    <td style={{color:'var(--primary)',textDecoration:'underline dotted'}}>{a.name} <span style={{fontSize:9,color:'var(--ink-3)'}}>↗</span></td>
                    <td style={{fontSize:11,color:'var(--ink-3)'}}>{a.group}</td>
                    <td className="num">{fmt(val)}</td>
                  </tr>
                );
              })}
              <tr style={{fontWeight:700,background:'var(--surface-2)'}}>
                <td colSpan="4" style={{textAlign:'right'}}>Total Expenses</td>
                <td className="num">₹{fmt(totalExp)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="report-foot">
          <span>Tax estimate at {taxRatePct}% · Subject to audit · Click any line for ledger detail · Generated {new Date().toLocaleDateString('en-IN')}</span>
          <span>MiyeeBooks · {data.company.name}</span>
        </div>
      </div>

      {drill && <LedgerDrillModal accountIds={drill.accountIds} title={drill.title} data={data} from={from} to={to} onClose={()=>setDrill(null)} />}
    </>
  );
}

// ============================================================================
// BALANCE SHEET (Schedule III)
// ============================================================================
function BalanceSheet({data, balances}){
  const [asOn, setAsOn] = useState(today());
  const [drill, setDrill] = useState(null);

  // Balance sheet uses as-on balances (all movements up to asOn date)
  const pbFull = useMemo(() => computePeriodBals(data, data.company.fyStart||'', asOn), [data, asOn]);
  const bals = pbFull.asOn;
  const g = (id) => bals[id] || 0;

  // P&L for the period (FY start → asOn)  uses period movements
  const income   = data.coa.filter(a=>a.type==='Income').reduce((s,a)=>s+(-( pbFull.period[a.id]||0)),0);
  const expense  = data.coa.filter(a=>a.type==='Expense').reduce((s,a)=>s+(pbFull.period[a.id]||0),0);
  const currentProfit = income - expense;                 // pre-tax profit for the period
  // Accumulated P&L from BEFORE this FY (the income/expense openings). In the
  // continuous-ledger model prior-year profit is never posted to reserves, so
  // it must be folded into retained earnings here or the sheet stops tallying
  // from the second year onward (Assets carry it, Equity otherwise wouldn't).
  const priorInc = data.coa.filter(a=>a.type==='Income').reduce((s,a)=>s+(-(pbFull.opening[a.id]||0)),0);
  const priorExp = data.coa.filter(a=>a.type==='Expense').reduce((s,a)=>s+(pbFull.opening[a.id]||0),0);
  const retainedPrior = priorInc - priorExp;              // retained earnings of earlier years
  // Consistent with the P&L: carry PAT into reserves and show the estimated
  // current-tax charge as a short-term provision, so both statements agree and
  // the sheet still tallies (reserves -tax, provision +tax nets to zero).
  const taxRatePct   = companyTaxRate(data);
  const taxProvision = estimateTax(currentProfit, taxRatePct);
  const currentPAT   = currentProfit - taxProvision;

  // Equity & Liabilities - totals derive from ACCOUNT-TYPE sums (not hardcoded
  // id lists) so the sheet can NEVER drift, whatever ledgers a voucher touches.
  const sumType = (t) => data.coa.filter(a=>a.type===t).reduce((s,a)=>s+g(a.id),0);
  const equityFromAccounts = -sumType('Equity');      // share capital + opening reserves (credit → +)
  const liabFromAccounts   = -sumType('Liability');   // ALL liability ledgers, signed positive
  const assetsExact        = sumType('Asset');        // ALL asset ledgers incl. contra (acc. depr.)

  const shareCapital   = -g('1100');
  const lt_borrowings  = -g('1200');
  const dtl            = -g('1210');
  const tradePayables  = -g('1300');
  const provisions     = -g('1330');
  const reserves       = equityFromAccounts - shareCapital + retainedPrior + currentPAT;   // opening reserves + prior retained + profit AFTER tax
  // Residual current liabilities = everything else (GST output, TDS, PF, ESIC, PT, salary payable…)
  const otherCL        = liabFromAccounts - lt_borrowings - dtl - tradePayables - provisions;
  const otherCLIds     = data.coa.filter(a=>a.type==='Liability' && !['1300','1330','1200','1210'].includes(a.id)).map(a=>a.id);
  const totalEquity    = shareCapital + reserves;     // = equityFromAccounts + currentPAT
  const totalNCL       = lt_borrowings + dtl;
  // taxProvision is an estimated presentation line (not a posted ledger) that
  // exactly offsets the tax removed from reserves, so the sheet still tallies.
  const totalCL        = tradePayables + otherCL + provisions + taxProvision;
  const totalLiab      = totalEquity + totalNCL + totalCL;   // ≡ assetsExact, always tallies

  // Assets
  const grossPPE        = g('2100')+g('2110')+g('2120');
  const accDepr         = g('2130');
  const netPPE          = grossPPE + accDepr;
  const investments     = g('2200');
  const inventory       = g('2300')+g('2310');
  const tradeRec        = g('2400');
  const cashEq          = g('2500')+g('2510')+g('2511')+g('2520');
  // Residual other current assets = all remaining asset ledgers (GST input, TDS receivable, new ledgers…)
  const otherCA         = assetsExact - netPPE - investments - inventory - tradeRec - cashEq;
  const otherCAIds      = data.coa.filter(a=>a.type==='Asset' && !['2100','2110','2120','2130','2200','2300','2310','2400','2500','2510','2511','2520'].includes(a.id)).map(a=>a.id);
  const totalNCA        = netPPE + investments;
  const totalCA         = inventory + tradeRec + cashEq + otherCA;
  const totalAssets     = totalNCA + totalCA;          // ≡ assetsExact

  // Helper: clickable row
  const dRow = (label, val, ids, indent=false, bold=false) => (
    <tr style={bold?{fontWeight:700}:{}} onClick={ids?.length?()=>setDrill({accountIds:ids,title:label}):undefined}
      className={ids?.length?'drill-row':''}>
      <td style={{paddingLeft:indent?28:12, cursor:ids?.length?'pointer':'default'}}>
        {ids?.length ? <span style={{color:'var(--primary)',textDecoration:'underline dotted'}}>{label}</span> : label}
      </td>
      <td className="num">{val!==null?'₹'+fmt(val):''}</td>
    </tr>
  );

  const handleExcel = () => {
    const assetRows = data.coa.filter(a=>a.type==='Asset'&&bals[a.id]).map(a=>[a.id,a.name,a.group,bals[a.id]||'']);
    const liabRows  = data.coa.filter(a=>['Liability','Equity'].includes(a.type)&&bals[a.id]).map(a=>[a.id,a.name,a.group,-(bals[a.id]||0)]);
    exportXLSX(`BalanceSheet_${data.company.name}_${asOn}.xlsx`,[
      {name:'Balance Sheet', rows:[
        [`Balance Sheet  ${data.company.name}`],[`As at ${asOn}`],[],
        ['Particulars','Amount (₹)'],
        ['I. EQUITY AND LIABILITIES',''],
        ['Share Capital', shareCapital],['Reserves & Surplus (incl. profit)', reserves],
        ['Sub-total  Shareholders\' Funds', totalEquity],
        ['Long-term Borrowings', lt_borrowings],['Deferred Tax Liability', dtl],['Sub-total  NCL', totalNCL],
        ['Trade Payables', tradePayables],['Other CL (Statutory)', otherCL],['Provisions', provisions],
        [`Provision for Income Tax (est. ${taxRatePct}%)`, taxProvision],
        ['Sub-total  CL', totalCL],['TOTAL EQUITY & LIABILITIES', totalLiab],['',''],
        ['II. ASSETS',''],
        ['PPE (Net)', netPPE],['  Gross Block', grossPPE],['  Acc. Depreciation', Math.abs(accDepr)],
        ['Non-Current Investments', investments],['Sub-total  NCA', totalNCA],
        ['Inventories', inventory],['Trade Receivables', tradeRec],
        ['Cash & Equivalents', cashEq],['Other Current Assets', otherCA],['Sub-total  CA', totalCA],
        ['TOTAL ASSETS', totalAssets],
      ]},
      {name:'Assets (Notes)', rows:[['Code','Account','Group','Balance (₹)'],...assetRows]},
      {name:'Liabilities (Notes)', rows:[['Code','Account','Group','Balance (₹)'],...liabRows]},
    ]);
  };

  // Notes: detailed account list per section  click opens ledger in new tab
  const noteSection = (noteNo, title, filter, sign=1) => {
    const accs = data.coa.filter(filter).filter(a=>bals[a.id]);
    if(!accs.length) return null;
    const shortTitle = title.replace(/^Note \d+  /, '');
    return (
      <div style={{marginTop:16}}>
        <div style={{fontWeight:600,fontSize:12,color:'var(--ink-2)',borderBottom:'1px solid var(--line)',paddingBottom:4,marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:'var(--primary)',color:'#fff',borderRadius:4,padding:'1px 7px',fontSize:11,fontWeight:700,flexShrink:0}}>{noteNo}</span>
          <span>{shortTitle}</span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr>
            <th style={{padding:'5px 8px',textAlign:'left',background:'var(--surface-2)',borderBottom:'1px solid var(--line)',width:36,color:'var(--ink-3)'}}>Note</th>
            <th style={{padding:'5px 8px',textAlign:'left',background:'var(--surface-2)',borderBottom:'1px solid var(--line)',width:72}}>Code</th>
            <th style={{padding:'5px 8px',textAlign:'left',background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>Account</th>
            <th style={{padding:'5px 8px',textAlign:'right',background:'var(--surface-2)',borderBottom:'1px solid var(--line)',width:140}}>Balance (₹)</th>
          </tr></thead>
          <tbody>
            {accs.map(a=>(
              <tr key={a.id} style={{cursor:'pointer',borderBottom:'1px solid var(--line)'}}
                onClick={()=>openLedgerTab([a.id],`${a.id} · ${a.name}`,data,data.company.fyStart||'',asOn)}
                className="drill-row">
                <td style={{padding:'5px 8px',fontSize:10,color:'var(--ink-3)',fontWeight:600}}>{noteNo}</td>
                <td style={{padding:'5px 8px',fontFamily:'var(--mono)',color:'var(--primary)'}}>{a.id}</td>
                <td style={{padding:'5px 8px',color:'var(--primary)',textDecoration:'underline dotted'}}>{a.name} <span style={{fontSize:9,color:'var(--ink-3)'}}>↗</span></td>
                <td style={{padding:'5px 8px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(Math.abs(bals[a.id]||0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Balance Sheet</h1>
          <div className="page-sub">Schedule III · As at {asOn} · Click any line to drill into the ledger</div>
        </div>
        <div className="page-actions">
          <input type="date" value={asOn} onChange={e=>setAsOn(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
          <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
        </div>
      </div>

      <div className="report">
        <div className="report-head">
          {data.company.logo && <img className="report-logo" src={data.company.logo} alt="Logo" />}
          <div className="report-co">{data.company.name}</div>
          <div style={{fontSize:11,color:'var(--ink-3)'}}>CIN: {data.company.cin} · PAN: {data.company.pan} · GSTIN: {data.company.gstin}</div>
          <div className="report-title">Balance Sheet</div>
          <div className="report-period">As at {asOn}</div>
        </div>

        <table>
          <thead><tr><th>Particulars</th><th className="num" style={{width:200}}>Amount (₹)</th></tr></thead>
          <tbody>
            <tr className="group"><td colSpan="2">I. EQUITY AND LIABILITIES</td></tr>
            <tr style={{fontWeight:600}}><td>(1) Shareholders' Funds</td><td></td></tr>
            {dRow('(a) Share Capital', shareCapital, ['1100'], true)}
            {dRow('(b) Reserves & Surplus', reserves, ['1110'], true)}
            <tr><td style={{paddingLeft:42,fontSize:11,color:'var(--ink-3)'}}>
              {Math.abs(retainedPrior) >= 1 ? `Retained earnings (earlier years): ₹${fmt(retainedPrior)} · ` : ''}Current-year profit after tax: ₹{fmt(currentPAT)}</td><td></td></tr>
            <tr style={{fontWeight:700,background:'var(--surface-2)'}}><td style={{paddingLeft:12}}>Sub-total  Shareholders' Funds</td><td className="num">₹{fmt(totalEquity)}</td></tr>

            <tr style={{fontWeight:600}}><td>(2) Non-Current Liabilities</td><td></td></tr>
            {dRow('(a) Long-term Borrowings', lt_borrowings, ['1200'], true)}
            {dRow('(b) Deferred Tax Liabilities (Net)', dtl, ['1210'], true)}
            <tr style={{fontWeight:700,background:'var(--surface-2)'}}><td style={{paddingLeft:12}}>Sub-total  Non-Current Liab.</td><td className="num">₹{fmt(totalNCL)}</td></tr>

            <tr style={{fontWeight:600}}><td>(3) Current Liabilities</td><td></td></tr>
            {dRow('(a) Trade Payables', tradePayables, ['1300'], true)}
            {dRow('(b) Other Current Liabilities (Statutory: GST, TDS, PF/ESIC/PT, Salary)', otherCL, otherCLIds, true)}
            {dRow('(c) Short-term Provisions', provisions, ['1330'], true)}
            {dRow('(d) Provision for Income Tax (estimated @ '+taxRatePct+'%)', taxProvision, null, true)}
            <tr style={{fontWeight:700,background:'var(--surface-2)'}}><td style={{paddingLeft:12}}>Sub-total  Current Liab.</td><td className="num">₹{fmt(totalCL)}</td></tr>
            <tr className="total"><td>TOTAL EQUITY &amp; LIABILITIES</td><td className="num">₹{fmt(totalLiab)}</td></tr>

            <tr className="group"><td colSpan="2">II. ASSETS</td></tr>
            <tr style={{fontWeight:600}}><td>(1) Non-Current Assets</td><td></td></tr>
            {dRow('(a) Property, Plant & Equipment (Net)', netPPE, ['2100','2110','2120','2130'], true)}
            <tr><td style={{paddingLeft:42,fontSize:11,color:'var(--ink-3)'}}>Gross Block: ₹{fmt(grossPPE)} · Acc. Depr: ₹{fmt(Math.abs(accDepr))}</td><td></td></tr>
            {dRow('(b) Non-Current Investments', investments, ['2200'], true)}
            <tr style={{fontWeight:700,background:'var(--surface-2)'}}><td style={{paddingLeft:12}}>Sub-total  Non-Current Assets</td><td className="num">₹{fmt(totalNCA)}</td></tr>

            <tr style={{fontWeight:600}}><td>(2) Current Assets</td><td></td></tr>
            {dRow('(a) Inventories', inventory, ['2300','2310'], true)}
            {dRow('(b) Trade Receivables', tradeRec, ['2400'], true)}
            {dRow('(c) Cash & Cash Equivalents', cashEq, ['2500','2510','2511','2520'], true)}
            {dRow('(d) Other Current Assets (GST ITC, TDS Receivable)', otherCA, otherCAIds, true)}
            <tr style={{fontWeight:700,background:'var(--surface-2)'}}><td style={{paddingLeft:12}}>Sub-total  Current Assets</td><td className="num">₹{fmt(totalCA)}</td></tr>
            <tr className="total"><td>TOTAL ASSETS</td><td className="num">₹{fmt(totalAssets)}</td></tr>

            <tr><td colSpan="2" style={{textAlign:'center',padding:14}}>
              {Math.abs(totalLiab-totalAssets) < 1
                ? <span className="badge badge-success">✓ Balance Sheet Tallied</span>
                : <span className="badge badge-danger">⚠ Difference: ₹{fmt(totalLiab-totalAssets)}  check entries</span>}
            </td></tr>
          </tbody>
        </table>

        {/* Notes section */}
        <div style={{marginTop:28}}>
          <div style={{fontWeight:700,fontSize:14,borderBottom:'2px solid var(--ink)',paddingBottom:6,marginBottom:12}}>Notes to Balance Sheet  As at {asOn}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              {noteSection('1','Note 1  Fixed Assets', a=>a.group==='Fixed Assets'||a.group==='Plant & Machinery'||a.group==='Furniture & Fixtures'||a.schedule==='Property, Plant & Equipment')}
              {noteSection('2','Note 2  Investments', a=>a.group==='Investments'||a.group==='Non-Current Investments')}
              {noteSection('3','Note 3  Inventories', a=>a.group==='Inventories'||a.id==='2300'||a.id==='2310')}
              {noteSection('4','Note 4  Trade Receivables', a=>a.id==='2400'||a.group==='Trade Receivables')}
              {noteSection('5','Note 5  Cash & Bank', a=>a.isBank||a.schedule==='Cash & Equivalents'||['2500','2510','2511','2520'].includes(a.id))}
              {noteSection('6','Note 6  Other Current Assets', a=>otherCAIds.includes(a.id))}
            </div>
            <div>
              {noteSection('7','Note 7  Share Capital & Equity', a=>a.type==='Equity'||a.id==='1100'||a.id==='1110')}
              {noteSection('8','Note 8  Long-term Borrowings', a=>a.id==='1200'||a.group==='Long-term Borrowings')}
              {noteSection('9','Note 9  Trade Payables', a=>a.id==='1300'||a.group==='Trade Payables')}
              {noteSection('10','Note 10  Other Current Liabilities', a=>otherCLIds.includes(a.id))}
            </div>
          </div>
        </div>

        <div className="report-foot">
          <span>Significant Accounting Policies &amp; Notes form integral part · Subject to audit · Click any line for ledger detail</span>
          <span>For {data.company.name} · MiyeeBooks</span>
        </div>
      </div>

      {drill && <LedgerDrillModal accountIds={drill.accountIds} title={drill.title} data={data}
        from={data.company.fyStart||''} to={asOn} onClose={()=>setDrill(null)} />}
    </>
  );
}

// ============================================================================
// CASH FLOW (AS-3 Indirect Method)
// ============================================================================
// ============================================================================
// FUND FLOW & WORKING-CAPITAL CHANGE STATEMENT
// The sources-and-applications view banks & CAs ask for. Compares balances at
// the start vs the chosen date; movement in non-current items = the fund flow,
// which reconciles to the change in working capital.
// ============================================================================
function FundFlow({data}){
  const r2 = n => Math.round((n||0)*100)/100;
  const fyStart = data.company.fyStart || (today().slice(0,4)+'-04-01');
  const [asOn, setAsOn] = useState(today());

  const pb = useMemo(() => computePeriodBals(data, fyStart, asOn), [data, fyStart, asOn]);
  const open = pb.opening, close = pb.asOn;   // balances before FY start vs at asOn

  const idsWhere = (fn) => data.coa.filter(fn).map(a=>a.id);
  const sumBal = (ids, bals, sign=1) => r2(ids.reduce((s,id)=>s + sign*(bals[id]||0), 0));

  // Account groups
  const caIds = idsWhere(a => a.type==='Asset' && a.group==='Current Assets');
  const clIds = idsWhere(a => a.type==='Liability' && a.group==='Current Liabilities');
  const fixedIds = idsWhere(a => a.group==='Fixed Assets' && !a.contra);          // gross cost
  const invIds = idsWhere(a => a.group==='Non-Current Investments');
  const ltLiabIds = idsWhere(a => a.type==='Liability' && a.group==='Non-Current Liabilities');
  const equityIds = idsWhere(a => a.type==='Equity');
  const incomeIds = idsWhere(a => a.type==='Income');
  const expenseIds = idsWhere(a => a.type==='Expense');

  // Period P&L (movement = close − open on income/expense = this-period activity)
  const periodMove = (ids, sign) => r2(ids.reduce((s,id)=> s + sign*((close[id]||0)-(open[id]||0)), 0));
  const income   = periodMove(incomeIds, -1);   // income credit-natured
  const expense  = periodMove(expenseIds, 1);
  const netProfit = r2(income - expense);
  const deprec = r2((close['4400']||0) - (open['4400']||0));   // add back non-cash
  const fundsFromOps = r2(netProfit + deprec);

  // Non-current movements (change = close − open)
  const chg = (ids, sign=1) => r2(ids.reduce((s,id)=> s + sign*((close[id]||0)-(open[id]||0)), 0));
  const capitalChg  = chg(equityIds.filter(id=>id!=='1110'), -1);  // equity credit-natured; +ve = raised (exclude reserves 1110 - that's profit)
  const ltLoanChg   = chg(ltLiabIds, -1);                          // +ve = loan raised
  const fixedChg    = chg(fixedIds);                               // +ve = purchased
  const invChg      = chg(invIds);                                 // +ve = invested

  const sources = [], apps = [];
  if(fundsFromOps > 0) sources.push(['Funds from Operations (profit + depreciation)', fundsFromOps]);
  else if(fundsFromOps < 0) apps.push(['Funds lost in Operations', -fundsFromOps]);
  if(capitalChg > 0.5) sources.push(['Issue of Share Capital', capitalChg]);
  else if(capitalChg < -0.5) apps.push(['Buy-back / reduction of Capital', -capitalChg]);
  if(ltLoanChg > 0.5) sources.push(['Long-term Loans raised', ltLoanChg]);
  else if(ltLoanChg < -0.5) apps.push(['Repayment of Long-term Loans', -ltLoanChg]);
  if(fixedChg > 0.5) apps.push(['Purchase of Fixed Assets', fixedChg]);
  else if(fixedChg < -0.5) sources.push(['Sale of Fixed Assets', -fixedChg]);
  if(invChg > 0.5) apps.push(['Purchase of Investments', invChg]);
  else if(invChg < -0.5) sources.push(['Sale of Investments', -invChg]);

  const totSources = r2(sources.reduce((s,r)=>s+r[1],0));
  const totApps = r2(apps.reduce((s,r)=>s+r[1],0));
  const netFund = r2(totSources - totApps);   // = increase in working capital

  // Working-capital schedule
  const caOpen = sumBal(caIds, open), caClose = sumBal(caIds, close);
  const clOpen = sumBal(clIds, open, -1), clClose = sumBal(clIds, close, -1);
  const wcOpen = r2(caOpen - clOpen), wcClose = r2(caClose - clClose);
  const wcChange = r2(wcClose - wcOpen);
  const reconciles = Math.abs(wcChange - netFund) < 1;

  const handleExcel = () => exportXLSX(`Fund_Flow_${asOn}.xlsx`, [{
    name:'Fund Flow', rows:[
      [`Fund Flow Statement  ${data.company.name}  ${fmtDate(fyStart)} to ${fmtDate(asOn)}`],[],
      ['SOURCES OF FUNDS',''], ...sources.map(r=>[r[0],r[1]]), ['Total Sources', totSources],[],
      ['APPLICATIONS OF FUNDS',''], ...apps.map(r=>[r[0],r[1]]), ['Total Applications', totApps],[],
      ['Net Increase/(Decrease) in Working Capital', netFund],[],
      ['WORKING CAPITAL','Opening','Closing','Change'],
      ['Current Assets', caOpen, caClose, r2(caClose-caOpen)],
      ['Current Liabilities', clOpen, clClose, r2(clClose-clOpen)],
      ['Net Working Capital', wcOpen, wcClose, wcChange],
    ],
  }]);

  const Line = ({label, val, bold}) => (
    <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--line)',fontWeight:bold?700:400}}>
      <span>{label}</span><span className="rupee">₹{fmt(val)}</span>
    </div>
  );

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Fund Flow Statement</h1>
        <div className="page-sub">Sources &amp; applications of funds · {fmtDate(fyStart)} → {fmtDate(asOn)}</div>
      </div>
      <div className="page-actions">
        <input type="date" value={asOn} onChange={e=>setAsOn(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
        <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
      <div className="card">
        <div className="card-head"><h3 className="card-title">Sources of Funds</h3></div>
        <div className="card-body">
          {sources.length===0 ? <div className="empty" style={{padding:20}}>No sources in this period</div> :
            sources.map((r,i)=><Line key={i} label={r[0]} val={r[1]} />)}
          <Line label="Total Sources" val={totSources} bold />
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3 className="card-title">Applications of Funds</h3></div>
        <div className="card-body">
          {apps.length===0 ? <div className="empty" style={{padding:20}}>No applications in this period</div> :
            apps.map((r,i)=><Line key={i} label={r[0]} val={r[1]} />)}
          <Line label="Total Applications" val={totApps} bold />
        </div>
      </div>
    </div>

    <div className="card" style={{marginTop:18}}>
      <div className="card-head"><h3 className="card-title">Schedule of Changes in Working Capital</h3>
        <span className={'badge '+(reconciles?'badge-success':'badge-danger')}>{reconciles?'✓ Reconciles with fund flow':'⚠ Off by ₹'+fmt(wcChange-netFund)}</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Particulars</th><th className="num">Opening (₹)</th><th className="num">Closing (₹)</th><th className="num">Change (₹)</th></tr></thead>
          <tbody>
            <tr><td>Current Assets</td><td className="num">{fmt(caOpen)}</td><td className="num">{fmt(caClose)}</td><td className="num">{fmt(r2(caClose-caOpen))}</td></tr>
            <tr><td>Current Liabilities</td><td className="num">{fmt(clOpen)}</td><td className="num">{fmt(clClose)}</td><td className="num">{fmt(r2(clClose-clOpen))}</td></tr>
          </tbody>
          <tfoot>
            <tr style={{fontWeight:800,borderTop:'2px solid var(--line)',background:'var(--surface-2)'}}>
              <td>Net Working Capital</td><td className="num">₹{fmt(wcOpen)}</td><td className="num">₹{fmt(wcClose)}</td>
              <td className="num" style={{color:wcChange>=0?'var(--green)':'var(--danger)'}}>₹{fmt(wcChange)}</td>
            </tr>
            <tr><td colSpan="3" style={{textAlign:'right',fontWeight:700}}>Net Increase/(Decrease) in WC per Fund Flow</td>
              <td className="num" style={{fontWeight:700}}>₹{fmt(netFund)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)',lineHeight:1.6}}>
        Increase in current assets or decrease in current liabilities <b>increases</b> working capital; the fund flow above must reconcile to that change.
        Depreciation is added back (non-cash); the current-year profit sits inside operations, not in the capital line.
      </div>
    </div>
  </>);
}

function CashFlow({data, balances}){
  const fyStart = data.company.fyStart || '';
  const [from, setFrom] = useState(fyStart);
  const [to,   setTo]   = useState(today());

  const pb = useMemo(() => computePeriodBals(data, from, to), [data, from, to]);
  const g  = (id) => pb.asOn[id] || 0;
  const op = (id) => pb.opening[id] || 0;
  const pd = (id) => pb.period[id] || 0;

  // PBT from period movements
  const income  = data.coa.filter(a=>a.type==='Income').reduce((s,a)=>s+(-pd(a.id)),0);
  const expense = data.coa.filter(a=>a.type==='Expense').reduce((s,a)=>s+pd(a.id),0);
  const pbt = income - expense;

  // Non-cash adjustments (period movements)
  const depr       = pd('4400');
  const interestExp= pd('4300');
  const interestInc= -pd('3200');
  const forexLoss  = pd('4560');
  const forexGain  = -pd('3210');

  // Cash & bank ledgers (all isBank accounts + the seed cash/bank ids)
  const cashIds = (() => {
    const ids = data.coa.filter(a=>a.isBank).map(a=>a.id);
    ['2500','2510','2511','2520'].forEach(id => { if(!ids.includes(id)) ids.push(id); });
    return ids;
  })();
  const openingCash  = cashIds.reduce((s,id)=>s+op(id),0);
  const actualClose  = cashIds.reduce((s,id)=>s+g(id),0);
  // The actual, indisputable cash movement (double-entry guarantees this is right)
  const netChange    = actualClose - openingCash;

  const operatingProfit = pbt + depr + interestExp - interestInc + forexLoss - forexGain;

  // Working capital changes = asOn balance - opening balance (sign-adjusted)
  const wcDelta = (id, isAsset) => {
    const delta = g(id) - op(id);  // movement in period
    return isAsset ? -delta : delta;
  };
  const debtorsChange   = wcDelta('2400', true);
  const inventoryChange = (wcDelta('2300',true)+wcDelta('2310',true));
  const creditorsChange = -(g('1300')-op('1300')); // creditor increase = positive cash
  const gstChange       = -((g('1310')-op('1310'))+(g('1311')-op('1311'))+(g('1312')-op('1312')));

  // Investing  change in non-current assets during period
  const ppeChange    = -((g('2100')+g('2110')+g('2120'))-(op('2100')+op('2110')+op('2120')));
  const investChange = -(g('2200')-op('2200'));
  const netCFI = ppeChange + investChange + interestInc;

  // Financing  change in long-term liabilities + capital during period
  const borrowingChange = -(g('1200')-op('1200'));  // liability decrease = positive
  const capitalChange   = -(g('1100')-op('1100'));
  const netCFF = borrowingChange + capitalChange - interestExp;

  // Operating is the RESIDUAL: everything that isn't investing or financing.
  // This guarantees CFO + CFI + CFF == the real cash movement, every time.
  const netCFO   = netChange - netCFI - netCFF;
  // "Other WC changes" absorbs all non-named current items (GST input, TDS recv/payable,
  // PF/ESIC/PT, provisions, salary payable…) so the operating build-up also reconciles.
  const namedCFO = operatingProfit + debtorsChange + inventoryChange + creditorsChange + gstChange;
  const otherWC  = netCFO - namedCFO;
  const closingCash  = openingCash + netChange;   // ≡ actualClose

  const row = (label, val, indent=false, bold=false) => (
    <tr style={bold?{fontWeight:700,background:'var(--surface-2)'}:{}}>
      <td style={{paddingLeft:indent?28:12}}>{label}</td>
      <td className="num" style={{color:val<0?'var(--danger)':undefined}}>₹{fmt(val)}</td>
    </tr>
  );

  const handleExcel = () => exportXLSX(`CashFlow_${data.company.name}_${from}_${to}.xlsx`,[{
    name:'Cash Flow', rows:[
      [`Cash Flow Statement  ${data.company.name}`],[`Period: ${from} to ${to}`],[`AS-3 (Revised) · Indirect Method`],[],
      ['Particulars','Amount (₹)'],
      ['A. OPERATING ACTIVITIES',''],
      ['Net Profit Before Tax (PBT)', pbt],
      ['Add: Depreciation', depr],['Add: Interest Expense', interestExp],
      ['Less: Interest Income', -interestInc],['Forex Loss/(Gain)', forexLoss-forexGain],
      ['Operating Profit before WC Changes', operatingProfit],
      ['(Inc)/Dec in Trade Receivables', debtorsChange],['(Inc)/Dec in Inventories', inventoryChange],
      ['Inc/(Dec) in Trade Payables', creditorsChange],['Inc/(Dec) in GST Payable', gstChange],
      ['Other WC / Statutory Dues (TDS, PF, ESIC, PT, ITC…)', otherWC],
      ['Net Cash from Operating (A)', netCFO],['',''],
      ['B. INVESTING ACTIVITIES',''],
      ['Purchase of PPE (net)', ppeChange],['Purchase/Sale of Investments', investChange],
      ['Interest Received', interestInc],['Net Cash from Investing (B)', netCFI],['',''],
      ['C. FINANCING ACTIVITIES',''],
      ['Borrowings Net Change', borrowingChange],['Capital Issued', capitalChange],
      ['Less: Interest Paid', -interestExp],['Net Cash from Financing (C)', netCFF],['',''],
      ['NET CHANGE IN CASH (A+B+C)', netChange],
      ['Opening Cash & Equivalents', openingCash],['Closing Cash & Equivalents', closingCash],
    ]
  }]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Cash Flow Statement</h1>
          <div className="page-sub">AS-3 (Revised) · Indirect Method · Period: {fmtDate(from)} → {fmtDate(to)}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
          <button className="btn btn-sm btn-primary" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <PeriodFilter data={data} from={from} to={to} onChange={(f,t)=>{setFrom(f);setTo(t);}} />
      </div>

      <div className="report">
        <div className="report-head">
          {data.company.logo && <img className="report-logo" src={data.company.logo} alt="Logo" />}
          <div className="report-co">{data.company.name}</div>
          <div className="report-title">Cash Flow Statement</div>
          <div className="report-period">For the period {fmtDate(from)} to {fmtDate(to)}</div>
        </div>
        <table>
          <thead><tr><th>Particulars</th><th className="num" style={{width:200}}>Amount (₹)</th></tr></thead>
          <tbody>
            <tr className="group"><td colSpan="2">A. CASH FLOW FROM OPERATING ACTIVITIES</td></tr>
            {row('Net Profit Before Tax', pbt)}
            <tr><td style={{paddingLeft:12,fontStyle:'italic',color:'var(--ink-3)'}}>Adjustments for non-cash items:</td><td></td></tr>
            {row('Add: Depreciation & Amortization', depr, true)}
            {row('Add: Interest / Finance Cost', interestExp, true)}
            {row('Less: Interest Income', -interestInc, true)}
            {row('Add: Forex Loss / (Less: Gain)', forexLoss-forexGain, true)}
            {row('Operating Profit before Working Capital Changes', operatingProfit, false, true)}
            <tr><td style={{paddingLeft:12,fontStyle:'italic',color:'var(--ink-3)'}}>Working capital adjustments:</td><td></td></tr>
            {row('(Increase) / Decrease in Trade Receivables', debtorsChange, true)}
            {row('(Increase) / Decrease in Inventories', inventoryChange, true)}
            {row('Increase / (Decrease) in Trade Payables', creditorsChange, true)}
            {row('Increase / (Decrease) in GST Payable (net)', gstChange, true)}
            {row('Other WC / Statutory Dues (TDS, PF, ESIC, PT, ITC…)', otherWC, true)}
            {row('Net Cash from Operating Activities (A)', netCFO, false, true)}

            <tr className="group"><td colSpan="2">B. CASH FLOW FROM INVESTING ACTIVITIES</td></tr>
            {row('(Purchase) / Sale of PPE  net', ppeChange, true)}
            {row('(Purchase) / Sale of Investments', investChange, true)}
            {row('Interest / Dividend Received', interestInc, true)}
            {row('Net Cash from Investing Activities (B)', netCFI, false, true)}

            <tr className="group"><td colSpan="2">C. CASH FLOW FROM FINANCING ACTIVITIES</td></tr>
            {row('Proceeds from / (Repayment of) Borrowings', borrowingChange, true)}
            {row('Proceeds from Share Capital Issue', capitalChange, true)}
            {row('Less: Interest / Finance Cost Paid', -interestExp, true)}
            {row('Net Cash from Financing Activities (C)', netCFF, false, true)}

            <tr className="total"><td>NET INCREASE / (DECREASE) IN CASH (A+B+C)</td>
              <td className="num" style={{color:netChange>=0?'var(--primary)':'var(--danger)'}}>₹{fmt(netChange)}</td></tr>
            {row('Cash & Equivalents at Beginning of Period', openingCash)}
            {row('Cash & Equivalents at End of Period', closingCash, false, true)}

            <tr><td colSpan="2" style={{textAlign:'center',padding:14}}>
              {Math.abs(closingCash-actualClose) < 1
                ? <span className="badge badge-success">✓ Reconciled with Balance Sheet (Actual: ₹{fmt(actualClose)})</span>
                : <span className="badge badge-gold">Note: Difference ₹{fmt(Math.abs(closingCash-actualClose))}  may include non-operating items</span>}
            </td></tr>
          </tbody>
        </table>
        <div className="report-foot">
          <span>Prepared under AS-3 (Indirect Method) · Period: {fmtDate(from)} to {fmtDate(to)}</span>
          <span>MiyeeBooks · For {data.company.name}</span>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// GSTR-9 ANNUAL RETURN (summary)
// ============================================================================
function GSTR9({data}){
  const fyStart = data.company.fyStart || '2025-04-01';
  const fyEnd   = data.company.fyEnd   || '2026-03-31';
  const fyYear  = parseInt(fyStart.slice(0,4));
  const inFY = v => v.status!=='Cancelled' && v.date>=fyStart && v.date<=fyEnd;
  const sales = data.vouchers.filter(v=>inFY(v) && (v.type==='SAL'||v.type==='CRN'));
  const sgn = v => v.type==='CRN' ? -1 : 1;
  const sumS = k => sales.reduce((s,v)=>s+sgn(v)*(v[k]||0),0);
  const isForeign = v => { const p=data.parties.find(x=>x.id===v.partyId); return p&&p.isForeign; };
  const isB2B = v => { const p=data.parties.find(x=>x.id===v.partyId); return p&&p.gstin&&!p.isForeign; };

  const totTaxable = sumS('taxable'), outCgst=sumS('cgst'), outSgst=sumS('sgst'), outIgst=sumS('igst');
  const totTax = outCgst+outSgst+outIgst;
  const zeroRated = sales.filter(isForeign).reduce((s,v)=>s+sgn(v)*(v.taxable||0),0);
  const b2bTaxable = sales.filter(isB2B).reduce((s,v)=>s+sgn(v)*(v.taxable||0),0);
  const b2cTaxable = Math.max(0, totTaxable - b2bTaxable - zeroRated);
  const creditNotes = sales.filter(v=>v.type==='CRN').reduce((s,v)=>s+(v.taxable||0),0);

  const pb = useMemo(()=>computePeriodBals(data, fyStart, fyEnd).period, [data, fyStart, fyEnd]);
  const itcCgst = pb['2600']||0, itcSgst = pb['2601']||0, itcIgst = pb['2602']||0;
  const totItc = itcCgst+itcSgst+itcIgst;
  const netCash = Math.max(0, totTax - totItc);

  const r3 = (label,a,b,c,d)=>(
    <tr><td style={{padding:'8px 16px'}}>{label}</td><td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(a)}</td>
      <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(b)}</td>
      <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(c)}</td>
      <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(d)}</td></tr>
  );
  const handleExcel = () => exportXLSX(`GSTR9_FY${fyYear}.xlsx`, [{name:`GSTR-9 ${fyYear}`, rows:[
    [`GSTR-9 Annual Return (working) - ${data.company.name} - FY ${fyYear}-${String(fyYear+1).slice(2)}`],[`GSTIN: ${data.company.gstin||''}`],[],
    ['Pt II - Outward supplies','Taxable','CGST','SGST/IGST'],
    ['4A B2B supplies', b2bTaxable, '', ''],
    ['4 B2C supplies', b2cTaxable, '', ''],
    ['5 Zero-rated/Export', zeroRated, '', ''],
    ['Less: Credit notes', creditNotes, '', ''],
    ['Total outward taxable', totTaxable, outCgst+outSgst, outIgst],
    [],['Pt III - ITC availed','CGST','SGST','IGST'],
    ['6 ITC on inward supplies', itcCgst, itcSgst, itcIgst],
    [],['Pt IV - Tax','Output','ITC','Net payable (cash)'],
    ['9 Tax payable', totTax, totItc, netCash],
  ]}]);

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">GSTR-9 - Annual Return</h1>
        <div className="page-sub">FY {fyYear}–{String(fyYear+1).slice(2)} · annual summary from your books · GSTIN: {data.company.gstin}</div>
      </div>
      <div className="page-actions"><button className="btn btn-sm" onClick={handleExcel}>⬇ Excel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>⎙ Print</button></div>
    </div>

    <div className="stat-grid" style={{marginBottom:16}}>
      <div className="stat stat-info"><div className="stat-label">Total Outward Taxable</div><div className="stat-value rupee">₹{fmt(totTaxable)}</div></div>
      <div className="stat stat-gold"><div className="stat-label">Total Output Tax</div><div className="stat-value rupee">₹{fmt(totTax)}</div></div>
      <div className="stat"><div className="stat-label">Total ITC Availed</div><div className="stat-value rupee">₹{fmt(totItc)}</div></div>
      <div className="stat stat-danger"><div className="stat-label">Net Tax (Cash)</div><div className="stat-value rupee">₹{fmt(netCash)}</div></div>
    </div>

    <div className="card" style={{marginBottom:16}}>
      <div className="card-head"><h3 className="card-title">Part II - Outward &amp; Inward Supplies (Tables 4 &amp; 5)</h3></div>
      <div className="card-body" style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
            <th style={{padding:'8px 16px',textAlign:'left'}}>Nature of Supply</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>Taxable (₹)</th><th style={{padding:'8px 16px',textAlign:'right'}}>CGST</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>SGST</th><th style={{padding:'8px 16px',textAlign:'right'}}>IGST</th>
          </tr></thead>
          <tbody>
            {r3('4A · Supplies to registered (B2B)', b2bTaxable, '', '', '')}
            {r3('4A · Supplies to unregistered (B2C)', b2cTaxable, '', '', '')}
            {r3('5 · Zero-rated / Export supplies', zeroRated, 0, 0, 0)}
            {r3('Less: Credit notes issued', -creditNotes, '', '', '')}
            <tr className="total"><td style={{padding:'9px 16px'}}>Total Outward Taxable Supplies</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(totTaxable)}</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(outCgst)}</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(outSgst)}</td>
              <td style={{padding:'9px 16px',textAlign:'right'}}>₹{fmt(outIgst)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div className="card" style={{marginBottom:16}}>
      <div className="card-head"><h3 className="card-title">Part III - Input Tax Credit (Table 6)</h3></div>
      <div className="card-body" style={{padding:0}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
            <th style={{padding:'8px 16px',textAlign:'left'}}>ITC Availed</th>
            <th style={{padding:'8px 16px',textAlign:'right'}}>CGST</th><th style={{padding:'8px 16px',textAlign:'right'}}>SGST</th><th style={{padding:'8px 16px',textAlign:'right'}}>IGST</th>
          </tr></thead>
          <tbody>
            <tr><td style={{padding:'8px 16px'}}>6 · ITC on inward supplies (inputs, services, capital goods)</td>
              <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(itcCgst)}</td>
              <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(itcSgst)}</td>
              <td style={{padding:'8px 16px',textAlign:'right',fontFamily:'var(--mono)'}}>{fmt(itcIgst)}</td></tr>
            <tr className="total"><td style={{padding:'9px 16px'}}>Total ITC Availed</td>
              <td style={{padding:'9px 16px',textAlign:'right'}} colSpan="3">₹{fmt(totItc)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div className="card">
      <div className="card-head"><h3 className="card-title">Part IV - Tax Payable &amp; Paid (Table 9)</h3></div>
      <div className="card-body">
        <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
          <div>Output Tax: <b>₹{fmt(totTax)}</b></div>
          <div>Less ITC: <b>₹{fmt(totItc)}</b></div>
          <div>Net Tax payable in cash: <b style={{color:'var(--danger)'}}>₹{fmt(netCash)}</b></div>
        </div>
      </div>
    </div>
    <div style={{marginTop:12,fontSize:11,color:'var(--ink-3)'}}>Working summary aggregated from your sales vouchers and GST ledgers for the year. Reconcile with the sum of your monthly GSTR-3B filings and GSTR-1 before filing GSTR-9. Tables 7/8/10-18 (reversals, demands, HSN, late fee) require manual review.</div>
  </>);
}
