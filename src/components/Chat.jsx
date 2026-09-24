import { useEffect, useRef, useState } from 'react';

export default function Chat() {
  const [text, setText] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState('live');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history, response, loading]);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function markdownToHtml(md) {
    if (!md) return '';
    // Basic sanitize first
    let s = escapeHtml(md);
    // Code blocks ```
    s = s.replace(/```([\s\S]*?)```/g, (m, p1) => `<pre style="background:#0f172a;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto">${p1.replace(/\n/g,'<br/>')}</pre>`);
    // Headings ## and ###
    s = s.replace(/^###\s+(.+)$/gm, '<div style="font-size:15px;font-weight:800;margin-top:10px">$1</div>');
    s = s.replace(/^##\s+(.+)$/gm, '<div style="font-size:17px;font-weight:900;margin-top:12px">$1</div>');
    s = s.replace(/^#\s+(.+)$/gm, '<div style="font-size:19px;font-weight:900;margin-top:12px">$1</div>');
    // Bold and italics
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111827">$1</strong>');
    s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 4px;border-radius:4px">$1</code>');
    // Lists
    s = s.replace(/(^|\n)\-\s+(.+)/g, '$1<li>$2</li>');
    s = s.replace(/(<li>.*<\/li>)/gs, '<ul style="margin:6px 0;padding-left:18px">$1</ul>');
    // Paragraph line breaks
    s = s.replace(/\n\n/g, '<br/><br/>' );
    return s;
  }

  useEffect(() => {
    (async () => {
      try {
        const listRes = await fetch('/api/datasets');
        if (listRes.ok) {
          const list = await listRes.json();
          const ds = list.datasets || [];
          // Prepend a synthetic "All sessions" option
          setDatasets([{ id: 'all', name: 'All sessions' }, ...ds]);
        }
      } catch (_) {}
    })();
  }, []);

  async function send() {
    setError('');
    setResponse(null);
    try {
      setLoading(true);
      const asked = text;
      setText('');
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: asked, datasetId, history })
      });
      const data = await resp.json();
      setResponse(data);
      const now = new Date().toISOString();
      setHistory(h => [...h,
        { role: 'user', content: asked, ts: now },
        { role: 'assistant', content: data?.answer || '', ts: new Date().toISOString() }
      ]);
    } catch (e) {
      setError('Failed to reach server');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: 'calc(100vh - 16px)' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Chat</div>
        <select
          className="select"
          value={datasetId}
          name={"datasetId"}
          onChange={e => setDatasetId(e.target.value)}
          style={{ height: '40px' }}
        >
          <option value="live">Live data </option>
          {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <div style={{ maxWidth: 320, background: '#eef2ff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>Thinking</span>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: '#94a3b8', display: 'inline-block', animation: 'blink1 1.2s infinite' }}></span>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: '#94a3b8', display: 'inline-block', animation: 'blink2 1.2s infinite' }}></span>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: '#94a3b8', display: 'inline-block', animation: 'blink3 1.2s infinite' }}></span>
              </span>
            </div>
          </div>
        )}
        {error && <div style={{ color: '#dc2626' }}>{error}</div>}    
      </div>

      <div ref={listRef} style={{ overflow: 'auto', padding: '8px 12px', background: '#f8fafc' }}>
        {history.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
            <div style={{ maxWidth: 820, background: m.role === 'user' ? '#ffffff' : '#eef2ff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{m.role === 'user' ? 'You' : 'Assistant'}{m.ts ? ` • ${new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} />
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <div style={{ maxWidth: 320, background: '#eef2ff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>Thinking</span>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: '#94a3b8', display: 'inline-block', animation: 'blink1 1.2s infinite' }}></span>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: '#94a3b8', display: 'inline-block', animation: 'blink2 1.2s infinite' }}></span>
                <span style={{ width: 6, height: 6, borderRadius: 6, background: '#94a3b8', display: 'inline-block', animation: 'blink3 1.2s infinite' }}></span>
              </span>
            </div>
          </div>
        )}

      </div>

      <div style={{ padding: 14, borderTop: '1px solid #e5e7eb', background: '#ffffff' }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12,
          border: '1px solid #e5e7eb', borderRadius: 999, padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: '#fff'
        }}>
          {/* <button title="New context" style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center' }}
            onClick={() => setHistory([])}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </button> */}
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ask anything about the selected journey..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {/* <button title="Voice (coming soon)" style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center' }} disabled>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 19v4"/></svg>
          </button> */}
          <button title="Send" onClick={send} disabled={loading || !text.trim()} style={{ width: 38, height: 38, borderRadius: 999, border: '1px solid var(--primary-600)', background: 'var(--primary-600)', color: '#fff', display: 'grid', placeItems: 'center', alignItems:"center", justifyContent:"center" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}


