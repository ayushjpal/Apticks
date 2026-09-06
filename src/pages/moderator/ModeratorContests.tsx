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
        return 'bg-[#ffd43b] text-black border-black shadow-[2px_2px_0_#000000]'
      case 'upcoming':
        return 'bg-[#38aef0] text-black border-black shadow-[2px_2px_0_#000000]'
      case 'draft':
        return 'bg-white/80 text-black border-black shadow-[2px_2px_0_#000000]'
      case 'completed':
        return 'bg-[#15803d] text-white border-black shadow-[2px_2px_0_#000000]'
      case 'cancelled':
        return 'bg-[#ff5c5c] text-white border-black shadow-[2px_2px_0_#000000]'
      default:
        return 'bg-black text-white'
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
                className="inline-flex items-center gap-1.5 text-xs font-display font-black text-white/70 hover:text-white uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>CONTROL CENTER</span>
              </Link>
              <span className="text-white/40">/</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#ffd43b] text-black border-2 border-black rounded-full font-display font-black text-[11px] shadow-[1.5px_1.5px_0_#000000]">
                <Trophy className="w-3 h-3" />
                CONTESTS
              </span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-white">
              CONTEST MANAGEMENT
            </h1>
            <p className="text-xs sm:text-sm font-body font-semibold text-white/70">
              Orchestrate synchronous tournaments, curate question pools, and inspect live arena metrics.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white text-black border-2 sm:border-3 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000000] hover:bg-[#ffd43b] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#ffd43b] text-black border-2 sm:border-3 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000000] hover:bg-[#ffdf5d] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>CREATE CONTEST</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {successToast && (
          <div className="bg-[#dcfce7] border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000] flex items-center gap-3 text-black">
            <CheckCircle2 className="w-5 h-5 text-[#15803d] shrink-0" />
            <p className="text-xs sm:text-sm font-body font-bold">{successToast}</p>
          </div>
        )}

        {error && (
          <div className="bg-[#fee2e2] border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000] flex items-center gap-3 text-black">
            <AlertTriangle className="w-5 h-5 text-[#b91c1c] shrink-0" />
            <p className="text-xs sm:text-sm font-body font-bold">{error}</p>
          </div>
        )}

        {/* Inventory Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white border-2 sm:border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-[11px] text-black/60 uppercase">TOTAL</span>
              <Layers className="w-4 h-4 text-black/40" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {stats.all}
            </div>
            <div className="text-[11px] font-mono text-black/50 font-bold">All Tournaments</div>
          </div>

          <div className="bg-[#ffd43b] border-2 sm:border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-[11px] text-black uppercase">LIVE ARENA</span>
              <Trophy className="w-4 h-4 text-black" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {stats.live}
            </div>
            <div className="text-[11px] font-mono text-black/70 font-bold">In-Progress Now</div>
          </div>

          <div className="bg-[#38aef0] border-2 sm:border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-[11px] text-black uppercase">UPCOMING</span>
              <Calendar className="w-4 h-4 text-black" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {stats.upcoming}
            </div>
            <div className="text-[11px] font-mono text-black/70 font-bold">Scheduled Contests</div>
          </div>

          <div className="bg-white border-2 sm:border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-[11px] text-black/60 uppercase">DRAFTS</span>
              <FileText className="w-4 h-4 text-black/40" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {stats.draft}
            </div>
            <div className="text-[11px] font-mono text-black/50 font-bold">Staged Drafts</div>
          </div>

          <div className="bg-white border-2 sm:border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000] col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="font-display font-black text-[11px] text-black/60 uppercase">COMPLETED</span>
              <CheckCircle2 className="w-4 h-4 text-black/40" />
            </div>
            <div className="mt-2 font-display font-black text-2xl sm:text-3xl text-black">
              {stats.completed}
            </div>
            <div className="text-[11px] font-mono text-black/50 font-bold">Archived Rounds</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000] space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'live', 'upcoming', 'draft', 'completed', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-display font-black uppercase rounded-lg border-2 border-black transition-all ${
                  statusFilter === st
                    ? 'bg-black text-white shadow-[2px_2px_0_#000000]'
                    : 'bg-white text-black hover:bg-black/5'
                }`}
              >
                {st === 'all' ? 'ALL CONTESTS' : st.toUpperCase()}
                <span className="ml-1.5 px-1.5 py-0.2 bg-black/10 text-inherit rounded font-mono text-[10px]">
                  {stats[st]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, slug..."
              className="w-full pl-9 pr-8 py-2 bg-[#f8fafc] border-2 border-black rounded-lg text-xs font-body font-bold text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:border-black shadow-[2px_2px_0_#000000]"
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

        {/* Contest Inventory Table / Cards */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-black/40 mb-3" />
              <p className="font-display font-black text-sm uppercase text-black/60">
                Loading Tournament Inventory...
              </p>
            </div>
          ) : contests.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Trophy className="w-10 h-10 mx-auto text-black/30" />
              <h3 className="font-display font-black text-lg uppercase text-black">
                No Tournaments Found
              </h3>
              <p className="text-xs sm:text-sm font-body font-semibold text-black/60 max-w-sm mx-auto">
                No contests match your current search or status criteria. Create a new draft contest to begin.
              </p>
            </div>
          ) : (
            <div
              data-lenis-prevent
              className="question-list-scroll max-h-[520px] overflow-y-auto overflow-x-auto min-h-0"
            >
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow-[0_2px_0_#000000]">
                  <tr className="border-b-3 border-black bg-[#f1f5f9] text-[11px] font-display font-black uppercase text-black tracking-wider">
                    <th className="py-3 px-4">CONTEST TITLE & SLUG</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4">TYPE & DIFFICULTY</th>
                    <th className="py-3 px-4">WINDOW / SCHEDULE</th>
                    <th className="py-3 px-4">QUESTIONS / MARKS</th>
                    <th className="py-3 px-4">PARTICIPANTS</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10 text-xs font-body font-semibold text-black">
                  {contests.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[#f8fafc] transition-colors group cursor-pointer"
                      onClick={() => handleOpenManage(c)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-display font-black text-sm uppercase text-black group-hover:text-[#0284c7] transition-colors">
                          {c.title}
                        </div>
                        <div className="font-mono text-[11px] text-black/50">
                          slug: {c.slug} • {c.category}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-display font-black uppercase ${getStatusBadge(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-display font-black text-xs uppercase text-black">
                          {c.contestType || 'weekly'}
                        </div>
                        <div className="font-mono text-[11px] text-black/60 uppercase">
                          {c.difficulty}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[11px] text-black">
                          {formatDate(c.startTime)}
                        </div>
                        <div className="text-[11px] font-mono text-black/50">
                          {c.durationMinutes} mins limit
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-display font-black text-xs text-black">
                          {c.totalQuestions} Questions
                        </div>
                        <div className="font-mono text-[11px] text-black/60">
                          +{c.positiveMarksPerQuestion} / -{c.negativeMarksPerQuestion} ({c.totalMarks} pts)
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/5 border border-black/10 rounded-md font-mono font-bold text-xs">
                          <Users className="w-3.5 h-3.5 text-black/60" />
                          <span>{c.participantsCount || 0}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenManage(c)}
                          className="px-3 py-1.5 bg-white text-black hover:bg-[#ffd43b] border-2 border-black rounded-lg font-display font-black text-[11px] uppercase tracking-wider shadow-[2px_2px_0_#000000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
                        >
                          MANAGE
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
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setManagingContest(null)
            }}
          >
            <div
              data-lenis-prevent
              className="bg-white border-3 sm:border-4 border-black w-full max-w-4xl rounded-2xl shadow-[8px_8px_0_#000000] overflow-hidden h-[92vh] sm:h-[88vh] max-h-[92vh] sm:max-h-[88vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header (Fixed / Never scrolls) */}
              <div className="bg-[#071a2b] text-white p-4 sm:p-5 border-b-3 border-black flex items-start justify-between gap-4 shrink-0 flex-none">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-display font-black uppercase ${getStatusBadge(
                        managingContest.status
                      )}`}
                    >
                      {managingContest.status}
                    </span>
                    <span className="text-xs font-mono text-white/60">
                      ID: {managingContest.id.slice(0, 8)}...
                    </span>
                  </div>
                  <h2 className="font-display font-black text-lg sm:text-2xl uppercase tracking-tight text-white line-clamp-1">
                    {managingContest.title}
                  </h2>
                  <div className="text-xs font-mono text-white/70 mt-0.5">
                    slug: {managingContest.slug} • {managingContest.category}
                  </div>
                </div>

                <button
                  onClick={() => setManagingContest(null)}
                  aria-label="Close contest management modal"
                  className="w-8 h-8 bg-white/10 hover:bg-[#ff5c5c] text-white hover:text-black border-2 border-white/20 hover:border-black rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs (Fixed / Never scrolls) */}
              <div className="border-b-2 border-black bg-[#f8fafc] px-3 sm:px-6 flex items-center gap-1 sm:gap-2 shrink-0 flex-none overflow-x-auto">
                <button
                  onClick={() => setDetailTab('overview')}
                  className={`py-3 px-3 sm:px-4 font-display font-black text-xs uppercase border-b-3 whitespace-nowrap transition-colors ${
                    detailTab === 'overview'
                      ? 'border-black text-black'
                      : 'border-transparent text-black/50 hover:text-black'
                  }`}
                >
                  OVERVIEW & CONFIG
                </button>
                <button
                  onClick={() => setDetailTab('questions')}
                  className={`py-3 px-3 sm:px-4 font-display font-black text-xs uppercase border-b-3 whitespace-nowrap transition-colors ${
                    detailTab === 'questions'
                      ? 'border-black text-black'
                      : 'border-transparent text-black/50 hover:text-black'
                  }`}
                >
                  QUESTIONS ({contestQuestions.length})
                </button>
                <button
                  onClick={() => setDetailTab('participants')}
                  className={`py-3 px-3 sm:px-4 font-display font-black text-xs uppercase border-b-3 whitespace-nowrap transition-colors ${
                    detailTab === 'participants'
                      ? 'border-black text-black'
                      : 'border-transparent text-black/50 hover:text-black'
                  }`}
                >
                  PARTICIPANTS ({managingContest.participantsCount || 0})
                </button>
              </div>

              {/* Action error banner (Fixed / shrink-0) */}
              {actionError && (
                <div className="mx-3 sm:mx-6 mt-3 p-3 bg-[#fee2e2] border-2 border-black rounded-lg text-xs font-body font-bold text-black flex items-center gap-2 shrink-0 flex-none">
                  <AlertTriangle className="w-4 h-4 text-[#b91c1c] shrink-0" />
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
                    <RefreshCw className="w-8 h-8 mx-auto animate-spin text-black/40 mb-2" />
                    <p className="font-display font-black text-xs uppercase text-black/60">
                      Loading Tournament Details...
                    </p>
                  </div>
                ) : detailTab === 'overview' ? (
                  /* TAB 1: OVERVIEW & CONFIG */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#f8fafc] border-2 border-black p-3.5 rounded-xl">
                        <div className="text-[11px] font-mono text-black/60 uppercase">Category</div>
                        <div className="font-display font-black text-sm uppercase text-black mt-1">
                          {managingContest.category}
                        </div>
                      </div>

                      <div className="bg-[#f8fafc] border-2 border-black p-3.5 rounded-xl">
                        <div className="text-[11px] font-mono text-black/60 uppercase">Difficulty & Type</div>
                        <div className="font-display font-black text-sm uppercase text-black mt-1">
                          {managingContest.difficulty} • {managingContest.contestType}
                        </div>
                      </div>

                      <div className="bg-[#f8fafc] border-2 border-black p-3.5 rounded-xl">
                        <div className="text-[11px] font-mono text-black/60 uppercase">XP Pool</div>
                        <div className="font-display font-black text-sm text-black mt-1">
                          {managingContest.xpPool} XP
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white border-2 border-black p-4 rounded-xl space-y-2">
                        <h4 className="font-display font-black text-xs uppercase text-black">
                          TIMING & DURATION
                        </h4>
                        <div className="text-xs font-mono space-y-1 text-black/80">
                          <div>Start: {formatDate(managingContest.startTime)}</div>
                          <div>End: {formatDate(managingContest.endTime)}</div>
                          <div>Duration: {managingContest.durationMinutes} Minutes</div>
                        </div>
                      </div>

                      <div className="bg-white border-2 border-black p-4 rounded-xl space-y-2">
                        <h4 className="font-display font-black text-xs uppercase text-black">
                          MARKING CONFIGURATION
                        </h4>
                        <div className="text-xs font-mono space-y-1 text-black/80">
                          <div>Positive Marks: +{managingContest.positiveMarksPerQuestion}</div>
                          <div>Negative Penalty: -{managingContest.negativeMarksPerQuestion}</div>
                          <div>Total Marks: {managingContest.totalMarks} pts</div>
                        </div>
                      </div>
                    </div>

                    {managingContest.description && (
                      <div className="bg-[#f8fafc] border-2 border-black p-4 rounded-xl">
                        <div className="text-[11px] font-display font-black text-black/60 uppercase mb-1">
                          Description
                        </div>
                        <p className="text-xs font-body text-black/80 whitespace-pre-wrap">
                          {managingContest.description}
                        </p>
                      </div>
                    )}

                    {managingContest.rules && (
                      <div className="bg-[#f8fafc] border-2 border-black p-4 rounded-xl">
                        <div className="text-[11px] font-display font-black text-black/60 uppercase mb-1">
                          Tournament Rules
                        </div>
                        <p className="text-xs font-body text-black/80 whitespace-pre-wrap">
                          {managingContest.rules}
                        </p>
                      </div>
                    )}

                    {/* Status Actions */}
                    <div className="border-t-2 border-black/10 pt-4">
                      <h4 className="font-display font-black text-xs uppercase text-black mb-3">
                        LIFECYCLE TRANSITIONS
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {managingContest.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleStatusChange('upcoming')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-[#38aef0] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-[#68c6fc]"
                            >
                              SCHEDULE / PUBLISH (UPCOMING)
                            </button>
                            <button
                              onClick={() => handleStatusChange('cancelled')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-[#ff5c5c] text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-black"
                            >
                              CANCEL CONTEST
                            </button>
                            <button
                              onClick={() => handleDeleteContest(managingContest.id)}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-white text-[#b91c1c] border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-[#fee2e2]"
                            >
                              DELETE DRAFT
                            </button>
                          </>
                        )}

                        {managingContest.status === 'upcoming' && (
                          <>
                            <button
                              onClick={() => handleStatusChange('live')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-[#ffd43b] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-[#ffdf5d]"
                            >
                              OPEN ARENA (LIVE)
                            </button>
                            <button
                              onClick={() => handleStatusChange('draft')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-white text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-black/5"
                            >
                              REVERT TO DRAFT
                            </button>
                            <button
                              onClick={() => handleStatusChange('cancelled')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-[#ff5c5c] text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-black"
                            >
                              CANCEL CONTEST
                            </button>
                          </>
                        )}

                        {managingContest.status === 'live' && (
                          <>
                            <button
                              onClick={() => handleStatusChange('completed')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-[#15803d] text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-black"
                            >
                              FINALIZE / END CONTEST
                            </button>
                            <button
                              onClick={() => handleStatusChange('cancelled')}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-[#ff5c5c] text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-black"
                            >
                              CANCEL CONTEST
                            </button>
                          </>
                        )}

                        {(managingContest.status === 'completed' ||
                          managingContest.status === 'cancelled') && (
                          <div className="text-xs font-mono text-black/60 italic">
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
                        <h3 className="font-display font-black text-sm uppercase text-black">
                          Assigned Questions ({contestQuestions.length})
                        </h3>
                        <p className="text-[11px] font-mono text-black/60">
                          Total Marks: {managingContest.totalMarks} pts • Questions are served in this exact order.
                        </p>
                      </div>

                      {managingContest.status !== 'completed' &&
                        managingContest.status !== 'cancelled' && (
                          <button
                            onClick={handleOpenQuestionPicker}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#ffd43b] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] hover:bg-[#ffdf5d]"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>+ ADD QUESTIONS</span>
                          </button>
                        )}
                    </div>

                    {contestQuestions.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-black/20 rounded-xl space-y-2">
                        <Layers className="w-8 h-8 mx-auto text-black/30" />
                        <div className="font-display font-black text-xs uppercase text-black">
                          No Questions Assigned
                        </div>
                        <p className="text-[11px] font-body text-black/60">
                          Click "+ Add Questions" to pull questions from the Question Bank into this tournament.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contestQuestions.map((q, idx) => (
                          <div
                            key={q.question_id}
                            className="bg-[#f8fafc] border-2 border-black p-3 rounded-xl flex items-center justify-between gap-3 shadow-[2px_2px_0_#000000]"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-7 bg-black text-white font-mono font-black text-xs rounded-lg flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="font-display font-black text-xs uppercase text-black flex items-center gap-2 flex-wrap">
                                  <span className="truncate">{q.title}</span>
                                  {q.is_active === false && (
                                    <span className="px-1.5 py-0.5 bg-black/10 text-black/70 border border-black/20 rounded font-mono text-[9px] font-bold uppercase shrink-0">
                                      Dedicated Contest Q
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-[10px] text-black/60 truncate">
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
                                    className="p-1 text-black/60 hover:text-black disabled:opacity-20"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveQuestion(idx, 'down')}
                                    disabled={idx === contestQuestions.length - 1 || actionLoading}
                                    title="Move Down"
                                    className="p-1 text-black/60 hover:text-black disabled:opacity-20"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveQuestion(q.question_id)}
                                    disabled={actionLoading}
                                    title="Remove from contest"
                                    className="p-1 text-[#b91c1c] hover:bg-[#fee2e2] rounded ml-1"
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
                      <h3 className="font-display font-black text-sm uppercase text-black">
                        Contest Participants ({managingContest.participantsCount || 0})
                      </h3>
                      <p className="text-[11px] font-mono text-black/60">
                        Player enrollment and synchronous arena session status.
                      </p>
                    </div>

                    {managingContest.participantsCount === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-black/20 rounded-xl space-y-2">
                        <Users className="w-8 h-8 mx-auto text-black/30" />
                        <div className="font-display font-black text-xs uppercase text-black">
                          Zero Registrations
                        </div>
                        <p className="text-[11px] font-body text-black/60">
                          No players have enrolled in this tournament yet.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#f8fafc] border-2 border-black p-4 rounded-xl text-center space-y-2">
                        <div className="font-display font-black text-lg text-black">
                          {managingContest.participantsCount} Registered Players
                        </div>
                        <p className="text-xs font-body text-black/70 max-w-md mx-auto">
                          Player evaluation and scoring remain server-authoritative. Detailed leaderboard is accessible in the public Results screen once the contest concludes.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Modal Footer (Fixed / Never scrolls) */}
              <div className="p-3 sm:p-3.5 bg-[#f8fafc] border-t-2 sm:border-t-3 border-black flex items-center justify-between gap-3 shrink-0 flex-none">
                <div className="text-[11px] font-mono text-black/60 hidden sm:block">
                  Status: <span className="font-bold text-black uppercase">{managingContest.status}</span> • {contestQuestions.length} Questions • {managingContest.totalMarks} Marks
                </div>
                <button
                  onClick={() => setManagingContest(null)}
                  className="px-4 py-1.5 bg-white text-black hover:bg-[#ffd43b] border-2 border-black rounded-lg font-display font-black text-xs uppercase tracking-wider transition-colors ml-auto shadow-[2px_2px_0_#000000]"
                >
                  CLOSE
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
            className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsQuestionPickerOpen(false)
            }}
          >
            <div
              data-lenis-prevent
              className="bg-white border-3 sm:border-4 border-black w-full max-w-3xl rounded-2xl shadow-[8px_8px_0_#000000] overflow-hidden h-[88vh] sm:h-[82vh] max-h-[88vh] sm:max-h-[82vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: fixed / never scrolls */}
              <div className="bg-black text-white p-3.5 sm:p-4 border-b-2 sm:border-b-3 border-black flex items-center justify-between shrink-0 flex-none">
                <h3 className="font-display font-black text-sm sm:text-base uppercase tracking-tight">
                  Add Active Questions from Bank
                </h3>
                <button
                  onClick={() => setIsQuestionPickerOpen(false)}
                  aria-label="Close question picker"
                  className="w-7 h-7 bg-white/10 hover:bg-[#ff5c5c] text-white hover:text-black border border-white/20 hover:border-black rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toolbar/Filters: fixed / never scrolls */}
              <div className="p-3 bg-[#f8fafc] border-b-2 border-black flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 flex-none">
                <select
                  value={pickerCategory}
                  onChange={(e) => {
                    setPickerLoading(true)
                    setPickerCategory(e.target.value)
                  }}
                  className="px-2.5 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-display font-bold text-black focus:outline-none shrink-0"
                >
                  <option value="all">ALL CATEGORIES</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/40" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => {
                      setPickerLoading(true)
                      setPickerSearch(e.target.value)
                    }}
                    placeholder="Search active question title, ID, topic..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-body font-bold text-black focus:outline-none"
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
                  <div className="p-8 text-center text-xs font-mono text-black/60 flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-black/40" />
                    <span>Loading active candidate questions...</span>
                  </div>
                ) : availableQuestions.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-black/60">
                    No active questions found matching filter.
                  </div>
                ) : (
                  availableQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="bg-white border-2 border-black p-3 rounded-xl flex items-center justify-between gap-3 hover:bg-[#f8fafc] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-display font-black text-xs uppercase text-black truncate">
                          {q.title}
                        </div>
                        <div className="font-mono text-[10px] text-black/60 truncate">
                          {q.id} • {q.category} • {q.topic} • {q.difficulty}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {q.isAssigned ? (
                          <span className="px-2.5 py-1 bg-black/10 text-black/60 border border-black/20 rounded-md font-mono font-bold text-[10px] uppercase">
                            ASSIGNED
                          </span>
                        ) : q.isActive === false ? (
                          <span className="px-2.5 py-1 bg-[#fee2e2] text-[#b91c1c] border border-[#b91c1c]/20 rounded-md font-mono font-bold text-[10px] uppercase">
                            INACTIVE
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAssignQuestion(q.id)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-[#ffd43b] text-black border-2 border-black rounded-md font-display font-black text-[11px] uppercase hover:bg-[#ffdf5d] active:translate-x-0 active:translate-y-0 shadow-[1.5px_1.5px_0_#000000] disabled:opacity-50"
                          >
                            + ADD
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>

              {/* Footer: Fixed / Never scrolls */}
              <div className="p-3 bg-[#f8fafc] border-t-2 sm:border-t-3 border-black flex items-center justify-between gap-3 shrink-0 flex-none">
                <div className="text-[11px] font-mono text-black/60">
                  {availableQuestions.filter((q) => !q.isAssigned && q.isActive !== false).length} active questions available
                </div>
                <button
                  onClick={() => setIsQuestionPickerOpen(false)}
                  className="px-5 py-1.5 bg-black text-white hover:bg-[#ffd43b] hover:text-black border-2 border-black rounded-lg font-display font-black text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0_#000000]"
                >
                  DONE
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
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCreateModalOpen(false)
            }}
          >
            <div
              data-lenis-prevent
              className="bg-white border-3 sm:border-4 border-black w-full max-w-2xl rounded-2xl shadow-[8px_8px_0_#000000] overflow-hidden h-[92vh] sm:h-[88vh] max-h-[92vh] sm:max-h-[88vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: Fixed / Never scrolls */}
              <div className="bg-[#ffd43b] text-black p-4 sm:p-5 border-b-3 border-black flex items-center justify-between shrink-0 flex-none">
                <div>
                  <h3 className="font-display font-black text-xl uppercase tracking-tight">
                    CREATE NEW TOURNAMENT
                  </h3>
                  <p className="text-xs font-mono font-bold text-black/70">
                    Saves initially as safe DRAFT.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Close create tournament modal"
                  className="w-8 h-8 bg-black/10 hover:bg-black text-black hover:text-white border-2 border-black rounded-lg flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
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
                    <div className="p-3 bg-[#fee2e2] border-2 border-black rounded-lg text-xs font-body font-bold text-black flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#b91c1c] shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                      Contest Title *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. APTICKS SPEED CLASH #15"
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-body font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                      URL Slug * (lowercase, numbers, single hyphens)
                    </label>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="e.g. apticks-speed-clash-15"
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border-2 border-black rounded-lg text-xs font-display font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        Difficulty
                      </label>
                      <select
                        value={formDifficulty}
                        onChange={(e) => setFormDifficulty(e.target.value as ContestDifficulty)}
                        className="w-full px-2.5 py-2 bg-white border-2 border-black rounded-lg text-xs font-display font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      >
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>
                            {d.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        Tournament Type
                      </label>
                      <select
                        value={formContestType}
                        onChange={(e) => setFormContestType(e.target.value as ContestType)}
                        className="w-full px-2.5 py-2 bg-white border-2 border-black rounded-lg text-xs font-display font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
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
                        <label className="block text-[11px] font-display font-black uppercase text-black">
                          START DATE & TIME *
                        </label>
                        <span className="text-[10px] font-mono text-black/50">
                          (Date + Time required)
                        </span>
                      </div>
                      <input
                        type="datetime-local"
                        value={formStartTime}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      />
                      <p className="text-[10px] font-mono text-black/60 mt-1">
                        Select date and specific start time
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-display font-black uppercase text-black">
                          END DATE & TIME *
                        </label>
                        <span className="text-[10px] font-mono text-black/50">
                          (Date + Time required)
                        </span>
                      </div>
                      <input
                        type="datetime-local"
                        value={formEndTime}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      />
                      <p className="text-[10px] font-mono text-black/60 mt-1">
                        Select date and specific end time
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        Duration (Mins)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formDuration}
                        onChange={(e) => handleDurationChange(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        Positive Marks
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        value={formPositiveMarks}
                        onChange={(e) => setFormPositiveMarks(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        Negative Penalty
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={formNegativeMarks}
                        onChange={(e) => setFormNegativeMarks(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                        XP Pool
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formXpPool}
                        onChange={(e) => setFormXpPool(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-black uppercase text-black mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Short summary of topics and speed challenge parameters..."
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-lg text-xs font-body font-bold text-black focus:outline-none shadow-[2px_2px_0_#000000]"
                    />
                  </div>

                  <div className="bg-[#f8fafc] border-2 border-black p-3.5 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-display font-black uppercase text-black">
                        Initial Status: DRAFT
                      </div>
                      <div className="text-[11px] font-body text-black/70">
                        Contests must be created in draft state. Questions must be assigned before publishing to Upcoming.
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-[#ffd43b] text-black border-2 border-black rounded-lg text-[10px] font-display font-black uppercase shrink-0 shadow-[2px_2px_0_#000000]">
                      Draft
                    </span>
                  </div>
                  </div>
                </div>

                {/* Footer action bar: Fixed / Never scrolls */}
                <div className="p-3 sm:p-4 bg-[#f8fafc] border-t-2 sm:border-t-3 border-black flex items-center justify-end gap-3 shrink-0 flex-none">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-white text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase hover:bg-black/5 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-[#ffd43b] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[3px_3px_0_#000000] hover:bg-[#ffdf5d] transition-all disabled:opacity-50"
                  >
                    {actionLoading ? 'CREATING...' : 'CREATE CONTEST'}
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
