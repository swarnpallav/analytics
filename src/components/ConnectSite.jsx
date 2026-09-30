import { useEffect, useMemo, useState } from 'react';
import {
  RECORDING_WINDOW, buildConsoleSnippet, clearRecordings, countRecordings, getRecordings, onRecordingsChange,
} from '../lib/recordings';

const URL_KEY = 'nvg_record_url';

function readPref(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked; the value lasts for this visit */ }
}

// Accepts "example.com/page" as well as full URLs.
function normaliseUrl(text) {
  const s = text.trim();
  if (!s) return '';
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`).href; } catch { return ''; }
}

// Records your own session on any site with no server: this tab opens the site, the pasted snippet sends events
// back to it, and they are kept in this browser.
export default function ConnectSite({ onLoadRecordings }) {
  const [url, setUrl] = useState(() => readPref(URL_KEY));
  const [openError, setOpenError] = useState('');
  const [collectorSource, setCollectorSource] = useState('');
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(null);
  const snippet = useMemo(() => (collectorSource ? buildConsoleSnippet(collectorSource) : ''), [collectorSource]);

  useEffect(() => {
    fetch('/collector.js')
      .then(r => (r.ok ? r.text() : ''))
      .then(setCollectorSource)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => countRecordings().then(setCount).catch(() => setCount(0));
    load();
    return onRecordingsChange(load);
  }, []);

  // Opened without noopener on purpose: the recording tab reaches this one through window.opener.
  const openWindow = (target) => {
    const win = window.open(target, RECORDING_WINDOW);
    setOpenError(win ? '' : 'The browser blocked the new tab. Allow pop-ups for this page and try again.');
  };

  const openSite = () => {
    const target = normaliseUrl(url);
    if (!target) return setOpenError('Enter the address of the page to record.');
    writePref(URL_KEY, url.trim());
    openWindow(target);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the snippet is still selectable
    }
  };

  const exportJson = async () => {
    const events = await getRecordings();
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `navaigate-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000); // some browsers start the download asynchronously
  };

  const clear = async () => {
    if (!window.confirm('Delete all your recorded events from this browser?')) return;
    await clearRecordings();
  };

  return (
    <div className="connect-site">
      <h3>🔴 Record a session (recommended)</h3>
      <p>
        Record yourself using any site; the events stay in this browser, and no server or site changes are needed.
        It records page views and the events the site already sends through Google Tag Manager / gtag, Segment or
        Mixpanel.
      </p>
      <ol className="record-steps">
        <li>
          <div className="input-actions">
            <input
              className="record-url"
              type="url"
              value={url}
              placeholder="https://www.example.com/page"
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && openSite()}
            />
            <button className="import-btn" onClick={openSite}>Open site to record</button>
            <button className="sample-btn" onClick={() => openWindow('/collector-test.html')}>Use the test page</button>
          </div>
          {openError && <div className="error-message">❌ {openError}</div>}
        </li>
        <li>
          In that tab, press <code>F12</code> (<code>⌥⌘J</code> on Mac), paste the snippet into the Console and press Enter.
          Chrome may ask you to type <code>allow pasting</code> first. The test page records on its own.
          <div className="snippet">
            <code>{snippet ? `${(snippet.length / 1024).toFixed(1)} KB console snippet (NAVAIGATE_CONFIG + collector.js)` : 'Loading snippet…'}</code>
            <button className="sample-btn" onClick={copy} disabled={!snippet}>{copied ? '✅ Copied' : '📋 Copy'}</button>
          </div>
        </li>
        <li>Use the site. Keep this tab open: it's where the events are sent.</li>
      </ol>
      <p className="preview-note">
        A full page reload stops recording; paste the snippet again (or save it under Sources → Snippets). If the console
        says it is not connected, the site blocks links between windows and can't be recorded this way.
      </p>
      <div className="input-actions">
        <span className="stat">{count == null ? 'Checking recordings…' : `${count} events recorded`}</span>
        {count > 0 && (
          <>
            <button className="import-btn" onClick={onLoadRecordings}>✨ Analyse my recordings</button>
            <button className="sample-btn" onClick={exportJson}>⬇️ Export JSON</button>
            <button className="sample-btn" onClick={clear}>🗑 Clear recordings</button>
          </>
        )}
      </div>
    </div>
  );
}
