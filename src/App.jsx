import { Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import './App.css'
import VoiceAssistant from './components/VoiceAssistant'
import SideNav from './components/SideNav'
import Chat from './components/Chat'
import { AI_ENABLED } from './config'

function App() {
  return (
    <div className="app" style={{ display: 'flex', minHeight: '100vh' }}>
      {AI_ENABLED && <SideNav />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems:'center', gap: 8 }}>
          <img src="/logo.png" alt="logo" width="28" height="28" style={{ borderRadius: 6 }} />
          <span style={{ fontWeight: 800, color: '#0f172a' }}>NavAIgate</span>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {AI_ENABLED && <Route path="/voice" element={<VoiceAssistant />} />}
          {AI_ENABLED && <Route path="/chat" element={<Chat />} />}
        </Routes>
      </div>
    </div>
  )
}

export default App
