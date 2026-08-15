// ============================================================================
// UPI PAY-BY-QR  let a customer pay an invoice by scanning, with no gateway.
// ----------------------------------------------------------------------------
// A standard UPI intent URL (upi://pay?...) is all that's needed: tapping it on
// a phone opens GPay / PhonePe / Paytm with the payee, amount and note prefilled,
// and encoding the same string as a QR lets the customer scan it from a printed
// or on-screen invoice. No payment gateway, no per-transaction fee, no backend -
// the money lands straight in the business's bank account.
//
// The QR renderer is loaded lazily from a CDN the first time it's shown (same
// pattern as the receipt scanner). Offline, or if the library can't load, we
// fall back to the tappable link plus the UPI ID in copyable text, which is
// still fully functional on a phone - the QR is a convenience, not the payment.
// ============================================================================

// Build the UPI intent URL. Returns '' when no UPI ID is configured.
const upiLink = (company, amount, note) => {
  const pa = (company && company.upiId || '').trim();
  if(!pa) return '';
  const pn = encodeURIComponent((company && company.name || 'Payment').slice(0, 50));
  const am = amount > 0 ? Math.round(amount * 100) / 100 : 0;
  const tn = encodeURIComponent(String(note || '').slice(0, 50));
  let url = 'upi://pay?pa=' + encodeURIComponent(pa) + '&pn=' + pn + '&cu=INR';
  if(am > 0) url += '&am=' + am;
  if(tn)     url += '&tn=' + tn;
  return url;
};

// Lazy-load a tiny QR renderer (window.QRCode). Memoised so it loads once.
let _qrPromise = null;
const upiLoadQR = () => {
  if(_qrPromise) return _qrPromise;
  _qrPromise = new Promise((resolve, reject) => {
    if(window.QRCode) return resolve(window.QRCode);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    s.onload  = () => window.QRCode ? resolve(window.QRCode) : reject(new Error('QR library did not initialise'));
    s.onerror = () => { _qrPromise = null; reject(new Error('offline')); };
    document.head.appendChild(s);
  });
  return _qrPromise;
};

// A self-contained pay panel: renders the QR when it can, always shows the
// tappable link + copyable UPI ID. Drop it into any invoice / reminder view.
function UpiPayPanel({company, amount, note, compact=false, showToast}){
  const holder = useRef(null);
  const [state, setState] = useState('loading');   // loading | ready | fallback
  const link = upiLink(company, amount, note);

  useEffect(() => {
    if(!link){ setState('none'); return; }
    let cancelled = false;
    upiLoadQR().then(QR => {
      if(cancelled || !holder.current) return;
      holder.current.innerHTML = '';
      new QR(holder.current, { text: link, width: compact?128:180, height: compact?128:180,
        colorDark:'#0e1a16', colorLight:'#ffffff', correctLevel: QR.CorrectLevel.M });
      setState('ready');
    }).catch(() => { if(!cancelled) setState('fallback'); });
    return () => { cancelled = true; };
  }, [link, compact]);

  if(!link) return (
    <div style={{fontSize:12.5,color:'var(--ink-3)'}}>
      Add a <b>UPI ID</b> in Company Settings → Bank Details to accept pay-by-QR.
    </div>
  );

  const copy = () => { try { navigator.clipboard.writeText(company.upiId); showToast && showToast('UPI ID copied'); } catch(_){} };

  return (
    <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
      <div style={{background:'#fff',padding:10,borderRadius:10,border:'1px solid var(--line)',minWidth:compact?148:200,minHeight:compact?148:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div ref={holder} />
        {state==='fallback' && <div style={{fontSize:11,color:'var(--ink-3)',textAlign:'center',padding:8}}>QR needs internet.<br/>Use the link →</div>}
        {state==='loading' && <div style={{fontSize:11,color:'var(--ink-3)'}}>Generating QR…</div>}
      </div>
      <div style={{minWidth:180}}>
        <div style={{fontSize:12,color:'var(--ink-3)'}}>Scan with any UPI app to pay</div>
        <div style={{fontFamily:'var(--mono)',fontSize:14,fontWeight:700,margin:'4px 0'}}>{company.upiId}</div>
        {amount>0 && <div className="rupee" style={{fontWeight:700,fontSize:18}}>₹{fmt(amount)}</div>}
        <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
          <a className="btn btn-sm btn-primary" href={link}>Open UPI app</a>
          <button className="btn btn-sm" onClick={copy}>Copy UPI ID</button>
        </div>
        <div style={{fontSize:11,color:'var(--ink-3)',marginTop:8}}>Pays straight to your bank — no gateway or fee.</div>
      </div>
    </div>
  );
}
