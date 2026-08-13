// ============================================================================
// RECEIPT SCANNER  read an attached invoice/receipt and auto-fill the claim.
// ----------------------------------------------------------------------------
// Everything runs in the browser - nothing is uploaded anywhere. The engines
// load lazily from a CDN the first time you scan (same way React / Firebase /
// SheetJS already load in index.html), then stay cached:
//   * PDF files  -> Pyodide (Python) + pypdf pull the embedded text layer.
//                   This is the "Python PDF scanner" - it reads proper,
//                   text-based PDFs precisely (GST tax invoices, e-bills).
//   * Images     -> tesseract.js OCR reads a photo / scan of a paper bill.
//   * A PDF with no text layer (a scanned image saved as PDF) is detected and
//     the user is told to attach a photo instead, so OCR can read it.
// The extracted text is parsed for amount, date, vendor, GSTIN and invoice no.
// OCR is never perfect, so the detected values are shown for the employee to
// review and edit before they are applied to the form.
// ============================================================================

const SCAN_CDN = {
  pyodideBase: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
  pyodide:     'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js',
  tesseract:   'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
};

// ── AI vision extraction (optional, highest accuracy) ───────────────────────
// When the user configures a Claude API key, the whole receipt (PDF or image)
// is sent to Anthropic's Messages API, which reads its text AND layout and
// returns structured fields - far more reliable than local OCR + regex on real
// GST invoices. The key is stored only in this browser's localStorage and the
// receipt goes only to api.anthropic.com. Falls back to the offline engines
// (pypdf / tesseract) when no key is set. The browser call needs internet.
const SCAN_AI_KEY = 'miyee_ai_scan_cfg';
const SCAN_AI_MODELS = [
  {id:'claude-opus-5',   label:'Claude Opus 5 (most accurate)'},
  {id:'claude-sonnet-5', label:'Claude Sonnet 5 (balanced)'},
  {id:'claude-haiku-4-5',label:'Claude Haiku 4.5 (fastest, cheapest)'},
];
const scanAiCfg = () => {
  try { const c = JSON.parse(localStorage.getItem(SCAN_AI_KEY) || 'null'); return (c && c.apiKey) ? c : null; }
  catch(_) { return null; }
};
const scanSetAiCfg = (cfg) => {
  try { if(cfg && cfg.apiKey) localStorage.setItem(SCAN_AI_KEY, JSON.stringify(cfg)); else localStorage.removeItem(SCAN_AI_KEY); }
  catch(_) {}
};

// Send one attachment to Claude and get back {vendor, amount, date, invoiceNo, gstin}.
async function scanAiExtract(att, cfg, onProgress){
  onProgress && onProgress('Reading with AI…');
  const isPdf = /pdf/i.test(att.type||'') || /\.pdf$/i.test(att.name||'');
  const dataUrl = String(att.dataUrl||'');
  const b64 = dataUrl.split(',')[1] || '';
  const mediaType = (dataUrl.match(/^data:([^;]+)/) || [])[1] || (isPdf ? 'application/pdf' : 'image/jpeg');
  const source = { type:'base64', media_type: mediaType, data: b64 };
  const fileBlock = isPdf ? { type:'document', source } : { type:'image', source };
  const prompt =
    'You are reading a single expense receipt or GST tax invoice. Reply with ONLY a JSON object, '
    + 'no prose and no markdown fences, in exactly this shape:\n'
    + '{"vendor": string, "amount": number, "date": "YYYY-MM-DD", "invoiceNo": string, "gstin": string}\n'
    + 'Rules: amount = the final grand total payable as a plain number (no currency symbol, no commas). '
    + 'date = the invoice/bill date in YYYY-MM-DD. gstin = the 15-character supplier GSTIN if printed, else "". '
    + 'invoiceNo = the bill/invoice number, else "". vendor = the merchant/supplier name. '
    + 'If a field is absent use "" (or 0 for amount). Do not guess values that are not on the document.';
  const body = {
    model: cfg.model || 'claude-opus-5',
    max_tokens: 2048,
    messages: [{ role:'user', content: [ fileBlock, { type:'text', text: prompt } ] }],
  };
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers: {
        'content-type':'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true',
      },
      body: JSON.stringify(body),
    });
  } catch(e){ throw new Error('Could not reach the AI service (check your internet connection).'); }
  if(!res.ok){
    let msg = 'AI request failed ('+res.status+')';
    if(res.status === 401) msg = 'AI key rejected - check your API key in scan settings.';
    else { try { const e = await res.json(); if(e && e.error && e.error.message) msg = e.error.message; } catch(_){} }
    throw new Error(msg);
  }
  const data = await res.json();
  if(data.stop_reason === 'refusal') throw new Error('The AI declined to read this file.');
  const text = (data.content||[]).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  let parsed;
  try { parsed = JSON.parse(m ? m[0] : text); } catch(e){ throw new Error('AI returned an unreadable response - try again.'); }
  const d = String(parsed.date||'');
  return {
    vendor:    parsed.vendor || '',
    amount:    (typeof parsed.amount === 'number' ? parsed.amount : parseFloat(String(parsed.amount).replace(/[,\s₹]/g,''))) || 0,
    date:      /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : scanParseDate(d),
    invoiceNo: parsed.invoiceNo || '',
    gstin:     String(parsed.gstin || '').toUpperCase(),
  };
}

// ── lazy engine loaders (memoised: the heavy download happens at most once) ──
let _pyodidePromise = null;
const scanLoadPyodide = () => {
  if(_pyodidePromise) return _pyodidePromise;
  _pyodidePromise = new Promise((resolve, reject) => {
    const start = async () => {
      try {
        const py = await window.loadPyodide({ indexURL: SCAN_CDN.pyodideBase });
        await py.loadPackage('micropip');
        const micropip = py.pyimport('micropip');
        await micropip.install('pypdf');
        resolve(py);
      } catch(e){ _pyodidePromise = null; reject(e); }
    };
    if(window.loadPyodide) return start();
    const s = document.createElement('script');
    s.src = SCAN_CDN.pyodide;
    s.onload = start;
    s.onerror = () => { _pyodidePromise = null; reject(new Error('Could not load the Python PDF engine (needs internet the first time you scan).')); };
    document.head.appendChild(s);
  });
  return _pyodidePromise;
};

let _tessPromise = null;
const scanLoadTesseract = () => {
  if(_tessPromise) return _tessPromise;
  _tessPromise = new Promise((resolve, reject) => {
    if(window.Tesseract) return resolve(window.Tesseract);
    const s = document.createElement('script');
    s.src = SCAN_CDN.tesseract;
    s.onload = () => window.Tesseract ? resolve(window.Tesseract) : (()=>{ _tessPromise=null; reject(new Error('OCR engine failed to initialise.')); })();
    s.onerror = () => { _tessPromise = null; reject(new Error('Could not load the OCR engine (needs internet the first time you scan).')); };
    document.head.appendChild(s);
  });
  return _tessPromise;
};

// base64 data URL -> Uint8Array (for handing raw PDF bytes to Python)
const scanDataUrlToBytes = (dataUrl) => {
  const b64 = String(dataUrl||'').split(',')[1] || '';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return arr;
};

// Pull raw text out of one attachment. Returns {text, engine, scanned}.
async function scanExtractText(att, onProgress){
  const isPdf = /pdf/i.test(att.type||'') || /\.pdf$/i.test(att.name||'');
  if(isPdf){
    onProgress && onProgress('Loading Python PDF engine…');
    const py = await scanLoadPyodide();
    onProgress && onProgress('Reading the PDF text…');
    // Write the raw bytes to Pyodide's virtual filesystem and let pypdf open the
    // path - avoids any JS->Python buffer-conversion quirks with the bytes.
    py.FS.writeFile('/scan_input.pdf', scanDataUrlToBytes(att.dataUrl));
    const text = py.runPython([
      'from pypdf import PdfReader',
      'try:',
      '    _r = PdfReader("/scan_input.pdf")',
      '    _out = "\\n".join((p.extract_text() or "") for p in _r.pages)',
      'except Exception as _e:',
      '    _out = ""',
      '_out',
    ].join('\n'));
    const clean = (text||'').trim();
    return { text: clean, engine:'pypdf', scanned: clean.length < 12 };
  }
  // image receipt -> OCR
  onProgress && onProgress('Loading OCR engine…');
  const T = await scanLoadTesseract();
  onProgress && onProgress('Reading the receipt (OCR)…');
  const res = await T.recognize(att.dataUrl, 'eng', {
    logger: m => { if(onProgress && m && m.status==='recognizing text') onProgress('OCR '+Math.round((m.progress||0)*100)+'%'); },
  });
  return { text: ((res.data && res.data.text) || '').trim(), engine:'tesseract', scanned:false };
}

// ── field parsing (pure, deterministic - shared by both engines) ────────────
const scanToNum = (s) => { const n = parseFloat(String(s).replace(/,/g,'')); return isFinite(n) ? n : 0; };

const SCAN_MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
const scanIso = (y,m,d) => {
  y = +y; m = +m; d = +d;
  if(y < 100) y += y < 70 ? 2000 : 1900;
  if(m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return '';
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
};
const scanParseDate = (text) => {
  const t = String(text||'');
  let m;
  // 12 Aug 2026  /  12-Aug-2026  /  12 August 26
  if((m = t.match(/\b(\d{1,2})[\s\-\/]*([A-Za-z]{3,9})[\s\-\/,]*(\d{2,4})\b/))){
    const mm = SCAN_MONTHS[m[2].toLowerCase().slice(0,4)] || SCAN_MONTHS[m[2].toLowerCase().slice(0,3)];
    if(mm){ const iso = scanIso(m[3], mm, m[1]); if(iso) return iso; }
  }
  // Aug 12, 2026
  if((m = t.match(/\b([A-Za-z]{3,9})[\s\-\/]*(\d{1,2})[\s,]*(\d{2,4})\b/))){
    const mm = SCAN_MONTHS[m[1].toLowerCase().slice(0,4)] || SCAN_MONTHS[m[1].toLowerCase().slice(0,3)];
    if(mm){ const iso = scanIso(m[3], mm, m[2]); if(iso) return iso; }
  }
  // 2026-08-12  /  2026/08/12
  if((m = t.match(/\b(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})\b/))){
    const iso = scanIso(m[1], m[2], m[3]); if(iso) return iso;
  }
  // 12/08/2026  /  12-08-26  (Indian day-first)
  if((m = t.match(/\b(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{2,4})\b/))){
    const iso = scanIso(m[3], m[2], m[1]); if(iso) return iso;
  }
  return '';
};

// 15-char GSTIN: 2 state digits, 5 letters, 4 digits, 1 letter, 1 alnum, 'Z', 1 alnum
const scanParseGstin = (t) => (String(t||'').toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/) || [])[0] || '';

const scanParseInvoiceNo = (t) => {
  // "invoice / bill / receipt no <x>" where <x> is a digit-bearing id. The value
  // itself must contain a digit, so a bare label word ("TAX INVOICE", "GSTIN")
  // can't be mistaken for the number, and left-to-right scanning skips the
  // heading and lands on the real "Invoice No: <id>" line.
  const re = /(?:tax\s*invoice|invoice|bill|receipt|voucher|inv)\.?\s*(?:no|number|num|#|id)?\.?\s*[:#\-]?\s*([A-Za-z]{0,5}[\-\/]?\d[A-Za-z0-9\/\-]{1,20})/gi;
  let m;
  while((m = re.exec(String(t||'')))){
    const v = m[1].replace(/[.,;]+$/,'');
    if(/\d/.test(v)) return v;
  }
  return '';
};

// Amount: prefer a number sitting on a "total / amount payable / net" line;
// take the largest such. Fall back to the biggest decimal figure in the doc.
const scanParseAmount = (text, lines) => {
  const prefer = /(grand\s*total|amount\s*payable|net\s*payable|net\s*amount|total\s*amount|total\s*due|balance\s*due|amount\s*due|invoice\s*total|\btotal\b|\bamount\b)/i;
  const avoid  = /(sub\s*total|taxable|cgst|sgst|igst|gst\b|tax\b|discount|qty|quantity)/i;
  let best = 0;
  (lines||[]).forEach(l => {
    if(prefer.test(l) && !avoid.test(l)){
      const nums = (l.match(/\d[\d,]*\.\d{2}|\d[\d,]*/g) || []).map(scanToNum).filter(n => n > 0);
      if(nums.length) best = Math.max(best, nums[nums.length-1]);
    }
  });
  if(best > 0) return best;
  const dec = (String(text||'').match(/\d[\d,]*\.\d{2}/g) || []).map(scanToNum);
  if(dec.length) return Math.max(...dec);
  const whole = (String(text||'').match(/\d[\d,]{2,}/g) || []).map(scanToNum);
  return whole.length ? Math.max(...whole) : 0;
};

// Vendor guess: the first substantial, mostly-alphabetic line near the top,
// skipping obvious labels (invoice / GSTIN / tax invoice / date headers).
const scanParseVendor = (lines) => {
  const skip = /(tax\s*invoice|invoice|receipt|\bbill\b|gstin|gst\s*no|original|duplicate|customer|date|mobile|phone|www\.|http|@)/i;
  for(const l of (lines||[]).slice(0, 8)){
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    if(l.length >= 3 && l.length <= 60 && letters >= Math.max(3, l.length*0.5) && !skip.test(l) && !/^\d/.test(l)){
      return l.replace(/[|_]+/g,' ').replace(/\s{2,}/g,' ').trim();
    }
  }
  return '';
};

const scanParseFields = (raw) => {
  const text  = String(raw||'').replace(/\r/g,'');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const flat  = lines.join(' ');
  return {
    amount:    scanParseAmount(text, lines),
    date:      scanParseDate(flat),
    vendor:    scanParseVendor(lines),
    gstin:     scanParseGstin(flat),
    invoiceNo: scanParseInvoiceNo(flat),
  };
};

// ── the in-modal scan panel ─────────────────────────────────────────────────
// Given the claim's attachments, lets the employee pick one, scan it, review
// the detected fields (editable) and apply them to the claim form.
function ScanReceiptPanel({attachments, onApply, showToast, autoScan=true}){
  const atts = attachments || [];
  const [pick, setPick]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr]       = useState('');
  const [fx, setFx]         = useState(null);   // editable detected fields
  const [meta, setMeta]     = useState(null);   // {engine, scanned}
  const [ai, setAi]         = useState(scanAiCfg());   // AI config or null
  const [showCfg, setShowCfg] = useState(false);
  const scannedIds = useRef({});                // attachment id -> already auto-scanned

  const chosen = atts.find(a => a.id === pick) || atts[atts.length-1];

  const doScan = async (att) => {
    const target = att || chosen;
    if(!target){ return; }
    setPick(target.id);
    setBusy(true); setErr(''); setFx(null); setMeta(null); setStatus('Preparing…');
    try {
      let parsed, engine;
      if(ai && ai.apiKey){
        // AI vision path: send the whole receipt to Claude and get fields back.
        parsed = await scanAiExtract(target, ai, setStatus);
        engine = 'ai';
      } else {
        const ex = await scanExtractText(target, setStatus);
        if(ex.scanned){
          setErr('This PDF has no readable text layer - it looks like a scan/photo saved as PDF. Either turn on AI extraction (⚙) or attach a photo (JPG/PNG) of the bill so OCR can read it.');
          setStatus(''); setBusy(false); return;
        }
        parsed = scanParseFields(ex.text);
        engine = ex.engine;
      }
      if(!parsed.amount && !parsed.date && !parsed.vendor){
        setErr('Could not read useful details from this file - please fill the fields manually.');
        setStatus(''); setBusy(false); return;
      }
      setFx(parsed); setMeta({engine});
      // Auto-apply straight away so the form fills on attach (only fills blanks);
      // the review box stays open so the values can be corrected.
      onApply(parsed);
      showToast && showToast('Filled from receipt - please review the values');
    } catch(e){
      setErr(e.message || 'Scan failed.');
    }
    setStatus(''); setBusy(false);
  };

  // Auto-scan the newest attachment as soon as it is added.
  useEffect(() => {
    if(!autoScan) return;
    const newest = atts[atts.length-1];
    if(newest && !scannedIds.current[newest.id] && !busy){
      scannedIds.current[newest.id] = true;
      doScan(newest);
    }
  }, [atts.length]);

  if(atts.length === 0) return null;

  const apply = () => {
    onApply(fx);
    showToast && showToast('Re-applied to the form');
  };

  const isPdf = /pdf/i.test(chosen.type||'') || /\.pdf$/i.test(chosen.name||'');
  const engLabel = (e) => e==='ai' ? 'AI vision' : e==='pypdf' ? 'Python / pypdf' : 'OCR';

  const box = {background:'var(--surface-2)',border:'1px dashed var(--accent)',borderRadius:8,padding:'10px 12px',marginTop:8};
  return (
    <div style={box}>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <span style={{fontSize:12.5,fontWeight:600}}>🔎 Read receipt &amp; auto-fill</span>
        <span style={{fontSize:10.5,fontWeight:700,padding:'1px 7px',borderRadius:20,
          background: ai ? 'var(--green-soft)' : 'var(--surface)', color: ai ? 'var(--green)' : 'var(--ink-3)',
          border:'1px solid '+(ai?'var(--green)':'var(--line)')}}>{ai ? 'AI' : 'Offline'}</span>
        {atts.length > 1 && (
          <select value={chosen.id} onChange={e=>setPick(e.target.value)} style={{fontSize:12,maxWidth:220}}>
            {atts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <button className="btn btn-sm btn-primary" onClick={()=>doScan(chosen)} disabled={busy}>
          {busy ? 'Reading…' : 'Re-scan '+(ai ? '(AI)' : isPdf ? 'PDF (Python)' : 'image (OCR)')}
        </button>
        <button className="btn btn-sm btn-ghost" title="AI extraction settings" onClick={()=>setShowCfg(v=>!v)} disabled={busy}>⚙</button>
        {busy && <span style={{fontSize:11.5,color:'var(--ink-3)'}}>{status}</span>}
      </div>

      {showCfg && <ScanAiSettings ai={ai} onSave={(c)=>{ scanSetAiCfg(c); setAi(c); setShowCfg(false); showToast && showToast(c?'AI extraction enabled':'AI extraction turned off'); }} onClose={()=>setShowCfg(false)} />}

      {err && <div style={{fontSize:11.5,color:'var(--warning)',marginTop:8}}>⚠ {err}</div>}

      {fx && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:6}}>
            Detected via <b>{engLabel(meta && meta.engine)}</b> and applied - correct anything below and re-apply:
          </div>
          <div className="form-grid">
            <div className="field"><label>Vendor</label>
              <input value={fx.vendor||''} onChange={e=>setFx({...fx, vendor:e.target.value})} placeholder="Merchant / supplier" /></div>
            <div className="field"><label>Amount (₹)</label>
              <input type="number" step="0.01" value={fx.amount||0} onChange={e=>setFx({...fx, amount:parseFloat(e.target.value)||0})} /></div>
            <div className="field"><label>Date</label>
              <input type="date" value={fx.date||''} onChange={e=>setFx({...fx, date:e.target.value})} /></div>
            <div className="field"><label>Invoice No.</label>
              <input value={fx.invoiceNo||''} onChange={e=>setFx({...fx, invoiceNo:e.target.value})} placeholder="Bill / invoice number" /></div>
            <div className="field" style={{gridColumn:'span 2'}}><label>GSTIN</label>
              <input value={fx.gstin||''} onChange={e=>setFx({...fx, gstin:e.target.value.toUpperCase()})} placeholder="Supplier GSTIN (if printed)" /></div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
            <button className="btn btn-sm btn-primary" onClick={apply}>Re-apply edited values</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>{ setFx(null); setMeta(null); }}>Dismiss</button>
            <span style={{fontSize:11,color:'var(--ink-3)',alignSelf:'center'}}>Amount &amp; date are filled; pick the expense ledger yourself.</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI extraction settings (API key + model, stored in this browser only) ────
function ScanAiSettings({ai, onSave, onClose}){
  const [key, setKey]     = useState(ai ? ai.apiKey : '');
  const [model, setModel] = useState((ai && ai.model) || 'claude-opus-5');
  return (
    <div style={{marginTop:8,padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--line)',borderRadius:8}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>AI extraction (Claude)</div>
      <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:8}}>
        Highest accuracy on real invoices - the receipt is sent to Anthropic and read by Claude. Your key is stored only in this browser (localStorage) and never synced. Needs internet. Get a key at console.anthropic.com.
      </div>
      <div className="form-grid">
        <div className="field" style={{gridColumn:'span 2'}}><label>Claude API key</label>
          <input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" /></div>
        <div className="field" style={{gridColumn:'span 2'}}><label>Model</label>
          <select value={model} onChange={e=>setModel(e.target.value)}>
            {SCAN_AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select></div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
        <button className="btn btn-sm btn-primary" disabled={!key.trim()} onClick={()=>onSave({apiKey:key.trim(), model})}>Save &amp; enable</button>
        {ai && <button className="btn btn-sm btn-ghost" style={{color:'var(--danger)'}} onClick={()=>onSave(null)}>Turn off AI</button>}
        <button className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
