import { useState, useEffect, useMemo } from 'react';
import _ from 'lodash';
import './FlowAnalyzer.css';

const FlowAnalyzer = ({ data }) => {
  const [userIdField, setUserIdField] = useState('userId');
  const [eventField, setEventField] = useState('event');
  const [timestampField, setTimestampField] = useState('timestamp');
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);

  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      const sampleRecord = data[0];
      const fields = Object.keys(sampleRecord);
      setAvailableFields(fields);
    }
  }, [data]);

  const flowData = useMemo(() => {
    if (!data || !userIdField || !eventField) return null;

    const userJourneys = _.groupBy(data, userIdField);
    
    // Create flow patterns
    const flows = {};
    const pathCounts = {};
    
    Object.entries(userJourneys).forEach(([userId, userEvents]) => {
      // Sort events by timestamp if available
      const sortedEvents = timestampField 
        ? _.sortBy(userEvents, timestampField)
        : userEvents;
      
      const eventSequence = sortedEvents.map(event => event[eventField]).filter(Boolean);
      
      // Count sequential pairs (transitions)
      for (let i = 0; i < eventSequence.length - 1; i++) {
        const from = eventSequence[i];
        const to = eventSequence[i + 1];
        const flowKey = `${from} → ${to}`;
        
        if (!flows[from]) flows[from] = {};
        if (!flows[from][to]) flows[from][to] = 0;
        flows[from][to]++;
        
        if (!pathCounts[flowKey]) pathCounts[flowKey] = 0;
        pathCounts[flowKey]++;
      }
    });

    // Convert to array format for easier rendering
    const flowArray = [];
    Object.entries(flows).forEach(([fromEvent, toEvents]) => {
      Object.entries(toEvents).forEach(([toEvent, count]) => {
        flowArray.push({
          from: fromEvent,
          to: toEvent,
          count,
          percentage: Math.round((count / Object.keys(userJourneys).length) * 100)
        });
      });
    });

    // Sort by count descending
    flowArray.sort((a, b) => b.count - a.count);

    return {
      flows: flowArray,
      pathCounts,
      totalUsers: Object.keys(userJourneys).length
    };
  }, [data, userIdField, eventField, timestampField]);

  const topPaths = useMemo(() => {
    if (!data || !userIdField || !eventField) return [];

    const userJourneys = _.groupBy(data, userIdField);
    const completePaths = {};

    Object.entries(userJourneys).forEach(([userId, userEvents]) => {
      const sortedEvents = timestampField 
        ? _.sortBy(userEvents, timestampField)
        : userEvents;
      
      const eventSequence = sortedEvents.map(event => event[eventField]).filter(Boolean);
      const pathKey = eventSequence.join(' → ');
      
      if (pathKey && eventSequence.length > 1) {
        if (!completePaths[pathKey]) {
          completePaths[pathKey] = {
            path: eventSequence,
            count: 0,
            users: []
          };
        }
        completePaths[pathKey].count++;
        completePaths[pathKey].users.push(userId);
      }
    });

    return Object.entries(completePaths)
      .map(([pathKey, pathData]) => ({
        pathKey,
        ...pathData,
        percentage: Math.round((pathData.count / Object.keys(userJourneys).length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 paths
  }, [data, userIdField, eventField, timestampField]);

  if (!data) {
    return (
      <div className="flow-analyzer">
        <div className="no-data">
          <h2>🔄 Flow Analyzer</h2>
          <p>Please import data first to analyze user flows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-analyzer">
      <div className="config-section">
        <h2>🔄 Flow Analysis</h2>
        <p>Analyze user journey patterns and discover the most common paths through your funnel.</p>
        
        <div className="field-config">
          <div className="field-group">
            <label>User ID Field:</label>
            <select value={userIdField} onChange={(e) => setUserIdField(e.target.value)}>
              {availableFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>
          
          <div className="field-group">
            <label>Event Field:</label>
            <select value={eventField} onChange={(e) => setEventField(e.target.value)}>
              {availableFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>
          
          <div className="field-group">
            <label>Timestamp Field (optional):</label>
            <select value={timestampField} onChange={(e) => setTimestampField(e.target.value)}>
              <option value="">None</option>
              {availableFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {flowData && (
        <div className="analysis-section">
          <div className="flow-overview">
            <h3>📊 Flow Overview</h3>
            <div className="overview-stats">
              <div className="stat-item">
                <span className="stat-value">{flowData.totalUsers}</span>
                <span className="stat-label">Total Users</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{flowData.flows.length}</span>
                <span className="stat-label">Unique Transitions</span>
              </div>
            </div>
          </div>

          <div className="flow-transitions">
            <h3>🔄 Most Common Transitions</h3>
            <div className="transitions-list">
              {flowData.flows.slice(0, 10).map((flow, index) => (
                <div key={index} className="transition-item">
                  <div className="transition-flow">
                    <span className="from-event">{flow.from}</span>
                    <span className="arrow">→</span>
                    <span className="to-event">{flow.to}</span>
                  </div>
                  <div className="transition-stats">
                    <span className="count">{flow.count} users</span>
                    <span className="percentage">({flow.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="complete-paths">
            <h3>🛤️ Top User Journeys</h3>
            <div className="paths-list">
              {topPaths.map((pathData, index) => (
                <div 
                  key={index} 
                  className={`path-item ${selectedFlow === pathData.pathKey ? 'selected' : ''}`}
                  onClick={() => setSelectedFlow(selectedFlow === pathData.pathKey ? null : pathData.pathKey)}
                >
                  <div className="path-header">
                    <span className="path-rank">#{index + 1}</span>
                    <div className="path-stats">
                      <span className="path-count">{pathData.count} users</span>
                      <span className="path-percentage">({pathData.percentage}%)</span>
                    </div>
                  </div>
                  <div className="path-flow">
                    {pathData.path.map((event, eventIndex) => (
                      <span key={eventIndex} className="path-step">
                        {event}
                        {eventIndex < pathData.path.length - 1 && <span className="path-arrow">→</span>}
                      </span>
                    ))}
                  </div>
                  {selectedFlow === pathData.pathKey && (
                    <div className="path-details">
                      <h4>Path Details:</h4>
                      <p><strong>Steps:</strong> {pathData.path.length}</p>
                      <p><strong>Users:</strong> {pathData.users.join(', ')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flow-visualization">
            <h3>🎯 Flow Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <h4>🚪 Entry Points</h4>
                <div className="entry-points">
                  {Object.keys(
                    _.countBy(flowData.flows.map(f => f.from))
                  ).slice(0, 5).map(event => (
                    <span key={event} className="entry-point">{event}</span>
                  ))}
                </div>
              </div>
              
              <div className="insight-card">
                <h4>🎯 Exit Points</h4>
                <div className="exit-points">
                  {Object.keys(
                    _.countBy(flowData.flows.map(f => f.to))
                  ).slice(0, 5).map(event => (
                    <span key={event} className="exit-point">{event}</span>
                  ))}
                </div>
              </div>

              <div className="insight-card">
                <h4>⚡ Hottest Transitions</h4>
                <div className="hot-transitions">
                  {flowData.flows.slice(0, 3).map((flow, index) => (
                    <div key={index} className="hot-transition">
                      <span className="transition">{flow.from} → {flow.to}</span>
                      <span className="heat-score">{flow.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowAnalyzer;
