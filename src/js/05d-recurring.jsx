// ============================================================================
// RECURRING DOCUMENTS  raise themselves on schedule, then wait for approval.
// ----------------------------------------------------------------------------
// A voucher flagged `recurringMonthly` used to only prompt the dashboard - the
// user still had to re-enter rent, EMIs, retainers and subscriptions by hand
// every month. Now each due month is generated automatically as a fresh copy,
// dated to the source's day-of-month, and left as a DRAFT (or Pending, under
// maker-checker) so nothing posts to the ledger without a human approving it.
//
// The function is pure and idempotent: a generated copy carries `recurredFrom`
// + `recurMonth`, so re-running never creates a duplicate for a month that
// already has one. That property is what makes it safe to run on every load.
// ============================================================================

const RECUR_MONTHS_BACK = 12;   // never back-fill more than a year on first run

// YYYY-MM for a date string / Date
const recurMonthKey = (d) => String(d).slice(0, 7);
const recurAddMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, (m - 1) + n, 1);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
};
// Same day-of-month as the source, clamped to the target month's length.
const recurDateFor = (ym, sourceDate) => {
  const [y, m] = ym.split('-').map(Number);
  const day = parseInt(String(sourceDate).slice(8, 10)) || 1;
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2,'0')}-${String(Math.min(day, last)).padStart(2,'0')}`;
};

// Returns { data, created } - `data` unchanged (same reference) when nothing was
// due, so callers can skip a needless re-render.
function generateRecurring(data, asOf){
  if(!data || !Array.isArray(data.vouchers)) return { data, created: 0 };
  const asOfMonth = recurMonthKey(asOf || today());

  // Which (sourceId, month) copies already exist, so we never double-post.
  const have = new Set();
  data.vouchers.forEach(v => { if(v.recurredFrom && v.recurMonth) have.add(v.recurredFrom + '|' + v.recurMonth); });

  const sources = data.vouchers.filter(v =>
    v.recurringMonthly && v.status !== 'Cancelled' && !v.recurredFrom);   // a copy is never itself a source

  const makerChecker = data.company && data.company.makerChecker === true;
  const newStatus = makerChecker ? 'Pending' : 'Draft';
  const additions = [];
  let working = data;   // becomes a mutable clone only once we actually add something

  for(const src of sources){
    const startMonth = recurMonthKey(src.recurStartMonth || src.date);
    // Begin the month AFTER the source itself; back-fill is bounded.
    const earliest  = recurAddMonths(asOfMonth, -RECUR_MONTHS_BACK);
    let cursor = recurAddMonths(startMonth, 1);
    if(cursor < earliest) cursor = earliest;

    while(cursor <= asOfMonth){
      const key = src.id + '|' + cursor;
      if(!have.has(key)){
        if(working === data) working = { ...data, vouchers: [...data.vouchers] };
        const copy = {
          ...src,
          id: uid(),
          number: nextVoucherNumber(working, src.type),
          date: recurDateFor(cursor, src.date),
          status: newStatus,
          recurringMonthly: false,      // the copy is not itself recurring
          recurredFrom: src.id,
          recurMonth: cursor,
          attachments: [],              // evidence belongs to the original
          irn: '', ackNo: '', ackDate: '', billTags: [],
          lines: (src.lines || []).map(l => ({ ...l, id: uid() })),
          createdAt: new Date().toISOString(),
        };
        working.vouchers.push(copy);
        have.add(key);
        additions.push(copy);
      }
      cursor = recurAddMonths(cursor, 1);
    }
  }

  if(!additions.length) return { data, created: 0 };
  working.auditLog = [...(data.auditLog || []),
    auditEntry('RECURRING', `${additions.length} recurring ${additions.length===1?'entry':'entries'} generated (${newStatus}) - awaiting review`)];
  return { data: working, created: additions.length };
}
