import { formatTs } from '../lib/events';
import './UserFlowDiagram.css';

// Lets the user pick one journey (session/user) when the dataset contains many.
// With allLabel, an extra first option (value '') stands for every journey.
export default function JourneyPicker({ journeys, value, onChange, className = 'rf-select', allLabel, id }) {
  if (journeys.size <= 1) return null;
  return (
    <select id={id} className={className} value={value} onChange={e => onChange(e.target.value)}>
      {allLabel && <option value="">{allLabel}</option>}
      {Array.from(journeys.entries()).map(([key, evs]) => (
        <option key={key} value={key}>
          {key} ({evs.length} events{Number.isFinite(evs[0].ts) ? `, ${formatTs(evs[0].ts)}` : ''})
        </option>
      ))}
    </select>
  );
}

export function EventModal({ event, onClose }) {
  if (!event) return null;
  const rows = [
    ['Event', event.name],
    ['Page / screen', event.page],
    ['Category', event.group],
    ['Time', formatTs(event.ts)],
    ['User', event.userId],
    ['Session', event.sessionId],
  ].filter(([, v]) => v);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><h3>Event details</h3></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="event-summary">
            <div className="summary-card">
              <div className="summary-grid">
                {rows.map(([label, value]) => (
                  <div key={label} className="summary-item">
                    <span className="summary-label">{label}</span>
                    <span className="summary-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="event-details">
            <h4>Raw event</h4>
            <pre className="details-json">{JSON.stringify(event.raw, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
