import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Chrome's Private Network Access asks before a public site (e.g. a console-pasted collector) may call localhost.
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) res.set('Access-Control-Allow-Private-Network', 'true');
  next();
});
app.use(cors());
app.use(express.json({ limit: '20mb' }));
// The collector posts text/plain so browsers skip the CORS preflight (and sendBeacon works).
app.use(express.text({ type: 'text/plain', limit: '5mb' }));

// Script tag for websites: <script async src="https://<this host>/collector.js"></script>
app.get('/collector.js', (req, res) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, 'collector', 'collector.js'));
});

// datasets/*.json are saved snapshots; datasets/live/events.json holds events pushed to /api/events.
function datasetsDir() {
  const dir = path.join(__dirname, 'datasets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const LIVE_PATH = path.join(datasetsDir(), 'live', 'events.json');

function readLive() {
  if (!fs.existsSync(LIVE_PATH)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(LIVE_PATH, 'utf-8'));
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

function writeLive(events) {
  fs.mkdirSync(path.dirname(LIVE_PATH), { recursive: true });
  fs.writeFileSync(LIVE_PATH, JSON.stringify(events, null, 2), 'utf-8');
}

function writeSnapshot(data, name) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = (name || 'snapshot').replace(/[^a-z0-9-_]/gi, '_');
  const file = `${ts}_${safeName}.json`;
  const out = path.join(datasetsDir(), file);
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf-8');
  return { id: file, path: out, count: data.length };
}

// Accepts an array, {data: [...]}, {events: [...]}, a single event object, or a JSON string of any of those.
function eventsFromBody(body) {
  let incoming = body;
  if (typeof incoming === 'string') {
    try { incoming = JSON.parse(incoming); } catch { return null; }
  }
  if (Array.isArray(incoming)) return incoming;
  if (incoming && typeof incoming === 'object') {
    if (Array.isArray(incoming.data)) return incoming.data;
    if (Array.isArray(incoming.events)) return incoming.events;
    if (Object.keys(incoming).length) return [incoming];
  }
  return null;
}

// ---- Live event collection ----

app.get('/api/events', (req, res) => res.json(readLive()));

// Lightweight summary for polling from the UI.
app.get('/api/events/stats', (req, res) => {
  const events = readLive();
  const last = events[events.length - 1];
  const sites = [...new Set(events.map(e => e?.site).filter(Boolean))];
  return res.json({ count: events.length, lastTimestamp: last?.timestamp || null, sites });
});

// Appends one or more events to the live stream. Any collector (script tag, extension, backend) can post here.
app.post('/api/events', (req, res) => {
  const incoming = eventsFromBody(req.body);
  if (!incoming) return res.status(400).json({ error: 'Body must be an event object, an array of events, or {"events": [...]}' });
  const all = readLive().concat(incoming);
  writeLive(all);
  return res.json({ ok: true, added: incoming.length, total: all.length });
});

app.delete('/api/events', (req, res) => {
  writeLive([]);
  return res.json({ ok: true });
});

// Legacy: replaces the live stream wholesale and saves a snapshot (used by existing pushers).
app.get('/api/sample-data', (req, res) => res.json({ data: readLive() }));
app.post('/api/sample-data', (req, res) => {
  const incoming = eventsFromBody(req.body);
  if (!incoming) return res.status(400).json({ error: 'Body must be a JSON array, or {"data": [...]}' });
  writeLive(incoming);
  const snapshot = writeSnapshot(incoming, req.query?.name || req.body?.name || 'live');
  return res.json({ ok: true, count: incoming.length, snapshot });
});

// ---- Saved datasets ----

app.get('/api/datasets', (req, res) => {
  try {
    const dir = datasetsDir();
    const list = fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isFile() && (d.name.endsWith('.json') || d.name.endsWith('.txt')))
      .map(d => {
        const stat = fs.statSync(path.join(dir, d.name));
        return { id: d.name, name: d.name, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return res.json({ datasets: list });
  } catch (e) {
    console.error('datasets list error', e);
    return res.status(500).json({ error: 'Failed to list datasets' });
  }
});

app.get('/api/datasets/:id', (req, res) => {
  try {
    const p = path.join(datasetsDir(), path.basename(req.params.id));
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
    return res.json({ data: JSON.parse(fs.readFileSync(p, 'utf-8')) });
  } catch {
    return res.status(500).json({ error: 'Failed to read dataset' });
  }
});

// Saves the given events (or the current live stream) as a named snapshot.
app.post('/api/datasets/snapshots', (req, res) => {
  try {
    const data = Array.isArray(req.body?.data) ? req.body.data : readLive();
    const { id, path: out, count } = writeSnapshot(data, req.body?.name);
    return res.json({ ok: true, id, path: out, count });
  } catch {
    return res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

if (process.env.ENABLE_AI === 'true') {
  const { registerAiRoutes } = await import('./server/ai.js');
  registerAiRoutes(app, { livePath: LIVE_PATH, datasetsDir });
  console.log('AI endpoints enabled');
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
