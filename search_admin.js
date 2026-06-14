const fs = require('fs');
const content = fs.readFileSync('js/admin.js', 'utf8');

// Check for any obvious syntax issues or truncation
const lines = content.split('\n');
console.log('Total lines:', lines.length);

// Print the last 40 lines
console.log('--- Last 40 lines ---');
console.log(lines.slice(-40).join('\n'));

// Search for functions
const matches = [];
lines.forEach((line, index) => {
  if (line.includes('function') || line.includes('=>') || line.includes('loadDashboard')) {
    matches.push(`${index + 1}: ${line.trim()}`);
  }
});
console.log('--- Matches (first 30) ---');
console.log(matches.slice(0, 30).join('\n'));
