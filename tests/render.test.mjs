// Regression guard for render-time crashes. The App component body runs a long
// list of hooks; a value used in an effect's dependency array before its `const`
// is declared throws "Cannot access X before initialization" the moment React
// renders - invisible to tests that never invoke the component. So here we
// actually call App() (with stub hooks from the harness) for each entry role and
// assert it does not throw. This is the exact class of bug that white-screened
// the live app once.
import { describe, it, assert } from './run.mjs';
import { loadApp } from './harness.mjs';
const { App } = await loadApp();

const callApp = (props) => { App(props); };   // throws on a TDZ / render error

describe('App renders without a temporal-dead-zone crash', () => {
  it('owner session', () => { callApp({ userRole:'owner' }); assert.ok(true); });
  it('viewer session', () => { callApp({ userRole:'viewer' }); assert.ok(true); });
  it('employee portal session', () => { callApp({ userRole:'employee', user:{ email:'e@x.com' } }); assert.ok(true); });
  it('shared company (ownerId differs from user)', () => {
    callApp({ userRole:'owner', user:{ uid:'u1', email:'a@x.com' }, ownerId:'owner9', companyId:'c1' });
    assert.ok(true);
  });
});
