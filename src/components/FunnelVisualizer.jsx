import { useState, useMemo } from 'react';
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

const stepLabel = s => (s.type === 'page' ? `Visited ${s.value}` : s.value);
const matches = (e, s) => (s.type === 'page' ? e.page === s.value : e.name === s.value);

const FunnelVisualizer = ({ events }) => {
  const [selectedSteps, setSelectedSteps] = useState([]);

  // Count conversions per user when users are known, otherwise per session.
  const unit = events.some(e => e.userId) ? 'user' : events.some(e => e.sessionId) ? 'session' : null;
  const unitLabel = unit === 'session' ? 'Sessions' : 'Users';

  const availableEvents = useMemo(() => _.uniq(events.map(e => e.name)).sort(), [events]);
  const availablePages = useMemo(() => _.uniq(events.map(e => e.page).filter(Boolean)).sort(), [events]);

  const funnelData = useMemo(() => {
    if (!selectedSteps.length) return null;
    const journeys = Object.values(_.groupBy(events, e => (unit === 'user' ? e.userId : unit === 'session' ? e.sessionId : 'all')));

    // For each journey, how many steps were completed in order (events are already time-sorted).
    const reached = journeys.map(evs => {
      let step = 0;
      for (const e of evs) {
        if (step < selectedSteps.length && matches(e, selectedSteps[step])) step++;
      }
      return step;
    });

    const counts = selectedSteps.map((step, index) => ({
      step: stepLabel(step),
      users: reached.filter(r => r > index).length
    }));
    const first = counts[0].users;
    return counts.map((c, index) => ({
      ...c,
      percentage: first > 0 ? Math.round((c.users / first) * 100) : 0,
      stepConversion: index === 0 ? 100 : (counts[index - 1].users > 0 ? Math.round((c.users / counts[index - 1].users) * 100) : 0),
      dropOff: index > 0 ? counts[index - 1].users - c.users : 0
    }));
  }, [events, selectedSteps, unit]);

  const chartData = useMemo(() => {
    if (!funnelData) return null;
    return {
      labels: funnelData.map(item => item.step),
      datasets: [
        {
          label: unitLabel,
          data: funnelData.map(item => item.users),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    };
  }, [funnelData, unitLabel]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Funnel Analysis' },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const index = context.dataIndex;
            const stepData = funnelData[index];
            return [
              `Conversion: ${stepData.percentage}%`,
              index > 0 ? `Drop-off: ${stepData.dropOff}` : ''
            ].filter(Boolean);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: `Number of ${unitLabel.toLowerCase()}` }
      }
    }
  };

  const handleStepAdd = (encoded) => {
    if (!encoded) return;
    const [type, ...rest] = encoded.split(':');
    const step = { type, value: rest.join(':') };
    if (!selectedSteps.some(s => s.type === step.type && s.value === step.value)) {
      setSelectedSteps([...selectedSteps, step]);
    }
  };

  const handleStepRemove = (index) => {
    setSelectedSteps(selectedSteps.filter((_, i) => i !== index));
  };

  const handleMoveStep = (fromIndex, toIndex) => {
    const newSteps = [...selectedSteps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    setSelectedSteps(newSteps);
  };

  return (
    <div className="funnel-visualizer">
      <div className="config-section">
        <h2>📊 Build your funnel</h2>
        <p>
          Pick the events or pages that make up the journey, in order.
          {unit
            ? ` Conversion is counted per ${unit}; steps must happen in this order.`
            : ' No user or session field is mapped, so the whole dataset is treated as a single journey. Map one on the Import tab for real conversion rates.'}
        </p>

        <div className="steps-config">
          <h3>Funnel Steps</h3>
          <div className="add-step">
            <select onChange={(e) => handleStepAdd(e.target.value)} value="">
              <option value="">Add a step…</option>
              <optgroup label="Events">
                {availableEvents.map(name => <option key={`e-${name}`} value={`event:${name}`}>{name}</option>)}
              </optgroup>
              {availablePages.length > 0 && (
                <optgroup label="Pages / screens">
                  {availablePages.map(page => <option key={`p-${page}`} value={`page:${page}`}>{page}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div className="steps-list">
            {selectedSteps.map((step, index) => (
              <div key={`${step.type}-${step.value}`} className="step-item">
                <span className="step-number">{index + 1}</span>
                <span className="step-name">{stepLabel(step)}</span>
                <div className="step-actions">
                  {index > 0 && <button onClick={() => handleMoveStep(index, index - 1)}>↑</button>}
                  {index < selectedSteps.length - 1 && <button onClick={() => handleMoveStep(index, index + 1)}>↓</button>}
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
                      <span className="label">{unitLabel}</span>
                    </div>
                    <div className="stat-value">
                      <span className="value">{stepData.percentage}%</span>
                      <span className="label">Of step 1</span>
                    </div>
                    {index > 0 && (
                      <>
                        <div className="stat-value">
                          <span className="value">{stepData.stepConversion}%</span>
                          <span className="label">Of previous</span>
                        </div>
                        <div className="stat-value drop-off">
                          <span className="value">{stepData.dropOff}</span>
                          <span className="label">Drop-off</span>
                        </div>
                      </>
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
