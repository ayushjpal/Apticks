import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  ArrowLeft,
  Search,
  RefreshCw,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  FileText,
  Users,
} from 'lucide-react'
import StaffLayout from '../../components/layout/StaffLayout'
import { StaffContestService } from '../../services/staffContestService'
import type {
  Contest,
  ContestStatus,
  ContestDifficulty,
  ContestType,
  StaffContestQuestion,
  StaffContestStats,
  StaffCreateContestPayload,
} from '../../types/contests'

const CATEGORIES = [
  'Quantitative Aptitude',
  'Logical Reasoning',
  'Data Interpretation',
  'Verbal & Abstract',
]

const DIFFICULTIES: ContestDifficulty[] = ['easy', 'medium', 'hard', 'open', 'master']
const CONTEST_TYPES: ContestType[] = ['daily', 'weekly', 'custom', 'special']

export default function ModeratorContests() {
  // State
  const [contests, setContests] = useState<Contest[]>([])
  const [stats, setStats] = useState<StaffContestStats>({
    all: 0,
    draft: 0,
    upcoming: 0,
    live: 0,
    completed: 0,
    cancelled: 0,
  })
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<ContestStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [managingContest, setManagingContest] = useState<Contest | null>(null)
  const [contestQuestions, setContestQuestions] = useState<StaffContestQuestion[]>([])
  const [detailTab, setDetailTab] = useState<'overview' | 'questions' | 'participants'>('overview')
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Question Picker state
  const [availableQuestions, setAvailableQuestions] = useState<
    Array<{
      id: string
      title: string
      category: string
      topic: string
      difficulty: string
      isActive?: boolean
      isAssigned: boolean
    }>
  >([])
  const [pickerCategory, setPickerCategory] = useState<string>('all')
  const [pickerSearch, setPickerSearch] = useState<string>('')
  const [pickerLoading, setPickerLoading] = useState<boolean>(false)

  // Helper to get default contest start & end time (tomorrow 10:00 to 11:00 AM local)
  const getDefaultContestTimes = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const end = new Date(tomorrow.getTime() + 60 * 60 * 1000)

    const formatLocal = (d: Date) => {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`
    }

    return {
      start: formatLocal(tomorrow),
      end: formatLocal(end),
    }
  }

  // Create Contest Form state
  const [formTitle, setFormTitle] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('Quantitative Aptitude')
  const [formDifficulty, setFormDifficulty] = useState<ContestDifficulty>('open')
  const [formContestType, setFormContestType] = useState<ContestType>('weekly')
  const [formStartTime, setFormStartTime] = useState(() => getDefaultContestTimes().start)
  const [formEndTime, setFormEndTime] = useState(() => getDefaultContestTimes().end)
  const [formDuration, setFormDuration] = useState(60)
  const [formPositiveMarks, setFormPositiveMarks] = useState(4.0)
  const [formNegativeMarks, setFormNegativeMarks] = useState(1.0)
  const [formXpPool, setFormXpPool] = useState(1000)
  const [formRules, setFormRules] = useState('')
  const [formSyllabus, setFormSyllabus] = useState('')
  const formStatus = 'draft' as const
  const [formError, setFormError] = useState<string | null>(null)

  const handleStartTimeChange = (val: string) => {
    setFormStartTime(val)
    if (val && formEndTime) {
      const s = new Date(val).getTime()
      const e = new Date(formEndTime).getTime()
      if (!isNaN(s) && !isNaN(e) && e > s) {
        setFormDuration(Math.max(1, Math.round((e - s) / 60000)))
      }
    }
  }

  const handleEndTimeChange = (val: string) => {
    setFormEndTime(val)
    if (formStartTime && val) {
      const s = new Date(formStartTime).getTime()
      const e = new Date(val).getTime()
      if (!isNaN(s) && !isNaN(e) && e > s) {
        setFormDuration(Math.max(1, Math.round((e - s) / 60000)))
      }
    }
  }

  const handleDurationChange = (minutes: number) => {
    setFormDuration(minutes)
    if (formStartTime && minutes > 0) {
      const s = new Date(formStartTime).getTime()
      if (!isNaN(s)) {
        const e = new Date(s + minutes * 60000)
        const yyyy = e.getFullYear()
        const mm = String(e.getMonth() + 1).padStart(2, '0')
        const dd = String(e.getDate()).padStart(2, '0')
        const hh = String(e.getHours()).padStart(2, '0')
        const min = String(e.getMinutes()).padStart(2, '0')
        setFormEndTime(`${yyyy}-${mm}-${dd}T${hh}:${min}`)
      }
    }
  }

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true)
    setFormError(null)
    if (!formStartTime || !formEndTime) {
      const defs = getDefaultContestTimes()
      setFormStartTime(defs.start)
      setFormEndTime(defs.end)
      setFormDuration(60)
    }
  }

  // Auto-slug generator
  const handleTitleChange = (val: string) => {
    setFormTitle(val)
    if (!formSlug || formSlug === '') {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
      setFormSlug(generated)
    }
  }

  // Auto-dismiss success toast
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successToast])

  // Lock background body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(managingContest || isQuestionPickerOpen || isCreateModalOpen)
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [managingContest, isQuestionPickerOpen, isCreateModalOpen])

  // ESC key handler to close topmost open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQuestionPickerOpen) {
          setIsQuestionPickerOpen(false)
        } else if (isCreateModalOpen) {
          setIsCreateModalOpen(false)
        } else if (managingContest) {
          setManagingContest(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isQuestionPickerOpen, isCreateModalOpen, managingContest])

  // Initial Load & Filter change (no synchronous setState)
  useEffect(() => {
    let isMounted = true

    StaffContestService.fetchStaffContests({
      statusFilter,
      searchQuery,
    })
      .then((res) => {
        if (!isMounted) return
        if (res.error) {
          setError(res.error)
        } else {
          setContests(res.contests)
          setStats(res.stats)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Failed to load contests')
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [statusFilter, searchQuery])

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await StaffContestService.fetchStaffContests({
        statusFilter,
        searchQuery,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setContests(res.contests)
        setStats(res.stats)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  // Open contest management modal
  const handleOpenManage = async (contest: Contest) => {
    setManagingContest(contest)
    setDetailTab('overview')
    setActionError(null)
    setLoadingDetail(true)

    try {
      const res = await StaffContestService.fetchStaffContestById(contest.id)
      if (res.contest) {
        setManagingContest(res.contest)
      }
      setContestQuestions(res.questions)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load details')
    } finally {
      setLoadingDetail(false)
    }
  }

  // Open Question Picker
  const handleOpenQuestionPicker = async () => {
    if (!managingContest) return
    setIsQuestionPickerOpen(true)
    setPickerLoading(true)

    try {
      const res = await StaffContestService.fetchAvailableQuestionsForPicker({
        contestId: managingContest.id,
        category: pickerCategory,
        search: pickerSearch,
      })
      setAvailableQuestions(res.questions)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load questions')
    } finally {
      setPickerLoading(false)
    }
  }

  // Filter questions in picker
  useEffect(() => {
    if (!isQuestionPickerOpen || !managingContest) return
    let isMounted = true

    StaffContestService.fetchAvailableQuestionsForPicker({
      contestId: managingContest.id,
      category: pickerCategory,
      search: pickerSearch,
    }).then((res) => {
      if (!isMounted) return
      setAvailableQuestions(res.questions)
      setPickerLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [pickerCategory, pickerSearch, isQuestionPickerOpen, managingContest])

  // Assign question
  const handleAssignQuestion = async (questionId: string) => {
    if (!managingContest) return
    setActionLoading(true)
    setActionError(null)

    try {
      const res = await StaffContestService.addContestQuestion(
        managingContest.id,
        questionId,
        managingContest.positiveMarksPerQuestion,
        managingContest.negativeMarksPerQuestion
      )

      if (!res.success) {
        setActionError(res.error || 'Failed to add question')
        setActionLoading(false)
        return
      }

      setSuccessToast(`Question ${questionId} added to contest.`)
      // Refresh questions and contest record
      const updated = await StaffContestService.fetchStaffContestById(managingContest.id)
      if (updated.contest) setManagingContest(updated.contest)
      setContestQuestions(updated.questions)

      // Mark assigned in picker list
      setAvailableQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isAssigned: true } : q))
      )
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error assigning question')
    } finally {
      setActionLoading(false)
    }
  }

  // Remove question
  const handleRemoveQuestion = async (questionId: string) => {
    if (!managingContest) return
    if (!confirm(`Are you sure you want to remove ${questionId} from this contest?`)) return

    setActionLoading(true)
    setActionError(null)

    try {
      const res = await StaffContestService.removeContestQuestion(
        managingContest.id,
        questionId
      )

      if (!res.success) {
        setActionError(res.error || 'Failed to remove question')
        setActionLoading(false)
        return
      }

      setSuccessToast(`Question ${questionId} removed.`)
      // Refresh contest details
      const updated = await StaffContestService.fetchStaffContestById(managingContest.id)
      if (updated.contest) setManagingContest(updated.contest)
      setContestQuestions(updated.questions)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error removing question')
    } finally {
      setActionLoading(false)
    }
  }

  // Move question up / down
  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (!managingContest) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === contestQuestions.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const reordered = [...contestQuestions]
    const item = reordered.splice(index, 1)[0]
    reordered.splice(newIndex, 0, item)

    const questionIds = reordered.map((q) => q.question_id)
    setActionLoading(true)

    try {
      const res = await StaffContestService.reorderContestQuestions(
        managingContest.id,
        questionIds
      )

      if (!res.success) {
        setActionError(res.error || 'Reorder failed')
      } else {
        setContestQuestions(reordered)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reorder error')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle status transition
  const handleStatusChange = async (newStatus: ContestStatus) => {
    if (!managingContest) return
    if (!confirm(`Transition contest status to "${newStatus.toUpperCase()}"?`)) return

    setActionLoading(true)
    setActionError(null)

    try {
      const res = await StaffContestService.setContestStatus(managingContest.id, newStatus)
      if (!res.success) {
        setActionError(res.error || 'Status transition rejected')
        setActionLoading(false)
        return
      }

      setSuccessToast(`Contest status updated to ${newStatus.toUpperCase()}.`)
      const updated = await StaffContestService.fetchStaffContestById(managingContest.id)
      if (updated.contest) setManagingContest(updated.contest)
      await handleRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status update error')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle delete contest
  const handleDeleteContest = async (contestId: string) => {
    if (!confirm('Are you sure you want to delete this contest? This action cannot be undone.'))
      return

    setActionLoading(true)
    try {
      const res = await StaffContestService.deleteContest(contestId)
      if (!res.success) {
        alert(res.error || 'Failed to delete contest.')
        setActionLoading(false)
        return
      }

      setSuccessToast('Contest deleted successfully.')
      setManagingContest(null)
      await handleRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete error')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Create Contest Form submit
  const handleCreateContestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formTitle.trim()) {
      setFormError('Contest title is required.')
      return
    }

    if (!formSlug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formSlug.trim())) {
      setFormError('Slug must contain only lowercase letters, numbers, and single hyphens.')
      return
    }

    if (!formStartTime || !formStartTime.trim()) {
      setFormError('Start date and time are required.')
      return
    }

    if (!formEndTime || !formEndTime.trim()) {
      setFormError('End date and time are required.')
      return
    }

    const startDate = new Date(formStartTime)
    const endDate = new Date(formEndTime)

    if (isNaN(startDate.getTime())) {
      setFormError('Start date and time are required.')
      return
    }

    if (isNaN(endDate.getTime())) {
      setFormError('End date and time are required.')
      return
    }

    if (endDate <= startDate) {
      setFormError('End date and time must be after the start.')
      return
    }

    if (formDuration <= 0) {
      setFormError('Duration must be greater than zero minutes.')
      return
    }

    const payload: StaffCreateContestPayload = {
      title: formTitle.trim(),
      slug: formSlug.trim(),
      description: formDescription.trim() || null,
      category: formCategory,
      difficulty: formDifficulty,
      contest_type: formContestType,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      duration_minutes: formDuration,
      positive_marks: formPositiveMarks,
      negative_marks: formNegativeMarks,
      xp_pool: formXpPool,
      rules: formRules.trim() || null,
      syllabus: formSyllabus.trim() || null,
      status: formStatus,
    }

    setActionLoading(true)
    try {
      const res = await StaffContestService.createContest(payload)
      if (!res.success) {
        setFormError(res.error || 'Contest creation failed.')
        setActionLoading(false)
        return
      }

      setSuccessToast(`Contest "${formTitle}" created in DRAFT state. Assign questions to publish.`)
      setIsCreateModalOpen(false)
      setFormTitle('')
      setFormSlug('')
      setFormDescription('')
      setFormRules('')
      setFormSyllabus('')
      const nextDefaults = getDefaultContestTimes()
      setFormStartTime(nextDefaults.start)
      setFormEndTime(nextDefaults.end)
      setFormDuration(60)
      await handleRefresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  // Status badge styling helper
  const getStatusBadge = (status: ContestStatus) => {
    switch (status) {
      case 'live':
        return 'bg-amber-50 text-amber-800 border-amber-300'
      case 'upcoming':
        return 'bg-sky-50 text-sky-800 border-sky-300'
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-300'
      case 'completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300'
      case 'cancelled':
        return 'bg-rose-50 text-rose-800 border-rose-300'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300'
    }
  }

  return (
    <StaffLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/moderator"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Control Center</span>
              </Link>
              <span className="text-white/30">/</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#ffd43b]/15 text-[#ffd43b] border border-[#ffd43b]/30 rounded-md text-[11px] font-semibold">
                <Trophy className="w-3 h-3" />
                Contests
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Contest Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Orchestrate synchronous tournaments, curate question pools, and inspect live arena metrics.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#ffd43b] text-[#0c1d2d] hover:bg-[#fcc419] rounded-lg text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Contest</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl shadow-xs flex items-center gap-3 text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{successToast}</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl shadow-xs flex items-center gap-3 text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Inventory Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {stats.all}
            </div>
            <div className="text-[11px] font-mono text-slate-400">All Tournaments</div>
          </div>

          <div className="bg-white border border-amber-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Live Arena</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-amber-800">
              {stats.live}
            </div>
            <div className="text-[11px] font-mono text-amber-600/70">In-Progress Now</div>
          </div>

          <div className="bg-white border border-sky-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">Upcoming</span>
              <Calendar className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-sky-800">
              {stats.upcoming}
            </div>
            <div className="text-[11px] font-mono text-sky-600/70">Scheduled Contests</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Drafts</span>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900">
              {stats.draft}
            </div>
            <div className="text-[11px] font-mono text-slate-400">Staged Drafts</div>
          </div>

          <div className="bg-white border border-emerald-200/80 p-3.5 rounded-xl shadow-xs col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-1.5 text-2xl font-bold text-emerald-800">
              {stats.completed}
            </div>
            <div className="text-[11px] font-mono text-emerald-600/70">Archived Rounds</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'live', 'upcoming', 'draft', 'completed', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  statusFilter === st
                    ? 'bg-[#0c1d2d] text-white border-[#0c1d2d] shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'All Contests' : st.charAt(0).toUpperCase() + st.slice(1)}
                <span className={`ml-1.5 px-1.5 py-0.2 rounded font-mono text-[10px] ${
                  statusFilter === st ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {stats[st]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, slug..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] transition-all"
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

        {/* Contest Inventory Table / Cards */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-7 h-7 mx-auto animate-spin text-slate-400 mb-2" />
              <p className="text-xs font-medium text-slate-500">
                Loading tournament inventory...
              </p>
            </div>
          ) : contests.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Trophy className="w-9 h-9 mx-auto text-slate-300" />
              <h3 className="text-base font-semibold text-slate-900">
                No Tournaments Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No contests match your current search or status criteria. Create a new draft contest to begin.
              </p>
            </div>
          ) : (
            <div
              data-lenis-prevent
              className="question-list-scroll max-h-[540px] overflow-y-auto overflow-x-auto min-h-0"
            >
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50/90 backdrop-blur-xs text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4">Contest Title & Slug</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Type & Difficulty</th>
                    <th className="py-3 px-4">Window / Schedule</th>
                    <th className="py-3 px-4">Questions / Marks</th>
                    <th className="py-3 px-4">Participants</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {contests.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => handleOpenManage(c)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-sky-600 transition-colors">
                          {c.title}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          slug: {c.slug} • {c.category}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold capitalize ${getStatusBadge(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-xs text-slate-800 capitalize">
                          {c.contestType || 'weekly'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 uppercase">
                          {c.difficulty}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[11px] text-slate-800">
                          {formatDate(c.startTime)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {c.durationMinutes} mins limit
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-xs text-slate-800">
                          {c.totalQuestions} Questions
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          +{c.positiveMarksPerQuestion} / -{c.negativeMarksPerQuestion} ({c.totalMarks} pts)
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md font-mono font-semibold text-xs text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.participantsCount || 0}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenManage(c)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs transition-colors"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* CONTEST DETAIL & QUESTION MANAGEMENT MODAL */}
        {/* ----------------------------------------------------------------- */}
        {managingContest && (
          <div
            data-lenis-prevent
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setManagingContest(null)
            }}
          >
            <div
              data-lenis-prevent
              className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden h-[92vh] sm:h-[88vh] max-h-[92vh] sm:max-h-[88vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header (Fixed / Never scrolls) */}
              <div className="bg-[#0c1d2d] text-white p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 shrink-0 flex-none">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${getStatusBadge(
                        managingContest.status
                      )}`}
                    >
                      {managingContest.status}
                    </span>
                    <span className="text-xs font-mono text-white/50">
                      ID: {managingContest.id.slice(0, 8)}...
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white line-clamp-1">
                    {managingContest.title}
                  </h2>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    slug: {managingContest.slug} • {managingContest.category}
                  </div>
                </div>

                <button
                  onClick={() => setManagingContest(null)}
                  aria-label="Close contest management modal"
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Tabs (Fixed / Never scrolls) */}
              <div className="border-b border-slate-200 bg-slate-50/70 px-3 sm:px-6 flex items-center gap-1 sm:gap-2 shrink-0 flex-none overflow-x-auto">
                <button
                  onClick={() => setDetailTab('overview')}
                  className={`py-3 px-3 sm:px-4 text-xs font-semibold uppercase border-b-2 whitespace-nowrap transition-colors ${
                    detailTab === 'overview'
                      ? 'border-[#0c1d2d] text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Overview & Config
                </button>
                <button
                  onClick={() => setDetailTab('questions')}
                  className={`py-3 px-3 sm:px-4 text-xs font-semibold uppercase border-b-2 whitespace-nowrap transition-colors ${
                    detailTab === 'questions'
                      ? 'border-[#0c1d2d] text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Questions ({contestQuestions.length})
                </button>
                <button
                  onClick={() => setDetailTab('participants')}
                  className={`py-3 px-3 sm:px-4 text-xs font-semibold uppercase border-b-2 whitespace-nowrap transition-colors ${
                    detailTab === 'participants'
                      ? 'border-[#0c1d2d] text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Participants ({managingContest.participantsCount || 0})
                </button>
              </div>

              {/* Action error banner (Fixed / shrink-0) */}
              {actionError && (
                <div className="mx-3 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-800 flex items-center gap-2 shrink-0 flex-none">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Modal Body: Active Tab Content (Single Primary Scroll Container) */}
              <div
                data-lenis-prevent
                className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden"
                style={{ flex: '1 1 0%' }}
              >
                <div className="p-4 sm:p-6 space-y-6">
                {loadingDetail ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="w-7 h-7 mx-auto animate-spin text-slate-400 mb-2" />
                    <p className="text-xs font-medium text-slate-500">
                      Loading tournament details...
                    </p>
                  </div>
                ) : detailTab === 'overview' ? (
                  /* TAB 1: OVERVIEW & CONFIG */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                        <div className="text-[11px] font-mono text-slate-500 uppercase">Category</div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 mt-1">
                          {managingContest.category}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                        <div className="text-[11px] font-mono text-slate-500 uppercase">Difficulty & Type</div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 mt-1 capitalize">
                          {managingContest.difficulty} • {managingContest.contestType}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                        <div className="text-[11px] font-mono text-slate-500 uppercase">XP Pool</div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 mt-1">
                          {managingContest.xpPool} XP
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-slate-700">
                          Timing & Duration
                        </h4>
                        <div className="text-xs font-mono space-y-1 text-slate-600">
                          <div>Start: {formatDate(managingContest.startTime)}</div>
                          <div>End: {formatDate(managingContest.endTime)}</div>
                          <div>Duration: {managingContest.durationMinutes} Minutes</div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-slate-700">
                          Marking Configuration
                        </h4>
                        <div className="text-xs font-mono space-y-1 text-slate-600">
                          <div>Positive Marks: +{managingContest.positiveMarksPerQuestion}</div>
                          <div>Negative Penalty: -{managingContest.negativeMarksPerQuestion}</div>
                          <div>Total Marks: {managingContest.totalMarks} pts</div>
                        </div>
                      </div>
                    </div>

                    {managingContest.description && (
                      <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
                          Description
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">
                          {managingContest.description}
                        </p>
                      </div>
                    )}

                    {managingContest.rules && (
                      <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">
                          Tournament Rules
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">
                          {managingContest.rules}
                        </p>
                      </div>
                    )}

                    {/* Status Actions */}
                    <div className="border-t border-slate-200 pt-4">
                      <h4 className="text-xs font-semibold uppercase text-slate-700 mb-3">
                        Lifecycle Transitions
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {managingContest.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleStatusChange('upcoming')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 transition-colors shadow-xs"
                            >
                              Schedule / Publish (Upcoming)
                            </button>
                            <button
                              onClick={() => handleStatusChange('cancelled')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
                            >
                              Cancel Contest
                            </button>
                            <button
                              onClick={() => handleDeleteContest(managingContest.id)}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-white text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors shadow-2xs"
                            >
                              Delete Draft
                            </button>
                          </>
                        )}

                        {managingContest.status === 'upcoming' && (
                          <>
                            <button
                              onClick={() => handleStatusChange('live')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-[#ffd43b] text-[#0c1d2d] hover:bg-[#fcc419] rounded-lg text-xs font-semibold shadow-xs transition-colors"
                            >
                              Open Arena (Live)
                            </button>
                            <button
                              onClick={() => handleStatusChange('draft')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                            >
                              Revert to Draft
                            </button>
                            <button
                              onClick={() => handleStatusChange('cancelled')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
                            >
                              Cancel Contest
                            </button>
                          </>
                        )}

                        {managingContest.status === 'live' && (
                          <>
                            <button
                              onClick={() => handleStatusChange('completed')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              Finalize / End Contest
                            </button>
                            <button
                              onClick={() => handleStatusChange('cancelled')}
                              disabled={actionLoading}
                              className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
                            >
                              Cancel Contest
                            </button>
                          </>
                        )}

                        {(managingContest.status === 'completed' ||
                          managingContest.status === 'cancelled') && (
                          <div className="text-xs font-mono text-slate-500 italic">
                            This tournament has reached its terminal state ({managingContest.status}). No further state transitions allowed.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : detailTab === 'questions' ? (
                  /* TAB 2: QUESTIONS MANAGEMENT */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-xs sm:text-sm font-semibold uppercase text-slate-900">
                          Assigned Questions ({contestQuestions.length})
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500">
                          Total Marks: {managingContest.totalMarks} pts • Questions are served in this exact order.
                        </p>
                      </div>

                      {managingContest.status !== 'completed' &&
                        managingContest.status !== 'cancelled' && (
                          <button
                            onClick={handleOpenQuestionPicker}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ffd43b] text-[#0c1d2d] hover:bg-[#fcc419] rounded-lg text-xs font-semibold shadow-xs transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Add Questions</span>
                          </button>
                        )}
                    </div>

                    {contestQuestions.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl space-y-2">
                        <Layers className="w-7 h-7 mx-auto text-slate-400" />
                        <div className="text-xs font-semibold uppercase text-slate-800">
                          No Questions Assigned
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Click "+ Add Questions" to pull questions from the Question Bank into this tournament.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contestQuestions.map((q, idx) => (
                          <div
                            key={q.question_id}
                            className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 bg-slate-900 text-white font-mono font-bold text-xs rounded flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                                  <span className="truncate">{q.title}</span>
                                  {q.is_active === false && (
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-mono text-[9px] font-bold uppercase shrink-0">
                                      Dedicated Contest Q
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                                  ID: {q.question_id} • {q.category} • {q.topic} • {q.difficulty} • +{q.marks} / -{q.negative_marks} pts
                                </div>
                              </div>
                            </div>

                            {managingContest.status !== 'completed' &&
                              managingContest.status !== 'cancelled' && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleMoveQuestion(idx, 'up')}
                                    disabled={idx === 0 || actionLoading}
                                    title="Move Up"
                                    className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveQuestion(idx, 'down')}
                                    disabled={idx === contestQuestions.length - 1 || actionLoading}
                                    title="Move Down"
                                    className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveQuestion(q.question_id)}
                                    disabled={actionLoading}
                                    title="Remove from contest"
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded ml-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* TAB 3: PARTICIPANTS OVERSIGHT */
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold uppercase text-slate-900">
                        Contest Participants ({managingContest.participantsCount || 0})
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500">
                        Player enrollment and synchronous arena session status.
                      </p>
                    </div>

                    {managingContest.participantsCount === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl space-y-2">
                        <Users className="w-7 h-7 mx-auto text-slate-400" />
                        <div className="text-xs font-semibold uppercase text-slate-800">
                          Zero Registrations
                        </div>
                        <p className="text-[11px] text-slate-500">
                          No players have enrolled in this tournament yet.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-center space-y-2">
                        <div className="text-base sm:text-lg font-bold text-slate-900">
                          {managingContest.participantsCount} Registered Players
                        </div>
                        <p className="text-xs text-slate-600 max-w-md mx-auto">
                          Player evaluation and scoring remain server-authoritative. Detailed leaderboard is accessible in the public Results screen once the contest concludes.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Modal Footer (Fixed / Never scrolls) */}
              <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-none">
                <div className="text-[11px] font-mono text-slate-500 hidden sm:block">
                  Status: <span className="font-semibold text-slate-800 capitalize">{managingContest.status}</span> • {contestQuestions.length} Questions • {managingContest.totalMarks} Marks
                </div>
                <button
                  onClick={() => setManagingContest(null)}
                  className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold transition-colors ml-auto shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* ADD QUESTIONS DRAWER / PICKER */}
        {/* ----------------------------------------------------------------- */}
        {isQuestionPickerOpen && managingContest && (
          <div
            data-lenis-prevent
            className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsQuestionPickerOpen(false)
            }}
          >
            <div
              data-lenis-prevent
              className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden h-[88vh] sm:h-[82vh] max-h-[88vh] sm:max-h-[82vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: fixed / never scrolls */}
              <div className="bg-[#0c1d2d] text-white p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0 flex-none">
                <h3 className="text-sm sm:text-base font-bold tracking-tight">
                  Add Active Questions from Bank
                </h3>
                <button
                  onClick={() => setIsQuestionPickerOpen(false)}
                  aria-label="Close question picker"
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toolbar/Filters: fixed / never scrolls */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 flex-none">
                <select
                  value={pickerCategory}
                  onChange={(e) => {
                    setPickerLoading(true)
                    setPickerCategory(e.target.value)
                  }}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0c1d2d] shrink-0"
                >
                  <option value="all">ALL CATEGORIES</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => {
                      setPickerLoading(true)
                      setPickerSearch(e.target.value)
                    }}
                    placeholder="Search active question title, ID, topic..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0c1d2d]"
                  />
                </div>
              </div>

              {/* Question List: THE ONLY vertical scrolling region! */}
              <div
                data-lenis-prevent
                className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden"
                style={{ flex: '1 1 0%' }}
              >
                <div className="p-3 sm:p-4 space-y-2">
                {pickerLoading ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-500 flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                    <span>Loading active candidate questions...</span>
                  </div>
                ) : availableQuestions.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-slate-500">
                    No active questions found matching filter.
                  </div>
                ) : (
                  availableQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="bg-white border border-slate-200/80 p-3 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {q.title}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                          {q.id} • {q.category} • {q.topic} • {q.difficulty}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {q.isAssigned ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-md font-mono font-semibold text-[10px] uppercase">
                            Assigned
                          </span>
                        ) : q.isActive === false ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-mono font-semibold text-[10px] uppercase">
                            Inactive
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAssignQuestion(q.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-[#ffd43b] text-[#0c1d2d] hover:bg-[#fcc419] rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>

              {/* Footer: Fixed / Never scrolls */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-none">
                <div className="text-[11px] font-mono text-slate-500">
                  {availableQuestions.filter((q) => !q.isAssigned && q.isActive !== false).length} active questions available
                </div>
                <button
                  onClick={() => setIsQuestionPickerOpen(false)}
                  className="px-4 py-1.5 bg-[#0c1d2d] text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* CREATE CONTEST MODAL */}
        {/* ----------------------------------------------------------------- */}
        {isCreateModalOpen && (
          <div
            data-lenis-prevent
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCreateModalOpen(false)
            }}
          >
            <div
              data-lenis-prevent
              className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden h-[92vh] sm:h-[88vh] max-h-[92vh] sm:max-h-[88vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: Fixed / Never scrolls */}
              <div className="bg-[#0c1d2d] text-white p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 flex-none">
                <div>
                  <h3 className="text-base sm:text-lg font-bold tracking-tight">
                    Create New Tournament
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Saves initially as a safe draft.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Close create tournament modal"
                  className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form with independent scrollable body and pinned footer */}
              <form onSubmit={handleCreateContestSubmit} noValidate className="flex flex-col flex-1 min-h-0 h-0 overflow-hidden">
                {/* Scrollable Form Body (Single Primary Scroll Container) */}
                <div
                  data-lenis-prevent
                  className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden"
                  style={{ flex: '1 1 0%' }}
                >
                  <div className="p-4 sm:p-6 space-y-4">
                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contest Title *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. Apticks Speed Clash #15"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL Slug * <span className="font-normal text-slate-500">(lowercase, numbers, single hyphens)</span>
                    </label>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="e.g. apticks-speed-clash-15"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Difficulty
                      </label>
                      <select
                        value={formDifficulty}
                        onChange={(e) => setFormDifficulty(e.target.value as ContestDifficulty)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d]"
                      >
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>
                            {d.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tournament Type
                      </label>
                      <select
                        value={formContestType}
                        onChange={(e) => setFormContestType(e.target.value as ContestType)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d]"
                      >
                        {CONTEST_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Start Date & Time *
                        </label>
                      </div>
                      <input
                        type="datetime-local"
                        value={formStartTime}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Select date and specific start time
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          End Date & Time *
                        </label>
                      </div>
                      <input
                        type="datetime-local"
                        value={formEndTime}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Select date and specific end time
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Duration (Mins)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formDuration}
                        onChange={(e) => handleDurationChange(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Positive Marks
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        value={formPositiveMarks}
                        onChange={(e) => setFormPositiveMarks(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Negative Penalty
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={formNegativeMarks}
                        onChange={(e) => setFormNegativeMarks(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        XP Pool
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formXpPool}
                        onChange={(e) => setFormXpPool(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Short summary of topics and speed challenge parameters..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d] shadow-2xs"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Initial Status: Draft
                      </div>
                      <div className="text-xs text-slate-500">
                        Contests must be created in draft state. Questions must be assigned before publishing to Upcoming.
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md text-[10px] font-semibold uppercase shrink-0">
                      Draft
                    </span>
                  </div>
                  </div>
                </div>

                {/* Footer action bar: Fixed / Never scrolls */}
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0 flex-none">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-3.5 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#ffd43b] text-[#0c1d2d] hover:bg-[#fcc419] rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create Contest'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
