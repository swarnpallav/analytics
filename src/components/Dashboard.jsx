import { useState, useEffect, useMemo } from 'react';
import DataImporter from './DataImporter';
import FunnelVisualizer from './FunnelVisualizer';
import FlowAnalyserRF from './FlowAnalyserRF';
import UserFlowDiagram from './UserFlowDiagram';
import InsightsDashboard from './InsightsDashboard';
import { detectMapping, normalizeEvents, parseRecords } from '../lib/events';
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

  const events = useMemo(() => (records && mapping.name ? normalizeEvents(records, mapping) : null), [records, mapping]);

  const handleDataImport = (imported, label) => {
    setRecords(imported);
    setSource(label);
    setMapping(detectMapping(imported));
  };

  // Start with whatever was last pushed to the server (POST /api/events), if anything.
  useEffect(() => {
    fetch('/api/events')
      .then(r => (r.ok ? r.text() : ''))
      .then(text => {
        const live = text ? parseRecords(text) : [];
        if (live.length) handleDataImport(live, 'Live (collector)');
      })
      .catch(() => {});
  }, []);

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
