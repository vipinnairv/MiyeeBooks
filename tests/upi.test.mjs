// The UPI intent link is payment-critical: a wrong payee or amount sends money
// to the wrong place. Pin the real upiLink builder.
import { describe, it, assert } from './run.mjs';
import { loadApp } from './harness.mjs';

const { upiLink } = await loadApp();
const co = (upiId, name='Acme Traders') => ({ upiId, name });
const param = (url, k) => { const m = url.match(new RegExp('[?&]' + k + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : null; };

describe('UPI pay link builder', () => {
  it('returns empty string when no UPI ID is configured', () => {
    assert.equal(upiLink(co(''), 100, 'x'), '');
    assert.equal(upiLink({}, 100, 'x'), '');
  });

  it('encodes payee, name, amount and currency correctly', () => {
    const url = upiLink(co('acme@okhdfcbank'), 2499.5, 'Invoice S/42');
    assert.ok(url.startsWith('upi://pay?'), 'uses the UPI intent scheme');
    assert.equal(param(url, 'pa'), 'acme@okhdfcbank', 'payee address');
    assert.equal(param(url, 'pn'), 'Acme Traders', 'payee name');
    assert.equal(param(url, 'cu'), 'INR', 'currency INR');
    assert.equal(param(url, 'am'), '2499.5', 'amount preserved');
    assert.equal(param(url, 'tn'), 'Invoice S/42', 'note preserved');
  });

  it('rounds amount to paise and omits it when zero', () => {
    assert.equal(param(upiLink(co('a@b'), 10.008, 'x'), 'am'), '10.01', 'rounded to 2dp');
    assert.equal(param(upiLink(co('a@b'), 0, 'x'), 'am'), null, 'no amount when zero');
  });

  it('percent-encodes a payee that contains reserved characters', () => {
    const url = upiLink(co('a b&c@x'), 5, 'n');
    assert.equal(param(url, 'pa'), 'a b&c@x', 'reserved chars round-trip safely');
  });
});
