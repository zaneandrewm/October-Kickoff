// Tiny dependency-free server.
// - Serves index.html for normal page requests.
// - Keeps the game leaderboard: GET /api/scores returns the top 10, POST /api/scores adds a score.
//   Scores are kept in memory and saved to a small file, so they survive normal use but can reset if
//   the app is redeployed or restarted.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = process.env.PORT || 3000;
const file = path.join(__dirname, 'index.html');
const dataFile = path.join(process.env.DATA_DIR || os.tmpdir(), 'fall-summit-scores.json');

let scores = {};
try { scores = JSON.parse(fs.readFileSync(dataFile, 'utf8')) || {}; } catch (e) { scores = {}; }
function save() { try { fs.writeFileSync(dataFile, JSON.stringify(scores)); } catch (e) { /* keep going in memory */ } }
function top() { return Object.values(scores).sort((a, b) => b.score - a.score).slice(0, 10); }

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/scores' && req.method === 'GET') return json(res, 200, top());

    if (url === '/api/scores' && req.method === 'POST') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (limited(ip)) return json(res, 429, { ok: false, error: 'slow down' });
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2000) req.destroy();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          const name = String(data.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
          const score = Math.floor(Number(data.score));
          if (!name || !isFinite(score) || score < 1 || score > 100000) return json(res, 400, { ok: false, error: 'bad score' });
          const key = name.toLowerCase();
          if (!scores[key] || score > scores[key].score) {
            scores[key] = { name, score };
            save();
          }
          return json(res, 200, top());
        } catch (e) {
          return json(res, 400, { ok: false, error: 'bad request' });
        }
      });
      return;
    }

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
  .listen(port, '0.0.0.0', () => console.log('Fall Summit page listening on ' + port));
