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

// Copy and process index.html → public/admin-shell.html
let indexContent = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
indexContent = indexContent
  .replace(/href="css\//g, 'href="/css/')
  .replace(/src="js\//g, 'src="/js/')
  .replace(/href="login\.html"/g, 'href="/login"')
  .replace(/href="student\.html"/g, 'href="/student"')
  .replace(/href="register\.html"/g, 'href="/register"')
  .replace(/href="index\.html"/g, 'href="/admin"');
fs.writeFileSync(path.join(pub, 'admin-shell.html'), indexContent);
console.log('✅ Copied and processed index.html → public/admin-shell.html');

// Copy and process debtors.html → public/debtors-shell.html
let debtorsContent = fs.readFileSync(path.join(root, 'debtors.html'), 'utf8');
debtorsContent = debtorsContent
  .replace(/href="css\//g, 'href="/css/')
  .replace(/src="js\//g, 'src="/js/')
  .replace(/href="login\.html"/g, 'href="/login"')
  .replace(/href="student\.html"/g, 'href="/student"')
  .replace(/href="register\.html"/g, 'href="/register"')
  .replace(/href="index\.html"/g, 'href="/admin"');
fs.writeFileSync(path.join(pub, 'debtors-shell.html'), debtorsContent);
console.log('✅ Copied and processed debtors.html → public/debtors-shell.html');

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
