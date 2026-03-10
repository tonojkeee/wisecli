import React from 'react'
import ReactDOM from 'react-dom/client'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import App from './App'
import './globals.css'
import './i18n'

// Configure Monaco to load from local bundle instead of CDN
// This must be done before any Editor component is rendered
loader.config({ monaco })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept()
}
