import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Search,
  Filter,
  Eye,
  RefreshCw,
  FileText,
  Layers,
  User,
  Trophy,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Slash,
} from 'lucide-react'
import StaffLayout from '../../components/layout/StaffLayout'
import { StaffPageHeader, StaffMetricCard } from '../../components/staff/StaffUI'
import { ModerationService } from '../../services/moderationService'
import type {
  ModerationReport,
  ModerationMetrics,
  ReportStatus,
  ReportReason,
  TargetType,
} from '../../types/moderation'
import { REASON_LABELS, TARGET_LABELS } from '../../types/moderation'

const REASON_OPTIONS: { value: ReportReason | 'all'; label: string }[] = [
  { value: 'all', label: 'ALL REASONS' },
  { value: 'question_errata', label: 'Question Errata' },
  { value: 'question_clarity', label: 'Clarity / Wording' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'cheating_suspicion', label: 'Cheating Suspicion' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'other', label: 'General / Other' },
]

export default function ModeratorModeration() {
  // Metrics state
  const [metrics, setMetrics] = useState<ModerationMetrics>({
    pending: 0,
    reviewing: 0,
    resolved: 0,
    dismissed: 0,
    total: 0,
  })
  const [metricsLoading, setMetricsLoading] = useState(true)

  // Incident list state
  const [incidents, setIncidents] = useState<ModerationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters state
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('all')
  const [selectedReason, setSelectedReason] = useState<ReportReason | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // Selected incident modal state
  const [selectedIncident, setSelectedIncident] = useState<ModerationReport | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Notes editing state inside detail modal
  const [notesInput, setNotesInput] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaveSuccess, setNotesSaveSuccess] = useState(false)

  // Confirmation modal state for terminal actions (Resolve / Dismiss)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'resolve' | 'dismiss'
    incident: ModerationReport
  } | null>(null)

  // Refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 1. Fetch Metrics Effect
  useEffect(() => {
    let isMounted = true

    ModerationService.fetchModerationMetrics()
      .then((data) => {
        if (!isMounted) return
        setMetrics(data)
        setMetricsLoading(false)
      })
      .catch((err: unknown) => {
        console.warn('Could not load moderation metrics:', err)
        if (!isMounted) return
        setMetricsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [refreshTrigger])

  // 2. Fetch Incidents Effect
  useEffect(() => {
    let isMounted = true
    const offset = (currentPage - 1) * pageSize

    ModerationService.fetchModerationIncidents({
      status: selectedStatus,
      reason: selectedReason,
      search: searchQuery,
      limit: pageSize,
      offset,
    })
      .then((res) => {
        if (!isMounted) return
        setIncidents(res.incidents)
        setTotalCount(res.total)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load moderation incidents.')
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedStatus, selectedReason, searchQuery, currentPage, pageSize, refreshTrigger])

  // 3. Body scroll lock when any modal is open
  useEffect(() => {
    const hasOpenModal = selectedIncident !== null || confirmAction !== null
    if (hasOpenModal) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [selectedIncident, confirmAction])

  // 4. ESC key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmAction) {
          setConfirmAction(null)
        } else if (selectedIncident) {
          setSelectedIncident(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmAction, selectedIncident])

  // Open Incident Detail
  const handleOpenDetail = async (report: ModerationReport) => {
    setSelectedIncident(report)
    setNotesInput(report.moderator_notes || '')
    setNotesSaveSuccess(false)
    setActionError(null)
    setDetailLoading(true)

    try {
      const detail = await ModerationService.fetchIncidentDetail(report.id)
      if (detail) {
        setSelectedIncident(detail)
        setNotesInput(detail.moderator_notes || '')
      }
    } catch (err) {
      console.warn('Could not load detailed target context:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Save Moderator Notes
  const handleSaveNotes = async () => {
    if (!selectedIncident) return
    if (selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed') {
      setActionError(`Cannot modify notes for a ${selectedIncident.status} incident. Terminal incidents are immutable.`)
      return
    }
    setNotesSaving(true)
    setActionError(null)
    setNotesSaveSuccess(false)

    try {
      const res = await ModerationService.updateIncidentNotes(selectedIncident.id, notesInput)
      if (!res.success) {
        setActionError(res.error || 'Failed to update moderator notes.')
        return
      }

      setNotesSaveSuccess(true)
      setSelectedIncident((prev) => (prev ? { ...prev, moderator_notes: notesInput } : null))
      setIncidents((prev) =>
        prev.map((item) => (item.id === selectedIncident.id ? { ...item, moderator_notes: notesInput } : item))
      )
      setTimeout(() => setNotesSaveSuccess(false), 3000)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error updating notes.')
    } finally {
      setNotesSaving(false)
    }
  }

  // Handle Status Transition
  const handleExecuteStatusTransition = async (newStatus: ReportStatus) => {
    if (!selectedIncident) return
    setActionLoading(true)
    setActionError(null)

    try {
      const res = await ModerationService.updateIncidentStatus(
        selectedIncident.id,
        newStatus,
        notesInput.trim() ? notesInput.trim() : undefined
      )

      if (!res.success) {
        setActionError(res.error || `Could not update incident status to ${newStatus}.`)
        return
      }

      // Close confirmation dialog if open
      setConfirmAction(null)

      // Refresh incident detail
      const updated = await ModerationService.fetchIncidentDetail(selectedIncident.id)
      if (updated) {
        setSelectedIncident(updated)
      } else {
        setSelectedIncident((prev) => (prev ? { ...prev, status: newStatus } : null))
      }

      // Refresh list & metrics via trigger
      setRefreshTrigger((v) => v + 1)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Unexpected error updating status to ${newStatus}.`)
    } finally {
      setActionLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  // Status badge styling helper
  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-300'
      case 'reviewing':
        return 'bg-sky-50 text-sky-800 border-sky-300'
      case 'resolved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300'
      case 'dismissed':
        return 'bg-slate-100 text-slate-600 border-slate-300'
      default:
        return 'bg-slate-100 text-slate-600 border-slate-300'
    }
  }

  // Target type icon helper
  const getTargetIcon = (type: TargetType) => {
    switch (type) {
      case 'question':
        return <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
      case 'contest':
        return <Trophy className="w-3.5 h-3.5 text-amber-600" />
      case 'user':
        return <User className="w-3.5 h-3.5 text-purple-600" />
      case 'general':
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />
    }
  }

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <StaffLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <StaffPageHeader
          badgeText="Incident Triage"
          badgeIcon={<ShieldCheck className="w-3.5 h-3.5 text-[#ffd43b]" />}
          badgeVariant="navy"
          title="Content Moderation & Reports"
          description="Investigate user errata tickets, question disputes, clarity flags, and platform incidents with authoritative server logging."
          actions={
            <button
              onClick={() => {
                setLoading(true)
                setMetricsLoading(true)
                setRefreshTrigger((v) => v + 1)
              }}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          }
        />

        {/* Real Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StaffMetricCard
            label="Pending Review"
            value={metricsLoading ? '...' : metrics.pending}
            subtext="Awaiting staff inspection"
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            iconBg="bg-amber-50"
            valueColor="text-amber-800"
            loading={metricsLoading}
          />
          <StaffMetricCard
            label="Under Review"
            value={metricsLoading ? '...' : metrics.reviewing}
            subtext="Actively being analyzed"
            icon={<Eye className="w-4 h-4 text-sky-600" />}
            iconBg="bg-sky-50"
            valueColor="text-sky-800"
            loading={metricsLoading}
          />
          <StaffMetricCard
            label="Resolved Tickets"
            value={metricsLoading ? '...' : metrics.resolved}
            subtext="Verified and calibrated"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            valueColor="text-emerald-800"
            loading={metricsLoading}
          />
          <StaffMetricCard
            label="Dismissed Reports"
            value={metricsLoading ? '...' : metrics.dismissed}
            subtext="Invalid or false alarms"
            icon={<Slash className="w-4 h-4 text-slate-400" />}
            iconBg="bg-slate-100"
            valueColor="text-slate-600"
            loading={metricsLoading}
          />
        </div>

        {/* Controls & Filter Toolbar */}
        <div className="bg-white border border-slate-200/80 p-3.5 sm:p-4 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Navigation Chips */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
              {(['all', 'pending', 'reviewing', 'resolved', 'dismissed'] as const).map((st) => {
                const count =
                  st === 'all'
                    ? metrics.total
                    : st === 'pending'
                    ? metrics.pending
                    : st === 'reviewing'
                    ? metrics.reviewing
                    : st === 'resolved'
                    ? metrics.resolved
                    : metrics.dismissed

                return (
                  <button
                    key={st}
                    onClick={() => {
                      setSelectedStatus(st)
                      setCurrentPage(1)
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all shadow-xs flex items-center gap-1.5 ${
                      selectedStatus === st
                        ? 'bg-[#0c1d2d] text-white border-[#0c1d2d]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}</span>
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                      selectedStatus === st ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Filter Reset if active */}
            {(selectedStatus !== 'all' || selectedReason !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedStatus('all')
                  setSelectedReason('all')
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Secondary Filters: Reason Category & Live Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {/* Reason Selector */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              <select
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value as ReportReason | 'all')
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by report ID, target ID, reporter, or description..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d]"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} incidents
            </span>
            <span>
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
          </div>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl shadow-xs flex items-center justify-between gap-3 text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs font-medium">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Incidents Table / Card Container */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-7 h-7 border-2 border-[#0c1d2d] border-t-[#ffd43b] rounded-full animate-spin mx-auto" />
              <div className="text-xs font-medium text-slate-500">
                Loading incident queue...
              </div>
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                No Incidents Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {selectedStatus !== 'all' || selectedReason !== 'all' || searchQuery
                  ? 'No reports match your active filter combination. Try resetting your search filters.'
                  : 'The moderation triage queue is completely clear. No disputes or incident reports require staff attention.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div
                data-lenis-prevent
                className="hidden md:block question-list-scroll max-h-[540px] overflow-y-auto overflow-x-auto min-h-0"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50/90 backdrop-blur-xs border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-4 w-28">Report ID</th>
                      <th className="py-3 px-4 w-44">Target Entity</th>
                      <th className="py-3 px-4 w-40">Reason</th>
                      <th className="py-3 px-4 min-w-[240px]">Description Summary</th>
                      <th className="py-3 px-4 w-36">Reporter</th>
                      <th className="py-3 px-4 w-28 text-center">Status</th>
                      <th className="py-3 px-4 w-28 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incidents.map((rep) => (
                      <tr
                        key={rep.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(rep)}
                      >
                        {/* Report ID */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-mono text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {rep.id.slice(0, 8)}
                          </span>
                          <div className="text-[10px] font-mono text-slate-400 mt-1">
                            {formatDate(rep.created_at)}
                          </div>
                        </td>

                        {/* Target Entity */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            {getTargetIcon(rep.target_type)}
                            <span className="capitalize">{rep.target_type}</span>
                          </div>
                          <div className="font-mono text-xs text-slate-500 mt-0.5 truncate">
                            {rep.target_id}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium">
                            {REASON_LABELS[rep.reason] || rep.reason}
                          </span>
                        </td>

                        {/* Description Summary */}
                        <td className="py-3.5 px-4 align-top">
                          <p className="text-xs text-slate-700 line-clamp-2 leading-snug">
                            {rep.description}
                          </p>
                          {rep.moderator_notes && (
                            <div className="mt-1 text-[10px] font-mono text-sky-600 font-medium flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span>Notes logged</span>
                            </div>
                          )}
                        </td>

                        {/* Reporter */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {rep.reporter?.display_name || rep.reporter?.username || 'Player'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 truncate">
                            @{rep.reporter?.username || 'unnamed'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${getStatusBadge(
                              rep.status
                            )}`}
                          >
                            {rep.status}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDetail(rep)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div
                data-lenis-prevent
                className="md:hidden question-list-scroll max-h-[60vh] sm:max-h-[500px] overflow-y-auto min-h-0 divide-y divide-slate-100"
              >
                {incidents.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => handleOpenDetail(rep)}
                    className="p-4 space-y-2.5 hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                          {rep.id.slice(0, 8)}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                          {getTargetIcon(rep.target_type)}
                          <span className="capitalize">{rep.target_type}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${getStatusBadge(
                          rep.status
                        )}`}
                      >
                        {rep.status}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {REASON_LABELS[rep.reason] || rep.reason}
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 mt-0.5 leading-snug">
                        {rep.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs font-mono text-slate-500">
                      <span>Target: {rep.target_id}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetail(rep)
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-semibold shadow-2xs"
                      >
                        Review →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <div className="text-xs font-mono text-slate-600">
                Page {currentPage} of {totalPages}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INCIDENT DETAIL & REVIEW MODAL */}
      {/* ========================================================================= */}
      {selectedIncident && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedIncident(null)
          }}
        >
          <div
            data-lenis-prevent
            className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full h-[90vh] sm:h-[86vh] max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pinned Modal Header (Never scrolls) */}
            <div className="p-4 sm:p-5 border-b border-slate-200 shrink-0 flex-none relative pr-12 bg-white">
              <button
                onClick={() => setSelectedIncident(null)}
                aria-label="Close review modal"
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-900 text-white rounded">
                    ID: {selectedIncident.id.slice(0, 8)}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${getStatusBadge(
                      selectedIncident.status
                    )}`}
                  >
                    {selectedIncident.status}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Logged: {formatDate(selectedIncident.created_at)}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 pt-1 break-words">
                  {REASON_LABELS[selectedIncident.reason] || selectedIncident.reason}
                </h2>
              </div>
            </div>

            {/* Scrollable Modal Body (Single Primary Scroll Container) */}
            <div
              data-lenis-prevent
              className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 overscroll-contain"
            >
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Target Entity Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                  <div className="flex items-center gap-1.5">
                    {getTargetIcon(selectedIncident.target_type)}
                    <span>Target Entity: {TARGET_LABELS[selectedIncident.target_type]}</span>
                  </div>
                  <span className="font-mono text-slate-700">{selectedIncident.target_id}</span>
                </div>

                {detailLoading ? (
                  <div className="py-3 text-center text-xs font-mono text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Loading target details...
                  </div>
                ) : selectedIncident.target_context ? (
                  <div className="pt-1 text-xs text-slate-800">
                    {selectedIncident.target_context.missing ? (
                      <div className="text-rose-600 font-medium">
                        Target entity appears to be deleted or no longer accessible in the database.
                      </div>
                    ) : selectedIncident.target_context.type === 'question' ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-slate-900">
                          {selectedIncident.target_context.title}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          Category: {selectedIncident.target_context.category} • Topic:{' '}
                          {selectedIncident.target_context.topic} • Difficulty:{' '}
                          {selectedIncident.target_context.difficulty} • Active:{' '}
                          {selectedIncident.target_context.is_active ? 'YES' : 'NO'}
                        </div>
                        {selectedIncident.target_context.prompt && (
                          <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px] max-h-24 overflow-y-auto whitespace-pre-wrap mt-1">
                            {selectedIncident.target_context.prompt}
                          </div>
                        )}
                      </div>
                    ) : selectedIncident.target_context.type === 'contest' ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-slate-900">
                          {selectedIncident.target_context.title}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          Slug: {selectedIncident.target_context.slug} • Status:{' '}
                          {selectedIncident.target_context.status} • Category:{' '}
                          {selectedIncident.target_context.category}
                        </div>
                      </div>
                    ) : selectedIncident.target_context.type === 'user' ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-slate-900">
                          {selectedIncident.target_context.display_name ||
                            selectedIncident.target_context.username}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          Username: @{selectedIncident.target_context.username} • Role:{' '}
                          {selectedIncident.target_context.role}
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-slate-600">Platform / Core System Context</div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Reporter Info & Reported Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                  <span>Incident Description</span>
                  <span>
                    Reporter: @{selectedIncident.reporter?.username || 'player'}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                  {selectedIncident.description}
                </div>
              </div>

              {/* Resolution Info (if resolved or dismissed) */}
              {selectedIncident.resolved_at && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-800 space-y-1">
                  <div className="font-semibold uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Resolution Record</span>
                  </div>
                  <div>
                    Finalized on: {new Date(selectedIncident.resolved_at).toLocaleString()}
                  </div>
                  {selectedIncident.resolver?.username && (
                    <div>By staff member: @{selectedIncident.resolver.username}</div>
                  )}
                </div>
              )}

              {/* Moderator / Staff Internal Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="moderator-notes"
                      className="text-xs font-semibold uppercase text-slate-600"
                    >
                      Staff Audit & Triage Notes
                    </label>
                    {(selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed') && (
                      <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 uppercase">
                        Locked — Terminal Incident
                      </span>
                    )}
                  </div>
                  {notesSaveSuccess && (
                    <span className="text-[11px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Notes Saved!
                    </span>
                  )}
                </div>
                <textarea
                  id="moderator-notes"
                  rows={3}
                  value={notesInput}
                  disabled={selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed'}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={
                    selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed'
                      ? 'No notes logged for this terminal incident.'
                      : 'Document triage observations, verification findings, errata corrections, or reasons for resolution...'
                  }
                  className={`w-full p-3 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none ${
                    selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed'
                      ? 'bg-slate-100 cursor-not-allowed opacity-80'
                      : 'bg-white focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d]'
                  }`}
                />
                {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'dismissed' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="px-3 py-1.5 bg-[#0c1d2d] text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                    >
                      {notesSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Notes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Action Footer (Never scrolls) */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex-none flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {/* Pending -> Reviewing action */}
                {selectedIncident.status === 'pending' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleExecuteStatusTransition('reviewing')}
                    className="px-3.5 py-1.5 bg-sky-600 text-white hover:bg-sky-700 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    {actionLoading ? 'Updating...' : 'Mark in Review'}
                  </button>
                )}

                {/* Reviewing/Pending -> Dismiss action */}
                {(selectedIncident.status === 'pending' || selectedIncident.status === 'reviewing') && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() =>
                      setConfirmAction({
                        type: 'dismiss',
                        incident: selectedIncident,
                      })
                    }
                    className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  >
                    Dismiss Report
                  </button>
                )}

                {/* Reviewing -> Resolve action */}
                {selectedIncident.status === 'reviewing' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() =>
                      setConfirmAction({
                        type: 'resolve',
                        incident: selectedIncident,
                      })
                    }
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    Mark Resolved →
                  </button>
                )}

                {/* Terminal status notice */}
                {(selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed') && (
                  <span className="font-mono text-xs text-slate-500 capitalize font-medium">
                    Terminal Status ({selectedIncident.status})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TERMINAL ACTION CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {confirmAction && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden animate-fade-in"
        >
          <div
            data-lenis-prevent
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                  confirmAction.type === 'resolve' ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                {confirmAction.type === 'resolve' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Slash className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {confirmAction.type === 'resolve' ? 'Resolve Incident?' : 'Dismiss Incident?'}
                </h3>
                <div className="font-mono text-xs text-slate-500">
                  Target: {confirmAction.incident.id.slice(0, 8)}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmAction.type === 'resolve'
                ? 'This action will mark the incident as resolved, attributing resolution to your staff account. Terminal states cannot be reverted.'
                : 'This action will dismiss this report as invalid or unactionable. Terminal states cannot be reverted.'}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  handleExecuteStatusTransition(
                    confirmAction.type === 'resolve' ? 'resolved' : 'dismissed'
                  )
                }
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs ${
                  confirmAction.type === 'resolve'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-[#0c1d2d] text-white hover:bg-slate-800'
                }`}
              >
                {actionLoading ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}
