// React's StrictMode helps detect potential problems during development.
import { StrictMode } from 'react'

// Creates the React application root.
import { createRoot } from 'react-dom/client'

// BrowserRouter enables URL-based navigation in our React application.
// Example: /, /login, /signup, /dashboard
import { BrowserRouter } from 'react-router-dom'

// Global AptiVerse styles + Tailwind CSS.
import './index.css'

// Main application component.
import App from './App.tsx'


// Find the HTML element with id="root"
// and mount our React application inside it.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 
      BrowserRouter provides routing functionality
      to the entire AptiVerse application.
    */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)