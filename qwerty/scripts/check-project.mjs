import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const pass = (message) => console.log(`PASS  ${message}`);
const fail = (message) => failures.push(message);
const exists = (file) => fs.existsSync(path.join(root, file));

for (const file of ['index.html', 'style.css', 'script.js', 'public-content.js', 'vercel.json', 'firebase.json', '.firebaserc', 'admin/admin.html', 'admin/admin.css', 'admin/admin.js', 'admin/firebase-config.js', 'admin/firestore.rules', 'admin/storage.rules']) {
  if (!exists(file)) fail(`Missing required file: ${file}`);
  else pass(`Found ${file}`);
}

for (const file of ['vercel.json', 'firebase.json', '.firebaserc', 'package.json']) {
  if (!exists(file)) continue;
  try { JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); pass(`Valid JSON: ${file}`); }
  catch (error) { fail(`Invalid JSON in ${file}: ${error.message}`); }
}

for (const file of ['script.js', 'public-content.js', 'admin/admin.js', 'admin/firebase-config.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JavaScript syntax error in ${file}: ${(result.stderr || result.stdout).trim()}`);
  else pass(`JavaScript syntax: ${file}`);
}

function inspectHtml(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) fail(`${file} has duplicate IDs: ${[...new Set(duplicates)].join(', ')}`);
  else pass(`No duplicate IDs: ${file}`);

  const knownIds = new Set(ids);
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1].trim();
    if (!value || (file === 'admin/admin.html' && value === '/admin/')) continue;
    if (/^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(value)) continue;
    if (value.startsWith('#')) {
      const target = value.slice(1);
      if (target && !knownIds.has(target)) fail(`${file} links to missing anchor #${target}`);
      continue;
    }
    const clean = value.split(/[?#]/, 1)[0];
    if (!clean) continue;
    let target;
    if (file === 'admin/admin.html') {
      // admin.html declares <base href="/admin/">, so its relative assets resolve from /admin/.
      target = path.posix.normalize(path.posix.join('admin', clean));
    } else {
      target = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
    }
    if (target.startsWith('../') || !exists(target)) fail(`${file} references missing local asset: ${value} (resolved ${target})`);
  }
}

inspectHtml('index.html');
inspectHtml('admin/admin.html');

const publicIds = new Set([...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]));
for (const page of ['home', 'about', 'president', 'cabinet', 'events', 'gallery', 'alumni', 'contact']) {
  if (!publicIds.has(`page-${page}`)) fail(`Missing public page wrapper: page-${page}`);
}

for (let i = 1; i <= 17; i++) {
  const file = `image${i}.jpeg`;
  if (!exists(file)) fail(`Missing original cabinet photo: ${file}`);
}

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
if (!vercel.rewrites?.some(rule => rule.source === '/admin' && rule.destination === '/admin/admin.html')) fail('Vercel /admin rewrite is missing');
else pass('Vercel /admin rewrite configured');

const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
if (firebase.firestore?.rules !== 'admin/firestore.rules' || firebase.storage?.rules !== 'admin/storage.rules') fail('Firebase rules paths do not match firebase.json');
else pass('Firebase rules are wired to Firebase CLI config');
const projectRef = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')).projects?.default;
const configSource = fs.readFileSync(path.join(root, 'admin/firebase-config.js'), 'utf8');
const configuredProject = configSource.match(/projectId:\s*['"]([^'"]+)['"]/);
if (!projectRef || !configuredProject || projectRef !== configuredProject[1]) fail('Firebase project ID does not match between .firebaserc and firebase-config.js');
else pass('Firebase project ID matches web configuration');

if (failures.length) {
  console.error(`\n${failures.length} CHECK(S) FAILED:`);
  for (const item of failures) console.error(`FAIL  ${item}`);
  process.exitCode = 1;
} else {
  console.log('\nAll project integrity checks passed.');
}
