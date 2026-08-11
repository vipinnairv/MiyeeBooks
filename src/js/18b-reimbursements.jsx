// ============================================================================
// EXPENSE REIMBURSEMENT  employee claims -> manager approval -> finance payout
// State machine: Draft -> Submitted -> (Manager) Finance-Pending / Rejected ->
// (Finance) Paid / Rejected. Marking Paid posts a balanced payment voucher
// (Dr Expense ledger / Cr Bank) reusing the same posting path as Payroll, so it
// inherits the period lock and maker-checker controls.
// ============================================================================

// status code -> {label, badge class or inline}
const REIMB_META = {
  DRAFT:        {label:'Draft',            cls:'badge-muted'},
  SUBMITTED:    {label:'With Manager',     cls:'badge-info'},
  FIN_PENDING:  {label:'With Finance',     cls:'badge-gold'},
  MGR_REJECTED: {label:'Rejected (Mgr)',   cls:'badge-danger'},
  FIN_REJECTED: {label:'Rejected (Finance)', cls:'badge-danger'},
  PAID:         {label:'Paid',             cls:'badge-success'},
};
const reimbChip = (s) => {
  const m = REIMB_META[s] || REIMB_META.DRAFT;
  return <span className={'badge '+m.cls}>{m.label}</span>;
};
const reimbNextNo = (data) => 'REIM/' + String((data.reimbursements||[]).length + 1).padStart(4,'0');
const reimbAppr = (actor, action, from, to, extra={}) => ({
  at: new Date().toISOString(), by: (typeof window!=='undefined' && window.__miyeeUserEmail) || 'local',
  role: actor||'', action, fromStatus:from, toStatus:to, ...extra,
});

function Reimbursements({data, setData, showToast, readOnly=false, userRole='owner'}){
  const [modal, setModal]   = useState(null);   // claim being created/edited (draft form)
  const [action, setAction] = useState(null);   // {type:'approve'|'reject'|'pay', claim}
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  const employees = data.employees || [];
  const empById = (id) => employees.find(e => e.id === id) || {};
  const claims = (data.reimbursements || []);

  const filtered = claims
    .filter(c => statusFilter === 'All' || c.status === statusFilter)
    .filter(c => { if(!search) return true; const q = search.toLowerCase();
      const nm = (empById(c.employeeId).name || '').toLowerCase();
      return (c.claimNo||'').toLowerCase().includes(q) || nm.includes(q)
          || (c.title||'').toLowerCase().includes(q) || (c.travelPurpose||'').toLowerCase().includes(q); })
    .slice().sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  const sumBy = (st) => claims.filter(c => c.status === st).reduce((s,c) => s + (c.claimAmount||0), 0);
  const cntBy = (st) => claims.filter(c => c.status === st).length;

  // ── transitions ───────────────────────────────────────────────────────────
  const patchClaim = (id, patch, appr, auditMsg) => setData(prev => ({...prev,
    reimbursements: (prev.reimbursements||[]).map(c => c.id === id
      ? {...c, ...patch, approvals: appr ? [...(c.approvals||[]), appr] : (c.approvals||[])} : c),
    ...(auditMsg ? {auditLog: [...(prev.auditLog||[]), auditEntry('REIMB', auditMsg)]} : {}),
  }));

  const submitClaim = (c) => {
    if(!c.employeeId){ showToast('Pick an employee for the claim','error'); return; }
    if(!c.title || !c.travelPurpose){ showToast('Title and travel purpose are required','error'); return; }
    if(!c.expenseLedgerId){ showToast('Choose the type of expense (ledger)','error'); return; }
    if(!(c.claimAmount > 0)){ showToast('Enter a claim amount','error'); return; }
    patchClaim(c.id, {status:'SUBMITTED', submittedAt:new Date().toISOString()},
      reimbAppr('employee','SUBMIT', c.status, 'SUBMITTED'),
      `${c.claimNo} submitted · ${empById(c.employeeId).name||''} · ₹${fmt(c.claimAmount)}`);
    showToast('Claim '+c.claimNo+' submitted to manager');
  };
  const reopenClaim = (c) => patchClaim(c.id, {status:'DRAFT'},
    reimbAppr('employee','REOPEN', c.status, 'DRAFT'), `${c.claimNo} reopened to draft`) || showToast('Claim reopened');
  const deleteClaim = (c) => { if(!confirm('Delete draft '+c.claimNo+'?')) return;
    setData(prev => ({...prev, reimbursements:(prev.reimbursements||[]).filter(x=>x.id!==c.id)}));
    showToast('Draft deleted'); };

  const doApprove = (c, sanctioned, note) => {
    const amt = Math.round((sanctioned||0)*100)/100;
    if(!(amt > 0)){ showToast('Sanctioned amount must be greater than zero','error'); return; }
    if(amt > (c.claimAmount||0) + 0.01){ showToast('Sanctioned cannot exceed the claim amount','error'); return; }
    patchClaim(c.id, {status:'FIN_PENDING', sanctionedAmount:amt},
      reimbAppr('manager','APPROVE', c.status, 'FIN_PENDING', {sanctionedAmount:amt, note:note||''}),
      `${c.claimNo} approved by manager · sanctioned ₹${fmt(amt)}`);
    setAction(null); showToast('Approved · sent to Finance');
  };
  const doReject = (c, reason) => {
    const to = c.status === 'SUBMITTED' ? 'MGR_REJECTED' : 'FIN_REJECTED';
    patchClaim(c.id, {status:to}, reimbAppr(to==='MGR_REJECTED'?'manager':'finance','REJECT', c.status, to, {note:reason||''}),
      `${c.claimNo} rejected · ${reason||''}`);
    setAction(null); showToast('Claim rejected');
  };
  const doPay = (c, bankLedgerId) => {
    if(isDateLocked(data.company, today())){ showToast(`Books are locked up to ${data.company.booksLockedUpto}`,'error'); return; }
    if(!bankLedgerId){ showToast('Choose the bank / cash ledger to pay from','error'); return; }
    const emp = empById(c.employeeId);
    const amt = c.sanctionedAmount || c.claimAmount || 0;
    const lines = [
      {id:uid(), accountId:c.expenseLedgerId, debit:amt, credit:0, narration:c.travelPurpose||c.title||'Reimbursement', costCentreId:c.costCentreId||''},
      {id:uid(), accountId:bankLedgerId, debit:0, credit:amt, narration:'Reimb '+c.claimNo+' · '+(emp.name||'')},
    ];
    const status = data.company.makerChecker === true ? 'Pending' : 'Posted';
    const num = nextVoucherNumber(data, 'PAY');
    const jv = {id:uid(), type:'PAY', date:today(), number:num, partyName:emp.name||'Employee',
      reference:c.claimNo, narration:c.travelPurpose||c.title||'Reimbursement', lines, amount:amt,
      status, createdAt:new Date().toISOString()};
    setData(prev => ({...prev,
      vouchers:[...(prev.vouchers||[]), jv],
      reimbursements:(prev.reimbursements||[]).map(x => x.id===c.id
        ? {...x, status:'PAID', paidAt:new Date().toISOString(), voucherId:jv.id, bankLedgerId,
           approvals:[...(x.approvals||[]), reimbAppr('finance','PAY', x.status, 'PAID', {voucherNo:num})]} : x),
      auditLog:[...(prev.auditLog||[]), auditEntry('REIMB', `${c.claimNo} paid ₹${fmt(amt)} via ${num}${status==='Pending'?' · PENDING approval':''}`)],
    }));
    setAction(null);
    showToast(status==='Pending' ? 'Payment voucher created (pending approval) · '+num : 'Reimbursement paid · voucher '+num);
  };

  const bankLedgers = data.coa.filter(a => a.isBank === true || a.schedule === 'Cash & Equivalents'
    || /cash|bank/i.test(a.name||''));

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Expense Reimbursements</h1>
        <div className="page-sub">Employee claims · manager approval · finance payout to the ledger</div>
      </div>
      {!readOnly && <div className="page-actions">
        <button className="btn btn-primary" onClick={()=>setModal({
          id:uid(), claimNo:reimbNextNo(data), employeeId:employees[0]?.id||'', status:'DRAFT',
          title:'', travelPurpose:'', description:'', expenseDate:today(), legs:[{id:uid(),fromPlace:'',toPlace:''}],
          expenseLedgerId:'', projectId:'', costCentreId:'', claimAmount:0, sanctionedAmount:0,
          attachments:[], approvals:[], createdAt:new Date().toISOString()})}
          disabled={employees.length===0}>＋ New Claim</button>
      </div>}
    </div>

    {employees.length===0 && (
      <div style={{background:'var(--accent-soft)',border:'1px solid var(--accent)',borderRadius:8,padding:'10px 16px',marginBottom:14,fontSize:12.5,color:'var(--warning)'}}>
        Add your team in <b>Employee Master</b> first - claims auto-fill the employee's contact &amp; bank details from there.
      </div>
    )}

    <div className="stat-grid" style={{marginBottom:16}}>
      <div className="stat stat-info"><div className="stat-label">With Manager</div><div className="stat-value">{cntBy('SUBMITTED')}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>₹{fmt(sumBy('SUBMITTED'))}</div></div>
      <div className="stat stat-gold"><div className="stat-label">With Finance</div><div className="stat-value">{cntBy('FIN_PENDING')}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>₹{fmt(sumBy('FIN_PENDING'))}</div></div>
      <div className="stat"><div className="stat-label">Paid</div><div className="stat-value">{cntBy('PAID')}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>₹{fmt(claims.filter(c=>c.status==='PAID').reduce((s,c)=>s+(c.sanctionedAmount||c.claimAmount||0),0))}</div></div>
      <div className="stat stat-danger"><div className="stat-label">Rejected</div><div className="stat-value">{cntBy('MGR_REJECTED')+cntBy('FIN_REJECTED')}</div></div>
    </div>

    <div className="filter-bar">
      <div className="field"><label>Status</label>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option>All</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">With Manager</option>
          <option value="FIN_PENDING">With Finance</option>
          <option value="PAID">Paid</option>
          <option value="MGR_REJECTED">Rejected (Mgr)</option>
          <option value="FIN_REJECTED">Rejected (Finance)</option>
        </select>
      </div>
      <div className="field" style={{flex:1,minWidth:200}}><label>Search</label>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Claim no, employee, title, purpose…" />
      </div>
      <div style={{marginLeft:'auto',alignSelf:'flex-end',fontSize:12,color:'var(--ink-3)',paddingBottom:6}}>{filtered.length} claim{filtered.length!==1?'s':''}</div>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Claim No.</th><th>Employee</th><th>Date</th><th>Title / Purpose</th>
          <th className="num">Claim</th><th className="num">Sanctioned</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          {filtered.length===0 ? (
            <tr><td colSpan="8"><div className="empty"><div className="empty-ico">∅</div><div>No claims yet.{!readOnly && employees.length>0 && ' Click “＋ New Claim”.'}</div></div></td></tr>
          ) : filtered.map(c => {
            const emp = empById(c.employeeId);
            const rejected = c.status==='MGR_REJECTED' || c.status==='FIN_REJECTED';
            const lastNote = (c.approvals||[]).slice().reverse().find(a=>a.note)?.note;
            return (
              <tr key={c.id} style={{opacity:rejected?.75:1}}>
                <td style={{fontFamily:'var(--mono)',fontWeight:600}}>{c.claimNo}{(c.attachments||[]).length>0 && <span title={(c.attachments||[]).length+' receipt(s)'} style={{marginLeft:5,fontSize:11}}>📎</span>}</td>
                <td>{emp.name||'-'}</td>
                <td>{fmtDate(c.expenseDate)}</td>
                <td style={{maxWidth:260,fontSize:12}}><b>{c.title}</b>{c.travelPurpose && <div style={{color:'var(--ink-3)',fontSize:11}}>{c.travelPurpose}</div>}{rejected && lastNote && <div style={{color:'var(--danger)',fontSize:11}}>✕ {lastNote}</div>}</td>
                <td className="num bold">₹{fmt(c.claimAmount||0)}</td>
                <td className="num">{c.sanctionedAmount?('₹'+fmt(c.sanctionedAmount)):<span style={{color:'var(--ink-3)'}}>—</span>}</td>
                <td>{reimbChip(c.status)}</td>
                <td className="actions">
                  {!readOnly && c.status==='DRAFT' && <>
                    <button className="btn btn-sm btn-ghost" onClick={()=>setModal({...c})}>Edit</button>
                    <button className="btn btn-sm" style={{background:'var(--primary)',color:'#fff'}} onClick={()=>submitClaim(c)}>Submit</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>deleteClaim(c)}>×</button>
                  </>}
                  {!readOnly && c.status==='SUBMITTED' && <>
                    <button className="btn btn-sm" style={{background:'var(--green)',color:'#fff'}} onClick={()=>setAction({type:'approve',claim:c})}>✓ Approve</button>
                    <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>setAction({type:'reject',claim:c})}>Reject</button>
                    <button className="btn btn-sm btn-ghost" onClick={()=>setModal({...c})}>Edit</button>
                  </>}
                  {!readOnly && c.status==='FIN_PENDING' && <>
                    <button className="btn btn-sm" style={{background:'var(--green)',color:'#fff'}} onClick={()=>setAction({type:'pay',claim:c})}>💳 Mark Paid</button>
                    <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>setAction({type:'reject',claim:c})}>Reject</button>
                  </>}
                  {c.status==='PAID' && <span style={{fontSize:11,color:'var(--green)'}}>✓ {(data.vouchers||[]).find(v=>v.id===c.voucherId)?.number||'posted'}</span>}
                  {!readOnly && rejected && <button className="btn btn-sm btn-ghost" onClick={()=>reopenClaim(c)}>Reopen</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {modal && <ReimbursementModal claim={modal} data={data} setData={setData} showToast={showToast}
      onSave={(c)=>{ setData(prev => {
        const exists = (prev.reimbursements||[]).some(x=>x.id===c.id);
        return {...prev, reimbursements: exists ? (prev.reimbursements||[]).map(x=>x.id===c.id?c:x) : [...(prev.reimbursements||[]), c]};
      }); setModal(null); showToast('Draft saved: '+c.claimNo); }}
      onClose={()=>setModal(null)} />}

    {action && <ReimbActionModal action={action} bankLedgers={bankLedgers} data={data}
      onApprove={doApprove} onReject={doReject} onPay={doPay} onClose={()=>setAction(null)} />}
  </>);
}

// ── Approve / Reject / Pay mini-modal ───────────────────────────────────────
function ReimbActionModal({action, bankLedgers, data, onApprove, onReject, onPay, onClose}){
  const c = action.claim;
  const [sanctioned, setSanctioned] = useState(c.sanctionedAmount || c.claimAmount || 0);
  const [note, setNote] = useState('');
  const [bank, setBank] = useState(bankLedgers[0]?.id || '');
  const title = action.type==='approve' ? 'Approve claim' : action.type==='pay' ? 'Pay reimbursement' : 'Reject claim';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h2 className="modal-title">{title} · {c.claimNo}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div style={{fontSize:13,color:'var(--ink-2)',marginBottom:12}}>Claimed <b className="rupee">₹{fmt(c.claimAmount||0)}</b> · {c.title}</div>
          {action.type==='approve' && <>
            <div className="field"><label>Sanctioned Amount (≤ claim)</label>
              <input type="number" min="0" max={c.claimAmount} step="0.01" value={sanctioned}
                onChange={e=>setSanctioned(parseFloat(e.target.value)||0)} /></div>
            <div className="field"><label>Note (optional)</label>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. capped to policy" /></div>
            <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>onApprove(c, sanctioned, note)}>✓ Approve &amp; send to Finance</button>
          </>}
          {action.type==='pay' && <>
            <div className="field"><label>Pay from (Bank / Cash ledger)</label>
              <select value={bank} onChange={e=>setBank(e.target.value)}>
                <option value="">Select…</option>
                {bankLedgers.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
              </select></div>
            <div style={{fontSize:12.5,color:'var(--ink-2)',margin:'10px 0'}}>
              Posts a payment voucher: <b>Dr</b> {(data.coa.find(a=>a.id===c.expenseLedgerId)||{}).name||'Expense'} ₹{fmt(c.sanctionedAmount||c.claimAmount||0)} · <b>Cr</b> Bank.
            </div>
            <button className="btn btn-primary" style={{width:'100%'}} onClick={()=>onPay(c, bank)}>💳 Post &amp; mark Paid</button>
          </>}
          {action.type==='reject' && <>
            <div className="field"><label>Reason for rejection</label>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Required" autoFocus /></div>
            <button className="btn btn-danger" style={{width:'100%'}} disabled={!note.trim()} onClick={()=>onReject(c, note)}>Reject claim</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Claim form (create / edit draft) ────────────────────────────────────────
function ReimbursementModal({claim, data, setData, showToast, onSave, onClose, lockedEmployeeId}){
  const [f, setF] = useState(claim);
  const [newProject, setNewProject] = useState('');
  const emp = (data.employees||[]).find(e => e.id === f.employeeId) || {};
  const expenseLedgers = data.coa.filter(a => a.type === 'Expense');
  const projects = data.projects || [];

  const setLeg = (id, patch) => setF({...f, legs: f.legs.map(l => l.id===id ? {...l, ...patch} : l)});
  const addLeg = () => setF({...f, legs: [...(f.legs||[]), {id:uid(), fromPlace:'', toPlace:''}]});
  const rmLeg  = (id) => setF({...f, legs: f.legs.filter(l => l.id!==id)});

  const addProject = () => {
    const name = newProject.trim(); if(!name) return;
    const p = {id:uid(), name, active:true};
    setData(prev => ({...prev, projects:[...(prev.projects||[]), p]}));
    setF({...f, projectId:p.id}); setNewProject('');
    showToast('Project added: '+name);
  };
  const onFiles = (e) => {
    const files = Array.from(e.target.files||[]);
    files.forEach(file => {
      if((f.attachments||[]).length >= 5){ showToast('Up to 5 receipts','error'); return; }
      if(file.size > 2*1024*1024){ showToast(file.name+' is over 2 MB','error'); return; }
      const rd = new FileReader();
      rd.onload = () => setF(prev => ({...prev, attachments:[...(prev.attachments||[]), {id:uid(), name:file.name, type:file.type, size:file.size, dataUrl:rd.result}]}));
      rd.readAsDataURL(file);
    });
    e.target.value = '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><h2 className="modal-title">{(data.reimbursements||[]).some(x=>x.id===f.id)?'Edit':'New'} Claim · {f.claimNo}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body" style={{maxHeight:'74vh',overflowY:'auto'}}>

          <div className="section-divider"><div className="label">Employee</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field required"><label>Employee</label>
              <select value={f.employeeId} disabled={!!lockedEmployeeId} onChange={e=>setF({...f, employeeId:e.target.value})}>
                <option value="">Select…</option>
                {(data.employees||[]).map(e=><option key={e.id} value={e.id}>{e.empCode?e.empCode+' · ':''}{e.name}</option>)}
              </select></div>
            <div className="field"><label>Mobile</label><input value={emp.phone||''} readOnly disabled /></div>
            <div className="field"><label>Email</label><input value={emp.email||''} readOnly disabled /></div>
            <div className="field"><label>Bank A/C</label><input value={emp.bankAcc?emp.bankAcc+(emp.ifsc?' · '+emp.ifsc:''):''} readOnly disabled placeholder="From employee profile" /></div>
          </div>

          <div className="section-divider"><div className="label">Claim Details</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field required" style={{gridColumn:'span 2'}}><label>Claim / Expense Title</label>
              <input value={f.title} onChange={e=>setF({...f, title:e.target.value})} placeholder="e.g. Client visit - Ahmedabad" maxLength="80" /></div>
            <div className="field required"><label>Travel Purpose</label>
              <input value={f.travelPurpose} onChange={e=>{ const v=e.target.value; setF(prev=>({...prev, travelPurpose:v, description: prev.description && prev.description!==prev.travelPurpose ? prev.description : v})); }} placeholder="Becomes the accounting narration" /></div>
            <div className="field"><label>Date of Expense</label>
              <input type="date" value={f.expenseDate} onChange={e=>setF({...f, expenseDate:e.target.value})} /></div>
            <div className="field required"><label>Type of Expense (ledger)</label>
              <select value={f.expenseLedgerId} onChange={e=>setF({...f, expenseLedgerId:e.target.value})}>
                <option value="">Select expense ledger…</option>
                {expenseLedgers.map(a=><option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
              </select></div>
            <div className="field"><label>Project</label>
              <div style={{display:'flex',gap:6}}>
                <select value={f.projectId} onChange={e=>setF({...f, projectId:e.target.value})} style={{flex:1}}>
                  <option value="">— None —</option>
                  {projects.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:6,marginTop:6}}>
                <input value={newProject} onChange={e=>setNewProject(e.target.value)} placeholder="Add new project…" style={{flex:1}} />
                <button className="btn btn-sm" onClick={addProject} disabled={!newProject.trim()}>＋ Add</button>
              </div>
            </div>
            <div className="field" style={{gridColumn:'span 2'}}><label>Description of Expense</label>
              <textarea rows="2" value={f.description} onChange={e=>setF({...f, description:e.target.value})} placeholder="Auto-filled from Travel Purpose - editable" style={{width:'100%',resize:'vertical'}} /></div>
          </div>

          <div className="section-divider"><div className="label">Route / Stops</div><div className="line"></div></div>
          {(f.legs||[]).map((l,i)=>(
            <div key={l.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:11,color:'var(--ink-3)',width:16}}>{i+1}</span>
              <input value={l.fromPlace} onChange={e=>setLeg(l.id,{fromPlace:e.target.value})} placeholder="From" style={{flex:1}} />
              <span style={{color:'var(--ink-3)'}}>→</span>
              <input value={l.toPlace} onChange={e=>setLeg(l.id,{toPlace:e.target.value})} placeholder="To" style={{flex:1}} />
              {(f.legs||[]).length>1 && <button className="btn btn-sm btn-danger" onClick={()=>rmLeg(l.id)}>×</button>}
            </div>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={addLeg}>＋ Add stop</button>

          <div className="section-divider"><div className="label">Amount &amp; Receipts</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field required"><label>Claim Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={f.claimAmount} onChange={e=>setF({...f, claimAmount:parseFloat(e.target.value)||0})} /></div>
            <div className="field"><label>Sanctioned Amount (₹) <span style={{color:'var(--ink-3)',fontWeight:400}}>· set by manager</span></label>
              <input type="number" value={f.sanctionedAmount||''} readOnly disabled placeholder="Manager sets on approval" /></div>
            <div className="field" style={{gridColumn:'span 2'}}><label>Receipts / attachments <span style={{color:'var(--ink-3)',fontWeight:400}}>· images or PDF, ≤ 2 MB, up to 5</span></label>
              {(f.attachments||[]).map(a=>(
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,padding:'4px 8px',background:'var(--surface-2)',borderRadius:6,marginBottom:4}}>
                  <span>📎 {a.name} <span style={{color:'var(--ink-3)'}}>({Math.round(a.size/1024)} KB)</span></span>
                  <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>setF({...f, attachments:f.attachments.filter(x=>x.id!==a.id)})}>×</button>
                </div>
              ))}
              {(f.attachments||[]).length < 5 && <input type="file" accept="image/*,application/pdf" multiple onChange={onFiles} style={{fontSize:12}} />}
            </div>
          </div>
        </div>
        <div className="modal-foot" style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 18px',borderTop:'1px solid var(--line)'}}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(f)} disabled={!f.employeeId||!f.title||!(f.claimAmount>0)}>Save Draft</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EMPLOYEE PORTAL  the restricted, portal-only view for a staff login.
// Rendered by App instead of the whole accounting shell when the signed-in
// user maps to an employee with portalRole:"employee". They only ever see and
// file their own claims; approval & payment happen in the full app.
// ============================================================================
function EmployeePortal({employee, data, setData, showToast, user, darkMode, setDarkMode, onSignOut}){
  const [modal, setModal] = useState(null);
  const mine = (data.reimbursements||[]).filter(c => c.employeeId === employee.id)
    .slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));

  const persist = (updater, msg) => { setData(updater); if(msg) showToast(msg); };
  const saveDraft = (c) => persist(prev => {
    const exists = (prev.reimbursements||[]).some(x=>x.id===c.id);
    return {...prev, reimbursements: exists ? prev.reimbursements.map(x=>x.id===c.id?c:x) : [...(prev.reimbursements||[]), c]};
  }, 'Draft saved: '+c.claimNo) || setModal(null);
  const submit = (c) => {
    if(!c.title || !c.travelPurpose){ showToast('Add a title and travel purpose','error'); return; }
    if(!c.expenseLedgerId){ showToast('Pick the type of expense','error'); return; }
    if(!(c.claimAmount>0)){ showToast('Enter a claim amount','error'); return; }
    persist(prev => ({...prev,
      reimbursements: prev.reimbursements.map(x => x.id===c.id ? {...x, status:'SUBMITTED', submittedAt:new Date().toISOString(),
        approvals:[...(x.approvals||[]), reimbAppr('employee','SUBMIT', x.status, 'SUBMITTED')]} : x),
      auditLog:[...(prev.auditLog||[]), auditEntry('REIMB', `${c.claimNo} submitted by ${employee.name} · ₹${fmt(c.claimAmount)}`)],
    }), 'Submitted to your manager');
  };
  const reopen = (c) => persist(prev => ({...prev, reimbursements: prev.reimbursements.map(x => x.id===c.id
    ? {...x, status:'DRAFT', approvals:[...(x.approvals||[]), reimbAppr('employee','REOPEN', x.status, 'DRAFT')]} : x)}), 'Reopened to draft');
  const del = (c) => { if(!confirm('Delete draft '+c.claimNo+'?')) return;
    persist(prev => ({...prev, reimbursements: prev.reimbursements.filter(x=>x.id!==c.id)}), 'Draft deleted'); };

  const STEPS = ['Draft','With Manager','With Finance','Paid'];
  const stepIndex = (s) => ({DRAFT:0, SUBMITTED:1, FIN_PENDING:2, PAID:3})[s];
  const Tracker = ({c}) => {
    const rejected = c.status==='MGR_REJECTED' || c.status==='FIN_REJECTED';
    const cur = rejected ? (c.status==='MGR_REJECTED'?1:2) : stepIndex(c.status);
    return (
      <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
        {STEPS.map((s,i)=>{
          const done = i<cur, at = i===cur;
          const bad = rejected && at;
          const col = bad?'var(--danger)':done?'var(--green)':at?'var(--primary)':'var(--ink-3)';
          const bg  = bad?'var(--danger-soft)':done?'var(--green-soft)':at?'var(--primary-soft)':'var(--surface-2)';
          return <span key={i} style={{fontSize:11,fontWeight:600,color:col,background:bg,border:'1px solid '+col+'33',
            borderRadius:20,padding:'3px 10px'}}>{done?'✓ ':at?(bad?'✕ ':'● '):''}{bad?'Rejected':s}</span>;
        })}
      </div>
    );
  };

  const newClaim = () => setModal({ id:uid(), claimNo:reimbNextNo(data), employeeId:employee.id, status:'DRAFT',
    title:'', travelPurpose:'', description:'', expenseDate:today(), legs:[{id:uid(),fromPlace:'',toPlace:''}],
    expenseLedgerId:'', projectId:'', costCentreId:'', claimAmount:0, sanctionedAmount:0,
    attachments:[], approvals:[], createdAt:new Date().toISOString() });

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">Miyee<span className="dot">·</span>Books</span>
          <span className="brand-tag">My Reimbursements</span>
        </div>
        <div className="topbar-right">
          <button onClick={()=>setDarkMode(d=>!d)} style={{background:'transparent',border:'1px solid rgba(255,255,255,.4)',borderRadius:20,padding:'3px 10px',fontSize:12,color:'#eef5ff'}}>{darkMode?'☀':'🌙'}</button>
          <span style={{fontSize:12}}>{employee.name}</span>
          {onSignOut && <button className="btn btn-sm btn-ghost" onClick={onSignOut} style={{fontSize:11,padding:'3px 9px'}}>Sign out</button>}
        </div>
      </div>

      <main className="main" style={{maxWidth:840,margin:'0 auto',width:'100%'}}>
        <div className="page-head">
          <div>
            <h1 className="page-title">Expense Claims</h1>
            <div className="page-sub">Raise a claim, track its status, get reimbursed · {employee.name}</div>
          </div>
          <div className="page-actions"><button className="btn btn-primary" onClick={newClaim}>＋ New Claim</button></div>
        </div>

        {mine.length===0 ? (
          <div className="card"><div className="card-body"><div className="empty" style={{padding:30}}>
            <div className="empty-ico">🧾</div><div>No claims yet. Click <b>＋ New Claim</b> to raise your first reimbursement.</div>
          </div></div></div>
        ) : mine.map(c => {
          const rejected = c.status==='MGR_REJECTED' || c.status==='FIN_REJECTED';
          const note = (c.approvals||[]).slice().reverse().find(a=>a.note)?.note;
          const jvNo = (data.vouchers||[]).find(v=>v.id===c.voucherId)?.number;
          return (
            <div className="card" key={c.id} style={{marginBottom:12}}>
              <div className="card-body">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--ink-3)'}}>{c.claimNo} · {fmtDate(c.expenseDate)}{(c.attachments||[]).length>0 && ' · 📎 '+c.attachments.length}</div>
                    <div style={{fontWeight:700,fontSize:15,marginTop:2}}>{c.title||'(untitled)'}</div>
                    {c.travelPurpose && <div style={{fontSize:12.5,color:'var(--ink-2)'}}>{c.travelPurpose}</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    {reimbChip(c.status)}
                    <div className="rupee" style={{fontWeight:700,marginTop:4}}>₹{fmt(c.claimAmount||0)}</div>
                    {c.sanctionedAmount>0 && c.sanctionedAmount!==c.claimAmount && <div style={{fontSize:11,color:'var(--ink-3)'}}>sanctioned ₹{fmt(c.sanctionedAmount)}</div>}
                  </div>
                </div>
                <Tracker c={c} />
                {rejected && note && <div style={{fontSize:12,color:'var(--danger)',marginTop:8}}>✕ {note}</div>}
                {c.status==='PAID' && jvNo && <div style={{fontSize:12,color:'var(--green)',marginTop:8}}>✓ Paid · voucher {jvNo}</div>}
                <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                  {c.status==='DRAFT' && <>
                    <button className="btn btn-sm" onClick={()=>setModal({...c})}>Edit</button>
                    <button className="btn btn-sm btn-primary" onClick={()=>submit(c)}>Submit for approval</button>
                    <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>del(c)}>Delete</button>
                  </>}
                  {rejected && <button className="btn btn-sm" onClick={()=>reopen(c)}>Edit &amp; resubmit</button>}
                </div>
              </div>
            </div>
          );
        })}

        <div className="credit" style={{marginTop:20}}>
          <div><b>Miyee<span style={{color:'var(--accent)'}}>·</span>Books</b> · Employee Reimbursement Portal</div>
        </div>
      </main>

      {modal && <ReimbursementModal claim={modal} data={data} setData={setData} showToast={showToast}
        lockedEmployeeId={employee.id} onSave={saveDraft} onClose={()=>setModal(null)} />}
    </>
  );
}
