import { useState, useEffect, useMemo } from 'react';
import DataImporter from './DataImporter';
import FunnelVisualizer from './FunnelVisualizer';
import FlowAnalyserRF from './FlowAnalyserRF';
import UserFlowDiagram from './UserFlowDiagram';
import InsightsDashboard from './InsightsDashboard';
import { detectMapping, normalizeEvents } from '../lib/events';
import { getRecordings, onRecordingsChange } from '../lib/recordings';
import './Dashboard.css';

const tabs = [
  { id: 'import', label: '📥 Import Data', component: DataImporter },
  { id: 'funnel', label: '📊 Funnel', component: FunnelVisualizer },
  { id: 'flowAnalyser', label: '🧭 Journey Graph', component: FlowAnalyserRF },
  { id: 'diagram', label: '🎯 Journey Timeline', component: UserFlowDiagram },
  { id: 'insights', label: '🔍 Insights', component: InsightsDashboard }
];

const Dashboard = () => {
  const [records, setRecords] = useState(null);
  const [source, setSource] = useState('');
  const [mapping, setMapping] = useState({});
  const [activeTab, setActiveTab] = useState('import');
  // True while the loaded data is this browser's recordings, which then follow new and cleared events.
  const [showingRecordings, setShowingRecordings] = useState(false);

  const events = useMemo(() => (records && mapping.name ? normalizeEvents(records, mapping) : null), [records, mapping]);

  const handleDataImport = (imported, label) => {
    setRecords(imported);
    setSource(label);
    setMapping(detectMapping(imported));
    setShowingRecordings(false);
  };

  const loadRecordings = () => getRecordings()
    .then(recs => {
      if (!recs.length) return;
      handleDataImport(recs, 'My recordings');
      setShowingRecordings(true);
    })
    .catch(() => {});

  // Keep the field mapping while events arrive; once they're cleared, unload so every tab empties.
  useEffect(() => {
    if (!showingRecordings) return undefined;
    return onRecordingsChange(() => getRecordings()
      .then(recs => {
        if (recs.length) {
          setRecords(recs);
        } else {
          setRecords(null);
          setSource('');
          setMapping({});
          setShowingRecordings(false);
        }
      })
      .catch(() => {}));
  }, [showingRecordings]);

  // Start with the recordings kept in this browser, if any. Runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRecordings(); }, []);

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;
  const ready = Boolean(events?.length);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🚀 NavAIgate</h1>
        <p>Visualise funnels and user journeys from the events your site already fires.</p>
      </header>

      <nav className="dashboard-nav">
        {tabs.map(tab => {
          const disabled = !ready && tab.id !== 'import';
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main className="dashboard-content">
        {ActiveComponent && (
          <ActiveComponent
            events={events || []}
            records={records}
            source={source}
            mapping={mapping}
            onDataImport={handleDataImport}
            onMappingChange={setMapping}
            onLoadRecordings={loadRecordings}
          />
        )}
      </main>

      {ready && (
        <footer className="dashboard-footer">
          <div className="data-info">
            <span>📊 {events.length} events loaded from {source}</span>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Dashboard;
