import React from 'react'
import { Navigate, useLocation, Link } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import type { AppRole } from '../../types/roles'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: AppRole[]
  requireAuth?: boolean
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { role, loading, userId } = useRole()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-white arena-bg-grid">
        <div className="bg-white border-4 border-black p-8 text-center max-w-sm shadow-[8px_8px_0_#ffd43b]">
          <div className="inline-block w-8 h-8 border-4 border-black border-t-[#ffd43b] animate-spin mb-4" />
          <p className="font-display font-black text-sm uppercase tracking-wider text-black">
            VERIFYING AUTHORIZATION...
          </p>
        </div>
      </div>
    )
  }

  // Check authentication requirement
  if (requireAuth && !userId) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role requirement
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-white px-6 arena-bg-grid">
        <div className="bg-white border-4 border-black p-8 sm:p-12 text-center max-w-md shadow-[10px_10px_0_#ef4444]">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-[#ef4444] text-white border-3 border-black shadow-[4px_4px_0_#000000] font-display font-black text-2xl">
            !
          </div>

          <h1 className="font-display font-black text-2xl uppercase text-black tracking-tight">
            CLEARANCE RESTRICTED
          </h1>

          <p className="mt-2 text-xs font-body font-semibold text-black/70 leading-relaxed">
            Your current account clearance level (<span className="font-mono uppercase font-bold text-black">{role}</span>) does not possess permission to enter this sector.
          </p>

          <Link
            to="/dashboard"
            className="inline-block mt-6 px-6 py-3.5 bg-[#ffd43b] hover:bg-[#facc15] text-black border-3 border-black shadow-[4px_4px_0_#000000] font-display font-black text-xs uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
          >
            RETURN TO ARENA →
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
