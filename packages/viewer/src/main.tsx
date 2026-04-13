import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { TreeView } from './views/tree/TreeView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tree" element={<TreeView />} />
        <Route path="*" element={<Navigate to="/tree" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
