// ============================================================================
// SETUP WIZARD  a guided first ten minutes instead of 70 empty menus.
// ----------------------------------------------------------------------------
// A new user landed on a dashboard with seventy navigation entries and a chart
// of accounts full of sample data - powerful, but intimidating, and the sample
// identity ("My MSME Enterprises") would print onto real invoices if untouched.
// This wizard captures the few things every company must set - identity, GSTIN,
// state, financial year, which modules apply, and (optionally) the UPI ID for
// pay-by-QR - then marks the company onboarded so it never shows again. It only
// appears for a company still carrying the default sample identity, so it never
// interrupts anyone who has already set themselves up.
// ============================================================================

// Show only for a brand-new company that still has the placeholder identity.
const wizardShouldShow = (company) => !!company
  && company.onboarded !== true
  && (company.name === DEFAULT_COMPANY.name || company.gstin === DEFAULT_COMPANY.gstin || !company.gstin);

// GSTIN carries the state code in positions 1-2; keep state in sync as it's typed.
const gstinStateCode = (gstin) => (String(gstin||'').match(/^(\d{2})/) || [])[1] || '';

function SetupWizard({data, setData, onClose}){
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => {
    const c = data.company || {};
    const looksDefault = c.name === DEFAULT_COMPANY.name;
    return {
      name: looksDefault ? '' : (c.name || ''),
      gstin: c.gstin === DEFAULT_COMPANY.gstin ? '' : (c.gstin || ''),
      pan:  c.pan === DEFAULT_COMPANY.pan ? '' : (c.pan || ''),
      stateCode: c.stateCode || '',
      address: looksDefault ? '' : (c.address || ''),
      email: c.email === DEFAULT_COMPANY.email ? '' : (c.email || ''),
      phone: c.phone === DEFAULT_COMPANY.phone ? '' : (c.phone || ''),
      upiId: c.upiId || '',
      fyStart: c.fyStart || '2025-04-01',
      modules: { ...(c.modules || DEFAULT_COMPANY.modules) },
    };
  });

  const setMod = (k, v) => setF(prev => ({ ...prev, modules: { ...prev.modules, [k]: v } }));
  // When GSTIN is entered, auto-fill state and PAN (chars 3-12 of a GSTIN are the PAN).
  const onGstin = (raw) => {
    const g = raw.toUpperCase().trim();
    const sc = gstinStateCode(g);
    setF(prev => ({ ...prev, gstin: g,
      stateCode: sc || prev.stateCode,
      pan: (g.length >= 12 && !prev.pan) ? g.slice(2, 12) : prev.pan }));
  };

  const fyLabel = (start) => { const y = parseInt(String(start).slice(0,4)) || 2025; return `FY ${y}-${String((y+1)%100).padStart(2,'0')}`; };
  const fyEndOf = (start) => { const y = parseInt(String(start).slice(0,4)) || 2025; return `${y+1}-03-31`; };

  const finish = () => {
    const stateName = STATE_NAMES[f.stateCode] || data.company.state || '';
    setData({ ...data, company: {
      ...data.company,
      name: f.name.trim() || data.company.name,
      gstin: f.gstin.trim(), pan: f.pan.trim(),
      stateCode: f.stateCode, state: stateName,
      address: f.address.trim(), email: f.email.trim(), phone: f.phone.trim(),
      upiId: f.upiId.trim(),
      fyStart: f.fyStart, fyEnd: fyEndOf(f.fyStart),
      modules: { ...f.modules },
      onboarded: true,
    }});
    onClose(true);
  };
  const skip = () => { setData({ ...data, company: { ...data.company, onboarded: true } }); onClose(false); };

  const canNext = step === 0 ? f.name.trim().length > 1 : true;
  const steps = ['Company', 'Financial Year', 'Modules', 'Get Paid'];

  const field = (label, node, hint) => (
    <div className="field"><label>{label}</label>{node}{hint && <div className="help">{hint}</div>}</div>
  );

  return (
    <div className="modal-overlay" onClick={()=>{}}>
      <div className="modal" style={{maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Welcome to MiyeeBooks</h2>
            <div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>Set up your company — takes a minute. Step {step+1} of {steps.length} · {steps[step]}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={skip}>Skip</button>
        </div>

        {/* progress rail */}
        <div style={{display:'flex',gap:6,padding:'0 18px'}}>
          {steps.map((s,i)=>(
            <div key={i} style={{flex:1,height:4,borderRadius:4,background:i<=step?'var(--primary)':'var(--line)'}} />
          ))}
        </div>

        <div className="modal-body" style={{minHeight:250}}>
          {step===0 && <div className="form-grid">
            {field('Business name', <input value={f.name} onChange={e=>setF({...f, name:e.target.value})} placeholder="e.g. Sharma Traders Pvt Ltd" autoFocus />)}
            {field('GSTIN', <input value={f.gstin} onChange={e=>onGstin(e.target.value)} placeholder="24ABCDE1234F1Z5" style={{fontFamily:'var(--mono)'}} maxLength={15} />, 'State and PAN fill in automatically.')}
            {field('PAN', <input value={f.pan} onChange={e=>setF({...f, pan:e.target.value.toUpperCase()})} placeholder="ABCDE1234F" style={{fontFamily:'var(--mono)'}} maxLength={10} />)}
            {field('State', <select value={f.stateCode} onChange={e=>setF({...f, stateCode:e.target.value})}>
              <option value="">Select…</option>
              {Object.entries(STATE_NAMES).map(([code,nm])=><option key={code} value={code}>{code} · {nm}</option>)}
            </select>)}
            {field('Email', <input value={f.email} onChange={e=>setF({...f, email:e.target.value})} placeholder="accounts@yourbiz.in" />)}
            {field('Phone', <input value={f.phone} onChange={e=>setF({...f, phone:e.target.value})} placeholder="+91 …" />)}
            <div className="field" style={{gridColumn:'span 2'}}>{field('Address', <textarea rows="2" value={f.address} onChange={e=>setF({...f, address:e.target.value})} placeholder="Street, city, PIN" style={{width:'100%',resize:'vertical'}} />)}</div>
          </div>}

          {step===1 && <div>
            <p style={{fontSize:14,color:'var(--ink-2)'}}>Which financial year are you starting your books in? Indian FYs run April to March.</p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>
              {['2024-04-01','2025-04-01','2026-04-01'].map(s=>(
                <button key={s} className={'btn '+(f.fyStart===s?'btn-primary':'')} onClick={()=>setF({...f, fyStart:s})}>{fyLabel(s)}</button>
              ))}
            </div>
            <div style={{marginTop:16,fontSize:13,color:'var(--ink-3)'}}>Selected: <b style={{color:'var(--ink)'}}>{fyLabel(f.fyStart)}</b> (1 Apr {String(f.fyStart).slice(0,4)} → 31 Mar {parseInt(String(f.fyStart).slice(0,4))+1})</div>
          </div>}

          {step===2 && <div>
            <p style={{fontSize:14,color:'var(--ink-2)'}}>Turn on only what you need — you can change this any time in Company Settings. Fewer modules means a simpler menu.</p>
            <div style={{display:'grid',gap:10,marginTop:14}}>
              {[
                ['gst','GST',        'GSTR-1, GSTR-3B, GSTR-2B, e-invoice fields'],
                ['tds','TDS',        'TDS sections and deduction reports'],
                ['payroll','Payroll','Employees, salary runs, payslips, reimbursements'],
                ['trader','Trading / Inventory','Stock items, stock ledger, movements'],
                ['factory','Manufacturing','Bill of materials and production orders'],
              ].map(([k,title,desc])=>(
                <label key={k} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'10px 12px',border:'1px solid '+(f.modules[k]?'var(--primary)':'var(--line-2)'),borderRadius:8,background:f.modules[k]?'var(--primary-soft)':'transparent',cursor:'pointer'}}>
                  <input type="checkbox" checked={!!f.modules[k]} onChange={e=>setMod(k,e.target.checked)} style={{marginTop:3}} />
                  <div><div style={{fontWeight:650,fontSize:14}}>{title}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{desc}</div></div>
                </label>
              ))}
            </div>
          </div>}

          {step===3 && <div>
            <p style={{fontSize:14,color:'var(--ink-2)'}}>Add your UPI ID to collect payments by QR straight on your invoices — customers scan and pay to your bank, no gateway or fee. Optional.</p>
            {field('UPI ID', <input value={f.upiId} onChange={e=>setF({...f, upiId:e.target.value.trim()})} placeholder="yourbusiness@okhdfcbank" style={{fontFamily:'var(--mono)'}} />)}
            <div style={{marginTop:20,padding:'14px 16px',background:'var(--surface-2)',borderRadius:8,fontSize:13,color:'var(--ink-2)',lineHeight:1.6}}>
              <b>You're set.</b> Next steps whenever you're ready: add your customers &amp; vendors, set opening balances in Chart of Accounts, and raise your first invoice under Vouchers. Everything saves automatically and works offline.
            </div>
          </div>}
        </div>

        <div className="modal-foot" style={{display:'flex',justifyContent:'space-between',gap:8,padding:'12px 18px',borderTop:'1px solid var(--line)'}}>
          <button className="btn" onClick={()=>step>0 ? setStep(step-1) : skip()}>{step>0 ? '← Back' : 'Skip setup'}</button>
          {step < steps.length-1
            ? <button className="btn btn-primary" onClick={()=>setStep(step+1)} disabled={!canNext}>Continue →</button>
            : <button className="btn btn-primary" onClick={finish}>Finish setup</button>}
        </div>
      </div>
    </div>
  );
}
