import { useState, useEffect, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import _ from 'lodash';
import './FunnelVisualizer.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const FunnelVisualizer = ({ data, funnelConfig, onFunnelConfig }) => {
  const [userIdField, setUserIdField] = useState('userId');
  const [eventField, setEventField] = useState('event');
  const [timestampField, setTimestampField] = useState('timestamp');
  const [selectedSteps, setSelectedSteps] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);

  // Analyze the data structure to find available fields and events
  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      const sampleRecord = data[0];
      const fields = Object.keys(sampleRecord);
      setAvailableFields(fields);

      // Find unique events
      const events = _.uniq(data.map(record => record[eventField]).filter(Boolean));
      setAvailableEvents(events);
    }
  }, [data, eventField]);

  // Process funnel data
  const funnelData = useMemo(() => {
    if (!data || !selectedSteps.length || !userIdField || !eventField) {
      return null;
    }

    const userJourneys = _.groupBy(data, userIdField);
    
    const stepCounts = selectedSteps.map((step, index) => {
      let usersInStep = 0;
      
      Object.values(userJourneys).forEach(userEvents => {
        // Sort events by timestamp if available
        const sortedEvents = timestampField 
          ? _.sortBy(userEvents, timestampField)
          : userEvents;
        
        // Check if user completed this step and all previous steps in order
        let completedSteps = 0;
        let eventIndex = 0;
        
        for (let stepIndex = 0; stepIndex <= index; stepIndex++) {
          const requiredEvent = selectedSteps[stepIndex];
          let foundEvent = false;
          
          for (let i = eventIndex; i < sortedEvents.length; i++) {
            if (sortedEvents[i][eventField] === requiredEvent) {
              foundEvent = true;
              eventIndex = i + 1;
              break;
            }
          }
          
          if (foundEvent) {
            completedSteps++;
          } else {
            break;
          }
        }
        
        if (completedSteps === index + 1) {
          usersInStep++;
        }
      });
      
      return {
        step,
        users: usersInStep,
        percentage: index === 0 ? 100 : 0
      };
    });

    // Calculate conversion percentages
    if (stepCounts.length > 0) {
      const firstStepUsers = stepCounts[0].users;
      stepCounts.forEach((stepData, index) => {
        stepData.percentage = firstStepUsers > 0 
          ? Math.round((stepData.users / firstStepUsers) * 100)
          : 0;
        stepData.dropOff = index > 0 
          ? stepCounts[index - 1].users - stepData.users
          : 0;
      });
    }

    return stepCounts;
  }, [data, selectedSteps, userIdField, eventField, timestampField]);

  const chartData = useMemo(() => {
    if (!funnelData) return null;

    return {
      labels: funnelData.map(item => item.step),
      datasets: [
        {
          label: 'Users',
          data: funnelData.map(item => item.users),
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
          ].slice(0, funnelData.length),
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
          ].slice(0, funnelData.length),
          borderWidth: 1
        }
      ]
    };
  }, [funnelData]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Funnel Analysis'
      },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const index = context.dataIndex;
            const stepData = funnelData[index];
            return [
              `Conversion: ${stepData.percentage}%`,
              index > 0 ? `Drop-off: ${stepData.dropOff} users` : ''
            ].filter(Boolean);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Users'
        }
      }
    }
  };

  const handleStepAdd = (event) => {
    if (event && !selectedSteps.includes(event)) {
      setSelectedSteps([...selectedSteps, event]);
    }
  };

  const handleStepRemove = (index) => {
    const newSteps = [...selectedSteps];
    newSteps.splice(index, 1);
    setSelectedSteps(newSteps);
  };

  const handleMoveStep = (fromIndex, toIndex) => {
    const newSteps = [...selectedSteps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    setSelectedSteps(newSteps);
  };

  if (!data) {
    return (
      <div className="funnel-visualizer">
        <div className="no-data">
          <h2>📊 Funnel Visualizer</h2>
          <p>Please import data first to create your funnel analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="funnel-visualizer">
      <div className="config-section">
        <h2>📊 Configure Your Funnel</h2>
        <p>Set up your funnel steps to analyze user conversion and drop-off points.</p>
        
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

        <div className="steps-config">
          <h3>Funnel Steps</h3>
          <div className="add-step">
            <select onChange={(e) => handleStepAdd(e.target.value)} value="">
              <option value="">Select an event to add as step</option>
              {availableEvents.map(event => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>
          </div>
          
          <div className="steps-list">
            {selectedSteps.map((step, index) => (
              <div key={index} className="step-item">
                <span className="step-number">{index + 1}</span>
                <span className="step-name">{step}</span>
                <div className="step-actions">
                  {index > 0 && (
                    <button onClick={() => handleMoveStep(index, index - 1)}>↑</button>
                  )}
                  {index < selectedSteps.length - 1 && (
                    <button onClick={() => handleMoveStep(index, index + 1)}>↓</button>
                  )}
                  <button onClick={() => handleStepRemove(index)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {funnelData && funnelData.length > 0 && (
        <div className="visualization-section">
          <div className="funnel-chart">
            <Bar data={chartData} options={chartOptions} />
          </div>
          
          <div className="funnel-stats">
            <h3>📈 Conversion Statistics</h3>
            <div className="stats-grid">
              {funnelData.map((stepData, index) => (
                <div key={index} className="stat-card">
                  <div className="stat-title">Step {index + 1}: {stepData.step}</div>
                  <div className="stat-values">
                    <div className="stat-value">
                      <span className="value">{stepData.users}</span>
                      <span className="label">Users</span>
                    </div>
                    <div className="stat-value">
                      <span className="value">{stepData.percentage}%</span>
                      <span className="label">Conversion</span>
                    </div>
                    {index > 0 && (
                      <div className="stat-value drop-off">
                        <span className="value">{stepData.dropOff}</span>
                        <span className="label">Drop-off</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunnelVisualizer;
