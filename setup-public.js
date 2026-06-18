#!/usr/bin/env node
/**
 * setup-public.js
 * Run once with: node setup-public.js
 * Copies static assets to the /public directory for Next.js serving.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const pub = path.join(root, 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// Copy index.html → public/admin-shell.html
fs.copyFileSync(path.join(root, 'index.html'), path.join(pub, 'admin-shell.html'));
console.log('✅ Copied index.html → public/admin-shell.html');

// Copy debtors.html → public/debtors-shell.html
fs.copyFileSync(path.join(root, 'debtors.html'), path.join(pub, 'debtors-shell.html'));
console.log('✅ Copied debtors.html → public/debtors-shell.html');

// Copy css/ → public/css/
copyDir(path.join(root, 'css'), path.join(pub, 'css'));
console.log('✅ Copied css/ → public/css/');

// Copy js/ → public/js/
copyDir(path.join(root, 'js'), path.join(pub, 'js'));
console.log('✅ Copied js/ → public/js/');

// Copy manifest.json and sw.js if they exist
['manifest.json', 'sw.js'].forEach(file => {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(pub, file));
    console.log(`✅ Copied ${file} → public/${file}`);
  }
});

console.log('\n✨ Public folder setup complete!');
