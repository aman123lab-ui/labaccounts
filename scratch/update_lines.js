const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/incharge/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const replacement = fs.readFileSync(path.join(process.cwd(), 'scratch/replacement_jsx.txt'), 'utf-8');

// lines 0 to 1769 are before line 1771 (1-indexed)
const before = lines.slice(0, 1770);
// lines 2219 to end are after line 2219
const after = lines.slice(2219);

const newContent = before.join('\n') + '\n' + replacement + '\n' + after.join('\n');

fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('Successfully replaced lines by index.');
