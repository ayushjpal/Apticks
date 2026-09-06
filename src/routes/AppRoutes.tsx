import { Routes, Route, Navigate, Link } from 'react-router-dom'

// -----------------------------
// Authentication Pages
// -----------------------------
import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import ForgotPassword from '../pages/auth/ForgotPassword'
import UpdatePassword from '../pages/auth/UpdatePassword'
import AuthCallback from '../pages/auth/AuthCallback'
import ChooseUsername from '../pages/auth/ChooseUsername'
import LinkEmail from '../pages/auth/LinkEmail'

// -----------------------------
// Main Application Pages
// -----------------------------
import Dashboard from '../pages/Dashboard'
import Profile from '../pages/profile/Profile'
import QuestionBank from '../pages/questions/QuestionBank'
import QuestionSolver from '../pages/questions/QuestionSolver'
import Contests from '../pages/contests/Contests'
import ContestDetails from '../pages/contests/ContestDetails'
import ContestArena from '../pages/contests/ContestArena'
import ContestResults from '../pages/contests/ContestResults'
import Leaderboard from '../pages/leaderboard/Leaderboard'

// -----------------------------
// Staff Control Center Pages
// -----------------------------
import ProtectedRoute from '../components/auth/ProtectedRoute'
import ModeratorDashboard from '../pages/moderator/ModeratorDashboard'
import ModeratorQuestions from '../pages/moderator/ModeratorQuestions'
import ModeratorContests from '../pages/moderator/ModeratorContests'
import ModeratorModeration from '../pages/moderator/ModeratorModeration'
import ModeratorUsers from '../pages/moderator/ModeratorUsers'

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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/choose-username" element={<ChooseUsername />} />
      <Route path="/link-email" element={<LinkEmail />} />

      {/* Main Arena Routes */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/questions" element={<QuestionBank />} />
      <Route path="/questions/:id" element={<QuestionSolver />} />
      <Route path="/contests" element={<Contests />} />
      <Route path="/contests/:id" element={<ContestDetails />} />
      <Route path="/contests/:id/arena" element={<ContestArena />} />
      <Route path="/contests/:id/results" element={<ContestResults />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/profile" element={<Profile />} />

      {/* Staff Control Center Routes (Protected) */}
      <Route
        path="/moderator"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <ModeratorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/questions"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <ModeratorQuestions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/contests"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <ModeratorContests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/moderation"
        element={
          <ProtectedRoute allowedRoles={['moderator', 'admin']}>
            <ModeratorModeration />
          </ProtectedRoute>
        }
      />
      <Route
        path="/moderator/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ModeratorUsers />
          </ProtectedRoute>
        }
      />

      {/* Catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}