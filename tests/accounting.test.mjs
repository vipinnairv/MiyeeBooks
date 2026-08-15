// Golden-ledger + invariant tests against the REAL accounting functions.
// A double-entry book has one inviolable property: every voucher balances, so
// across the whole book total debits equal total credits and the trial balance
// tallies to zero. These tests build real books and assert exactly that through
// computePeriodBals - the same function every statement in the app is built on.
import { describe, it, assert } from './run.mjs';
import { loadApp } from './harness.mjs';

const app = await loadApp();
const { computePeriodBals, affectsLedger, estimateTax, companyTaxRate } = app;

// A small, deterministic book with a CLEAN zero-opening chart of accounts and a
// set of balanced vouchers spanning two financial years, so opening/period
// splitting is exercised without seed-data noise. Every voucher balances, so
// the whole book must tally to zero.
function goldenBook(){
  const coaIds = ['2400','3100','1310','1311','5100','2510'];
  const d = { company:{ taxRate:25 }, coa: coaIds.map(id => ({ id, opening:0 })), auditLog:[], vouchers:[] };
  const V = (id, date, lines, status='Posted') => ({ id, date, status, lines });
  d.vouchers = [
    // FY 2025-26 (prior year)
    V('v1','2025-06-10',[{accountId:'2400',debit:118000,credit:0},{accountId:'3100',debit:0,credit:100000},{accountId:'1310',debit:0,credit:9000},{accountId:'1311',debit:0,credit:9000}]),
    V('v2','2025-09-01',[{accountId:'5100',debit:40000,credit:0},{accountId:'2510',debit:0,credit:40000}]),
    // FY 2026-27 (current year)
    V('v3','2026-05-15',[{accountId:'2400',debit:236000,credit:0},{accountId:'3100',debit:0,credit:200000},{accountId:'1310',debit:0,credit:18000},{accountId:'1311',debit:0,credit:18000}]),
    V('v4','2026-06-20',[{accountId:'2510',debit:118000,credit:0},{accountId:'2400',debit:0,credit:118000}]),
    // A cancelled voucher that must NOT affect any balance
    V('vX','2026-07-01',[{accountId:'2400',debit:999999,credit:0},{accountId:'3100',debit:0,credit:999999}],'Cancelled'),
  ];
  return d;
}

const totalOf = (map) => Object.values(map).reduce((s, v) => s + v, 0);

describe('Double-entry invariants (real computePeriodBals)', () => {
  it('trial balance tallies to zero across the whole book', () => {
    const d = goldenBook();
    const { asOn } = computePeriodBals(d);
    assert.close(totalOf(asOn), 0, 'sum of all ledger balances must be zero', 0.005);
  });

  it('opening + period reconstructs the closing balance for every account', () => {
    const d = goldenBook();
    const { opening, period, asOn } = computePeriodBals(d, '2026-04-01', '2027-03-31');
    for(const id of Object.keys(asOn)){
      assert.close((opening[id]||0) + (period[id]||0), asOn[id], 'reconstruct ' + id, 0.005);
    }
  });

  it('prior-year entries land in opening, current-year in period', () => {
    const d = goldenBook();
    // Debtors 2400: prior FY net = 118000 - (nothing) ; current FY = 236000 - 118000
    const { opening, period } = computePeriodBals(d, '2026-04-01', '2027-03-31');
    assert.close(opening['2400'], 118000, 'debtors opening = prior-year sales');
    assert.close(period['2400'], 236000 - 118000, 'debtors period = current-year movement');
  });

  it('a cancelled voucher affects no balance', () => {
    const d = goldenBook();
    const withCancel = computePeriodBals(d).asOn;
    const withoutCancel = computePeriodBals({ ...d, vouchers: d.vouchers.filter(v => v.id !== 'vX') }).asOn;
    for(const id of new Set([...Object.keys(withCancel), ...Object.keys(withoutCancel)])){
      assert.close(withCancel[id]||0, withoutCancel[id]||0, 'cancelled must not move ' + id);
    }
  });

  it('affectsLedger excludes Cancelled/Pending/Rejected/Draft, includes Posted', () => {
    assert.equal(affectsLedger({status:'Posted'}), true, 'Posted counts');
    assert.equal(affectsLedger({status:'Cancelled'}), false, 'Cancelled excluded');
    assert.equal(affectsLedger({status:'Pending'}), false, 'Pending excluded');
    assert.equal(affectsLedger({status:'Rejected'}), false, 'Rejected excluded');
    assert.equal(affectsLedger({}), true, 'legacy no-status counts');
  });
});

describe('Tax provision consistency', () => {
  it('tax is levied on profit and never on a loss', () => {
    assert.close(estimateTax(1000000, 25), 250000, 'profit taxed');
    assert.equal(estimateTax(-50000, 25), 0, 'loss untaxed');
    assert.equal(estimateTax(0, 25), 0, 'zero PBT untaxed');
  });
  it('company tax rate defaults to 25% but honours an override, including 0', () => {
    assert.equal(companyTaxRate({company:{}}), 25, 'default 25%');
    assert.equal(companyTaxRate({company:{taxRate:22}}), 22, 'override honoured');
    assert.equal(companyTaxRate({company:{taxRate:0}}), 0, 'zero is a real rate, not falsy default');
  });
});
