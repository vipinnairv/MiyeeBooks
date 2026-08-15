// Zero-dependency test runner. Collects describe/it blocks, runs them, prints a
// summary, exits non-zero on any failure so CI blocks the deploy. No framework
// is pulled in - the project's only devDependency is esbuild, and it stays that
// way.
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

let suite = '';
const results = [];
export function describe(name, fn){ suite = name; return fn(); }
export function it(name, fn){ results.push({ suite, name, fn }); }

// Assertions
const near = (a, b, eps=0.005) => Math.abs(a - b) <= eps;
export const assert = {
  ok(v, msg){ if(!v) throw new Error(msg || 'expected truthy, got ' + v); },
  equal(a, b, msg){ if(a !== b) throw new Error((msg||'not equal') + `  (${a} !== ${b})`); },
  close(a, b, msg, eps){ if(!near(a, b, eps)) throw new Error((msg||'not close') + `  (${a} vs ${b})`); },
  throws(fn, msg){ let t=false; try { fn(); } catch(_){ t=true; } if(!t) throw new Error(msg||'expected throw'); },
};

const dir = dirname(fileURLToPath(import.meta.url));

async function main(){
  const files = readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort();
  for(const f of files) await import(pathToFileURL(join(dir, f)).href);

  let pass = 0, fail = 0, lastSuite = '';
  for(const r of results){
    if(r.suite !== lastSuite){ console.log('\n\x1b[1m' + r.suite + '\x1b[0m'); lastSuite = r.suite; }
    try {
      await r.fn();
      pass++; console.log('  \x1b[32m✓\x1b[0m ' + r.name);
    } catch(e){
      fail++; console.log('  \x1b[31m✗ ' + r.name + '\x1b[0m\n      ' + (e.message||e));
    }
  }
  console.log(`\n${pass} passed, ${fail} failed, ${results.length} total`);
  process.exit(fail ? 1 : 0);
}
main();
