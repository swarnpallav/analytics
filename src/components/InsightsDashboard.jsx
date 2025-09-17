import { useState, useEffect, useMemo } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import _ from 'lodash';
import './InsightsDashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const InsightsDashboard = ({ data }) => {
  const [userIdField, setUserIdField] = useState('userId');
  const [eventField, setEventField] = useState('event');
  const [timestampField, setTimestampField] = useState('timestamp');
  const [availableFields, setAvailableFields] = useState([]);

  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      const sampleRecord = data[0];
      const fields = Object.keys(sampleRecord);
      setAvailableFields(fields);
    }
  }, [data]);

  const insights = useMemo(() => {
    if (!data || !userIdField || !eventField) return null;

    const userJourneys = _.groupBy(data, userIdField);
    const totalUsers = Object.keys(userJourneys).length;
    
    // Event distribution
    const eventCounts = _.countBy(data, eventField);
    const sortedEvents = Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    // User engagement metrics
    const userSessionLengths = Object.entries(userJourneys).map(([userId, events]) => ({
      userId,
      eventCount: events.length,
      uniqueEvents: _.uniq(events.map(e => e[eventField])).length
    }));

    const avgEventsPerUser = _.meanBy(userSessionLengths, 'eventCount');
    const avgUniqueEventsPerUser = _.meanBy(userSessionLengths, 'uniqueEvents');

    // Temporal analysis (if timestamp is available)
    let temporalData = null;
    if (timestampField) {
      const eventsWithTime = data
        .filter(event => event[timestampField])
        .map(event => ({
          ...event,
          parsedTime: new Date(event[timestampField])
        }))
        .filter(event => !isNaN(event.parsedTime.getTime()));

      if (eventsWithTime.length > 0) {
        // Group by hour of day
        const hourlyActivity = _.groupBy(eventsWithTime, event => 
          event.parsedTime.getHours()
        );
        
        const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: hourlyActivity[hour] ? hourlyActivity[hour].length : 0
        }));

        temporalData = {
          hourlyActivity: hourlyData,
          timeRange: {
            start: _.minBy(eventsWithTime, 'parsedTime').parsedTime,
            end: _.maxBy(eventsWithTime, 'parsedTime').parsedTime
          }
        };
      }
    }

    // Conversion analysis
    const conversionFunnel = [];
    const eventTypes = Object.keys(eventCounts);
    
    // Calculate step-by-step conversion if we have multiple event types
    if (eventTypes.length > 1) {
      eventTypes.forEach((eventType, index) => {
        const usersWithEvent = Object.entries(userJourneys).filter(([userId, events]) =>
          events.some(event => event[eventField] === eventType)
        ).length;
        
        conversionFunnel.push({
          event: eventType,
          users: usersWithEvent,
          percentage: Math.round((usersWithEvent / totalUsers) * 100)
        });
      });
    }

    return {
      totalUsers,
      totalEvents: data.length,
      uniqueEvents: Object.keys(eventCounts).length,
      eventDistribution: sortedEvents,
      avgEventsPerUser: Math.round(avgEventsPerUser * 10) / 10,
      avgUniqueEventsPerUser: Math.round(avgUniqueEventsPerUser * 10) / 10,
      userSessionLengths,
      temporalData,
      conversionFunnel
    };
  }, [data, userIdField, eventField, timestampField]);

  const eventDistributionChart = useMemo(() => {
    if (!insights) return null;

    return {
      labels: insights.eventDistribution.map(([event]) => event),
      datasets: [
        {
          data: insights.eventDistribution.map(([, count]) => count),
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384',
            '#C9CBCF',
            '#4BC0C0',
            '#36A2EB'
          ],
          hoverBackgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384',
            '#C9CBCF',
            '#4BC0C0',
            '#36A2EB'
          ]
        }
      ]
    };
  }, [insights]);

  const hourlyActivityChart = useMemo(() => {
    if (!insights?.temporalData?.hourlyActivity) return null;

    return {
      labels: insights.temporalData.hourlyActivity.map(item => `${item.hour}:00`),
      datasets: [
        {
          label: 'Events',
          data: insights.temporalData.hourlyActivity.map(item => item.count),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }
      ]
    };
  }, [insights]);

  if (!data) {
    return (
      <div className="insights-dashboard">
        <div className="no-data">
          <h2>🔍 Insights Dashboard</h2>
          <p>Please import data first to view analytics and insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-dashboard">
      <div className="config-section">
        <h2>🔍 Analytics & Insights</h2>
        <p>Discover patterns, trends, and key metrics from your data.</p>
        
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

      {insights && (
        <div className="insights-content">
          <div className="overview-metrics">
            <h3>📊 Overview Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{insights.totalUsers}</div>
                <div className="metric-label">Total Users</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{insights.totalEvents}</div>
                <div className="metric-label">Total Events</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{insights.uniqueEvents}</div>
                <div className="metric-label">Unique Events</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{insights.avgEventsPerUser}</div>
                <div className="metric-label">Avg Events/User</div>
              </div>
            </div>
          </div>

          <div className="charts-section">
            <div className="chart-container">
              <h3>📈 Event Distribution</h3>
              {eventDistributionChart && (
                <div className="chart">
                  <Doughnut 
                    data={eventDistributionChart}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'right',
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {hourlyActivityChart && (
              <div className="chart-container">
                <h3>⏰ Activity by Hour</h3>
                <div className="chart">
                  <Line 
                    data={hourlyActivityChart}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Number of Events'
                          }
                        },
                        x: {
                          title: {
                            display: true,
                            text: 'Hour of Day'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="detailed-insights">
            <div className="insight-section">
              <h3>👥 User Engagement Analysis</h3>
              <div className="engagement-stats">
                <div className="stat-row">
                  <span className="stat-label">Average events per user:</span>
                  <span className="stat-value">{insights.avgEventsPerUser}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Average unique events per user:</span>
                  <span className="stat-value">{insights.avgUniqueEventsPerUser}</span>
                </div>
              </div>
              
              <div className="user-distribution">
                <h4>User Activity Distribution</h4>
                <div className="distribution-bars">
                  {[1, 2, 3, 4, 5, '6+'].map((range, index) => {
                    const count = insights.userSessionLengths.filter(user => {
                      if (range === '6+') return user.eventCount >= 6;
                      return user.eventCount === range;
                    }).length;
                    
                    const percentage = Math.round((count / insights.totalUsers) * 100);
                    
                    return (
                      <div key={index} className="distribution-bar">
                        <span className="bar-label">{range} events</span>
                        <div className="bar-container">
                          <div 
                            className="bar-fill" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                          <span className="bar-text">{count} users ({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {insights.temporalData && (
              <div className="insight-section">
                <h3>⏱️ Temporal Insights</h3>
                <div className="temporal-stats">
                  <div className="stat-row">
                    <span className="stat-label">Data time range:</span>
                    <span className="stat-value">
                      {insights.temporalData.timeRange.start.toLocaleDateString()} - {insights.temporalData.timeRange.end.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Peak activity hour:</span>
                    <span className="stat-value">
                      {_.maxBy(insights.temporalData.hourlyActivity, 'count').hour}:00
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="insight-section">
              <h3>🎯 Top Events</h3>
              <div className="top-events">
                {insights.eventDistribution.slice(0, 5).map(([event, count], index) => (
                  <div key={index} className="event-item">
                    <div className="event-rank">#{index + 1}</div>
                    <div className="event-name">{event}</div>
                    <div className="event-stats">
                      <span className="event-count">{count} occurrences</span>
                      <span className="event-percentage">
                        ({Math.round((count / insights.totalEvents) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="insight-section">
              <h3>💡 Key Insights</h3>
              <div className="key-insights">
                <div className="insight-item">
                  <div className="insight-icon">📊</div>
                  <div className="insight-text">
                    <strong>Most Popular Event:</strong> {insights.eventDistribution[0][0]} 
                    ({insights.eventDistribution[0][1]} occurrences)
                  </div>
                </div>
                
                <div className="insight-item">
                  <div className="insight-icon">👥</div>
                  <div className="insight-text">
                    <strong>User Engagement:</strong> Average user performs {insights.avgEventsPerUser} events
                  </div>
                </div>
                
                {insights.temporalData && (
                  <div className="insight-item">
                    <div className="insight-icon">⏰</div>
                    <div className="insight-text">
                      <strong>Peak Activity:</strong> Hour {_.maxBy(insights.temporalData.hourlyActivity, 'count').hour} 
                      has the highest activity
                    </div>
                  </div>
                )}
                
                <div className="insight-item">
                  <div className="insight-icon">🔢</div>
                  <div className="insight-text">
                    <strong>Event Diversity:</strong> {insights.uniqueEvents} unique event types recorded
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsDashboard;
