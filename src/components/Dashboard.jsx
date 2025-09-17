import { useState, useEffect } from 'react';
import DataImporter from './DataImporter';
import FunnelVisualizer from './FunnelVisualizer';
import FlowAnalyzer from './FlowAnalyzer';
import FlowAnalyserRF from './FlowAnalyserRF';
import UserFlowDiagram from './UserFlowDiagram';
import InsightsDashboard from './InsightsDashboard';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('import');
  const [funnelConfig, setFunnelConfig] = useState({
    steps: [],
    conversionField: '',
    userIdField: ''
  });

  const handleDataImport = (importedData) => {
    setData(importedData);
    setActiveTab('visualize');
  };

  const handleFunnelConfig = (config) => {
    setFunnelConfig(config);
  };

  // Auto-load sample data on component mount
  useEffect(() => {
    const loadSampleData = async () => {
      try {
        const response = await fetch('/sampleData.txt');
        const text = await response.text();
        const sampleData = JSON.parse(text);
        setData(sampleData);
        setActiveTab('diagram'); // Switch to the new flow diagram tab
      } catch (error) {
        console.log('Sample data not available, user will need to import manually');
      }
    };

    if (!data) {
      loadSampleData();
    }
  }, [data]);

  const tabs = [
    { id: 'import', label: '📥 Import Data', component: DataImporter },
    { id: 'visualize', label: '📊 Visualize Funnel', component: FunnelVisualizer },
    { id: 'flows', label: '🔄 Flow Analysis', component: FlowAnalyzer },
    { id: 'flowAnalyser', label: '🧭 Flow Analyser', component: FlowAnalyserRF },
    { id: 'diagram', label: '🎯 User Flow Diagram', component: UserFlowDiagram },
    { id: 'insights', label: '🔍 Insights', component: InsightsDashboard }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🚀 JSON Funnel Analyzer</h1>
        <p>Transform raw JSON data into insightful funnels & flows — get insights in seconds!</p>
      </header>

      <nav className="dashboard-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''} ${!data && tab.id !== 'import' ? 'disabled' : ''}`}
            onClick={() => data || tab.id === 'import' ? setActiveTab(tab.id) : null}
            disabled={!data && tab.id !== 'import'}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {ActiveComponent && (
          <ActiveComponent
            data={data}
            onDataImport={handleDataImport}
            funnelConfig={funnelConfig}
            onFunnelConfig={handleFunnelConfig}
          />
        )}
      </main>

      {data && (
        <footer className="dashboard-footer">
          <div className="data-info">
            <span>📊 {Array.isArray(data) ? data.length : Object.keys(data).length} records loaded</span>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Dashboard;
