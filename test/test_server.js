const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PORT = 8124;
const BASE_DIR = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
  let filePath = path.join(BASE_DIR, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      const ext = path.extname(filePath);
      const mime = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
});

server.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}...`);
  try {
    const urls = [
      '/',
      '/app.css',
      '/js/rules.js',
      '/js/strategy.js',
      '/js/assembly.js',
      '/js/db.js',
      '/js/analysis.js',
  '/js/local-extract.js',
      '/js/app.js',
      '/test-documents/TEST_Will_Draft_Sam_Whitfield.txt'
    ];

    for (const u of urls) {
      const resp = await fetch(`http://localhost:${PORT}${u}`);
      assert.strictEqual(resp.status, 200, `URL ${u} must return 200 OK`);
      const body = await resp.text();
      assert(body.length > 50, `URL ${u} body must not be empty`);
      console.log(`✓ GET ${u} -> 200 OK (${body.length} bytes)`);
    }

    console.log('\nAll web asset routes verified successfully!');
  } catch (err) {
    console.error('Server test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
