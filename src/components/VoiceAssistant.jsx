import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Optional OpenAI client (browser-safe usage requires a server proxy; here we only call if env token is present)
let openaiClient = null;
async function maybeInitOpenAI() {
  try {
    // Expect token to be provided via Vite env (exposed): import.meta.env.VITE_OPENAI_API_KEY
    const apiKey = import.meta?.env?.VITE_OPENAI_API_KEY;
    if (!apiKey) return null;
    const mod = await import('openai');
    // OpenAI official SDK is not designed for direct browser use with secret keys.
    // If present, we still avoid sending the key from the browser. Returning null enforces local intent parsing.
    // Integrators should create a small API route that proxies requests to OpenAI server-side.
    return null;
  } catch (_) {
    return null;
  }
}

function naiveParseIntent(transcript) {
  // Very simple extraction: look for phrases like "show category X" or "filter category X"
  const lower = transcript.toLowerCase();
  const match = lower.match(/(?:show|filter|display)(?:\s+me)?\s+(?:the\s+)?category\s+([\w_\-]+)/);
  if (match && match[1]) {
    return { type: 'filterByCategory', category: match[1] };
  }
  // also support direct utterance like: "category signin" or "signin category"
  const direct = lower.match(/category\s+([\w_\-]+)/) || lower.match(/([\w_\-]+)\s+category/);
  if (direct && direct[1]) {
    return { type: 'filterByCategory', category: direct[1] };
  }
  return { type: 'unknown' };
}

export default function VoiceAssistant() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const [category, setCategory] = useState('all');
  const [action, setAction] = useState('all');
  const [hookName, setHookName] = useState('all');
  const [intent, setIntent] = useState(null);
  const [answer, setAnswer] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);

  const recognitionRef = useRef(null);

  useEffect(() => {
    maybeInitOpenAI().then((client) => { openaiClient = client; });
  }, []);

  useEffect(() => {
    const loadSampleData = async () => {
      try {
        const response = await fetch('/sampleData.txt');
        const text = await response.text();
        const sampleData = JSON.parse(text);
        setData(Array.isArray(sampleData) ? sampleData : []);
      } catch (e) {
        setData([]);
      }
    };
    loadSampleData();
  }, []);

  const categories = useMemo(() => Array.from(new Set(data.map(e => e.category))).filter(Boolean).sort(), [data]);
  const actions = useMemo(() => Array.from(new Set(data.map(e => e.action))).filter(Boolean).sort(), [data]);
  const hookNames = useMemo(() => Array.from(new Set(data.map(e => e?.label?.hook_name))).filter(Boolean).sort(), [data]);
  const filtered = useMemo(() => {
    return data.filter(e => {
      if (category !== 'all' && e.category !== category) return false;
      if (action !== 'all' && e.action !== action) return false;
      if (hookName !== 'all' && e?.label?.hook_name !== hookName) return false;
      return true;
    });
  }, [data, category, action, hookName]);

  const duplicates = useMemo(() => {
    const seen = new Map();
    const dups = [];
    data.forEach((e, idx) => {
      const key = JSON.stringify({ screenName: e.screenName || null, action: e.action || null, category: e.category || null, hook: e?.label?.hook_name || null });
      if (seen.has(key)) {
        dups.push({ firstIndex: seen.get(key), dupIndex: idx, event: e });
      } else {
        seen.set(key, idx);
      }
    });
    return dups;
  }, [data]);

  function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      await handleTranscript(text);
    };
    recognition.onerror = (e) => {
      setError(e.error || 'Speech recognition error');
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    return recognition;
  }

  async function handleTranscript(text) {
    setError('');
    setAnswer('');
    setShowDuplicates(false);
    let parsed = null;
    // Try server-powered intent first; fallback to local parsing if server unavailable
    try {
      const resp = await fetch('/api/voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.intent) parsed = data.intent;
      }
    } catch (_) {
      // ignore network/server errors and fallback to local
    }
    if (!parsed) parsed = naiveParseIntent(text);

    setIntent(parsed);
    if (parsed.type === 'filterByCategory' && parsed.category) {
      // Attempt to match category exactly or fuzzy
      const lower = parsed.category.toLowerCase();
      const exact = categories.find(c => c.toLowerCase() === lower);
      if (exact) {
        setCategory(exact);
        return;
      }
      const fuzzy = categories.find(c => c.toLowerCase().includes(lower));
      if (fuzzy) {
        setCategory(fuzzy);
        return;
      }
      setError(`No matching category for: ${parsed.category}`);
    }
    if (parsed.type === 'filterByAction' && parsed.action) {
      const lower = parsed.action.toLowerCase();
      const exact = actions.find(a => a.toLowerCase() === lower);
      if (exact) { setAction(exact); return; }
      const fuzzy = actions.find(a => a.toLowerCase().includes(lower));
      if (fuzzy) { setAction(fuzzy); return; }
      setError(`No matching action for: ${parsed.action}`);
    }
    if (parsed.type === 'filterByHookName' && parsed.hookName) {
      const lower = parsed.hookName.toLowerCase();
      const exact = hookNames.find(h => h.toLowerCase() === lower);
      if (exact) { setHookName(exact); return; }
      const fuzzy = hookNames.find(h => h.toLowerCase().includes(lower));
      if (fuzzy) { setHookName(fuzzy); return; }
      setError(`No matching hook name for: ${parsed.hookName}`);
    }
    if (parsed.type === 'askAboutCategories') {
      setAnswer(`Categories (${categories.length}): ${categories.slice(0, 50).join(', ')}${categories.length > 50 ? '…' : ''}`);
      return;
    }
    if (parsed.type === 'askAboutActions') {
      setAnswer(`Actions (${actions.length}): ${actions.slice(0, 50).join(', ')}${actions.length > 50 ? '…' : ''}`);
      return;
    }
    if (parsed.type === 'askAboutHookNames') {
      setAnswer(`Hook names (${hookNames.length}): ${hookNames.slice(0, 50).join(', ')}${hookNames.length > 50 ? '…' : ''}`);
      return;
    }
    if (parsed.type === 'showDuplicates') {
      setShowDuplicates(true);
      return;
    }
  }

  function startListening() {
    setError('');
    const rec = setupRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/">← Back to Dashboard</Link>
      </div>
      <h2>🎙️ Voice Assistant</h2>
      <p>Say: "show category signin" or "filter category owner_payment"</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        {!listening ? (
          <button onClick={startListening} style={{ padding: '8px 12px' }}>Start Listening</button>
        ) : (
          <button onClick={stopListening} style={{ padding: '8px 12px' }}>Stop</button>
        )}
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: 6 }}>
          <option value="all">All</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} style={{ padding: 6 }}>
          <option value="all">All actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={hookName} onChange={e => setHookName(e.target.value)} style={{ padding: 6 }}>
          <option value="all">All hooks</option>
          {hookNames.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ marginTop: 8, color: '#dc2626' }}>{error}</div>
      )}
      {transcript && (
        <div style={{ marginTop: 8, color: '#334155' }}>
          Heard: <strong>{transcript}</strong>
        </div>
      )}
      {intent && intent.type !== 'unknown' && (
        <div style={{ marginTop: 8, color: '#065f46' }}>
          Intent: <code>{JSON.stringify(intent)}</code>
        </div>
      )}
      {answer && (
        <div style={{ marginTop: 8, color: '#1f2937' }}>
          {answer}
        </div>
      )}

      {!showDuplicates && (
        <div style={{ marginTop: 16 }}>
          <h3>Events ({filtered.length})</h3>
          <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
            {filtered.slice(0, 500).map((e, i) => (
              <div key={i} style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 600 }}>{e.screenName || 'UNKNOWN'} → {e.action}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>category: {e.category || 'N/A'}{e.label?.hook_name ? ` • hook: ${e.label.hook_name}` : ''}{e.label?.hook_screen ? ` • screen: ${e.label.hook_screen}` : ''}</div>
              </div>
            ))}
            {filtered.length > 500 && (
              <div style={{ padding: 8, color: '#64748b' }}>Showing first 500 results…</div>
            )}
          </div>
        </div>
      )}
      {showDuplicates && (
        <div style={{ marginTop: 16 }}>
          <h3>Duplicate Events ({duplicates.length})</h3>
          <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
            {duplicates.slice(0, 500).map((d, i) => (
              <div key={i} style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 600 }}>#{d.dupIndex} duplicates #{d.firstIndex}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>{(d.event.screenName || 'UNKNOWN')} → {d.event.action} • category: {d.event.category || 'N/A'} {d.event?.label?.hook_name ? ` • hook: ${d.event.label.hook_name}` : ''}</div>
              </div>
            ))}
            {duplicates.length > 500 && (
              <div style={{ padding: 8, color: '#64748b' }}>Showing first 500 results…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


