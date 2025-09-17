import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import './DataImporter.css';

const DataImporter = ({ onDataImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setIsLoading(true);
      setError(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);
          setJsonInput(JSON.stringify(data, null, 2));
          setPreviewData(data);
          setIsLoading(false);
        } catch (err) {
          setError('Invalid JSON file. Please check the format.');
          setIsLoading(false);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const handleTextAreaChange = (e) => {
    const value = e.target.value;
    setJsonInput(value);
    
    if (value.trim()) {
      try {
        const data = JSON.parse(value);
        setPreviewData(data);
        setError(null);
      } catch (err) {
        setPreviewData(null);
        setError('Invalid JSON format');
      }
    } else {
      setPreviewData(null);
      setError(null);
    }
  };

  const handleImport = () => {
    if (previewData) {
      onDataImport(previewData);
    }
  };

  const handleLoadSample = async () => {
    try {
      const response = await fetch('/sampleData.txt');
      const text = await response.text();
      const sampleData = JSON.parse(text);
      
      setJsonInput(JSON.stringify(sampleData, null, 2));
      setPreviewData(sampleData);
      setError(null);
    } catch (err) {
      // Fallback to embedded sample data if file loading fails
      const fallbackData = [
        {
          "screenName": "onboarding",
          "action": "app_opened",
          "category": "app_open",
          "label": {
            "screen_name": "MainActivity",
            "mode": "normal",
            "onBoardingStatus": "Complete"
          }
        },
        {
          "screenName": "onboarding", 
          "action": "login_start_seen",
          "category": "listing_upload_new",
          "label": {
            "property_type": "residential",
            "service_type": "rent",
            "login_state": false,
            "screen_name": "user-login",
            "city": ""
          }
        },
        {
          "screenName": "homeTab",
          "action": "seen",
          "category": "home_tab",
          "label": {}
        }
      ];
      
      setJsonInput(JSON.stringify(fallbackData, null, 2));
      setPreviewData(fallbackData);
      setError(null);
    }
  };

  const renderPreview = () => {
    if (!previewData) return null;
    
    const isArray = Array.isArray(previewData);
    const count = isArray ? previewData.length : Object.keys(previewData).length;
    const sample = isArray ? previewData.slice(0, 3) : [previewData];
    
    return (
      <div className="data-preview">
        <h3>📊 Data Preview</h3>
        <div className="preview-stats">
          <span className="stat">Records: {count}</span>
          <span className="stat">Type: {isArray ? 'Array' : 'Object'}</span>
        </div>
        <pre className="preview-json">
          {JSON.stringify(sample, null, 2)}
        </pre>
        {isArray && previewData.length > 3 && (
          <p className="preview-note">... and {previewData.length - 3} more records</p>
        )}
      </div>
    );
  };

  return (
    <div className="data-importer">
      <div className="importer-section">
        <h2>📥 Import Your Data</h2>
        <p>Upload a JSON file or paste your data directly to get started with funnel analysis.</p>
        
        <div className="import-methods">
          <div className="file-upload">
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''}`}
            >
              <input {...getInputProps()} />
              {isLoading ? (
                <div className="loading">⏳ Processing file...</div>
              ) : isDragActive ? (
                <div className="drop-message">📎 Drop your JSON file here</div>
              ) : (
                <div className="upload-message">
                  <div className="upload-icon">📁</div>
                  <p>Drag & drop your JSON file here, or click to browse</p>
                  <small>Supports .json and .txt files</small>
                </div>
              )}
            </div>
          </div>

          <div className="text-input">
            <label htmlFor="json-input">Or paste your JSON data:</label>
            <textarea
              id="json-input"
              value={jsonInput}
              onChange={handleTextAreaChange}
              placeholder={`Paste your JSON data here, for example:\n[\n  {\n    "userId": "user_1",\n    "event": "page_view",\n    "timestamp": "2024-01-01T10:00:00Z"\n  }\n]`}
              rows={8}
            />
            
            <div className="input-actions">
              <button onClick={handleLoadSample} className="sample-btn">
                📝 Load Sample Data
              </button>
              {previewData && (
                <button onClick={handleImport} className="import-btn">
                  ✨ Import Data
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {renderPreview()}
      </div>
    </div>
  );
};

export default DataImporter;
