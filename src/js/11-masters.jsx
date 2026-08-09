
// ============================================================================
// COST CENTRE MASTER
// ============================================================================
function CostCentreMaster({data, setData, showToast, readOnly=false}){
  const blank = {id:'', code:'', name:'', description:'', budget:0, budgetEnforce:'warn', active:true};
  const [editing, setEditing] = useState(null); // null=list, 'new'=new, id=edit
  const [f, setF] = useState(blank);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const openNew = () => { setF({...blank, id:uid()}); setEditing('new'); };
  const openEdit = (cc) => { setF({...cc}); setEditing(cc.id); };
  const cancel = () => { setEditing(null); setF(blank); };

  const save = () => {
    if(!f.code.trim()) return showToast('Code is required','error');
    if(!f.name.trim()) return showToast('Name is required','error');
    const existing = (data.costCentres||[]).find(c => c.code.trim().toUpperCase()===f.code.trim().toUpperCase() && c.id!==f.id);
    if(existing) return showToast('Code already exists','error');
    if(editing === 'new'){
      setData(prev => ({...prev, costCentres:[...(prev.costCentres||[]), {...f, code:f.code.trim().toUpperCase(), name:f.name.trim()}]}));
      showToast('Cost Centre created');
    } else {
      setData(prev => ({...prev, costCentres:(prev.costCentres||[]).map(c => c.id===f.id ? {...f, code:f.code.trim().toUpperCase(), name:f.name.trim()} : c)}));
      showToast('Cost Centre updated');
    }
    cancel();
  };

  const remove = (id) => {
    setData(prev => ({...prev, costCentres:(prev.costCentres||[]).filter(c => c.id!==id)}));
    setDeleteConfirm(null);
    showToast('Cost Centre deleted');
  };

  const ccs = data.costCentres || [];

  // Calculate spend per cost centre from vouchers
  const ccSpend = useMemo(() => {
    const spend = {};
    (data.vouchers||[]).forEach(v => {
      (v.lines||[]).forEach(l => {
        if(!l.costCentreId) return;
        const acc = data.coa.find(a => a.id === l.accountId);
        if(!acc || acc.type !== 'Expense') return;
        spend[l.costCentreId] = (spend[l.costCentreId]||0) + (l.debit||0);
      });
    });
    return spend;
  }, [data.vouchers, data.coa]);

  if(editing){
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">{editing==='new'?'New Cost Centre':'Edit Cost Centre'}</h1>
            <div className="page-sub">Cost Centres help track expenses by project / profit centre</div>
          </div>
          <div className="page-actions">
            <button className="btn" onClick={cancel}>✕ Cancel</button>
            {!readOnly && <button className="btn btn-primary" onClick={save}>💾 Save</button>}
          </div>
        </div>
        <div className="card"><div className="card-body" style={{maxWidth:640}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:14}}>
            <div className="field">
              <label>Code <span style={{color:'var(--danger)'}}>*</span></label>
              <input value={f.code} onChange={e=>setF({...f,code:e.target.value})} placeholder="CC-01" disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%'}} />
            </div>
            <div className="field">
              <label>Name <span style={{color:'var(--danger)'}}>*</span></label>
              <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Manufacturing Unit" disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%'}} />
            </div>
          </div>
          <div className="field" style={{marginTop:12}}>
            <label>Description</label>
            <input value={f.description||''} onChange={e=>setF({...f,description:e.target.value})} placeholder="Optional description" disabled={readOnly}
              style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%'}} />
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginTop:12}}>
            <div className="field">
              <label>Budget (₹)</label>
              <input type="number" value={f.budget||0} onChange={e=>setF({...f,budget:parseFloat(e.target.value)||0})} disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%',textAlign:'right'}} />
              <div style={{fontSize:10,color:'var(--ink-3)',marginTop:3}}>Set 0 for no budget limit</div>
            </div>
            <div className="field">
              <label>Budget Action</label>
              <select value={f.budgetEnforce||'warn'} onChange={e=>setF({...f,budgetEnforce:e.target.value})} disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%',background:'var(--surface)'}}>
                <option value="warn">⚠ Warn Only</option>
                <option value="block">🚫 Block Entry</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={f.active===false?'inactive':'active'} onChange={e=>setF({...f,active:e.target.value==='active'})} disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%',background:'var(--surface)'}}>
                <option value="active">✅ Active</option>
                <option value="inactive">⛔ Inactive</option>
              </select>
            </div>
          </div>
        </div></div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Cost Centre Master</h1>
          <div className="page-sub">{ccs.length} cost centre{ccs.length!==1?'s':''} defined</div>
        </div>
        {!readOnly && <div className="page-actions"><button className="btn btn-primary" onClick={openNew}>+ New Cost Centre</button></div>}
      </div>

      {ccs.length===0 && (
        <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
          <div style={{fontSize:32,marginBottom:8}}>🎯</div>
          <div style={{fontWeight:600,marginBottom:4}}>No Cost Centres yet</div>
          <div style={{fontSize:12}}>Cost Centres let you track expenses by project or business unit and set budgets</div>
          {!readOnly && <button className="btn btn-primary" style={{marginTop:16}} onClick={openNew}>+ Create First Cost Centre</button>}
        </div></div>
      )}

      {ccs.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Description</th>
                  <th style={{textAlign:'right'}}>Budget (₹)</th>
                  <th style={{textAlign:'right'}}>Spent (₹)</th>
                  <th style={{textAlign:'right'}}>Remaining (₹)</th>
                  <th>Budget Action</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {ccs.map(cc => {
                  const spent = ccSpend[cc.id]||0;
                  const remaining = cc.budget > 0 ? cc.budget - spent : null;
                  const pct = cc.budget > 0 ? Math.min(100, Math.round(spent/cc.budget*100)) : 0;
                  const over = cc.budget > 0 && spent > cc.budget;
                  return (
                    <tr key={cc.id}>
                      <td style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--primary)'}}>{cc.code}</td>
                      <td style={{fontWeight:500}}>{cc.name}</td>
                      <td style={{color:'var(--ink-3)',fontSize:12}}>{cc.description||''}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{cc.budget>0?fmt(cc.budget):''}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',color:over?'var(--danger)':'var(--ink)'}}>
                        {fmt(spent)}
                        {cc.budget > 0 && (
                          <div style={{marginTop:3,height:4,borderRadius:2,background:'var(--line)',overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:2,background:over?'var(--danger)':pct>80?'var(--accent)':'var(--primary)',width:pct+'%',transition:'width .3s'}}></div>
                          </div>
                        )}
                      </td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',color:over?'var(--danger)':remaining===null?'var(--ink-3)':remaining<0?'var(--danger)':'var(--primary)'}}>
                        {remaining===null ? '' : (over?'▼ ':'') + fmt(Math.abs(remaining))}
                      </td>
                      <td><span style={{fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:600,
                        background:cc.budgetEnforce==='block'?'var(--danger-soft)':'var(--accent-soft)',
                        color:cc.budgetEnforce==='block'?'var(--danger)':'var(--warning)'}}>
                        {cc.budgetEnforce==='block'?'Block':'Warn'}
                      </span></td>
                      <td><span style={{fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:600,
                        background:cc.active!==false?'var(--primary-soft)':'var(--line)',
                        color:cc.active!==false?'var(--primary)':'var(--ink-3)'}}>
                        {cc.active!==false?'Active':'Inactive'}
                      </span></td>
                      <td>
                        {!readOnly && (<>
                          <button className="btn btn-sm btn-ghost" style={{marginRight:4}} onClick={()=>openEdit(cc)}>✎</button>
                          <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>setDeleteConfirm(cc.id)}>×</button>
                        </>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span>Delete Cost Centre</span></div>
            <div className="modal-body" style={{padding:'20px 24px'}}>
              <p>Are you sure you want to delete this cost centre? Voucher lines tagged to it will retain the tag but the cost centre will no longer appear in masters.</p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>remove(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// DEPARTMENT MASTER
// ============================================================================
function DepartmentMaster({data, setData, showToast, readOnly=false}){
  const blank = {id:'', code:'', name:'', description:'', active:true};
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(blank);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const openNew = () => { setF({...blank, id:uid()}); setEditing('new'); };
  const openEdit = (d) => { setF({...d}); setEditing(d.id); };
  const cancel = () => { setEditing(null); setF(blank); };

  const save = () => {
    if(!f.code.trim()) return showToast('Code is required','error');
    if(!f.name.trim()) return showToast('Name is required','error');
    const existing = (data.departments||[]).find(d => d.code.trim().toUpperCase()===f.code.trim().toUpperCase() && d.id!==f.id);
    if(existing) return showToast('Code already exists','error');
    if(editing === 'new'){
      setData(prev => ({...prev, departments:[...(prev.departments||[]), {...f, code:f.code.trim().toUpperCase(), name:f.name.trim()}]}));
      showToast('Department created');
    } else {
      setData(prev => ({...prev, departments:(prev.departments||[]).map(d => d.id===f.id ? {...f, code:f.code.trim().toUpperCase(), name:f.name.trim()} : d)}));
      showToast('Department updated');
    }
    cancel();
  };

  const remove = (id) => {
    setData(prev => ({...prev, departments:(prev.departments||[]).filter(d => d.id!==id)}));
    setDeleteConfirm(null);
    showToast('Department deleted');
  };

  const depts = data.departments || [];

  // Expense per department
  const deptSpend = useMemo(() => {
    const spend = {};
    (data.vouchers||[]).forEach(v => {
      (v.lines||[]).forEach(l => {
        if(!l.departmentId) return;
        const acc = data.coa.find(a => a.id === l.accountId);
        if(!acc || acc.type !== 'Expense') return;
        spend[l.departmentId] = (spend[l.departmentId]||0) + (l.debit||0);
      });
    });
    return spend;
  }, [data.vouchers, data.coa]);

  if(editing){
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">{editing==='new'?'New Department':'Edit Department'}</h1>
            <div className="page-sub">Departments enable expense tracking by team / function</div>
          </div>
          <div className="page-actions">
            <button className="btn" onClick={cancel}>✕ Cancel</button>
            {!readOnly && <button className="btn btn-primary" onClick={save}>💾 Save</button>}
          </div>
        </div>
        <div className="card"><div className="card-body" style={{maxWidth:600}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:14}}>
            <div className="field">
              <label>Code <span style={{color:'var(--danger)'}}>*</span></label>
              <input value={f.code} onChange={e=>setF({...f,code:e.target.value})} placeholder="HR" disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%'}} />
            </div>
            <div className="field">
              <label>Name <span style={{color:'var(--danger)'}}>*</span></label>
              <input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Human Resources" disabled={readOnly}
                style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%'}} />
            </div>
          </div>
          <div className="field" style={{marginTop:12}}>
            <label>Description</label>
            <input value={f.description||''} onChange={e=>setF({...f,description:e.target.value})} placeholder="Optional description" disabled={readOnly}
              style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%'}} />
          </div>
          <div className="field" style={{marginTop:12, maxWidth:180}}>
            <label>Status</label>
            <select value={f.active===false?'inactive':'active'} onChange={e=>setF({...f,active:e.target.value==='active'})} disabled={readOnly}
              style={{padding:'8px 10px',border:'1px solid var(--line-2)',borderRadius:6,width:'100%',background:'var(--surface)'}}>
              <option value="active">✅ Active</option>
              <option value="inactive">⛔ Inactive</option>
            </select>
          </div>
        </div></div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Department Master</h1>
          <div className="page-sub">{depts.length} department{depts.length!==1?'s':''} defined</div>
        </div>
        {!readOnly && <div className="page-actions"><button className="btn btn-primary" onClick={openNew}>+ New Department</button></div>}
      </div>

      {depts.length===0 && (
        <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
          <div style={{fontSize:32,marginBottom:8}}>🏢</div>
          <div style={{fontWeight:600,marginBottom:4}}>No Departments yet</div>
          <div style={{fontSize:12}}>Add departments like HR, Finance, Marketing, Sales, Operations to classify expenses</div>
          {!readOnly && <button className="btn btn-primary" style={{marginTop:16}} onClick={openNew}>+ Create First Department</button>}
        </div></div>
      )}

      {depts.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Description</th>
                  <th style={{textAlign:'right'}}>Total Expenses (₹)</th>
                  <th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {depts.map(dept => (
                  <tr key={dept.id}>
                    <td style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--primary)'}}>{dept.code}</td>
                    <td style={{fontWeight:500}}>{dept.name}</td>
                    <td style={{color:'var(--ink-3)',fontSize:12}}>{dept.description||''}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{deptSpend[dept.id]?fmt(deptSpend[dept.id]):''}</td>
                    <td><span style={{fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:600,
                      background:dept.active!==false?'var(--primary-soft)':'var(--line)',
                      color:dept.active!==false?'var(--primary)':'var(--ink-3)'}}>
                      {dept.active!==false?'Active':'Inactive'}
                    </span></td>
                    <td>
                      {!readOnly && (<>
                        <button className="btn btn-sm btn-ghost" style={{marginRight:4}} onClick={()=>openEdit(dept)}>✎</button>
                        <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>setDeleteConfirm(dept.id)}>×</button>
                      </>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><span>Delete Department</span></div>
            <div className="modal-body" style={{padding:'20px 24px'}}>
              <p>Are you sure you want to delete this department? Voucher lines tagged to it will retain the tag but the department will no longer appear in masters.</p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>remove(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// COST CENTRE REPORT (P&L by Cost Centre)
// ============================================================================
function CostCentreReport({data}){
  const [fromDate, setFromDate] = useState(data.company.fyStart||'');
  const [toDate,   setToDate]   = useState(data.company.fyEnd||'');
  const [selCC,    setSelCC]    = useState('');

  const ccs = data.costCentres || [];

  const report = useMemo(() => {
    const result = {};
    ccs.forEach(cc => { result[cc.id] = {cc, income:0, expense:0, lines:[]}; });

    (data.vouchers||[]).forEach(v => {
      if(fromDate && v.date < fromDate) return;
      if(toDate   && v.date > toDate)   return;
      (v.lines||[]).forEach(l => {
        if(!l.costCentreId) return;
        if(selCC && l.costCentreId !== selCC) return;
        const acc = data.coa.find(a => a.id === l.accountId);
        if(!acc) return;
        if(!result[l.costCentreId]) return;
        const entry = result[l.costCentreId];
        const net = (l.debit||0) - (l.credit||0);
        if(acc.type === 'Expense') entry.expense += (l.debit||0);
        if(acc.type === 'Income')  entry.income  += (l.credit||0);
        entry.lines.push({date:v.date, voucherNo:v.number||v.id.slice(0,8), accId:acc.id, accName:acc.name, type:acc.type, debit:l.debit||0, credit:l.credit||0, narration:l.narration||v.narration||''});
      });
    });
    return Object.values(result).filter(r => selCC ? r.cc.id===selCC : true);
  }, [data.vouchers, data.coa, ccs, fromDate, toDate, selCC]);

  const handleCSV = () => {
    let csv = 'Cost Centre,Income,Expense,Net P&L\n';
    report.forEach(r => {
      csv += `"${r.cc.name}",${r.income},${r.expense},${r.income - r.expense}\n`;
    });
    downloadCSV('CostCentre_PnL.csv', csv);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Cost / Profit Centre Report</h1>
          <div className="page-sub">Income &amp; expense by centre  tag Sales with a Profit Centre and Purchases/Expenses with a Cost Centre</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Cost Centre</label>
              <select value={selCC} onChange={e=>setSelCC(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',minWidth:180,background:'var(--surface)'}}>
                <option value="">All Cost Centres</option>
                {ccs.map(c=><option key={c.id} value={c.id}>[{c.code}] {c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {ccs.length === 0 && (
        <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
          <div style={{fontSize:12}}>No cost centres defined. Go to Masters → Cost Centre Master to create them.</div>
        </div></div>
      )}

      {report.map(r => {
        const net = r.income - r.expense;
        const budget = r.cc.budget || 0;
        const budgetUsed = budget > 0 ? Math.min(100,Math.round(r.expense/budget*100)) : 0;
        return (
          <div key={r.cc.id} className="card" style={{marginBottom:18}}>
            <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid var(--line)',background:'var(--surface-2)'}}>
              <div>
                <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--primary)',marginRight:8}}>{r.cc.code}</span>
                <span style={{fontWeight:600,fontSize:14}}>{r.cc.name}</span>
                {r.cc.description && <span style={{color:'var(--ink-3)',fontSize:12,marginLeft:8}}> {r.cc.description}</span>}
              </div>
              <div style={{display:'flex',gap:20,alignItems:'center'}}>
                {budget > 0 && (
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:10,color:'var(--ink-3)'}}>Budget Usage</div>
                    <div style={{fontSize:13,fontWeight:600,color:r.expense>budget?'var(--danger)':'var(--ink)'}}>
                      ₹{fmt(r.expense)} / ₹{fmt(budget)} ({budgetUsed}%)
                    </div>
                    <div style={{height:4,borderRadius:2,background:'var(--line)',overflow:'hidden',marginTop:2,width:120}}>
                      <div style={{height:'100%',borderRadius:2,background:r.expense>budget?'var(--danger)':budgetUsed>80?'var(--accent)':'var(--primary)',width:budgetUsed+'%'}}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="stat-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:16}}>
                <div className="stat"><div className="stat-label">Total Income</div><div className="stat-value pos" style={{fontSize:18}}>₹{fmt(r.income)}</div></div>
                <div className="stat stat-danger"><div className="stat-label">Total Expenses</div><div className="stat-value" style={{fontSize:18,color:'var(--danger)'}}>₹{fmt(r.expense)}</div></div>
                <div className={`stat ${net>=0?'':'stat-danger'}`}>
                  <div className="stat-label">Net P&amp;L</div>
                  <div className="stat-value" style={{fontSize:18,color:net>=0?'var(--primary)':'var(--danger)'}}>₹{fmt(Math.abs(net))}</div>
                  <div className="stat-delta" style={{color:net>=0?'var(--primary)':'var(--danger)'}}>{net>=0?'Profit':'Loss'}</div>
                </div>
              </div>

              {r.lines.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Voucher</th><th>Account</th><th>Type</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Credit</th><th>Narration</th></tr>
                    </thead>
                    <tbody>
                      {r.lines.sort((a,b)=>a.date.localeCompare(b.date)).map((l,i)=>(
                        <tr key={i}>
                          <td style={{fontFamily:'var(--mono)',fontSize:12}}>{l.date}</td>
                          <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{l.voucherNo}</td>
                          <td>{l.accId} · {l.accName}</td>
                          <td><span style={{fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600,
                            background:l.type==='Income'?'var(--primary-soft)':l.type==='Expense'?'var(--danger-soft)':'var(--info-soft)',
                            color:l.type==='Income'?'var(--primary)':l.type==='Expense'?'var(--danger)':'var(--info)'}}>{l.type}</span></td>
                          <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{l.debit>0?fmt(l.debit):''}</td>
                          <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{l.credit>0?fmt(l.credit):''}</td>
                          <td style={{color:'var(--ink-3)',fontSize:12}}>{l.narration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {r.lines.length === 0 && <div style={{textAlign:'center',color:'var(--ink-3)',padding:'20px 0',fontSize:12}}>No tagged transactions in selected period</div>}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ============================================================================
// DEPARTMENT REPORT (Expense by Department)
// ============================================================================
function DepartmentReport({data}){
  const [fromDate, setFromDate] = useState(data.company.fyStart||'');
  const [toDate,   setToDate]   = useState(data.company.fyEnd||'');
  const [selDept,  setSelDept]  = useState('');

  const depts = data.departments || [];

  const report = useMemo(() => {
    const result = {};
    depts.forEach(d => { result[d.id] = {dept:d, expense:0, income:0, byAccount:{}, lines:[]}; });

    (data.vouchers||[]).forEach(v => {
      if(fromDate && v.date < fromDate) return;
      if(toDate   && v.date > toDate)   return;
      (v.lines||[]).forEach(l => {
        if(!l.departmentId) return;
        if(selDept && l.departmentId !== selDept) return;
        const acc = data.coa.find(a => a.id === l.accountId);
        if(!acc) return;
        if(!result[l.departmentId]) return;
        const entry = result[l.departmentId];
        if(acc.type === 'Expense') { entry.expense += (l.debit||0); entry.byAccount[acc.id] = {name:acc.name, amt:(entry.byAccount[acc.id]?.amt||0)+(l.debit||0)}; }
        if(acc.type === 'Income')  entry.income  += (l.credit||0);
        entry.lines.push({date:v.date, voucherNo:v.number||v.id.slice(0,8), accId:acc.id, accName:acc.name, type:acc.type, debit:l.debit||0, credit:l.credit||0, narration:l.narration||v.narration||''});
      });
    });
    return Object.values(result).filter(r => selDept ? r.dept.id===selDept : true);
  }, [data.vouchers, data.coa, depts, fromDate, toDate, selDept]);

  const grandTotal = report.reduce((s,r) => s+r.expense, 0);

  const handleCSV = () => {
    let csv = 'Department,Total Expenses,Total Income\n';
    report.forEach(r => { csv += `"${r.dept.name}",${r.expense},${r.income}\n`; });
    downloadCSV('Department_Expenses.csv', csv);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Department Expense Report</h1>
          <div className="page-sub">Expense analysis by department / function</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>
          <button className="btn btn-sm btn-primary" onClick={()=>window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-body">
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>From</label>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>To</label>
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)'}} />
            </div>
            <div>
              <label style={{fontSize:11,color:'var(--ink-3)',display:'block',marginBottom:4}}>Department</label>
              <select value={selDept} onChange={e=>setSelDept(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid var(--line-2)',borderRadius:'var(--radius-sm)',minWidth:180,background:'var(--surface)'}}>
                <option value="">All Departments</option>
                {depts.map(d=><option key={d.id} value={d.id}>[{d.code}] {d.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {depts.length === 0 && (
        <div className="card"><div className="card-body" style={{textAlign:'center',padding:40,color:'var(--ink-3)'}}>
          <div style={{fontSize:12}}>No departments defined. Go to Masters → Department Master to create them.</div>
        </div></div>
      )}

      {/* Summary Bar Chart */}
      {report.length > 0 && grandTotal > 0 && (
        <div className="card" style={{marginBottom:18}}>
          <div className="card-body">
            <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Expense Distribution  ₹{fmt(grandTotal)} Total</div>
            {report.filter(r=>r.expense>0).sort((a,b)=>b.expense-a.expense).map(r => {
              const pct = grandTotal > 0 ? Math.round(r.expense/grandTotal*100) : 0;
              return (
                <div key={r.dept.id} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                    <span><b>[{r.dept.code}]</b> {r.dept.name}</span>
                    <span style={{fontFamily:'var(--mono)',fontWeight:600}}>₹{fmt(r.expense)} &nbsp;<span style={{color:'var(--ink-3)',fontWeight:400}}>({pct}%)</span></span>
                  </div>
                  <div style={{height:8,borderRadius:4,background:'var(--line)',overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:4,background:'var(--primary)',width:pct+'%',transition:'width .4s'}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.map(r => (
        <div key={r.dept.id} className="card" style={{marginBottom:18}}>
          <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid var(--line)',background:'var(--surface-2)'}}>
            <div>
              <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--primary)',marginRight:8}}>{r.dept.code}</span>
              <span style={{fontWeight:600,fontSize:14}}>{r.dept.name}</span>
              {r.dept.description && <span style={{color:'var(--ink-3)',fontSize:12,marginLeft:8}}> {r.dept.description}</span>}
            </div>
            <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:16,color:'var(--danger)'}}>₹{fmt(r.expense)}</div>
          </div>
          <div className="card-body">
            {/* By Account breakdown */}
            {Object.keys(r.byAccount).length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'var(--ink-2)'}}>Expense Breakdown by Account</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {Object.entries(r.byAccount).sort((a,b)=>b[1].amt-a[1].amt).map(([accId,info])=>(
                    <div key={accId} style={{background:'var(--danger-soft)',borderRadius:8,padding:'6px 12px',fontSize:12}}>
                      <span style={{color:'var(--ink-3)',fontFamily:'var(--mono)',marginRight:4}}>{accId}</span>
                      <span style={{fontWeight:500}}>{info.name}</span>
                      <span style={{color:'var(--danger)',fontWeight:700,marginLeft:8}}>₹{fmt(info.amt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {r.lines.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Voucher</th><th>Account</th><th>Type</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Credit</th><th>Narration</th></tr>
                  </thead>
                  <tbody>
                    {r.lines.sort((a,b)=>a.date.localeCompare(b.date)).map((l,i)=>(
                      <tr key={i}>
                        <td style={{fontFamily:'var(--mono)',fontSize:12}}>{l.date}</td>
                        <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{l.voucherNo}</td>
                        <td>{l.accId} · {l.accName}</td>
                        <td><span style={{fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600,
                          background:l.type==='Income'?'var(--primary-soft)':l.type==='Expense'?'var(--danger-soft)':'var(--info-soft)',
                          color:l.type==='Income'?'var(--primary)':l.type==='Expense'?'var(--danger)':'var(--info)'}}>{l.type}</span></td>
                        <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{l.debit>0?fmt(l.debit):''}</td>
                        <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>{l.credit>0?fmt(l.credit):''}</td>
                        <td style={{color:'var(--ink-3)',fontSize:12}}>{l.narration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r.lines.length === 0 && <div style={{textAlign:'center',color:'var(--ink-3)',padding:'20px 0',fontSize:12}}>No tagged transactions in selected period</div>}
          </div>
        </div>
      ))}
    </>
  );
}

// ============================================================================
// PERIOD FILTER  reusable date-range selector with FY / quarter presets
// ============================================================================
function PeriodFilter({data, from, to, onChange}){
  const fyStart = data.company.fyStart || '';
  const fyEnd   = data.company.fyEnd   || '';
  const fyY     = parseInt((fyStart||'2025-04-01').slice(0,4));

  const P = [
    {id:'fy',  label:'Full FY',      from: fyStart,              to: fyEnd},
    {id:'ytd', label:'YTD',          from: fyStart,              to: today()},
    {id:'q1',  label:'Q1 Apr–Jun',   from:`${fyY}-04-01`,        to:`${fyY}-06-30`},
    {id:'q2',  label:'Q2 Jul–Sep',   from:`${fyY}-07-01`,        to:`${fyY}-09-30`},
    {id:'q3',  label:'Q3 Oct–Dec',   from:`${fyY}-10-01`,        to:`${fyY}-12-31`},
    {id:'q4',  label:'Q4 Jan–Mar',   from:`${fyY+1}-01-01`,      to:`${fyY+1}-03-31`},
    {id:'h1',  label:'H1 (Apr–Sep)', from:`${fyY}-04-01`,        to:`${fyY}-09-30`},
    {id:'h2',  label:'H2 (Oct–Mar)', from:`${fyY}-10-01`,        to:`${fyY+1}-03-31`},
  ];
  const active = P.find(p => p.from===from && p.to===to);

  return (
    <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',background:'var(--surface-2)',padding:'8px 14px',borderRadius:'var(--radius)',border:'1px solid var(--line)'}}>
      <span style={{fontSize:10,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--ink-3)',marginRight:4}}>Period</span>
      {P.map(p=>(
        <button key={p.id} onClick={()=>onChange(p.from,p.to,p.label)}
          style={{padding:'3px 10px',borderRadius:20,border:'1px solid',fontSize:11,fontWeight:500,cursor:'pointer',
            background:active?.id===p.id?'var(--primary)':'var(--surface)',
            color:active?.id===p.id?'#fff':'var(--ink-2)',
            borderColor:active?.id===p.id?'var(--primary)':'var(--line-2)'}}>
          {p.label}
        </button>
      ))}
      <span style={{color:'var(--line-2)',margin:'0 2px'}}>|</span>
      <input type="date" value={from} onChange={e=>onChange(e.target.value,to,'Custom')}
        style={{padding:'3px 8px',border:'1px solid var(--line-2)',borderRadius:4,fontSize:12,background:'var(--surface)'}} />
      <span style={{color:'var(--ink-3)',fontSize:11}}>→</span>
      <input type="date" value={to} onChange={e=>onChange(from,e.target.value,'Custom')}
        style={{padding:'3px 8px',border:'1px solid var(--line-2)',borderRadius:4,fontSize:12,background:'var(--surface)'}} />
    </div>
  );
}

// ============================================================================
// LEDGER DRILL-DOWN MODAL  clickable from any report
// ============================================================================
function LedgerDrillModal({accountIds, title, data, from, to, onClose}){
  const ids = Array.isArray(accountIds) ? accountIds : [accountIds];
  const multiAcc = ids.length > 1;

  const {rows, openingBal} = useMemo(() => {
    let bal = ids.reduce((s,id)=>s+(data.coa.find(a=>a.id===id)?.opening||0),0);
    // Opening = COA opening + movements before 'from'
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      if(v.date >= from) return;
      (v.lines||[]).forEach(l => {
        if(ids.includes(l.accountId)) bal += (l.debit||0)-(l.credit||0);
      });
    });
    const lines = [];
    data.vouchers.forEach(v => {
      if(v.status==='Cancelled') return;
      if(v.date < from || v.date > to) return;
      (v.lines||[]).forEach(l => {
        if(!ids.includes(l.accountId)) return;
        const acc = data.coa.find(a=>a.id===l.accountId);
        lines.push({date:v.date, vno:v.number||v.id.slice(0,8), type:v.type,
          account: acc ? acc.id+' · '+acc.name : l.accountId,
          narration:l.narration||v.narration||'', dr:l.debit||0, cr:l.credit||0});
      });
    });
    lines.sort((a,b)=>a.date.localeCompare(b.date));
    return {rows:lines, openingBal:bal};
  }, [ids.join(','), from, to, data.vouchers]);

  let run = openingBal;
  const tableRows = rows.map(r => { run += r.dr-r.cr; return {...r, bal:run}; });
  const totalDr = rows.reduce((s,r)=>s+r.dr,0);
  const totalCr = rows.reduce((s,r)=>s+r.cr,0);
  const closingBal = openingBal + totalDr - totalCr;
  const balLabel = (v) => v>=0 ? `${fmt(v)} Dr` : `${fmt(-v)} Cr`;

  const handleCSV = () => {
    const hdr = multiAcc ? 'Date,Account,Voucher,Type,Narration,Debit,Credit,Balance\n'
                         : 'Date,Voucher,Type,Narration,Debit,Credit,Balance\n';
    const body = tableRows.map(r => multiAcc
      ? `${fmtDate(r.date)},"${r.account}",${r.vno},${r.type},"${r.narration}",${r.dr.toFixed(2)},${r.cr.toFixed(2)},${r.bal.toFixed(2)}`
      : `${fmtDate(r.date)},${r.vno},${r.type},"${r.narration}",${r.dr.toFixed(2)},${r.cr.toFixed(2)},${r.bal.toFixed(2)}`
    ).join('\n');
    downloadCSV(`Ledger_${title.replace(/[^a-z0-9]/gi,'_')}_${from}_${to}.csv`, hdr+body);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{maxWidth:900,maxHeight:'88vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header" style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:700}}>📒 {title}</span>
          <span style={{fontSize:11,color:'var(--ink-3)'}}>Period: {fmtDate(from)} → {fmtDate(to)}</span>
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button className="btn btn-sm" onClick={handleCSV}>⬇ CSV</button>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--ink-3)',lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{padding:'8px 16px',background:'var(--surface-2)',fontSize:12,borderBottom:'1px solid var(--line)',display:'flex',gap:24}}>
          <span>Opening: <b style={{fontFamily:'var(--mono)'}}>{balLabel(openingBal)}</b></span>
          <span>Period Debit: <b style={{fontFamily:'var(--mono)',color:'var(--primary)'}}>₹{fmt(totalDr)}</b></span>
          <span>Period Credit: <b style={{fontFamily:'var(--mono)',color:'var(--danger)'}}>₹{fmt(totalCr)}</b></span>
          <span>Closing: <b style={{fontFamily:'var(--mono)'}}>{balLabel(closingBal)}</b></span>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead style={{position:'sticky',top:0,background:'var(--surface-2)',zIndex:2}}>
              <tr>
                <th style={{padding:'8px 12px',textAlign:'left',borderBottom:'2px solid var(--line)'}}>Date</th>
                {multiAcc && <th style={{padding:'8px 12px',textAlign:'left',borderBottom:'2px solid var(--line)'}}>Account</th>}
                <th style={{padding:'8px 12px',textAlign:'left',borderBottom:'2px solid var(--line)'}}>Voucher</th>
                <th style={{padding:'8px 12px',textAlign:'left',borderBottom:'2px solid var(--line)'}}>Type</th>
                <th style={{padding:'8px 12px',textAlign:'left',borderBottom:'2px solid var(--line)'}}>Narration</th>
                <th style={{padding:'8px 12px',textAlign:'right',borderBottom:'2px solid var(--line)'}}>Debit (₹)</th>
                <th style={{padding:'8px 12px',textAlign:'right',borderBottom:'2px solid var(--line)'}}>Credit (₹)</th>
                <th style={{padding:'8px 12px',textAlign:'right',borderBottom:'2px solid var(--line)'}}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length===0 && (
                <tr><td colSpan={multiAcc?8:7} style={{textAlign:'center',padding:24,color:'var(--ink-3)'}}>No transactions in selected period</td></tr>
              )}
              {tableRows.map((r,i)=>(
                <tr key={i} style={{borderBottom:'1px solid var(--line)',background:i%2===0?'':'var(--surface-2)'}}>
                  <td style={{padding:'6px 12px',fontFamily:'var(--mono)',fontSize:12}}>{fmtDate(r.date)}</td>
                  {multiAcc && <td style={{padding:'6px 12px',fontSize:11,color:'var(--ink-3)'}}>{r.account}</td>}
                  <td style={{padding:'6px 12px',fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-3)'}}>{r.vno}</td>
                  <td style={{padding:'6px 12px'}}>
                    <span style={{fontSize:10,padding:'2px 6px',borderRadius:10,background:'var(--primary-soft)',color:'var(--primary)',fontWeight:600}}>{r.type}</span>
                  </td>
                  <td style={{padding:'6px 12px',color:'var(--ink-2)'}}>{r.narration}</td>
                  <td style={{padding:'6px 12px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--primary)'}}>{r.dr>0?fmt(r.dr):''}</td>
                  <td style={{padding:'6px 12px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--danger)'}}>{r.cr>0?fmt(r.cr):''}</td>
                  <td style={{padding:'6px 12px',textAlign:'right',fontFamily:'var(--mono)',fontWeight:600,color:r.bal>=0?'var(--ink)':'var(--danger)'}}>{balLabel(r.bal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{fontWeight:700,background:'var(--surface-2)',borderTop:'2px solid var(--line)'}}>
                <td colSpan={multiAcc?5:4} style={{padding:'8px 12px',textAlign:'right'}}>TOTAL</td>
                <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)'}}>₹{fmt(totalDr)}</td>
                <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)'}}>₹{fmt(totalCr)}</td>
                <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)'}}>{balLabel(closingBal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================
function Dashboard({data, balances, setPage, setData=()=>{}, showToast=()=>{}}){
  // ── Recurring entries due this month ───────────────────────────────────────
  const thisMonth = today().slice(0,7);
  const compDues = useMemo(() => complianceDues(data), [data]);
  const recurringDue = useMemo(() => {
    const templates = (data.vouchers||[]).filter(v => v.recurringMonthly && v.status !== 'Cancelled');
    // Latest template per (type + narration/party) chain; due if no copy exists this month
    const latestByChain = {};
    templates.forEach(v => {
      const chain = v.recurringSourceId || v.id;
      if(!latestByChain[chain] || v.date > latestByChain[chain].date) latestByChain[chain] = v;
    });
    return Object.values(latestByChain).filter(v => !v.date.startsWith(thisMonth));
  }, [data.vouchers, thisMonth]);

  // Every month from AFTER the template's last posting up to this month (catch-up).
  const missedMonths = (tmpl) => {
    const out = [];
    let [y, m] = tmpl.date.slice(0,7).split('-').map(Number);
    for(let i=0;i<60;i++){
      m++; if(m>12){ m=1; y++; }
      const key = `${y}-${String(m).padStart(2,'0')}`;
      out.push(key);
      if(key === thisMonth) break;
      if(key > thisMonth) { out.pop(); break; }
    }
    return out;
  };

  // Post a copy for each given month (default = every missed month → catch-up).
  const postRecurring = (tmpl, months) => {
    const targets = months || missedMonths(tmpl);
    if(!targets.length) return;
    const existing = (data.vouchers||[]).filter(v=>v.status!=='Cancelled').length;
    if(!isPremiumActive(data.company) && existing + targets.length > FREE_VOUCHER_LIMIT){
      showToast(`Free limit (${FREE_VOUCHER_LIMIT} entries) reached  upgrade to Premium`,'error'); return;
    }
    const day = tmpl.date.slice(8,10);
    const usable = targets.filter(mo => !isDateLocked(data.company, mo + '-' + day));
    if(!usable.length){ showToast('All target periods are locked','error'); return; }
    setData(prev => {
      let count = prev.vouchers.filter(x => x.type === tmpl.type).length;
      const adds = usable.map(mo => {
        count++;
        return {...tmpl, id:uid(), number: tmpl.type + '/' + String(count).padStart(4,'0'),
          date: mo + '-' + day,
          lines:(tmpl.lines||[]).map(l=>({...l, id:uid()})),
          items:(tmpl.items||[]).map(it=>({...it, id:uid()})),
          recurringSourceId: tmpl.recurringSourceId || tmpl.id,
          createdAt: new Date().toISOString()};
      });
      return {...prev, vouchers:[...prev.vouchers, ...adds],
        auditLog:[...(prev.auditLog||[]), auditEntry('RECURRING', `${adds.length}× ${tmpl.type} auto-posted (${usable[0]}${usable.length>1?'…'+usable[usable.length-1]:''})`)]};
    });
    showToast(`🔁 Posted ${usable.length} recurring ${tmpl.type}${usable.length>1?'s (catch-up)':''}`);
  };

  const stats = useMemo(() => {
    let income = 0, expense = 0, assets = 0, liab = 0;
    let cash = 0, bank = 0, debtors = 0, creditors = 0;
    let gstPay = 0, gstInput = 0;
    // Role-resolved id sets (COA-agnostic - works even if account codes were changed)
    const recvIds = acctIdSet(data, 'trade_receivable');
    const payIds  = acctIdSet(data, 'trade_payable');
    const outIds  = acctIdSet(data, 'gst_output');
    const inpIds  = acctIdSet(data, 'gst_input');
    data.coa.forEach(a => {
      const b = balances[a.id] || 0;
      if(a.type === 'Income') income += -b;
      if(a.type === 'Expense') expense += b;
      if(a.type === 'Asset' && !a.contra) assets += b;
      if(a.type === 'Liability') liab += -b;
      if(a.name.toLowerCase().includes('cash in hand')) cash += b;
      if(a.isBank) bank += b;
      if(recvIds.has(a.id)) debtors += b;
      if(payIds.has(a.id))  creditors += -b;
      if(outIds.has(a.id))  gstPay += -b;
      if(inpIds.has(a.id))  gstInput += b;
    });
    return {income, expense, profit:income-expense, assets, liab, cash, bank, debtors, creditors, gstPay, gstInput, netGst:gstPay-gstInput};
  }, [data.coa, balances]);

  const recentVouchers = [...(data.vouchers||[])].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome back</h1>
          <div className="page-sub">Your financial pulse · {data.company.name}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setPage('vouchers')}>View Vouchers</button>
          <button className="btn btn-primary" onClick={() => setPage('vouchers')}>+ New Entry</button>
        </div>
      </div>

      {/* Statutory compliance reminders */}
      {compDues.length > 0 && (
        <div className="card" style={{marginBottom:16,border:'1px solid var(--line)'}}>
          <div className="card-body" style={{padding:'14px 18px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
              <div style={{fontWeight:700,fontSize:13}}>📅 Statutory Dues - Compliance Reminders</div>
              <button className="btn btn-sm" onClick={()=>setPage('compliance')}>Open Calendar →</button>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {compDues.sort((a,b)=>a.days-b.days).map(d=>(
                <div key={d.key} style={{flex:'1 1 170px',minWidth:160,border:`1px solid ${d.days<0?'var(--danger)':d.days<=7?'#ffcc80':'var(--line-2)'}`,
                  borderRadius:8,padding:'10px 12px',background:d.days<0?'#fdecea':d.days<=7?'#fff8e1':'var(--surface)'}}>
                  <div style={{fontSize:11,color:'var(--ink-3)'}}>{d.label}</div>
                  <div style={{fontWeight:700,fontSize:15,color:d.color}}>₹{fmt(d.amount)}</div>
                  <div style={{fontSize:10.5,color:d.days<0?'var(--danger)':d.days<=7?'#e65100':'var(--ink-3)',marginTop:2}}>
                    Due {fmtDate(d.due)} · {d.days<0?`${-d.days}d overdue ⚠`:`in ${d.days}d`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recurring entries due this month */}
      {recurringDue.length > 0 && (
        <div className="card" style={{marginBottom:16,border:'1px solid var(--accent)',background:'#fffdf5'}}>
          <div className="card-body" style={{padding:'14px 18px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
              <div style={{fontWeight:700,fontSize:13}}>🔁 Recurring Entries Due  {thisMonth}</div>
              <button className="btn btn-sm btn-primary" onClick={()=>recurringDue.forEach(postRecurring)}>
                ✓ Post All ({recurringDue.length})
              </button>
            </div>
            {recurringDue.map(t => {
              const miss = missedMonths(t);
              return (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'7px 0',borderTop:'1px solid var(--line-2)',fontSize:12}}>
                  <span className="badge badge-info" style={{fontSize:10}}>{t.type}</span>
                  <span style={{flex:1}}>{t.narration || t.partyName || t.number}
                    <span style={{color:'var(--ink-3)'}}> · last posted {fmtDate(t.date)}</span>
                    {miss.length>1 && <span style={{color:'var(--danger)',fontWeight:700}}> · {miss.length} months due</span>}
                  </span>
                  <span style={{fontFamily:'var(--mono)',fontWeight:600}}>₹{fmt(t.amount||0)}</span>
                  <button className="btn btn-sm" style={{fontSize:11}} onClick={()=>postRecurring(t)}>
                    {miss.length>1 ? `Post all ${miss.length}` : 'Post'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low-stock alert (below reorder level) */}
      {(() => {
        const items = (data.stockItems||[]).filter(i=>i.active!==false && (i.reorderLevel||0)>0);
        if(!items.length) return null;
        const qty = {}; items.forEach(i=>qty[i.id]=i.openingQty||0);
        (data.vouchers||[]).forEach(v=>{
          if(v.status==='Cancelled') return;
          (v.items||[]).forEach(it=>{
            if(!it.itemId || !(it.itemId in qty)) return;
            if(v.type==='PUR' || v.type==='CRN') qty[it.itemId]+=it.qty||0;
            if(v.type==='SAL' || v.type==='DBN') qty[it.itemId]-=it.qty||0;
          });
        });
        (data.productionOrders||[]).forEach(po=>{
          if(po.status!=='Posted') return;
          (po.consumptions||[]).forEach(c=>{ if(c.itemId in qty) qty[c.itemId]-=c.qty||0; });
          if(po.fgItemId in qty) qty[po.fgItemId]+=po.fgQty||0;
        });
        const low = items.filter(i=>qty[i.id] <= (i.reorderLevel||0)).sort((a,b)=>(qty[a.id]/(a.reorderLevel||1))-(qty[b.id]/(b.reorderLevel||1)));
        if(!low.length) return null;
        return (
          <div className="card" style={{marginBottom:16,border:'1px solid var(--danger)',background:'#fff8f8'}}>
            <div className="card-body" style={{padding:'14px 18px'}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>📦 Low Stock - {low.length} item{low.length>1?'s':''} at or below reorder level</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {low.slice(0,8).map(i=>(
                  <span key={i.id} style={{background:'#fff',border:'1px solid var(--danger)',borderRadius:20,padding:'4px 12px',fontSize:11}}>
                    <b>{i.name}</b>: {Math.round(qty[i.id]*100)/100} {i.unit} <span style={{color:'var(--ink-3)'}}>(reorder at {i.reorderLevel})</span>
                  </span>
                ))}
                {low.length>8 && <span style={{fontSize:11,color:'var(--ink-3)',alignSelf:'center'}}>+{low.length-8} more…</span>}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="stat-grid">
        <div className="stat stat-green">
          <div className="stat-label">Revenue (YTD)</div>
          <div className="stat-value rupee">₹{fmt(stats.income)}</div>
          <div className="stat-delta">From all sales accounts</div>
        </div>
        <div className="stat stat-danger">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value rupee">₹{fmt(stats.expense)}</div>
          <div className="stat-delta">Operating + finance</div>
        </div>
        <div className={'stat ' + (stats.profit>=0?'':'stat-danger')}>
          <div className="stat-label">Net Profit / (Loss)</div>
          <div className="stat-value rupee">₹{fmt(stats.profit)}</div>
          <div className={'stat-delta ' + (stats.profit>=0?'up':'down')}>
            Margin: {stats.income? ((stats.profit/stats.income)*100).toFixed(1) : '0.0'}%
          </div>
        </div>
        <div className="stat stat-teal">
          <div className="stat-label">Cash + Bank</div>
          <div className="stat-value rupee">₹{fmt(stats.cash + stats.bank)}</div>
          <div className="stat-delta">Liquid position</div>
        </div>
        <div className="stat stat-info">
          <div className="stat-label">Trade Receivables</div>
          <div className="stat-value rupee">₹{fmt(stats.debtors)}</div>
          <div className="stat-delta">From customers</div>
        </div>
        <div className="stat stat-purple">
          <div className="stat-label">Trade Payables</div>
          <div className="stat-value rupee">₹{fmt(stats.creditors)}</div>
          <div className="stat-delta">To vendors</div>
        </div>
        <div className="stat stat-gold">
          <div className="stat-label">GST Net Payable</div>
          <div className="stat-value rupee">₹{fmt(stats.netGst)}</div>
          <div className="stat-delta">Output − Input ITC</div>
        </div>
        <div className="stat stat-pink">
          <div className="stat-label">Total Vouchers</div>
          <div className="stat-value rupee">{data.vouchers.length}</div>
          <div className="stat-delta">Entries posted</div>
        </div>
      </div>

      {/* Monthly Revenue / Expense / Profit trend */}
      {(() => {
        const fy = data.company.fyStart || (today().slice(0,4)+'-04-01');
        const y0 = parseInt(fy.slice(0,4));
        const months = [];
        for(let i=0;i<12;i++){ const m=4+i; const yy=y0+(m>12?1:0); const mm=((m-1)%12)+1; months.push(`${yy}-${String(mm).padStart(2,'0')}`); }
        const agg = {}; months.forEach(k=>agg[k]={rev:0,exp:0});
        (data.vouchers||[]).forEach(v=>{
          if(v.status==='Cancelled') return; const k=v.date.slice(0,7); if(!(k in agg)) return;
          if(v.type==='SAL') agg[k].rev += v.total||v.amount||0;
          if(v.type==='CRN') agg[k].rev -= v.total||v.amount||0;
          if(v.type==='PUR') agg[k].exp += v.total||v.amount||0;
          if(v.type==='DBN') agg[k].exp -= v.total||v.amount||0;
        });
        const data12 = months.map(k=>({k, mon:parseInt(k.slice(5)), ...agg[k], profit:agg[k].rev-agg[k].exp}));
        const hasData = data12.some(d=>d.rev||d.exp);
        if(!hasData) return null;
        const MN=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const W=760,H=210,padL=44,padR=10,padT=12,padB=24;
        const maxV=Math.max(1,...data12.map(d=>Math.max(d.rev,d.exp)));
        const bw=(W-padL-padR)/data12.length;
        const y=v=>padT+(1-v/maxV)*(H-padT-padB);
        const grid=[0,.25,.5,.75,1].map(f=>({v:Math.round(maxV*(1-f)),yy:padT+f*(H-padT-padB)}));
        return (
          <div className="card" style={{marginBottom:18}}>
            <div className="card-head"><h3 className="card-title">Revenue vs Expense - Monthly (FY {y0}–{String(y0+1).slice(2)})</h3>
              <span style={{fontSize:11}}>
                <span style={{color:'var(--green)'}}>■</span> Revenue &nbsp;
                <span style={{color:'var(--danger)'}}>■</span> Expense &nbsp;
                <span style={{color:'var(--primary)'}}>▬</span> Profit
              </span>
            </div>
            <div className="card-body" style={{padding:'12px 16px',overflowX:'auto'}}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',minWidth:560,height:'auto'}}>
                {grid.map((g,i)=>(<g key={i}>
                  <line x1={padL} y1={g.yy} x2={W-padR} y2={g.yy} stroke="var(--line)" strokeWidth="1" />
                  <text x={padL-6} y={g.yy+3} textAnchor="end" fontSize="9" fill="var(--ink-3)">{g.v>=100000?(g.v/100000).toFixed(1)+'L':g.v>=1000?(g.v/1000).toFixed(0)+'k':g.v}</text>
                </g>))}
                {data12.map((d,i)=>{ const x=padL+i*bw; return (<g key={i}>
                  <rect x={x+bw*0.18} y={y(d.rev)} width={bw*0.28} height={Math.max(0,y(0)-y(d.rev))} fill="var(--green)" opacity="0.85" rx="1" />
                  <rect x={x+bw*0.52} y={y(d.exp)} width={bw*0.28} height={Math.max(0,y(0)-y(d.exp))} fill="var(--danger)" opacity="0.8" rx="1" />
                  <text x={x+bw*0.5} y={H-8} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{MN[d.mon]}</text>
                </g>); })}
                <polyline points={data12.map((d,i)=>`${padL+i*bw+bw*0.5},${y(d.profit).toFixed(1)}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="2" />
                {data12.map((d,i)=><circle key={'p'+i} cx={padL+i*bw+bw*0.5} cy={y(d.profit)} r="2.3" fill="var(--primary)" />)}
              </svg>
            </div>
          </div>
        );
      })()}

      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:18}}>
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Recent Vouchers</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage('daybook')}>Open Day Book →</button>
          </div>
          <div className="card-body" style={{padding:0}}>
            {recentVouchers.length === 0 ? (
              <div className="empty">
                <div className="empty-ico">◌</div>
                <div>No vouchers yet. Start by adding your first entry.</div>
                <button className="btn btn-primary" style={{marginTop:14}} onClick={() => setPage('vouchers')}>+ Create Voucher</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th>No.</th><th>Narration</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {recentVouchers.map(v => (
                    <tr key={v.id}>
                      <td>{fmtDate(v.date)}</td>
                      <td><span className="badge badge-info">{v.type}</span></td>
                      <td style={{fontFamily:'var(--mono)'}}>{v.number}</td>
                      <td>{v.narration||''}</td>
                      <td className="num">₹{fmt(v.amount||0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3 className="card-title">Quick Actions</h3></div>
          <div className="card-body" style={{display:'flex', flexDirection:'column', gap:8}}>
            <button className="btn" style={{justifyContent:'flex-start'}} onClick={() => setPage('vouchers')}>⇡ New Sales Invoice</button>
            <button className="btn" style={{justifyContent:'flex-start'}} onClick={() => setPage('vouchers')}>⇣ New Purchase Entry</button>
            <button className="btn" style={{justifyContent:'flex-start'}} onClick={() => setPage('vouchers')}>← Record Receipt</button>
            <button className="btn" style={{justifyContent:'flex-start'}} onClick={() => setPage('vouchers')}>→ Record Payment</button>
            <button className="btn" style={{justifyContent:'flex-start'}} onClick={() => setPage('gstr3b')}>◑ View GSTR-3B</button>
            <button className="btn" style={{justifyContent:'flex-start'}} onClick={() => setPage('bs')}>⊠ View Balance Sheet</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================
// ============================================================================
// CSV IMPORT MODAL  (shared by COA / Vouchers / Employees)
// ============================================================================
function CsvImportModal({ title, sampleHeaders, sampleRows, sampleFilename, onImport, onClose }) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(0);
  const [done, setDone] = useState(false);

  const handleDownloadSample = () => {
    const header = sampleHeaders.join(',');
    const sample = sampleRows.map(r => sampleHeaders.map(h => (r[h]||'')).join(',')).join('\n');
    downloadCSV(sampleFilename, header + '\n' + sample);
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    setError(''); setRows([]); setHeaders([]); setDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers: h, rows: r } = parseCSV(ev.target.result);
      if(r.length === 0){ setError('No data rows found in CSV.'); return; }
      const missing = sampleHeaders.slice(0,2).filter(req => !h.includes(req));
      if(missing.length){ setError('Missing required columns: ' + missing.join(', ')); return; }
      setHeaders(h); setRows(r);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = () => {
    const result = onImport(rows);
    if(result.error){ setError(result.error); return; }
    setImported(result.count);
    setDone(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()} style={{maxWidth:780}}>
        <div className="modal-head">
          <h2 className="modal-title">📥 {title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{background:'var(--surface-2)',borderRadius:10,padding:'14px 18px',marginBottom:16,border:'1px solid var(--line)'}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:5}}>Step 1  Download the sample template</div>
            <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:10}}>Fill in your data and save as CSV. Do not rename the column headers.</div>
            {/* Expected columns so the user knows exactly which fields to enter */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--ink-2)',marginBottom:6}}>Columns expected ({sampleHeaders.length}) - <span style={{color:'var(--danger)'}}>★ required</span>:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {sampleHeaders.map((h,i) => (
                  <span key={h} style={{fontSize:11,fontFamily:'var(--mono)',background:'var(--surface)',border:'1px solid var(--line)',
                    borderRadius:6,padding:'3px 9px',color: i<2?'var(--danger)':'var(--ink-2)',fontWeight: i<2?700:400}}>
                    {i<2?'★ ':''}{h}
                  </span>
                ))}
              </div>
            </div>
            <button className="btn btn-sm" onClick={handleDownloadSample}>⬇ Download Sample CSV Template</button>
          </div>
          <div style={{background:'var(--surface-2)',borderRadius:10,padding:'14px 18px',marginBottom:16,border:'1px solid var(--line)'}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:5}}>Step 2  Upload your filled CSV</div>
            <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{fontSize:13}} />
          </div>
          {rows.length > 0 && !done && (
            <div style={{marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>Preview  {rows.length} row{rows.length>1?'s':''} ready to import</div>
              <div style={{overflowX:'auto',maxHeight:220,border:'1px solid var(--line)',borderRadius:8}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead><tr style={{background:'var(--surface-2)'}}>
                    {headers.map(h => <th key={h} style={{padding:'6px 10px',textAlign:'left',borderBottom:'1px solid var(--line)',whiteSpace:'nowrap'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.slice(0,10).map((r,i) => (
                      <tr key={i} style={{borderBottom:'1px solid var(--line-2)'}}>
                        {headers.map(h => <td key={h} style={{padding:'5px 10px',whiteSpace:'nowrap',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}>{r[h]}</td>)}
                      </tr>
                    ))}
                    {rows.length > 10 && <tr><td colSpan={headers.length} style={{padding:'6px 10px',color:'var(--ink-3)',textAlign:'center'}}>…and {rows.length-10} more rows</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {error && <div style={{background:'var(--danger-soft)',color:'var(--danger)',borderRadius:8,padding:'10px 14px',fontSize:12,marginBottom:12}}>⚠ {error}</div>}
          {done && <div style={{background:'var(--success-soft)',color:'var(--success)',borderRadius:8,padding:'10px 14px',fontSize:12,marginBottom:12}}>✓ Successfully imported {imported} record{imported!==1?'s':''}.</div>}
        </div>
        <div className="modal-foot">
          {done ? (
            <button className="btn btn-primary" onClick={onClose}>✓ Close</button>
          ) : (<>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={rows.length===0}>
              ↑ Import {rows.length > 0 ? rows.length + ' Rows' : ''}
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INVITE MODAL
// ============================================================================
function InviteModal({ ownerId, companyId, companyName, onClose }) {
  const [role, setRole] = useState('limited');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const FONT = '"Inter",-apple-system,BlinkMacSystemFont,sans-serif';

  const ROLES = [
    { value:'admin',   label:'Admin',          desc:'Full access  vouchers, COA, employees, settings (cannot delete company or manage members)' },
    { value:'limited', label:'Limited',         desc:'Can post vouchers and view reports; cannot change master data or settings' },
    { value:'viewer',  label:'Viewer / Auditor',desc:'Read-only  view all data but cannot make any changes' },
  ];

  const handleGenerate = async () => {
    setLoading(true);
    try { const c = await fbCreateInvite(ownerId, companyId, companyName, role); setCode(c); }
    catch(e){ alert('Failed to create invite: ' + e.message); }
    finally { setLoading(false); }
  };

  const copyCode = () => {
    const link = `${location.origin}${location.pathname}#invite=${code}`;
    navigator.clipboard.writeText(link).catch(() => navigator.clipboard.writeText(code));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,fontFamily:FONT}}>
      <div style={{background:'#fff',borderRadius:16,padding:'28px 28px 22px',maxWidth:460,width:'90%',boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:16,color:'#0e2a23'}}>🔗 Invite Team Member</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#6b7f78',lineHeight:1}}>✕</button>
        </div>
        <div style={{fontSize:12,color:'#6b7f78',marginBottom:18}}>Sharing: <b style={{color:'#0e2a23'}}>{companyName}</b></div>
        {!code ? (<>
          <div style={{fontSize:12,fontWeight:600,color:'#3a4f49',marginBottom:8}}>Select Access Level</div>
          {ROLES.map(r => (
            <label key={r.value} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',border:`1.5px solid ${role===r.value?'#0b6b4f':'#e3ebe7'}`,borderRadius:8,cursor:'pointer',marginBottom:7,background:role===r.value?'#e6f3ee':'#fff'}}>
              <input type="radio" name="invRole" value={r.value} checked={role===r.value} onChange={() => setRole(r.value)} style={{marginTop:3}} />
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'#0e2a23'}}>{r.label}</div>
                <div style={{fontSize:11,color:'#6b7f78',marginTop:2}}>{r.desc}</div>
              </div>
            </label>
          ))}
          <button onClick={handleGenerate} disabled={loading}
            style={{width:'100%',background:loading?'#8fb5a8':'#0b6b4f',color:'#fff',border:'none',borderRadius:9,padding:'12px',fontSize:13,fontWeight:600,cursor:loading?'not-allowed':'pointer',marginTop:6,fontFamily:FONT}}>
            {loading ? 'Generating…' : '✓ Generate Invite Code'}
          </button>
        </>) : (<>
          <div style={{background:'#f9fbf9',borderRadius:10,padding:'14px 16px',border:'1px solid #e3ebe7',marginBottom:12,textAlign:'center'}}>
            <div style={{fontSize:11,color:'#6b7f78',marginBottom:6}}>Invite Code (valid 7 days)</div>
            <div style={{fontFamily:'monospace',fontSize:26,fontWeight:700,color:'#0b6b4f',letterSpacing:4}}>{code}</div>
          </div>
          <div style={{fontSize:11,color:'#6b7f78',marginBottom:14}}>Share this code with your team member. They enter it via <b>"Have an invite code?"</b> on the company selection screen.</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={copyCode} style={{flex:1,background:copied?'#0b6b4f':'#fff',color:copied?'#fff':'#0b6b4f',border:'1.5px solid #0b6b4f',borderRadius:8,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:FONT}}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
            <button onClick={onClose} style={{flex:1,background:'#0b6b4f',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:FONT}}>Done</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ============================================================================
// TEAM MEMBERS PAGE
// ============================================================================
function TeamMembers({ data, user, companyId, userRole }) {
  const [members,  setMembers]  = useState(null);
  const [pending,  setPending]  = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null); // member obj to confirm

  const ROLE_CLR = { owner:'#0b6b4f', admin:'#1976d2', limited:'#f57c00', viewer:'#757575' };
  const ROLE_LBL = { owner:'Owner', admin:'Admin', limited:'Limited', viewer:'Viewer / Auditor' };

  const load = async () => {
    const [list, pend] = await Promise.all([
      fbListMembers(user.uid, companyId),
      fbGetPendingInvites(user.uid, companyId),
    ]);
    setMembers(list);
    setPending(pend);
  };
  useEffect(() => { if(FB_CONFIGURED && user && companyId) load(); else setMembers([]); }, [companyId]);

  const handleRevoke = async (m) => {
    setRevoking(m.memberUid);
    setConfirmRevoke(null);
    try { await fbRevokeAccess(m.memberUid, companyId); await load(); }
    catch(e){ alert('Failed: ' + e.message); }
    finally { setRevoking(null); }
  };

  const handleCancelInvite = async (code) => {
    setCancelling(code);
    try { await fbCancelInvite(code); await load(); }
    catch(e){ alert('Failed: ' + e.message); }
    finally { setCancelling(null); }
  };

  const isOwner = !userRole || userRole === 'owner';

  const Avatar = ({name, email}) => {
    const initials = (name||email||'?').trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const colors = ['#0b6b4f','#1976d2','#7b1fa2','#c62828','#f57c00','#00838f'];
    const clr = colors[(name||email||'').charCodeAt(0)%colors.length];
    return (
      <div style={{width:38,height:38,borderRadius:'50%',background:clr,display:'flex',
        alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>
        {initials}
      </div>
    );
  };

  // Summary stats
  const totalActive = (members||[]).length;
  const byRole = (members||[]).reduce((acc,m)=>{ acc[m.role]=(acc[m.role]||0)+1; return acc; },{});

  return (<>
    <div className="page-head">
      <div>
        <h1 className="page-title">Team Members</h1>
        <div className="page-sub">{data.company.name} · {1 + totalActive} user{1+totalActive!==1?'s':''} with access</div>
      </div>
      {isOwner && <div className="page-actions">
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}>+ Invite Member</button>
      </div>}
    </div>

    {/* Stats row */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
      {[
        { label:'Total Users', value: 1 + totalActive, icon:'👥', color:'#0b6b4f' },
        { label:'Active Members', value: totalActive, icon:'✅', color:'#1976d2' },
        { label:'Pending Invites', value: pending.length, icon:'⏳', color:'#f57c00' },
        { label:'Admins', value: (byRole['admin']||0), icon:'🔑', color:'#7b1fa2' },
      ].map(s => (
        <div key={s.label} className="card" style={{padding:'14px 18px'}}>
          <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
          <div style={{fontSize:26,fontWeight:700,color:s.color,lineHeight:1}}>{s.value}</div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginTop:3}}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* You  owner row */}
    <div style={{fontWeight:700,fontSize:11,color:'var(--ink-3)',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:8}}>You (Owner)</div>
    <div className="card" style={{marginBottom:20}}>
      <div className="card-body" style={{padding:'14px 18px'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Avatar name={user?.displayName} email={user?.email} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:600,fontSize:14,color:'var(--ink)'}}>{user?.displayName || ''}</div>
            <div style={{fontSize:12,color:'var(--ink-3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div>
          </div>
          <span style={{background:'#0b6b4f22',color:'#0b6b4f',borderRadius:20,padding:'4px 14px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>Owner</span>
        </div>
      </div>
    </div>

    {/* Active Members Table */}
    <div style={{fontWeight:700,fontSize:11,color:'var(--ink-3)',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:8}}>
      Active Members ({totalActive})
    </div>
    {members === null ? (
      <div style={{textAlign:'center',padding:32,color:'var(--ink-3)'}}>Loading…</div>
    ) : members.length === 0 ? (
      <div className="card" style={{marginBottom:20}}>
        <div className="card-body" style={{textAlign:'center',padding:'32px 20px',color:'var(--ink-3)'}}>
          <div style={{fontSize:28,marginBottom:8}}>👥</div>
          <div style={{fontWeight:600,marginBottom:4}}>No members yet</div>
          <div style={{fontSize:12,marginBottom:14}}>Invite team members to collaborate.</div>
          {isOwner && <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>+ Invite First Member</button>}
        </div>
      </div>
    ) : (
      <div className="card" style={{marginBottom:20}}>
        <div className="card-body" style={{padding:0,overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
                <th style={{padding:'10px 14px',textAlign:'left',width:40}}>Sr</th>
                <th style={{padding:'10px 14px',textAlign:'left',width:44}}></th>
                <th style={{padding:'10px 14px',textAlign:'left'}}>Name</th>
                <th style={{padding:'10px 14px',textAlign:'left'}}>Email ID</th>
                <th style={{padding:'10px 14px',textAlign:'left',width:120}}>Access Type</th>
                <th style={{padding:'10px 14px',textAlign:'left',width:110}}>Joined</th>
                <th style={{padding:'10px 14px',textAlign:'center',width:80}}>Status</th>
                {isOwner && <th style={{padding:'10px 14px',textAlign:'center',width:180}}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {/* Owner row */}
              <tr style={{borderBottom:'1px solid var(--line-2)',background:'#f0fdf4'}}>
                <td style={{padding:'11px 14px',color:'var(--ink-3)',fontSize:12}}>1</td>
                <td style={{padding:'11px 14px'}}><Avatar name={user?.displayName} email={user?.email} /></td>
                <td style={{padding:'11px 14px',fontWeight:600}}>{user?.displayName || ''} <span style={{fontSize:10,color:'var(--ink-3)',fontWeight:400}}>(You)</span></td>
                <td style={{padding:'11px 14px',color:'var(--ink-3)',fontSize:12}}>{user?.email}</td>
                <td style={{padding:'11px 14px'}}><span style={{background:'#0b6b4f22',color:'#0b6b4f',borderRadius:20,padding:'3px 12px',fontSize:11,fontWeight:700}}>Owner</span></td>
                <td style={{padding:'11px 14px',fontSize:11,color:'var(--ink-3)'}}></td>
                <td style={{padding:'11px 14px',textAlign:'center'}}><span className="badge badge-success" style={{fontSize:10}}>Active</span></td>
                {isOwner && <td style={{padding:'11px 14px',textAlign:'center',color:'var(--ink-3)',fontSize:11}}></td>}
              </tr>
              {members.map((m, idx) => (
                <tr key={m.memberUid} style={{borderBottom:'1px solid var(--line-2)'}}>
                  <td style={{padding:'11px 14px',color:'var(--ink-3)',fontSize:12}}>{idx+2}</td>
                  <td style={{padding:'11px 14px'}}><Avatar name={m.memberName} email={m.memberEmail} /></td>
                  <td style={{padding:'11px 14px',fontWeight:600,color:'var(--ink)'}}>
                    {m.memberName || <span style={{color:'var(--ink-3)',fontStyle:'italic'}}>Name not set</span>}
                  </td>
                  <td style={{padding:'11px 14px',color:'var(--ink-3)',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {m.memberEmail || m.memberUid}
                  </td>
                  <td style={{padding:'11px 14px'}}>
                    <span style={{background:ROLE_CLR[m.role]+'22',color:ROLE_CLR[m.role],borderRadius:20,padding:'3px 12px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                      {ROLE_LBL[m.role]||m.role}
                    </span>
                  </td>
                  <td style={{padding:'11px 14px',fontSize:11,color:'var(--ink-3)',whiteSpace:'nowrap'}}>
                    {m.grantedAt?.toDate ? m.grantedAt.toDate().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : ''}
                  </td>
                  <td style={{padding:'11px 14px',textAlign:'center'}}>
                    <span className="badge badge-success" style={{fontSize:10}}>Active</span>
                  </td>
                  {isOwner && (
                    <td style={{padding:'8px 14px',textAlign:'center'}}>
                      {confirmRevoke?.memberUid === m.memberUid ? (
                        <div style={{display:'flex',gap:6,alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontSize:10,color:'var(--danger)',whiteSpace:'nowrap'}}>Confirm?</span>
                          <button className="btn btn-sm btn-danger" style={{padding:'3px 10px',fontSize:11}} onClick={() => handleRevoke(m)} disabled={revoking===m.memberUid}>
                            {revoking===m.memberUid ? '…' : 'Yes'}
                          </button>
                          <button className="btn btn-sm btn-ghost" style={{padding:'3px 10px',fontSize:11}} onClick={() => setConfirmRevoke(null)}>No</button>
                        </div>
                      ) : (
                        <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                          <button className="btn btn-sm btn-danger" style={{opacity:.75,fontSize:11}} onClick={() => setConfirmRevoke(m)}>
                            🔒 Revoke
                          </button>
                          <button className="btn btn-sm" style={{fontSize:11,opacity:.5,cursor:'not-allowed'}} title="Member is active  revoke first to reactivate via a new invite" disabled>
                            ↺ Reactivate
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* Pending Invites */}
    {isOwner && (
      <>
        <div style={{fontWeight:700,fontSize:11,color:'var(--ink-3)',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:8}}>
          Pending Invites ({pending.length})
        </div>
        {pending.length === 0 ? (
          <div className="card" style={{marginBottom:20}}>
            <div className="card-body" style={{fontSize:12,color:'var(--ink-3)',textAlign:'center',padding:'18px'}}>No pending invites.</div>
          </div>
        ) : (
          <div className="card" style={{marginBottom:20}}>
            <div className="card-body" style={{padding:0}}>
              {pending.map((inv, idx) => (
                <div key={inv.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 18px',borderBottom:idx<pending.length-1?'1px solid var(--line-2)':'none'}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:'#fff8e1',border:'2px dashed #ffe082',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>⏳</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:'var(--ink)',letterSpacing:2}}>{inv.id}</div>
                    <div style={{fontSize:11,color:'var(--ink-3)',marginTop:2}}>
                      Role: <b>{ROLE_LBL[inv.role]||inv.role}</b> ·
                      Created {inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString('en-IN') : ''} ·
                      Expires {inv.expiresAt?.toDate ? inv.expiresAt.toDate().toLocaleDateString('en-IN') : ''}
                    </div>
                  </div>
                  <span style={{background:'#fff8e1',color:'#f57c00',borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700}}>Pending</span>
                  <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)',opacity:.7}}
                    onClick={() => handleCancelInvite(inv.id)} disabled={cancelling===inv.id}>
                    {cancelling===inv.id ? '…' : 'Cancel'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )}

    {/* Role guide */}
    <div style={{fontWeight:700,fontSize:11,color:'var(--ink-3)',letterSpacing:'.8px',textTransform:'uppercase',marginBottom:8}}>Role Permissions</div>
    <div className="card" style={{marginBottom:20}}>
      <div className="card-body" style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
            <th style={{padding:'10px 16px',textAlign:'left'}}>Permission</th>
            {['Owner','Admin','Limited','Viewer'].map(r => (
              <th key={r} style={{padding:'10px 16px',textAlign:'center',whiteSpace:'nowrap'}}>{r}</th>
            ))}
          </tr></thead>
          <tbody>{[
            ['View all data & reports',    true,true,true,true],
            ['Post & edit vouchers',       true,true,true,false],
            ['Manage COA & parties',       true,true,false,false],
            ['Manage employees',           true,true,false,false],
            ['Company settings',           true,true,false,false],
            ['Invite / revoke members',    true,false,false,false],
            ['Delete company',             true,false,false,false],
          ].map(([perm,...vals]) => (
            <tr key={perm} style={{borderBottom:'1px solid var(--line-2)'}}>
              <td style={{padding:'9px 16px'}}>{perm}</td>
              {vals.map((v,i) => (
                <td key={i} style={{padding:'9px 16px',textAlign:'center',fontSize:15,color:v?'#0b6b4f':'#d0d0d0'}}>{v?'✓':''}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>

    {showInvite && <InviteModal ownerId={user.uid} companyId={companyId} companyName={data.company.name}
      onClose={() => { setShowInvite(false); load(); }} />}
  </>);
}
