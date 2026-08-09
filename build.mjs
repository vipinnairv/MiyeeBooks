// MiyeeBooks build - pre-compiles the JSX modules in src/js/ into plain JS in
// dist/js/ using esbuild, so the browser never compiles anything at runtime
// (no esbuild-wasm, no Babel fallback). Copies styles + assets and generates
// dist/index.html by injecting the ordered <script> tags into src/index.html.
//
//   node build.mjs            one-off build
//   node build.mjs --watch    rebuild on change (local dev)
import { transform } from 'esbuild';
import {
  readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync, existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root    = dirname(fileURLToPath(import.meta.url));
const srcDir  = join(root, 'src');
const jsDir   = join(srcDir, 'js');
const distDir = join(root, 'dist');
const distJs  = join(distDir, 'js');

// esbuild JSX settings - must match the classic-script, shared-global-scope
// model the app relies on. NO module/iife wrapper (format left default) so
// top-level `const`/`function` stay in the shared global lexical environment,
// letting modules reference each other exactly as they did in the single file.
const JSX = {
  loader: 'jsx',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: 'es2019',
  // Shrink output but NEVER rename identifiers - cross-module references are to
  // top-level names shared across scripts, so identifier mangling would break them.
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
};

function moduleFiles() {
  return readdirSync(jsDir)
    .filter(f => f.endsWith('.jsx'))
    .sort();                                   // 01-… 02-… numeric prefix = load order
}

async function buildOnce() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distJs, { recursive: true });

  const files = moduleFiles();
  const tags = [];
  for (const f of files) {
    const src = readFileSync(join(jsDir, f), 'utf8');
    const out = await transform(src, { ...JSX, sourcefile: f });
    if (out.warnings.length) {
      for (const w of out.warnings) console.warn(`[warn] ${f}: ${w.text}`);
    }
    const outName = f.replace(/\.jsx$/, '.js');
    writeFileSync(join(distJs, outName), out.code);
    tags.push(`<script src="js/${outName}"></script>`);
  }

  // index.html - inject ordered script tags
  const shell = readFileSync(join(srcDir, 'index.html'), 'utf8');
  if (!shell.includes('<!--APP_SCRIPTS-->')) {
    throw new Error('src/index.html is missing the <!--APP_SCRIPTS--> placeholder');
  }
  writeFileSync(join(distDir, 'index.html'), shell.replace('<!--APP_SCRIPTS-->', tags.join('\n')));

  // .nojekyll - tell GitHub Pages to serve the files as-is (no Jekyll pass)
  writeFileSync(join(distDir, '.nojekyll'), '');

  // styles + static assets
  copyFileSync(join(srcDir, 'styles.css'), join(distDir, 'styles.css'));
  for (const asset of ['og-image.svg']) {
    if (existsSync(join(root, asset))) copyFileSync(join(root, asset), join(distDir, asset));
  }

  console.log(`Built ${files.length} module(s) → dist/  (${tags.length} scripts)`);
}

// esbuild's context API drives --watch; the manual transform loop above handles
// the one-shot case. For watch we lean on a tiny fs poll to keep deps minimal.
if (process.argv.includes('--watch')) {
  const { watch } = await import('node:fs');
  await buildOnce();
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildOnce().catch(e => console.error(e.message)), 100);
  };
  watch(jsDir, rebuild);
  watch(srcDir, rebuild);
  console.log('Watching src/ for changes…');
} else {
  await buildOnce();
}
