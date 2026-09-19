const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/incharge/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Remove BOM and any  character
content = content.replace(/\uFEFF/g, '');
content = content.replace(//g, '');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully stripped BOM.');
