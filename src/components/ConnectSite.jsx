import { useEffect, useState } from 'react';

const POLL_MS = 5000;

// The console variant inlines the whole collector: pages with a strict CSP would block loading it by URL.
function buildConsoleSnippet(source) {
  const config = `window.NAVAIGATE_CONFIG = { endpoint: ${JSON.stringify(`${window.location.origin}/api/events`)}, site: location.hostname, debug: true };`;
  return `${config}\n${source}`;
}

// Shows the collector snippet and a live count of events received from connected sites.
export default function ConnectSite({ onLoadLive }) {
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState('script'); // 'script' | 'console'
  const [consoleSnippet, setConsoleSnippet] = useState('');
  const scriptSnippet = `<script async src="${window.location.origin}/collector.js"></script>`;
  const snippet = method === 'script' ? scriptSnippet : consoleSnippet;

  useEffect(() => {
    fetch('/collector.js')
      .then(r => (r.ok ? r.text() : ''))
      .then(source => source && setConsoleSnippet(buildConsoleSnippet(source)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/events/stats')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (active) setStats(j); })
      .catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the snippet is still selectable
    }
  };

  const clear = async () => {
    if (!window.confirm('Delete all live events received so far?')) return;
    await fetch('/api/events', { method: 'DELETE' });
    setStats(s => ({ ...s, count: 0, lastTimestamp: null, sites: [] }));
  };

  return (
    <div className="connect-site">
      <h3>🔌 Connect your site (recommended)</h3>
      <div className="method-toggle">
        <button className={method === 'script' ? 'active' : ''} onClick={() => setMethod('script')}>Script tag</button>
        <button className={method === 'console' ? 'active' : ''} onClick={() => setMethod('console')}>DevTools console</button>
      </div>
      {method === 'script' ? (
        <p>
          Paste this into your site's <code>&lt;head&gt;</code>. It records page views and picks up events you already send
          through Google Tag Manager / gtag, Segment or Mixpanel. No other code changes needed.
        </p>
      ) : (
        <p>
          No access to the site's code? Open any page, press <code>F12</code> (<code>⌥⌘J</code> on Mac), paste this into the
          Console and press Enter. Chrome may ask you to type <code>allow pasting</code> first. It records the same events as
          the script tag, but only in your tab, and it stops on a full page reload (paste again to resume). Sites with a
          strict security policy may block sending events.
        </p>
      )}
      <div className="snippet">
        <code>{method === 'script' ? scriptSnippet : `${(consoleSnippet.length / 1024).toFixed(1)} KB console snippet (NAVAIGATE_CONFIG + collector.js)`}</code>
        <button className="sample-btn" onClick={copy} disabled={!snippet}>{copied ? '✅ Copied' : '📋 Copy'}</button>
      </div>
      <p className="preview-note">
        Custom events: <code>window.navaigate.track('signup_clicked', {'{'} plan: 'pro' {'}'})</code>.
        Want to try it first? Open the <a href="/collector-test.html" target="_blank" rel="noreferrer">test page</a> and click around.
      </p>
      <div className="input-actions">
        <span className="stat">
          {stats ? `${stats.count} live events received` : 'Waiting for server…'}
          {stats?.lastTimestamp ? `, last at ${new Date(stats.lastTimestamp).toLocaleTimeString()}` : ''}
          {stats?.sites?.length ? ` from ${stats.sites.join(', ')}` : ''}
        </span>
        {stats?.count > 0 && (
          <>
            <button className="import-btn" onClick={onLoadLive}>✨ Analyse live events</button>
            <button className="sample-btn" onClick={clear}>🗑 Clear</button>
          </>
        )}
      </div>
    </div>
  );
}
