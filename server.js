// Tiny dependency-free server: serves index.html for every request.
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const file = path.join(__dirname, 'index.html');

http
  .createServer((req, res) => {
    fs.readFile(file, (err, html) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Could not load index.html');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(html);
    });
  })
  .listen(port, '0.0.0.0', () => console.log('October kickoff page listening on ' + port));
