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
  const scannedIds = useRef({});                // attachment id -> already auto-scanned

  const chosen = atts.find(a => a.id === pick) || atts[atts.length-1];

  const doScan = async (att) => {
    const target = att || chosen;
    if(!target){ return; }
    setPick(target.id);
    setBusy(true); setErr(''); setFx(null); setMeta(null); setStatus('Preparing…');
    try {
      const ex = await scanExtractText(target, setStatus);
      if(ex.scanned){
        setErr('This PDF has no readable text layer - it looks like a scan/photo saved as PDF. Attach a photo (JPG/PNG) of the bill instead so OCR can read it.');
        setStatus(''); setBusy(false); return;
      }
      const parsed = scanParseFields(ex.text);
      if(!parsed.amount && !parsed.date && !parsed.vendor){
        setErr('Could not read useful details from this file - please fill the fields manually.');
        setStatus(''); setBusy(false); return;
      }
      setFx(parsed); setMeta({engine:ex.engine, scanned:ex.scanned});
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

  const box = {background:'var(--surface-2)',border:'1px dashed var(--accent)',borderRadius:8,padding:'10px 12px',marginTop:8};
  return (
    <div style={box}>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <span style={{fontSize:12.5,fontWeight:600}}>🔎 Read receipt &amp; auto-fill</span>
        {atts.length > 1 && (
          <select value={chosen.id} onChange={e=>setPick(e.target.value)} style={{fontSize:12,maxWidth:220}}>
            {atts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <button className="btn btn-sm btn-primary" onClick={()=>doScan(chosen)} disabled={busy}>
          {busy ? 'Reading…' : 'Re-scan '+((/pdf/i.test(chosen.type||'')||/\.pdf$/i.test(chosen.name||'')) ? 'PDF (Python)' : 'image (OCR)')}
        </button>
        {busy && <span style={{fontSize:11.5,color:'var(--ink-3)'}}>{status}</span>}
      </div>

      {err && <div style={{fontSize:11.5,color:'var(--warning)',marginTop:8}}>⚠ {err}</div>}

      {fx && (
        <div style={{marginTop:10}}>
          <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:6}}>
            Detected via <b>{meta && meta.engine==='pypdf' ? 'Python / pypdf' : 'OCR'}</b> and applied - correct anything below and re-apply:
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
