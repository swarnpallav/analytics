import { Routes, Route, Link } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import './App.css'
import VoiceAssistant from './components/VoiceAssistant'

function App() {
  return (
    <div className="app">
      <nav style={{ padding: 12, display: 'flex', gap: 12, borderBottom: '1px solid #eee' }}>
        <Link to="/">Dashboard</Link>
        <Link to="/voice">Voice Assistant</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/voice" element={<VoiceAssistant />} />
      </Routes>
    </div>
  )
}

export default App
