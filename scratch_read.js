const fs = require('fs');
const buf = fs.readFileSync('js/admin.js');
console.log('Length:', buf.length);
console.log('Is UTF-16LE?', buf[0] === 0xff && buf[1] === 0xfe);
console.log('Is UTF-16BE?', buf[0] === 0xfe && buf[1] === 0xff);
console.log('First 20 bytes:', Array.from(buf.slice(0, 20)).map(b => b.toString(16)));
console.log('First 100 chars as UTF-8:', buf.slice(0, 100).toString('utf8'));
console.log('First 100 chars as UTF-16LE:', buf.slice(0, 100).toString('utf16le'));
