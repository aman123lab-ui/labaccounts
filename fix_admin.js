const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'admin.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original content length:', content.length);

// 1. Fix the commented out function declaration on line 1455
const targetRegex = /\/\/ ── Print window ──+.*window\.generateYearlyReport/;
if (targetRegex.test(content)) {
  content = content.replace(targetRegex, '// ── Print window ───────────────────────────────────────────\n  window.generateYearlyReport');
  console.log('Fixed line 1455 function declaration.');
} else {
  console.log('Could not match target regex for line 1455.');
}

// 2. Truncate the duplicate/corrupted section starting from the first "// ── Init"
const initMarker = '// ── Init ─────────────────────────────────────────────────';
const markerIndex = content.indexOf(initMarker);
if (markerIndex !== -1) {
  content = content.slice(0, markerIndex) + initMarker + '\nloadDashboard();\n';
  console.log('Truncated duplicate code and appended clean init block.');
} else {
  console.log('Could not find the "// ── Init" marker in the file.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed js/admin.js written. New length:', content.length);
