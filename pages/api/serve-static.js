import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
  css: 'text/css',
  js: 'application/javascript',
};

const EXTENSIONS = {
  css: '.css',
  js: '.js',
};

export default function handler(req, res) {
  const { type, file } = req.query;

  if (!MIME_TYPES[type]) {
    return res.status(400).send('Invalid type');
  }

  // file can be an array when using :file* catch-all
  const fileParts = Array.isArray(file) ? file : [file];
  const filePath = path.join(process.cwd(), type, ...fileParts);

  // Security: ensure we stay within the project directory
  const projectRoot = process.cwd();
  if (!filePath.startsWith(projectRoot)) {
    return res.status(403).send('Forbidden');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  res.setHeader('Content-Type', MIME_TYPES[type]);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(content);
}
