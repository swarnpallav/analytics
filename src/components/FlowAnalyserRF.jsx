import { useMemo, useState } from 'react';
import ReactFlow, { MiniMap, Controls, Background, Handle, Position, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import _ from 'lodash';
import { groupJourneys } from '../lib/events';
import JourneyPicker, { EventModal } from './JourneyPicker';
import './UserFlowDiagram.css';
import './FlowAnalyserRF.css';

const topCounts = (events, key, n = 8) => Object.entries(_.countBy(events.filter(e => e[key]), key))
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
  .slice(0, n);

function compactNode(id, label, position) {
  return {
    id,
    data: { label },
    position,
    style: {
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: 12,
      width: 280,
      height: 90,
      fontSize: 14,
      lineHeight: 1.3,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }
  };
}

function buildNodesAndEdges(events, COLS, layoutMode, nodeStyle, edgeColor) {
  const COL_WIDTH = 340; // increased for more horizontal spacing between nodes
  const ROW_HEIGHT = 200; // increased for more vertical spacing between nodes

  const colFor = (i) => {
    const row = Math.floor(i / COLS);
    const within = i % COLS;
    return layoutMode === 'snake' ? (row % 2 === 0 ? within : (COLS - 1 - within)) : within;
  };

  const nodes = events.map((e, i) => {
    const position = { x: colFor(i) * COL_WIDTH, y: Math.floor(i / COLS) * ROW_HEIGHT };
    if (nodeStyle === 'compact') {
      return compactNode(String(i), e.page ? `${e.page} → ${e.name}` : e.name, position);
    }
    return {
      id: String(i),
      type: 'eventNode',
      data: { page: e.page, name: e.name, group: e.group, step: i + 1 },
      position
    };
  });

  const edges = events.slice(0, -1).map((_, i) => {
    const fromRow = Math.floor(i / COLS);
    const toRow = Math.floor((i + 1) / COLS);

    // Left -> Right within the same row; otherwise go Down to next row
    let sourceHandle = 'bottom';
    let targetHandle = 'top';
    if (fromRow === toRow) {
      const reversed = layoutMode === 'snake' && fromRow % 2 === 1; // odd row goes right -> left
      sourceHandle = reversed ? 'left' : 'right';
      targetHandle = reversed ? 'right' : 'left';
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

function buildLanesByPage(events, nodeStyle, edgeColor) {
  const COL_WIDTH = 360; // more horizontal spacing per lane
  const ROW_HEIGHT = 180; // more vertical spacing between lane rows
  const lanePadding = 24; // extra padding inside lanes

  const pageOf = e => e.page || 'UNKNOWN';
  const pageOrder = _.uniq(events.map(pageOf));
  const colByPage = Object.fromEntries(pageOrder.map((s, i) => [s, i]));
  const counts = Object.fromEntries(pageOrder.map(s => [s, 0]));

  const nodes = [];
  const edges = [];

  events.forEach((e, i) => {
    const page = pageOf(e);
    const col = colByPage[page];
    const row = counts[page];
    counts[page] = row + 1;
    const position = { x: col * COL_WIDTH + lanePadding, y: row * ROW_HEIGHT + lanePadding };

    if (nodeStyle === 'compact') {
      nodes.push({ ...compactNode(String(i), e.name, position), zIndex: 1 });
    } else {
      nodes.push({
        id: String(i),
        type: 'eventNode',
        data: { page, name: e.name, group: e.group, step: i + 1 },
        position,
        zIndex: 1
      });
    }

    if (i < events.length - 1) {
      const next = i + 1;
      const fromCol = colByPage[page];
      const toCol = colByPage[pageOf(events[next])];
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
  pageOrder.forEach(page => {
    nodes.push({
      id: `lane-${page}`,
      type: 'laneNode',
      data: { title: page },
      position: { x: colByPage[page] * COL_WIDTH, y: 0 },
      style: { width: COL_WIDTH - 8, height: maxRows * ROW_HEIGHT + lanePadding * 2 },
      draggable: false,
      selectable: false,
      zIndex: 0
    });
  });

  return { nodes, edges };
}

const EventNode = ({ data }) => (
  <div className="flow-node">
    <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0 }} />
    <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
    <div className="fn-header">
      {data.page && <span className="badge-screen">{data.page}</span>}
      <span className="badge-screen" style={{ background:'#eef2ff', borderColor:'#c7d2fe', color:'#3730a3' }}>Step {data.step}</span>
    </div>
    <div className="fn-body">
      <h4 className="title">{data.name}</h4>
      {data.group && <p className="subtitle">{data.group}</p>}
    </div>
    <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
  </div>
);

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

const nodeTypes = { eventNode: EventNode, laneNode: LaneNode };

function CountChart({ title, data, color }) {
  return (
    <div className="rf-card" style={{ height: 200 }}>
      <div className="rf-card-body" style={{ height: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{title}</div>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data}>
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="value" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function FlowAnalyserRF({ events }) {
  const [journey, setJourney] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [cols, setCols] = useState(3);
  const [layoutMode, setLayoutMode] = useState('snake'); // 'snake' | 'row'
  const [groupByPage, setGroupByPage] = useState(false);
  const [nodeSkin, setNodeSkin] = useState('card'); // 'card' | 'compact'
  const [edgeColor, setEdgeColor] = useState('#94a3b8');

  const journeys = useMemo(() => groupJourneys(events), [events]);
  const activeJourney = journeys.has(journey) ? journey : journeys.keys().next().value;
  const usable = useMemo(() => journeys.get(activeJourney) || [], [journeys, activeJourney]);
  const categories = useMemo(() => _.uniq(usable.map(e => e.group).filter(Boolean)).sort(), [usable]);
  const filtered = useMemo(() => usable.filter(e => category === 'all' || e.group === category), [usable, category]);

  const { nodes, edges } = useMemo(() => groupByPage
    ? buildLanesByPage(filtered, nodeSkin, edgeColor)
    : buildNodesAndEdges(filtered, cols, layoutMode, nodeSkin, edgeColor)
  , [filtered, cols, layoutMode, groupByPage, nodeSkin, edgeColor]);

  const eventCounts = useMemo(() => topCounts(filtered, 'name'), [filtered]);
  const pageCounts = useMemo(() => topCounts(filtered, 'page'), [filtered]);

  if (!usable.length) {
    return <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>Import data to see the journey graph.</div>;
  }

  return (
    <div className="flow-analyser-rf" style={{ padding: 16 }}>
      <div className="rf-panel">
        <div className="rf-card rf-filters">
          <div className="rf-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {journeys.size > 1 && (
              <div>
                <label>Journey ({journeys.size})</label>
                <JourneyPicker journeys={journeys} value={activeJourney} onChange={setJourney} />
              </div>
            )}
            {categories.length > 0 && (
              <div>
                <label>Category</label>
                <select className="rf-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gap: 12 }}>
              <CountChart title="Top events" data={eventCounts} color="#3b82f6" />
              {pageCounts.length > 0 && <CountChart title="Top pages" data={pageCounts} color="#10b981" />}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12 }}>
          <div className="rf-legend">
            <div className="rf-stats">
              <span className="rf-stat">Events: {filtered.length}</span>
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
              <select className="rf-select" value={groupByPage ? 'page' : 'none'} onChange={(e) => setGroupByPage(e.target.value === 'page')} style={{ width: 120 }}>
                <option value="none">None</option>
                <option value="page">By Page</option>
              </select>
              <label style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>Skin</label>
              <select className="rf-select" value={nodeSkin} onChange={(e) => setNodeSkin(e.target.value)} style={{ width: 120 }}>
                <option value="card">Rich Card</option>
                <option value="compact">Compact</option>
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
                  const event = filtered[Number(node.id)];
                  if (event) setSelectedEvent(event);
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

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
