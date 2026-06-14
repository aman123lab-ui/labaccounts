const fs = require('fs');
const content = fs.readFileSync('js/admin.js', 'utf8');
const lines = content.split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('async function loadDashboard')) {
    start = i;
    break;
  }
}

if (start !== -1) {
  // find matching brace
  let braceCount = 0;
  let started = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    for (let c of line) {
      if (c === '{') {
        braceCount++;
        started = true;
      } else if (c === '}') {
        braceCount--;
      }
    }
    if (started && braceCount === 0) {
      end = i;
      break;
    }
  }
}

if (start !== -1 && end !== -1) {
  console.log(`Lines ${start + 1} to ${end + 1}:`);
  console.log(lines.slice(start, end + 1).join('\n'));
} else {
  console.log('Function loadDashboard not found or braces unmatched');
  console.log('Start:', start, 'End:', end);
}
