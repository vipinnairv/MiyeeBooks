const { useState, useEffect, useMemo, useRef } = React;

// ============================================================================
// UTILITIES
// ============================================================================
const fmt = (n, dec=2) => {
  if(n===null||n===undefined||isNaN(n))return '0.00';
  const num = Number(n);
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  // Indian number format
  const parts = abs.toFixed(dec).split('.');
  let intPart = parts[0];
  let lastThree = intPart.substring(intPart.length-3);
  let otherNums = intPart.substring(0, intPart.length-3);
  if(otherNums !== '') lastThree = ',' + lastThree;
  const formatted = otherNums.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  return sign + formatted + (dec>0 ? '.' + parts[1] : '');
};
const today = () => new Date().toISOString().slice(0,10);
const uid = () => Math.random().toString(36).slice(2,9);

// GST state codes → names, and the "24-Gujarat" Place-of-Supply label the GST
// offline tool / GSTR templates expect.
const STATE_NAMES = {'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','25':'Daman & Diu','26':'Dadra and Nagar Haveli and Daman and Diu','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh','97':'Other Territory'};
const posLabel = (code) => { const c = String(code||'').padStart(2,'0'); return STATE_NAMES[c] ? `${c}-${STATE_NAMES[c]}` : c; };
// B2C-Large threshold: inter-state B2C invoices above this go to B2CL (5), else B2CS (7).
// Reduced from ₹2,50,000 to ₹1,00,000 (Notification 12/2024-CT).
const B2CL_THRESHOLD = 100000;
// Next voucher number honouring per-type numbering series config (Company Settings).
// cfg: {prefix, padding, includeFY}. Defaults to "<TYPE>/0001".
const nextVoucherNumber = (data, type) => {
  const cfg = ((data.company && data.company.numberingSeries) || {})[type] || {};
  const count = (data.vouchers||[]).filter(v => v.type === type).length + 1;
  const num   = String(count).padStart(cfg.padding || 4, '0');
  const prefix = (cfg.prefix != null && cfg.prefix !== '') ? cfg.prefix : type;
  const parts = [prefix];
  if(cfg.includeFY && data.company && data.company.fyStart){
    const y = parseInt(data.company.fyStart.slice(0,4));
    parts.push(String(y).slice(2) + '-' + String(y+1).slice(2));
  }
  parts.push(num);
  return parts.join('/');
};
// Display an ISO date (YYYY-MM-DD) as DD-MM-YYYY for Indian convention.
const fmtDate = (iso) => {
  if(!iso) return '';
  const s = String(iso).slice(0,10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
};
// GSTIN check-digit (position 15) over the first 14 chars - official GSTN algorithm.
const GSTIN_CP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gstinCheckDigit = (first14) => {
  const mod = GSTIN_CP.length;   // 36
  let factor = 2, sum = 0;
  for(let i = first14.length - 1; i >= 0; i--){
    const cp = GSTIN_CP.indexOf(first14[i]);
    if(cp < 0) return '';
    let digit = factor * cp;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / mod) + (digit % mod);
    sum += digit;
  }
  return GSTIN_CP[(mod - (sum % mod)) % mod];
};
// Validate a GSTIN: format (2-digit state + 10-char PAN + entity + 'Z' + check) AND checksum.
// Returns {valid, reason} - reason ∈ empty|length|format|checksum|ok.
const validateGSTIN = (gstin) => {
  if(!gstin) return {valid:false, reason:'empty'};
  const g = String(gstin).toUpperCase().trim();
  if(g.length !== 15) return {valid:false, reason:'length'};
  if(!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g)) return {valid:false, reason:'format'};
  return gstinCheckDigit(g.slice(0,14)) === g[14] ? {valid:true, reason:'ok'} : {valid:false, reason:'checksum'};
};
// PT helper (Gujarat): Rs200/month, manual (keep ptAmount editable)
// Monthly: returns 0 if not joined, else ptAmount (user sets this)
const calcPTMonthly = (employee, month, fyStart) => {
  const ptRate = employee.ptAmount != null ? employee.ptAmount : 200;
  if(ptRate === 0) return 0;
  if(employee.doj){
    const dojDate = new Date(employee.doj);
    const payMonthEnd = new Date(parseInt(month.slice(0,4)), parseInt(month.slice(5,7)), 0);
    if(dojDate > payMonthEnd) return 0;
  }
  return ptRate;
};

// Annual PT: if DOJ <= FY start → 12 months. If mid-FY → count from DOJ month to March.
const calcPTAnnual = (employee, fyStart) => {
  const ptRate = employee.ptAmount != null ? employee.ptAmount : 200;
  if(ptRate === 0) return 0;
  const fyStartYear = parseInt((fyStart||'2025-04-01').slice(0,4));
  const fyStartDate = new Date(fyStartYear, 3, 1);   // 01-Apr-YYYY
  const fyEndDate   = new Date(fyStartYear+1, 2, 31); // 31-Mar-YYYY+1

  let countFrom = new Date(fyStartDate); // default: full FY from April
  if(employee.doj){
    const doj = new Date(employee.doj);
    if(doj > fyEndDate) return 0;            // joins after this FY
    if(doj > fyStartDate) countFrom = new Date(doj.getFullYear(), doj.getMonth(), 1); // mid-FY join
    // if doj <= fyStartDate → full year (countFrom stays April)
  }
  let months = 0;
  let d = new Date(countFrom.getFullYear(), countFrom.getMonth(), 1);
  while(d <= fyEndDate){ months++; d.setMonth(d.getMonth()+1); }
  return months * ptRate;
};

const STORAGE_KEY = 'miyeebooks_v1';
const LEGACY_KEY  = 'myeebooks_v1';    // pre-rebrand key  auto-migrate on first load
