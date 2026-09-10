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
import { PageHeader, NeoButton } from '../../components/ui'

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
          eyebrowIcon={<BookOpen className="w-3.5 h-3.5 text-[#ffd43b]" />}
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
              <div className="px-2.5 py-1.5 bg-amber-400/[0.08] text-amber-300 border border-amber-400/25 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{stats.totalPoints} XP</span>
              </div>
            </>
          }
        />

        {/* ================================================= */}
        {/* DENSE PROGRESS & DIFFICULTY SUMMARY STRIP         */}
        {/* ================================================= */}
        <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-3 sm:p-4 text-white">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 items-center">
            {/* Solved Summary */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
              <div className="flex items-center justify-between font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>SOLVED</span>
                <span className="bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/30 text-[9px] font-mono font-semibold">
                  {stats.accuracyRate}% ACC
                </span>
              </div>
              <div className="font-display font-black text-base text-white mt-1">
                {stats.solvedCount} <span className="text-xs font-normal text-slate-400 font-mono">/ {stats.totalQuestions}</span>
              </div>
            </div>

            {/* Easy Progress */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
              <div className="flex justify-between items-center text-[11px] font-bold mb-1.5">
                <span className="text-emerald-400">Easy</span>
                <span className="font-mono text-[10px] text-slate-400">{stats.easySolved}/{stats.easyTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  style={{
                    width: `${stats.easyTotal > 0 ? (stats.easySolved / stats.easyTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Medium Progress */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
              <div className="flex justify-between items-center text-[11px] font-bold mb-1.5">
                <span className="text-amber-400">Medium</span>
                <span className="font-mono text-[10px] text-slate-400">{stats.mediumSolved}/{stats.mediumTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                  style={{
                    width: `${stats.mediumTotal > 0 ? (stats.mediumSolved / stats.mediumTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Hard Progress */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl">
              <div className="flex justify-between items-center text-[11px] font-bold mb-1.5">
                <span className="text-rose-400">Hard</span>
                <span className="font-mono text-[10px] text-slate-400">{stats.hardSolved}/{stats.hardTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.4)]"
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
              className={`p-3 border rounded-xl cursor-pointer transition-all col-span-2 md:col-span-1 flex items-center justify-between ${
                selectedStatus === 'bookmarked'
                  ? 'bg-amber-400/[0.12] border-amber-400/50 shadow-[0_0_15px_rgba(255,212,59,0.15)] text-white'
                  : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Bookmark className={`w-3.5 h-3.5 ${selectedStatus === 'bookmarked' ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                  <span>Saved</span>
                </div>
                <div className="font-mono text-[9px] text-slate-400 mt-0.5">
                  {selectedStatus === 'bookmarked' ? 'Filtering' : 'Click to filter'}
                </div>
              </div>
              <span className="font-display font-black text-base text-white">{stats.bookmarkedCount}</span>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* CATEGORY TABS WITH ACCURATE DATASET COUNTS        */}
        {/* ================================================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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
                  px-3.5 py-2 border rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-2 select-none
                  ${
                    isActive
                      ? 'bg-[#ffd43b] text-[#0c1d2d] font-black border-amber-400/60 shadow-[0_0_15px_rgba(255,212,59,0.25)]'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <span>{cat.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-black/20 text-[#0c1d2d] font-black'
                      : 'bg-white/10 text-slate-400'
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
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
          {/* Search Input */}
          <div className="flex-1 flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#ffd43b]/60 transition-colors">
            <span className="px-3 text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search problems by title, topic, or pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 px-1 outline-none text-xs bg-transparent text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Topic Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topic:</span>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-200 outline-none cursor-pointer focus:border-[#ffd43b]/60"
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
            <div className="flex items-center gap-0.5 bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDifficulty('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  selectedDifficulty === 'all' ? 'bg-white/15 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('easy')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  selectedDifficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Easy
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('medium')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  selectedDifficulty === 'medium' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                Med
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('hard')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  selectedDifficulty === 'hard' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-rose-400'
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
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
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
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden text-white">
          {/* Header Strip with Result Count */}
          <div className="px-4 py-2.5 bg-black/40 border-b border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Showing <strong className="text-white">{filteredQuestions.length}</strong> of{' '}
                <strong className="text-white">{questions.length}</strong> problems
              </span>
            </div>

            {selectedCategory !== 'all' && (
              <span className="bg-white/10 text-slate-300 border border-white/10 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold">
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
              <thead className="sticky top-0 z-20">
                <tr className="text-slate-400 font-mono text-[11px] font-bold tracking-wider uppercase">
                  <th className="py-3 px-3 text-center w-12 bg-[#0c1d2d] border-b border-white/10">STATUS</th>
                  <th className="py-3 px-2 text-center w-10 bg-[#0c1d2d] border-b border-white/10">SAVE</th>
                  <th className="py-3 px-3 bg-[#0c1d2d] border-b border-white/10">TITLE</th>
                  <th className="py-3 px-3 bg-[#0c1d2d] border-b border-white/10">TOPIC</th>
                  <th className="py-3 px-3 text-center w-24 bg-[#0c1d2d] border-b border-white/10">DIFFICULTY</th>
                  <th className="py-3 px-3 text-center w-20 bg-[#0c1d2d] border-b border-white/10">ACCURACY</th>
                  <th className="py-3 px-4 text-right w-28 bg-[#0c1d2d] border-b border-white/10">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-body text-xs">
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-4 text-center">
                      <div className="max-w-md mx-auto">
                        <div className="font-display font-black text-base text-white">
                          No questions found
                        </div>
                        <p className="mt-1 text-xs font-body text-slate-400">
                          No problems match your current combination of category, topic, difficulty, and search filters.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-3.5 px-4 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 text-white transition-colors"
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
                        className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                      >
                        {/* Status Checkmark */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex justify-center">
                            {isSolved ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block group-hover:border-white/40 transition-colors" />
                            )}
                          </div>
                        </td>

                        {/* Bookmark Button */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleBookmark(e, q.id)}
                            className="p-1 rounded text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Problem'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                        </td>

                        {/* Title & Tags */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-sm text-white group-hover:text-[#ffd43b] transition-colors">
                            {q.title}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/5 rounded px-1.5 py-0.2"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Category & Topic */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-xs text-slate-200">
                            {q.topic}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {q.category}
                          </div>
                        </td>

                        {/* Difficulty - Pure Colored Text, No Badges */}
                        <td className="py-3 px-3 text-center">
                          <span className={`font-mono text-xs font-bold uppercase tracking-wider ${
                            q.difficulty.toLowerCase() === 'easy'
                              ? 'text-emerald-400'
                              : q.difficulty.toLowerCase() === 'medium'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}>
                            {q.difficulty}
                          </span>
                        </td>

                        {/* Acceptance */}
                        <td className="py-3 px-3 text-center font-mono text-xs text-slate-400">
                          {q.acceptanceRate ?? 75}%
                        </td>

                        {/* Solve Button */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/questions/${q.id}`)
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSolved
                                ? 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                                : 'bg-[#ffd43b] hover:bg-[#fcc828] text-[#0c1d2d] font-black shadow-[0_0_10px_rgba(255,212,59,0.2)]'
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
            className="md:hidden question-list-scroll max-h-[60vh] sm:max-h-[500px] overflow-y-auto min-h-0 divide-y divide-white/10"
          >
            {filteredQuestions.length === 0 ? (
              <div className="p-6 text-center">
                <div className="font-display font-black text-base text-white">
                  No questions found
                </div>
                <p className="mt-1 text-xs font-body text-slate-400">
                  Try changing your category, topic, difficulty, or search.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 px-4 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 text-white transition-colors"
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
                    className="p-3.5 bg-slate-900/40 hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isSolved ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Solved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-white/5 text-slate-400 border border-white/10 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold">
                            Unsolved
                          </span>
                        )}
                        <span className={`font-mono text-xs font-bold uppercase tracking-wider ${
                          q.difficulty.toLowerCase() === 'easy'
                            ? 'text-emerald-400'
                            : q.difficulty.toLowerCase() === 'medium'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}>
                          {q.difficulty}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleBookmark(e, q.id)}
                        className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </div>

                    <h3 className="font-semibold text-sm text-white leading-snug">
                      {q.title}
                    </h3>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-mono text-[10px] text-slate-400">
                        {q.topic} • {q.category}
                      </span>
                      <span className="font-bold text-[#ffd43b]">
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

