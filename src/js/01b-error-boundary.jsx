// ============================================================================
// ERROR BOUNDARY  a crash must never cost a user their books.
// ----------------------------------------------------------------------------
// Without this, one malformed record (a voucher missing a line, a bad import)
// unmounts the whole React tree and leaves a white screen with no message and
// no way back except clearing storage - which destroys the local dataset. That
// reads to a user as "the software ate my books".
// This boundary catches the render error and offers the three things a person
// actually needs at that moment: download a full backup of the raw data BEFORE
// touching anything, reload, or (last resort, behind a typed confirmation)
// clear the local copy. The backup path reads storage directly rather than
// going through app state, so it still works when the app itself is broken.
// ============================================================================
class AppErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { error:null, info:null, saved:false };
  }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){
    this.setState({ info });
    try { console.error('MiyeeBooks crashed:', error, info && info.componentStack); } catch(_){}
    // Best-effort breadcrumb so the next session can show what happened.
    try { localStorage.setItem('miyee_last_crash', JSON.stringify({
      at: new Date().toISOString(), msg: String(error && error.message || error),
      stack: String((info && info.componentStack) || '').slice(0, 2000),
    })); } catch(_){}
  }

  // Read the raw persisted dataset without going through app state, so a
  // backup is still possible when the in-memory data is what crashed.
  downloadBackup = async () => {
    let raw = null;
    try { raw = await idbGet(STORAGE_KEY); } catch(_){}
    if(raw == null){ try { raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY); } catch(_){} }
    if(raw == null){ alert('No saved data was found in this browser to back up.'); return; }
    try {
      const blob = new Blob([raw], {type:'application/json'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = 'miyeebooks-recovery-' + new Date().toISOString().slice(0,10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      this.setState({ saved:true });
    } catch(e){ alert('Could not create the backup file: ' + (e.message||e)); }
  };

  clearLocal = async () => {
    if(!this.state.saved){
      if(!confirm('You have not downloaded a backup yet. Clearing local data cannot be undone.\n\nContinue anyway?')) return;
    }
    const typed = prompt('This deletes the copy of your books stored in this browser.\n\nType  ERASE  to confirm:');
    if((typed||'').trim().toUpperCase() !== 'ERASE') return;
    try { await idbDel(STORAGE_KEY); } catch(_){}
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); } catch(_){}
    location.reload();
  };

  render(){
    if(!this.state.error) return this.props.children;
    const msg = String(this.state.error && this.state.error.message || this.state.error || 'Unknown error');
    const wrap = {minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      padding:'24px',background:'#f4f7f5',fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif'};
    const card = {maxWidth:640,width:'100%',background:'#fff',border:'1px solid #dce5e0',borderRadius:10,
      padding:'28px 30px',boxShadow:'0 8px 30px -14px rgba(14,26,22,.35)'};
    const btn  = {padding:'9px 16px',borderRadius:7,border:'1px solid #dce5e0',background:'#fff',
      fontSize:14,cursor:'pointer',fontWeight:600,color:'#0e1a16'};
    const primary = {...btn, background:'#0b6b4f', color:'#fff', border:'1px solid #0b6b4f'};
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{fontSize:12,letterSpacing:'.14em',textTransform:'uppercase',fontWeight:700,color:'#8a5200'}}>Something broke</div>
          <h1 style={{fontSize:24,margin:'10px 0 8px',color:'#0e1a16'}}>Your data is still saved</h1>
          <p style={{fontSize:15,lineHeight:1.6,color:'#3c4b45',margin:'0 0 6px'}}>
            A screen failed to load, so the app stopped rendering to avoid writing anything incorrect.
            Nothing has been deleted. Download a backup first, then reload.
          </p>
          <pre style={{fontFamily:'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',fontSize:12,
            background:'#edf2ef',border:'1px solid #dce5e0',borderRadius:6,padding:'10px 12px',
            color:'#3c4b45',overflowX:'auto',whiteSpace:'pre-wrap',margin:'14px 0 18px'}}>{msg}</pre>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button style={primary} onClick={this.downloadBackup}>
              {this.state.saved ? '✓ Backup downloaded' : '⬇ Download backup'}
            </button>
            <button style={btn} onClick={()=>location.reload()}>↻ Reload app</button>
            <button style={{...btn,color:'#a3231b'}} onClick={this.clearLocal}>Clear local data…</button>
          </div>
          <p style={{fontSize:12.5,color:'#6b7a73',margin:'18px 0 0',lineHeight:1.55}}>
            If this keeps happening, send the message above along with the backup file - it identifies
            the record that caused it. Signed-in users still have their cloud copy.
          </p>
        </div>
      </div>
    );
  }
}
