import { Routes, Route } from 'react-router-dom'

// -----------------------------
// Authentication Pages
// -----------------------------

import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import ForgotPassword from '../pages/auth/ForgotPassword'
import UpdatePassword from '../pages/auth/UpdatePassword'
import AuthCallback from '../pages/auth/AuthCallback'
import ChooseUsername from '../pages/auth/ChooseUsername'

// -----------------------------
// Main Pages
// -----------------------------

import Dashboard from '../pages/Dashboard'


// -----------------------------
// 404 Page
// -----------------------------

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-white px-6">

      <div className="text-center">

        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-[#ffd43b] text-[#071a2b] border-4 border-black shadow-[5px_5px_0_#000]">
          <span className="text-3xl font-black">
            A
          </span>
        </div>

        <h1 className="text-6xl font-black">
          404
        </h1>

        <p className="mt-4 text-white/60">
          Page not found.
        </p>

        <a
          href="/"
          className="
            inline-block
            mt-7
            px-7
            py-4
            bg-[#ffd43b]
            text-black
            border-4
            border-black
            shadow-[5px_5px_0_#000]
            font-black
            hover:translate-x-[2px]
            hover:translate-y-[2px]
            hover:shadow-[3px_3px_0_#000]
            active:translate-x-[5px]
            active:translate-y-[5px]
            active:shadow-none
            transition-all
          "
        >
          GO HOME →
        </a>

      </div>

    </div>
  )
}


// -----------------------------
// Main Routes
// -----------------------------

function AppRoutes() {
  return (
    <Routes>

      {/* -------------------------
          Home
          URL: /
      ------------------------- */}

      <Route
        path="/"
        element={
          <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-white">
            <h1 className="text-4xl font-black">
              APTICKS
            </h1>
          </div>
        }
      />


      {/* -------------------------
          Login
          URL: /login
      ------------------------- */}

      <Route
        path="/login"
        element={<Login />}
      />


      {/* -------------------------
          Signup
          URL: /signup
      ------------------------- */}

      <Route
        path="/signup"
        element={<Signup />}
      />


      {/* -------------------------
          Forgot Password
          URL: /forgot-password
      ------------------------- */}

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />


      {/* -------------------------
          Update Password
          URL: /update-password
      ------------------------- */}

      <Route
        path="/update-password"
        element={<UpdatePassword />}
      />


      {/* -------------------------
          Google / GitHub OAuth
          URL: /auth/callback
      ------------------------- */}

      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />


      {/* -------------------------
          Choose Username
          URL: /choose-username
      ------------------------- */}

      <Route
        path="/choose-username"
        element={<ChooseUsername />}
      />


      {/* -------------------------
          Dashboard
          URL: /dashboard
      ------------------------- */}

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />


      {/* -------------------------
          404
      ------------------------- */}

      <Route
        path="*"
        element={<NotFoundPage />}
      />

    </Routes>
  )
}


export default AppRoutes