import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react'
import StaffLayout from '../../components/layout/StaffLayout'
import { AdminUserService, type AdminUserRecord, type AdminRoleCounts } from '../../services/adminUserService'
import { useRole } from '../../hooks/useRole'
import type { AppRole } from '../../types/roles'

export default function ModeratorUsers() {
  const { userId: currentUserId, refetchRole } = useRole()

  // State
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [roleCounts, setRoleCounts] = useState<AdminRoleCounts>({ all: 0, admin: 0, moderator: 0, user: 0 })
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Role change modal state
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)
  const [targetRole, setTargetRole] = useState<AppRole | null>(null)
  const [isSubmittingRole, setIsSubmittingRole] = useState<boolean>(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Refresh handler for button and after mutations
  const refreshUsers = async () => {
    setRefreshing(true)
    setError(null)

    try {
      const [usersRes, countsRes] = await Promise.all([
        AdminUserService.fetchUsers({
          search: searchQuery,
          roleFilter: roleFilter,
        }),
        AdminUserService.fetchRoleCounts(),
      ])

      if (usersRes.error) {
        setError(usersRes.error)
      } else {
        setUsers(usersRes.users)
      }

      setRoleCounts(countsRes)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load user records'
      setError(message)
    } finally {
      setRefreshing(false)
    }
  }

  // Load initial data and react to filters
  useEffect(() => {
    let isMounted = true

    Promise.all([
      AdminUserService.fetchUsers({
        search: searchQuery,
        roleFilter: roleFilter,
      }),
      AdminUserService.fetchRoleCounts(),
    ])
      .then(([usersRes, countsRes]) => {
        if (!isMounted) return
        if (usersRes.error) {
          setError(usersRes.error)
        } else {
          setUsers(usersRes.users)
        }
        setRoleCounts(countsRes)
        setLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : 'Failed to load user records'
        setError(message)
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [searchQuery, roleFilter])

  // Clear messages after delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Open role change modal
  const handleOpenRoleModal = (user: AdminUserRecord) => {
    setSelectedUser(user)
    setTargetRole(user.role)
    setModalError(null)
  }

  const handleCloseRoleModal = () => {
    setSelectedUser(null)
    setTargetRole(null)
    setModalError(null)
    setIsSubmittingRole(false)
  }

  // Body scroll lock when role change modal is open
  useEffect(() => {
    if (selectedUser) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [selectedUser])

  // ESC key to close role modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedUser && !isSubmittingRole) {
        handleCloseRoleModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedUser, isSubmittingRole])

  // Execute role change via secure admin_set_user_role RPC
  const handleConfirmRoleChange = async () => {
    if (!selectedUser || !targetRole) return
    if (targetRole === selectedUser.role) {
      handleCloseRoleModal()
      return
    }

    setIsSubmittingRole(true)
    setModalError(null)

    try {
      const res = await AdminUserService.changeUserRole(selectedUser.id, targetRole)

      if (!res.success) {
        setModalError(res.message || 'Role change was rejected by server.')
        setIsSubmittingRole(false)
        return
      }

      // Successful update
      setSuccessMessage(
        `Successfully updated @${selectedUser.username || selectedUser.id.slice(0, 8)} to ${targetRole.toUpperCase()}.`
      )

      // If updating own role, trigger hook refetch
      if (selectedUser.id === currentUserId) {
        await refetchRole()
      }

      handleCloseRoleModal()
      // Refresh user table and counts
      await refreshUsers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role'
      setModalError(message)
      setIsSubmittingRole(false)
    }
  }

  // Format date helper
  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  // Helper to check if current logged-in user is sole admin
  const isTargetSoleAdmin = useMemo(() => {
    if (!selectedUser) return false
    return selectedUser.id === currentUserId && roleCounts.admin <= 1
  }, [selectedUser, currentUserId, roleCounts.admin])

  return (
    <StaffLayout>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/moderator"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Control Center</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Users & Role Governance
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[11px] font-medium">
                <ShieldCheck className="w-3 h-3" />
                Admin Only
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-white/70">
              Manage platform privileges, review registered players, and designate staff roles.
            </p>
          </div>

          <button
            onClick={refreshUsers}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl font-medium text-xs shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh List'}</span>
          </button>
        </div>

        {/* Global Success / Error Feedback */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-xl shadow-xs flex items-center gap-3 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200/80 p-3.5 rounded-xl shadow-xs flex items-center gap-3 text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Metric Cards / Inventory Distribution (Compact, neutral, non-dominating) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Players</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {roleCounts.all}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-400">Registered Accounts</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administrators</span>
              <span className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-2xl font-bold text-amber-600">
              {roleCounts.admin}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-400">Full Authority</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Moderators</span>
              <span className="w-6 h-6 rounded-lg bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600">
                <Shield className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1.5 text-2xl font-bold text-sky-600">
              {roleCounts.moderator}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-400">Content Staff</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Standard Users</span>
              <User className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {roleCounts.user}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-slate-400">Standard Clearance</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-xs space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === 'all'
                  ? 'bg-[#0c1d2d] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              All ({roleCounts.all})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === 'admin'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
              }`}
            >
              Admins ({roleCounts.admin})
            </button>
            <button
              onClick={() => setRoleFilter('moderator')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === 'moderator'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-800'
              }`}
            >
              Moderators ({roleCounts.moderator})
            </button>
            <button
              onClick={() => setRoleFilter('user')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === 'user'
                  ? 'bg-[#0c1d2d] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Users ({roleCounts.user})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search username or name..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Users Table (Desktop & Tablet) */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-400" />
              <div className="text-xs font-semibold text-slate-600">
                Retrieving registered players...
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 mx-auto bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">
                No Users Found
              </div>
              <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
                No registered accounts match the active search query or role filter.
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 bg-[#0c1d2d] text-white rounded-lg text-xs font-medium hover:bg-[#152e46] transition-colors shadow-xs"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div
                data-lenis-prevent
                className="hidden md:block question-list-scroll max-h-[520px] overflow-y-auto overflow-x-auto min-h-0"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-slate-50/90 backdrop-blur-xs text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                      <th className="py-2.5 px-4 sm:px-5">User</th>
                      <th className="py-2.5 px-4">Clearance / Role</th>
                      <th className="py-2.5 px-4">Joined</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => {
                      const isSelf = user.id === currentUserId
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* User Avatar + Identity */}
                          <td className="py-3 px-4 sm:px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                {user.avatar_url ? (
                                  <img
                                    src={user.avatar_url}
                                    alt={user.username || 'User avatar'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  (user.display_name || user.username || 'U')[0]?.toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-xs text-slate-900 truncate">
                                    {user.display_name || user.username}
                                  </span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 bg-[#ffd43b]/20 text-[#855d00] border border-[#ffd43b]/40 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 truncate">
                                  @{user.username || 'unnamed'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3 px-4">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded text-[11px] font-medium">
                                <ShieldCheck className="w-3 h-3 text-amber-600" />
                                <span>Admin</span>
                              </span>
                            ) : user.role === 'moderator' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded text-[11px] font-medium">
                                <Shield className="w-3 h-3 text-sky-600" />
                                <span>Moderator</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200/80 rounded text-[11px] font-medium">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>User</span>
                              </span>
                            )}
                          </td>

                          {/* Joined Date */}
                          <td className="py-3 px-4 text-xs font-mono text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{formatDate(user.created_at)}</span>
                            </div>
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenRoleModal(user)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium text-xs shadow-xs transition-colors"
                            >
                              Change Role
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div
                data-lenis-prevent
                className="md:hidden question-list-scroll max-h-[60vh] sm:max-h-[500px] overflow-y-auto min-h-0 divide-y divide-slate-100"
              >
                {users.map((user) => {
                  const isSelf = user.id === currentUserId
                  return (
                    <div key={user.id} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.username || 'User avatar'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (user.display_name || user.username || 'U')[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900 truncate">
                                {user.display_name || user.username}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 bg-[#ffd43b]/20 text-[#855d00] border border-[#ffd43b]/40 rounded text-[9px] font-mono font-bold uppercase">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              @{user.username || 'unnamed'}
                            </div>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <div className="shrink-0">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded text-[11px] font-medium">
                              Admin
                            </span>
                          ) : user.role === 'moderator' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded text-[11px] font-medium">
                              Moderator
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200/80 rounded text-[11px] font-medium">
                              User
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs font-mono text-slate-500 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(user.created_at)}</span>
                        </div>

                        <button
                          onClick={() => handleOpenRoleModal(user)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium text-[11px] shadow-xs"
                        >
                          Change Role
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Role Change Modal */}
        {selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-hidden data-lenis-prevent animate-fadeIn"
            data-lenis-prevent
          >
            <div
              className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-2xl relative data-lenis-prevent animate-scaleUp"
              data-lenis-prevent
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0 flex-none flex items-start justify-between gap-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      Change User Role
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                      Update platform authorization clearance.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCloseRoleModal}
                  disabled={isSubmittingRole}
                  aria-label="Close role modal"
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div
                className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-3.5 data-lenis-prevent overscroll-contain"
                data-lenis-prevent
              >
                {/* Target User Info Summary */}
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {selectedUser.display_name || selectedUser.username}
                      </span>
                      {selectedUser.id === currentUserId && (
                        <span className="px-1.5 py-0.2 bg-[#ffd43b]/20 text-[#855d00] border border-[#ffd43b]/40 rounded text-[9px] font-mono font-bold uppercase">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      @{selectedUser.username}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Current Role
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase border ${
                        selectedUser.role === 'admin'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                          : selectedUser.role === 'moderator'
                          ? 'bg-sky-50 text-sky-700 border-sky-200/80'
                          : 'bg-slate-100 text-slate-600 border-slate-200/80'
                      }`}
                    >
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                {/* Modal Error Display */}
                {modalError && (
                  <div className="bg-rose-50 border border-rose-200/80 p-3 rounded-xl text-rose-900 flex items-start gap-2.5 text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Sole Admin Warning if applicable */}
                {isTargetSoleAdmin && (
                  <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl text-amber-900 flex items-start gap-2.5 text-xs font-medium">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      You are the sole platform Administrator. You cannot demote yourself unless another Administrator is appointed first.
                    </span>
                  </div>
                )}

                {/* Role Options Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Select New Clearance Level:
                  </label>

                  {/* Option: USER */}
                  <div
                    onClick={() => {
                      if (!isTargetSoleAdmin) setTargetRole('user')
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      targetRole === 'user'
                        ? 'border-[#0c1d2d] bg-slate-50/80 ring-1 ring-[#0c1d2d]'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    } ${isTargetSoleAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Standard User
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Standard player clearance. Can solve questions, join contests, earn streak XP, and participate on public leaderboards.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="role-select"
                      checked={targetRole === 'user'}
                      onChange={() => {
                        if (!isTargetSoleAdmin) setTargetRole('user')
                      }}
                      disabled={isTargetSoleAdmin}
                      className="mt-1 accent-[#0c1d2d]"
                    />
                  </div>

                  {/* Option: MODERATOR */}
                  <div
                    onClick={() => {
                      if (!isTargetSoleAdmin) setTargetRole('moderator')
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      targetRole === 'moderator'
                        ? 'border-sky-600 bg-sky-50/60 ring-1 ring-sky-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    } ${isTargetSoleAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Shield className="w-3.5 h-3.5 text-sky-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-900">
                          Moderator
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Trusted staff clearance. Can access Control Center to author questions, stage content, and review contest submissions. Cannot alter user roles.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="role-select"
                      checked={targetRole === 'moderator'}
                      onChange={() => {
                        if (!isTargetSoleAdmin) setTargetRole('moderator')
                      }}
                      disabled={isTargetSoleAdmin}
                      className="mt-1 accent-sky-600"
                    />
                  </div>

                  {/* Option: ADMIN */}
                  <div
                    onClick={() => setTargetRole('admin')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      targetRole === 'admin'
                        ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>Administrator</span>
                          <Sparkles className="w-3 h-3 text-amber-600" />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Highest platform authority. Has all moderator privileges plus user clearance management and sole-governance authority.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="role-select"
                      checked={targetRole === 'admin'}
                      onChange={() => setTargetRole('admin')}
                      className="mt-1 accent-amber-500"
                    />
                  </div>
                </div>

                {/* High-Privilege Promotion Warning */}
                {targetRole === 'admin' && selectedUser.role !== 'admin' && (
                  <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-xl flex items-start gap-2 text-xs text-amber-900 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        High-Privilege Assignment:
                      </span>
                      Promoting @{selectedUser.username} to Administrator gives them complete authority over all platform questions, competitions, and user clearance levels.
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation Action Buttons Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex-none flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseRoleModal}
                  disabled={isSubmittingRole}
                  className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium text-xs hover:bg-slate-50 shadow-xs disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRoleChange}
                  disabled={isSubmittingRole || targetRole === selectedUser.role || (isTargetSoleAdmin && targetRole !== 'admin')}
                  className="px-4 py-1.5 bg-[#ffd43b] hover:bg-[#fcc419] text-black font-semibold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmittingRole ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Confirm to {targetRole?.toUpperCase()}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
