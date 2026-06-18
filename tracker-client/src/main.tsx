import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TrackerProvider } from './TrackerContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackerProvider>
      <App />
    </TrackerProvider>
  </StrictMode>,
)
