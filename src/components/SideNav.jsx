import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 13v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function ChatIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function MicIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 1a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
      <path d="M19 10a7 7 0 0 1-14 0" />
      <path d="M12 19v4" />
    </svg>
  );
}

function ChevronLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Item({ to, label, icon, collapsed }) {
  const [hover, setHover] = useState(false);
  const base = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 10,
    padding: collapsed ? '10px 10px' : '12px 14px',
    borderRadius: 12,
    textDecoration: 'none',
    fontWeight: 600,
    position: 'relative',
    overflow: 'hidden',
    transition: 'background 0.15s ease, color 0.15s ease, transform 0.05s ease',
    justifyContent: collapsed ? 'center' : 'flex-start'
  };
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <NavLink to={to} title={label}
        style={({ isActive }) => ({
          ...base,
          color: isActive ? '#0b5394' : '#334155',
          background: isActive ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
          boxShadow: isActive ? 'inset 2px 0 0 0 #2563eb' : 'inset 2px 0 0 0 transparent'
        })}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 24, height: 24 }}>
          {icon}
        </span>
        {!collapsed && <span>{label}</span>}
      </NavLink>
      {collapsed && hover && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 76,
          transform: 'translateY(-50%)',
          background: '#111827',
          color: '#f9fafb',
          padding: '6px 8px',
          borderRadius: 6,
          fontSize: 12,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
          zIndex: 1000
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

export default function SideNav() {
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidenav-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  // Persisted collapse state is user preference. When collapsed, we temporarily expand on hover.
  const expanded = !collapsed || hovering;

  function setCollapsedPref(next) {
    setCollapsed(next);
    localStorage.setItem('sidenav-collapsed', next ? '1' : '0');
  }

  return (
    <aside
      style={{
        width: expanded ? 248 : 76,
        padding: 12,
        borderRight: '1px solid #e5e7eb',
        background: '#f8fafc',
        transition: 'width 0.2s ease',
        boxShadow: '0 1px 0 rgba(0,0,0,0.02), 1px 0 0 rgba(0,0,0,0.04)'
      }}
      onMouseEnter={() => { if (collapsed) setHovering(true); }}
      onMouseLeave={() => { if (collapsed) setHovering(false); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: expanded ? 'space-between' : 'center', padding: expanded ? '8px 6px' : '0' }}>
        {expanded && (
          <div style={{ fontWeight: 800, color: '#0f172a', letterSpacing: 0.2 }}>NavAIgate</div>
        )}
        {/* Double-click title area to toggle persistent collapsed preference */}
        {expanded && (
          <button
            onClick={() => setCollapsedPref(!collapsed)}
            title={collapsed ? 'Pinned collapsed (double-click to pin expanded)' : 'Pinned expanded (double-click to pin collapsed)'}
            style={{ display: 'none' }}
          />
        )}
      </div>

      <nav style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        <Item to="/" label="Home" icon={<HomeIcon />} collapsed={!expanded} />
        <Item to="/chat" label="Chat" icon={<ChatIcon />} collapsed={!expanded} />
        <Item to="/voice" label="Voice" icon={<MicIcon />} collapsed={!expanded} />
      </nav>
    </aside>
  );
}


