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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/moderator"
              className="inline-flex items-center gap-1.5 text-xs font-display font-black text-white/80 hover:text-white uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>BACK TO OVERVIEW</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <h1 className="font-display font-black text-2xl sm:text-3xl uppercase text-white tracking-tight">
                USER & ROLE GOVERNANCE
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#ffd43b] text-black border-2 border-[#0c1d2d] rounded-full font-display font-black text-[11px] shadow-[1.5px_1.5px_0_#0c1d2d]">
                <ShieldCheck className="w-3 h-3" />
                ADMIN ONLY
              </span>
            </div>
            <p className="text-xs sm:text-sm font-body font-semibold text-white/70">
              Manage platform privileges, review registered players, and designate staff roles.
            </p>
          </div>

          <button
            onClick={refreshUsers}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black border-2 sm:border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#0c1d2d] hover:bg-[#ffd43b] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'REFRESHING...' : 'REFRESH LIST'}</span>
          </button>
        </div>

        {/* Global Success / Error Feedback */}
        {successMessage && (
          <div className="bg-[#dcfce7] border-2 border-[#0c1d2d] p-4 rounded-xl shadow-[3px_3px_0_#0c1d2d] flex items-center gap-3 text-black">
            <CheckCircle2 className="w-5 h-5 text-[#15803d] shrink-0" />
            <p className="text-xs sm:text-sm font-body font-bold">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="bg-[#fee2e2] border-2 border-[#0c1d2d] p-4 rounded-xl shadow-[3px_3px_0_#0c1d2d] flex items-center gap-3 text-black">
            <AlertTriangle className="w-5 h-5 text-[#b91c1c] shrink-0" />
            <p className="text-xs sm:text-sm font-body font-bold">{error}</p>
          </div>
        )}

        {/* Metric Cards / Inventory Distribution */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0_#0c1d2d]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-xs text-black/60 uppercase">TOTAL PLAYERS</span>
              <Users className="w-4 h-4 text-black/40" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {roleCounts.all}
            </div>
            <div className="mt-1 text-[11px] font-mono text-black/50 font-bold">Registered Accounts</div>
          </div>

          <div className="bg-[#ffd43b] border-2 sm:border-2 border-[#0c1d2d] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0_#0c1d2d]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-xs text-black uppercase">ADMINISTRATORS</span>
              <ShieldCheck className="w-4 h-4 text-black" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {roleCounts.admin}
            </div>
            <div className="mt-1 text-[11px] font-mono text-black/70 font-bold">Full Authority</div>
          </div>

          <div className="bg-[#38aef0] border-2 sm:border-2 border-[#0c1d2d] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0_#0c1d2d]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-xs text-black uppercase">MODERATORS</span>
              <Shield className="w-4 h-4 text-black" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {roleCounts.moderator}
            </div>
            <div className="mt-1 text-[11px] font-mono text-black/70 font-bold">Content Staff</div>
          </div>

          <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] p-4 sm:p-5 rounded-xl shadow-[3px_3px_0_#0c1d2d]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-xs text-black/60 uppercase">STANDARD USERS</span>
              <User className="w-4 h-4 text-black/40" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {roleCounts.user}
            </div>
            <div className="mt-1 text-[11px] font-mono text-black/50 font-bold">Standard Clearance</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border-2 border-[#0c1d2d] p-4 rounded-xl shadow-[3px_3px_0_#0c1d2d] space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 text-xs font-display font-black uppercase rounded-lg border-2 border-[#0c1d2d] transition-all ${
                roleFilter === 'all'
                  ? 'bg-black text-white shadow-[2px_2px_0_#0c1d2d]'
                  : 'bg-white text-black hover:bg-black/5'
              }`}
            >
              ALL ({roleCounts.all})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 text-xs font-display font-black uppercase rounded-lg border-2 border-[#0c1d2d] transition-all ${
                roleFilter === 'admin'
                  ? 'bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d]'
                  : 'bg-white text-black hover:bg-[#ffd43b]/20'
              }`}
            >
              ADMINS ({roleCounts.admin})
            </button>
            <button
              onClick={() => setRoleFilter('moderator')}
              className={`px-3 py-1.5 text-xs font-display font-black uppercase rounded-lg border-2 border-[#0c1d2d] transition-all ${
                roleFilter === 'moderator'
                  ? 'bg-[#38aef0] text-black shadow-[2px_2px_0_#0c1d2d]'
                  : 'bg-white text-black hover:bg-[#38aef0]/20'
              }`}
            >
              MODERATORS ({roleCounts.moderator})
            </button>
            <button
              onClick={() => setRoleFilter('user')}
              className={`px-3 py-1.5 text-xs font-display font-black uppercase rounded-lg border-2 border-[#0c1d2d] transition-all ${
                roleFilter === 'user'
                  ? 'bg-black text-white shadow-[2px_2px_0_#0c1d2d]'
                  : 'bg-white text-black hover:bg-black/5'
              }`}
            >
              USERS ({roleCounts.user})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search username or name..."
              className="w-full pl-9 pr-8 py-2 bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-lg text-xs font-body font-bold text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#ffd43b]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Users Table (Desktop & Tablet) */}
        <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-black/60" />
              <div className="font-display font-black text-sm uppercase text-black">
                RETRIEVING REGISTERED PLAYERS...
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-black/5 border-2 border-[#0c1d2d] rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-black/40" />
              </div>
              <div className="font-display font-black text-base uppercase text-black">
                NO USERS FOUND
              </div>
              <p className="text-xs font-body font-semibold text-black/60 max-w-sm mx-auto">
                No registered accounts match the active search query or role filter.
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-display font-black uppercase hover:bg-[#ffd43b] hover:text-black border-2 border-[#0c1d2d] transition-colors"
                >
                  CLEAR SEARCH
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
                  <thead className="sticky top-0 z-10 shadow-[0_2px_0_#000000]">
                    <tr className="border-b-2 border-[#0c1d2d] bg-[#f8fafc] text-[11px] font-display font-black uppercase text-black/70 tracking-wider">
                      <th className="py-3.5 px-4 sm:px-6">USER</th>
                      <th className="py-3.5 px-4">CLEARANCE / ROLE</th>
                      <th className="py-3.5 px-4">JOINED</th>
                      <th className="py-3.5 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black/10">
                    {users.map((user) => {
                      const isSelf = user.id === currentUserId
                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-[#f1f5f9]/60 transition-colors"
                        >
                          {/* User Avatar + Identity */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl border-2 border-[#0c1d2d] bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d] flex items-center justify-center font-display font-black text-sm shrink-0 overflow-hidden">
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
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-black text-sm text-black truncate">
                                    {user.display_name || user.username}
                                  </span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 bg-black text-[#ffd43b] border border-[#0c1d2d] rounded text-[9px] font-mono font-black uppercase tracking-wider">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-mono font-bold text-black/50 truncate">
                                  @{user.username || 'unnamed'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-4 px-4">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ffd43b] text-black border-2 border-[#0c1d2d] rounded-lg text-xs font-display font-black shadow-[2px_2px_0_#0c1d2d]">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>ADMIN</span>
                              </span>
                            ) : user.role === 'moderator' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#38aef0] text-black border-2 border-[#0c1d2d] rounded-lg text-xs font-display font-black shadow-[2px_2px_0_#0c1d2d]">
                                <Shield className="w-3.5 h-3.5" />
                                <span>MODERATOR</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/5 text-black/80 border-2 border-[#0c1d2d]/30 rounded-lg text-xs font-display font-bold">
                                <User className="w-3.5 h-3.5 text-black/50" />
                                <span>USER</span>
                              </span>
                            )}
                          </td>

                          {/* Joined Date */}
                          <td className="py-4 px-4 text-xs font-mono text-black/70 font-semibold">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-black/40" />
                              <span>{formatDate(user.created_at)}</span>
                            </div>
                          </td>

                          {/* Action Button */}
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleOpenRoleModal(user)}
                              className="px-3.5 py-1.5 bg-white text-black hover:bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#0c1d2d] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                            >
                              CHANGE ROLE
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
                className="md:hidden question-list-scroll max-h-[60vh] sm:max-h-[500px] overflow-y-auto min-h-0 divide-y-2 divide-black/10"
              >
                {users.map((user) => {
                  const isSelf = user.id === currentUserId
                  return (
                    <div key={user.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl border-2 border-[#0c1d2d] bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d] flex items-center justify-center font-display font-black text-sm shrink-0 overflow-hidden">
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
                              <span className="font-display font-black text-sm text-black truncate">
                                {user.display_name || user.username}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 bg-black text-[#ffd43b] border border-[#0c1d2d] rounded text-[9px] font-mono font-black uppercase">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono font-bold text-black/50">
                              @{user.username || 'unnamed'}
                            </div>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <div className="shrink-0">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ffd43b] text-black border-2 border-[#0c1d2d] rounded text-[11px] font-display font-black shadow-[1.5px_1.5px_0_#0c1d2d]">
                              ADMIN
                            </span>
                          ) : user.role === 'moderator' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#38aef0] text-black border-2 border-[#0c1d2d] rounded text-[11px] font-display font-black shadow-[1.5px_1.5px_0_#0c1d2d]">
                              MODERATOR
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-black/5 text-black/80 border border-[#0c1d2d]/30 rounded text-[11px] font-display font-bold">
                              USER
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs font-mono text-black/60 border-t border-[#0c1d2d]/5">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-black/40" />
                          <span>{formatDate(user.created_at)}</span>
                        </div>

                        <button
                          onClick={() => handleOpenRoleModal(user)}
                          className="px-3 py-1 bg-white text-black hover:bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-lg font-display font-black text-[11px] uppercase tracking-wider shadow-[2px_2px_0_#0c1d2d]"
                        >
                          CHANGE ROLE
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
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-hidden data-lenis-prevent animate-fadeIn"
            data-lenis-prevent
          >
            <div
              className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl max-w-lg w-full max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-[8px_8px_0_#000000] relative data-lenis-prevent animate-scaleUp"
              data-lenis-prevent
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b-2 sm:border-b-2 border-[#0c1d2d] shrink-0 flex-none flex items-start justify-between gap-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black text-[#ffd43b] border-2 border-[#0c1d2d] flex items-center justify-center shadow-[2px_2px_0_#0c1d2d]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg uppercase text-black leading-tight">
                      CHANGE USER ROLE
                    </h3>
                    <p className="text-xs font-body font-semibold text-black/60">
                      Update platform authorization clearance.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCloseRoleModal}
                  disabled={isSubmittingRole}
                  aria-label="Close role modal"
                  className="w-8 h-8 rounded-lg border-2 border-[#0c1d2d] flex items-center justify-center text-black/60 hover:text-black hover:bg-black/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div
                className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 data-lenis-prevent overscroll-contain"
                data-lenis-prevent
              >
                {/* Target User Info Summary */}
                <div className="bg-[#f8fafc] border-2 border-[#0c1d2d] p-3.5 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-sm text-black truncate">
                        {selectedUser.display_name || selectedUser.username}
                      </span>
                      {selectedUser.id === currentUserId && (
                        <span className="px-1.5 py-0.5 bg-black text-[#ffd43b] border border-[#0c1d2d] rounded text-[9px] font-mono font-black">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono font-bold text-black/50">
                      @{selectedUser.username}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-display font-black text-black/50 uppercase block">
                      CURRENT ROLE
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-display font-black uppercase border border-[#0c1d2d] ${
                        selectedUser.role === 'admin'
                          ? 'bg-[#ffd43b] text-black'
                          : selectedUser.role === 'moderator'
                          ? 'bg-[#38aef0] text-black'
                          : 'bg-black/5 text-black'
                      }`}
                    >
                      {selectedUser.role}
                    </span>
                  </div>
                </div>

                {/* Modal Error Display */}
                {modalError && (
                  <div className="bg-[#fee2e2] border-2 border-[#0c1d2d] p-3.5 rounded-xl text-black flex items-start gap-2.5 text-xs font-body font-bold">
                    <AlertTriangle className="w-4 h-4 text-[#b91c1c] shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Sole Admin Warning if applicable */}
                {isTargetSoleAdmin && (
                  <div className="bg-[#fef9c3] border-2 border-[#0c1d2d] p-3.5 rounded-xl text-black flex items-start gap-2.5 text-xs font-body font-bold">
                    <ShieldAlert className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
                    <span>
                      You are the sole platform Administrator. You cannot demote yourself unless another Administrator is appointed first.
                    </span>
                  </div>
                )}

                {/* Role Options Selection */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-display font-black uppercase text-black/70">
                    SELECT NEW CLEARANCE LEVEL:
                  </label>

                  {/* Option: USER */}
                  <div
                    onClick={() => {
                      if (!isTargetSoleAdmin) setTargetRole('user')
                    }}
                    className={`p-3.5 rounded-xl border-2 border-[#0c1d2d] cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      targetRole === 'user'
                        ? 'bg-[#f1f5f9] ring-2 ring-black shadow-[3px_3px_0_#0c1d2d]'
                        : 'bg-white hover:bg-black/5'
                    } ${isTargetSoleAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/5 border border-[#0c1d2d] flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <div className="font-display font-black text-xs uppercase text-black">
                          STANDARD USER
                        </div>
                        <p className="text-[11px] font-body text-black/60 mt-0.5">
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
                      className="mt-1"
                    />
                  </div>

                  {/* Option: MODERATOR */}
                  <div
                    onClick={() => {
                      if (!isTargetSoleAdmin) setTargetRole('moderator')
                    }}
                    className={`p-3.5 rounded-xl border-2 border-[#0c1d2d] cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      targetRole === 'moderator'
                        ? 'bg-[#38aef0]/20 ring-2 ring-black shadow-[3px_3px_0_#0c1d2d]'
                        : 'bg-white hover:bg-[#38aef0]/10'
                    } ${isTargetSoleAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#38aef0] border border-[#0c1d2d] flex items-center justify-center shrink-0 mt-0.5">
                        <Shield className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <div className="font-display font-black text-xs uppercase text-black">
                          MODERATOR
                        </div>
                        <p className="text-[11px] font-body text-black/60 mt-0.5">
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
                      className="mt-1"
                    />
                  </div>

                  {/* Option: ADMIN */}
                  <div
                    onClick={() => setTargetRole('admin')}
                    className={`p-3.5 rounded-xl border-2 border-[#0c1d2d] cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      targetRole === 'admin'
                        ? 'bg-[#ffd43b]/30 ring-2 ring-black shadow-[3px_3px_0_#0c1d2d]'
                        : 'bg-white hover:bg-[#ffd43b]/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#ffd43b] border border-[#0c1d2d] flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <div className="font-display font-black text-xs uppercase text-black flex items-center gap-1.5">
                          <span>ADMINISTRATOR</span>
                          <Sparkles className="w-3 h-3 text-[#b45309]" />
                        </div>
                        <p className="text-[11px] font-body text-black/60 mt-0.5">
                          Highest platform authority. Has all moderator privileges plus user clearance management and sole-governance authority.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="role-select"
                      checked={targetRole === 'admin'}
                      onChange={() => setTargetRole('admin')}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* High-Privilege Promotion Warning */}
                {targetRole === 'admin' && selectedUser.role !== 'admin' && (
                  <div className="bg-[#fffbeb] border-2 border-[#0c1d2d] p-3 rounded-xl flex items-start gap-2.5 text-xs text-black font-body font-bold">
                    <AlertTriangle className="w-4 h-4 text-[#d97706] shrink-0 mt-0.5" />
                    <div>
                      <span className="uppercase font-display font-black text-[11px] text-[#b45309] block">
                        HIGH-PRIVILEGE ASSIGNMENT:
                      </span>
                      Promoting @{selectedUser.username} to Administrator gives them complete authority over all platform questions, competitions, and user clearance levels.
                    </div>
                  </div>
                )}
              </div>

              {/* Confirmation Action Buttons Footer */}
              <div className="p-4 border-t-2 sm:border-t-3 border-[#0c1d2d] bg-[#f8fafc] shrink-0 flex-none flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseRoleModal}
                  disabled={isSubmittingRole}
                  className="px-4 py-2 bg-white text-black border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider hover:bg-black/5 disabled:opacity-50"
                >
                  CANCEL
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRoleChange}
                  disabled={isSubmittingRole || targetRole === selectedUser.role || (isTargetSoleAdmin && targetRole !== 'admin')}
                  className="px-5 py-2.5 bg-black text-[#ffd43b] hover:bg-[#ffd43b] hover:text-black border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#0c1d2d] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmittingRole ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      UPDATING...
                    </span>
                  ) : (
                    `CONFIRM TO ${targetRole?.toUpperCase()}`
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
