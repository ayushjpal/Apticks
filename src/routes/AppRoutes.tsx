// React Router components used to define and render
// Apticks application routes.
import { Routes, Route } from 'react-router-dom'

// Temporary page components.
// We'll replace these with real pages as we build each module.
function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
      <h1 className="text-4xl font-bold">Apticks Home</h1>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="mt-3 text-white/60">Page not found.</p>
      </div>
    </div>
  )
}

// Central route configuration for Apticks.
// New pages should be registered here instead of
// scattering routes throughout the application.
function AppRoutes() {
  return (
    <Routes>
      {/* Main application route */}
      <Route path="/" element={<HomePage />} />

      {/* Fallback for unknown URLs */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes