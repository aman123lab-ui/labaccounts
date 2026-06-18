import fs from 'fs';
import path from 'path';

const FILES = {
  index: 'index.html',
  debtors: 'debtors.html',
};

export default function handler(req, res) {
  const { file } = req.query;
  const filename = FILES[file];

  if (!filename) {
    return res.status(404).send('Not found');
  }

  const filePath = path.join(process.cwd(), filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`File not found: ${filename}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Fix relative CSS/JS paths to use absolute paths
  const fixed = content
    .replace(/href="css\//g, 'href="/css/')
    .replace(/src="js\//g, 'src="/js/')
    .replace(/href="login\.html"/g, 'href="/login"')
    .replace(/href="student\.html"/g, 'href="/student"')
    .replace(/href="register\.html"/g, 'href="/register"')
    .replace(/href="index\.html"/g, 'href="/admin"');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(fixed);
}
