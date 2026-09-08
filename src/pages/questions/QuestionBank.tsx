import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  BookOpen,
  Shuffle,
  Bookmark,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { QuestionService } from '../../services/questionService'
import type {
  Question,
  Category,
  Difficulty,
  UserQuestionProgress,
} from '../../types/questions'
import AppLayout from '../../components/layout/AppLayout'
import { PageHeader, StatusBadge, NeoButton } from '../../components/ui'

interface CategoryTab {
  id: Category | 'all'
  label: string
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'ALL CATEGORIES' },
  { id: 'Quantitative Aptitude', label: 'QUANTITATIVE' },
  { id: 'Logical Reasoning', label: 'LOGICAL' },
  { id: 'Data Interpretation', label: 'DATA' },
  { id: 'Verbal & Abstract', label: 'VERBAL' },
]

/**
 * Case-insensitive, whitespace-tolerant category matching helper.
 */
function matchesCategory(
  questionCategory: string,
  selectedCategory: Category | 'all'
): boolean {
  if (selectedCategory === 'all') return true
  const q = questionCategory.trim().toLowerCase()
  const s = selectedCategory.trim().toLowerCase()
  if (q === s) return true
  if (s.includes('quant') && q.includes('quant')) return true
  if (s.includes('logic') && q.includes('logic')) return true
  if (s.includes('data') && q.includes('data')) return true
  if (s.includes('verbal') && q.includes('verbal')) return true
  return false
}

export default function QuestionBank() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, UserQuestionProgress>>({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [challengeBonusXp, setChallengeBonusXp] = useState(0)
  const [contestXp, setContestXp] = useState(0)
  const [authoritativeTotalXp, setAuthoritativeTotalXp] = useState<number | undefined>(undefined)

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'solved' | 'unsolved' | 'bookmarked'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        let activeUser: { id: string } | null = null

        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.user) {
          activeUser = sessionData.session.user
        } else {
          const { data: userData, error: userError } = await supabase.auth.getUser()
          if (!userError && userData?.user) {
            activeUser = userData.user
          }
        }

        if (!activeUser) {
          navigate('/login', { replace: true })
          return
        }

        if (isMounted) {
          setUserId(activeUser.id)
        }

        const {
          questions: fetchedQuestions,
          progressMap: fetchedMap,
          challengeBonusXp: fetchedBonus,
          contestXp: fetchedContest,
          authoritativeTotalXp: fetchedAuthXp,
        } = await QuestionService.getQuestionsWithProgress(activeUser.id)

        if (isMounted) {
          setQuestions(fetchedQuestions)
          setProgressMap(fetchedMap)
          setChallengeBonusXp(fetchedBonus)
          setContestXp(fetchedContest)
          setAuthoritativeTotalXp(fetchedAuthXp)
        }
      } catch (err) {
        console.error('Error loading question bank data:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [navigate])

  // Accurate category counts derived from the actual question dataset
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: questions.length,
      'Quantitative Aptitude': 0,
      'Logical Reasoning': 0,
      'Data Interpretation': 0,
      'Verbal & Abstract': 0,
    }

    questions.forEach((q) => {
      if (matchesCategory(q.category, 'Quantitative Aptitude')) {
        counts['Quantitative Aptitude']++
      }
      if (matchesCategory(q.category, 'Logical Reasoning')) {
        counts['Logical Reasoning']++
      }
      if (matchesCategory(q.category, 'Data Interpretation')) {
        counts['Data Interpretation']++
      }
      if (matchesCategory(q.category, 'Verbal & Abstract')) {
        counts['Verbal & Abstract']++
      }
    })

    return counts
  }, [questions])

  // Compute available topics based on selected category
  const availableTopics = useMemo(() => {
    let pool = questions
    if (selectedCategory !== 'all') {
      pool = pool.filter((q) => matchesCategory(q.category, selectedCategory))
    }
    const topics = Array.from(new Set(pool.map((q) => q.topic)))
    return topics.sort()
  }, [questions, selectedCategory])

  // Handle switching category tab gracefully
  const handleSelectCategory = (catId: Category | 'all') => {
    setSelectedCategory(catId)

    // If current selected topic is not in the new category, reset topic to 'all'
    if (selectedTopic !== 'all' && catId !== 'all') {
      const validTopics = questions
        .filter((q) => matchesCategory(q.category, catId))
        .map((q) => q.topic)
      if (!validTopics.includes(selectedTopic)) {
        setSelectedTopic('all')
      }
    }
  }

  // Combined real-time filtered questions pipeline
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 1. Category Filter
      if (!matchesCategory(q.category, selectedCategory)) {
        return false
      }

      // 2. Topic Filter
      if (selectedTopic !== 'all' && q.topic.toLowerCase() !== selectedTopic.toLowerCase()) {
        return false
      }

      // 3. Difficulty Filter
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false
      }

      // 4. Status Filter
      const prog = progressMap[q.id]
      if (selectedStatus === 'solved' && !prog?.isSolved) {
        return false
      }
      if (selectedStatus === 'unsolved' && prog?.isSolved) {
        return false
      }
      if (selectedStatus === 'bookmarked' && !prog?.isBookmarked) {
        return false
      }

      // 5. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchTitle = q.title.toLowerCase().includes(query)
        const matchTopic = q.topic.toLowerCase().includes(query)
        const matchCategory = q.category.toLowerCase().includes(query)
        const matchTags = q.tags.some((tag: string) => tag.toLowerCase().includes(query))
        if (!matchTitle && !matchTopic && !matchCategory && !matchTags) {
          return false
        }
      }

      return true
    })
  }, [
    questions,
    progressMap,
    selectedCategory,
    selectedTopic,
    selectedDifficulty,
    selectedStatus,
    searchQuery,
  ])

  // Progress Statistics
  const stats = useMemo(() => {
    return QuestionService.calculateStats(questions, progressMap, [], challengeBonusXp, contestXp, authoritativeTotalXp)
  }, [questions, progressMap, challengeBonusXp, contestXp, authoritativeTotalXp])

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedTopic !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedStatus !== 'all' ||
    searchQuery.trim() !== ''

  const handleToggleBookmark = async (e: React.MouseEvent, questionId: string) => {
    e.stopPropagation()
    if (!userId) return

    setProgressMap((prev) => {
      const current = prev[questionId]
      const nextBookmarked = !current?.isBookmarked
      return {
        ...prev,
        [questionId]: {
          questionId,
          isSolved: current?.isSolved ?? false,
          isCorrect: current?.isCorrect ?? false,
          isBookmarked: nextBookmarked,
          selectedOption: current?.selectedOption,
          attemptsCount: current?.attemptsCount ?? 0,
          timeSpentSeconds: current?.timeSpentSeconds ?? 0,
          lastAttemptedAt: current?.lastAttemptedAt ?? new Date().toISOString(),
        },
      }
    })

    await QuestionService.toggleBookmark(questionId, userId)
  }

  const handlePickRandom = () => {
    const pool = filteredQuestions.length > 0 ? filteredQuestions : questions
    const unsolved = pool.filter((q) => !progressMap[q.id]?.isSolved)
    const targetPool = unsolved.length > 0 ? unsolved : pool
    if (targetPool.length > 0) {
      const randomQ = targetPool[Math.floor(Math.random() * targetPool.length)]
      navigate(`/questions/${randomQ.id}`)
    }
  }

  const handleResetFilters = () => {
    setSelectedCategory('all')
    setSelectedTopic('all')
    setSelectedDifficulty('all')
    setSelectedStatus('all')
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1d2d] flex items-center justify-center text-white">
        <div className="text-center font-display font-black">
          <div className="w-10 h-10 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs tracking-wider">LOADING QUESTION ARENA...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout maxWidth="narrow">
      <div className="space-y-3.5 sm:space-y-4 animate-entry">
        {/* ================================================= */}
        {/* TOP ARENA HEADER (COMPACT)                        */}
        {/* ================================================= */}
        <PageHeader
          eyebrow="Speed Practice"
          eyebrowIcon={<BookOpen className="w-3.5 h-3.5 text-[#0c1d2d]/70" />}
          title="Question Bank"
          description="Master quantitative, logical, and data aptitude patterns with progressive speed challenges."
          actions={
            <>
              <NeoButton
                variant="primary"
                size="sm"
                icon={<Shuffle className="w-3.5 h-3.5" />}
                onClick={handlePickRandom}
              >
                Random Problem
              </NeoButton>
              <div className="px-2.5 py-1.5 bg-slate-100 text-[#0c1d2d] border border-[#0c1d2d]/15 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{stats.totalPoints} XP</span>
              </div>
            </>
          }
        />

        {/* ================================================= */}
        {/* DENSE PROGRESS & DIFFICULTY SUMMARY STRIP         */}
        {/* ================================================= */}
        <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-2.5 items-center">
            {/* Solved Summary */}
            <div className="p-2.5 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg">
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                <span>SOLVED</span>
                <span className="bg-sky-50 text-sky-700 px-1.5 py-0.2 rounded border border-sky-200 text-[9px] font-semibold">
                  {stats.accuracyRate}% ACC
                </span>
              </div>
              <div className="font-display font-bold text-base text-[#0c1d2d] mt-0.5">
                {stats.solvedCount} <span className="text-xs font-normal text-slate-500">/ {stats.totalQuestions}</span>
              </div>
            </div>

            {/* Easy Progress */}
            <div className="p-2.5 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg">
              <div className="flex justify-between items-center text-[11px] font-semibold mb-1">
                <span className="text-emerald-700">Easy</span>
                <span className="font-mono text-[10px] text-slate-500">{stats.easySolved}/{stats.easyTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${stats.easyTotal > 0 ? (stats.easySolved / stats.easyTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Medium Progress */}
            <div className="p-2.5 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg">
              <div className="flex justify-between items-center text-[11px] font-semibold mb-1">
                <span className="text-amber-700">Medium</span>
                <span className="font-mono text-[10px] text-slate-500">{stats.mediumSolved}/{stats.mediumTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${stats.mediumTotal > 0 ? (stats.mediumSolved / stats.mediumTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Hard Progress */}
            <div className="p-2.5 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg">
              <div className="flex justify-between items-center text-[11px] font-semibold mb-1">
                <span className="text-rose-700">Hard</span>
                <span className="font-mono text-[10px] text-slate-500">{stats.hardSolved}/{stats.hardTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{
                    width: `${stats.hardTotal > 0 ? (stats.hardSolved / stats.hardTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Saved Bookmark Toggle Button */}
            <div
              onClick={() =>
                setSelectedStatus(
                  selectedStatus === 'bookmarked' ? 'all' : 'bookmarked'
                )
              }
              className={`p-2.5 border rounded-lg cursor-pointer transition-colors col-span-2 md:col-span-1 flex items-center justify-between ${
                selectedStatus === 'bookmarked'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-white border-[#0c1d2d]/12 hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-[#0c1d2d]">
                  <Bookmark className={`w-3 h-3 ${selectedStatus === 'bookmarked' ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                  <span>Saved</span>
                </div>
                <div className="font-mono text-[9px] text-slate-500">
                  {selectedStatus === 'bookmarked' ? 'Filtering' : 'Click to filter'}
                </div>
              </div>
              <span className="font-display font-bold text-sm text-[#0c1d2d]">{stats.bookmarkedCount}</span>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* CATEGORY TABS WITH ACCURATE DATASET COUNTS        */}
        {/* ================================================= */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.id
            const count = categoryCounts[cat.id] ?? 0

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                aria-pressed={isActive}
                className={`
                  px-3 py-1.5 border rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 select-none
                  ${
                    isActive
                      ? 'bg-[#0c1d2d] text-white border-[#0c1d2d]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }
                `}
              >
                <span>{cat.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white font-medium'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ================================================= */}
        {/* SEARCH & FILTERS BAR                              */}
        {/* ================================================= */}
        <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <span className="px-2.5 text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search problems by title, topic, or pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-1.5 px-1 outline-none text-xs bg-transparent text-[#0c1d2d] placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Topic Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-slate-500 uppercase">Topic:</span>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs text-[#0c1d2d] outline-none cursor-pointer"
              >
                <option value="all">All Topics ({availableTopics.length})</option>
                {availableTopics.map((top) => (
                  <option key={top} value={top}>
                    {top}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Chips */}
            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDifficulty('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedDifficulty === 'all' ? 'bg-white text-[#0c1d2d] shadow-xs' : 'text-slate-600 hover:text-black'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('easy')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedDifficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-black'
                }`}
              >
                Easy
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('medium')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedDifficulty === 'medium' ? 'bg-amber-50 text-amber-800 shadow-xs' : 'text-slate-600 hover:text-black'
                }`}
              >
                Med
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('hard')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                  selectedDifficulty === 'hard' ? 'bg-rose-50 text-rose-700 shadow-xs' : 'text-slate-600 hover:text-black'
                }`}
              >
                Hard
              </button>
            </div>

            {/* Quick Reset Filters Action when active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset all active filters"
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* PROBLEMS TABLE (DESKTOP) / CARDS (MOBILE)         */}
        {/* ================================================= */}
        <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs overflow-hidden">
          {/* Header Strip with Result Count */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-mono text-slate-600">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Showing <strong className="text-[#0c1d2d]">{filteredQuestions.length}</strong> of{' '}
                <strong className="text-[#0c1d2d]">{questions.length}</strong> problems
              </span>
            </div>

            {selectedCategory !== 'all' && (
              <span className="bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-[10px] font-medium">
                {selectedCategory}
              </span>
            )}
          </div>

          {/* Desktop Table View */}
          <div
            data-lenis-prevent
            className="hidden md:block question-list-scroll max-h-[480px] lg:max-h-[520px] overflow-y-auto overflow-x-auto min-h-0"
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] font-semibold tracking-wider">
                  <th className="py-2.5 px-3 text-center w-12">STATUS</th>
                  <th className="py-2.5 px-2 text-center w-10">SAVE</th>
                  <th className="py-2.5 px-3">TITLE</th>
                  <th className="py-2.5 px-3">TOPIC</th>
                  <th className="py-2.5 px-3 text-center w-24">DIFFICULTY</th>
                  <th className="py-2.5 px-3 text-center w-20">ACCURACY</th>
                  <th className="py-2.5 px-4 text-right w-28">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-body text-xs">
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center">
                      <div className="max-w-md mx-auto">
                        <div className="font-display font-bold text-base text-[#0c1d2d]">
                          No questions found
                        </div>
                        <p className="mt-1 text-xs font-body text-slate-500">
                          No problems match your current combination of category, topic, difficulty, and search filters.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 text-slate-700 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredQuestions.map((q) => {
                    const prog = progressMap[q.id]
                    const isSolved = prog?.isSolved ?? false
                    const isBookmarked = prog?.isBookmarked ?? false

                    return (
                      <tr
                        key={q.id}
                        onClick={() => navigate(`/questions/${q.id}`)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* Status Checkmark */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex justify-center">
                            {isSolved ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                            )}
                          </div>
                        </td>

                        {/* Bookmark Button */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleBookmark(e, q.id)}
                            className="p-1 rounded text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Problem'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                          </button>
                        </td>

                        {/* Title & Tags */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-sm text-[#0c1d2d] hover:text-sky-600 transition-colors">
                            {q.title}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {q.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono text-slate-500 bg-slate-100 rounded px-1.5 py-0.2"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Category & Topic */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-xs text-[#0c1d2d]">
                            {q.topic}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {q.category}
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge status={q.difficulty} density="xs" />
                        </td>

                        {/* Acceptance */}
                        <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-600">
                          {q.acceptanceRate ?? 75}%
                        </td>

                        {/* Solve Button */}
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/questions/${q.id}`)
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              isSolved
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-[#ffd43b] hover:bg-[#fcc828] text-[#0c1d2d] shadow-xs'
                            }`}
                          >
                            {isSolved ? 'Review' : 'Solve'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div
            data-lenis-prevent
            className="md:hidden question-list-scroll max-h-[60vh] sm:max-h-[500px] overflow-y-auto min-h-0 divide-y divide-slate-100"
          >
            {filteredQuestions.length === 0 ? (
              <div className="p-6 text-center">
                <div className="font-display font-bold text-base text-[#0c1d2d]">
                  No questions found
                </div>
                <p className="mt-1 text-xs font-body text-slate-500">
                  Try changing your category, topic, difficulty, or search.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 text-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const prog = progressMap[q.id]
                const isSolved = prog?.isSolved ?? false
                const isBookmarked = prog?.isBookmarked ?? false

                return (
                  <div
                    key={q.id}
                    onClick={() => navigate(`/questions/${q.id}`)}
                    className="p-3 bg-white active:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isSolved ? (
                          <StatusBadge status="solved" density="xs" label="Solved" />
                        ) : (
                          <StatusBadge status="unsolved" density="xs" label="Unsolved" />
                        )}
                        <StatusBadge status={q.difficulty} density="xs" />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleBookmark(e, q.id)}
                        className="p-1 text-slate-400 hover:text-amber-500"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                      </button>
                    </div>

                    <h3 className="font-semibold text-sm text-[#0c1d2d] leading-snug">
                      {q.title}
                    </h3>

                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="font-mono text-[10px] text-slate-500">
                        {q.topic} • {q.category}
                      </span>
                      <span className="font-semibold text-sky-600">
                        {isSolved ? 'Review →' : 'Solve →'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

