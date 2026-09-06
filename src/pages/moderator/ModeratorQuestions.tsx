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
      <div className="space-y-6">
        {/* Success Toast */}
        {successToast && (
          <div className="fixed top-20 right-6 z-50 bg-[#10b981] text-white border-3 border-black shadow-[4px_4px_0_#000000] px-4 py-3 rounded-xl flex items-center gap-3 animate-slide-in">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-display font-black text-xs uppercase tracking-wider">
              {successToast}
            </span>
            <button
              onClick={() => setSuccessToast(null)}
              className="ml-2 hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/moderator"
              className="inline-flex items-center gap-1.5 text-xs font-display font-black text-white/80 hover:text-white uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>STAFF OVERVIEW</span>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl sm:text-3xl uppercase text-white tracking-tight">
                QUESTION BANK CONTROL
              </h1>
              <span className="px-2.5 py-0.5 bg-[#ffd43b] text-black border-2 border-black rounded-full font-mono text-[10px] font-black uppercase">
                {role.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshQuestions}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-black hover:bg-black hover:text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-[2px_2px_0_#000000] disabled:opacity-50"
              title="Refresh questions from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>REFRESH</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#ffd43b] text-black hover:bg-black hover:text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0_#000000] hover:shadow-[4px_4px_0_#000000]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>ADD QUESTION</span>
            </button>
          </div>
        </div>

        {/* Inventory Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="text-[10px] font-mono font-bold uppercase text-black/60">
              TOTAL INVENTORY
            </div>
            <div className="text-2xl font-display font-black text-black mt-0.5">
              {loading ? '...' : stats.total}
            </div>
            <div className="text-[10px] font-body font-semibold text-black/50 mt-1">
              All registered problems
            </div>
          </div>

          <div className="bg-white border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="text-[10px] font-mono font-bold uppercase text-black/60">
              ACTIVE IN PRACTICE
            </div>
            <div className="text-2xl font-display font-black text-[#10b981] mt-0.5 flex items-center gap-1.5">
              <span>{loading ? '...' : stats.active}</span>
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            </div>
            <div className="text-[10px] font-body font-semibold text-black/50 mt-1">
              Public practice bank
            </div>
          </div>

          <div className="bg-white border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="text-[10px] font-mono font-bold uppercase text-black/60">
              INACTIVE / STAGED
            </div>
            <div className="text-2xl font-display font-black text-[#f59e0b] mt-0.5">
              {loading ? '...' : stats.inactive}
            </div>
            <div className="text-[10px] font-body font-semibold text-black/50 mt-1">
              Drafts or retired
            </div>
          </div>

          <div className="bg-white border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000]">
            <div className="text-[10px] font-mono font-bold uppercase text-black/60">
              CONTEST QUESTIONS
            </div>
            <div className="text-2xl font-display font-black text-[#38aef0] mt-0.5 flex items-center gap-1.5">
              <span>{loading ? '...' : stats.contestQuestions}</span>
              <Trophy className="w-4 h-4 text-[#38aef0]" />
            </div>
            <div className="text-[10px] font-body font-semibold text-black/50 mt-1">
              Dedicated tournament pool
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-white border-3 border-black p-4 sm:p-5 rounded-2xl shadow-[5px_5px_0_#000000] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
              <input
                type="text"
                placeholder="Search by ID (e.g. quant-001), title, prompt keywords, or topic..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-10 py-2.5 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-semibold text-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                >
                  <X className="w-4 h-4" />
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
                className="px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-display font-bold uppercase text-black focus:outline-none focus:bg-white"
              >
                <option value="all">ALL CATEGORIES</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.toUpperCase()}
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
                className="px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-display font-bold uppercase text-black focus:outline-none focus:bg-white"
              >
                <option value="all">ALL DIFFICULTIES</option>
                <option value="easy">EASY</option>
                <option value="medium">MEDIUM</option>
                <option value="hard">HARD</option>
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-display font-bold uppercase text-black focus:outline-none focus:bg-white"
              >
                <option value="all">ALL STATUSES</option>
                <option value="active">ACTIVE ONLY</option>
                <option value="inactive">INACTIVE ONLY</option>
                <option value="contest">CONTEST POOL ONLY</option>
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
                  className="px-3 py-2 bg-black/5 hover:bg-black/10 text-black border-2 border-black/20 rounded-xl text-xs font-display font-bold uppercase transition-colors"
                >
                  RESET
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-black/60 pt-2 border-t border-black/10">
            <span>
              Showing {filteredQuestions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredQuestions.length)} of {filteredQuestions.length} questions
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-[#fee2e2] border-3 border-black p-4 rounded-xl shadow-[4px_4px_0_#000000] flex items-center justify-between gap-3 text-black">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ef4444] shrink-0" />
              <span className="text-xs font-body font-bold">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-black/60 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Questions Table */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-black border-t-[#ffd43b] rounded-full animate-spin mx-auto" />
              <div className="text-xs font-display font-black uppercase text-black/60">
                LOADING QUESTION INVENTORY...
              </div>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center mx-auto text-black/40">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-display font-black uppercase text-black">
                NO QUESTIONS MATCH FILTERS
              </h3>
              <p className="text-xs font-body font-semibold text-black/60 max-w-sm mx-auto">
                Try adjusting your search criteria, reset active category/difficulty filters, or create a new question.
              </p>
            </div>
          ) : (
            <div
              data-lenis-prevent
              className="question-list-scroll max-h-[520px] overflow-y-auto overflow-x-auto min-h-0"
            >
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow-[0_2px_0_#000000]">
                  <tr className="bg-[#f8fafc] border-b-3 border-black text-[11px] font-display font-black uppercase text-black tracking-wider">
                    <th className="py-3 px-4 w-28">ID</th>
                    <th className="py-3 px-4 min-w-[280px]">TITLE & PROBLEM</th>
                    <th className="py-3 px-4 w-44">CATEGORY & TOPIC</th>
                    <th className="py-3 px-4 w-28 text-center">DIFFICULTY</th>
                    <th className="py-3 px-4 w-20 text-center">POINTS</th>
                    <th className="py-3 px-4 w-28 text-center">STATUS</th>
                    <th className="py-3 px-4 w-36 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10">
                  {paginatedQuestions.map((q) => {
                    const diffColor =
                      q.difficulty === 'easy'
                        ? 'bg-[#dcfce7] text-[#15803d]'
                        : q.difficulty === 'medium'
                        ? 'bg-[#fef3c7] text-[#b45309]'
                        : 'bg-[#fee2e2] text-[#b91c1c]'

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-[#f8fafc]/70 transition-colors"
                      >
                        {/* ID */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-mono text-xs font-bold text-black bg-black/5 px-2 py-1 rounded border border-black/20 inline-block">
                            {q.id}
                          </div>
                          {q.isContestQuestion && (
                            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] rounded text-[9px] font-mono font-bold uppercase">
                              <Trophy className="w-2.5 h-2.5" />
                              <span>CONTEST</span>
                            </div>
                          )}
                        </td>

                        {/* Title & Preview */}
                        <td className="py-3.5 px-4 align-top">
                          <button
                            onClick={() => setPreviewQuestion(q)}
                            className="font-display font-black text-xs text-black hover:text-[#2563eb] text-left block leading-snug break-words"
                          >
                            {q.title}
                          </button>
                          <p className="font-body text-[11px] font-medium text-black/60 line-clamp-2 mt-1 leading-relaxed break-words">
                            {q.prompt}
                          </p>
                        </td>

                        {/* Category & Topic */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="text-[11px] font-display font-bold text-black break-words">
                            {q.category}
                          </div>
                          <div className="text-[10px] font-body font-semibold text-black/60 mt-0.5 break-words">
                            {q.topic}
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-display font-black uppercase border border-black/20 ${diffColor}`}
                          >
                            {q.difficulty}
                          </span>
                        </td>

                        {/* Points */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <span className="font-mono text-xs font-bold text-black">
                            {q.points || 10}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-top text-center">
                          {q.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#dcfce7] text-[#15803d] border border-[#86efac] rounded-full text-[10px] font-display font-black uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-black/5 text-black/60 border border-black/20 rounded-full text-[10px] font-display font-black uppercase">
                              INACTIVE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="inline-flex items-center gap-1">
                            {/* Preview */}
                            <button
                              onClick={() => setPreviewQuestion(q)}
                              aria-label={`Preview ${q.id}`}
                              className="p-1.5 hover:bg-black/5 border border-black/20 rounded-lg text-black hover:text-[#2563eb] transition-colors"
                              title="Preview question and answer key"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEdit(q)}
                              aria-label={`Edit ${q.id}`}
                              className="p-1.5 hover:bg-[#ffd43b]/40 border border-black/20 rounded-lg text-black hover:text-black transition-colors"
                              title="Edit question fields"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle Active */}
                            <button
                              onClick={() => setConfirmToggleQuestion(q)}
                              aria-label={q.is_active ? `Deactivate ${q.id}` : `Activate ${q.id}`}
                              className={`p-1.5 border border-black/20 rounded-lg transition-colors ${
                                q.is_active
                                  ? 'hover:bg-[#fee2e2] text-black hover:text-[#b91c1c]'
                                  : 'hover:bg-[#dcfce7] text-black hover:text-[#15803d]'
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
            <div className="p-4 border-t-3 border-black bg-[#f8fafc] flex items-center justify-between">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border-2 border-black rounded-xl font-display font-bold text-xs uppercase disabled:opacity-40 hover:bg-black hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREV</span>
              </button>

              <div className="flex items-center gap-1 text-xs font-mono font-bold">
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
                      className={`w-8 h-8 rounded-lg border-2 border-black font-display font-black text-xs transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#ffd43b] text-black shadow-[1px_1px_0_#000000]'
                          : 'bg-white hover:bg-black/5 text-black'
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
      {/* PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewQuestion && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden data-lenis-prevent animate-fade-in"
          data-lenis-prevent
        >
          <div
            className="bg-white border-3 sm:border-4 border-black rounded-2xl max-w-2xl w-full h-[90vh] sm:h-[86vh] max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-[8px_8px_0_#000000] relative data-lenis-prevent"
            data-lenis-prevent
          >
            {/* Header info */}
            <div className="p-4 sm:p-6 border-b-2 sm:border-b-3 border-black shrink-0 flex-none relative pr-12 bg-white">
              <button
                onClick={() => setPreviewQuestion(null)}
                aria-label="Close preview modal"
                className="absolute top-4 right-4 p-2 text-black/50 hover:text-black hover:bg-black/5 rounded-xl border border-transparent hover:border-black/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black px-2 py-0.5 bg-black text-white rounded">
                    {previewQuestion.id}
                  </span>
                  <span className="text-xs font-display font-bold px-2 py-0.5 bg-black/5 rounded border border-black/20">
                    {previewQuestion.category}
                  </span>
                  <span className="text-xs font-body font-bold text-black/60">
                    • {previewQuestion.topic}
                  </span>
                  <span className="text-xs font-display font-bold px-2 py-0.5 bg-[#fef3c7] text-[#b45309] rounded-full uppercase border border-[#fde68a]">
                    {previewQuestion.difficulty}
                  </span>
                  <span className="text-xs font-mono font-bold text-black/60">
                    {previewQuestion.points || 10} PTS
                  </span>
                  {previewQuestion.isContestQuestion && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black px-2 py-0.5 bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] rounded uppercase">
                      <Trophy className="w-3 h-3" />
                      CONTEST LINKED
                    </span>
                  )}
                </div>
                <h2 className="font-display font-black text-xl text-black pt-1 break-words">
                  {previewQuestion.title}
                </h2>
              </div>
            </div>

            {/* Scrollable Body */}
            <div
              className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 data-lenis-prevent overscroll-contain"
              data-lenis-prevent
            >
              {/* Prompt */}
              <div className="p-4 bg-[#f8fafc] border-2 border-black rounded-xl text-sm font-body font-semibold text-black/80 leading-relaxed whitespace-pre-wrap break-words">
                {previewQuestion.prompt}
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="text-xs font-display font-black uppercase text-black/60">
                  OPTIONS & ANSWER KEY
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {previewQuestion.options.map((opt) => {
                    const isCorrect = opt.id === previewQuestion.correct_option
                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border-2 flex items-start gap-2.5 ${
                          isCorrect
                            ? 'bg-[#dcfce7] border-[#16a34a] text-[#166534] shadow-[2px_2px_0_#16a34a]'
                            : 'bg-white border-black/20 text-black/80'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-display font-black text-xs shrink-0 ${
                            isCorrect
                              ? 'bg-[#16a34a] text-white'
                              : 'bg-black/5 text-black border border-black/20'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <span className="text-xs font-body font-semibold pt-0.5 break-words">
                          {opt.text}
                        </span>
                        {isCorrect && (
                          <Check className="w-4 h-4 ml-auto text-[#16a34a] shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Solution & Explanation */}
              <div className="p-4 bg-[#fef9c3] border-2 border-black rounded-xl space-y-1.5">
                <div className="text-xs font-display font-black uppercase text-black flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#b45309]" />
                  <span>EXPLANATION & SOLUTION</span>
                </div>
                <p className="text-xs font-body font-semibold text-black/80 whitespace-pre-wrap leading-relaxed break-words">
                  {previewQuestion.explanation}
                </p>
                {previewQuestion.formula_or_rule && (
                  <div className="mt-2 pt-2 border-t border-black/10 text-[11px] font-mono font-bold text-black/70 break-words">
                    <span className="text-black">Formula / Rule:</span> {previewQuestion.formula_or_rule}
                  </div>
                )}
              </div>

              {/* Hints & Tags */}
              {((previewQuestion.hints && previewQuestion.hints.length > 0) ||
                (previewQuestion.tags && previewQuestion.tags.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t-2 border-black/10 text-xs">
                  {previewQuestion.hints && previewQuestion.hints.length > 0 && (
                    <div>
                      <div className="font-display font-black uppercase text-black/60 mb-1">
                        HINTS ({previewQuestion.hints.length})
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 font-body font-medium text-black/70">
                        {previewQuestion.hints.map((h, i) => (
                          <li key={i} className="break-words">{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {previewQuestion.tags && previewQuestion.tags.length > 0 && (
                    <div>
                      <div className="font-display font-black uppercase text-black/60 mb-1">
                        TAGS
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {previewQuestion.tags.map((t, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-black/5 text-black border border-black/20 rounded text-[10px] font-mono font-bold break-words"
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
            <div className="p-4 border-t-2 sm:border-t-3 border-black bg-[#f8fafc] shrink-0 flex-none flex items-center justify-between">
              <button
                onClick={() => {
                  setPreviewQuestion(null)
                  handleOpenEdit(previewQuestion)
                }}
                className="px-4 py-2 bg-[#ffd43b] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_#000000]"
              >
                EDIT THIS QUESTION →
              </button>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-4 py-2 bg-black/5 hover:bg-black/10 text-black border-2 border-black/20 rounded-xl font-display font-black text-xs uppercase transition-colors"
              >
                CLOSE
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden data-lenis-prevent animate-fade-in"
          data-lenis-prevent
        >
          <div
            className="bg-white border-3 sm:border-4 border-black rounded-2xl max-w-3xl w-full h-[90vh] sm:h-[86vh] max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden shadow-[8px_8px_0_#000000] relative data-lenis-prevent"
            data-lenis-prevent
          >
            {/* Fixed Header */}
            <div className="p-4 sm:p-6 border-b-2 sm:border-b-3 border-black shrink-0 flex-none relative pr-12 bg-white">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close authoring modal"
                className="absolute top-4 right-4 p-2 text-black/50 hover:text-black hover:bg-black/5 rounded-xl border border-transparent hover:border-black/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#ffd43b] text-black border-2 border-black rounded-full text-[10px] font-display font-black uppercase mb-1">
                  {editingQuestion ? 'UPDATE QUESTION' : 'NEW QUESTION AUTHORING'}
                </div>
                <h2 className="font-display font-black text-xl sm:text-2xl uppercase text-black">
                  {editingQuestion ? `EDIT ${editingQuestion.id}` : 'AUTHOR QUESTION'}
                </h2>
                <p className="text-xs font-body font-semibold text-black/60">
                  Author or calibrate questions. Sequential IDs are generated with atomic concurrency locking.
                </p>
              </div>
            </div>

            {/* Form wrapping scrollable body and fixed footer */}
            <form onSubmit={handleFormSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div
                className="question-list-scroll flex-1 min-h-0 h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 data-lenis-prevent overscroll-contain"
                data-lenis-prevent
              >
                {formError && (
                  <div className="bg-[#fee2e2] border-2 border-black p-3 rounded-xl flex items-center gap-2 text-xs font-body font-bold text-black">
                    <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Row 1: Category, Topic, Difficulty, Points */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Category */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-display font-black uppercase text-black">
                      CATEGORY *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as Category)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-bold text-black focus:outline-none focus:bg-white"
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
                    <label className="text-[11px] font-display font-black uppercase text-black">
                      TOPIC *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Percentages"
                      value={formTopic}
                      onChange={(e) => setFormTopic(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-semibold text-black focus:outline-none focus:bg-white"
                    />
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-display font-black uppercase text-black">
                      DIFFICULTY *
                    </label>
                    <select
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value as Difficulty)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-display font-black uppercase text-black focus:outline-none focus:bg-white"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Sequential ID generation preview & Points */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-[#f8fafc] border-2 border-black rounded-xl">
                  <div className="sm:col-span-3">
                    <div className="text-[10px] font-mono font-bold uppercase text-black/60">
                      ID ALLOCATION (SERVER AUTOMATIC)
                    </div>
                    {!editingQuestion ? (
                      <div className="mt-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2 py-0.5 bg-black text-[#ffd43b] rounded">
                            {formUseCustomId && formCustomId ? formCustomId : formSuggestedId}
                          </span>
                          <span className="text-[11px] font-body text-black/60 font-semibold">
                            {formUseCustomId ? 'Custom ID assigned' : 'Next sequential ID in category'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="use-custom-id"
                            checked={formUseCustomId}
                            onChange={(e) => setFormUseCustomId(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-black focus:ring-black"
                          />
                          <label
                            htmlFor="use-custom-id"
                            className="text-[11px] font-body font-semibold text-black/80 cursor-pointer"
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
                            className="w-48 px-2.5 py-1 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="font-mono text-xs font-black px-2 py-0.5 bg-black text-white rounded inline-block mt-1">
                        {editingQuestion.id} (Permanent Key)
                      </div>
                    )}
                  </div>

                  {/* Points */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-display font-black uppercase text-black">
                      POINTS
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formPoints}
                      onChange={(e) => setFormPoints(parseInt(e.target.value) || 10)}
                      className="w-full px-3 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-black uppercase text-black">
                    QUESTION TITLE *
                  </label>
                  <input
                    type="text"
                    placeholder="Short, descriptive problem title..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-bold text-black focus:outline-none focus:bg-white"
                  />
                </div>

                {/* Prompt */}
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-black uppercase text-black">
                    PROBLEM PROMPT *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Full problem statement with givens, conditions, and what is asked..."
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-semibold text-black focus:outline-none focus:bg-white resize-y"
                  />
                </div>

                {/* 4 Options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-display font-black uppercase text-black">
                      OPTIONS & ANSWER KEY *
                    </label>
                    <span className="text-[10px] font-body font-semibold text-black/60">
                      Select radio button next to the correct answer
                    </span>
                  </div>

                  <div className="space-y-2">
                    {formOptions.map((opt, idx) => {
                      const isSelected = formCorrectOption === opt.id
                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                            isSelected
                              ? 'bg-[#dcfce7]/60 border-[#16a34a]'
                              : 'bg-[#f8fafc] border-black/30'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer shrink-0">
                            <input
                              type="radio"
                              name="correct-option-group"
                              checked={isSelected}
                              onChange={() => setFormCorrectOption(opt.id)}
                              className="w-4 h-4 text-[#16a34a] focus:ring-[#16a34a] cursor-pointer"
                            />
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-display font-black text-xs ${
                                isSelected
                                  ? 'bg-[#16a34a] text-white'
                                  : 'bg-black/10 text-black'
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
                            className="flex-1 px-3 py-1.5 bg-white border border-black/20 rounded-lg text-xs font-body font-semibold text-black focus:outline-none focus:border-black"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-black uppercase text-black">
                    SOLUTION & EXPLANATION *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Step-by-step mathematical or logical derivation..."
                    value={formExplanation}
                    onChange={(e) => setFormExplanation(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-medium text-black focus:outline-none focus:bg-white resize-y"
                  />
                </div>

                {/* Formula & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Formula */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-display font-black uppercase text-black">
                      KEY FORMULA / RULE (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Net Change = a + b + (ab)/100"
                      value={formFormula}
                      onChange={(e) => setFormFormula(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-mono font-medium text-black focus:outline-none focus:bg-white"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-display font-black uppercase text-black">
                      TAGS (COMMA SEPARATED)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Percentages, Arithmetic, Speed"
                      value={formTagsText}
                      onChange={(e) => setFormTagsText(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-medium text-black focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                {/* Hints */}
                <div className="space-y-1">
                  <label className="text-[11px] font-display font-black uppercase text-black">
                    HINTS (ONE PER LINE, OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Hint 1: Assume starting amount is 100&#10;Hint 2: Apply second change on updated value"
                    value={formHintsText}
                    onChange={(e) => setFormHintsText(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f8fafc] border-2 border-black rounded-xl text-xs font-body font-medium text-black focus:outline-none focus:bg-white resize-y"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="form-is-active"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-black focus:ring-black cursor-pointer"
                  />
                  <label
                    htmlFor="form-is-active"
                    className="text-xs font-display font-black uppercase text-black cursor-pointer"
                  >
                    ACTIVE QUESTION (UNCHECKED BY DEFAULT FOR STAGING & REVIEW)
                  </label>
                </div>
              </div>

              {/* Fixed Footer Actions */}
              <div className="p-4 border-t-2 sm:border-t-3 border-black bg-[#f8fafc] shrink-0 flex-none flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 bg-black/5 hover:bg-black/10 text-black border-2 border-black/20 rounded-xl font-display font-black text-xs uppercase transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-[#ffd43b] text-black hover:bg-black hover:text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0_#000000] disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingQuestion ? 'SAVE CHANGES' : 'CREATE QUESTION'}</span>
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden data-lenis-prevent animate-fade-in"
          data-lenis-prevent
        >
          <div
            className="bg-white border-3 sm:border-4 border-black rounded-2xl max-w-md w-full p-6 shadow-[8px_8px_0_#000000] relative space-y-4 data-lenis-prevent"
            data-lenis-prevent
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center text-white ${
                  confirmToggleQuestion.is_active ? 'bg-[#ef4444]' : 'bg-[#10b981]'
                }`}
              >
                {confirmToggleQuestion.is_active ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-display font-black text-lg uppercase text-black">
                  {confirmToggleQuestion.is_active ? 'DEACTIVATE QUESTION?' : 'ACTIVATE QUESTION?'}
                </h3>
                <div className="font-mono text-xs font-bold text-black/60">
                  Target: {confirmToggleQuestion.id}
                </div>
              </div>
            </div>

            <p className="text-xs font-body font-semibold text-black/70 leading-relaxed">
              {confirmToggleQuestion.is_active
                ? 'Deactivating this question will remove it from the public practice question bank and random challenge rotations.'
                : 'Activating this question will immediately expose it to students in the public practice bank.'}
            </p>

            {confirmToggleQuestion.isContestQuestion && confirmToggleQuestion.is_active && (
              <div className="p-3 bg-[#fee2e2] border-2 border-[#ef4444] rounded-xl flex items-start gap-2 text-xs font-body font-bold text-[#b91c1c]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  WARNING: This question is mapped to a tournament/contest. If the contest is live, the database will block deactivation.
                </div>
              </div>
            )}

            <div className="pt-3 border-t-2 border-black/10 flex items-center justify-end gap-2">
              <button
                disabled={actionLoading}
                onClick={() => setConfirmToggleQuestion(null)}
                className="px-4 py-2 bg-black/5 hover:bg-black/10 text-black border-2 border-black/20 rounded-xl font-display font-black text-xs uppercase"
              >
                CANCEL
              </button>
              <button
                disabled={actionLoading}
                onClick={handleExecuteToggleActive}
                className={`px-5 py-2 text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all shadow-[2px_2px_0_#000000] flex items-center gap-1.5 ${
                  confirmToggleQuestion.is_active
                    ? 'bg-[#ef4444] hover:bg-black'
                    : 'bg-[#10b981] hover:bg-black'
                }`}
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  CONFIRM {confirmToggleQuestion.is_active ? 'DEACTIVATION' : 'ACTIVATION'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}
