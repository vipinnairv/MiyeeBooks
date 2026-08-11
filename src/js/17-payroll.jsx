
// ============================================================================
// GOOGLE DRIVE SYNC
// ============================================================================
function GoogleDriveSync({data, setData, showToast}){
  const [clientId, setClientId] = useState(localStorage.getItem('miyeebooks_gdrive_clientid') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSync, setLastSync] = useState(localStorage.getItem('miyeebooks_gdrive_lastsync') || null);
  const [autoSync, setAutoSync] = useState(localStorage.getItem('miyeebooks_gdrive_autosync') === 'true');
  const [folderName, setFolderName] = useState(localStorage.getItem('miyeebooks_gdrive_folder') || 'MiyeeBooks_Backup');
  const [driveFiles, setDriveFiles] = useState([]);
  const [conflictInfo, setConflictInfo] = useState(null);
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FILENAME = 'miyeebooks_data.json';

  const saveSettings = () => {
    localStorage.setItem('miyeebooks_gdrive_clientid', clientId);
    localStorage.setItem('miyeebooks_gdrive_folder', folderName);
    localStorage.setItem('miyeebooks_gdrive_autosync', autoSync);
    showToast('Google Drive settings saved');
  };

  const connectGDrive = () => {
    if(!clientId) { showToast('Enter your Google OAuth Client ID first', 'error'); return; }
    localStorage.setItem('miyeebooks_gdrive_clientid', clientId);
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
      'client_id=' + encodeURIComponent(clientId) +
      '&redirect_uri=' + encodeURIComponent(window.location.origin + window.location.pathname) +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(SCOPE) +
      '&prompt=consent';
    window.location.href = authUrl;
  };

  // Check for OAuth token in URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if(hash.includes('access_token=')){
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if(token){
        setAccessToken(token);
        setIsConnected(true);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        showToast('Connected to Google Drive!');
      }
    }
  }, []);

  const findOrCreateFolder = async (token) => {
    // Search for folder
    const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='" + folderName + "' and mimeType='application/vnd.google-apps.folder' and trashed=false") + '&fields=files(id,name)', {
      headers: {'Authorization': 'Bearer ' + token}
    });
    const searchData = await searchRes.json();
    if(searchData.files && searchData.files.length > 0) return searchData.files[0].id;
    
    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: JSON.stringify({name: folderName, mimeType: 'application/vnd.google-apps.folder'})
    });
    const folder = await createRes.json();
    return folder.id;
  };

  const uploadToDrive = async () => {
    if(!accessToken) { showToast('Connect to Google Drive first', 'error'); return; }
    setSyncStatus('uploading');
    try {
      const folderId = await findOrCreateFolder(accessToken);
      
      const exportData = {
        ...data,
        _meta: {
          app: 'MiyeeBooks',
          version: '1.0.0',
          syncedAt: new Date().toISOString(),
          company: data.company.name,
          syncSource: 'GoogleDrive',
        }
      };

      // Check for existing file
      const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='" + FILENAME + "' and '" + folderId + "' in parents and trashed=false") + '&fields=files(id,name,modifiedTime)', {
        headers: {'Authorization': 'Bearer ' + accessToken}
      });
      const searchData = await searchRes.json();
      
      const boundary = 'miyeebooks_boundary_' + Date.now();
      const metadata = JSON.stringify({
        name: FILENAME,
        mimeType: 'application/json',
        parents: searchData.files?.length ? undefined : [folderId],
      });
      const fileContent = JSON.stringify(exportData, null, 2);
      
      const multipartBody = 
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
        metadata + '\r\n' +
        '--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
        fileContent + '\r\n' +
        '--' + boundary + '--';

      let url, method;
      if(searchData.files && searchData.files.length > 0){
        // Update existing
        url = 'https://www.googleapis.com/upload/drive/v3/files/' + searchData.files[0].id + '?uploadType=multipart';
        method = 'PATCH';
      } else {
        // Create new
        url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        method = 'POST';
      }

      const uploadRes = await fetch(url, {
        method,
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: multipartBody,
      });

      if(!uploadRes.ok) throw new Error('Upload failed: ' + uploadRes.status);
      
      const now = new Date().toISOString();
      setLastSync(now);
      localStorage.setItem('miyeebooks_gdrive_lastsync', now);
      setSyncStatus('idle');
      showToast('Synced to Google Drive → ' + folderName + '/' + FILENAME);
      listDriveFiles();
    } catch(err){
      setSyncStatus('error');
      showToast('Sync failed: ' + err.message, 'error');
    }
  };

  const downloadFromDrive = async () => {
    if(!accessToken) { showToast('Connect to Google Drive first', 'error'); return; }
    setSyncStatus('downloading');
    try {
      const folderId = await findOrCreateFolder(accessToken);
      const searchRes = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name='" + FILENAME + "' and '" + folderId + "' in parents and trashed=false") + '&fields=files(id,name,modifiedTime,size)', {
        headers: {'Authorization': 'Bearer ' + accessToken}
      });
      const searchData = await searchRes.json();
      
      if(!searchData.files || searchData.files.length === 0){
        showToast('No backup found on Drive in folder "' + folderName + '"', 'error');
        setSyncStatus('idle');
        return;
      }

      const fileId = searchData.files[0].id;
      const driveModified = new Date(searchData.files[0].modifiedTime);
      const localModified = lastSync ? new Date(lastSync) : new Date(0);

      // Conflict detection
      if(data.vouchers.length > 0 && lastSync && driveModified > localModified){
        setConflictInfo({driveTime: driveModified.toLocaleString('en-IN'), localTime: localModified.toLocaleString('en-IN'), fileId});
        setSyncStatus('idle');
        return;
      }

      await doDownload(fileId);
    } catch(err){
      setSyncStatus('error');
      showToast('Download failed: ' + err.message, 'error');
    }
  };

  const doDownload = async (fileId) => {
    setSyncStatus('downloading');
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
        headers: {'Authorization': 'Bearer ' + accessToken}
      });
      const imported = await res.json();
      
      if(!imported.company || !imported.coa){
        showToast('Invalid Drive file: not a MiyeeBooks backup', 'error');
        setSyncStatus('idle');
        return;
      }
      
      const {_meta, ...cleanData} = imported;
      setData(cleanData);
      
      const now = new Date().toISOString();
      setLastSync(now);
      localStorage.setItem('miyeebooks_gdrive_lastsync', now);
      setConflictInfo(null);
      setSyncStatus('idle');
      showToast('Restored from Google Drive: ' + (imported.company.name||'') + '  ' + (imported.vouchers?.length||0) + ' vouchers');
    } catch(err){
      setSyncStatus('error');
      showToast('Download failed: ' + err.message, 'error');
    }
  };

  const listDriveFiles = async () => {
    if(!accessToken) return;
    try {
      const folderId = await findOrCreateFolder(accessToken);
      const res = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("'" + folderId + "' in parents and trashed=false") + '&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc', {
        headers: {'Authorization': 'Bearer ' + accessToken}
      });
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch(err){
      console.error('List failed', err);
    }
  };

  useEffect(() => {
    if(accessToken) listDriveFiles();
  }, [accessToken]);

  // Auto-sync on data change
  useEffect(() => {
    if(autoSync && accessToken && syncStatus === 'idle'){
      const timer = setTimeout(() => uploadToDrive(), 5000);
      return () => clearTimeout(timer);
    }
  }, [data, autoSync, accessToken]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Google Drive Sync</h1>
          <div className="page-sub">Cloud backup & restore · Folder-scoped · OAuth 2.0</div>
        </div>
        <div className="page-actions">
          {isConnected && <span className="badge badge-success" style={{fontSize:12, padding:'6px 12px'}}>✓ Connected</span>}
          {lastSync && <span style={{fontSize:11, color:'var(--ink-3)'}}>Last sync: {new Date(lastSync).toLocaleString('en-IN')}</span>}
        </div>
      </div>

      <div className="stat-grid">
        <div className={'stat ' + (isConnected?'':'stat-danger')}>
          <div className="stat-label">Connection</div>
          <div className="stat-value" style={{fontSize:16}}>{isConnected ? '✓ Connected' : '✗ Not Connected'}</div>
        </div>
        <div className="stat"><div className="stat-label">Drive Folder</div><div className="stat-value" style={{fontSize:16}}>{folderName}</div></div>
        <div className="stat stat-gold"><div className="stat-label">Sync Status</div><div className="stat-value" style={{fontSize:16}}>{syncStatus === 'idle' ? '● Ready' : syncStatus === 'uploading' ? '↑ Uploading...' : syncStatus === 'downloading' ? '↓ Downloading...' : '✗ Error'}</div></div>
        <div className="stat stat-info"><div className="stat-label">Auto-Sync</div><div className="stat-value" style={{fontSize:16}}>{autoSync ? 'ON' : 'OFF'}</div></div>
      </div>

      {/* Conflict resolution */}
      {conflictInfo && (
        <div className="card" style={{marginTop:14, border:'2px solid var(--accent)'}}>
          <div className="card-head" style={{background:'var(--accent-soft)'}}>
            <h3 className="card-title" style={{color:'var(--warning)'}}>⚠ Sync Conflict Detected</h3>
          </div>
          <div className="card-body">
            <p style={{fontSize:13, marginBottom:12}}>The Google Drive version is <b>newer</b> than your last sync. Choose how to resolve:</p>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14}}>
              <div style={{padding:12, background:'var(--surface-2)', borderRadius:8, fontSize:12}}>
                <b>Local data:</b><br/>Last synced: {conflictInfo.localTime}<br/>Vouchers: {data.vouchers.length}
              </div>
              <div style={{padding:12, background:'var(--info-soft)', borderRadius:8, fontSize:12}}>
                <b>Drive data:</b><br/>Modified: {conflictInfo.driveTime}
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-primary" onClick={() => doDownload(conflictInfo.fileId)}>↓ Use Drive Version (Overwrite Local)</button>
              <button className="btn btn-accent" onClick={uploadToDrive}>↑ Keep Local & Push to Drive</button>
              <button className="btn" onClick={() => setConflictInfo(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginTop:18}}>
        {/* Setup */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Setup & Connection</h3></div>
          <div className="card-body">
            <div className="field" style={{marginBottom:14}}>
              <label>Google OAuth Client ID</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxx.apps.googleusercontent.com" style={{fontFamily:'var(--mono)', fontSize:11}} />
              <div className="help">Create at console.cloud.google.com → APIs → Credentials → OAuth 2.0</div>
            </div>
            <div className="field" style={{marginBottom:14}}>
              <label>Drive Folder Name</label>
              <input value={folderName} onChange={e => setFolderName(e.target.value)} />
              <div className="help">Data will be saved as "{FILENAME}" inside this folder</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
              <label style={{fontSize:12, fontWeight:600}}>Auto-Sync on data change:</label>
              <button className={'btn btn-sm ' + (autoSync?'btn-primary':'')} onClick={() => { setAutoSync(!autoSync); localStorage.setItem('miyeebooks_gdrive_autosync', !autoSync); }}>
                {autoSync ? 'ON ✓' : 'OFF'}
              </button>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn" onClick={saveSettings}>Save Settings</button>
              {!isConnected ? (
                <button className="btn btn-primary" onClick={connectGDrive} disabled={!clientId}>☁ Connect Google Drive</button>
              ) : (
                <button className="btn btn-danger" onClick={() => { setIsConnected(false); setAccessToken(null); showToast('Disconnected'); }}>Disconnect</button>
              )}
            </div>
          </div>
        </div>

        {/* Sync actions */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Sync Actions</h3></div>
          <div className="card-body">
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <button className="btn btn-primary" onClick={uploadToDrive} disabled={!isConnected || syncStatus!=='idle'} style={{justifyContent:'center', padding:'14px 16px'}}>
                {syncStatus==='uploading' ? '↑ Uploading...' : '↑ Backup to Google Drive'}
              </button>
              <button className="btn btn-accent" onClick={downloadFromDrive} disabled={!isConnected || syncStatus!=='idle'} style={{justifyContent:'center', padding:'14px 16px'}}>
                {syncStatus==='downloading' ? '↓ Downloading...' : '↓ Restore from Google Drive'}
              </button>
              <button className="btn" onClick={listDriveFiles} disabled={!isConnected} style={{justifyContent:'center'}}>
                ↻ Refresh Drive Files
              </button>
            </div>

            {driveFiles.length > 0 && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:1, fontWeight:600, color:'var(--ink-3)', marginBottom:6}}>Files in "{folderName}"</div>
                <table style={{fontSize:12}}>
                  <thead><tr><th>File</th><th>Modified</th><th>Size</th></tr></thead>
                  <tbody>
                    {driveFiles.map(f => (
                      <tr key={f.id}>
                        <td style={{fontFamily:'var(--mono)'}}>{f.name}</td>
                        <td>{new Date(f.modifiedTime).toLocaleString('en-IN')}</td>
                        <td>{f.size ? (f.size/1024).toFixed(1)+' KB' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup guide */}
      <div className="card" style={{marginTop:18}}>
        <div className="card-head"><h3 className="card-title">Setup Guide  Google Drive API</h3></div>
        <div className="card-body" style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.8}}>
          <p><b>Step 1:</b> Go to <a href="https://console.cloud.google.com" target="_blank" style={{color:'var(--primary)'}}>console.cloud.google.com</a> → Create or select a project.</p>
          <p><b>Step 2:</b> Enable <b>Google Drive API</b> from the APIs & Services library.</p>
          <p><b>Step 3:</b> Go to <b>Credentials → Create OAuth Client ID</b>. Select "Web application".</p>
          <p><b>Step 4:</b> Add your current URL as an <b>Authorized redirect URI</b>: <code style={{background:'var(--surface-2)', padding:'2px 6px', borderRadius:3, fontFamily:'var(--mono)', fontSize:11}}>{window.location.origin + window.location.pathname}</code></p>
          <p><b>Step 5:</b> Copy the Client ID (looks like <code style={{background:'var(--surface-2)', padding:'2px 6px', borderRadius:3, fontFamily:'var(--mono)', fontSize:11}}>xxx.apps.googleusercontent.com</code>) and paste it above.</p>
          <p><b>Step 6:</b> If the app is in "Testing" mode, add your Gmail as a <b>Test User</b> under the OAuth consent screen.</p>
          <p style={{marginTop:10, padding:10, background:'var(--primary-soft)', borderRadius:6, color:'var(--primary)'}}>
            <b>Scope used:</b> <code>drive.file</code>  MiyeeBooks can ONLY access files it creates. It cannot read any other files on your Drive.
          </p>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// HR MODULE  EMPLOYEE MASTER
// ============================================================================
function EmployeeMaster({data, setData, showToast, readOnly=false}){
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const EMP_SAMPLE_HEADERS = ['empCode','name','designation','department','doj','pan','uan','bankAcc','ifsc','email','phone','basic','hra','da','sa','status'];
  const EMP_SAMPLE_ROWS = [
    {empCode:'EMP001',name:'Ramesh Sharma',designation:'Senior Manager',department:'Finance',doj:'2023-01-15',pan:'ABCDE1234F',uan:'100234567890',bankAcc:'12345678901234',ifsc:'SBIN0001234',email:'ramesh@company.com',phone:'9876543210',basic:'35000',hra:'14000',da:'0',sa:'5000',status:'Active'},
    {empCode:'EMP002',name:'Priya Nair',designation:'Executive',department:'HR',doj:'2024-06-01',pan:'BCDFE5678G',uan:'100987654321',bankAcc:'98765432109876',ifsc:'HDFC0002345',email:'priya@company.com',phone:'9988776655',basic:'22000',hra:'8800',da:'0',sa:'3200',status:'Active'},
  ];

  const handleImportEmployees = (rows) => {
    const imported = [];
    const errors   = [];
    rows.forEach((r, i) => {
      const empCode = r['empCode']?.trim();
      const name    = r['name']?.trim();
      if(!empCode || !name){ errors.push(`Row ${i+2}: empCode and name are required`); return; }
      if((data.employees||[]).find(e => e.empCode === empCode)) return; // skip duplicate
      imported.push({
        id: uid(),
        empCode,
        name,
        designation: r['designation']?.trim() || '',
        department:  r['department']?.trim()  || '',
        doj:         r['doj']?.trim()          || '',
        pan:         (r['pan']?.trim()||'').toUpperCase(),
        uan:         r['uan']?.trim()           || '',
        esicNo:      r['esicNo']?.trim()        || '',
        bankAcc:     r['bankAcc']?.trim()       || '',
        ifsc:        (r['ifsc']?.trim()||'').toUpperCase(),
        email:       r['email']?.trim()         || '',
        phone:       r['phone']?.trim()         || '',
        basic:       parseFloat(r['basic'])  || 0,
        hra:         parseFloat(r['hra'])    || 0,
        da:          parseFloat(r['da'])     || 0,
        sa:          parseFloat(r['sa'])     || 0,
        allowances:  [],
        pfApplicable: true,
        pfBase: 0,
        esicApplicable: false,
        ptAmount: 200,
        tdsSalary: 0,
        status: r['status']?.trim() || 'Active',
        aadhaar: '', annualCTC: 0,
      });
    });
    if(errors.length > 0 && imported.length === 0) return { count:0, error: errors.slice(0,3).join('; ') };
    setData(prev => ({...prev, employees: [...(prev.employees||[]), ...imported]}));
    showToast('Imported ' + imported.length + ' employees' + (errors.length?' ('+errors.length+' skipped)':''));
    return { count: imported.length };
  };

  const filtered = (data.employees||[]).filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.empCode||'').toLowerCase().includes(search.toLowerCase()));

  const handleSave = (emp) => {
    if(editing){
      setData(prev => ({...prev, employees: prev.employees.map(e => e.id === editing.id ? {...emp, id:editing.id} : e)}));
      showToast('Employee updated');
    } else {
      setData(prev => ({...prev, employees: [...(prev.employees||[]), {...emp, id:uid()}]}));
      showToast('Employee added');
    }
    setShowModal(false); setEditing(null);
  };

  const handleDelete = (emp) => {
    if(!confirm('Delete employee "'+emp.name+'"?')) return;
    setData(prev => ({...prev, employees: prev.employees.filter(e => e.id !== emp.id)}));
    showToast('Employee deleted');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Employee Master</h1>
          <div className="page-sub">HR module · {(data.employees||[]).length} employees · Salary structure & statutory config</div>
        </div>
        {!readOnly && <div className="page-actions">
          <button className="btn" onClick={() => setShowImport(true)}>⬆ Import CSV</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Add Employee</button>
        </div>}
      </div>

      <div className="filter-bar">
        <div className="field"><label>Search</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or code..." style={{minWidth:240}} /></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Dept</th><th>PAN</th><th>UAN</th><th className="num">CTC (Monthly)</th><th className="num">Net Pay</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="10"><div className="empty"><div className="empty-ico">☺</div><div>No employees yet. Add your first employee to get started.</div></div></td></tr>
            ) : filtered.map(e => {
              // All salary components stored as MONTHLY values
              const gross = (e.basic||0)+(e.hra||0)+(e.da||0)+(e.sa||0)+(e.allowances||[]).reduce((s,a)=>s+(a.amount||0),0);
              const pfBase = Math.min(e.pfBase||e.basic||0, 15000);
              const pfEe = e.pfApplicable ? Math.round(pfBase * 0.12) : 0;
              const esicEe = e.esicApplicable && gross <= 21000 ? Math.round(gross*0.0075) : 0;
              const pt = calcPTMonthly(e, today(), data.company.fyStart);
              const tds = e.tdsSalary || 0;
              const net = gross - pfEe - esicEe - pt - tds;
              return (
                <tr key={e.id}>
                  <td style={{fontFamily:'var(--mono)', fontWeight:600}}>{e.empCode}</td>
                  <td><b>{e.name}</b></td>
                  <td>{e.designation||''}</td>
                  <td>{e.department||''}</td>
                  <td style={{fontFamily:'var(--mono)', fontSize:11}}>{e.pan||''}</td>
                  <td style={{fontFamily:'var(--mono)', fontSize:11}}>{e.uan||''}</td>
                  <td className="num">₹{fmt(gross)}</td>
                  <td className="num bold pos">₹{fmt(net)}</td>
                  <td><span className={'badge '+(e.status==='Active'?'badge-success':'badge-muted')}>{e.status||'Active'}</span></td>
                  <td className="actions">
                    {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(e); setShowModal(true); }}>Edit</button>}
                    {!readOnly && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e)}>×</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && <EmployeeModal employee={editing} onSave={handleSave} onClose={() => { setShowModal(false); setEditing(null); }} data={data} />}
      {showImport && <CsvImportModal title="Import Employee Master Data" sampleHeaders={EMP_SAMPLE_HEADERS} sampleRows={EMP_SAMPLE_ROWS} sampleFilename="employees_import_template.csv" onImport={handleImportEmployees} onClose={() => setShowImport(false)} />}
    </>
  );
}

function EmployeeModal({employee, onSave, onClose, data}){
  const [f, setF] = useState(employee || {
    empCode:'', name:'', designation:'', department:'', doj:'', pan:'', aadhaar:'', uan:'', esicNo:'', bankAcc:'', ifsc:'', status:'Active',
    basic:0, hra:0, da:0, sa:0,
    allowances: [{id:uid(), name:'Conveyance Allowance', amount:0}, {id:uid(), name:'Medical Allowance', amount:0}],
    pfApplicable:true, pfBase:0, esicApplicable:false, ptAmount:200, tdsSalary:0,
    email:'', phone:'',
    loginEmail:'', reportingManagerId:'', portalRole:'',
  });

  const addAllowance = () => setF({...f, allowances:[...(f.allowances||[]),{id:uid(),name:'',amount:0}]});
  const removeAllowance = (id) => setF({...f, allowances:(f.allowances||[]).filter(a => a.id !== id)});
  const updateAllowance = (id, field, val) => setF({...f, allowances:(f.allowances||[]).map(a => a.id===id?{...a,[field]:field==='amount'?(parseFloat(val)||0):val}:a)});

  const gross = (f.basic||0)+(f.hra||0)+(f.da||0)+(f.sa||0)+(f.allowances||[]).reduce((s,a)=>s+(a.amount||0),0);
  const pfEe = f.pfApplicable ? Math.round(Math.min(f.pfBase||f.basic||0, 15000)*0.12) : 0;
  const pfEr = f.pfApplicable ? Math.round(Math.min(f.pfBase||f.basic||0, 15000)*0.12) : 0;
  const esicEe = f.esicApplicable && gross <= 21000 ? Math.round(gross*0.0075) : 0;
  const esicEr = f.esicApplicable && gross <= 21000 ? Math.round(gross*0.0325) : 0;
  // Monthly PT for preview (using today's month)
  const pt = calcPTMonthly(f, today(), data?.company?.fyStart);
  const annualPT = calcPTAnnual(f, data?.company?.fyStart || '2025-04-01');
  const tds = f.tdsSalary || 0;
  const totalDeductions = pfEe + esicEe + pt + tds;
  const net = gross - totalDeductions;
  const ctc = gross + pfEr + esicEr;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{employee ? 'Edit Employee' : 'Add Employee'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{maxHeight:'70vh', overflowY:'auto'}}>

          <div className="section-divider"><div className="label">Personal Details</div><div className="line"></div></div>
          <div className="form-grid">
            <div className="field required"><label>Employee Code</label><input value={f.empCode} onChange={e => setF({...f, empCode:e.target.value})} placeholder="EMP001" /></div>
            <div className="field required"><label>Full Name</label><input value={f.name} onChange={e => setF({...f, name:e.target.value})} /></div>
            <div className="field"><label>Designation</label><input value={f.designation} onChange={e => setF({...f, designation:e.target.value})} /></div>
            <div className="field"><label>Department</label><input value={f.department} onChange={e => setF({...f, department:e.target.value})} /></div>
            <div className="field"><label>Date of Joining</label><input type="date" value={f.doj} onChange={e => setF({...f, doj:e.target.value})} /></div>
            <div className="field"><label>Status</label><select value={f.status} onChange={e => setF({...f, status:e.target.value})}><option>Active</option><option>Inactive</option><option>Resigned</option></select></div>
            <div className="field"><label>PAN</label><input value={f.pan} onChange={e => setF({...f, pan:e.target.value.toUpperCase()})} maxLength="10" /></div>
            <div className="field"><label>Aadhaar</label><input value={f.aadhaar} onChange={e => setF({...f, aadhaar:e.target.value})} maxLength="12" /></div>
            <div className="field"><label>UAN (PF)</label><input value={f.uan} onChange={e => setF({...f, uan:e.target.value})} /></div>
            <div className="field"><label>ESIC No.</label><input value={f.esicNo} onChange={e => setF({...f, esicNo:e.target.value})} /></div>
            <div className="field"><label>Bank A/c No.</label><input value={f.bankAcc} onChange={e => setF({...f, bankAcc:e.target.value})} /></div>
            <div className="field"><label>IFSC</label><input value={f.ifsc} onChange={e => setF({...f, ifsc:e.target.value.toUpperCase()})} /></div>
            <div className="field"><label>Email</label><input value={f.email} onChange={e => setF({...f, email:e.target.value})} /></div>
            <div className="field"><label>Phone</label><input value={f.phone} onChange={e => setF({...f, phone:e.target.value})} /></div>
            <div className="field"><label>Portal Login Email <span style={{color:'var(--ink-3)',fontWeight:400}}>· for the Reimbursement Portal</span></label>
              <input value={f.loginEmail||''} onChange={e => setF({...f, loginEmail:e.target.value})} placeholder="Sign-in email (matches their team invite)" /></div>
            <div className="field"><label>Portal Role</label>
              <select value={f.portalRole||''} onChange={e => setF({...f, portalRole:e.target.value})}>
                <option value="">— Not a portal user —</option>
                <option value="employee">Employee (portal-only)</option>
                <option value="manager">Manager (approves too)</option>
              </select></div>
            <div className="field"><label>Reporting Manager</label>
              <select value={f.reportingManagerId||''} onChange={e => setF({...f, reportingManagerId:e.target.value})}>
                <option value="">— None —</option>
                {(data.employees||[]).filter(e=>e.id!==f.id).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select></div>
          </div>

          <div className="section-divider"><div className="label">Earnings / Salary Structure</div><div className="line"></div></div>
          <div style={{marginBottom:10, padding:10, background:'var(--info-soft)', borderRadius:8, display:'flex', gap:14, alignItems:'flex-end'}}>
            <div className="field" style={{flex:1}}>
              <label style={{color:'var(--info)', fontWeight:700}}>Annual CTC (₹)</label>
              <input type="number" value={f.annualCTC||0} onChange={e => {
                const ctcVal = parseFloat(e.target.value)||0;
                // Auto-split: Basic 40%, HRA 20%, SA = balance minus employer PF/ESIC
                const monthly = Math.round(ctcVal/12);
                const b = Math.round(monthly * 0.40); // Basic: 40%
                const h = Math.round(monthly * 0.20); // HRA: 20% of CTC
                const d = Math.round(monthly * 0.00); // DA: 0% (user sets manually)
                const s = monthly - b - h - d;        // SA: balance
                setF({...f, annualCTC:ctcVal, basic:b, hra:h, da:d, sa:s, pfBase:b});
              }} style={{fontSize:16, fontWeight:700, padding:'10px 12px'}} />
              <div className="help">Enter annual CTC  monthly breakup auto-calculated (Basic 40%, HRA 20%, SA = balance)</div>
            </div>
            <div style={{textAlign:'center', padding:'8px 16px', background:'var(--surface)', borderRadius:6, border:'1px solid var(--line)'}}>
              <div style={{fontSize:10, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:1}}>Monthly Gross</div>
              <div style={{fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color:'var(--primary)'}}>₹{fmt(Math.round((f.annualCTC||0)/12))}</div>
            </div>
          </div>
          <div className="form-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
            <div className="field required"><label>Basic Salary (Monthly)</label><input type="number" value={f.basic} onChange={e => setF({...f, basic:parseFloat(e.target.value)||0, pfBase:parseFloat(e.target.value)||0})} /></div>
            <div className="field"><label>HRA (Monthly)</label><input type="number" value={f.hra} onChange={e => setF({...f, hra:parseFloat(e.target.value)||0})} /></div>
            <div className="field"><label>Dearness Allowance</label><input type="number" value={f.da} onChange={e => setF({...f, da:parseFloat(e.target.value)||0})} /></div>
            <div className="field"><label>Special Allowance</label><input type="number" value={f.sa} onChange={e => setF({...f, sa:parseFloat(e.target.value)||0})} /></div>
          </div>
          <div className="help" style={{marginTop:4}}>Above values are <b>monthly</b>. Edit individually to override the CTC auto-split.</div>

          <div style={{marginTop:12, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:1, color:'var(--ink-3)'}}>Custom Allowances</span>
            <button className="btn btn-sm" onClick={addAllowance}>+ Add Allowance</button>
          </div>
          {(f.allowances||[]).map(a => (
            <div key={a.id} style={{display:'flex', gap:8, marginBottom:4, alignItems:'center'}}>
              <input value={a.name} onChange={e => updateAllowance(a.id,'name',e.target.value)} placeholder="Allowance name" style={{flex:1, padding:'6px 8px', border:'1px solid var(--line)', borderRadius:4, fontSize:12}} />
              <input type="number" value={a.amount} onChange={e => updateAllowance(a.id,'amount',e.target.value)} placeholder="Amount" style={{width:120, padding:'6px 8px', border:'1px solid var(--line)', borderRadius:4, fontSize:12, textAlign:'right'}} />
              <span style={{cursor:'pointer', color:'var(--danger)', padding:4}} onClick={() => removeAllowance(a.id)}>×</span>
            </div>
          ))}

          <div className="section-divider"><div className="label">Statutory Deductions</div><div className="line"></div></div>
          <div className="form-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
            <div className="field">
              <label style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={f.pfApplicable} onChange={e => setF({...f, pfApplicable:e.target.checked})} /> PF Applicable
              </label>
              {f.pfApplicable && <input type="number" value={f.pfBase||f.basic} onChange={e => setF({...f, pfBase:parseFloat(e.target.value)||0})} style={{marginTop:4}} />}
              <div className="help">{f.pfApplicable ? 'PF Base: ₹'+fmt(Math.min(f.pfBase||f.basic,15000))+' (capped at ₹15,000) · EE 12%: ₹'+fmt(pfEe)+' · ER 12%: ₹'+fmt(pfEr) : 'Not applicable'}</div>
            </div>
            <div className="field">
              <label style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={f.esicApplicable} onChange={e => setF({...f, esicApplicable:e.target.checked})} /> ESIC Applicable
              </label>
              <div className="help">{f.esicApplicable ? (gross<=21000 ? 'EE 0.75%: ₹'+fmt(esicEe)+' · ER 3.25%: ₹'+fmt(esicEr) : 'Gross >₹21K  not eligible') : 'Not applicable'}</div>
            </div>
            <div className="field">
              <label>Professional Tax (₹/month)</label>
              <input type="number" value={f.ptAmount} onChange={e => setF({...f, ptAmount:parseFloat(e.target.value)||0})} />
              <div className="help">Monthly: ₹{pt} · Annual (prorated from DOJ): <b>₹{annualPT}</b> {f.doj && '(DOJ: '+f.doj+')'}</div>
            </div>
            <div className="field">
              <label>TDS on Salary (₹/month)</label>
              <input type="number" value={f.tdsSalary} onChange={e => setF({...f, tdsSalary:parseFloat(e.target.value)||0})} />
              <div className="help">Estimated monthly TDS u/s 192</div>
            </div>
          </div>

          {/* Summary card */}
          <div style={{marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
            <div style={{padding:14, background:'var(--primary-soft)', borderRadius:8, textAlign:'center'}}>
              <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:1, color:'var(--primary)', fontWeight:600}}>Gross Salary <span style={{fontWeight:400}}>(Per Month)</span></div>
              <div style={{fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'var(--primary)'}}>₹{fmt(gross)}</div>
              <div style={{fontSize:9, color:'var(--ink-3)', marginTop:2}}>Annual: ₹{fmt(gross*12)}</div>
            </div>
            <div style={{padding:14, background:'var(--danger-soft)', borderRadius:8, textAlign:'center'}}>
              <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:1, color:'var(--danger)', fontWeight:600}}>Deductions <span style={{fontWeight:400}}>(Per Month)</span></div>
              <div style={{fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'var(--danger)'}}>₹{fmt(totalDeductions)}</div>
              <div style={{fontSize:9, color:'var(--ink-3)', marginTop:2}}>PF: ₹{fmt(pfEe)} | ESIC: ₹{fmt(esicEe)} | PT: ₹{fmt(pt)} | TDS: ₹{fmt(tds)}</div>
            </div>
            <div style={{padding:14, background:'var(--accent-soft)', borderRadius:8, textAlign:'center'}}>
              <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:1, color:'var(--warning)', fontWeight:600}}>Net Pay <span style={{fontWeight:400}}>(Per Month)</span></div>
              <div style={{fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'var(--ink)'}}>₹{fmt(net)}</div>
              <div style={{fontSize:9, color:'var(--ink-3)', marginTop:2}}>Annual Net: ₹{fmt(net*12)}</div>
            </div>
          </div>
          {/* Annual CTC summary */}
          <div style={{marginTop:10, padding:'10px 16px', background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
            <span style={{fontSize:11, color:'var(--ink-3)'}}>📊 <b>Annual Summary</b></span>
            <span style={{fontSize:11}}>Gross: <b>₹{fmt(gross*12)}</b></span>
            <span style={{fontSize:11}}>PF (EE): <b>₹{fmt(pfEe*12)}</b></span>
            <span style={{fontSize:11}}>ESIC (EE): <b>₹{fmt(esicEe*12)}</b></span>
            <span style={{fontSize:11}}>PT: <b>₹{fmt(annualPT)}</b></span>
            <span style={{fontSize:11}}>TDS: <b>₹{fmt(tds*12)}</b></span>
            <span style={{fontSize:12, fontWeight:700, color:'var(--primary)'}}>Annual Net: ₹{fmt(gross*12 - pfEe*12 - esicEe*12 - annualPT - tds*12)}</span>
            <span style={{fontSize:12, fontWeight:700, color:'var(--ink)'}}>CTC: ₹{fmt((gross + pfEr + esicEr)*12)}/yr</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(f)} disabled={!f.name || !f.empCode}>Save Employee</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HR MODULE  RUN PAYROLL
// ============================================================================
function RunPayroll({data, setData, showToast}){
  const [month, setMonth] = useState(today().slice(0,7));
  const [preview, setPreview] = useState(null);

  const activeEmployees = (data.employees||[]).filter(e => e.status === 'Active');
  const existingRun = (data.payrollRuns||[]).find(r => r.month === month);

  const daysInMonth = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0).getDate();

  // Compute one payslip line, prorated for Loss of Pay (LOP) days and with any
  // one-time bonus/arrears folded into the earnings so the payslip stays
  // internally consistent (earnings total == gross).
  const computeLine = (e, lopDays=0, bonus=0) => {
    const rnd = n => Math.round(n||0);
    lopDays = Math.max(0, Math.min(daysInMonth, lopDays||0));
    bonus   = Math.max(0, bonus||0);
    const paidDays = daysInMonth - lopDays;
    const factor   = daysInMonth>0 ? paidDays/daysInMonth : 1;   // LOP proration
    const basic = rnd((e.basic||0)*factor);
    const hra   = rnd((e.hra||0)*factor);
    const da    = rnd((e.da||0)*factor);
    const sa    = rnd((e.sa||0)*factor);
    const allowances = (e.allowances||[]).map(a => ({...a, amount: rnd((a.amount||0)*factor)}));
    if(bonus>0) allowances.push({name:'Bonus / Arrears', amount:rnd(bonus), oneTime:true});
    const gross = basic + hra + da + sa + allowances.reduce((s,a)=>s+(a.amount||0),0);
    const pfWage = Math.min(e.pfBase||e.basic||0, 15000) * factor;
    const pfEe = e.pfApplicable ? rnd(pfWage*0.12) : 0;
    const pfEr = e.pfApplicable ? rnd(pfWage*0.12) : 0;
    const esicEe = e.esicApplicable && gross <= 21000 ? rnd(gross*0.0075) : 0;
    const esicEr = e.esicApplicable && gross <= 21000 ? rnd(gross*0.0325) : 0;
    const pt  = calcPTMonthly(e, month, data.company.fyStart);
    const tds = e.tdsSalary || 0;
    const totalDed = pfEe + esicEe + pt + tds;
    const net = gross - totalDed;
    return {empId:e.id, empCode:e.empCode, name:e.name, designation:e.designation||'', department:e.department||'',
      pan:e.pan||'', uan:e.uan||'', bankAcc:e.bankAcc||'',
      lopDays, bonus, paidDays, daysInMonth,
      basic, hra, da, sa, allowances, gross, pfEe, pfEr, esicEe, esicEr, pt, tds, totalDed, net};
  };

  const generatePreview = () => {
    const payMonthEnd = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0);
    const eligible = activeEmployees.filter(e => !e.doj || new Date(e.doj) <= payMonthEnd);
    setPreview(eligible.map(e => computeLine(e, 0, 0)));
  };

  // Recompute a single line when its LOP days / bonus are edited in the preview.
  const updateLine = (empId, patch) => setPreview(prev => prev.map(l => {
    if(l.empId !== empId) return l;
    const e = activeEmployees.find(x => x.id === empId) || l;
    return computeLine(e, patch.lopDays != null ? patch.lopDays : l.lopDays, patch.bonus != null ? patch.bonus : l.bonus);
  }));

  const postPayroll = () => {
    if(!preview || preview.length === 0) return;
    const voucherDate = month+'-28';
    // Respect the period lock (a closed month can't take new entries)
    if(isDateLocked(data.company, voucherDate)){
      showToast(`Books are locked up to ${data.company.booksLockedUpto} - cannot post payroll for ${month}`,'error');
      return;
    }
    const totalGross = preview.reduce((s,l)=>s+l.gross,0);
    const totalPfEe = preview.reduce((s,l)=>s+l.pfEe,0);
    const totalPfEr = preview.reduce((s,l)=>s+l.pfEr,0);
    const totalEsicEe = preview.reduce((s,l)=>s+l.esicEe,0);
    const totalEsicEr = preview.reduce((s,l)=>s+l.esicEr,0);
    const totalPT = preview.reduce((s,l)=>s+l.pt,0);
    const totalTDS = preview.reduce((s,l)=>s+l.tds,0);
    const totalNet = preview.reduce((s,l)=>s+l.net,0);

    // Create voucher lines
    const lines = [];
    // Dr Salaries & Wages (Gross)
    lines.push({id:uid(), accountId:'4200', debit:totalGross, credit:0, narration:'Salary '+month});
    // Dr Employer PF contribution
    if(totalPfEr>0) lines.push({id:uid(), accountId:'4210', debit:totalPfEr, credit:0, narration:'Employer PF'});
    // Dr Employer ESIC
    if(totalEsicEr>0) lines.push({id:uid(), accountId:'4210', debit:totalEsicEr, credit:0, narration:'Employer ESIC'});
    // Cr PF Payable
    if(totalPfEe+totalPfEr>0) lines.push({id:uid(), accountId:'1322', debit:0, credit:totalPfEe+totalPfEr, narration:'PF EE+ER'});
    // Cr ESIC Payable
    if(totalEsicEe+totalEsicEr>0) lines.push({id:uid(), accountId:'1323', debit:0, credit:totalEsicEe+totalEsicEr, narration:'ESIC EE+ER'});
    // Cr PT Payable
    if(totalPT>0) lines.push({id:uid(), accountId:'1324', debit:0, credit:totalPT, narration:'Professional Tax'});
    // Cr TDS on Salary
    if(totalTDS>0) lines.push({id:uid(), accountId:'1321', debit:0, credit:totalTDS, narration:'TDS u/s 192'});
    // Cr Salary Payable (Net)
    lines.push({id:uid(), accountId:'1320', debit:0, credit:totalNet, narration:'Net salary payable'});

    const voucherNum = 'JV/SAL/' + month;
    // Under maker-checker the JV is created as Pending and only hits the ledgers
    // once an owner/admin approves it (Vouchers screen).
    const status = data.company.makerChecker === true ? 'Pending' : 'Posted';
    const totalLop = preview.reduce((s,l)=>s+(l.lopDays||0),0);
    const newVoucher = {
      id:uid(), type:'JV', date:voucherDate, number:voucherNum, partyName:'Payroll  '+month,
      narration:'Being salary for '+month+' (' +preview.length+' employees'+(totalLop?`, ${totalLop} LOP days`:'')+')', reference:'Payroll',
      lines, amount:totalGross+totalPfEr+totalEsicEr, status, createdAt:new Date().toISOString(),
    };

    const payrollRun = {
      id:uid(), month, processedAt:new Date().toISOString(), voucherId:newVoucher.id, status,
      employees:preview, totalGross, totalNet,
      totalPfEe, totalPfEr, totalEsicEe, totalEsicEr, totalPT, totalTDS,
    };

    setData(prev => ({...prev,
      vouchers:[...(prev.vouchers||[]), newVoucher],
      payrollRuns:[...(prev.payrollRuns||[]), payrollRun],
      auditLog:[...(prev.auditLog||[]), auditEntry('CREATE', `${voucherNum} (JV) Payroll ${month} · ${preview.length} emp · gross ₹${fmt(totalGross)}${status==='Pending'?' · PENDING approval':''}`)],
    }));
    showToast(status==='Pending'
      ? 'Payroll JV created (pending approval) for '+month+' · '+voucherNum
      : 'Payroll JV posted for '+month+' · '+preview.length+' employees · '+voucherNum);
    setPreview(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Run Payroll</h1>
          <div className="page-sub">Process monthly salary · Auto-generates JV with all statutory deductions</div>
        </div>
        <div className="page-actions">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
        </div>
      </div>

      {existingRun && (
        <div style={{padding:14, background:'var(--primary-soft)', border:'1px solid var(--primary)', borderRadius:8, marginBottom:14}}>
          <b>✓ Payroll already processed for {month}</b> · {existingRun.employees?.length} employees · Gross: ₹{fmt(existingRun.totalGross)} · Net: ₹{fmt(existingRun.totalNet)} · Processed: {new Date(existingRun.processedAt).toLocaleString('en-IN')}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Active Employees</div><div className="stat-value">{activeEmployees.length}</div></div>
        <div className="stat stat-info"><div className="stat-label">Total Gross (est.)</div><div className="stat-value rupee">₹{fmt(activeEmployees.reduce((s,e)=>s+(e.basic||0)+(e.hra||0)+(e.da||0)+(e.sa||0)+(e.allowances||[]).reduce((ss,a)=>ss+(a.amount||0),0),0))}</div></div>
        <div className="stat stat-gold"><div className="stat-label">Payroll Runs (YTD)</div><div className="stat-value">{(data.payrollRuns||[]).length}</div></div>
      </div>

      {!preview ? (
        <div style={{textAlign:'center', padding:40}}>
          <button className="btn btn-primary" onClick={generatePreview} disabled={activeEmployees.length===0} style={{padding:'14px 32px', fontSize:14}}>
            ⊕ Generate Payroll Preview for {month}
          </button>
          {activeEmployees.length === 0 && <p style={{marginTop:10, color:'var(--ink-3)', fontSize:12}}>Add employees in Employee Master first.</p>}
        </div>
      ) : (
        <>
          <div className="card" style={{marginTop:14}}>
            <div className="card-head">
              <h3 className="card-title">Payroll Preview  {month}</h3>
              <div style={{display:'flex',gap:8}}>
                <button className="btn" onClick={() => setPreview(null)}>← Back</button>
                <button className="btn btn-primary" onClick={postPayroll} disabled={!!existingRun}>⊕ Post Payroll JV</button>
              </div>
            </div>
            <div style={{overflow:'auto'}}>
              <table>
                <thead>
                  <tr><th>Code</th><th>Employee</th><th className="num">Paid Days</th><th className="num">LOP</th><th className="num">Bonus/Arrears</th><th className="num">Basic</th><th className="num">HRA</th><th className="num">DA+SA+Allow</th><th className="num">Gross</th><th className="num">PF (EE)</th><th className="num">ESIC (EE)</th><th className="num">PT</th><th className="num">TDS</th><th className="num">Total Ded.</th><th className="num">Net Pay</th></tr>
                </thead>
                <tbody>
                  {preview.map(l => (
                    <tr key={l.empId}>
                      <td style={{fontFamily:'var(--mono)'}}>{l.empCode}</td>
                      <td><b>{l.name}</b></td>
                      <td className="num" style={{color:l.lopDays?'var(--warning)':'var(--ink-3)'}}>{l.paidDays}/{l.daysInMonth}</td>
                      <td className="num"><input type="number" min="0" max={l.daysInMonth} step="0.5" value={l.lopDays} disabled={!!existingRun}
                        onChange={e=>updateLine(l.empId,{lopDays:parseFloat(e.target.value)||0})}
                        style={{width:50,padding:'3px 4px',border:'1px solid var(--line-2)',borderRadius:4,fontSize:12,textAlign:'right'}} /></td>
                      <td className="num"><input type="number" min="0" step="100" value={l.bonus} disabled={!!existingRun}
                        onChange={e=>updateLine(l.empId,{bonus:parseFloat(e.target.value)||0})}
                        style={{width:74,padding:'3px 4px',border:'1px solid var(--line-2)',borderRadius:4,fontSize:12,textAlign:'right'}} /></td>
                      <td className="num">{fmt(l.basic)}</td>
                      <td className="num">{fmt(l.hra)}</td>
                      <td className="num">{fmt((l.da||0)+(l.sa||0)+(l.allowances||[]).filter(a=>!a.oneTime).reduce((s,a)=>s+(a.amount||0),0))}</td>
                      <td className="num bold">{fmt(l.gross)}</td>
                      <td className="num">{l.pfEe?fmt(l.pfEe):''}</td>
                      <td className="num">{l.esicEe?fmt(l.esicEe):''}</td>
                      <td className="num">{l.pt?fmt(l.pt):''}</td>
                      <td className="num">{l.tds?fmt(l.tds):''}</td>
                      <td className="num neg">{fmt(l.totalDed)}</td>
                      <td className="num bold pos">₹{fmt(l.net)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan="8" style={{textAlign:'right'}}>TOTAL</td>
                    <td className="num">₹{fmt(preview.reduce((s,l)=>s+l.gross,0))}</td>
                    <td className="num">{fmt(preview.reduce((s,l)=>s+l.pfEe,0))}</td>
                    <td className="num">{fmt(preview.reduce((s,l)=>s+l.esicEe,0))}</td>
                    <td className="num">{fmt(preview.reduce((s,l)=>s+l.pt,0))}</td>
                    <td className="num">{fmt(preview.reduce((s,l)=>s+l.tds,0))}</td>
                    <td className="num">{fmt(preview.reduce((s,l)=>s+l.totalDed,0))}</td>
                    <td className="num">₹{fmt(preview.reduce((s,l)=>s+l.net,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{marginTop:14}}>
            <div className="card-head"><h3 className="card-title">Employer Contributions (not deducted  employer burden)</h3></div>
            <div className="card-body">
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
                <div style={{padding:10, background:'var(--surface-2)', borderRadius:6, fontSize:12}}>
                  <b>Employer PF (12%):</b> ₹{fmt(preview.reduce((s,l)=>s+l.pfEr,0))}
                </div>
                <div style={{padding:10, background:'var(--surface-2)', borderRadius:6, fontSize:12}}>
                  <b>Employer ESIC (3.25%):</b> ₹{fmt(preview.reduce((s,l)=>s+l.esicEr,0))}
                </div>
                <div style={{padding:10, background:'var(--info-soft)', borderRadius:6, fontSize:12}}>
                  <b>Total CTC:</b> ₹{fmt(preview.reduce((s,l)=>s+l.gross+l.pfEr+l.esicEr,0))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================================
// HR MODULE  PAYSLIPS
// ============================================================================
function Payslips({data, setData, showToast}){
  const [month, setMonth] = useState(today().slice(0,7));
  const run = (data.payrollRuns||[]).find(r => r.month === month);

  const printPayslip = (emp) => {
    const co = data.company;
    // Always get fresh salary data from employee master for correct monthly values
    const master = (data.employees||[]).find(m => m.id === emp.empId) || {};
    const basic  = master.basic  || emp.basic  || 0;
    const hra    = master.hra    || emp.hra    || 0;
    const da     = master.da     || emp.da     || 0;
    const sa     = master.sa     || emp.sa     || 0;
    const allowances = master.allowances || emp.allowances || [];
    const gross  = basic + hra + da + sa + allowances.reduce((s,a) => s+(a.amount||0), 0);
    const pfBase = Math.min(master.pfBase||basic, 15000);
    const pfEe   = master.pfApplicable  ? Math.round(pfBase * 0.12) : 0;
    const esicEe = master.esicApplicable && gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const pt     = calcPTMonthly(master, month, co.fyStart);
    const tds    = master.tdsSalary || 0;
    const totalDed = pfEe + esicEe + pt + tds;
    const net    = gross - totalDed;

    // Use master info for personal details, fallback to run record
    const name       = master.name       || emp.name       || '';
    const empCode    = master.empCode    || emp.empCode    || '';
    const designation= master.designation|| emp.designation|| '';
    const department = master.department || emp.department || '';
    const pan        = master.pan        || emp.pan        || '';
    const uan        = master.uan        || emp.uan        || '';
    const bankAcc    = master.bankAcc    || emp.bankAcc    || '';

    const logoHtml = co.logo ? '<img src="'+co.logo+'" style="max-height:40px;max-width:140px;object-fit:contain" />' : '';

    // Format month display e.g. "2026-05" → "May 2026"
    const [yr, mo] = month.split('-');
    const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthDisplay = (monthNames[parseInt(mo)] || mo) + ' ' + yr;

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip - '+name+' - '+monthDisplay+'</title><style>' +
      '@page{size:A4;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}' +
      'body{font-family:"Segoe UI",Helvetica,Arial,sans-serif;font-size:11px;color:#0e2a23;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.slip{max-width:700px;margin:0 auto;border:2px solid #0b6b4f;border-radius:6px;overflow:hidden}' +
      '.hdr{background:#0e2a23;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}' +
      '.co{font-size:15px;font-weight:700;font-family:Georgia,serif}.sub{font-size:8px;color:#b5d4c8;margin-top:2px}' +
      '.title{text-align:center;padding:8px;background:#e6f3ee;font-weight:700;font-size:12px;color:#0b6b4f;text-transform:uppercase;letter-spacing:2px}' +
      '.info{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e3ebe7}' +
      '.cell{padding:6px 14px;border-right:1px solid #e3ebe7;font-size:10px}.cell:nth-child(even){border-right:none}' +
      '.lbl{color:#6b7f78;font-size:8px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:1px}.val{font-weight:600}' +
      '.cols{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e3ebe7}' +
      '.col-head{background:#f4f7f5;padding:6px 14px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#0b6b4f;border-bottom:1px solid #e3ebe7}' +
      '.row{display:flex;justify-content:space-between;padding:5px 14px;font-size:10px;border-bottom:1px solid #f4f4f4}' +
      '.row.sub{background:#f4f7f5;font-weight:700;border-top:1px solid #e3ebe7}' +
      '.net{background:#0b6b4f;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;font-size:14px;font-weight:700}' +
      '.foot{padding:8px 14px;font-size:8px;color:#6b7f78;text-align:center;border-top:1px solid #e3ebe7}' +
      '.right-col{border-left:1px solid #e3ebe7}' +
      '@media print{.no-print{display:none!important}}' +
      '</style></head><body>' +
      '<div class="slip">' +
      // Header
      '<div class="hdr">' +
        '<div style="display:flex;align-items:center;gap:12px">'+logoHtml+
          '<div><div class="co">'+(co.name||'Company Name')+'</div>' +
          '<div class="sub">'+(co.address||'')+'</div>' +
          '<div class="sub">GSTIN: '+(co.gstin||'')+' · PAN: '+(co.pan||'')+'</div></div>' +
        '</div>' +
        '<div style="text-align:right"><div style="font-size:11px;font-weight:600">Payslip</div><div style="font-size:9px;opacity:.7">'+monthDisplay+'</div></div>' +
      '</div>' +
      // Title
      '<div class="title">Salary Slip for the Month of '+monthDisplay+'</div>' +
      // Employee info grid
      '<div class="info">' +
        '<div class="cell"><div class="lbl">Employee Name</div><div class="val">'+name+'</div></div>' +
        '<div class="cell"><div class="lbl">Employee Code</div><div class="val">'+empCode+'</div></div>' +
        '<div class="cell"><div class="lbl">Designation</div><div class="val">'+(designation||'')+'</div></div>' +
        '<div class="cell"><div class="lbl">Department</div><div class="val">'+(department||'')+'</div></div>' +
        '<div class="cell"><div class="lbl">PAN</div><div class="val">'+(pan||'')+'</div></div>' +
        '<div class="cell"><div class="lbl">UAN (PF)</div><div class="val">'+(uan||'')+'</div></div>' +
        '<div class="cell"><div class="lbl">Bank A/c</div><div class="val">'+(bankAcc||'')+'</div></div>' +
        '<div class="cell"><div class="lbl">Working Days</div><div class="val">30 / 30</div></div>' +
      '</div>' +
      // Earnings & Deductions
      '<div class="cols">' +
        '<div>' +
          '<div class="col-head">Earnings</div>' +
          '<div class="row"><span>Basic Salary</span><span>₹'+fmt(basic)+'</span></div>' +
          '<div class="row"><span>HRA</span><span>₹'+fmt(hra)+'</span></div>' +
          (da > 0 ? '<div class="row"><span>Dearness Allowance</span><span>₹'+fmt(da)+'</span></div>' : '') +
          (sa > 0 ? '<div class="row"><span>Special Allowance</span><span>₹'+fmt(sa)+'</span></div>' : '') +
          allowances.filter(a => a.amount > 0).map(a => '<div class="row"><span>'+a.name+'</span><span>₹'+fmt(a.amount)+'</span></div>').join('') +
          '<div class="row sub"><span>Gross Salary</span><span>₹'+fmt(gross)+'</span></div>' +
        '</div>' +
        '<div class="right-col">' +
          '<div class="col-head">Deductions</div>' +
          (pfEe > 0   ? '<div class="row"><span>Provident Fund (EE 12%)</span><span>₹'+fmt(pfEe)+'</span></div>' : '') +
          (esicEe > 0 ? '<div class="row"><span>ESIC (EE 0.75%)</span><span>₹'+fmt(esicEe)+'</span></div>' : '') +
          (pt > 0     ? '<div class="row"><span>Professional Tax</span><span>₹'+fmt(pt)+'</span></div>' : '') +
          (tds > 0    ? '<div class="row"><span>TDS u/s 192</span><span>₹'+fmt(tds)+'</span></div>' : '') +
          '<div class="row sub"><span>Total Deductions</span><span>₹'+fmt(totalDed)+'</span></div>' +
          // Employer contributions (informational)
          '<div style="padding:6px 14px;font-size:9px;color:#6b7f78;border-top:1px dashed #e3ebe7;margin-top:4px"><b>Employer Contributions (not deducted)</b></div>' +
          '<div style="display:flex;justify-content:space-between;padding:3px 14px;font-size:9px;color:#6b7f78"><span>Employer PF (12%)</span><span>₹'+fmt(master.pfApplicable ? Math.round(pfBase*0.12) : 0)+'</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:3px 14px;font-size:9px;color:#6b7f78"><span>Employer ESIC (3.25%)</span><span>₹'+fmt(master.esicApplicable && gross<=21000 ? Math.round(gross*0.0325) : 0)+'</span></div>' +
        '</div>' +
      '</div>' +
      // Net Pay
      '<div class="net"><span>Net Take-Home Pay  '+monthDisplay+'</span><span>₹'+fmt(net)+'</span></div>' +
      // Footer
      '<div class="foot">This is a computer-generated payslip and does not require a physical signature. · MiyeeBooks MSME Accounting Suite · Built by Vipin Nair · MYeeCFO Series</div>' +
      '</div>' +
      // Print button
      '<div class="no-print" style="text-align:center;margin:20px 0">' +
        '<button onclick="window.print()" style="padding:10px 28px;background:#0b6b4f;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">⎙ Print / Save as PDF</button>' +
        '&nbsp;&nbsp;<button onclick="window.close()" style="padding:10px 20px;background:#eee;color:#333;border:1px solid #ccc;border-radius:6px;font-size:13px;cursor:pointer">Close</button>' +
      '</div>' +
      '</body></html>';

    const win = window.open('', '_blank', 'width=820,height=950');
    if(!win){ alert('Allow pop-ups to print payslips. Check your browser settings.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Payslips</h1>
          <div className="page-sub">Individual payslip generation · Print / Save as PDF</div>
        </div>
        <div className="page-actions">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="btn" style={{padding:'6px 10px'}} />
        </div>
      </div>

      {!run ? (
        <div className="empty" style={{padding:50}}>
          <div className="empty-ico">⊡</div>
          <div>No payroll processed for {month}. Run payroll first.</div>
        </div>
      ) : (
        <>
          <div style={{padding:10, background:'var(--primary-soft)', borderRadius:8, marginBottom:14, fontSize:12}}>
            <b>Payroll for {month}</b> · {run.employees?.length} employees · Gross: ₹{fmt(run.totalGross)} · Net: ₹{fmt(run.totalNet)} · Processed: {new Date(run.processedAt).toLocaleString('en-IN')}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Employee</th><th className="num">Gross</th><th className="num">PF</th><th className="num">ESIC</th><th className="num">PT</th><th className="num">TDS</th><th className="num">Net Pay</th><th></th></tr></thead>
              <tbody>
                {(run.employees||[]).map(e => (
                  <tr key={e.empId}>
                    <td style={{fontFamily:'var(--mono)'}}>{e.empCode}</td>
                    <td><b>{e.name}</b></td>
                    <td className="num">{fmt(e.gross)}</td>
                    <td className="num">{e.pfEe?fmt(e.pfEe):''}</td>
                    <td className="num">{e.esicEe?fmt(e.esicEe):''}</td>
                    <td className="num">{e.pt?fmt(e.pt):''}</td>
                    <td className="num">{e.tds?fmt(e.tds):''}</td>
                    <td className="num bold pos">₹{fmt(e.net)}</td>
                    <td className="actions"><button className="btn btn-sm btn-primary" onClick={() => printPayslip(e)}>⎙ Payslip</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================================
// TDS MODULE  TDS SECTIONS CONFIGURATION
// ============================================================================
function TDSSections({data, setData, showToast}){
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleSave = (sec) => {
    if(editing){
      setData({...data, tdsSections: (data.tdsSections||[]).map(s => s.id === editing.id ? {...sec, id:editing.id} : s)});
      showToast('TDS Section updated');
    } else {
      setData({...data, tdsSections: [...(data.tdsSections||[]), {...sec, id:uid()}]});
      showToast('TDS Section added');
    }
    setShowModal(false); setEditing(null);
  };

  const handleDelete = (sec) => {
    if(!confirm('Delete TDS section "'+sec.section+'  '+sec.name+'"?')) return;
    setData({...data, tdsSections: (data.tdsSections||[]).filter(s => s.id !== sec.id)});
    showToast('TDS Section deleted');
  };

  // Merge the latest ITA-2025 standard sections without removing user-added ones
  const loadStandard = () => {
    const existing = data.tdsSections || [];
    const key = s => (s.oldSection||'') + '|' + (s.name||'');
    const have = new Set(existing.map(key));
    const toAdd = SEED_TDS_SECTIONS.filter(s => !have.has(key(s))).map(s => ({...s, id: uid()}));
    if(toAdd.length === 0){ showToast('All standard ITA-2025 sections are already present'); return; }
    if(!confirm(`Add ${toAdd.length} standard TDS section(s) from the Income Tax Act 2025 master?\n\nExisting sections are kept unchanged.`)) return;
    setData({...data, tdsSections: [...existing, ...toAdd]});
    showToast(`✓ Added ${toAdd.length} ITA-2025 TDS section(s)`);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">TDS Sections</h1>
          <div className="page-sub">Income Tax Act 2025 (§392/393) · rates, thresholds & linked payable ledgers · {(data.tdsSections||[]).length} sections</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={loadStandard}>↻ Load ITA-2025 Standard</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Add TDS Section</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Section</th><th>Nature / Description</th><th className="num">Rate %</th><th className="num">Threshold (₹)</th><th className="num">Annual Limit (₹)</th><th>Linked Ledger</th><th></th></tr></thead>
          <tbody>
            {(data.tdsSections||[]).length === 0 ? (
              <tr><td colSpan="7"><div className="empty"><div className="empty-ico">§</div><div>No TDS sections configured. Add sections to enable TDS deduction in vouchers.</div></div></td></tr>
            ) : (data.tdsSections||[]).map(s => {
              const ledger = data.coa.find(a => a.id === s.ledgerId);
              return (
                <tr key={s.id}>
                  <td><b style={{fontFamily:'var(--mono)'}}>{s.section}</b>{s.oldSection && <span style={{fontSize:10, color:'var(--ink-3)', display:'block'}}>Old: {s.oldSection}</span>}</td>
                  <td>{s.name}<br/><span style={{fontSize:10, color:'var(--ink-3)'}}>{s.nature}</span></td>
                  <td className="num bold" style={{color:'var(--primary)'}}>{s.rate}%</td>
                  <td className="num">{s.threshold>0?'₹'+fmt(s.threshold):''}</td>
                  <td className="num">{s.annualThreshold>0?'₹'+fmt(s.annualThreshold):''}</td>
                  <td style={{fontSize:11}}>{ledger ? <span><span style={{fontFamily:'var(--mono)'}}>{ledger.id}</span> · {ledger.name}</span> : <span className="badge badge-danger">Not linked</span>}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(s); setShowModal(true); }}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (() => {
        const TDSSectionModal = () => {
          const [f, setF] = useState(editing || {
            section:'393(1)', oldSection:'194C', name:'', rate:2, threshold:30000, annualThreshold:0, ledgerId:'1313', nature:'', isSalary:false,
          });
          return (
            <div className="modal-overlay" onClick={() => {setShowModal(false);setEditing(null);}}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                  <h2 className="modal-title">{editing ? 'Edit TDS Section' : 'Add TDS Section'}</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => {setShowModal(false);setEditing(null);}}>✕</button>
                </div>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="field required"><label>New Section (IT Act 2025)</label><input value={f.section} onChange={e => setF({...f, section:e.target.value})} placeholder="e.g. 393(1)" /></div>
                    <div className="field"><label>Old Section (Reference)</label><input value={f.oldSection||''} onChange={e => setF({...f, oldSection:e.target.value})} placeholder="e.g. 194C" /></div>
                    <div className="field required"><label>Description</label><input value={f.name} onChange={e => setF({...f, name:e.target.value})} placeholder="Contractor (Individual/HUF)" /></div>
                    <div className="field"><label>Nature of Payment</label><input value={f.nature} onChange={e => setF({...f, nature:e.target.value})} placeholder="e.g. Contractor Payments" /></div>
                    <div className="field required"><label>Rate (%)</label><input type="number" step="0.01" value={f.rate} onChange={e => setF({...f, rate:parseFloat(e.target.value)||0})} /></div>
                    <div className="field"><label>Per-Transaction Threshold (₹)</label><input type="number" value={f.threshold} onChange={e => setF({...f, threshold:parseFloat(e.target.value)||0})} /></div>
                    <div className="field"><label>Annual Aggregate Threshold (₹)</label><input type="number" value={f.annualThreshold} onChange={e => setF({...f, annualThreshold:parseFloat(e.target.value)||0})} /></div>
                    <div className="field required"><label>Linked TDS Payable Ledger</label>
                      <select value={f.ledgerId} onChange={e => setF({...f, ledgerId:e.target.value})}>
                        <option value=""> Select </option>
                        {data.coa.filter(a => a.name.toLowerCase().includes('tds payable')).map(a => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                      </select>
                    </div>
                    <div className="field"><label style={{display:'flex',alignItems:'center',gap:6}}>
                      <input type="checkbox" checked={f.isSalary} onChange={e => setF({...f, isSalary:e.target.checked})} /> Salary TDS (u/s 192)
                    </label></div>
                  </div>
                </div>
                <div className="modal-foot">
                  <button className="btn" onClick={() => {setShowModal(false);setEditing(null);}}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => handleSave(f)} disabled={!f.section||!f.name}>Save</button>
                </div>
              </div>
            </div>
          );
        };
        return <TDSSectionModal />;
      })()}
    </>
  );
}

// ============================================================================
// TDS MODULE  TDS DEDUCTED REPORT
// ============================================================================
function TDSReport({data}){
  const [from, setFrom] = useState(data.company.fyStart);
  const [to, setTo] = useState(today());
  const [sectionFilter, setSectionFilter] = useState('All');

  const tdsVouchers = useMemo(() => {
    return (data.vouchers||[]).filter(v => (v.status==='Posted'||v.status==='Draft') && v.tdsApplicable && (v.tdsAmount||0) > 0 && v.date >= from && v.date <= to)
      .filter(v => sectionFilter === 'All' || (v.tdsSection||'').includes(sectionFilter))
      .sort((a,b) => a.date.localeCompare(b.date));
  }, [data.vouchers, from, to, sectionFilter]);

  // Also include payroll TDS
  const payrollTds = useMemo(() => {
    return (data.payrollRuns||[]).filter(r => r.month+'-01' >= from && r.month+'-28' <= to && r.totalTDS > 0)
      .map(r => ({
        date: r.month + '-28', number: 'Payroll/'+r.month, type: 'PAYROLL',
        partyName: r.employees?.length + ' employees',
        tdsSection: '192  Salary', tdsRate: 'Various', tdsAmount: r.totalTDS,
        amount: r.totalGross, tdsLedgerId: '1321',
      }));
  }, [data.payrollRuns, from, to]);

  const allTds = [...tdsVouchers, ...payrollTds].sort((a,b) => (a.date||'').localeCompare(b.date||''));

  const totalTds = allTds.reduce((s,v) => s + (v.tdsAmount||0), 0);

  // Section-wise summary
  const sectionSummary = {};
  allTds.forEach(v => {
    const sec = v.tdsSection || 'Unknown';
    if(!sectionSummary[sec]) sectionSummary[sec] = {count:0, base:0, tds:0};
    sectionSummary[sec].count++;
    sectionSummary[sec].base += v.amount || v.total || v.taxable || 0;
    sectionSummary[sec].tds += v.tdsAmount || 0;
  });

  // Unique sections for filter
  const sections = [...new Set((data.tdsSections||[]).map(s => s.section))];

  // ── Form 26Q: quarterly deductee-wise (non-salary TDS only) ──────────────
  const [q26, setQ26] = useState('Q1');
  const fy26 = parseInt((data.company.fyStart||'2025-04-01').slice(0,4));
  const q26Ranges = {
    Q1:[`${fy26}-04-01`,`${fy26}-06-30`],   Q2:[`${fy26}-07-01`,`${fy26}-09-30`],
    Q3:[`${fy26}-10-01`,`${fy26}-12-31`],   Q4:[`${fy26+1}-01-01`,`${fy26+1}-03-31`],
  };
  const deductees26 = useMemo(() => {
    const [qs,qe] = q26Ranges[q26];
    const map = {};
    (data.vouchers||[]).filter(v =>
      (v.status==='Posted'||v.status==='Draft') && v.tdsApplicable && (v.tdsAmount||0)>0 &&
      v.date>=qs && v.date<=qe && !(v.tdsSection||'').startsWith('192')
    ).forEach(v => {
      const party = data.parties.find(p => p.id === v.partyId);
      // PAN: explicit on party, else derive from GSTIN (chars 3–12)
      const pan = party?.pan || (party?.gstin ? party.gstin.slice(2,12) : '');
      const sec = (v.tdsSection||'').split('')[0].trim();
      const key = (v.partyName||'') + '|' + sec;
      if(!map[key]) map[key] = {party:v.partyName||'', pan, section:sec, count:0, base:0, tds:0};
      map[key].count++;
      map[key].base += v.tdsBaseAmount || v.amount || v.total || v.taxable || 0;
      map[key].tds  += v.tdsAmount || 0;
    });
    return Object.values(map).sort((a,b)=>a.party.localeCompare(b.party));
  }, [data.vouchers, data.parties, q26]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">TDS Deducted Report</h1>
          <div className="page-sub">All TDS deductions · Section-wise summary · {fmtDate(from)} to {fmtDate(to)}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.print()}>⎙ Print</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field"><label>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="field"><label>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="field"><label>Section</label>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
            <option>All</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">TDS Deductions</div><div className="stat-value">{allTds.length}</div></div>
        <div className="stat stat-gold"><div className="stat-label">Total TDS Deducted</div><div className="stat-value rupee">₹{fmt(totalTds)}</div></div>
        <div className="stat stat-info"><div className="stat-label">Sections Used</div><div className="stat-value">{Object.keys(sectionSummary).length}</div></div>
      </div>

      {/* Section-wise summary */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head"><h3 className="card-title">Section-Wise Summary</h3></div>
        <div style={{overflow:'auto'}}>
          <table>
            <thead><tr><th>TDS Section</th><th className="num">No. of Deductions</th><th className="num">Base Amount (₹)</th><th className="num">TDS Amount (₹)</th></tr></thead>
            <tbody>
              {Object.entries(sectionSummary).map(([sec, data]) => (
                <tr key={sec}>
                  <td><b>{sec}</b></td>
                  <td className="num">{data.count}</td>
                  <td className="num">{fmt(data.base)}</td>
                  <td className="num bold">₹{fmt(data.tds)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>TOTAL</td>
                <td className="num">{allTds.length}</td>
                <td className="num">₹{fmt(allTds.reduce((s,v)=>s+(v.amount||v.total||v.taxable||0),0))}</td>
                <td className="num">₹{fmt(totalTds)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Form 26Q  Quarterly deductee-wise summary */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <h3 className="card-title">Form 26Q  Quarterly Deductee Summary</h3>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select value={q26} onChange={e=>setQ26(e.target.value)} className="btn" style={{padding:'5px 10px',fontSize:12}}>
              <option value="Q1">Q1 (Apr–Jun)</option><option value="Q2">Q2 (Jul–Sep)</option>
              <option value="Q3">Q3 (Oct–Dec)</option><option value="Q4">Q4 (Jan–Mar)</option>
            </select>
            <button className="btn btn-sm" onClick={()=>{
              exportXLSX(`Form26Q_${q26}_FY${fy26}.xlsx`, [{name:`26Q ${q26}`, rows:[
                [`Form 26Q Working  ${data.company.name}  ${q26} FY ${fy26}-${String(fy26+1).slice(2)}`],
                [`Deductor TAN: ____________ · PAN: ${data.company.pan||''}`],[],
                ['Deductee','PAN','Section','No. of Payments','Amount Paid (₹)','TDS Deducted (₹)'],
                ...deductees26.map(d=>[d.party, d.pan, d.section, d.count, d.base, d.tds]),
                [],['','','TOTAL', deductees26.reduce((s,d)=>s+d.count,0),
                  deductees26.reduce((s,d)=>s+d.base,0), deductees26.reduce((s,d)=>s+d.tds,0)],
              ]}]);
            }}>⬇ Excel (26Q)</button>
            <button className="btn btn-sm" title="Pipe-delimited deductee schedule for the e-TDS return preparer / FVU" onClick={()=>{
              const T = deductees26;
              const head = [
                `# Form 26Q - Deductee Annexure (working file) | ${data.company.name}`,
                `# Quarter: ${q26} FY ${fy26}-${String(fy26+1).slice(2)} | Deductor PAN: ${data.company.pan||''} | TAN: ____________`,
                `# Fields (^ delimited): SrNo^DeducteePAN^DeducteeName^Section(OldRef)^TotalAmountPaid^TDSDeducted^NoOfTxns`,
                `# NOTE: This is a data file for your return-preparation / FVU software - it is NOT the certified .fvu output. Validate via NSDL RPU/FVU before filing.`,
              ].join('\n');
              const body = T.map((d,i)=>[i+1, d.pan||'PANNOTAVBL', (d.party||'').toUpperCase(), d.section, d.base, d.tds, d.count].join('^')).join('\n');
              const totals = `# TOTAL^^^^${T.reduce((s,d)=>s+d.base,0)}^${T.reduce((s,d)=>s+d.tds,0)}^${T.reduce((s,d)=>s+d.count,0)}`;
              const blob = new Blob([head+'\n'+body+'\n'+totals], {type:'text/plain'});
              const url=URL.createObjectURL(blob), a=document.createElement('a');
              a.href=url; a.download=`Form26Q_${q26}_FY${fy26}_annexure.txt`; a.click(); URL.revokeObjectURL(url);
            }}>⬇ 26Q Text (FVU prep)</button>
          </div>
        </div>
        <div style={{overflow:'auto'}}>
          <table>
            <thead><tr>
              <th>Deductee</th><th style={{width:120}}>PAN</th><th style={{width:110}}>Section</th>
              <th className="num" style={{width:90}}>Payments</th>
              <th className="num" style={{width:130}}>Amount Paid (₹)</th>
              <th className="num" style={{width:130}}>TDS Deducted (₹)</th>
            </tr></thead>
            <tbody>
              {deductees26.length===0 ? (
                <tr><td colSpan="6"><div className="empty" style={{padding:24}}>No non-salary TDS deductions in {q26}. (Salary TDS goes to Form 24Q.)</div></td></tr>
              ) : deductees26.map((d,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:600}}>{d.party}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:11,color:d.pan===''?'var(--danger)':'var(--ink)'}}>{d.pan}</td>
                  <td style={{fontFamily:'var(--mono)',fontSize:11}}>{d.section}</td>
                  <td className="num">{d.count}</td>
                  <td className="num">{fmt(d.base)}</td>
                  <td className="num bold">₹{fmt(d.tds)}</td>
                </tr>
              ))}
              {deductees26.length>0 && (
                <tr className="total"><td colSpan="3">TOTAL</td>
                  <td className="num">{deductees26.reduce((s,d)=>s+d.count,0)}</td>
                  <td className="num">₹{fmt(deductees26.reduce((s,d)=>s+d.base,0))}</td>
                  <td className="num">₹{fmt(deductees26.reduce((s,d)=>s+d.tds,0))}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{padding:'8px 16px',fontSize:11,color:'var(--ink-3)'}}>
          PAN auto-derived from GSTIN where the party PAN is blank. Red PAN = missing  collect before filing (20% TDS applies without PAN u/s 206AA).
        </div>
      </div>

      {/* Detail register */}
      <div className="card">
        <div className="card-head">
          <h3 className="card-title">TDS Deduction Register  Form 26Q / 24Q Detail</h3>
          <button className="btn btn-sm btn-ghost" onClick={() => {
            const headers = ['Date','Voucher No.','Type','Party / Deductee','PAN','New Section','Old Section','Nature of Payment','TDS Deducted On (₹)','Rate %','TDS Amount (₹)','Net Payable (₹)','TDS Payable Ledger','Challan / Ref'];
            const rows = allTds.map(v => {
              const party = data.parties.find(p => p.id === v.partyId);
              const ledger = data.coa.find(a => a.id === v.tdsLedgerId);
              const secObj = (data.tdsSections||[]).find(s => v.tdsSection && v.tdsSection.includes(s.section));
              const base = v.tdsBaseAmount || v.amount || v.total || v.taxable || 0;
              return [
                v.date, v.number, v.type,
                v.partyName||'', party?.pan||'',
                secObj?.section||v.tdsSection?.split('(')[0]?.trim()||'',
                secObj?.oldSection||'',
                v.tdsNature||secObj?.nature||'',
                fmt(base), (v.tdsRate||'')+(typeof v.tdsRate==='number'?'%':''),
                fmt(v.tdsAmount||0),
                fmt(Math.max(0,base-(v.tdsAmount||0))),
                ledger?.name||v.tdsLedgerId||'',
                v.reference||'',
              ].map(x => '"'+String(x).replace(/"/g,'""')+'"').join(',');
            });
            const csv = headers.join(',') + '\n' + rows.join('\n');
            const blob = new Blob([csv], {type:'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url;
            a.download = 'TDS_Register_'+from+'_to_'+to+'.csv'; a.click();
            URL.revokeObjectURL(url);
          }}>⬇ Export CSV</button>
        </div>
        <div style={{overflow:'auto'}}>
          <table>
            <thead>
              <tr>
                <th style={{minWidth:85}}>Date</th>
                <th style={{minWidth:90}}>Voucher No.</th>
                <th>Type</th>
                <th style={{minWidth:160}}>Party / Deductee</th>
                <th style={{minWidth:100}}>PAN</th>
                <th style={{minWidth:100}}>New Section</th>
                <th style={{minWidth:80}}>Old Sec.</th>
                <th style={{minWidth:140}}>Nature of Payment</th>
                <th className="num" style={{minWidth:110}}>TDS Deducted On (₹)</th>
                <th className="num" style={{minWidth:65}}>Rate %</th>
                <th className="num" style={{minWidth:110}}>TDS Amount (₹)</th>
                <th className="num" style={{minWidth:110}}>Net Payable (₹)</th>
                <th style={{minWidth:160}}>TDS Payable Ledger</th>
                <th>Ref / Challan</th>
              </tr>
            </thead>
            <tbody>
              {allTds.length === 0 ? (
                <tr><td colSpan="14"><div className="empty" style={{padding:30}}>No TDS deductions found in this period. Apply TDS when posting Purchase / Expense / JV vouchers.</div></td></tr>
              ) : allTds.map((v,i) => {
                const party  = data.parties.find(p => p.id === v.partyId);
                const ledger = data.coa.find(a => a.id === v.tdsLedgerId);
                const secObj = (data.tdsSections||[]).find(s => v.tdsSection && v.tdsSection.includes(s.section));
                const base   = v.tdsBaseAmount || v.amount || v.total || v.taxable || 0;
                const net    = Math.max(0, base - (v.tdsAmount||0));
                const newSec = secObj?.section || v.tdsSection?.split('(')[0]?.trim() || '';
                const oldSec = secObj?.oldSection || (v.tdsSection?.includes('Old:') ? v.tdsSection?.match(/Old:\s*([^)]+)/)?.[1]?.trim() : '') || '';
                const pan    = party?.pan || (v.type==='PAYROLL' ? 'Multiple' : '');
                const nature = v.tdsNature || secObj?.nature || '';
                return (
                  <tr key={i}>
                    <td>{fmtDate(v.date)}</td>
                    <td style={{fontFamily:'var(--mono)', fontWeight:600, fontSize:11}}>{v.number}</td>
                    <td><span className={'badge '+(v.type==='PAYROLL'?'badge-gold':'badge-info')}>{v.type}</span></td>
                    <td><b>{v.partyName||''}</b>{party?.gstin && <div style={{fontSize:9, color:'var(--ink-3)', fontFamily:'var(--mono)'}}>{party.gstin}</div>}</td>
                    <td style={{fontFamily:'var(--mono)', fontWeight:600, color: pan===''?'var(--danger)':'var(--ink)', fontSize:11}}>{pan}</td>
                    <td><b style={{fontFamily:'var(--mono)', color:'var(--primary)'}}>{newSec}</b></td>
                    <td style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--ink-3)'}}>{oldSec}</td>
                    <td style={{fontSize:11}}>{nature}</td>
                    <td className="num">{fmt(base)}</td>
                    <td className="num bold" style={{color:'var(--primary)'}}>{typeof v.tdsRate==='number' ? v.tdsRate+'%' : v.tdsRate||''}</td>
                    <td className="num bold" style={{color:'var(--danger)'}}><b>₹{fmt(v.tdsAmount||0)}</b></td>
                    <td className="num" style={{color:'var(--ink-2)'}}>{fmt(net)}</td>
                    <td style={{fontSize:11}}>{ledger ? <span><span style={{fontFamily:'var(--mono)', color:'var(--ink-3)'}}>{ledger.id}</span> {ledger.name}</span> : v.tdsLedgerId||''}</td>
                    <td style={{fontSize:11, color:'var(--ink-3)'}}>{v.reference||''}</td>
                  </tr>
                );
              })}
              {allTds.length > 0 && (
                <tr className="total">
                  <td colSpan="8" style={{textAlign:'right'}}>TOTAL ({allTds.length} entries)</td>
                  <td className="num">₹{fmt(allTds.reduce((s,v) => s+(v.tdsBaseAmount||v.amount||v.total||v.taxable||0),0))}</td>
                  <td></td>
                  <td className="num">₹{fmt(totalTds)}</td>
                  <td className="num">₹{fmt(allTds.reduce((s,v) => s+Math.max(0,(v.tdsBaseAmount||v.amount||v.total||v.taxable||0)-(v.tdsAmount||0)),0))}</td>
                  <td colSpan="2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{marginTop:14}}>
        <div className="card-head"><h3 className="card-title">TDS Compliance Notes</h3></div>
        <div className="card-body" style={{fontSize:12, color:'var(--ink-2)', lineHeight:1.7}}>
          <p><b>Deposit due dates:</b> TDS deducted must be deposited to Government by the 7th of the following month (except March  due 30th April).</p>
          <p><b>TDS Return filing:</b> Form 24Q (Salary) / 26Q (Non-salary) must be filed quarterly. Due dates: 31-Jul (Q1), 31-Oct (Q2), 31-Jan (Q3), 31-May (Q4).</p>
          <p><b>Form 16 / 16A:</b> Issue certificates to deductees within 15 days from TDS return filing due date.</p>
          <p><b>Lower deduction:</b> If a deductee has a lower TDS certificate u/s 197, update the rate in the TDS Section configuration.</p>
          <div className="chip-list" style={{marginTop:10}}>
            <span className="chip">Section 192</span><span className="chip">Section 194C</span><span className="chip">Section 194J</span><span className="chip">Section 194I</span><span className="chip">Section 194H</span><span className="chip">Section 194A</span><span className="chip">Section 194Q</span><span className="chip">Form 26Q</span><span className="chip">Form 24Q</span>
          </div>
        </div>
      </div>
    </>
  );
}
