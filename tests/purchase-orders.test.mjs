// The PO total is what gets posted to the vendor's account on conversion, so a
// wrong figure books the wrong liability. Pin the real poTotal (qty*rate + GST).
import { describe, it, assert } from './run.mjs';
import { loadApp } from './harness.mjs';
const { poTotal } = await loadApp();

describe('Purchase Order total (qty × rate + GST)', () => {
  it('sums line amounts plus per-line GST', () => {
    const po = { items:[
      { qty:10, rate:100, gstRate:18 },   // 1000 + 180 = 1180
      { qty:2,  rate:250, gstRate:12 },   //  500 +  60 =  560
    ]};
    assert.close(poTotal(po), 1740, 'two GST-bearing lines');
  });
  it('handles a zero-GST line', () => {
    assert.close(poTotal({ items:[{ qty:5, rate:100, gstRate:0 }] }), 500);
  });
  it('rounds to paise and treats missing fields as zero', () => {
    assert.close(poTotal({ items:[{ qty:3, rate:33.335, gstRate:18 }] }), 118.01, 'rounded to 2dp', 0.02);
    assert.equal(poTotal({ items:[{}] }), 0, 'empty line contributes nothing');
    assert.equal(poTotal({}), 0, 'no items -> zero');
  });
});
