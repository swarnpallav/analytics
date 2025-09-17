import { useMemo, useState } from 'react';
import ReactFlow, { MiniMap, Controls, Background, Handle, Position, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import _ from 'lodash';
import './UserFlowDiagram.css';
import './FlowAnalyserRF.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A020F0'];

function buildFilters(data) {
  const categories = Array.from(new Set(data.map(e => e.category))).filter(Boolean).sort();
  const hookNames = Array.from(new Set(data.map(e => e.label?.hook_name))).filter(Boolean).sort();
  const hookScreens = Array.from(new Set(data.map(e => e.label?.hook_screen))).filter(Boolean).sort();
  return { categories, hookNames, hookScreens };
}

function buildNodesAndEdges(events, COLS, layoutMode, nodeStyle, edgeColor) {
  const COL_WIDTH = 340; // increased for more horizontal spacing between nodes
  const ROW_HEIGHT = 200; // increased for more vertical spacing between nodes

  const nodes = events.map((e, i) => {
    const row = Math.floor(i / COLS);
    const within = i % COLS;
    const col = layoutMode === 'snake'
      ? (row % 2 === 0 ? within : (COLS - 1 - within))
      : within;
    if (nodeStyle === 'gpt') {
      const label = `${e.screenName || 'unknown'} → ${e.action}`;
      return {
        id: String(i),
        data: { label },
        position: { x: col * COL_WIDTH, y: row * ROW_HEIGHT },
        style: {
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 12,
          width: 280,
          height: 90,
          fontSize: 14,
          lineHeight: 1.3,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          borderLeft: e.label?.hook_name ? '6px solid #10b981' : '1px solid #e2e8f0'
        }
      };
    }
    return {
      id: String(i),
      type: 'eventNode',
      data: {
        screen: e.screenName || 'UNKNOWN',
        action: e.action,
        category: e.category,
        hook: e.label?.hook_name,
        hook_screen: e.label?.hook_screen,
        step: i + 1
      },
      position: { x: col * COL_WIDTH, y: row * ROW_HEIGHT }
    };
  });

  const edges = events.slice(0, -1).map((_, i) => {
    const fromRow = Math.floor(i / COLS);
    const fromWithin = i % COLS;
    const fromCol = layoutMode === 'snake'
      ? (fromRow % 2 === 0 ? fromWithin : (COLS - 1 - fromWithin))
      : fromWithin;
    const toIndex = i + 1;
    const toRow = Math.floor(toIndex / COLS);
    const toWithin = toIndex % COLS;
    const toCol = layoutMode === 'snake'
      ? (toRow % 2 === 0 ? toWithin : (COLS - 1 - toWithin))
      : toWithin;

    // Left -> Right within the same row; otherwise go Down to next row
    const isSameRowNext = fromRow === toRow;
    let sourceHandle = 'right';
    let targetHandle = 'left';
    if (isSameRowNext) {
      if (layoutMode === 'snake' && (fromRow % 2 === 1)) {
        // odd row goes right -> left
        sourceHandle = 'left';
        targetHandle = 'right';
      } else {
        sourceHandle = 'right';
        targetHandle = 'left';
      }
    } else {
      sourceHandle = 'bottom';
      targetHandle = 'top';
    }

    return {
      id: `e${i}-${i + 1}`,
      source: String(i),
      target: String(i + 1),
      sourceHandle,
      targetHandle,
      animated: true,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: edgeColor },
      style: { stroke: edgeColor, strokeWidth: 2 }
    };
  });

  return { nodes, edges };
}

function buildLanesByScreen(events, nodeStyle, edgeColor) {
  const COL_WIDTH = 360; // more horizontal spacing per lane
  const ROW_HEIGHT = 180; // more vertical spacing between lane rows
  const lanePadding = 24; // extra padding inside lanes

  const screenOrder = [];
  const seen = new Set();
  events.forEach(e => {
    const s = e.screenName || 'UNKNOWN';
    if (!seen.has(s)) { seen.add(s); screenOrder.push(s); }
  });

  const colByScreen = Object.fromEntries(screenOrder.map((s, i) => [s, i]));
  const counts = Object.fromEntries(screenOrder.map(s => [s, 0]));

  const nodes = [];
  const edges = [];

  events.forEach((e, i) => {
    const screen = e.screenName || 'UNKNOWN';
    const col = colByScreen[screen];
    const row = counts[screen];
    counts[screen] = row + 1;

    if (nodeStyle === 'gpt') {
      const label = `${screen} → ${e.action}`;
      nodes.push({
        id: String(i),
        data: { label },
        position: { x: col * COL_WIDTH + lanePadding, y: row * ROW_HEIGHT + lanePadding },
        zIndex: 1,
        style: {
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 12,
          width: 280,
          height: 90,
          fontSize: 14,
          lineHeight: 1.3,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          borderLeft: e.label?.hook_name ? '6px solid #10b981' : '1px solid #e2e8f0'
        }
      });
    } else {
      nodes.push({
        id: String(i),
        type: 'eventNode',
        data: {
          screen,
          action: e.action,
          category: e.category,
          hook: e.label?.hook_name,
          hook_screen: e.label?.hook_screen,
          step: i + 1
        },
        position: { x: col * COL_WIDTH + lanePadding, y: row * ROW_HEIGHT + lanePadding },
        zIndex: 1
      });
    }

    if (i < events.length - 1) {
      const next = i + 1;
      const fromCol = colByScreen[events[i].screenName || 'UNKNOWN'];
      const toCol = colByScreen[events[next].screenName || 'UNKNOWN'];
      const sourceHandle = fromCol === toCol ? 'bottom' : (fromCol < toCol ? 'right' : 'left');
      const targetHandle = fromCol === toCol ? 'top' : (fromCol < toCol ? 'left' : 'right');
      edges.push({
        id: `e${i}-${next}`,
        source: String(i),
        target: String(next),
        sourceHandle,
        targetHandle,
        animated: true,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: edgeColor },
        style: { stroke: edgeColor, strokeWidth: 2 }
      });
    }
  });

  const maxRows = Math.max(1, ...Object.values(counts));
  screenOrder.forEach(screen => {
    const col = colByScreen[screen];
    nodes.push({
      id: `lane-${screen}`,
      type: 'laneNode',
      data: { title: screen },
      position: { x: col * COL_WIDTH, y: 0 },
      style: { width: COL_WIDTH - 8, height: maxRows * ROW_HEIGHT + lanePadding * 2 },
      draggable: false,
      selectable: false,
      zIndex: 0
    });
  });

  return { nodes, edges };
}

export default function FlowAnalyserRF({ data }) {
  const [category, setCategory] = useState('all');
  const [hookName, setHookName] = useState('all');
  const [hookScreen, setHookScreen] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cols, setCols] = useState(3);
  const [layoutMode, setLayoutMode] = useState('snake'); // 'snake' | 'row'
  const [groupByScreen, setGroupByScreen] = useState(false);
  const [nodeSkin, setNodeSkin] = useState('card'); // 'card' | 'gpt'
  const [edgeColor, setEdgeColor] = useState('#94a3b8');

  const usable = Array.isArray(data) ? data : [];
  const { categories, hookNames, hookScreens } = useMemo(() => buildFilters(usable), [usable]);

  const filtered = useMemo(() => usable.filter(e => {
    if (category !== 'all' && e.category !== category) return false;
    if (hookName !== 'all' && e.label?.hook_name !== hookName) return false;
    if (hookScreen !== 'all' && e.label?.hook_screen !== hookScreen) return false;
    return true;
  }), [usable, category, hookName, hookScreen]);

  const { nodes, edges } = useMemo(() => groupByScreen
    ? buildLanesByScreen(filtered, nodeSkin, edgeColor)
    : buildNodesAndEdges(filtered, cols, layoutMode, nodeSkin, edgeColor)
  , [filtered, cols, layoutMode, groupByScreen, nodeSkin, edgeColor]);

  const EventNode = ({ data }) => {
    const hasHook = Boolean(data.hook);
    return (
      <div className={`flow-node ${hasHook ? 'hook' : ''}`}>
        <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0 }} />
        <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
        <div className="fn-header">
          <span className="badge-screen">{data.screen}</span>
          <span className="badge-screen" style={{ background:'#eef2ff', borderColor:'#c7d2fe', color:'#3730a3' }}>Step {data.step}</span>
          {hasHook && <span className="badge-hook">HOOK</span>}
        </div>
        <div className="fn-body">
          <h4 className="title">{data.action}</h4>
          <p className="subtitle">{data.category}</p>
          <div className="chips">
            {hasHook && <span className="chip">{data.hook}</span>}
            {data.hook_screen && <span className="chip">{data.hook_screen}</span>}
          </div>
        </div>
        <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      </div>
    );
  };

  const LaneNode = ({ data }) => (
    <div style={{
      width: '100%',
      height: '100%',
      border: '2px dashed #e5e7eb',
      borderRadius: 12,
      background: '#f9fafb',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: 6, left: 10, fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
        {data.title}
      </div>
    </div>
  );

  const nodeTypes = useMemo(() => ({ eventNode: EventNode, laneNode: LaneNode }), []);

  const categoryCounts = useMemo(() => {
    const counts = _.countBy(filtered, 'category');
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const hookCounts = useMemo(() => {
    const counts = _.countBy(filtered.filter(e => e.label?.hook_name), e => e.label.hook_name);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  return (
    <div className="flow-analyser-rf" style={{ padding: 16 }}>
      {!usable.length && (
        <div style={{ textAlign: 'center', color: '#64748b' }}>Import data to use Flow Analyser.</div>
      )}

      {usable.length > 0 && (
        <div className="rf-panel">
          <div className="rf-card rf-filters">
            <div className="rf-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>Category</label>
                <select className="rf-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>Hook Name</label>
                <select className="rf-select" value={hookName} onChange={e => setHookName(e.target.value)}>
                  <option value="all">All</option>
                  {hookNames.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label>Hook Screen</label>
                <select className="rf-select" value={hookScreen} onChange={e => setHookScreen(e.target.value)}>
                  <option value="all">All</option>
                  {hookScreens.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button className="rf-reset" onClick={() => { setCategory('all'); setHookName('all'); setHookScreen('all'); }}>Reset</button>
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="rf-card" style={{ height: 180 }}>
                  <div className="rf-card-body" style={{ height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryCounts}>
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rf-card" style={{ height: 180 }}>
                  <div className="rf-card-body" style={{ height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={hookCounts} dataKey="value" nameKey="name" outerRadius={70}>
                          {hookCounts.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12 }}>
            <div className="rf-legend">
              <span className="rf-dot blue"></span>
              <span>Standard</span>
              <span className="rf-dot green"></span>
              <span>Hook</span>
              <span className="divider"></span>
              <div className="rf-stats">
                <span className="rf-stat">Events: {filtered.length}</span>
                <span className="rf-stat">Direction: Top → Bottom</span>
              </div>
              <span className="divider"></span>
              <div className="rf-stats">
                <label style={{ fontSize: 12, color: '#374151' }}>Columns</label>
                <select className="rf-select" value={cols} onChange={(e) => setCols(Number(e.target.value))} style={{ width: 80 }}>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
                <label style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>Layout</label>
                <select className="rf-select" value={layoutMode} onChange={(e) => setLayoutMode(e.target.value)} style={{ width: 110 }}>
                  <option value="snake">Snake</option>
                  <option value="row">Left → Right</option>
                </select>
                <label style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>Group</label>
                <select className="rf-select" value={groupByScreen ? 'screen' : 'none'} onChange={(e) => setGroupByScreen(e.target.value === 'screen')} style={{ width: 120 }}>
                  <option value="none">None</option>
                  <option value="screen">By Screen</option>
                </select>
                <label style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>Skin</label>
                <select className="rf-select" value={nodeSkin} onChange={(e) => setNodeSkin(e.target.value)} style={{ width: 120 }}>
                  <option value="card">Rich Card</option>
                  <option value="gpt">GPT Label</option>
                </select>
                <label style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>Edge</label>
                <select className="rf-select" value={edgeColor} onChange={(e) => setEdgeColor(e.target.value)} style={{ width: 120 }}>
                  <option value="#94a3b8">Slate</option>
                  <option value="#3b82f6">Blue</option>
                  <option value="#10b981">Green</option>
                  <option value="#ef4444">Red</option>
                  <option value="#f59e0b">Amber</option>
                </select>
              </div>
            </div>
            <div className="rf-card" style={{ height: '70vh' }}>
              <div className="rf-card-body" style={{ height: '100%', padding: 0 }}>
                <ReactFlow 
                  nodes={nodes} 
                  edges={edges} 
                  fitView
                  nodeTypes={nodeTypes}
                  onNodeClick={(_, node) => {
                    const idx = Number(node.id);
                    const event = filtered[idx];
                    if (event) {
                      setSelectedEvent(event);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <MiniMap />
                  <Controls />
                  <Background gap={16} color="#f1f5f9" />
                </ReactFlow>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedEvent && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h3>📊 Event Details</h3>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="event-summary">
                <div className="summary-card">
                  <h4>🎯 Event Summary</h4>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Screen</span>
                      <span className="summary-value">{selectedEvent.screenName || 'Unknown'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Action</span>
                      <span className="summary-value">{selectedEvent.action || 'Unknown'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Category</span>
                      <span className="summary-value">{selectedEvent.category || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {(selectedEvent.label?.hook_name || selectedEvent.label?.hook_screen) && (
                <div className="hook-info-section">
                  <h4>🎯 Hook Information</h4>
                  <div className="hook-details">
                    {selectedEvent.label?.hook_name && (
                      <div className="hook-item">
                        <span className="hook-label">Hook Name:</span>
                        <span className="hook-value">{selectedEvent.label.hook_name}</span>
                      </div>
                    )}
                    {selectedEvent.label?.hook_screen && (
                      <div className="hook-item">
                        <span className="hook-label">Hook Screen:</span>
                        <span className="hook-value">{selectedEvent.label.hook_screen}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedEvent.label && Object.keys(selectedEvent.label).length > 0 && (
                <div className="event-details">
                  <h4>📋 Label Data</h4>
                  <pre className="details-json">{JSON.stringify(selectedEvent.label, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
