import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import SessionDetail from './SessionDetail'
 
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/session/:id" element={<SessionDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
