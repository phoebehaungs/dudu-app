import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'  // <--- 這一行是關鍵！一定要有！

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)