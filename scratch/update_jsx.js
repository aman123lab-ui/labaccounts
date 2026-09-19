const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/incharge/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const original = fs.readFileSync(path.join(process.cwd(), 'scratch/original_modals.txt'), 'utf-8');
const replacement = fs.readFileSync(path.join(process.cwd(), 'scratch/replacement_jsx.txt'), 'utf-8');

// Replace CRLF to LF in content and search strings for matching
content = content.replace(/\r\n/g, '\n');
const originalNormalized = original.replace(/\r\n/g, '\n').trim();
const replacementNormalized = replacement.replace(/\r\n/g, '\n').trim();

if (content.includes(originalNormalized)) {
    content = content.replace(originalNormalized, replacementNormalized);
    console.log("JSX replaced successfully.");
    fs.writeFileSync(filePath, content, 'utf-8');
} else {
    console.log("JSX original string not found!");
}
