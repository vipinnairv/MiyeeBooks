
// ============================================================================
// CSV UTILITIES
// ============================================================================
const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const rows = lines.slice(1).map(line => {
    const cols = [];
    let cur = '', inQ = false;
    for(let i = 0; i < line.length; i++){
      const ch = line[i];
      if(ch === '"'){ inQ = !inQ; continue; }
      if(ch === ',' && !inQ){ cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h,i) => { obj[h] = (cols[i]||'').replace(/^"|"$/g,'').trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v !== ''));
  return { headers, rows };
};

const downloadCSV = (filename, csvText) => {
  const blob = new Blob([csvText], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// Export multi-sheet .xlsx via SheetJS
const exportXLSX = (filename, sheets) => {
  // sheets = [{name:'Sheet1', rows:[[col1,col2,...], [val1,val2,...], ...]}, ...]
  if(!window.XLSX){ alert('Excel library not loaded  check your internet connection.'); return; }
  const wb = window.XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = window.XLSX.utils.aoa_to_sheet(s.rows);
    // Bold first row (header styling)
    if(s.rows && s.rows.length > 0){
      const range = window.XLSX.utils.decode_range(ws['!ref']||'A1');
      for(let C = range.s.c; C <= range.e.c; C++){
        const cell = ws[window.XLSX.utils.encode_cell({r:0,c:C})];
        if(cell) cell.s = {font:{bold:true}};
      }
    }
    window.XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0,31));
  });
  window.XLSX.writeFile(wb, filename);
};

// Compute per-account balances for a specific period
// Returns { opening, period, asOn } maps
// opening[id] = COA opening balance + all movements BEFORE fromDate
// period[id]  = movements FROM fromDate TO toDate (inclusive)
// asOn[id]    = opening[id] + period[id]
const computePeriodBals = (data, fromDate, toDate) => {
  const opening = {}, period = {};
  data.coa.forEach(a => { opening[a.id] = a.opening || 0; period[a.id] = 0; });
  data.vouchers.forEach(v => {
    if(v.status === 'Cancelled') return;
    (v.lines||[]).forEach(l => {
      const id = l.accountId;
      const mv = (l.debit||0) - (l.credit||0);
      if(!opening[id]) opening[id] = 0;
      if(!period[id])  period[id]  = 0;
      if(fromDate && v.date < fromDate)  opening[id] += mv;
      else if(!toDate || v.date <= toDate) period[id] += mv;
    });
  });
  const asOn = {};
  [...new Set([...Object.keys(opening),...Object.keys(period)])].forEach(id => {
    asOn[id] = (opening[id]||0) + (period[id]||0);
  });
  return { opening, period, asOn };
};

// ── COA role resolver ────────────────────────────────────────────────────────
// Reports historically hardcoded ledger ids ('2400','1300','1310','2600'…), which
// break if a user restructures their chart. acctIds() resolves a logical role to
// the matching account ids - by seed id if present, otherwise by type + name
// heuristic - so reports keep working across custom charts.
const ACCT_ROLE_DEFS = {
  trade_receivable: { seeds:['2400'], type:'Asset',     re:/(sundry\s*debtor|trade\s*receivable|accounts?\s*receivable)/i },
  trade_payable:    { seeds:['1300'], type:'Liability', re:/(sundry\s*creditor|trade\s*payable|accounts?\s*payable)/i },
  gst_output:       { seeds:['1310','1311','1312'], type:'Liability', re:/(cgst|sgst|igst|utgst).*(payable|output)|output.*(cgst|sgst|igst)/i },
  gst_input:        { seeds:['2600','2601','2602'], type:'Asset',     re:/(cgst|sgst|igst|utgst).*(input|credit|itc)|input.*(cgst|sgst|igst)/i },
  cash:             { seeds:['2500'], type:'Asset',     re:/cash\s*in\s*hand/i },
};
const acctIds = (data, role) => {
  const def = ACCT_ROLE_DEFS[role]; if(!def) return [];
  const byId = (def.seeds||[]).filter(id => (data.coa||[]).some(a=>a.id===id));
  if(byId.length) return byId;                       // seed accounts present → use them
  return (data.coa||[]).filter(a => (!def.type||a.type===def.type) && def.re.test(a.name||'')).map(a=>a.id);
};
const acctIdSet = (data, ...roles) => new Set(roles.flatMap(r => acctIds(data, r)));

// ── Statutory compliance dues ────────────────────────────────────────────────
const STATUTORY_HEADS = [
  {key:'tds',  label:'TDS Payment (Challan)',  dueDay:7,  color:'#1976d2'},
  {key:'pf',   label:'Provident Fund (PF)',    dueDay:15, color:'#6a1b9a'},
  {key:'esic', label:'ESIC',                   dueDay:15, color:'#e65100'},
  {key:'pt',   label:'Professional Tax (PT)',  dueDay:21, color:'#00838f'},
  {key:'gst',  label:'GST (GSTR-3B)',          dueDay:20, color:'#0b6b4f'},
];
// Current outstanding per statutory head (from as-on ledger balances) + next filing date.
const complianceDues = (data) => {
  const fyStart = data.company?.fyStart || '2025-04-01';
  const t = today();
  const pb = computePeriodBals(data, fyStart, t).asOn;
  const sumIds = (ids, sign) => ids.reduce((s,id)=>s + sign*(pb[id]||0), 0);
  const outIds = [...acctIdSet(data,'gst_output')];
  const inIds  = [...acctIdSet(data,'gst_input')];
  const tdsIds = (data.coa||[]).filter(a=>/tds\s*payable/i.test(a.name||'')).map(a=>a.id);
  const pfId   = (data.coa||[]).find(a=>/pf\s*payable|provident/i.test(a.name||''))?.id || '1322';
  const esicId = (data.coa||[]).find(a=>/esic/i.test(a.name||''))?.id || '1323';
  const ptId   = (data.coa||[]).find(a=>/professional\s*tax/i.test(a.name||''))?.id || '1324';
  const amounts = {
    gst:  Math.max(0, sumIds(outIds,-1) - sumIds(inIds,1)),
    tds:  sumIds(tdsIds,-1),
    pf:   -(pb[pfId]||0),
    esic: -(pb[esicId]||0),
    pt:   -(pb[ptId]||0),
  };
  const d = new Date(t + 'T00:00:00');
  const nextDue = (day) => {  // `day` of the next calendar month (this period's filing date)
    const due = new Date(d.getFullYear(), d.getMonth()+1, day);
    return due.toISOString().slice(0,10);
  };
  return STATUTORY_HEADS.map(h => {
    const amount = Math.round((amounts[h.key]||0)*100)/100;
    const due = nextDue(h.dueDay);
    const days = Math.round((new Date(due) - d)/86400000);
    return {...h, amount, due, days};
  }).filter(h => h.amount > 0.5);
};

// Open a standalone ledger page in a new browser tab for one or more account IDs
const openLedgerTab = (accountIds, title, data, from, to) => {
  const ids = new Set(accountIds);
  const accounts = accountIds.map(id => data.coa.find(a=>a.id===id)).filter(Boolean);
  const fmtN = (n) => n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Opening balance (COA opening + all movements BEFORE from)
  let openingBal = 0;
  accounts.forEach(a => { openingBal += (a.opening||0); });
  data.vouchers
    .filter(v => v.status!=='Cancelled' && (!from || v.date < from))
    .sort((a,b) => a.date.localeCompare(b.date))
    .forEach(v => (v.lines||[]).forEach(l => {
      if(ids.has(l.accountId)) openingBal += (l.debit||0) - (l.credit||0);
    }));

  // Period transactions
  const txns = [];
  data.vouchers
    .filter(v => v.status!=='Cancelled' && (!from||v.date>=from) && (!to||v.date<=to))
    .sort((a,b) => a.date.localeCompare(b.date)||a.number.localeCompare(b.number))
    .forEach(v => (v.lines||[]).forEach(l => {
      if(ids.has(l.accountId))
        txns.push({date:v.date,vchNo:v.number,type:v.type,narration:l.narration||v.narration||v.partyName||'',debit:l.debit||0,credit:l.credit||0});
    }));

  let running = openingBal;
  let rowsHtml = '';
  txns.forEach((e,i) => {
    running += e.debit - e.credit;
    const balStr = fmtN(Math.abs(running)) + (running>=0?' Dr':' Cr');
    rowsHtml += `<tr>
      <td>${i+1}</td><td>${e.date}</td><td style="font-family:monospace">${e.vchNo}</td>
      <td><span style="background:#e8f5e9;color:#0b6b4f;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600">${e.type}</span></td>
      <td>${e.narration||''}</td>
      <td style="text-align:right;color:#0b6b4f;font-weight:${e.debit?600:400}">${e.debit?fmtN(e.debit):''}</td>
      <td style="text-align:right;color:#c62828;font-weight:${e.credit?600:400}">${e.credit?fmtN(e.credit):''}</td>
      <td style="text-align:right;font-weight:600">${balStr}</td>
    </tr>`;
  });
  const totalDr = txns.reduce((s,e)=>s+e.debit,0);
  const totalCr = txns.reduce((s,e)=>s+e.credit,0);
  const closingBal = running;
  const accNames = accounts.map(a=>`${a.id}  ${a.name}`).join(', ');

  const html = `<!DOCTYPE html><html><head><title>Ledger: ${title}</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:20px 24px;color:#1a1a2e;background:#f8fafc}
  h1{font-size:17px;margin:0 0 2px;color:#0b6b4f}.sub{font-size:11.5px;color:#6b7280;margin-bottom:14px}
  .summary{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
  .sc{background:#fff;border-radius:8px;padding:11px 16px;box-shadow:0 1px 4px #0001;min-width:130px}
  .sl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
  .sv{font-size:17px;font-weight:700;color:#0b6b4f}
  table{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px #0001}
  th{background:#0b6b4f;color:#fff;padding:9px 11px;text-align:left;font-size:11.5px;font-weight:600;white-space:nowrap}
  td{padding:7px 11px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  tr:hover td{background:#f0fdf4}
  .total td{background:#f0fdf4;font-weight:700;border-top:2px solid #0b6b4f}
  .op td{background:#fafafa;color:#6b7280;font-style:italic}
  @media print{body{padding:0}button{display:none}.noprt{display:none}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
  <div>
    <h1>📒 Ledger: ${title}</h1>
    <div class="sub">${accNames} &nbsp;·&nbsp; Period: ${from||'Opening'} → ${to||'Date'}</div>
  </div>
  <button onclick="window.print()" style="padding:7px 16px;background:#0b6b4f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">⎙ Print / Save PDF</button>
</div>
<div class="summary">
  <div class="sc"><div class="sl">Opening Balance</div><div class="sv">${fmtN(Math.abs(openingBal))}<span style="font-size:12px;font-weight:400"> ${openingBal>=0?'Dr':'Cr'}</span></div></div>
  <div class="sc"><div class="sl">Period Debit</div><div class="sv">${fmtN(totalDr)}</div></div>
  <div class="sc"><div class="sl">Period Credit</div><div class="sv">${fmtN(totalCr)}</div></div>
  <div class="sc"><div class="sl">Closing Balance</div><div class="sv">${fmtN(Math.abs(closingBal))}<span style="font-size:12px;font-weight:400"> ${closingBal>=0?'Dr':'Cr'}</span></div></div>
</div>
<table>
  <thead><tr>
    <th style="width:38px">#</th><th style="width:86px">Date</th><th style="width:88px">Vch No.</th><th style="width:46px">Type</th>
    <th>Narration</th><th style="text-align:right;width:115px">Debit (₹)</th><th style="text-align:right;width:115px">Credit (₹)</th><th style="text-align:right;width:125px">Balance</th>
  </tr></thead>
  <tbody>
    <tr class="op"><td colspan="4" style="text-align:right">Opening Balance</td><td></td><td></td><td></td>
      <td style="text-align:right;font-weight:600">${fmtN(Math.abs(openingBal))} ${openingBal>=0?'Dr':'Cr'}</td></tr>
    ${rowsHtml||'<tr><td colspan="8" style="text-align:center;padding:20px;color:#9ca3af">No transactions in this period</td></tr>'}
    <tr class="total"><td colspan="4" style="text-align:right">TOTAL</td><td></td>
      <td style="text-align:right">${fmtN(totalDr)}</td>
      <td style="text-align:right">${fmtN(totalCr)}</td>
      <td style="text-align:right">${fmtN(Math.abs(closingBal))} ${closingBal>=0?'Dr':'Cr'}</td>
    </tr>
  </tbody>
</table>
<div style="margin-top:10px;font-size:10.5px;color:#9ca3af">Generated by MiyeeBooks · ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
</body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};
