// Serverless recording: the collector, pasted into a tab this dashboard opened, posts event batches back with
// window.opener.postMessage. They are kept in this browser's IndexedDB, so nothing leaves the machine.

const TOKEN_KEY = 'nvg_recorder';
const DB_NAME = 'navaigate';
const STORE = 'recordings';
export const RECORDING_WINDOW = 'navaigate-recording';

function randomId() {
  return window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Messages must carry this token, so other pages can't slip events in. The test page reads it from the same key.
let token = '';
export function recordingToken() {
  if (token) return token;
  try {
    token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) { token = randomId(); localStorage.setItem(TOKEN_KEY, token); }
  } catch {
    token = token || randomId(); // storage blocked: valid until this tab closes
  }
  return token;
}

// ---------- storage ----------

let memory = null; // used instead of IndexedDB when it is unavailable (private windows, blocked site data)
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => {
      memory = memory || [];
      return null;
    });
  }
  return dbPromise;
}

function run(mode, work) {
  return openDb().then(db => {
    if (!db) return work(null);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result ?? result);
      tx.onerror = () => reject(tx.error);
    });
  });
}

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

// Calls fn whenever recordings are added or cleared. Returns an unsubscribe function.
export function onRecordingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRecordings() {
  return run('readonly', store => (store ? store.getAll() : memory.slice()));
}

export function countRecordings() {
  return run('readonly', store => (store ? store.count() : memory.length));
}

function addRecordings(events) {
  return run('readwrite', store => {
    if (store) events.forEach(e => store.add(e));
    else memory.push(...events);
  }).then(notify);
}

export function clearRecordings() {
  return run('readwrite', store => {
    if (store) store.clear();
    else memory = [];
  }).then(notify);
}

// ---------- receiving ----------

let listening = false;

// Starts accepting batches from recording tabs. Safe to call more than once.
export function listenForRecordings() {
  if (listening) return;
  listening = true;
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || data.type !== 'navaigate:events' || data.token !== recordingToken() || !Array.isArray(data.events)) return;
    const events = data.events.filter(ev => ev && typeof ev === 'object');
    if (events.length) addRecordings(events).catch(() => {});
  });
}

// Builds the snippet pasted into the recording tab's console. The collector is inlined: pages with a strict CSP
// would block loading it by URL.
export function buildConsoleSnippet(collectorSource) {
  const fields = [
    "transport: 'opener'",
    `dashboard: ${JSON.stringify(window.location.origin)}`,
    `token: ${JSON.stringify(recordingToken())}`,
    'site: location.hostname',
    'debug: true',
  ];
  return `window.NAVAIGATE_CONFIG = { ${fields.join(', ')} };\n${collectorSource}`;
}
