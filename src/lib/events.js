// Schema-agnostic event model. Raw records from any source (Segment, GA4,
// Mixpanel, Amplitude, dataLayer, custom JSON/CSV) are mapped onto:
//   { id, name, page, group, ts, userId, sessionId, raw }

export const FIELDS = [
  { key: 'name', label: 'Event name', required: true },
  { key: 'page', label: 'Page / screen' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'userId', label: 'User ID' },
  { key: 'sessionId', label: 'Session ID' },
  { key: 'group', label: 'Category / group' },
];

// Ordered by preference; matched against full dot-paths first, then the last path segment.
const CANDIDATES = {
  name: ['event', 'event_name', 'eventName', 'event_type', 'eventType', 'action', 'name', 'type'],
  page: ['screenName', 'screen_name', 'screen', 'page_path', 'pagePath', 'context.page.path', 'page', 'path',
    'pathname', 'route', 'page_location', 'properties.$current_url', 'url'],
  timestamp: ['timestamp', 'event_timestamp', 'event_time', 'eventTime', 'time', 'ts', 'properties.time',
    'created_at', 'createdAt', 'sentAt', 'receivedAt', 'date'],
  userId: ['userId', 'user_id', 'distinct_id', 'properties.distinct_id', 'user_pseudo_id', 'anonymousId',
    'anonymous_id', 'visitorId', 'device_id', 'deviceId', 'uid'],
  sessionId: ['sessionId', 'session_id', 'properties.session_id', 'ga_session_id', 'sid'],
  group: ['category', 'event_category', 'eventCategory'],
};

export function getPath(obj, path) {
  if (!obj || !path) return undefined;
  if (path in obj) return obj[path];
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ---------- parsing ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!header) return [];
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function unwrap(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const k of ['data', 'events', 'results', 'items', 'rows']) {
      if (Array.isArray(json[k])) return json[k];
    }
    return [json];
  }
  throw new Error('Unsupported JSON shape');
}

// Accepts JSON array / object wrapper, NDJSON, or CSV text. Returns an array of records.
export function parseRecords(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  try {
    return unwrap(JSON.parse(trimmed));
  } catch {
    // not a single JSON document
  }
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
  if (lines.every(l => l.trim().startsWith('{'))) {
    try { return lines.map(l => JSON.parse(l)); } catch { /* fall through to CSV */ }
  }
  if (lines[0].includes(',')) return parseCsv(trimmed);
  throw new Error('Could not parse input as JSON, NDJSON or CSV');
}

// ---------- field detection ----------

function collectPrimitivePaths(records) {
  const counts = new Map();
  const visit = (obj, prefix, depth) => {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (depth < 3) visit(v, p, depth + 1);
      } else if (v !== null && v !== undefined && v !== '' && !Array.isArray(v)) {
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
  };
  records.forEach(r => { if (r && typeof r === 'object') visit(r, '', 0); });
  return counts;
}

export function listFieldPaths(records) {
  const sample = records.slice(0, 500);
  return Array.from(collectPrimitivePaths(sample).entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([p]) => p);
}

export function detectMapping(records) {
  const sample = records.slice(0, 500);
  const counts = collectPrimitivePaths(sample);
  const minPresence = Math.max(1, Math.floor(sample.length * 0.2));
  const paths = Array.from(counts.keys()).filter(p => counts.get(p) >= minPresence);
  const used = new Set();
  const mapping = {};
  for (const { key } of FIELDS) {
    const lowerPaths = paths.map(p => [p, p.toLowerCase(), p.split('.').pop().toLowerCase()]);
    let found = '';
    for (const cand of CANDIDATES[key]) {
      const c = cand.toLowerCase();
      const hit = lowerPaths.find(([p, full]) => full === c && !used.has(p))
        || lowerPaths.find(([p, , last]) => last === c && !used.has(p));
      if (hit) { found = hit[0]; break; }
    }
    mapping[key] = found;
    if (found) used.add(found);
  }
  return mapping;
}

// ---------- normalization ----------

export function parseTimestamp(v) {
  if (v == null || v === '') return NaN;
  let n = typeof v === 'number' ? v : (String(v).trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : NaN);
  if (!Number.isNaN(n)) {
    if (n > 1e14) return n / 1000; // microseconds (GA4)
    if (n < 1e11) return n * 1000; // seconds (Mixpanel)
    return n;
  }
  // Export tools (Amplitude, BigQuery, CSV dumps) write zone-less times in UTC.
  const s = String(v).trim();
  const d = Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? `${s.replace(' ', 'T')}Z` : s);
  return Number.isNaN(d) ? NaN : d;
}

function toPage(v) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (/^https?:\/\//i.test(s)) {
    try { return new URL(s).pathname || '/'; } catch { return s; }
  }
  return s;
}

const str = v => (v == null || v === '' ? '' : String(v));

export function normalizeEvents(records, mapping) {
  const events = (records || []).map((raw, i) => ({
    id: i,
    name: str(getPath(raw, mapping.name)) || '(unnamed)',
    page: toPage(getPath(raw, mapping.page)),
    group: str(getPath(raw, mapping.group)),
    ts: parseTimestamp(getPath(raw, mapping.timestamp)),
    userId: str(getPath(raw, mapping.userId)),
    sessionId: str(getPath(raw, mapping.sessionId)),
    raw,
  }));
  // Stable sort by time; events without a timestamp keep their original order.
  if (events.some(e => Number.isFinite(e.ts))) {
    events.sort((a, b) => {
      const at = Number.isFinite(a.ts) ? a.ts : Infinity;
      const bt = Number.isFinite(b.ts) ? b.ts : Infinity;
      return at - bt || a.id - b.id;
    });
  }
  return events;
}

// ---------- journeys ----------

// A journey is one session if sessions are known, else one user, else the whole dataset.
export function journeyKey(e) {
  if (e.sessionId) return e.userId ? `${e.userId} · ${e.sessionId}` : e.sessionId;
  return e.userId || 'All events';
}

export function groupJourneys(events) {
  const map = new Map();
  events.forEach(e => {
    const k = journeyKey(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  });
  return map;
}

export function formatTs(ts) {
  return Number.isFinite(ts) ? new Date(ts).toLocaleString() : '';
}
