import { useMemo } from 'react';
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

const InsightsDashboard = ({ events }) => {
  const unit = events.some(e => e.userId) ? 'User' : events.some(e => e.sessionId) ? 'Session' : 'Journey';

  const insights = useMemo(() => {
    if (!events.length) return null;

    const userJourneys = _.groupBy(events, e => e.userId || e.sessionId || 'all');
    const totalUsers = Object.keys(userJourneys).length;

    // Event distribution
    const eventCounts = _.countBy(events, 'name');
    const sortedEvents = Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    // User engagement metrics
    const userSessionLengths = Object.entries(userJourneys).map(([userId, evs]) => ({
      userId,
      eventCount: evs.length,
      uniqueEvents: _.uniq(evs.map(e => e.name)).length
    }));

    const avgEventsPerUser = _.meanBy(userSessionLengths, 'eventCount');
    const avgUniqueEventsPerUser = _.meanBy(userSessionLengths, 'uniqueEvents');

    // Temporal analysis (if timestamps are available)
    let temporalData = null;
    const eventsWithTime = events.filter(e => Number.isFinite(e.ts)).map(e => ({ ...e, parsedTime: new Date(e.ts) }));
    if (eventsWithTime.length > 0) {
      const hourlyActivity = _.groupBy(eventsWithTime, e => e.parsedTime.getHours());
      temporalData = {
        hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: hourlyActivity[hour] ? hourlyActivity[hour].length : 0
        })),
        timeRange: {
          start: _.minBy(eventsWithTime, 'ts').parsedTime,
          end: _.maxBy(eventsWithTime, 'ts').parsedTime
        }
      };
    }

    return {
      totalUsers,
      totalEvents: events.length,
      uniqueEvents: Object.keys(eventCounts).length,
      eventDistribution: sortedEvents,
      avgEventsPerUser: Math.round(avgEventsPerUser * 10) / 10,
      avgUniqueEventsPerUser: Math.round(avgUniqueEventsPerUser * 10) / 10,
      userSessionLengths,
      temporalData
    };
  }, [events]);

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

  if (!insights) {
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
        
      </div>

      {insights && (
        <div className="insights-content">
          <div className="overview-metrics">
            <h3>📊 Overview Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{insights.totalUsers}</div>
                <div className="metric-label">Total {unit}s</div>
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
                <div className="metric-label">Avg Events/{unit}</div>
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
                  <span className="stat-label">Average events per {unit.toLowerCase()}:</span>
                  <span className="stat-value">{insights.avgEventsPerUser}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Average unique events per {unit.toLowerCase()}:</span>
                  <span className="stat-value">{insights.avgUniqueEventsPerUser}</span>
                </div>
              </div>
              
              <div className="user-distribution">
                <h4>{unit} Activity Distribution</h4>
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
                          <span className="bar-text">{count} ({percentage}%)</span>
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
                    <strong>User Engagement:</strong> Average {unit.toLowerCase()} performs {insights.avgEventsPerUser} events
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
