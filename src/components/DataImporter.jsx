import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FIELDS, listFieldPaths, parseRecords } from '../lib/events';
import ConnectSite from './ConnectSite';
import './DataImporter.css';

const DataImporter = ({ records, source, mapping, onDataImport, onMappingChange }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [datasets, setDatasets] = useState([]);

  useEffect(() => {
    fetch('/api/datasets')
      .then(r => (r.ok ? r.json() : { datasets: [] }))
      .then(j => setDatasets(j.datasets || []))
      .catch(() => {});
  }, []);

  const importText = useCallback((text, label) => {
    try {
      const parsed = parseRecords(text);
      if (!parsed.length) throw new Error('No records found');
      setError(null);
      onDataImport(parsed, label);
    } catch (err) {
      setError(err.message);
    }
  }, [onDataImport]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      importText(e.target.result, file.name);
      setIsLoading(false);
    };
    reader.readAsText(file);
  }, [importText]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json', '.ndjson', '.jsonl'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const loadUrl = async (url, label) => {
    try {
      setIsLoading(true);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${label}`);
      importText(await res.text(), label);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fieldPaths = records?.length ? listFieldPaths(records) : [];

  return (
    <div className="data-importer">
      <div className="importer-section">
        <h2>📥 Bring in your events</h2>

        <ConnectSite onLoadLive={() => loadUrl('/api/events', 'Live (collector)')} />

        <h3>📁 Or import an export</h3>
        <p>
          Drop an event export (JSON, NDJSON or CSV). Exports from Segment, GA4 (BigQuery), Mixpanel,
          Amplitude and GTM dataLayer dumps are detected automatically.
        </p>

        <div className="import-methods">
          <div className="file-upload">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              {isLoading ? (
                <div className="loading">⏳ Processing…</div>
              ) : isDragActive ? (
                <div className="drop-message">📎 Drop your file here</div>
              ) : (
                <div className="upload-message">
                  <div className="upload-icon">📁</div>
                  <p>Drag & drop a file here, or click to browse</p>
                  <small>.json, .ndjson, .jsonl, .csv, .txt</small>
                </div>
              )}
            </div>
          </div>

          <div className="text-input">
            <label htmlFor="json-input">Or paste events:</label>
            <textarea
              id="json-input"
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder={`[\n  { "userId": "u1", "event": "page_view", "page": "/home", "timestamp": "2024-01-01T10:00:00Z" }\n]`}
              rows={8}
            />
            <div className="input-actions">
              <button onClick={() => loadUrl('/demo-events.json', 'Demo data')} className="sample-btn">
                📝 Load demo data
              </button>
              {datasets.length > 0 && (
                <select
                  className="sample-btn"
                  value=""
                  onChange={e => e.target.value && loadUrl(`/api/datasets/${encodeURIComponent(e.target.value)}`, e.target.value)}
                >
                  <option value="">🗂 Load saved dataset…</option>
                  {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              {jsonInput.trim() && (
                <button onClick={() => importText(jsonInput, 'Pasted data')} className="import-btn">
                  ✨ Import
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <div className="error-message">❌ {error}</div>}

        {records?.length > 0 && (
          <div className="data-preview">
            <h3>🧭 Field mapping</h3>
            <div className="preview-stats">
              <span className="stat">Source: {source}</span>
              <span className="stat">Records: {records.length}</span>
            </div>
            <p className="preview-note">
              We guessed which fields hold what. Adjust if something looks wrong; every view updates instantly.
            </p>
            <div className="mapping-grid">
              {FIELDS.map(f => (
                <label key={f.key} className="mapping-row">
                  <span>{f.label}{f.required ? ' *' : ''}</span>
                  <select value={mapping[f.key] || ''} onChange={e => onMappingChange({ ...mapping, [f.key]: e.target.value })}>
                    <option value="">— none —</option>
                    {fieldPaths.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <pre className="preview-json">{JSON.stringify(records.slice(0, 2), null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataImporter;
