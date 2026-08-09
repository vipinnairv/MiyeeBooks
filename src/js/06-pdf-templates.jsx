
// ============================================================================
// GST INVOICE PDF GENERATOR (Pure HTML → Browser Print/Save as PDF)
// ============================================================================
const numberToWords = (num) => {
  if(num === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  
  const convertGroup = (n) => {
    if(n === 0) return '';
    if(n < 20) return ones[n];
    if(n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
    return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and ' + convertGroup(n%100) : '');
  };
  
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  let n = intPart;
  let group0 = n % 1000; n = Math.floor(n/1000);
  let group1 = n % 100; n = Math.floor(n/100);
  let group2 = n % 100; n = Math.floor(n/100);
  let group3 = n;
  
  let result = '';
  if(group3) result += convertGroup(group3) + ' Crore ';
  if(group2) result += convertGroup(group2) + ' Lakh ';
  if(group1) result += convertGroup(group1) + ' Thousand ';
  if(group0) result += convertGroup(group0);
  result = result.trim() || 'Zero';
  if(decPart > 0) result += ' and ' + convertGroup(decPart) + ' Paise';
  return 'Indian Rupees ' + result + ' Only';
};

// Invoice templates - each is a LAYOUT (page structure) + colour pair.
// Layouts: classic (dark header band) · modern (full accent header) ·
// minimal (letterhead, thin rules) · elegant (centered, serif, double rules) ·
// boxed (framed page, accent side-band). Pick in Company Settings.
const INVOICE_TEMPLATES = {
  classic:   { name:'Classic Green',  accent:'#0b6b4f', accent2:'#c9a227', layout:'classic' },
  corporate: { name:'Corporate Blue', accent:'#1565c0', accent2:'#ff8f00', layout:'classic' },
  royal:     { name:'Royal Purple',   accent:'#6a1b9a', accent2:'#c9a227', layout:'classic' },
  slate:     { name:'Minimal Slate',  accent:'#37474f', accent2:'#90a4ae', layout:'classic' },
  crimson:   { name:'Crimson Red',    accent:'#b71c1c', accent2:'#37474f', layout:'classic' },
  modernBlue:{ name:'Modern Blue',    accent:'#2c7be5', accent2:'#ffd166', layout:'modern' },
  modernTeal:{ name:'Modern Teal',    accent:'#0aa2a2', accent2:'#f5803e', layout:'modern' },
  minimal:   { name:'Minimal Mono',   accent:'#1a2733', accent2:'#7b8b9a', layout:'minimal' },
  elegant:   { name:'Elegant Gold',   accent:'#8a6d1a', accent2:'#0e2a23', layout:'elegant' },
  boxed:     { name:'Boxed Navy',     accent:'#123c6e', accent2:'#c9a227', layout:'boxed' },
};

// Per-layout CSS overrides, appended AFTER the base stylesheet (same-specificity
// rules later in the sheet win). They use the classic token colours (#0b6b4f /
// #c9a227 / #0e2a23) so the accent recolouring pass applies to layouts too.
const INVOICE_LAYOUT_CSS = {
  classic: '',
  modern:
    '.header{background:#0b6b4f;border-radius:0;padding:20px 22px}' +
    '.doc-title{font-size:22px;letter-spacing:2px}' +
    '.copy-label{color:rgba(255,255,255,.75)}' +
    '.co-detail{color:rgba(255,255,255,.75)}' +
    '.meta-bar{background:#fff;border:none;border-left:5px solid #0b6b4f;box-shadow:0 1px 4px rgba(0,0,0,.08)}' +
    '.party-box{border:none;background:#f4f7f5;border-radius:8px}' +
    '.items-table th{background:#0b6b4f}' +
    '.totals-box{border:none;box-shadow:0 1px 5px rgba(0,0,0,.1);border-radius:8px}' +
    '.words-box{border:none;background:#f4f7f5;border-radius:8px}' +
    '.footer{border-top-width:4px}',
  minimal:
    'body{color:#222}' +
    '.header{background:#fff;color:#0e2a23;border-radius:0;border-bottom:2px solid #0e2a23;padding:14px 0}' +
    '.co-detail{color:#666}' +
    '.copy-label{color:#0b6b4f}' +
    '.doc-title{color:#0e2a23;font-weight:600;letter-spacing:3px}' +
    '.meta-bar{background:#fff;border:none;border-bottom:1px solid #ddd;padding:10px 0}' +
    '.parties{gap:24px}' +
    '.party-box{border:none;border-left:2px solid #0e2a23;border-radius:0;padding:6px 14px}' +
    '.items-table th{background:#fff;color:#0e2a23;border-top:1.5px solid #0e2a23;border-bottom:1.5px solid #0e2a23}' +
    '.items-table td{border-bottom:1px solid #eee}' +
    '.items-table tr{background:#fff !important}' +
    '.totals-box{border:none}' +
    '.totals-box .grand{background:#fff;color:#0e2a23;border-top:2px solid #0e2a23;border-bottom:2px solid #0e2a23}' +
    '.words-box{background:#fff;border:none;border-bottom:1px solid #ddd;padding:8px 0}' +
    '.hsn-table th{background:#fff;border-bottom:1px solid #0e2a23}' +
    '.bank-box,.sig-box{border-color:#ddd}' +
    '.footer{border-top:1px solid #0e2a23}',
  elegant:
    'body{font-family:Georgia,\'Times New Roman\',serif}' +
    '.header{display:block;text-align:center;background:#fff;color:#0e2a23;border-radius:0;border-top:4px double #0b6b4f;border-bottom:4px double #0b6b4f;padding:16px}' +
    '.header-left{display:block}' +
    '.header-left img{margin:0 auto 6px}' +
    '.co-name{font-size:21px}' +
    '.co-detail{color:#666}' +
    '.header-right{text-align:center;margin-top:8px}' +
    '.doc-title{color:#0b6b4f;letter-spacing:4px}' +
    '.copy-label{color:#999}' +
    '.meta-bar{background:#fff;border:none;border-bottom:1px solid #0b6b4f;text-align:center}' +
    '.party-box{border:1px solid #0b6b4f;border-radius:0}' +
    '.items-table th{background:#fff;color:#0b6b4f;border-top:2px solid #0b6b4f;border-bottom:2px solid #0b6b4f;font-family:Georgia,serif}' +
    '.totals-box{border:1px solid #0b6b4f;border-radius:0}' +
    '.totals-box .grand{background:#0b6b4f}' +
    '.words-box{background:#fff;border:1px dashed #0b6b4f;border-radius:0}' +
    '.sig-box{border:1px solid #0b6b4f;border-radius:0}' +
    '.footer{border-top:4px double #0b6b4f}',
  boxed:
    '.pagewrap{border:1.5px solid #0e2a23;padding:14px;border-radius:2px}' +
    '.header{background:#fff;color:#0e2a23;border-radius:0;border-left:10px solid #0b6b4f;border-bottom:1.5px solid #0e2a23;padding:12px 16px}' +
    '.co-detail{color:#555}' +
    '.doc-title{color:#0b6b4f}' +
    '.copy-label{color:#888}' +
    '.meta-bar{background:#fff;border:1px solid #0e2a23}' +
    '.party-box{border:1px solid #0e2a23;border-radius:0}' +
    '.items-table th{background:#0e2a23}' +
    '.items-table td{border-bottom:1px solid #ccc}' +
    '.totals-box{border:1px solid #0e2a23;border-radius:0}' +
    '.words-box{border:1px solid #0e2a23;border-radius:0;background:#fff}' +
    '.hsn-table th{background:#fff;border:1px solid #0e2a23}' +
    '.bank-box,.sig-box{border:1px solid #0e2a23;border-radius:0}' +
    '.footer{border-top:1.5px solid #0e2a23}',
};
function generateInvoicePDF(voucher, appData){
  const co = appData.company;
  const tpl = INVOICE_TEMPLATES[co.invoiceTemplate] || INVOICE_TEMPLATES.classic;
  const party = appData.parties.find(p => p.id === voucher.partyId) || {};
  const isCredit = voucher.type === 'CRN';
  const isDebit = voucher.type === 'DBN';
  const isPurchase = voucher.type === 'PUR';
  const isSales = voucher.type === 'SAL';
  const isInterState = voucher.isInterState;
  const isExport = voucher.isExport;

  const docTitle = isCredit ? 'Credit Note' : isDebit ? 'Debit Note' : isPurchase ? 'Purchase Invoice' : 'Tax Invoice';
  const copyLabel = isSales || isCredit ? 'Original for Recipient' : "Buyer's Copy";
  const items = voucher.items || [];
  const taxableTotal = voucher.taxable || items.reduce((s,it) => s + (it.qty||0)*(it.rate||0), 0);
  const invoiceTotal = voucher.total || voucher.amount || 0;
  const words = numberToWords(Math.abs(invoiceTotal));

  // Due date = invoice date + the customer's credit period (sales docs only)
  let dueDate = '';
  if(isSales && voucher.date){
    const cd = party.creditDays != null ? party.creditDays : 30;
    const d = new Date(voucher.date); d.setDate(d.getDate() + cd);
    dueDate = d.toISOString().slice(0,10);
  }

  // Share (WhatsApp / Email) - message baked at generation time
  const shareMsg = encodeURIComponent(docTitle + ' ' + (voucher.number||'') + ' from ' + (co.name||'') +
    ' - Amount ₹' + fmt(invoiceTotal) + ', dated ' + fmtDate(voucher.date) + '. Please find the GST invoice attached.');
  const waUrl   = party.phone ? 'https://wa.me/' + (party.phone||'').replace(/[^0-9]/g,'') + '?text=' + shareMsg : '';
  const mailUrl = party.email ? 'mailto:' + party.email + '?subject=' + encodeURIComponent(docTitle + ' ' + (voucher.number||'') + ' - ' + (co.name||'')) + '&body=' + shareMsg : '';

  // HSN summary
  const hsnMap = {};
  items.forEach(it => {
    const h = it.hsn || 'NA';
    if(!hsnMap[h]) hsnMap[h] = {hsn:h, taxable:0, cgst:0, sgst:0, igst:0};
    const t = (it.qty||0)*(it.rate||0);
    const tax = t * (it.gstRate||0)/100;
    hsnMap[h].taxable += t;
    if(isInterState||isExport) hsnMap[h].igst += isExport?0:tax;
    else { hsnMap[h].cgst += tax/2; hsnMap[h].sgst += tax/2; }
  });

  // Build line item rows
  let itemRowsHtml = '';
  items.forEach((it, idx) => {
    const taxable = (it.qty||0) * (it.rate||0);
    const tax = taxable * (it.gstRate||0) / 100;
    const lineTotal = taxable + tax;
    const bg = idx % 2 === 0 ? '#f4f7f5' : '#fff';
    if(isInterState || isExport){
      itemRowsHtml += '<tr style="background:'+bg+'"><td class="c">'+String(idx+1)+'</td><td>'+((it.description||'').substring(0,50))+'</td><td class="c">'+(it.hsn||'')+'</td><td class="r">'+String(it.qty||0)+'</td><td class="r">'+fmt(it.rate||0)+'</td><td class="r">'+fmt(taxable)+'</td><td class="r">'+(it.gstRate||0)+'%</td><td class="r">'+fmt(isExport?0:tax)+'</td><td class="r b">'+fmt(lineTotal)+'</td></tr>';
    } else {
      itemRowsHtml += '<tr style="background:'+bg+'"><td class="c">'+String(idx+1)+'</td><td>'+((it.description||'').substring(0,45))+'</td><td class="c">'+(it.hsn||'')+'</td><td class="r">'+String(it.qty||0)+'</td><td class="r">'+fmt(it.rate||0)+'</td><td class="r">'+fmt(taxable)+'</td><td class="r">'+((it.gstRate||0)/2)+'%</td><td class="r">'+fmt(tax/2)+'</td><td class="r">'+((it.gstRate||0)/2)+'%</td><td class="r">'+fmt(tax/2)+'</td><td class="r b">'+fmt(lineTotal)+'</td></tr>';
    }
  });
  if(items.length === 0){
    const cs = isInterState||isExport ? 9 : 11;
    itemRowsHtml = '<tr><td colspan="'+cs+'" style="text-align:center;color:#6b7f78;padding:20px;">(No line items  Journal/Payment type voucher)</td></tr>';
  }

  // Item table header
  const itemHeader = (isInterState||isExport)
    ? '<th class="c" style="width:5%">#</th><th>Description</th><th class="c">HSN/SAC</th><th class="r">Qty</th><th class="r">Rate (₹)</th><th class="r">Taxable (₹)</th><th class="r">IGST %</th><th class="r">IGST (₹)</th><th class="r">Total (₹)</th>'
    : '<th class="c" style="width:4%">#</th><th>Description</th><th class="c">HSN/SAC</th><th class="r">Qty</th><th class="r">Rate (₹)</th><th class="r">Taxable (₹)</th><th class="r">CGST %</th><th class="r">CGST (₹)</th><th class="r">SGST %</th><th class="r">SGST (₹)</th><th class="r">Total (₹)</th>';

  // Tax rows for total box
  let taxRowsHtml = '';
  if(isExport){
    taxRowsHtml = '<tr><td>GST (Zero-Rated Export)</td><td class="r">₹0.00</td></tr>';
  } else if(isInterState){
    taxRowsHtml = '<tr><td>Integrated GST (IGST)</td><td class="r">₹'+fmt(voucher.igst||0)+'</td></tr>';
  } else {
    taxRowsHtml = '<tr><td>Central GST (CGST)</td><td class="r">₹'+fmt(voucher.cgst||0)+'</td></tr><tr><td>State GST (SGST/UTGST)</td><td class="r">₹'+fmt(voucher.sgst||0)+'</td></tr>';
  }

  // Forex row
  let forexHtml = '';
  if(voucher.currency && voucher.currency !== 'INR'){
    forexHtml = '<tr><td>Foreign Currency ('+voucher.currency+')</td><td class="r">'+voucher.currency+' '+fmt((voucher.total||0)/(voucher.fxRate||1))+'</td></tr><tr><td>Exchange Rate</td><td class="r">1 '+voucher.currency+' = ₹'+fmt(voucher.fxRate||1,4)+'</td></tr>';
  }

  // HSN summary rows
  let hsnHtml = '';
  Object.values(hsnMap).forEach(h => {
    if(isInterState||isExport){
      hsnHtml += '<tr><td>'+h.hsn+'</td><td class="r">₹'+fmt(h.taxable)+'</td><td class="r">₹'+fmt(h.igst)+'</td><td class="r">₹'+fmt(h.igst)+'</td></tr>';
    } else {
      hsnHtml += '<tr><td>'+h.hsn+'</td><td class="r">₹'+fmt(h.taxable)+'</td><td class="r">₹'+fmt(h.cgst)+'</td><td class="r">₹'+fmt(h.sgst)+'</td><td class="r">₹'+fmt(h.cgst+h.sgst)+'</td></tr>';
    }
  });
  const hsnHeader = (isInterState||isExport)
    ? '<th>HSN/SAC</th><th class="r">Taxable</th><th class="r">IGST</th><th class="r">Total Tax</th>'
    : '<th>HSN/SAC</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Total Tax</th>';

  const logoHtml = co.logo ? '<img src="'+co.logo+'" style="max-height:52px;max-width:160px;object-fit:contain;" />' : '';

  // UPI Pay-Now block (sales invoices only, when a UPI ID is configured).
  // The QR encodes the standard upi://pay deep link with the exact invoice
  // amount - scannable by GPay/PhonePe/Paytm/BHIM. Rendered by the qrcodejs
  // CDN inside the print window; if offline, the UPI ID still prints as text.
  // Only render the QR for a plausibly valid VPA - apps reject unregistered /
  // malformed payee IDs with a "not registered" error, so bad input = no QR.
  const upiOk = !!(co.upiId && /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(co.upiId) && isSales && invoiceTotal > 0);
  const upiLink = upiOk ? 'upi://pay?pa=' + encodeURIComponent(co.upiId) +
    '&pn=' + encodeURIComponent((co.name||'').slice(0,40)) +
    '&am=' + Math.abs(invoiceTotal).toFixed(2) + '&cu=INR' +
    '&tn=' + encodeURIComponent(('Inv '+(voucher.number||'')).slice(0,40)) : '';
  const upiHtml = upiOk ?
    '<div class="upi-box">' +
      '<div class="qr" id="upiqr"></div>' +
      '<div><div class="utitle">📱 SCAN &amp; PAY - ₹'+fmt(invoiceTotal)+'</div>' +
      '<div class="udetail">Scan with any UPI app (GPay / PhonePe / Paytm / BHIM).<br/>' +
      'The invoice number and exact amount are pre-filled.<br/>' +
      'UPI ID: <span class="uvpa">'+co.upiId+'</span></div></div>' +
    '</div>' : '';
  const upiScript = upiOk ?
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>' +
    '<script>try{ if(typeof QRCode!=="undefined"){ new QRCode(document.getElementById("upiqr"), {text:'+JSON.stringify(upiLink)+', width:86, height:86, correctLevel:QRCode.CorrectLevel.M}); } else { document.getElementById("upiqr").innerHTML="<div style=\\"font-size:8px;color:#999;padding-top:30px;text-align:center\\">QR needs internet<br/>Use UPI ID →</div>"; } }catch(e){}<\/script>' : '';

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+docTitle+' '+( voucher.number||'')+'</title><style>' +
    '@page{size:A4;margin:10mm 12mm}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:"Segoe UI",Helvetica,Arial,sans-serif;font-size:11px;color:#0e2a23;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.header{background:#0e2a23;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-radius:4px 4px 0 0}' +
    '.header-left{display:flex;align-items:center;gap:14px}' +
    '.header-left img{border-radius:4px}' +
    '.co-name{font-size:17px;font-weight:700;font-family:Georgia,serif;letter-spacing:-.3px}' +
    '.co-detail{font-size:8.5px;color:#b5d4c8;margin-top:3px;letter-spacing:.3px}' +
    '.header-right{text-align:right}' +
    '.doc-title{font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase}' +
    '.copy-label{font-size:8px;color:#c9a227;margin-top:3px;letter-spacing:1px;text-transform:uppercase}' +
    '.meta-bar{background:#f4f7f5;border:1px solid #e3ebe7;padding:10px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}' +
    '.irn-bar{background:#fffdf2;border:1px dashed #c9a227;padding:6px 18px;font-size:8.5px;color:#5a4a12;margin-top:6px;border-radius:4px;word-break:break-all}' +
    '.meta-item .label{font-size:7.5px;text-transform:uppercase;letter-spacing:1px;color:#6b7f78;font-weight:600}' +
    '.meta-item .value{font-size:11px;font-weight:700;color:#0e2a23;margin-top:2px}' +
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}' +
    '.party-box{border:1px solid #e3ebe7;border-radius:4px;padding:10px 14px}' +
    '.party-box .ptitle{font-size:7.5px;text-transform:uppercase;letter-spacing:1.2px;color:#0b6b4f;font-weight:700;margin-bottom:6px}' +
    '.party-box .pname{font-size:12px;font-weight:700;color:#0e2a23;margin-bottom:4px}' +
    '.party-box .pdetail{font-size:9px;color:#6b7f78;line-height:1.5}' +
    '.party-box .pgstin{font-size:9.5px;font-weight:700;color:#0e2a23;margin-top:3px}' +
    'table{width:100%;border-collapse:collapse}' +
    '.items-table{margin-top:4px}' +
    '.items-table th{background:#0b6b4f;color:#fff;padding:6px 8px;font-size:8px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}' +
    '.items-table td{padding:5px 8px;border-bottom:1px solid #e3ebe7;font-size:9.5px}' +
    '.r{text-align:right}.c{text-align:center}.b{font-weight:700}' +
    '.totals{margin-top:8px;display:flex;justify-content:flex-end}' +
    '.totals-box{width:48%;border:1px solid #e3ebe7;border-radius:4px;overflow:hidden}' +
    '.totals-box td{padding:5px 12px;font-size:10px;border-bottom:1px solid #f0f0f0}' +
    '.totals-box .grand{background:#0b6b4f;color:#fff;font-weight:700;font-size:12px}' +
    '.totals-box .grand td{border:none;padding:8px 12px}' +
    '.words-box{background:#f4f7f5;border:1px solid #e3ebe7;border-radius:4px;padding:8px 14px;margin-top:8px}' +
    '.words-box .wlabel{font-size:7.5px;text-transform:uppercase;letter-spacing:1px;color:#0b6b4f;font-weight:700}' +
    '.words-box .wtext{font-size:10px;color:#0e2a23;margin-top:2px;font-style:italic}' +
    '.hsn-section{margin-top:10px}' +
    '.hsn-section .stitle{font-size:8px;text-transform:uppercase;letter-spacing:1.2px;color:#0b6b4f;font-weight:700;margin-bottom:4px}' +
    '.hsn-table th{background:#e6f3ee;color:#0e2a23;padding:4px 8px;font-size:7.5px;text-transform:uppercase;letter-spacing:.5px}' +
    '.hsn-table td{padding:4px 8px;font-size:9px;border-bottom:1px solid #e3ebe7}' +
    '.bottom{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-top:12px;page-break-inside:avoid}' +
    '.bank-box{border:1px solid #e3ebe7;border-radius:4px;padding:10px 14px}' +
    '.bank-box .btitle{font-size:7.5px;text-transform:uppercase;letter-spacing:1.2px;color:#0b6b4f;font-weight:700;margin-bottom:4px}' +
    '.bank-box .bdetail{font-size:9px;color:#3a4f49;line-height:1.5}' +
    '.upi-box{border:1.5px solid #0b6b4f;border-radius:4px;padding:10px 14px;margin-bottom:8px;display:flex;gap:14px;align-items:center;background:#fbfdfc}' +
    '.upi-box .qr{width:86px;height:86px;flex-shrink:0}' +
    '.upi-box .qr img,.upi-box .qr canvas{width:86px !important;height:86px !important}' +
    '.upi-box .utitle{font-size:10px;font-weight:700;color:#0b6b4f;letter-spacing:.5px}' +
    '.upi-box .udetail{font-size:8.5px;color:#3a4f49;line-height:1.6;margin-top:3px}' +
    '.upi-box .uvpa{font-family:monospace;font-weight:700;font-size:9.5px;color:#0e2a23}' +
    '.terms{margin-top:8px;font-size:7.5px;color:#6b7f78;line-height:1.6}' +
    '.terms .ttitle{font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}' +
    '.sig-box{border:1px solid #e3ebe7;border-radius:4px;padding:12px 14px;text-align:center;min-height:90px;display:flex;flex-direction:column;justify-content:space-between}' +
    '.sig-box .sfor{font-size:10px;font-weight:700;color:#0e2a23;text-align:left}' +
    '.sig-box .sline{border-top:1px solid #6b7f78;margin:0 20px;padding-top:4px;font-size:8px;color:#6b7f78;letter-spacing:.5px}' +
    '.footer{margin-top:10px;padding-top:8px;border-top:2px solid #0b6b4f;text-align:center;font-size:7.5px;color:#6b7f78;line-height:1.6}' +
    '.footer b{color:#3a4f49}' +
    '@media print{.no-print{display:none !important}}' +
    (INVOICE_LAYOUT_CSS[tpl.layout] || '') +
  '</style></head><body>' +
    '<div class="pagewrap" style="max-width:210mm;margin:0 auto;">' +

    // HEADER
    '<div class="header">' +
      '<div class="header-left">' +
        logoHtml +
        '<div><div class="co-name">'+(co.name||'Company Name')+'</div>' +
        '<div class="co-detail">'+ [co.address, co.state].filter(Boolean).join(' | ') +'</div>' +
        '<div class="co-detail">'+ ['GSTIN: '+(co.gstin||''), 'PAN: '+(co.pan||''), co.cin?'CIN: '+co.cin:'', co.email||'', co.phone||''].filter(Boolean).join('  ·  ') +'</div></div>' +
      '</div>' +
      '<div class="header-right">' +
        '<div class="doc-title">'+docTitle+'</div>' +
        '<div class="copy-label">'+copyLabel+'</div>' +
        (isCredit||isDebit ? '<div style="font-size:8px;color:#ffb4b4;margin-top:2px">'+(isCredit?'(Against original invoice)':'(Supplementary invoice)')+'</div>' : '') +
      '</div>' +
    '</div>' +

    // META BAR
    '<div class="meta-bar">' +
      '<div class="meta-item"><div class="label">Invoice Number</div><div class="value">'+(voucher.number||'DRAFT')+'</div></div>' +
      '<div class="meta-item"><div class="label">Invoice Date</div><div class="value">'+fmtDate(voucher.date||'')+'</div></div>' +
      (dueDate ? '<div class="meta-item"><div class="label">Due Date</div><div class="value">'+fmtDate(dueDate)+'</div></div>' : '') +
      '<div class="meta-item"><div class="label">Place of Supply</div><div class="value">'+(voucher.placeOfSupply||'')+( party.state?' - '+party.state:'')+'</div></div>' +
      (voucher.reference ? '<div class="meta-item"><div class="label">Reference</div><div class="value">'+voucher.reference+'</div></div>' : '') +
    '</div>' +

    // e-INVOICE IRN (when the invoice has been registered on the IRP)
    (voucher.irn ? '<div class="irn-bar"><b>e-Invoice</b> &nbsp; IRN: '+voucher.irn+
      (voucher.ackNo ? ' &nbsp;·&nbsp; Ack No: '+voucher.ackNo : '')+
      (voucher.ackDate ? ' &nbsp;·&nbsp; Ack Date: '+fmtDate(voucher.ackDate) : '')+'</div>' : '') +

    // PARTIES
    '<div class="parties">' +
      '<div class="party-box">' +
        '<div class="ptitle">'+(isPurchase?'Supplier Details':'Bill To')+'</div>' +
        '<div class="pname">'+(party.name || voucher.partyName || '')+'</div>' +
        '<div class="pdetail">'+(party.address||'')+(party.state?'<br/>State: '+party.state+(party.stateCode?' ('+party.stateCode+')':''):'')+'</div>' +
        (party.gstin ? '<div class="pgstin">GSTIN: '+party.gstin+'</div>' : '<div class="pdetail" style="font-style:italic">Unregistered Dealer</div>') +
        (party.pan ? '<div class="pdetail">PAN: '+party.pan+'</div>' : '') +
      '</div>' +
      '<div class="party-box">' +
        '<div class="ptitle">Ship To / Delivery</div>' +
        '<div class="pname">'+(party.name||'')+'</div>' +
        '<div class="pdetail">'+(party.address||'(Same as billing address)')+'</div>' +
        '<div class="pdetail">'+(party.email?party.email+'<br/>':'')+(party.phone||'')+'</div>' +
      '</div>' +
    '</div>' +

    // ITEMS TABLE
    '<table class="items-table"><thead><tr>' + itemHeader + '</tr></thead><tbody>' + itemRowsHtml + '</tbody></table>' +

    // TOTALS
    '<div class="totals"><div class="totals-box"><table>' +
      '<tr><td>Taxable Value</td><td class="r">₹'+fmt(taxableTotal)+'</td></tr>' +
      taxRowsHtml +
      forexHtml +
      '<tr class="grand"><td>INVOICE TOTAL</td><td class="r">₹'+fmt(invoiceTotal)+'</td></tr>' +
    '</table></div></div>' +

    // AMOUNT IN WORDS
    '<div class="words-box"><div class="wlabel">Amount in Words</div><div class="wtext">'+words+'</div></div>' +

    // HSN SUMMARY
    (items.length > 0 ? '<div class="hsn-section"><div class="stitle">HSN/SAC Summary</div><table class="hsn-table"><thead><tr>'+hsnHeader+'</tr></thead><tbody>'+hsnHtml+'</tbody></table></div>' : '') +

    // BOTTOM: UPI PAY-NOW + BANK + TERMS + SIGNATURE
    '<div class="bottom">' +
      '<div>' +
        upiHtml +
        (co.bankDetails ? '<div class="bank-box"><div class="btitle">Bank Details for Payment</div><div class="bdetail">'+co.bankDetails.replace(/\|/g,'<br/>')+'</div></div>' : '') +
        '<div class="terms"><div class="ttitle">Terms & Conditions</div>' +
          '1. Payment due within '+(party.creditDays!=null?party.creditDays:30)+' days from invoice date'+(dueDate?' (by '+fmtDate(dueDate)+')':'')+'.<br/>' +
          '2. Interest @ 18% p.a. will be charged on delayed payments.<br/>' +
          '3. Subject to '+(co.state||'Gujarat')+' jurisdiction. &nbsp; E. & O.E.<br/>' +
          (isExport ? '4. Supply meant for export under LUT/Bond without payment of IGST.<br/>' : '') +
          (voucher.narration ? '<br/><b>Narration:</b> '+voucher.narration : '') +
          '<br/><b>Declaration:</b> We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.' +
        '</div>' +
      '</div>' +
      '<div class="sig-box">' +
        '<div class="sfor">For '+(co.name||'')+'</div>' +
        '<div></div>' +
        '<div class="sline">Authorised Signatory</div>' +
      '</div>' +
    '</div>' +

    // FOOTER
    '<div class="footer">' +
      'This is a computer-generated document and does not require a physical signature.<br/>' +
      'Generated by <b>MiyeeBooks</b> · MSME Accounting Suite · Built by <b>Vipin Nair</b> · MYeeCFO Series' +
    '</div>' +

    // PRINT + SHARE BUTTONS (hidden on print)
    '<div class="no-print" style="text-align:center;margin:20px 0">' +
      (waUrl   ? '<button onclick="window.open(\''+waUrl+'\',\'_blank\')" style="padding:12px 22px;background:#25D366;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">💬 WhatsApp</button>&nbsp;&nbsp;' : '') +
      (mailUrl ? '<button onclick="window.location.href=\''+mailUrl+'\'" style="padding:12px 22px;background:#1565c0;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">📧 Email</button>&nbsp;&nbsp;' : '') +
      '<button onclick="window.print()" style="padding:12px 32px;background:#0b6b4f;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">⎙ Print / Save as PDF</button>' +
      '&nbsp;&nbsp;' +
      '<button onclick="window.close()" style="padding:12px 24px;background:#eee;color:#333;border:1px solid #ccc;border-radius:6px;font-size:14px;cursor:pointer;font-family:inherit">Close</button>' +
    '</div>' +
    '<div class="no-print" style="text-align:center;font-size:11px;color:#888;margin-bottom:20px">Tip: after clicking Print → Save as PDF, attach the saved file to the WhatsApp/email draft.</div>' +

    '</div>' + upiScript + '</body></html>';

  // Open in new window
  const win = window.open('', '_blank', 'width=900,height=1000');
  if(!win){
    alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
    return;
  }
  // Apply selected invoice template theme (recolours headers, totals, borders, accents)
  const themed = html.replace(/#0b6b4f/g, tpl.accent).replace(/#c9a227/g, tpl.accent2);
  win.document.write(themed);
  win.document.close();
  win.focus();
}

// One-click financial report bundle → opens a print window (Save as PDF) with a
// cover, financial summary, Profit & Loss, Balance Sheet and cash position, all
// derived from account TYPE + balances (COA-agnostic, always tallies).
function generateReportBundle(data, balances){
  const getBal = id => balances[id] || 0;
  const f2 = n => (n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const co = data.company || {};
  const asOn = (typeof today==='function') ? today() : new Date().toISOString().slice(0,10);
  const fyLabel = (co.fyStart? co.fyStart.slice(0,4):'') + '–' + (co.fyEnd? co.fyEnd.slice(2,4):'');

  // ── P&L ──
  const incomeAccts  = data.coa.filter(a=>a.type==='Income');
  const expenseAccts = data.coa.filter(a=>a.type==='Expense');
  const income  = incomeAccts.reduce((s,a)=>s+(-getBal(a.id)),0);
  const expense = expenseAccts.reduce((s,a)=>s+getBal(a.id),0);
  const profit  = income - expense;

  // ── Balance Sheet ──
  const assetAccts  = data.coa.filter(a=>a.type==='Asset');
  const liabAccts   = data.coa.filter(a=>a.type==='Liability');
  const equityAccts = data.coa.filter(a=>a.type==='Equity');
  const totalAssets = assetAccts.reduce((s,a)=>s+getBal(a.id),0);
  const totalLiab   = liabAccts.reduce((s,a)=>s+(-getBal(a.id)),0);
  const totalEquity = equityAccts.reduce((s,a)=>s+(-getBal(a.id)),0) + profit; // current profit → reserves
  const cash = getBal('2500')+getBal('2510')+getBal('2511')+getBal('2520');

  // group non-zero accounts under a heading
  const groupRows = (accts, asAsset) => {
    const byGroup = {};
    accts.forEach(a=>{
      const raw = getBal(a.id);
      const val = asAsset ? raw : -raw;
      if(Math.abs(val) < 0.005) return;
      (byGroup[a.group||'Other'] = byGroup[a.group||'Other'] || []).push({name:a.name, val});
    });
    return Object.entries(byGroup).map(([g,rows])=>{
      const sub = rows.reduce((s,r)=>s+r.val,0);
      return '<tr class="grp"><td colspan="2">'+g+'</td></tr>' +
        rows.map(r=>'<tr><td class="ind">'+r.name+'</td><td class="amt">'+f2(r.val)+'</td></tr>').join('') +
        '<tr class="sub"><td>Subtotal - '+g+'</td><td class="amt">'+f2(sub)+'</td></tr>';
    }).join('');
  };
  const plExpense = groupRows(expenseAccts, true);
  const plIncome  = groupRows(incomeAccts, false);
  const bsAssets  = groupRows(assetAccts, true);
  const bsLiab    = groupRows(liabAccts, false);
  const bsEquityRows = groupRows(equityAccts, false) +
    '<tr class="grp"><td colspan="2">Current Year</td></tr>' +
    '<tr><td class="ind">Profit / (Loss) for the year</td><td class="amt">'+f2(profit)+'</td></tr>';

  const kpi = (l,v) => '<div class="kpi"><div class="kl">'+l+'</div><div class="kv">₹'+f2(v)+'</div></div>';
  const sect = (title, sub) => '<h2>'+title+'</h2>'+(sub?'<div class="ssub">'+sub+'</div>':'');

  const html =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Financial Report Bundle - '+(co.name||'')+'</title>'+
  '<style>'+
  '*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2b26;margin:0;background:#f4f6f5}'+
  '.pg{max-width:820px;margin:0 auto;background:#fff;padding:38px 46px;min-height:100vh}'+
  '.cover{text-align:center;padding:120px 0 60px}.cover h1{font-size:30px;margin:0 0 8px;color:#0b6b4f}.cover .co{font-size:20px;font-weight:700}'+
  '.cover .meta{color:#6b7f78;font-size:13px;margin-top:6px}'+
  'h2{color:#0b6b4f;font-size:17px;border-bottom:2px solid #0b6b4f;padding-bottom:5px;margin:30px 0 4px}'+
  '.ssub{color:#6b7f78;font-size:11px;margin-bottom:8px}'+
  'table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:8px}'+
  'td{padding:4px 8px;border-bottom:1px solid #eef2f0}.amt{text-align:right;font-variant-numeric:tabular-nums}'+
  '.grp td{font-weight:700;background:#f0f6f3;color:#0b6b4f;padding-top:7px}'+
  '.ind{padding-left:22px}.sub td{font-weight:600;border-top:1px solid #cfe0d9}.sub .amt{border-top:1px solid #cfe0d9}'+
  '.tot td{font-weight:800;font-size:13.5px;border-top:2px solid #0b6b4f;border-bottom:2px solid #0b6b4f;background:#0b6b4f0a}'+
  '.kpis{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 6px}.kpi{flex:1;min-width:120px;border:1px solid #e3ebe7;border-radius:8px;padding:10px 12px}'+
  '.kl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#6b7f78}.kv{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px}'+
  '.foot{margin-top:34px;text-align:center;font-size:10.5px;color:#8a9a94;border-top:1px solid #eef2f0;padding-top:10px}'+
  '.chk{font-size:11px;margin-top:6px;font-weight:600}'+
  '@media print{body{background:#fff}.pg{padding:0 8px}.no-print{display:none!important}h2{page-break-after:avoid}.cover{page-break-after:always}}'+
  '</style></head><body><div class="pg">'+
  // Cover
  '<div class="cover"><h1>Financial Report Bundle</h1>'+
    '<div class="co">'+(co.name||'Your Company')+'</div>'+
    '<div class="meta">'+(co.gstin?('GSTIN: '+co.gstin+' · '):'')+'FY '+fyLabel+'</div>'+
    '<div class="meta">Prepared as on '+fmtDate(asOn)+'</div>'+
    '<div class="meta" style="margin-top:26px">Contents: Financial Summary · Profit &amp; Loss · Balance Sheet · Cash Position</div>'+
  '</div>'+
  // Summary
  sect('Financial Summary')+
  '<div class="kpis">'+kpi('Total Income',income)+kpi('Total Expenses',expense)+kpi('Net Profit',profit)+'</div>'+
  '<div class="kpis">'+kpi('Total Assets',totalAssets)+kpi('Equity',totalEquity)+kpi('Cash & Bank',cash)+'</div>'+
  // P&L
  sect('Profit & Loss Statement','For FY '+fyLabel)+
  '<table>'+plExpense+
    '<tr class="tot"><td>Total Expenses</td><td class="amt">'+f2(expense)+'</td></tr>'+
    plIncome+
    '<tr class="tot"><td>Total Income</td><td class="amt">'+f2(income)+'</td></tr>'+
    '<tr class="tot"><td>Net Profit / (Loss)</td><td class="amt">'+f2(profit)+'</td></tr>'+
  '</table>'+
  // Balance Sheet
  sect('Balance Sheet','As on '+fmtDate(asOn))+
  '<table>'+
    '<tr class="grp" style="background:#0b6b4f;color:#fff"><td colspan="2">EQUITY &amp; LIABILITIES</td></tr>'+
    bsEquityRows+bsLiab+
    '<tr class="tot"><td>Total Equity &amp; Liabilities</td><td class="amt">'+f2(totalEquity+totalLiab)+'</td></tr>'+
    '<tr class="grp" style="background:#0b6b4f;color:#fff"><td colspan="2">ASSETS</td></tr>'+
    bsAssets+
    '<tr class="tot"><td>Total Assets</td><td class="amt">'+f2(totalAssets)+'</td></tr>'+
  '</table>'+
  '<div class="chk" style="color:'+(Math.abs(totalAssets-(totalEquity+totalLiab))<1?'#0b6b4f':'#c62828')+'">'+
    (Math.abs(totalAssets-(totalEquity+totalLiab))<1 ? '✓ Balance Sheet tallies' : '⚠ Difference ₹'+f2(totalAssets-(totalEquity+totalLiab)))+'</div>'+
  '<div class="foot">Computer-generated report · MiyeeBooks MSME Accounting Suite · Built by Vipin Nair · MYeeCFO Series</div>'+
  '<div class="no-print" style="text-align:center;margin:22px 0">'+
    '<button onclick="window.print()" style="padding:11px 30px;background:#0b6b4f;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">⎙ Print / Save as PDF</button>'+
    '&nbsp;&nbsp;<button onclick="window.close()" style="padding:11px 22px;background:#eee;color:#333;border:1px solid #ccc;border-radius:6px;font-size:13px;cursor:pointer">Close</button>'+
  '</div>'+
  '</div></body></html>';

  const win = window.open('', '_blank', 'width=880,height=1000');
  if(!win){ alert('Allow pop-ups to generate the report bundle.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

// Generate the IRP e-invoice JSON (schema 1.1) for a sales invoice - upload to the
// e-invoice portal / GePP, or pass to an IRN-generation API.
function generateEInvoiceJSON(voucher, appData){
  const co = appData.company;
  const party = appData.parties.find(p => p.id === voucher.partyId) || {};
  const inter = voucher.isInterState;
  const items = (voucher.items||[]).map((it,i) => {
    const ass = Math.round((it.qty||0)*(it.rate||0)*100)/100;
    const tax = Math.round(ass*(it.gstRate||0)/100*100)/100;
    return {
      SlNo:String(i+1), PrdDesc:(it.description||'Item').slice(0,100), IsServc:(it.hsn||'').startsWith('99')?'Y':'N',
      HsnCd:it.hsn||'', Qty:it.qty||0, Unit:'NOS', UnitPrice:it.rate||0, TotAmt:ass, AssAmt:ass,
      GstRt:it.gstRate||0,
      IgstAmt: inter?tax:0, CgstAmt: inter?0:Math.round(tax/2*100)/100, SgstAmt: inter?0:Math.round(tax/2*100)/100,
      TotItemVal: Math.round((ass+tax)*100)/100,
    };
  });
  const payload = {
    Version:'1.1',
    TranDtls:{ TaxSch:'GST', SupTyp:party.isForeign?'EXPWOP':'B2B', RegRev:'N', IgstOnIntra:'N' },
    DocDtls:{ Typ: voucher.type==='CRN'?'CRN':voucher.type==='DBN'?'DBN':'INV', No: voucher.number||'', Dt: fmtDate(voucher.date).replace(/-/g,'/') },
    SellerDtls:{ Gstin:co.gstin||'', LglNm:co.name||'', Addr1:(co.address||'').slice(0,100), Loc:co.state||'', Pin:Number((co.address||'').match(/\b(\d{6})\b/)?.[1]||0)||390001, Stcd:co.stateCode||'24' },
    BuyerDtls:{ Gstin:party.gstin||'URP', LglNm:party.name||'', Pos:voucher.placeOfSupply||party.stateCode||'24', Addr1:(party.address||'').slice(0,100), Loc:party.state||'', Pin:380001, Stcd:party.stateCode||'24' },
    ItemList: items,
    ValDtls:{
      AssVal: voucher.taxable||0,
      CgstVal: voucher.cgst||0, SgstVal: voucher.sgst||0, IgstVal: voucher.igst||0, CesVal:0,
      TotInvVal: voucher.total||voucher.amount||0,
    },
  };
  const blob = new Blob([JSON.stringify([payload], null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `einvoice_${(voucher.number||'INV').replace(/[^\w]/g,'_')}.json`; a.click();
  URL.revokeObjectURL(url);
}

// Generate the NIC e-Way Bill bulk-upload JSON for a sales invoice (consignments
// over ₹50,000). Transport details (vehicle no, distance) are prompted - leave
// blank to fill them on the portal before generation.
function generateEWayBillJSON(voucher, appData){
  const co = appData.company;
  const party = appData.parties.find(p => p.id === voucher.partyId) || {};
  const inter = voucher.isInterState;
  const d2 = iso => { const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[3]}/${m[2]}/${m[1]}`:iso; };
  const pin = s => Number(String(s||'').match(/\b(\d{6})\b/)?.[1]||0) || 0;
  const vehicleNo = (prompt('Vehicle number (e.g. GJ01AB1234) - leave blank to fill on portal:','')||'').toUpperCase().replace(/\s/g,'');
  const distance  = parseInt(prompt('Approx. transport distance in km (blank = 0, portal will auto-compute):','')||'0',10)||0;
  const bill = {
    version:'1.0.0421',
    billLists:[{
      genMode:'portal', userGstin: co.gstin||'',
      supplyType:'O', subSupplyType:'1', subSupplyDesc:'',
      docType: voucher.type==='CRN' ? 'CRN' : 'INV',
      docNo: voucher.number||'', docDate: d2(voucher.date),
      fromGstin: co.gstin||'', fromTrdName: co.name||'',
      fromAddr1:(co.address||'').slice(0,120), fromAddr2:'', fromPlace:(co.state||'').slice(0,50),
      fromPincode: pin(co.address)||390001, actualFromStateCode: Number(co.stateCode||24), fromStateCode: Number(co.stateCode||24),
      toGstin: party.gstin||'URP', toTrdName: party.name||'',
      toAddr1:(party.address||'').slice(0,120), toAddr2:'', toPlace:(party.state||'').slice(0,50),
      toPincode: pin(party.address)||380001, actualToStateCode: Number(party.stateCode||24), toStateCode: Number(party.stateCode||24),
      transactionType: 1, otherValue: 0,
      totalValue: voucher.taxable||0,
      cgstValue: voucher.cgst||0, sgstValue: voucher.sgst||0, igstValue: voucher.igst||0, cessValue: 0, cessNonAdvolValue: 0,
      totInvValue: voucher.total||voucher.amount||0,
      transMode:'1', transDistance:String(distance),
      transporterName:'', transporterId:'', transDocNo:'', transDocDate:'',
      vehicleNo: vehicleNo, vehicleType:'R',
      itemList:(voucher.items||[]).map(it => {
        const ass = (it.qty||0)*(it.rate||0);
        const tax = ass*(it.gstRate||0)/100;
        return {
          productName:(it.description||'').slice(0,100), productDesc:(it.description||'').slice(0,100),
          hsnCode: Number(String(it.hsn||'').replace(/\D/g,''))||0,
          quantity: it.qty||0, qtyUnit:'NOS',
          taxableAmount: Math.round(ass*100)/100,
          sgstRate: inter?0:(it.gstRate||0)/2, cgstRate: inter?0:(it.gstRate||0)/2,
          igstRate: inter?(it.gstRate||0):0, cessRate:0, cessNonAdvol:0,
        };
      }),
    }],
  };
  const blob = new Blob([JSON.stringify(bill, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `ewaybill_${(voucher.number||'INV').replace(/[^\w]/g,'_')}.json`; a.click();
  URL.revokeObjectURL(url);
}

// Print a sales document (Quotation / Proforma Invoice / Delivery Challan) in a
// GST-style layout with WhatsApp / Email share, mirroring generateInvoicePDF.
function printSalesDoc(doc, appData){
  const co = appData.company || {};
  const party = appData.parties.find(p => p.id === doc.partyId) || {name:doc.partyName||''};
  const f2 = n => (n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const isChallan = doc.docType==='Delivery Challan';
  const title = (doc.docType||'Quotation').toUpperCase();
  let taxable=0, totTax=0;
  const rowsHtml = (doc.items||[]).map((it,i)=>{
    const amt=(it.qty||0)*(it.rate||0), tax=isChallan?0:amt*(it.gstRate||0)/100;
    taxable+=amt; totTax+=tax;
    return '<tr><td>'+(i+1)+'</td><td>'+(it.description||'')+'</td><td>'+(it.hsn||'')+'</td>'+
      '<td class="n">'+(it.qty||0)+'</td><td class="n">'+f2(it.rate)+'</td>'+
      (isChallan?'':'<td class="n">'+(it.gstRate||0)+'%</td>')+
      '<td class="n">'+f2(isChallan?amt:amt+tax)+'</td></tr>';
  }).join('');
  const total = taxable+totTax;
  const waText = encodeURIComponent(`${doc.docType} ${doc.number} from ${co.name}\nTotal: ₹${f2(total)}\nValid till: ${doc.validTill?fmtDate(doc.validTill):'-'}`);
  const waUrl = party.phone ? 'https://wa.me/'+String(party.phone).replace(/\D/g,'')+'?text='+waText : '';
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+title+' '+(doc.number||'')+'</title><style>'+
    'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a2b26;margin:0;background:#f4f6f5}'+
    '.pg{max-width:780px;margin:0 auto;background:#fff;padding:34px 42px}'+
    '.hd{display:flex;justify-content:space-between;border-bottom:3px solid #0b6b4f;padding-bottom:12px;margin-bottom:14px}'+
    '.hd h1{font-size:22px;color:#0b6b4f;margin:0}.co{font-size:12px;color:#4a5f57;line-height:1.5}'+
    '.badge{background:#0b6b4f;color:#fff;padding:4px 16px;border-radius:4px;font-weight:700;font-size:13px;letter-spacing:1px}'+
    '.meta{display:flex;gap:26px;font-size:12px;margin:12px 0;flex-wrap:wrap}.meta b{display:block;font-size:10px;color:#6b7f78;text-transform:uppercase}'+
    'table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0}th{background:#0b6b4f;color:#fff;padding:7px 9px;text-align:left;font-size:11px}'+
    'td{padding:6px 9px;border-bottom:1px solid #e8efec}.n{text-align:right;font-variant-numeric:tabular-nums}'+
    '.tot{display:flex;justify-content:flex-end;margin-top:8px}.tot table{width:300px}.tot .g td{font-weight:800;border-top:2px solid #0b6b4f;font-size:14px}'+
    '.terms{font-size:11px;color:#4a5f57;margin-top:16px;white-space:pre-wrap}'+
    '.foot{margin-top:26px;text-align:center;font-size:10px;color:#8a9a94;border-top:1px solid #eef2f0;padding-top:8px}'+
    '@media print{body{background:#fff}.pg{padding:0}.no-print{display:none!important}}'+
    '</style></head><body><div class="pg">'+
    '<div class="hd"><div><h1>'+(co.name||'')+'</h1><div class="co">'+(co.address||'')+(co.gstin?'<br/>GSTIN: '+co.gstin:'')+'</div></div>'+
    '<div style="text-align:right"><span class="badge">'+title+'</span>'+(isChallan?'<div style="font-size:10px;color:#6b7f78;margin-top:6px">Goods sent - not a tax invoice</div>':'')+'</div></div>'+
    '<div class="meta">'+
      '<div><b>'+(doc.docType||'Quotation')+' No.</b>'+(doc.number||'')+'</div>'+
      '<div><b>Date</b>'+fmtDate(doc.date)+'</div>'+
      (doc.validTill?'<div><b>Valid Till</b>'+fmtDate(doc.validTill)+'</div>':'')+
      '<div><b>To</b>'+(party.name||'')+(party.gstin?'<br/>GSTIN: '+party.gstin:'')+(party.address?'<br/>'+party.address:'')+'</div>'+
      (doc.reference?'<div><b>Reference</b>'+doc.reference+'</div>':'')+
    '</div>'+
    '<table><thead><tr><th>#</th><th>Description</th><th>HSN</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th>'+
    (isChallan?'':'<th style="text-align:right">GST</th>')+'<th style="text-align:right">Amount</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
    '<div class="tot"><table>'+
      '<tr><td>Taxable Value</td><td class="n">₹'+f2(taxable)+'</td></tr>'+
      (isChallan?'':'<tr><td>Total GST</td><td class="n">₹'+f2(totTax)+'</td></tr>')+
      '<tr class="g"><td>'+(isChallan?'Total Value of Goods':'Grand Total')+'</td><td class="n">₹'+f2(total)+'</td></tr>'+
    '</table></div>'+
    (doc.notes?'<div class="terms"><b>Terms & Notes</b><br/>'+doc.notes+'</div>':'')+
    '<div class="foot">Computer-generated '+(doc.docType||'document').toLowerCase()+' · MiyeeBooks MSME Accounting Suite · Built by Vipin Nair · MYeeCFO Series</div>'+
    '<div class="no-print" style="text-align:center;margin:20px 0">'+
      (waUrl?'<button onclick="window.open(\''+waUrl+'\',\'_blank\')" style="padding:11px 20px;background:#25D366;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">💬 WhatsApp</button>&nbsp;&nbsp;':'')+
      '<button onclick="window.print()" style="padding:11px 28px;background:#0b6b4f;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">⎙ Print / Save as PDF</button>'+
      '&nbsp;&nbsp;<button onclick="window.close()" style="padding:11px 20px;background:#eee;color:#333;border:1px solid #ccc;border-radius:6px;font-size:13px;cursor:pointer">Close</button>'+
    '</div></div></body></html>';
  const win = window.open('', '_blank', 'width=860,height=980');
  if(!win){ alert('Allow pop-ups to print this document.'); return; }
  win.document.write(html); win.document.close(); win.focus();
}
