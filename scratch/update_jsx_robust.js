const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/incharge/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
const replacement = fs.readFileSync(path.join(process.cwd(), 'scratch/replacement_jsx.txt'), 'utf-8');

const startMarker = '{isDebitModalOpen && (';
const endMarker = '{/* MODAL 3: HAND OVER CASH TO ADMIN */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    // We want to replace everything from the line containing startMarker to the line BEFORE endMarker.
    // Let's just do a string substring replacement.
    
    // find the start of the line containing startMarker
    const lineStart = content.lastIndexOf('\n', startIndex);
    
    const newContent = content.substring(0, lineStart + 1) + 
                       replacement + '\n\n        ' +
                       content.substring(endIndex);
                       
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log('Successfully replaced JSX block.');
} else {
    console.log('Could not find markers: ', startIndex, endIndex);
}
