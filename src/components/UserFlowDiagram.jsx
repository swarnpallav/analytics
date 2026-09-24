import { useState, useMemo } from 'react';
import _ from 'lodash';
import { formatTs, groupJourneys } from '../lib/events';
import JourneyPicker, { EventModal } from './JourneyPicker';
import './UserFlowDiagram.css';

const UserFlowDiagram = ({ events }) => {
  const [journey, setJourney] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('sequential'); // 'sequential' or 'grouped'

  const journeys = useMemo(() => groupJourneys(events), [events]);
  const activeJourney = journeys.has(journey) ? journey : journeys.keys().next().value;
  const sequence = useMemo(() => journeys.get(activeJourney) || [], [journeys, activeJourney]);

  const flowData = useMemo(() => {
    const pages = Object.entries(_.groupBy(sequence, e => e.page || 'Unknown')).map(([page, evs]) => ({
      page,
      events: _.uniqBy(evs, 'name'),
      totalEvents: evs.length
    }));

    const pageTransitions = new Map();
    for (let i = 0; i < sequence.length - 1; i++) {
      const from = sequence[i].page || 'Unknown';
      const to = sequence[i + 1].page || 'Unknown';
      if (from === to) continue;
      const key = `${from}->${to}`;
      const t = pageTransitions.get(key) || { key, from, to, count: 0 };
      t.count++;
      pageTransitions.set(key, t);
    }

    return {
      pages,
      pageTransitions: Array.from(pageTransitions.values()).sort((a, b) => b.count - a.count)
    };
  }, [sequence]);

  if (!sequence.length) {
    return (
      <div className="user-flow-diagram">
        <div className="no-data">
          <h2>🔄 Journey Timeline</h2>
          <p>Please import data first to visualize user journeys.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-flow-diagram">
      <div className="flow-header">
        <h2>🔄 Journey Timeline</h2>
        <p>Step-by-step view of one user journey across pages and screens</p>

        <div className="flow-controls">
          <div className="view-mode-selector">
            <label>
              <input
                type="radio"
                name="viewMode"
                value="sequential"
                checked={viewMode === 'sequential'}
                onChange={(e) => setViewMode(e.target.value)}
              />
              📊 Sequential Flow
            </label>
            <label>
              <input
                type="radio"
                name="viewMode"
                value="grouped"
                checked={viewMode === 'grouped'}
                onChange={(e) => setViewMode(e.target.value)}
              />
              📋 Grouped by Page
            </label>
          </div>
          <JourneyPicker journeys={journeys} value={activeJourney} onChange={setJourney} className="filter-toggle" />
        </div>

        <div className="flow-stats">
          <div className="stat-item">
            <span className="stat-value">{sequence.length}</span>
            <span className="stat-label">Events</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{flowData.pages.length}</span>
            <span className="stat-label">Pages</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{journeys.size}</span>
            <span className="stat-label">Journeys</span>
          </div>
        </div>
      </div>

      <div className="flow-diagram">
        {viewMode === 'sequential' ? (
          <div className="sequential-flow">
            <div className="flow-container">
              <div className="flow-timeline">
                {sequence.map((event, index) => (
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-marker">
                      <div className="timeline-dot">{index + 1}</div>
                      {index < sequence.length - 1 && <div className="timeline-line"></div>}
                    </div>

                    <div className="timeline-content">
                      <div className="event-card" onClick={() => setSelectedEvent(event)}>
                        <div className="event-header">
                          {event.page && <div className="screen-badge">{event.page}</div>}
                        </div>

                        <div className="event-body">
                          <h3 className="event-title">{event.name}</h3>
                          {event.group && <p className="event-subtitle">{event.group}</p>}
                          <div className="event-meta">
                            <span className="meta-count">{formatTs(event.ts)}</span>
                            <span className="click-hint">Click for details</span>
                          </div>
                        </div>

                        <div className="event-footer">
                          <div className="event-index">#{index + 1}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grouped-view">
            <div className="screens-container">
              {flowData.pages.map(page => (
                <div key={page.page} className="screen-node">
                  <div className="screen-header">
                    <h3>{page.page}</h3>
                    <div className="screen-meta">
                      <span className="event-count">{page.totalEvents} events</span>
                    </div>
                  </div>

                  <div className="events-list">
                    {page.events.slice(0, 8).map(event => (
                      <div
                        key={event.id}
                        className="event-item"
                        onClick={() => setSelectedEvent(event)}
                        title="Click to view details"
                      >
                        <div className="event-action">{event.name}</div>
                        {event.group && <div className="event-category">{event.group}</div>}
                      </div>
                    ))}

                    {page.events.length > 8 && (
                      <div className="more-events">+{page.events.length - 8} more events</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {flowData.pageTransitions.length > 0 && (
              <div className="transitions-section">
                <h3>🔄 Page Transitions</h3>
                <div className="transitions-list">
                  {flowData.pageTransitions.slice(0, 10).map(transition => (
                    <div key={transition.key} className="transition-item">
                      <div className="transition-flow">
                        <span className="from-screen">{transition.from}</span>
                        <span className="arrow">→</span>
                        <span className="to-screen">{transition.to}</span>
                      </div>
                      <div className="transition-count">{transition.count} times</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};

export default UserFlowDiagram;
