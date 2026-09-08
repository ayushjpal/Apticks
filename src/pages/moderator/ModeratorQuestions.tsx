import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Eye,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  CheckCircle,
  Sparkles,
} from 'lucide-react'
import StaffLayout from '../../components/layout/StaffLayout'
import { useRole } from '../../hooks/useRole'
import {
  StaffQuestionService,
  type StaffQuestion,
  type StaffQuestionStats,
  type CreateQuestionPayload,
  type UpdateQuestionPayload,
} from '../../services/staffQuestionService'
import type { Category, Difficulty, QuestionOption } from '../../types/questions'

const CATEGORIES: Category[] = [
  'Quantitative Aptitude',
  'Logical Reasoning',
  'Data Interpretation',
  'Verbal & Abstract',
]

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

const DEFAULT_OPTIONS: QuestionOption[] = [
  { id: 'A', text: '' },
  { id: 'B', text: '' },
  { id: 'C', text: '' },
  { id: 'D', text: '' },
]

export default function ModeratorQuestions() {
  const { role } = useRole()

  // State
  const [questions, setQuestions] = useState<StaffQuestion[]>([])
  const [stats, setStats] = useState<StaffQuestionStats>({
    total: 0,
    active: 0,
    inactive: 0,
    contestQuestions: 0,
    byCategory: {},
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Modals
  const [previewQuestion, setPreviewQuestion] = useState<StaffQuestion | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<StaffQuestion | null>(null)
  const [confirmToggleQuestion, setConfirmToggleQuestion] = useState<StaffQuestion | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Form State for Create / Edit
  const [formCategory, setFormCategory] = useState<Category>('Quantitative Aptitude')
  const [formTopic, setFormTopic] = useState('')
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>('medium')
  const [formPoints, setFormPoints] = useState<number>(10)
  const [formTitle, setFormTitle] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formOptions, setFormOptions] = useState<QuestionOption[]>(DEFAULT_OPTIONS)
  const [formCorrectOption, setFormCorrectOption] = useState<string>('A')
  const [formExplanation, setFormExplanation] = useState('')
  const [formFormula, setFormFormula] = useState('')
  const [formHintsText, setFormHintsText] = useState('')
  const [formTagsText, setFormTagsText] = useState('')
  const [formIsActive, setFormIsActive] = useState(false)
  const [formSuggestedId, setFormSuggestedId] = useState<string>('')
  const [formCustomId, setFormCustomId] = useState<string>('')
  const [formUseCustomId, setFormUseCustomId] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Load questions
  const refreshQuestions = async () => {
    setRefreshing(true)
    setErrorMessage(null)

    const res = await StaffQuestionService.fetchStaffQuestions()
    if (res.error) {
      setErrorMessage(res.error)
    } else {
      setQuestions(res.questions)
      setStats(res.stats)
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    let isMounted = true

    StaffQuestionService.fetchStaffQuestions().then((res) => {
      if (!isMounted) return
      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setQuestions(res.questions)
        setStats(res.stats)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  // Auto-toast dismiss
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [successToast])

  // Body scroll lock when any modal is open
  useEffect(() => {
    const hasOpenModal = previewQuestion !== null || isCreateModalOpen || confirmToggleQuestion !== null
    if (hasOpenModal) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [previewQuestion, isCreateModalOpen, confirmToggleQuestion])

  // ESC key to close active modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmToggleQuestion) {
          setConfirmToggleQuestion(null)
        } else if (previewQuestion) {
          setPreviewQuestion(null)
        } else if (isCreateModalOpen) {
          setIsCreateModalOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmToggleQuestion, previewQuestion, isCreateModalOpen])

  // Fetch next question ID when category changes in create modal
  useEffect(() => {
    if (isCreateModalOpen && !editingQuestion) {
      let isMounted = true
      StaffQuestionService.getNextQuestionId(formCategory).then((res) => {
        if (isMounted && res.id) {
          setFormSuggestedId(res.id)
        }
      })
      return () => {
        isMounted = false
      }
    }
  }, [formCategory, isCreateModalOpen, editingQuestion])

  // Filtered & Paginated questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesId = q.id.toLowerCase().includes(query)
        const matchesTitle = q.title.toLowerCase().includes(query)
        const matchesPrompt = q.prompt.toLowerCase().includes(query)
        const matchesTopic = q.topic.toLowerCase().includes(query)
        if (!matchesId && !matchesTitle && !matchesPrompt && !matchesTopic) {
          return false
        }
      }

      // Category
      if (selectedCategory !== 'all' && q.category !== selectedCategory) {
        return false
      }

      // Difficulty
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false
      }

      // Status
      if (selectedStatus === 'active' && !q.is_active) return false
      if (selectedStatus === 'inactive' && q.is_active) return false
      if (selectedStatus === 'contest' && !q.isContestQuestion) return false

      return true
    })
  }, [questions, searchQuery, selectedCategory, selectedDifficulty, selectedStatus])

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize))
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredQuestions.slice(start, start + pageSize)
  }, [filteredQuestions, currentPage])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingQuestion(null)
    setFormCategory('Quantitative Aptitude')
    setFormTopic('')
    setFormDifficulty('medium')
    setFormPoints(10)
    setFormTitle('')
    setFormPrompt('')
    setFormOptions([
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ])
    setFormCorrectOption('A')
    setFormExplanation('')
    setFormFormula('')
    setFormHintsText('')
    setFormTagsText('')
    setFormIsActive(false)
    setFormSuggestedId('quant-...')
    setFormCustomId('')
    setFormUseCustomId(false)
    setFormError(null)
    setIsCreateModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (q: StaffQuestion) => {
    setEditingQuestion(q)
    setFormCategory(q.category as Category)
    setFormTopic(q.topic)
    setFormDifficulty(q.difficulty as Difficulty)
    setFormPoints(q.points || 10)
    setFormTitle(q.title)
    setFormPrompt(q.prompt)
    setFormOptions(
      q.options.length >= 2
        ? q.options
        : [
            { id: 'A', text: '' },
            { id: 'B', text: '' },
            { id: 'C', text: '' },
            { id: 'D', text: '' },
          ]
    )
    setFormCorrectOption(q.correct_option || 'A')
    setFormExplanation(q.explanation || '')
    setFormFormula(q.formula_or_rule || '')
    setFormHintsText((q.hints || []).join('\n'))
    setFormTagsText((q.tags || []).join(', '))
    setFormIsActive(q.is_active)
    setFormSuggestedId(q.id)
    setFormCustomId('')
    setFormUseCustomId(false)
    setFormError(null)
    setIsCreateModalOpen(true)
  }

  // Handle Form Submit (Create or Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validations
    if (!formTitle.trim()) {
      setFormError('Please enter a question title.')
      return
    }
    if (!formPrompt.trim()) {
      setFormError('Please enter the question prompt.')
      return
    }
    if (!formTopic.trim()) {
      setFormError('Please enter a topic.')
      return
    }

    if (formUseCustomId && !editingQuestion) {
      const prefix =
        formCategory === 'Quantitative Aptitude'
          ? 'quant'
          : formCategory === 'Logical Reasoning'
          ? 'lr'
          : formCategory === 'Data Interpretation'
          ? 'di'
          : 'verbal'
      const pattern = new RegExp(`^${prefix}-[0-9]{3,}$`)
      if (!pattern.test(formCustomId.trim().toLowerCase())) {
        setFormError(`Custom ID for ${formCategory} must follow format "${prefix}-NNN" (e.g. ${prefix}-081).`)
        return
      }
    }

    // Options validation
    const emptyOptions = formOptions.filter((opt) => !opt.text.trim())
    if (emptyOptions.length > 0) {
      setFormError('All 4 options must have text filled in.')
      return
    }

    if (!formCorrectOption) {
      setFormError('Please select which option is correct.')
      return
    }

    if (!formExplanation.trim()) {
      setFormError('Please provide an explanation for the solution.')
      return
    }

    // Parse hints and tags
    const hints = formHintsText
      .split('\n')
      .map((h) => h.trim())
      .filter((h) => h.length > 0)

    const tags = formTagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    setActionLoading(true)

    if (editingQuestion) {
      // UPDATE
      const payload: UpdateQuestionPayload = {
        id: editingQuestion.id,
        title: formTitle,
        prompt: formPrompt,
        category: formCategory,
        topic: formTopic,
        difficulty: formDifficulty,
        points: formPoints,
        options: formOptions,
        correct_option: formCorrectOption,
        explanation: formExplanation,
        formula_or_rule: formFormula,
        hints,
        tags,
        is_active: formIsActive,
      }

      const res = await StaffQuestionService.updateQuestion(payload)
      setActionLoading(false)

      if (!res.success) {
        setFormError(res.message || 'Failed to update question.')
      } else {
        setIsCreateModalOpen(false)
        setSuccessToast(`Question ${editingQuestion.id} successfully updated.`)
        refreshQuestions()
      }
    } else {
      // CREATE
      const payload: CreateQuestionPayload = {
        title: formTitle,
        prompt: formPrompt,
        category: formCategory,
        topic: formTopic,
        difficulty: formDifficulty,
        points: formPoints,
        options: formOptions,
        correct_option: formCorrectOption,
        explanation: formExplanation,
        formula_or_rule: formFormula,
        hints,
        tags,
        is_active: formIsActive,
        custom_id: formUseCustomId ? formCustomId.trim() : undefined,
      }

      const res = await StaffQuestionService.createQuestion(payload)
      setActionLoading(false)

      if (!res.success) {
        setFormError(res.message || 'Failed to create question.')
      } else {
        setIsCreateModalOpen(false)
        const newId = res.question?.id || 'new'
        setSuccessToast(`Question ${newId} created successfully.`)
        refreshQuestions()
      }
    }
  }

  // Handle Toggle Active Status
  const handleExecuteToggleActive = async () => {
    if (!confirmToggleQuestion) return
    setActionLoading(true)

    const targetStatus = !confirmToggleQuestion.is_active
    const res = await StaffQuestionService.toggleQuestionActive(
      confirmToggleQuestion.id,
      targetStatus
    )
    setActionLoading(false)
    setConfirmToggleQuestion(null)

    if (!res.success) {
      setErrorMessage(res.message || 'Failed to change question active status.')
    } else {
      setSuccessToast(
        `Question ${confirmToggleQuestion.id} ${targetStatus ? 'activated' : 'deactivated'}.`
      )
      refreshQuestions()
    }
  }

  return (
    <StaffLayout>
      <div className="space-y-5">
        {/* Success Toast */}
        {successToast && (
          <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white shadow-lg border border-emerald-500/30 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 animate-slide-in">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium text-xs">
              {successToast}
            </span>
            <button
              onClick={() => setSuccessToast(null)}
              className="ml-2 hover:opacity-80 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/moderator"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Control Center</span>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Question Bank Control
              </h1>
              <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full font-mono text-[10px] font-medium uppercase">
                {role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={refreshQuestions}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl font-medium text-xs transition-colors shadow-xs disabled:opacity-50"
              title="Refresh questions from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#ffd43b] text-black hover:bg-[#fcc419] rounded-xl font-semibold text-xs transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        {/* Inventory Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Inventory
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : stats.total}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-0.5">
              All registered problems
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active in Practice
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <span>{loading ? '...' : stats.active}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-0.5">
              Public practice bank
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Inactive / Staged
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {loading ? '...' : stats.inactive}
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-0.5">
              Drafts or retired
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Contest Pool
            </div>
            <div className="text-2xl font-bold text-sky-600 mt-1 flex items-center gap-1.5">
              <span>{loading ? '...' : stats.contestQuestions}</span>
              <Trophy className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-0.5">
              Dedicated tournament pool
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ID (e.g. quant-001), title, prompt keywords, or topic..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
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

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Difficulty */}
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
                <option value="contest">Contest Pool Only</option>
              </select>

              {(searchQuery || selectedCategory !== 'all' || selectedDifficulty !== 'all' || selectedStatus !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                    setSelectedDifficulty('all')
                    setSelectedStatus('all')
                    setCurrentPage(1)
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing {filteredQuestions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredQuestions.length)} of {filteredQuestions.length} questions
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200/80 p-3 rounded-xl shadow-xs flex items-center justify-between gap-3 text-rose-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs font-medium">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Questions Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-slate-400" />
              <div className="text-xs font-medium text-slate-500">
                Loading question inventory...
              </div>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                No Questions Match Filters
              </h3>
              <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
                Try adjusting your search criteria, reset active category/difficulty filters, or create a new question.
              </p>
            </div>
          ) : (
            <div
              data-lenis-prevent
              className="question-list-scroll max-h-[520px] overflow-y-auto overflow-x-auto min-h-0"
            >
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50/90 backdrop-blur-xs border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                    <th className="py-2.5 px-4 w-28">ID</th>
                    <th className="py-2.5 px-4 min-w-[280px]">Title & Problem</th>
                    <th className="py-2.5 px-4 w-44">Category & Topic</th>
                    <th className="py-2.5 px-4 w-24 text-center">Difficulty</th>
                    <th className="py-2.5 px-4 w-20 text-center">Points</th>
                    <th className="py-2.5 px-4 w-24 text-center">Status</th>
                    <th className="py-2.5 px-4 w-32 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedQuestions.map((q) => {
                    const diffBadge =
                      q.difficulty === 'easy'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : q.difficulty === 'medium'
                        ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                        : 'bg-rose-50 text-rose-700 border-rose-200/80'

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* ID */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                            {q.id}
                          </div>
                          {q.isContestQuestion && (
                            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.2 bg-sky-50 text-sky-700 border border-sky-200/80 rounded text-[9px] font-mono font-medium">
                              <Trophy className="w-2.5 h-2.5" />
                              <span>Contest</span>
                            </div>
                          )}
                        </td>

                        {/* Title & Preview */}
                        <td className="py-3 px-4 align-top">
                          <button
                            onClick={() => setPreviewQuestion(q)}
                            className="font-semibold text-xs text-slate-900 hover:text-sky-600 text-left block leading-snug break-words transition-colors"
                          >
                            {q.title}
                          </button>
                          <p className="text-[11px] font-normal text-slate-500 line-clamp-2 mt-0.5 leading-relaxed break-words">
                            {q.prompt}
                          </p>
                        </td>

                        {/* Category & Topic */}
                        <td className="py-3 px-4 align-top">
                          <div className="text-[11px] font-medium text-slate-800 break-words">
                            {q.category}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 break-words">
                            {q.topic}
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-3 px-4 align-top text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium capitalize border ${diffBadge}`}
                          >
                            {q.difficulty}
                          </span>
                        </td>

                        {/* Points */}
                        <td className="py-3 px-4 align-top text-center">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {q.points || 10}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 align-top text-center">
                          {q.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded text-[10px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[10px] font-medium">
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 align-top text-right">
                          <div className="inline-flex items-center gap-1">
                            {/* Preview */}
                            <button
                              onClick={() => setPreviewQuestion(q)}
                              aria-label={`Preview ${q.id}`}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-xs"
                              title="Preview question"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEdit(q)}
                              aria-label={`Edit ${q.id}`}
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-xs"
                              title="Edit question fields"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle Active */}
                            <button
                              onClick={() => setConfirmToggleQuestion(q)}
                              aria-label={q.is_active ? `Deactivate ${q.id}` : `Activate ${q.id}`}
                              className={`p-1 border border-slate-200 rounded-lg transition-colors shadow-xs ${
                                q.is_active
                                  ? 'hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                                  : 'hover:bg-emerald-50 text-slate-500 hover:text-emerald-600'
                              }`}
                              title={q.is_active ? 'Deactivate question' : 'Activate question'}
                            >
                              {q.is_active ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium text-xs text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1 text-xs font-mono font-medium">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                  let pageNum = currentPage
                  if (totalPages <= 5) pageNum = idx + 1
                  else if (currentPage <= 3) pageNum = idx + 1
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + idx
                  else pageNum = currentPage - 2 + idx

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg border text-xs transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#0c1d2d] text-white border-[#0c1d2d] font-semibold shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium text-xs text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewQuestion && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden data-lenis-prevent animate-fade-in"
          data-lenis-prevent
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full h-[90vh] sm:h-[86vh] max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-2xl relative data-lenis-prevent"
            data-lenis-prevent
          >
            {/* Header info */}
            <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0 flex-none relative pr-12 bg-white">
              <button
                onClick={() => setPreviewQuestion(null)}
                aria-label="Close preview modal"
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#0c1d2d] text-white rounded">
                    {previewQuestion.id}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                    {previewQuestion.category}
                  </span>
                  <span className="text-xs font-normal text-slate-400">
                    • {previewQuestion.topic}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200 capitalize">
                    {previewQuestion.difficulty}
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {previewQuestion.points || 10} pts
                  </span>
                  {previewQuestion.isContestQuestion && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded">
                      <Trophy className="w-3 h-3" />
                      Contest Linked
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 pt-1 break-words">
                  {previewQuestion.title}
                </h2>
              </div>
            </div>

            {/* Scrollable Body */}
            <div
              className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4 data-lenis-prevent overscroll-contain"
              data-lenis-prevent
            >
              {/* Prompt */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-normal text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                {previewQuestion.prompt}
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Options & Answer Key
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {previewQuestion.options.map((opt) => {
                    const isCorrect = opt.id === previewQuestion.correct_option
                    return (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center font-semibold text-xs shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <span className="text-xs pt-0.5 break-words font-medium">
                          {opt.text}
                        </span>
                        {isCorrect && (
                          <Check className="w-4 h-4 ml-auto text-emerald-600 shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Solution & Explanation */}
              <div className="p-3.5 bg-amber-50/50 border border-amber-200/70 rounded-xl space-y-1">
                <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Explanation & Solution</span>
                </div>
                <p className="text-xs font-normal text-amber-950/80 whitespace-pre-wrap leading-relaxed break-words">
                  {previewQuestion.explanation}
                </p>
                {previewQuestion.formula_or_rule && (
                  <div className="mt-2 pt-2 border-t border-amber-200/60 text-[11px] font-mono text-amber-900/80 break-words">
                    <span className="font-semibold text-amber-950">Formula / Rule:</span> {previewQuestion.formula_or_rule}
                  </div>
                )}
              </div>

              {/* Hints & Tags */}
              {((previewQuestion.hints && previewQuestion.hints.length > 0) ||
                (previewQuestion.tags && previewQuestion.tags.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                  {previewQuestion.hints && previewQuestion.hints.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                        Hints ({previewQuestion.hints.length})
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 font-normal text-slate-600">
                        {previewQuestion.hints.map((h, i) => (
                          <li key={i} className="break-words">{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {previewQuestion.tags && previewQuestion.tags.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {previewQuestion.tags.map((t, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-mono break-words"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex-none flex items-center justify-between">
              <button
                onClick={() => {
                  setPreviewQuestion(null)
                  handleOpenEdit(previewQuestion)
                }}
                className="px-3.5 py-1.5 bg-[#ffd43b] text-black hover:bg-[#fcc419] rounded-lg font-semibold text-xs transition-colors shadow-xs"
              >
                Edit Question →
              </button>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium text-xs transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden data-lenis-prevent animate-fade-in"
          data-lenis-prevent
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full h-[90vh] sm:h-[86vh] max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-2xl relative data-lenis-prevent"
            data-lenis-prevent
          >
            {/* Fixed Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0 flex-none relative pr-12 bg-white">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close authoring modal"
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-medium uppercase mb-1">
                  {editingQuestion ? 'Update Question' : 'New Question Authoring'}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {editingQuestion ? `Edit ${editingQuestion.id}` : 'Author Question'}
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Author or calibrate questions. Sequential IDs are generated with atomic concurrency locking.
                </p>
              </div>
            </div>

            {/* Form wrapping scrollable body and fixed footer */}
            <form onSubmit={handleFormSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div
                className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-3.5 data-lenis-prevent overscroll-contain"
                data-lenis-prevent
              >
                {formError && (
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2 text-xs font-medium text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Row 1: Category, Topic, Difficulty, Points */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Category */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Category *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as Category)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Topic */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Topic *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Percentages"
                      value={formTopic}
                      onChange={(e) => setFormTopic(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
                    />
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Difficulty *
                    </label>
                    <select
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value as Difficulty)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d] capitalize"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Sequential ID generation preview & Points */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="sm:col-span-3">
                    <div className="text-[10px] font-mono font-semibold uppercase text-slate-500">
                      ID Allocation (Server Automatic)
                    </div>
                    {!editingQuestion ? (
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#0c1d2d] text-[#ffd43b] rounded">
                            {formUseCustomId && formCustomId ? formCustomId : formSuggestedId}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {formUseCustomId ? 'Custom ID assigned' : 'Next sequential ID in category'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <input
                            type="checkbox"
                            id="use-custom-id"
                            checked={formUseCustomId}
                            onChange={(e) => setFormUseCustomId(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-[#0c1d2d] focus:ring-[#0c1d2d] accent-[#0c1d2d]"
                          />
                          <label
                            htmlFor="use-custom-id"
                            className="text-[11px] font-medium text-slate-600 cursor-pointer"
                          >
                            Specify custom sequential ID (e.g. quant-081)
                          </label>
                        </div>
                        {formUseCustomId && (
                          <input
                            type="text"
                            placeholder="e.g. quant-081"
                            value={formCustomId}
                            onChange={(e) => setFormCustomId(e.target.value)}
                            className="w-48 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d]"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-800 rounded inline-block mt-1">
                        {editingQuestion.id} (Permanent Key)
                      </div>
                    )}
                  </div>

                  {/* Points */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Points
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formPoints}
                      onChange={(e) => setFormPoints(parseInt(e.target.value) || 10)}
                      className="w-full px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d]"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Question Title *
                  </label>
                  <input
                    type="text"
                    placeholder="Short, descriptive problem title..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
                  />
                </div>

                {/* Prompt */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Problem Prompt *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Full problem statement with givens, conditions, and what is asked..."
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-normal text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d] resize-y"
                  />
                </div>

                {/* 4 Options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Options & Answer Key *
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Select radio button next to the correct answer
                    </span>
                  </div>

                  <div className="space-y-2">
                    {formOptions.map((opt, idx) => {
                      const isSelected = formCorrectOption === opt.id
                      return (
                        <div
                          key={opt.id}
                          className={`p-2 rounded-xl border flex items-center gap-2.5 transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer shrink-0">
                            <input
                              type="radio"
                              name="correct-option-group"
                              checked={isSelected}
                              onChange={() => setFormCorrectOption(opt.id)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-600 accent-emerald-600 cursor-pointer"
                            />
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center font-semibold text-xs ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.id}
                            </span>
                          </label>

                          <input
                            type="text"
                            placeholder={`Option ${opt.id} text...`}
                            value={opt.text}
                            onChange={(e) => {
                              const updated = [...formOptions]
                              updated[idx] = { ...updated[idx], text: e.target.value }
                              setFormOptions(updated)
                            }}
                            className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0c1d2d]"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Solution & Explanation *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Step-by-step mathematical or logical derivation..."
                    value={formExplanation}
                    onChange={(e) => setFormExplanation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-normal text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d] resize-y"
                  />
                </div>

                {/* Formula & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Formula */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Key Formula / Rule (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Net Change = a + b + (ab)/100"
                      value={formFormula}
                      onChange={(e) => setFormFormula(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Tags (Comma Separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Percentages, Arithmetic, Speed"
                      value={formTagsText}
                      onChange={(e) => setFormTagsText(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d]"
                    />
                  </div>
                </div>

                {/* Hints */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Hints (One Per Line, Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Hint 1: Assume starting amount is 100&#10;Hint 2: Apply second change on updated value"
                    value={formHintsText}
                    onChange={(e) => setFormHintsText(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-normal text-slate-900 focus:outline-none focus:bg-white focus:border-[#0c1d2d] resize-y"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="form-is-active"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0c1d2d] focus:ring-[#0c1d2d] accent-[#0c1d2d] cursor-pointer"
                  />
                  <label
                    htmlFor="form-is-active"
                    className="text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    Active Question (Keep unchecked for staging & draft review)
                  </label>
                </div>
              </div>

              {/* Fixed Footer Actions */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex-none flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium text-xs hover:bg-slate-50 transition-colors shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#ffd43b] text-black hover:bg-[#fcc419] rounded-lg font-semibold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{editingQuestion ? 'Save Changes' : 'Create Question'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOGGLE ACTIVE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {confirmToggleQuestion && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-hidden data-lenis-prevent animate-fade-in"
          data-lenis-prevent
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl relative space-y-3.5 data-lenis-prevent"
            data-lenis-prevent
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                  confirmToggleQuestion.is_active
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                }`}
              >
                {confirmToggleQuestion.is_active ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {confirmToggleQuestion.is_active ? 'Deactivate Question?' : 'Activate Question?'}
                </h3>
                <div className="font-mono text-xs text-slate-500">
                  Target: {confirmToggleQuestion.id}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              {confirmToggleQuestion.is_active
                ? 'Deactivating this question will remove it from the public practice question bank and random challenge rotations.'
                : 'Activating this question will immediately expose it to students in the public practice bank.'}
            </p>

            {confirmToggleQuestion.isContestQuestion && confirmToggleQuestion.is_active && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  Warning: This question is mapped to a tournament. If the contest is live, the server will reject deactivation.
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                disabled={actionLoading}
                onClick={() => setConfirmToggleQuestion(null)}
                className="px-3.5 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium text-xs hover:bg-slate-50 shadow-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleExecuteToggleActive}
                className={`px-4 py-1.5 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5 ${
                  confirmToggleQuestion.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>
                  Confirm {confirmToggleQuestion.is_active ? 'Deactivation' : 'Activation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}
