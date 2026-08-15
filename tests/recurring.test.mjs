// Recurring auto-generation runs on every load, so its most important property
// is idempotency: it must fill in the months that are due and NEVER create a
// duplicate for a month it already generated. It must also never post straight
// to the ledger. Pinned against the real generateRecurring.
import { describe, it, assert } from './run.mjs';
import { loadApp } from './harness.mjs';

const { generateRecurring } = await loadApp();

const baseData = (over={}) => ({
  company: { makerChecker:false }, coa:[], auditLog:[], parties:[],
  vouchers: [{
    id:'rent', type:'PAY', date:'2026-01-05', number:'PAY/1', status:'Posted',
    narration:'Office rent', amount:50000, recurringMonthly:true,
    lines:[{id:'a',accountId:'5100',debit:50000,credit:0},{id:'b',accountId:'2510',debit:0,credit:50000}],
  }],
  ...over,
});

const copies = (d) => d.vouchers.filter(v => v.recurredFrom === 'rent');
const monthsOf = (d) => copies(d).map(v => v.recurMonth).sort();

describe('Recurring documents auto-generate as drafts', () => {
  it('fills every month from the source up to the as-of month', () => {
    const { data, created } = generateRecurring(baseData(), '2026-05-20');
    // source is Jan; copies for Feb, Mar, Apr, May
    assert.equal(created, 4, 'four months due');
    assert.deepEqual ? assert.deepEqual(monthsOf(data), ['2026-02','2026-03','2026-04','2026-05'])
      : assert.equal(monthsOf(data).join(','), '2026-02,2026-03,2026-04,2026-05');
  });

  it('is idempotent — a second run creates nothing and returns the same data', () => {
    const first = generateRecurring(baseData(), '2026-05-20');
    const second = generateRecurring(first.data, '2026-05-20');
    assert.equal(second.created, 0, 'no duplicates on re-run');
    assert.equal(second.data, first.data, 'unchanged data returned by identity');
  });

  it('only advances when a new month arrives', () => {
    const may = generateRecurring(baseData(), '2026-05-20').data;
    const jun = generateRecurring(may, '2026-06-10');
    assert.equal(jun.created, 1, 'exactly one new month');
    assert.equal(copies(jun.data).find(v => v.recurMonth === '2026-06').recurMonth, '2026-06');
  });

  it('never posts to the ledger — copies are Draft (or Pending under maker-checker)', () => {
    const draft = generateRecurring(baseData(), '2026-03-10').data;
    assert.ok(copies(draft).every(v => v.status === 'Draft'), 'plain company -> Draft');
    const mc = generateRecurring(baseData({ company:{ makerChecker:true } }), '2026-03-10').data;
    assert.ok(copies(mc).every(v => v.status === 'Pending'), 'maker-checker -> Pending');
  });

  it('clamps the day-of-month to short months (31st -> 28/30)', () => {
    const d = baseData(); d.vouchers[0].date = '2026-01-31';
    const gen = generateRecurring(d, '2026-04-10').data;
    const feb = copies(gen).find(v => v.recurMonth === '2026-02');
    assert.equal(feb.date, '2026-02-28', 'Feb clamped to 28');
    const apr = copies(gen).find(v => v.recurMonth === '2026-04');
    assert.equal(apr.date, '2026-04-30', 'Apr clamped to 30');
  });

  it('copies carry fresh identity and drop one-time evidence', () => {
    const d = baseData();
    d.vouchers[0].attachments = [{ id:'x', name:'bill.pdf' }];
    d.vouchers[0].irn = 'ABC123';
    const c = copies(generateRecurring(d, '2026-02-10').data)[0];
    assert.ok(c.id !== 'rent', 'new id');
    assert.equal(c.attachments.length, 0, 'no carried attachments');
    assert.equal(c.irn, '', 'no carried IRN');
    assert.equal(c.recurringMonthly, false, 'a copy is not itself recurring');
  });
});
