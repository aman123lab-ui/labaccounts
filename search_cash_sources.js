const fs = require('fs');
const content = fs.readFileSync('js/admin.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('_CASH_SOURCES')) {
    console.log(`${index + 1}: ${line}`);
  }
});
