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
        return 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]'
      case 'reviewing':
        return 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
      case 'resolved':
        return 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
      case 'dismissed':
        return 'bg-black/5 text-black/60 border-black/20'
      default:
        return 'bg-black/5 text-black border-black/20'
    }
  }

  // Target type icon helper
  const getTargetIcon = (type: TargetType) => {
    switch (type) {
      case 'question':
        return <HelpCircle className="w-3.5 h-3.5 text-[#2563eb]" />
      case 'contest':
        return <Trophy className="w-3.5 h-3.5 text-[#d97706]" />
      case 'user':
        return <User className="w-3.5 h-3.5 text-[#7c3aed]" />
      case 'general':
      default:
        return <Layers className="w-3.5 h-3.5 text-black/60" />
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
          badgeText="INCIDENT TRIAGE"
          badgeIcon={<ShieldCheck className="w-3.5 h-3.5 text-[#ffd43b]" />}
          badgeVariant="navy"
          title="CONTENT MODERATION & REPORTS"
          description="Investigate user errata tickets, question disputes, clarity flags, and platform incidents with authoritative server logging."
          actions={
            <button
              onClick={() => {
                setLoading(true)
                setMetricsLoading(true)
                setRefreshTrigger((v) => v + 1)
              }}
              className="px-3.5 py-2 bg-white text-black hover:bg-[#ffd43b] border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-[2px_2px_0_#000000] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>REFRESH QUEUE</span>
            </button>
          }
        />

        {/* Real Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StaffMetricCard
            label="PENDING REVIEW"
            value={metricsLoading ? '...' : metrics.pending}
            subtext="Awaiting staff inspection"
            icon={<Clock className="w-4 h-4" />}
            iconBg="bg-[#fef3c7]"
            valueColor="text-[#b45309]"
            loading={metricsLoading}
          />
          <StaffMetricCard
            label="UNDER REVIEW"
            value={metricsLoading ? '...' : metrics.reviewing}
            subtext="Actively being analyzed"
            icon={<Eye className="w-4 h-4 text-[#1d4ed8]" />}
            iconBg="bg-[#eff6ff]"
            valueColor="text-[#1d4ed8]"
            loading={metricsLoading}
          />
          <StaffMetricCard
            label="RESOLVED TICKETS"
            value={metricsLoading ? '...' : metrics.resolved}
            subtext="Verified and calibrated"
            icon={<CheckCircle2 className="w-4 h-4 text-[#15803d]" />}
            iconBg="bg-[#dcfce7]"
            valueColor="text-[#15803d]"
            loading={metricsLoading}
          />
          <StaffMetricCard
            label="DISMISSED REPORTS"
            value={metricsLoading ? '...' : metrics.dismissed}
            subtext="Invalid or false alarms"
            icon={<Slash className="w-4 h-4 text-black/60" />}
            iconBg="bg-black/10"
            valueColor="text-black/60"
            loading={metricsLoading}
          />
        </div>

        {/* Controls & Filter Toolbar */}
        <div className="bg-white border-3 sm:border-4 border-black p-4 sm:p-5 rounded-2xl shadow-[6px_6px_0_#000000] space-y-4">
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
                    className={`px-3 py-1.5 rounded-xl border-2 border-black font-display font-black text-xs uppercase whitespace-nowrap transition-all shadow-[1.5px_1.5px_0_#000000] flex items-center gap-1.5 ${
                      selectedStatus === st
                        ? 'bg-[#ffd43b] text-black'
                        : 'bg-white text-black/70 hover:bg-black/5 hover:text-black'
                    }`}
                  >
                    <span>{st === 'all' ? 'ALL' : st}</span>
                    <span className="px-1.5 py-0.2 bg-black/10 rounded font-mono text-[10px]">
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
                className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black border-2 border-black/20 rounded-xl text-xs font-display font-bold uppercase transition-colors inline-flex items-center gap-1 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET FILTERS</span>
              </button>
            )}
          </div>

          {/* Secondary Filters: Reason Category & Live Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-black/10">
            {/* Reason Selector */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-black/40 shrink-0 hidden sm:block" />
              <select
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value as ReportReason | 'all')
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-bold text-black focus:outline-none focus:bg-white focus:border-black shadow-[2px_2px_0_#000000]"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by report ID, target ID, reporter, or description..."
                className="w-full pl-9 pr-8 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-bold text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:border-black shadow-[2px_2px_0_#000000]"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-black/60 pt-1 border-t border-black/10">
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
          <div className="bg-[#fee2e2] border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000] flex items-center justify-between gap-3 text-black">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ef4444] shrink-0" />
              <span className="text-xs font-body font-bold">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-black/60 hover:text-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Incidents Table / Card Container */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-black border-t-[#ffd43b] rounded-full animate-spin mx-auto" />
              <div className="text-xs font-display font-black uppercase text-black/60">
                LOADING INCIDENT QUEUE...
              </div>
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center mx-auto text-black/40">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-base uppercase text-black">
                NO INCIDENTS FOUND
              </h3>
              <p className="text-xs font-body font-semibold text-black/60 max-w-sm mx-auto">
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
                className="hidden md:block question-list-scroll max-h-[520px] overflow-y-auto overflow-x-auto min-h-0"
              >
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 shadow-[0_2px_0_#000000]">
                    <tr className="bg-[#f8fafc] border-b-3 border-black text-[11px] font-display font-black uppercase text-black tracking-wider">
                      <th className="py-3 px-4 w-28">REPORT ID</th>
                      <th className="py-3 px-4 w-44">TARGET ENTITY</th>
                      <th className="py-3 px-4 w-40">REASON</th>
                      <th className="py-3 px-4 min-w-[240px]">DESCRIPTION SUMMARY</th>
                      <th className="py-3 px-4 w-36">REPORTER</th>
                      <th className="py-3 px-4 w-28 text-center">STATUS</th>
                      <th className="py-3 px-4 w-28 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black/10">
                    {incidents.map((rep) => (
                      <tr
                        key={rep.id}
                        className="hover:bg-[#f8fafc]/80 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetail(rep)}
                      >
                        {/* Report ID */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-mono text-[11px] font-bold text-black bg-black/5 px-2 py-0.5 rounded border border-black/20">
                            {rep.id.slice(0, 8)}
                          </span>
                          <div className="text-[10px] font-mono text-black/50 mt-1">
                            {formatDate(rep.created_at)}
                          </div>
                        </td>

                        {/* Target Entity */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-1.5 font-display font-black text-xs text-black">
                            {getTargetIcon(rep.target_type)}
                            <span className="uppercase">{rep.target_type}</span>
                          </div>
                          <div className="font-mono text-xs font-bold text-black/70 mt-0.5 truncate">
                            {rep.target_id}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-block px-2 py-0.5 bg-black/5 text-black border border-black/20 rounded text-[10px] font-display font-bold">
                            {REASON_LABELS[rep.reason] || rep.reason}
                          </span>
                        </td>

                        {/* Description Summary */}
                        <td className="py-3.5 px-4 align-top">
                          <p className="font-body text-xs font-semibold text-black/80 line-clamp-2 leading-snug">
                            {rep.description}
                          </p>
                          {rep.moderator_notes && (
                            <div className="mt-1 text-[10px] font-mono text-[#0284c7] font-bold flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span>Notes logged</span>
                            </div>
                          )}
                        </td>

                        {/* Reporter */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-display font-black text-xs text-black truncate">
                            {rep.reporter?.display_name || rep.reporter?.username || 'Player'}
                          </div>
                          <div className="font-mono text-[10px] text-black/50 truncate">
                            @{rep.reporter?.username || 'unnamed'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-display font-black uppercase border ${getStatusBadge(
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
                            className="px-3 py-1 bg-white hover:bg-[#ffd43b] text-black border-2 border-black rounded-lg font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#000000] transition-colors"
                          >
                            REVIEW
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
                className="md:hidden question-list-scroll max-h-[60vh] sm:max-h-[500px] overflow-y-auto min-h-0 divide-y-2 divide-black/10"
              >
                {incidents.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => handleOpenDetail(rep)}
                    className="p-4 space-y-3 hover:bg-[#f8fafc] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold bg-black/5 px-2 py-0.5 rounded border border-black/20">
                          {rep.id.slice(0, 8)}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-display font-bold text-black">
                          {getTargetIcon(rep.target_type)}
                          <span className="uppercase">{rep.target_type}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-display font-black uppercase border ${getStatusBadge(
                          rep.status
                        )}`}
                      >
                        {rep.status}
                      </span>
                    </div>

                    <div>
                      <div className="text-[11px] font-display font-black text-black">
                        {REASON_LABELS[rep.reason] || rep.reason}
                      </div>
                      <p className="font-body text-xs font-semibold text-black/80 line-clamp-2 mt-0.5 leading-snug">
                        {rep.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-black/5 text-xs font-mono text-black/60">
                      <span>Target: {rep.target_id}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetail(rep)
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-[#ffd43b] text-black border-2 border-black rounded-lg font-display font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_#000000]"
                      >
                        REVIEW →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t-3 border-black bg-[#f8fafc] flex items-center justify-between">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-black rounded-xl font-display font-bold text-xs uppercase disabled:opacity-40 hover:bg-black hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREV</span>
              </button>

              <div className="text-xs font-mono font-bold text-black/70">
                Page {currentPage} of {totalPages}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-black rounded-xl font-display font-bold text-xs uppercase disabled:opacity-40 hover:bg-black hover:text-white transition-colors"
              >
                <span>NEXT</span>
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedIncident(null)
          }}
        >
          <div
            data-lenis-prevent
            className="bg-white border-3 sm:border-4 border-black rounded-2xl max-w-2xl w-full h-[90vh] sm:h-[86vh] max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-[8px_8px_0_#000000] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pinned Modal Header (Never scrolls) */}
            <div className="p-4 sm:p-5 border-b-2 sm:border-b-3 border-black shrink-0 flex-none relative pr-12 bg-white">
              <button
                onClick={() => setSelectedIncident(null)}
                aria-label="Close review modal"
                className="absolute top-4 right-4 p-2 text-black/50 hover:text-black hover:bg-black/5 rounded-xl border border-transparent hover:border-black/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 bg-black text-white rounded">
                    ID: {selectedIncident.id.slice(0, 8)}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-display font-black uppercase border ${getStatusBadge(
                      selectedIncident.status
                    )}`}
                  >
                    {selectedIncident.status}
                  </span>
                  <span className="text-xs font-mono text-black/60">
                    Logged: {formatDate(selectedIncident.created_at)}
                  </span>
                </div>
                <h2 className="font-display font-black text-lg sm:text-xl uppercase text-black pt-1 break-words">
                  {REASON_LABELS[selectedIncident.reason] || selectedIncident.reason}
                </h2>
              </div>
            </div>

            {/* Scrollable Modal Body (Single Primary Scroll Container) */}
            <div
              data-lenis-prevent
              className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 overscroll-contain"
            >
              {actionError && (
                <div className="p-3 bg-[#fee2e2] border-2 border-black rounded-xl text-xs font-body font-bold text-black flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#b91c1c] shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Target Entity Summary Card */}
              <div className="bg-[#f8fafc] border-2 border-black p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-display font-black uppercase text-black/60">
                  <div className="flex items-center gap-1.5">
                    {getTargetIcon(selectedIncident.target_type)}
                    <span>TARGET ENTITY: {TARGET_LABELS[selectedIncident.target_type]}</span>
                  </div>
                  <span className="font-mono text-black">{selectedIncident.target_id}</span>
                </div>

                {detailLoading ? (
                  <div className="py-3 text-center text-xs font-mono text-black/50">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Loading target details...
                  </div>
                ) : selectedIncident.target_context ? (
                  <div className="pt-1 text-xs font-body text-black">
                    {selectedIncident.target_context.missing ? (
                      <div className="text-[#b91c1c] font-bold">
                        Target entity appears to be deleted or no longer accessible in the database.
                      </div>
                    ) : selectedIncident.target_context.type === 'question' ? (
                      <div className="space-y-1">
                        <div className="font-display font-bold text-sm text-black">
                          {selectedIncident.target_context.title}
                        </div>
                        <div className="text-black/60 font-mono text-[11px]">
                          Category: {selectedIncident.target_context.category} • Topic:{' '}
                          {selectedIncident.target_context.topic} • Difficulty:{' '}
                          {selectedIncident.target_context.difficulty} • Active:{' '}
                          {selectedIncident.target_context.is_active ? 'YES' : 'NO'}
                        </div>
                        {selectedIncident.target_context.prompt && (
                          <div className="p-2.5 bg-white border border-black/20 rounded-lg text-black/80 font-mono text-[11px] max-h-24 overflow-y-auto whitespace-pre-wrap mt-1">
                            {selectedIncident.target_context.prompt}
                          </div>
                        )}
                      </div>
                    ) : selectedIncident.target_context.type === 'contest' ? (
                      <div className="space-y-1">
                        <div className="font-display font-bold text-sm text-black">
                          {selectedIncident.target_context.title}
                        </div>
                        <div className="text-black/60 font-mono text-[11px]">
                          Slug: {selectedIncident.target_context.slug} • Status:{' '}
                          {selectedIncident.target_context.status} • Category:{' '}
                          {selectedIncident.target_context.category}
                        </div>
                      </div>
                    ) : selectedIncident.target_context.type === 'user' ? (
                      <div className="space-y-1">
                        <div className="font-display font-bold text-sm text-black">
                          {selectedIncident.target_context.display_name ||
                            selectedIncident.target_context.username}
                        </div>
                        <div className="text-black/60 font-mono text-[11px]">
                          Username: @{selectedIncident.target_context.username} • Role:{' '}
                          {selectedIncident.target_context.role}
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-black/70">Platform / Core System Context</div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Reporter Info & Reported Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-display font-black uppercase text-black/60">
                  <span>INCIDENT DESCRIPTION</span>
                  <span>
                    REPORTER: @{selectedIncident.reporter?.username || 'player'}
                  </span>
                </div>
                <div className="p-4 bg-[#f8fafc] border-2 border-black rounded-xl text-xs sm:text-sm font-body font-semibold text-black/90 leading-relaxed whitespace-pre-wrap break-words">
                  {selectedIncident.description}
                </div>
              </div>

              {/* Resolution Info (if resolved or dismissed) */}
              {selectedIncident.resolved_at && (
                <div className="p-3 bg-[#f0fdf4] border-2 border-[#86efac] rounded-xl text-xs font-mono text-[#15803d] space-y-1">
                  <div className="font-bold uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="moderator-notes"
                      className="text-xs font-display font-black uppercase text-black/70"
                    >
                      STAFF AUDIT & TRIAGE NOTES
                    </label>
                    {(selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed') && (
                      <span className="text-[10px] font-mono font-bold bg-black/10 text-black/70 px-2 py-0.5 rounded border border-black/20 uppercase">
                        LOCKED — TERMINAL INCIDENT
                      </span>
                    )}
                  </div>
                  {notesSaveSuccess && (
                    <span className="text-[11px] font-mono text-[#15803d] font-bold flex items-center gap-1">
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
                  className={`w-full p-3 border-2 border-black rounded-xl text-xs font-body font-bold text-black placeholder:text-black/40 shadow-[2px_2px_0_#000000] focus:outline-none ${
                    selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed'
                      ? 'bg-black/5 cursor-not-allowed opacity-80'
                      : 'bg-[#f8fafc] focus:bg-white focus:border-black'
                  }`}
                />
                {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'dismissed' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="px-3.5 py-1.5 bg-black text-white hover:bg-[#ffd43b] hover:text-black border-2 border-black rounded-lg font-display font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {notesSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>SAVE NOTES</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Action Footer (Never scrolls) */}
            <div className="p-3 sm:p-4 border-t-2 sm:border-t-3 border-black bg-[#f8fafc] shrink-0 flex-none flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 bg-white text-black hover:bg-black/5 border-2 border-black rounded-xl font-display font-black text-xs uppercase transition-colors"
              >
                CLOSE
              </button>

              <div className="flex items-center gap-2">
                {/* Pending -> Reviewing action */}
                {selectedIncident.status === 'pending' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleExecuteStatusTransition('reviewing')}
                    className="px-4 py-2 bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase transition-all shadow-[2px_2px_0_#000000]"
                  >
                    {actionLoading ? 'UPDATING...' : 'MARK IN REVIEW'}
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
                    className="px-4 py-2 bg-white hover:bg-[#fee2e2] text-black hover:text-[#b91c1c] border-2 border-black rounded-xl font-display font-black text-xs uppercase transition-all shadow-[2px_2px_0_#000000]"
                  >
                    DISMISS REPORT
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
                    className="px-4 py-2 bg-[#ffd43b] hover:bg-[#15803d] text-black hover:text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase transition-all shadow-[2px_2px_0_#000000]"
                  >
                    MARK RESOLVED →
                  </button>
                )}

                {/* Terminal status notice */}
                {(selectedIncident.status === 'resolved' || selectedIncident.status === 'dismissed') && (
                  <span className="font-mono text-xs text-black/50 uppercase font-bold">
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
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden animate-fade-in"
        >
          <div
            data-lenis-prevent
            className="bg-white border-3 sm:border-4 border-black rounded-2xl max-w-md w-full p-6 shadow-[8px_8px_0_#000000] relative space-y-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center text-white ${
                  confirmAction.type === 'resolve' ? 'bg-[#10b981]' : 'bg-[#64748b]'
                }`}
              >
                {confirmAction.type === 'resolve' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Slash className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-display font-black text-lg uppercase text-black">
                  {confirmAction.type === 'resolve' ? 'RESOLVE INCIDENT?' : 'DISMISS INCIDENT?'}
                </h3>
                <div className="font-mono text-xs font-bold text-black/60">
                  Target: {confirmAction.incident.id.slice(0, 8)}
                </div>
              </div>
            </div>

            <p className="text-xs font-body font-semibold text-black/70 leading-relaxed">
              {confirmAction.type === 'resolve'
                ? 'This action will mark the incident as resolved, attributing resolution to your staff account. Terminal states cannot be reverted.'
                : 'This action will dismiss this report as invalid or unactionable. Terminal states cannot be reverted.'}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-white text-black hover:bg-black/5 border-2 border-black rounded-xl font-display font-black text-xs uppercase"
              >
                CANCEL
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  handleExecuteStatusTransition(
                    confirmAction.type === 'resolve' ? 'resolved' : 'dismissed'
                  )
                }
                className={`px-5 py-2 text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] ${
                  confirmAction.type === 'resolve'
                    ? 'bg-[#10b981] text-white hover:bg-[#059669]'
                    : 'bg-[#ffd43b] hover:bg-black hover:text-white'
                }`}
              >
                {actionLoading ? 'SAVING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}
