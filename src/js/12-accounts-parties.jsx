
// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================
function ChartOfAccounts({data, setData, balances, showToast, readOnly=false}){
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const types = ['All','Asset','Liability','Equity','Income','Expense'];

  const COA_SAMPLE_HEADERS = ['code','name','type','group','schedule','opening','hsn','gstRate'];
  const COA_SAMPLE_ROWS = [
    {code:'5000',name:'Marketing Expenses',type:'Expense',group:'Other Expenses',schedule:'Other Expenses',opening:'0',hsn:'',gstRate:'18'},
    {code:'5010',name:'Software Subscriptions',type:'Expense',group:'Other Expenses',schedule:'Other Expenses',opening:'0',hsn:'',gstRate:'18'},
    {code:'2650',name:'Advances to Suppliers',type:'Asset',group:'Current Assets',schedule:'Other Current Assets',opening:'50000',hsn:'',gstRate:''},
    {code:'3150',name:'Other Operating Revenue',type:'Income',group:'Revenue from Operations',schedule:'Revenue',opening:'0',hsn:'',gstRate:'18'},
  ];

  const defaultGroup = (type) => {
    if(type==='Asset')     return 'Current Assets';
    if(type==='Liability') return 'Current Liabilities';
    if(type==='Equity')    return 'Shareholders Funds';
    if(type==='Income')    return 'Revenue from Operations';
    return 'Other Expenses';
  };

  const handleImportCOA = (rows) => {
    const validTypes = ['Asset','Liability','Equity','Income','Expense'];
    const imported = [];
    const errors   = [];
    rows.forEach((r, i) => {
      const code = r['code']?.trim();
      const name = r['name']?.trim();
      const type = r['type']?.trim();
      if(!code || !name){ errors.push(`Row ${i+2}: code and name are required`); return; }
      if(!validTypes.includes(type)){ errors.push(`Row ${i+2}: type must be one of ${validTypes.join(', ')}`); return; }
      if(data.coa.find(a => a.id === code)) return; // skip existing
      imported.push({
        id:       code,
        name,
        type,
        group:    r['group']?.trim()    || defaultGroup(type),
        schedule: r['schedule']?.trim() || '',
        opening:  parseFloat(r['opening']) || 0,
        hsn:      r['hsn']?.trim()      || '',
        gstRate:  parseFloat(r['gstRate']) || 0,
      });
    });
    if(errors.length > 0 && imported.length === 0)
      return { count:0, error: errors.slice(0,3).join('; ') };
    setData(prev => ({...prev, coa: [...prev.coa, ...imported]}));
    showToast('Imported ' + imported.length + ' accounts' + (errors.length?' ('+errors.length+' skipped)':''));
    return { count: imported.length };
  };

  const filtered = data.coa.filter(a => {
    if(filter !== 'All' && a.type !== filter) return false;
    if(search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, a) => {
    if(!acc[a.group]) acc[a.group] = [];
    acc[a.group].push(a);
    return acc;
  }, {});

  const handleSave = (acc) => {
    if(editing){
      setData({...data, coa: data.coa.map(a => a.id === editing.id ? {...a, ...acc} : a)});
      showToast('Account updated');
    } else {
      if(data.coa.find(a => a.id === acc.id)){
        showToast('Account code already exists', 'error');
        return;
      }
      setData({...data, coa: [...data.coa, acc]});
      showToast('Account created');
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (acc) => {
    if(!confirm('Delete account "' + acc.name + '"?')) return;
    const used = data.vouchers.some(v => (v.lines||[]).some(l => l.accountId === acc.id));
    if(used){ showToast('Account is used in vouchers  cannot delete', 'error'); return; }
    setData({...data, coa: data.coa.filter(a => a.id !== acc.id)});
    showToast('Account deleted');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <div className="page-sub">Schedule III aligned ledger master · {data.coa.length} accounts</div>
        </div>
        {!readOnly && <div className="page-actions">
          <button className="btn" onClick={() => setShowImport(true)}>⬆ Import CSV</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ New Account</button>
        </div>}
      </div>

      <div className="filter-bar">
        <div className="field">
          <label>Search</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Code or name..." style={{minWidth:200}} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{width:80}}>Code</th>
              <th>Account Name</th>
              <th>Type</th>
              <th>Schedule III Head</th>
              <th className="num">Opening</th>
              <th className="num">Current Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(grouped).map(g => (
              <React.Fragment key={g}>
                <tr className="group"><td colSpan="7">{g}</td></tr>
                {grouped[g].map(a => {
                  const bal = balances[a.id] || 0;
                  const displayBal = (a.type==='Liability'||a.type==='Equity'||a.type==='Income') ? -bal : bal;
                  return (
                    <tr key={a.id}>
                      <td style={{fontFamily:'var(--mono)', fontWeight:600}}>{a.id}</td>
                      <td>{a.name}{a.contra && <span className="badge badge-muted" style={{marginLeft:6}}>Contra</span>}{a.isBank && <span className="badge badge-info" style={{marginLeft:6}}>Bank</span>}{a.gstRate>0 && <span className="badge badge-gold" style={{marginLeft:6}}>GST {a.gstRate}%</span>}</td>
                      <td><span className="badge badge-success">{a.type}</span></td>
                      <td style={{color:'var(--ink-3)', fontSize:11}}>{a.schedule}</td>
                      <td className="num">₹{fmt(a.opening||0)}</td>
                      <td className="num bold">₹{fmt(displayBal)}</td>
                      <td className="actions">
                        {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(a); setShowModal(true); }}>Edit</button>}
                        {!readOnly && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a)}>×</button>}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <AccountModal account={editing} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />}
      {showImport && <CsvImportModal title="Import Chart of Accounts" sampleHeaders={COA_SAMPLE_HEADERS} sampleRows={COA_SAMPLE_ROWS} sampleFilename="coa_import_template.csv" onImport={handleImportCOA} onClose={() => setShowImport(false)} />}
    </>
  );
}

function AccountModal({account, onSave, onClose}){
  const [f, setF] = useState(account || {
    id:'', name:'', group:'Current Assets', type:'Asset', schedule:'Other Current Assets', opening:0, gstRate:0
  });

  const groupsByType = {
    Asset:['Fixed Assets','Non-Current Investments','Current Assets'],
    Liability:['Non-Current Liabilities','Current Liabilities'],
    Equity:['Shareholders Funds'],
    Income:['Revenue from Operations','Other Income'],
    Expense:['Cost of Materials','Purchase of Stock-in-Trade','Employee Benefit Expenses','Finance Costs','Depreciation','Other Expenses'],
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{account ? 'Edit Account' : 'New Account'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field required">
              <label>Account Code</label>
              <input value={f.id} onChange={e => setF({...f, id:e.target.value})} disabled={!!account} placeholder="e.g. 4570" />
            </div>
            <div className="field required">
              <label>Account Name</label>
              <input value={f.name} onChange={e => setF({...f, name:e.target.value})} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={f.type} onChange={e => setF({...f, type:e.target.value, group:groupsByType[e.target.value][0]})}>
                {Object.keys(groupsByType).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Group</label>
              <select value={f.group} onChange={e => setF({...f, group:e.target.value})}>
                {(groupsByType[f.type]||[]).map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Schedule III Head</label>
              <input value={f.schedule} onChange={e => setF({...f, schedule:e.target.value})} />
            </div>
            <div className="field">
              <label>Opening Balance</label>
              <input type="number" value={f.opening} onChange={e => setF({...f, opening:parseFloat(e.target.value)||0})} />
              <div className="help">Dr for Asset/Expense, Cr (negative) for Liability/Equity/Income</div>
            </div>
            {(f.type==='Income'||f.type==='Expense') && (
              <div className="field">
                <label>Default GST Rate (%)</label>
                <select value={f.gstRate||0} onChange={e => setF({...f, gstRate:parseFloat(e.target.value)})}>
                  <option value="0">0% / Exempt</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                </select>
              </div>
            )}
            <div className="field">
              <label>HSN/SAC (if applicable)</label>
              <input value={f.hsn||''} onChange={e => setF({...f, hsn:e.target.value})} placeholder="e.g. 998311" />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.id || !f.name}>Save Account</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PARTIES (Customers & Vendors)
// ============================================================================
function Parties({data, setData, showToast, readOnly=false}){
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = data.parties.filter(p => {
    if(filter !== 'All' && p.type !== filter) return false;
    if(search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = (party) => {
    if(editing){
      setData({...data, parties: data.parties.map(p => p.id === editing.id ? {...party, id:editing.id} : p)});
      showToast('Party updated');
    } else {
      setData({...data, parties: [...data.parties, {...party, id:uid()}]});
      showToast('Party added');
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (party) => {
    if(!confirm('Delete "' + party.name + '"?')) return;
    setData({...data, parties: data.parties.filter(p => p.id !== party.id)});
    showToast('Party deleted');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers & Vendors</h1>
          <div className="page-sub">{data.parties.length} parties · GSTIN-validated master</div>
        </div>
        {!readOnly && <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ New Party</button>
        </div>}
      </div>

      <div className="filter-bar">
        <div className="field"><label>Search</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or GSTIN..." style={{minWidth:240}} /></div>
        <div className="field"><label>Type</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option>All</option><option>Customer</option><option>Vendor</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Type</th><th>GSTIN</th><th>PAN</th><th>State</th><th>Credit Days</th><th>Contact</th><th className="num">Balance</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <b>{p.name}</b>
                  {p.isForeign && <span className="badge badge-gold" style={{marginLeft:6}}>Foreign</span>}
                  {p.unregistered && <span className="badge badge-muted" style={{marginLeft:6}}>URD</span>}
                  {p.msmeReg && <span className="badge badge-info" style={{marginLeft:6}}>MSME</span>}
                  {p.tdsApplicableDefault && <span className="badge badge-gold" style={{marginLeft:6}}>TDS</span>}
                  {p.contactPerson && <div style={{fontSize:10, color:'var(--ink-3)', marginTop:1}}>{p.contactPerson}</div>}
                </td>
                <td><span className={'badge ' + (p.type==='Customer'?'badge-info':'badge-gold')}>{p.type}</span></td>
                <td style={{fontFamily:'var(--mono)', fontSize:11}}>{p.gstin || <span style={{color:'var(--ink-3)', fontStyle:'italic'}}>URD</span>}</td>
                <td style={{fontFamily:'var(--mono)', fontSize:11, color: p.pan ? 'var(--ink)' : 'var(--danger)'}}>{p.pan || ''}</td>
                <td>{p.state}{p.stateCode && <span style={{fontSize:10, color:'var(--ink-3)'}}> ({p.stateCode})</span>}</td>
                <td style={{textAlign:'center'}}>{p.creditDays||30}d{p.creditLimit>0 && <div style={{fontSize:10, color:'var(--ink-3)'}}>Limit: ₹{fmt(p.creditLimit)}</div>}</td>
                <td style={{fontSize:11, color:'var(--ink-3)'}}>{p.email && <div>{p.email}</div>}{p.phone && <div>{p.phone}</div>}</td>
                <td className="num bold">{p.currency==='INR'||!p.currency?'₹':p.currency+' '}{fmt(p.balance||0)}</td>
                <td className="actions">
                  {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(p); setShowModal(true); }}>Edit</button>}
                  {!readOnly && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <PartyModal party={editing} existingParties={data.parties} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} />}
    </>
  );
}

function PartyModal({party, existingParties=[], onSave, onClose}){
  const [f, setF] = useState(party || {
    name:'', type:'Customer', gstin:'', pan:'', tan:'',
    state:'Gujarat', stateCode:'24', address:'', city:'', pincode:'',
    email:'', phone:'', contactPerson:'',
    currency:'INR', balance:0,
    creditDays:30, creditLimit:0,
    cinNo:'', msmeReg:'', bankAcc:'', ifsc:'', bankName:'',
    tdsApplicableDefault: false,
  });

  // Auto-derive state code from GSTIN first 2 digits
  const handleGstinChange = (val) => {
    const gstin = val.toUpperCase();
    const code = gstin.slice(0,2);
    const stateMap = {'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar','36':'Telangana','37':'Andhra Pradesh (New)'};
    setF(prev => ({...prev, gstin, stateCode: code||prev.stateCode, state: stateMap[code]||prev.state, unregistered:!val}));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{party ? 'Edit' : 'New'} {f.type || 'Party'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{maxHeight:'72vh', overflowY:'auto'}}>

          {/* Basic Info */}
          <div className="section-divider"><div className="label">Basic Information</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field required"><label>Name</label><input value={f.name} onChange={e => setF({...f, name:e.target.value})} placeholder="Full legal name" /></div>
            <div className="field"><label>Type</label>
              <select value={f.type} onChange={e => setF({...f, type:e.target.value})}>
                <option>Customer</option><option>Vendor</option>
              </select>
            </div>
            <div className="field"><label>Contact Person</label><input value={f.contactPerson||''} onChange={e => setF({...f, contactPerson:e.target.value})} placeholder="Mr. / Ms." /></div>
            <div className="field"><label>Currency</label>
              <select value={f.currency||'INR'} onChange={e => setF({...f, currency:e.target.value, isForeign:e.target.value!=='INR'})}>
                <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>SGD</option><option>JPY</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="section-divider"><div className="label">Address & Contact</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field" style={{gridColumn:'span 2'}}><label>Address (Door No, Street, Area)</label><input value={f.address} onChange={e => setF({...f, address:e.target.value})} /></div>
            <div className="field"><label>City</label><input value={f.city||''} onChange={e => setF({...f, city:e.target.value})} /></div>
            <div className="field"><label>State</label><input value={f.state} onChange={e => setF({...f, state:e.target.value, isForeign:e.target.value==='Outside India'})} /></div>
            <div className="field"><label>State Code</label><input value={f.stateCode} onChange={e => setF({...f, stateCode:e.target.value})} maxLength="2" placeholder="24" /></div>
            <div className="field"><label>PIN Code</label><input value={f.pincode||''} onChange={e => setF({...f, pincode:e.target.value})} maxLength="6" /></div>
            <div className="field"><label>Email</label><input value={f.email} onChange={e => setF({...f, email:e.target.value})} /></div>
            <div className="field"><label>Phone / Mobile</label><input value={f.phone} onChange={e => setF({...f, phone:e.target.value})} /></div>
          </div>

          {/* Statutory */}
          <div className="section-divider"><div className="label">Statutory / Tax Details</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field"><label>GSTIN</label>
              <input value={f.gstin} onChange={e => handleGstinChange(e.target.value)} placeholder="15-char GSTIN" maxLength="15" style={{fontFamily:'var(--mono)', ...(f.gstin && f.gstin.length===15 && !validateGSTIN(f.gstin).valid ? {borderColor:'var(--danger)'} : {})}} />
              <div className="help" style={f.gstin && f.gstin.length===15 ? {color: validateGSTIN(f.gstin).valid ? 'var(--primary)' : 'var(--danger)', fontWeight:600} : {}}>
                {(() => {
                  if(!f.gstin) return 'Leave blank for URD';
                  if(f.gstin.length < 15) return '✗ Must be 15 chars ('+f.gstin.length+'/15)';
                  const r = validateGSTIN(f.gstin);
                  if(r.valid) return '✓ Valid GSTIN (checksum OK)';
                  if(r.reason==='checksum') return '✗ Invalid checksum - check for typos';
                  return '✗ Invalid GSTIN format';
                })()}
              </div>
              {(() => {
                const g = (f.gstin||'').trim().toUpperCase();
                if(g.length !== 15) return null;
                const dup = (existingParties||[]).find(p => p.id !== (party&&party.id) && (p.gstin||'').trim().toUpperCase() === g);
                return dup ? <div className="help" style={{color:'var(--danger)',fontWeight:700}}>⚠ Duplicate - this GSTIN is already used by “{dup.name}”</div> : null;
              })()}
            </div>
            <div className="field"><label>PAN</label>
              <input value={f.pan||''} onChange={e => setF({...f, pan:e.target.value.toUpperCase()})} placeholder="ABCDE1234F" maxLength="10" style={{fontFamily:'var(--mono)'}} />
              <div className="help">Required for TDS deduction &amp; Form 26Q</div>
            </div>
            <div className="field"><label>TAN (if applicable)</label>
              <input value={f.tan||''} onChange={e => setF({...f, tan:e.target.value.toUpperCase()})} placeholder="MUMX12345X" maxLength="10" style={{fontFamily:'var(--mono)'}} />
              <div className="help">Tax Deduction Account No. of vendor</div>
            </div>
            <div className="field"><label>CIN / LLP-IN</label>
              <input value={f.cinNo||''} onChange={e => setF({...f, cinNo:e.target.value.toUpperCase()})} placeholder="U72200GJ2020PTC..." />
            </div>
            <div className="field"><label>MSME Registration No.</label>
              <input value={f.msmeReg||''} onChange={e => setF({...f, msmeReg:e.target.value})} placeholder="UDYAM-XX-00-0000000" />
            </div>
            <div className="field"><label style={{display:'flex', alignItems:'center', gap:6}}>
              <input type="checkbox" checked={f.tdsApplicableDefault||false} onChange={e => setF({...f, tdsApplicableDefault:e.target.checked})} />
              TDS Applicable by Default
            </label>
              <div className="help">Auto-check TDS when creating vouchers for this party</div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="section-divider"><div className="label">Bank Details</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field"><label>Bank Name</label><input value={f.bankName||''} onChange={e => setF({...f, bankName:e.target.value})} placeholder="HDFC Bank, Kotak..." /></div>
            <div className="field"><label>Account No.</label><input value={f.bankAcc||''} onChange={e => setF({...f, bankAcc:e.target.value})} style={{fontFamily:'var(--mono)'}} /></div>
            <div className="field"><label>IFSC Code</label><input value={f.ifsc||''} onChange={e => setF({...f, ifsc:e.target.value.toUpperCase()})} placeholder="KKBK0001234" style={{fontFamily:'var(--mono)'}} /></div>
          </div>

          {/* Credit Terms */}
          <div className="section-divider"><div className="label">Credit Terms &amp; Opening Balance</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field"><label>Credit Days</label>
              <input type="number" value={f.creditDays||30} onChange={e => setF({...f, creditDays:parseInt(e.target.value)||0})} />
              <div className="help">Payment due within {f.creditDays||30} days of invoice</div>
            </div>
            <div className="field"><label>Credit Limit (₹)</label>
              <input type="number" value={f.creditLimit||0} onChange={e => setF({...f, creditLimit:parseFloat(e.target.value)||0})} />
              <div className="help">0 = No limit</div>
            </div>
            <div className="field"><label>Opening Balance (₹)</label>
              <input type="number" value={f.balance||0} onChange={e => setF({...f, balance:parseFloat(e.target.value)||0})} />
              <div className="help">Dr for Customer receivable; Cr (negative) for Vendor payable</div>
            </div>
          </div>

        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name}>Save {f.type||'Party'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPANY SETTINGS
// ============================================================================
function CompanySettings({data, setData, showToast, readOnly=false}){
  const [f, setF] = useState(data.company);
  const logoRef = useRef(null);

  const save = () => {
    setData({...data, company:f});
    showToast('Company settings saved');
  };
  const resetData = () => {
    if(!confirm('Reset ALL data for this company?\n\nThis wipes every voucher, party, stock item and report back to a clean company and CANNOT be undone.')) return;
    if(!confirm('Are you absolutely sure? Consider Export → Backup first.')) return;
    // Reset THROUGH the app's own persistence so it works for cloud AND local:
    // setData triggers the normal save (Firestore or localStorage). Keep the
    // current company name/GSTIN so the user keeps their identity, just empty books.
    const fresh = makeFreshData({ company: {...DEFAULT_COMPANY, modules:{...(data.company.modules||DEFAULT_COMPANY.modules)},
      name:data.company.name, gstin:data.company.gstin, pan:data.company.pan, state:data.company.state,
      stateCode:data.company.stateCode, address:data.company.address, fyStart:data.company.fyStart, fyEnd:data.company.fyEnd,
      parentCompanyId:data.company.parentCompanyId, isHolding:data.company.isHolding },
      auditLog:[auditEntry('RESET','All data reset to a clean company')] });
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
    try { if(__IDB_OK) idbDel(STORAGE_KEY); } catch(e){}
    setData(fresh);
    showToast('All data has been reset');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(!file.type.match(/^image\/(png|jpeg|jpg|svg\+xml|webp)$/)){
      showToast('Please upload PNG, JPG, SVG or WebP image', 'error');
      return;
    }
    if(file.size > 500 * 1024){
      showToast('Logo file too large  max 500 KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setF({...f, logo: ev.target.result});
      showToast('Logo uploaded  click Save Settings to apply');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeLogo = () => {
    setF({...f, logo: null});
    showToast('Logo removed  click Save Settings to apply');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Company Settings</h1>
          <div className="page-sub">Entity profile · Financial year · Tax registrations · Logo</div>
        </div>
      </div>

      {/* Logo upload card */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head"><h3 className="card-title">Company Logo</h3></div>
        <div className="card-body">
          <div style={{display:'flex', gap:24, alignItems:'flex-start'}}>
            <div style={{minWidth:160}}>
              {f.logo ? (
                <div style={{position:'relative'}}>
                  <img src={f.logo} alt="Company Logo" style={{maxWidth:150, maxHeight:80, objectFit:'contain', border:'1px solid var(--line)', borderRadius:8, padding:8, background:'#fff'}} />
                  <button className="btn btn-sm btn-danger" onClick={removeLogo} style={{position:'absolute', top:-6, right:-6, borderRadius:'50%', width:22, height:22, padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11}}>×</button>
                </div>
              ) : (
                <div style={{width:150, height:80, border:'2px dashed var(--line-2)', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--ink-3)', fontSize:11}} onClick={() => logoRef.current?.click()}>
                  <span style={{fontSize:24, opacity:.3, marginBottom:4}}>⊞</span>
                  <span>Upload Logo</span>
                </div>
              )}
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" onChange={handleLogoUpload} style={{display:'none'}} />
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:12, color:'var(--ink-2)', margin:'0 0 8px 0'}}>Upload your company logo (PNG, JPG, SVG, or WebP). This logo will appear on:</p>
              <div className="chip-list">
                <span className="chip">GST Tax Invoices</span>
                <span className="chip">Credit Notes</span>
                <span className="chip">Debit Notes</span>
                <span className="chip">Reports (P&L, BS)</span>
                <span className="chip">PDF Exports</span>
              </div>
              <p style={{fontSize:11, color:'var(--ink-3)', margin:'8px 0 0 0'}}>Max 500 KB · Recommended: transparent PNG, min 200×60px · Stored as base64 in your data</p>
              {!f.logo && <button className="btn btn-sm" style={{marginTop:8}} onClick={() => logoRef.current?.click()}>⊞ Choose File</button>}
              {f.logo && <button className="btn btn-sm" style={{marginTop:8}} onClick={() => logoRef.current?.click()}>↻ Replace Logo</button>}
            </div>
          </div>
          {f.logo && (
            <div style={{marginTop:14, padding:10, background:'var(--surface-2)', borderRadius:6, fontSize:11, color:'var(--ink-3)'}}>
              <b>Preview:</b> Logo is {Math.round(f.logo.length * 3 / 4 / 1024)} KB encoded · Type: {f.logo.split(';')[0]?.split(':')[1] || 'image'}
            </div>
          )}
        </div>
      </div>

      {/* Invoice Template */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head">
          <h3 className="card-title">GST Invoice Template</h3>
          <span style={{fontSize:11,color:'var(--ink-3)'}}>Choose a design theme for Tax Invoices / Credit / Debit Notes</span>
        </div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
            {Object.entries(INVOICE_TEMPLATES).map(([key,t]) => {
              const sel = (f.invoiceTemplate||'classic') === key;
              const ly = t.layout||'classic';
              // Mini header preview mirrors the actual LAYOUT (not just the colour)
              const hdrStyle =
                ly==='minimal' ? {background:'#fff', color:'#1a2733', borderBottom:`2px solid ${t.accent}`} :
                ly==='elegant' ? {background:'#fff', color:t.accent, borderTop:`3px double ${t.accent}`, borderBottom:`3px double ${t.accent}`, justifyContent:'center'} :
                ly==='boxed'   ? {background:'#fff', color:t.accent, borderLeft:`6px solid ${t.accent}`, borderBottom:`1.5px solid #1a2733`} :
                ly==='modern'  ? {background:`linear-gradient(120deg, ${t.accent}, ${t.accent}cc)`, color:'#fff'} :
                                 {background:t.accent, color:'#fff'};
              return (
                <div key={key} onClick={() => setF({...f, invoiceTemplate:key})}
                  style={{cursor:'pointer',border:`2px solid ${sel?t.accent:'var(--line-2)'}`,borderRadius:8,overflow:'hidden',
                    boxShadow:sel?`0 2px 10px ${t.accent}33`:'none',background:'#fff'}}>
                  {/* mini invoice preview */}
                  <div style={{padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center',...hdrStyle}}>
                    <span style={{fontWeight:700,fontSize:11,fontFamily:ly==='elegant'?'Georgia,serif':'inherit'}}>TAX INVOICE</span>
                    {ly!=='elegant' && <span style={{width:14,height:14,borderRadius:'50%',background:t.accent2}}></span>}
                  </div>
                  <div style={{padding:'8px 10px'}}>
                    <div style={{height:5,background:'#eee',borderRadius:3,marginBottom:5,width:'70%'}}></div>
                    <div style={{height:5,background:'#eee',borderRadius:3,marginBottom:8,width:'45%'}}></div>
                    <div style={{borderTop:`2px solid ${t.accent}`,paddingTop:6,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10}}>
                      <span style={{color:t.accent,fontWeight:700}}>{t.name}</span>
                      <span style={{display:'flex',gap:4,alignItems:'center'}}>
                        <span style={{fontSize:8,background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:8,padding:'1px 6px',color:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'.5px'}}>{ly}</span>
                        {sel && <span style={{color:t.accent,fontWeight:700}}>✓</span>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10,fontSize:11,color:'var(--ink-3)'}}>10 templates across 5 layouts - <b>classic</b> (dark header band), <b>modern</b> (full-colour header), <b>minimal</b> (letterhead rules), <b>elegant</b> (centered serif), <b>boxed</b> (framed page). Click Save Settings, then print any Sales invoice.</div>
        </div>
      </div>

      {/* Company Group / Holding structure */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head">
          <h3 className="card-title">🏢 Company Group (Holding / Subsidiary)</h3>
          <span style={{fontSize:11,color:'var(--ink-3)'}}>Tag entities into a group to see Consolidated Financials</span>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label>Group Name</label>
              <input value={f.groupName||''} onChange={e=>setF({...f, groupName:e.target.value})} placeholder="e.g. Acme Group" disabled={readOnly} />
              <div className="help">Give every company in the group the <b>same</b> group name (holding + all subsidiaries).</div>
            </div>
            <div className="field">
              <label>Role in Group</label>
              <select value={f.isHolding?'holding':'subsidiary'} onChange={e=>setF({...f, isHolding:e.target.value==='holding'})} disabled={readOnly}>
                <option value="subsidiary">Subsidiary / Operating company</option>
                <option value="holding">Holding / Parent company</option>
              </select>
              <div className="help">Mark exactly one company as the Holding.</div>
            </div>
            <div className="field">
              <label>Ownership % held by Holding</label>
              <input type="number" min="0" max="100" value={f.groupOwnership!=null?f.groupOwnership:100} onChange={e=>setF({...f, groupOwnership:parseFloat(e.target.value)||0})} disabled={readOnly} />
              <div className="help">Used to flag minority interest (informational).</div>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:11.5,color:'var(--ink-2)',background:'var(--info-soft)',border:'1px solid var(--line)',borderRadius:8,padding:'10px 12px',lineHeight:1.6}}>
            To add a subsidiary: use <b>⇌ Switch → + Add New Company</b> and pick <b>“Subsidiary of {'{this company}'}”</b> - it inherits the group automatically.
            Then open <b>Group Consolidation</b> (Account Manager menu) for the consolidated Trial Balance, P&amp;L, Balance Sheet and intercompany eliminations. Requires cloud sign-in. These fields are for manual overrides.
          </div>
        </div>
      </div>

      {/* Voucher Numbering Series */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head">
          <h3 className="card-title">Voucher Numbering Series</h3>
          <span style={{fontSize:11,color:'var(--ink-3)'}}>Customise the prefix &amp; format per voucher type · applies to new vouchers</span>
        </div>
        <div className="card-body" style={{padding:0,overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr style={{background:'var(--surface-2)',borderBottom:'1px solid var(--line)'}}>
              <th style={{padding:'8px 16px',textAlign:'left'}}>Voucher Type</th>
              <th style={{padding:'8px 16px',textAlign:'left',width:160}}>Prefix</th>
              <th style={{padding:'8px 16px',textAlign:'center',width:90}}>Digits</th>
              <th style={{padding:'8px 16px',textAlign:'center',width:110}}>Include FY</th>
              <th style={{padding:'8px 16px',textAlign:'left',width:180}}>Sample</th>
            </tr></thead>
            <tbody>
              {['SAL','PUR','PAY','REC','JV','CON','CRN','DBN'].map(tp=>{
                const cfg = (f.numberingSeries||{})[tp] || {};
                const setCfg = (patch) => setF({...f, numberingSeries:{...(f.numberingSeries||{}), [tp]:{...cfg, ...patch}}});
                const y = parseInt((f.fyStart||'2025-04-01').slice(0,4));
                const fy = String(y).slice(2)+'-'+String(y+1).slice(2);
                const sample = [(cfg.prefix!=null&&cfg.prefix!==''?cfg.prefix:tp)]
                  .concat(cfg.includeFY?[fy]:[]).concat([String(1).padStart(cfg.padding||4,'0')]).join('/');
                return (
                  <tr key={tp} style={{borderBottom:'1px solid var(--line-2)'}}>
                    <td style={{padding:'6px 16px',fontWeight:600}}>{VOUCHER_TYPES.find(v=>v.code===tp)?.name || tp}</td>
                    <td style={{padding:'6px 16px'}}><input value={cfg.prefix!=null?cfg.prefix:tp} onChange={e=>setCfg({prefix:e.target.value})}
                      style={{width:'100%',padding:'4px 8px',border:'1px solid var(--line-2)',borderRadius:5,fontSize:12}} /></td>
                    <td style={{padding:'6px 16px',textAlign:'center'}}><input type="number" min="2" max="8" value={cfg.padding||4} onChange={e=>setCfg({padding:parseInt(e.target.value)||4})}
                      style={{width:55,padding:'4px 6px',border:'1px solid var(--line-2)',borderRadius:5,fontSize:12,textAlign:'center'}} /></td>
                    <td style={{padding:'6px 16px',textAlign:'center'}}><input type="checkbox" checked={!!cfg.includeFY} onChange={e=>setCfg({includeFY:e.target.checked})} /></td>
                    <td style={{padding:'6px 16px',fontFamily:'var(--mono)',color:'var(--primary)'}}>{sample}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)'}}>Click Save Settings to apply. Existing voucher numbers are unchanged; new vouchers use the series.</div>
      </div>

      {/* Module Configuration */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head">
          <h3 className="card-title">Module Configuration</h3>
          <span style={{fontSize:11,color:'var(--ink-3)'}}>Enable only what your business needs  click Save Settings to apply</span>
        </div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
            {[
              {key:'gst',     ico:'◑', label:'GST Module',          color:'var(--primary)',   bg:'var(--primary-soft)',   desc:'GSTR-1 filing, GSTR-3B return, GSTR-2B ITC reconciliation. Required if you are GST registered.',           badge:'Mandatory for GST Reg.'},
              {key:'tds',     ico:'§', label:'TDS Module',           color:'var(--info)',      bg:'var(--info-soft)',      desc:'TDS section master, deduction on vouchers, TDS deducted register, Form 26Q / 24Q data export.',            badge:'For TDS Deductors'},
              {key:'payroll', ico:'☺', label:'Payroll Module',       color:'#6b3fa0',          bg:'#f3edfc',              desc:'Employee master, monthly payroll processing, payslip generation, PF/ESIC/PT/TDS on salary.',               badge:'For Employers'},
              {key:'trader',  ico:'▣', label:'Trader Module',        color:'var(--accent)',    bg:'var(--accent-soft)',   desc:'Stock item master, stock ledger, purchase & sale stock movements, inventory reporting. For retail/wholesale.', badge:'Retail / Wholesale'},
              {key:'factory', ico:'⚙', label:'Factory Module',       color:'#b05a00',          bg:'#fff3e6',              desc:'Bill of Materials (BOM), production orders, raw material consumption → finished goods. For manufacturers.', badge:'Manufacturer'},
              {key:'service', ico:'◎', label:'Service Sector',       color:'var(--ink-2)',     bg:'var(--surface-2)',     desc:'Optimised for service businesses  SAC codes, RCM tracking, place of supply defaults. For IT/consulting/agencies.', badge:'Service Business'},
            ].map(m => {
              const isOn = !!(f.modules||{})[m.key];
              return (
                <div key={m.key} onClick={() => setF({...f, modules:{...(f.modules||{}), [m.key]:!isOn}})}
                  style={{cursor:'pointer',border:`2px solid ${isOn?m.color:'var(--line-2)'}`,borderRadius:'var(--radius)',padding:'14px 16px',
                    background:isOn?m.bg:'var(--surface)',transition:'all .15s',userSelect:'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:20,color:isOn?m.color:'var(--ink-3)'}}>{m.ico}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:isOn?m.color:'var(--ink-2)'}}>{m.label}</div>
                        <div style={{fontSize:10,color:isOn?m.color:'var(--ink-3)',marginTop:1}}>{m.badge}</div>
                      </div>
                    </div>
                    {/* Toggle switch */}
                    <div style={{
                      width:40,height:22,borderRadius:11,background:isOn?m.color:'var(--line-2)',
                      position:'relative',transition:'background .2s',flexShrink:0
                    }}>
                      <div style={{
                        position:'absolute',top:3,left:isOn?20:3,width:16,height:16,
                        borderRadius:'50%',background:'#fff',transition:'left .2s',
                        boxShadow:'0 1px 3px rgba(0,0,0,.2)'
                      }}/>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:'var(--ink-3)',lineHeight:1.5}}>{m.desc}</div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:14,padding:'10px 14px',background:'var(--accent-soft)',border:'1px solid var(--accent)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--warning)'}}>
            💡 <b>Tip:</b> Click any module card to toggle it on/off. Changes take effect in the sidebar after you click <b>Save Settings</b>. Core accounting (Vouchers, Reports, Registers) is always available.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="card-title">Entity Profile</h3></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field"><label>Company Name</label><input value={f.name} onChange={e => setF({...f, name:e.target.value})} /></div>
            <div className="field"><label>CIN</label><input value={f.cin} onChange={e => setF({...f, cin:e.target.value})} /></div>
            <div className="field"><label>PAN</label><input value={f.pan} onChange={e => setF({...f, pan:e.target.value.toUpperCase()})} maxLength="10" /></div>
            <div className="field"><label>GSTIN</label>
              <input value={f.gstin} onChange={e => setF({...f, gstin:e.target.value.toUpperCase()})} maxLength="15" style={f.gstin && f.gstin.length===15 && !validateGSTIN(f.gstin).valid ? {borderColor:'var(--danger)'} : {}} />
              {f.gstin && f.gstin.length===15 && <div className="help" style={{color: validateGSTIN(f.gstin).valid ? 'var(--primary)' : 'var(--danger)', fontWeight:600}}>{validateGSTIN(f.gstin).valid ? '✓ Valid GSTIN (checksum OK)' : validateGSTIN(f.gstin).reason==='checksum' ? '✗ Invalid checksum' : '✗ Invalid format'}</div>}
            </div>
            <div className="field" style={{gridColumn:'span 2'}}><label>Registered Address</label><input value={f.address} onChange={e => setF({...f, address:e.target.value})} /></div>
            <div className="field"><label>State</label><input value={f.state} onChange={e => setF({...f, state:e.target.value})} /></div>
            <div className="field"><label>State Code</label><input value={f.stateCode} onChange={e => setF({...f, stateCode:e.target.value})} maxLength="2" /></div>
            <div className="field"><label>Email</label><input value={f.email} onChange={e => setF({...f, email:e.target.value})} /></div>
            <div className="field"><label>Phone</label><input value={f.phone} onChange={e => setF({...f, phone:e.target.value})} /></div>
            <div className="field"><label>Base Currency</label><select value={f.baseCurrency} onChange={e => setF({...f, baseCurrency:e.target.value})}><option>INR</option><option>USD</option></select></div>
            <div className="field"><label>FY Start</label><input type="date" value={f.fyStart} onChange={e => setF({...f, fyStart:e.target.value})} /></div>
            <div className="field"><label>FY End</label><input type="date" value={f.fyEnd} onChange={e => setF({...f, fyEnd:e.target.value})} /></div>
            <div className="field" style={{gridColumn:'span 2'}}><label>Bank Details (for invoices)</label><input value={f.bankDetails||''} onChange={e => setF({...f, bankDetails:e.target.value})} placeholder="A/c No: XXXX | Bank: Kotak | IFSC: KKBK..." /></div>
            <div className="field"><label>UPI ID (prints a Pay-Now QR on invoices)</label>
              <input value={f.upiId||''} onChange={e => setF({...f, upiId:e.target.value.trim().toLowerCase()})} placeholder="yourname@okhdfcbank"
                style={{fontFamily:'var(--mono)', ...(f.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(f.upiId) ? {borderColor:'var(--danger)'} : {})}} />
              <div className="help" style={f.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(f.upiId) ? {color:'var(--danger)',fontWeight:600} : {}}>
                {f.upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(f.upiId)
                  ? '✗ Not a valid UPI ID format (name@bank)'
                  : '⚠ Must be YOUR real, ACTIVE UPI ID - apps verify the payee and reject unregistered IDs. Test it: scan a printed invoice and send yourself ₹1. Leave blank to hide the QR.'}
              </div>
            </div>
          </div>
          <div style={{marginTop:18, display:'flex', gap:8, justifyContent:'space-between'}}>
            {!readOnly && <button className="btn btn-danger" onClick={resetData}>⚠ Reset All Data</button>}
            {readOnly
              ? <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:8,padding:'10px 16px',fontSize:12,color:'#5d4037',flex:1,textAlign:'center'}}>👁 Viewer mode  settings are read-only</div>
              : <button className="btn btn-primary" onClick={save}>Save Settings</button>
            }
          </div>
        </div>
      </div>

      {/* Firebase Cloud Status */}
      <div className="card" style={{marginBottom:18}}>
        <div className="card-head">
          <h3 className="card-title">☁ Cloud Sync Status</h3>
          <span style={{fontSize:11,color:'var(--ink-3)'}}>Multi-user · Real-time backup · Access from any device</span>
        </div>
        <div className="card-body">
          {FB_CONFIGURED ? (
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <span style={{fontSize:22}}>✅</span>
              <div>
                <div style={{fontWeight:600,color:'var(--primary)',fontSize:13}}>Firebase Connected</div>
                <div style={{fontSize:12,color:'var(--ink-3)',marginTop:2}}>
                  Your data syncs automatically to Firestore. Every change is saved within 2 seconds.
                  Multiple users / devices can use their own account  data is fully isolated per user.
                </div>
              </div>
            </div>
          ) : (
            <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
              <span style={{fontSize:22}}>🔧</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:'var(--accent)',fontSize:13,marginBottom:6}}>Firebase not configured  running in local mode</div>
                <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:10,lineHeight:1.7}}>
                  To enable cloud sync and multi-user login, add your Firebase credentials to the
                  <code>FIREBASE_CONFIG</code> block in the HTML file (near the top of the &lt;script&gt; section).
                </div>
                <div style={{fontSize:11,background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:8,padding:'10px 14px',fontFamily:'var(--mono)',lineHeight:2,color:'var(--ink-2)'}}>
                  1. Go to <b>console.firebase.google.com</b><br/>
                  2. Create a project → Add a Web app<br/>
                  3. Enable <b>Authentication</b> (Email/Password + Google)<br/>
                  4. Enable <b>Firestore Database</b> (production mode)<br/>
                  5. Copy the config object and paste it into <code>FIREBASE_CONFIG</code> in this file<br/>
                  6. Add Firestore Security Rules (see below)
                </div>
                <div style={{marginTop:12,fontSize:11,background:'#1e1e1e',color:'#d4d4d4',borderRadius:8,padding:'12px 16px',fontFamily:'var(--mono)',lineHeight:1.9,overflowX:'auto'}}>
                  <span style={{color:'#6a9955'}}>{'// Firestore Security Rules  supports owner + shared-access (Team Members)'}</span><br/>
                  <span style={{color:'#569cd6'}}>rules_version</span> = <span style={{color:'#ce9178'}}>'2'</span>;<br/>
                  <span style={{color:'#569cd6'}}>service</span> cloud.firestore {'{'}<br/>
                  &nbsp;&nbsp;<span style={{color:'#569cd6'}}>match</span> /databases/{'{'}<span style={{color:'#9cdcfe'}}>database</span>{'}'}/documents {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#6a9955'}}>// Owner's companies</span><br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#569cd6'}}>match</span> /users/{'{'}<span style={{color:'#9cdcfe'}}>uid</span>{'}'}/companies/{'{'}<span style={{color:'#9cdcfe'}}>companyId</span>{'}'} {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> read, write: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span> &amp;&amp; request.auth.uid == uid;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#6a9955'}}>// Shared-access read</span><br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> read: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span> &amp;&amp; exists(/databases/$(database)/documents/sharedAccess/$(request.auth.uid)/grants/$(companyId));<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#6a9955'}}>// Shared-access write (not for viewers)</span><br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> write: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span> &amp;&amp; exists(/databases/$(database)/documents/sharedAccess/$(request.auth.uid)/grants/$(companyId)) &amp;&amp; get(/databases/$(database)/documents/sharedAccess/$(request.auth.uid)/grants/$(companyId)).data.role != <span style={{color:'#ce9178'}}>'viewer'</span>;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#6a9955'}}>// Invitations  any authenticated user can read &amp; accept</span><br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#569cd6'}}>match</span> /invitations/{'{'}<span style={{color:'#9cdcfe'}}>code</span>{'}'} {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> read: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span>;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> create: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span>;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> update: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span> &amp;&amp; resource.data.used == <span style={{color:'#569cd6'}}>false</span>;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#6a9955'}}>// Shared access grants  user manages their own</span><br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#569cd6'}}>match</span> /sharedAccess/{'{'}<span style={{color:'#9cdcfe'}}>uid</span>{'}'}/grants/{'{'}<span style={{color:'#9cdcfe'}}>grantId</span>{'}'} {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:'#4ec9b0'}}>allow</span> read, write: <span style={{color:'#569cd6'}}>if</span> request.auth != <span style={{color:'#569cd6'}}>null</span> &amp;&amp; request.auth.uid == uid;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
                  &nbsp;&nbsp;{'}'}<br/>
                  {'}'}
                </div>
                <div style={{marginTop:10,background:'var(--warn-soft)',borderRadius:7,padding:'9px 12px',fontSize:11,color:'var(--ink-2)'}}>
                  ⚠ After updating rules, also enable <b>Collection Group Queries</b> in Firestore → Indexes for <code>grants</code> collection (needed for Team Members list).
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
