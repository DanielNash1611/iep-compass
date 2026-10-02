import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PrivacyControl } from './analytics/PrivacyControl'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PrivacyControl />
  </StrictMode>,
)
import { analytics } from "./analytics";
analytics.page();
