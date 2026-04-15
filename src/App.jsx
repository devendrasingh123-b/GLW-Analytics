import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import SessionDetail from './SessionDetail'
import Analytics from './Analytics'

 
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/analytics"   element={<Analytics/>}    />  {/* ← NEW */}
      </Routes>
    </BrowserRouter>
  )
}
