import { useState, useEffect, useMemo } from 'react';
import _ from 'lodash';
import './UserFlowDiagram.css';

const EventModal = ({ event, isOpen, onClose }) => {
  if (!isOpen || !event) return null;

  const hasHookData = event.label?.hook_name || event.label?.hook_screen;
  const labelKeys = event.label ? Object.keys(event.label) : [];
  const importantFields = ['profile_id', 'owner_name', 'phone_number', 'user_type', 'service_type', 'package_id', 'listing_id'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h3>📊 Event Details</h3>
            {hasHookData && <span className="hook-badge-modal">🎯 Hook Event</span>}
            {event.index !== undefined && <span className="event-position">#{event.index + 1}</span>}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="event-summary">
            <div className="summary-card">
              <h4>🎯 Event Summary</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Screen</span>
                  <span className="summary-value">{event.screenName || 'Unknown'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Action</span>
                  <span className="summary-value">{event.action || 'Unknown'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Category</span>
                  <span className="summary-value">{event.category || 'N/A'}</span>
                </div>
                {event.timestamp && (
                  <div className="summary-item">
                    <span className="summary-label">Timestamp</span>
                    <span className="summary-value">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {hasHookData && (
            <div className="hook-info-section">
              <h4>🎯 Hook Information</h4>
              <div className="hook-details">
                {event.label?.hook_name && (
                  <div className="hook-item">
                    <span className="hook-label">Hook Name:</span>
                    <span className="hook-value">{event.label.hook_name}</span>
                  </div>
                )}
                {event.label?.hook_screen && (
                  <div className="hook-item">
                    <span className="hook-label">Hook Screen:</span>
                    <span className="hook-value">{event.label.hook_screen}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {event.label && labelKeys.length > 0 && (
            <div className="important-fields">
              <h4>📋 Key Information</h4>
              <div className="fields-grid">
                {importantFields
                  .filter(field => event.label[field] !== undefined && event.label[field] !== null && event.label[field] !== '')
                  .map(field => (
                    <div key={field} className="field-item">
                      <span className="field-label">{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                      <span className="field-value">
                        {typeof event.label[field] === 'object' 
                          ? JSON.stringify(event.label[field]) 
                          : String(event.label[field])
                        }
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
          
          {event.label && Object.keys(event.label).length > 0 && (
            <div className="event-details">
              <h4>📋 Complete Label Data</h4>
              <pre className="details-json">
                {JSON.stringify(event.label, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="event-raw">
            <h4>🔍 Raw Event Data</h4>
            <pre className="raw-json">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserFlowDiagram = ({ data }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterByHooks, setFilterByHooks] = useState(false);
  const [viewMode, setViewMode] = useState('sequential'); // 'sequential' or 'grouped'
  const [isLoading, setIsLoading] = useState(false);

  const flowData = useMemo(() => {
    if (!data || !Array.isArray(data)) return null;

    // Create sequential flow data
    const sequentialEvents = data.map((event, index) => ({
      ...event,
      id: `event-${index}`,
      index,
      hasHook: !!(event.label?.hook_name && event.label?.hook_screen),
      displayName: `${event.screenName || 'Unknown'} → ${event.action || 'Unknown Action'}`
    }));

    // Group events by screen for grouped view
    const screenGroups = _.groupBy(data, 'screenName');
    
    const screens = Object.entries(screenGroups).map(([screenName, events]) => {
      const uniqueActions = _.uniqBy(events, 'action');
      const hookEvents = events.filter(e => e.label?.hook_name && e.label?.hook_screen);
      
      return {
        screenName: screenName || 'Unknown',
        events: uniqueActions,
        hookEvents,
        totalEvents: events.length,
        uniqueActions: uniqueActions.length
      };
    });

    // Calculate transitions for sequential view
    const transitions = [];
    for (let i = 0; i < sequentialEvents.length - 1; i++) {
      const current = sequentialEvents[i];
      const next = sequentialEvents[i + 1];
      
      transitions.push({
        id: `transition-${i}`,
        from: current.id,
        to: next.id,
        fromEvent: current,
        toEvent: next
      });
    }

    // Calculate unique screen transitions
    const screenTransitions = [];
    for (let i = 0; i < sequentialEvents.length - 1; i++) {
      const current = sequentialEvents[i];
      const next = sequentialEvents[i + 1];
      
      if (current.screenName !== next.screenName) {
        const transitionKey = `${current.screenName}->${next.screenName}`;
        const existing = screenTransitions.find(t => t.key === transitionKey);
        
        if (existing) {
          existing.count++;
        } else {
          screenTransitions.push({
            key: transitionKey,
            from: current.screenName,
            to: next.screenName,
            count: 1,
            fromEvent: current,
            toEvent: next
          });
        }
      }
    }

    return {
      sequentialEvents,
      screens,
      transitions,
      screenTransitions,
      totalEvents: data.length,
      totalScreens: screens.length,
      hookEvents: sequentialEvents.filter(e => e.hasHook)
    };
  }, [data]);

  const filteredData = useMemo(() => {
    if (!flowData) return flowData;
    
    if (viewMode === 'sequential') {
      if (!filterByHooks) return flowData;
      
      const filteredEvents = flowData.sequentialEvents.filter(event => event.hasHook);
      const filteredTransitions = [];
      
      for (let i = 0; i < filteredEvents.length - 1; i++) {
        const current = filteredEvents[i];
        const next = filteredEvents[i + 1];
        
        filteredTransitions.push({
          id: `filtered-transition-${i}`,
          from: current.id,
          to: next.id,
          fromEvent: current,
          toEvent: next
        });
      }
      
      return {
        ...flowData,
        sequentialEvents: filteredEvents,
        transitions: filteredTransitions
      };
    } else {
      if (!filterByHooks) return flowData;
      
      const hookScreens = flowData.screens.filter(screen => screen.hookEvents.length > 0);
      return {
        ...flowData,
        screens: hookScreens
      };
    }
  }, [flowData, filterByHooks, viewMode]);

  const handleEventClick = (event) => {
    setIsLoading(true);
    // Add a small delay to show loading state
    setTimeout(() => {
      setSelectedEvent(event);
      setIsModalOpen(true);
      setIsLoading(false);
    }, 200);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedEvent(null);
    }, 300);
  };

  if (!data || !Array.isArray(data)) {
    return (
      <div className="user-flow-diagram">
        <div className="no-data">
          <h2>🔄 User Flow Diagram</h2>
          <p>Please import data first to visualize user flows.</p>
        </div>
      </div>
    );
  }

  if (!filteredData) return null;

  return (
    <div className="user-flow-diagram">
      <div className="flow-header">
        <h2>🔄 User Flow Diagram</h2>
        <p>Interactive visualization of user journey through different screens</p>
        
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
              📋 Grouped by Screen
            </label>
          </div>
          
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filterByHooks}
              onChange={(e) => setFilterByHooks(e.target.checked)}
            />
            {viewMode === 'sequential' ? 'Show only hook events' : 'Show only screens with hook data'}
          </label>
        </div>

        <div className="flow-stats">
          <div className="stat-item">
            <span className="stat-value">
              {viewMode === 'sequential' ? filteredData.sequentialEvents.length : filteredData.totalEvents}
            </span>
            <span className="stat-label">
              {viewMode === 'sequential' ? 'Flow Events' : 'Total Events'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {viewMode === 'sequential' ? filteredData.hookEvents.length : filteredData.screens.length}
            </span>
            <span className="stat-label">
              {viewMode === 'sequential' ? 'Hook Events' : 'Screens'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{filteredData.transitions.length}</span>
            <span className="stat-label">Transitions</span>
          </div>
        </div>
      </div>

      <div className="flow-diagram">
        {viewMode === 'sequential' ? (
          <div className="sequential-flow">
            <div className="flow-container">
              <div className="flow-timeline">
                {filteredData.sequentialEvents.map((event, index) => (
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-marker">
                      <div className={`timeline-dot ${event.hasHook ? 'hook-dot' : ''}`}>
                        {index + 1}
                      </div>
                      {index < filteredData.sequentialEvents.length - 1 && (
                        <div className="timeline-line"></div>
                      )}
                    </div>
                    
                    <div className="timeline-content">
                      <div
                        className={`event-card ${event.hasHook ? 'hook-event' : ''}`}
                        onClick={() => handleEventClick(event)}
                      >
                        <div className="event-header">
                          <div className="screen-badge">
                            {event.screenName || 'UNKNOWN'}
                          </div>
                          {event.hasHook && (
                            <div className="hook-indicator">
                              <span className="hook-icon">🎯</span>
                              HOOK
                            </div>
                          )}
                        </div>
                        
                        <div className="event-body">
                          <h3 className="event-title">{event.action || 'Unknown Action'}</h3>
                          <p className="event-subtitle">{event.category}</p>
                          
                          {event.hasHook && (
                            <div className="hook-details">
                              <div className="hook-item">
                                <span className="hook-label">Hook Name:</span>
                                <span className="hook-value">{event.label.hook_name}</span>
                              </div>
                              {event.label.hook_screen && (
                                <div className="hook-item">
                                  <span className="hook-label">Hook Screen:</span>
                                  <span className="hook-value">{event.label.hook_screen}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {event.label && Object.keys(event.label).length > 0 && (
                            <div className="event-meta">
                              <span className="meta-count">
                                {Object.keys(event.label).length} properties
                              </span>
                              <span className="click-hint">Click for details</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="event-footer">
                          <div className="event-index">#{index + 1}</div>
                          <div className="event-type">
                            {event.hasHook ? 'Hook Event' : 'Standard Event'}
                          </div>
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
              {filteredData.screens.map((screen, index) => (
                <div key={screen.screenName} className="screen-node">
                  <div className="screen-header">
                    <h3>{screen.screenName}</h3>
                    <div className="screen-meta">
                      <span className="event-count">{screen.totalEvents} events</span>
                      {screen.hookEvents.length > 0 && (
                        <span className="hook-indicator">🎯 {screen.hookEvents.length} hooks</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="events-list">
                    {screen.events.slice(0, 8).map((event, eventIndex) => (
                      <div
                        key={`${event.action}-${eventIndex}`}
                        className={`event-item ${event.label?.hook_name ? 'has-hook' : ''}`}
                        onClick={() => handleEventClick(event)}
                        title={`Click to view details\n${event.action} - ${event.category}`}
                      >
                        <div className="event-action">{event.action}</div>
                        <div className="event-category">{event.category}</div>
                        {event.label?.hook_name && (
                          <div className="hook-info">
                            <span className="hook-name">{event.label.hook_name}</span>
                            <span className="hook-screen">{event.label.hook_screen}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {screen.events.length > 8 && (
                      <div className="more-events">
                        +{screen.events.length - 8} more events
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredData.screenTransitions && filteredData.screenTransitions.length > 0 && (
              <div className="transitions-section">
                <h3>🔄 Screen Transitions</h3>
                <div className="transitions-list">
                  {filteredData.screenTransitions.slice(0, 10).map((transition, index) => (
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

      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
      
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default UserFlowDiagram;
