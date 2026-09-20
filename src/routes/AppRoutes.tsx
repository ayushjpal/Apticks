import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import { UserSessionProvider } from '../contexts/UserSessionContext'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import { RouteSkeleton, ArenaSkeleton, AuthSkeleton } from '../components/ui/RouteSkeleton'

// -----------------------------
// Authentication Pages (Lazy Loaded)
// -----------------------------
const Login = lazy(() => import('../pages/auth/Login'))
const Signup = lazy(() => import('../pages/auth/Signup'))
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'))
const UpdatePassword = lazy(() => import('../pages/auth/UpdatePassword'))
const AuthCallback = lazy(() => import('../pages/auth/AuthCallback'))
const ChooseUsername = lazy(() => import('../pages/auth/ChooseUsername'))
const LinkEmail = lazy(() => import('../pages/auth/LinkEmail'))

// -----------------------------
// Main Application Pages (Lazy Loaded)
// -----------------------------
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Profile = lazy(() => import('../pages/profile/Profile'))
const QuestionBank = lazy(() => import('../pages/questions/QuestionBank'))
const QuestionSolver = lazy(() => import('../pages/questions/QuestionSolver'))
const Contests = lazy(() => import('../pages/contests/Contests'))
const ContestDetails = lazy(() => import('../pages/contests/ContestDetails'))
const ContestArena = lazy(() => import('../pages/contests/ContestArena'))
const ContestResults = lazy(() => import('../pages/contests/ContestResults'))
const Leaderboard = lazy(() => import('../pages/leaderboard/Leaderboard'))
const SocialHub = lazy(() => import('../pages/social/SocialHub'))
const PublicProfile = lazy(() => import('../pages/profile/PublicProfile'))
const Match1v1Hub = lazy(() => import('../pages/match1v1/Match1v1Hub'))
const Match1v1Lobby = lazy(() => import('../pages/match1v1/Match1v1Lobby'))
const Match1v1Arena = lazy(() => import('../pages/match1v1/Match1v1Arena'))

// -----------------------------
// Staff Control Center Pages (Lazy Loaded)
// -----------------------------
const ModeratorDashboard = lazy(() => import('../pages/moderator/ModeratorDashboard'))
const ModeratorQuestions = lazy(() => import('../pages/moderator/ModeratorQuestions'))
const ModeratorContests = lazy(() => import('../pages/moderator/ModeratorContests'))
const ModeratorModeration = lazy(() => import('../pages/moderator/ModeratorModeration'))
const ModeratorUsers = lazy(() => import('../pages/moderator/ModeratorUsers'))

// -----------------------------
// 404 Not Found Page
// -----------------------------
function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-white px-6 arena-bg-grid">
      <div className="bg-white border-4 border-black p-8 sm:p-12 text-center max-w-md shadow-[10px_10px_0_#ffd43b]">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-[#ffd43b] text-black border-3 border-black shadow-[4px_4px_0_#000000] font-display font-black text-2xl">
          404
        </div>

        <h1 className="font-display font-black text-3xl uppercase text-black tracking-tight">
          SECTOR NOT FOUND
        </h1>

        <p className="mt-2 text-xs font-body font-semibold text-black/70">
          The requested coordinate does not exist inside the Apticks arena.
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

// -----------------------------
// Main Routes
// -----------------------------
export default function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth Routes */}
      <Route path="/login" element={<Suspense fallback={<AuthSkeleton />}><Login /></Suspense>} />
      <Route path="/signup" element={<Suspense fallback={<AuthSkeleton />}><Signup /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<AuthSkeleton />}><ForgotPassword /></Suspense>} />
      <Route path="/update-password" element={<Suspense fallback={<AuthSkeleton />}><UpdatePassword /></Suspense>} />
      <Route path="/auth/callback" element={<Suspense fallback={<AuthSkeleton />}><AuthCallback /></Suspense>} />
      <Route path="/choose-username" element={<Suspense fallback={<AuthSkeleton />}><ChooseUsername /></Suspense>} />
      <Route path="/link-email" element={<Suspense fallback={<AuthSkeleton />}><LinkEmail /></Suspense>} />

      {/* Main Arena Routes with Persistent Layout & Shared UserSession Context */}
      <Route
        element={
          <UserSessionProvider>
            <AppLayout />
          </UserSessionProvider>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/questions" element={<QuestionBank />} />
        <Route path="/questions/:id" element={<QuestionSolver />} />
        <Route path="/contests" element={<Contests />} />
        <Route path="/contests/:id" element={<ContestDetails />} />
        <Route path="/contests/:id/results" element={<ContestResults />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/rank" element={<Navigate to="/leaderboard" replace />} />
        <Route path="/social" element={<SocialHub />} />
        <Route path="/1v1" element={<Match1v1Hub />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:username" element={<PublicProfile />} />
      </Route>

      {/* Immersion Full-Screen Arenas (Independent HUDs outside AppLayout) */}
      <Route path="/contests/:id/arena" element={<Suspense fallback={<ArenaSkeleton />}><ContestArena /></Suspense>} />
      <Route path="/1v1/:matchId" element={<Suspense fallback={<ArenaSkeleton />}><Match1v1Lobby /></Suspense>} />
      <Route path="/1v1/:matchId/battle" element={<Suspense fallback={<ArenaSkeleton />}><Match1v1Arena /></Suspense>} />

      {/* Staff Control Center Routes (Protected) */}
      <Route
        path="/moderator"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <Suspense fallback={<RouteSkeleton />}>
              <ModeratorDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/questions"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <Suspense fallback={<RouteSkeleton />}>
              <ModeratorQuestions />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/contests"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <Suspense fallback={<RouteSkeleton />}>
              <ModeratorContests />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/moderation"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <Suspense fallback={<RouteSkeleton />}>
              <ModeratorModeration />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Suspense fallback={<RouteSkeleton />}>
              <ModeratorUsers />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}