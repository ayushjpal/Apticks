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

        const { questions: fetchedQuestions, progressMap: fetchedMap } =
          await QuestionService.getQuestionsWithProgress(activeUser.id)

        if (isMounted) {
          setQuestions(fetchedQuestions)
          setProgressMap(fetchedMap)
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
    return QuestionService.calculateStats(questions, progressMap)
  }, [questions, progressMap])

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
      <div className="min-h-screen bg-[#071a2b] flex items-center justify-center text-white">
        <div className="text-center font-display font-black">
          <div className="w-10 h-10 border-3 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs tracking-wider">LOADING QUESTION ARENA...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-3.5 sm:space-y-4 animate-entry">
        {/* ================================================= */}
        {/* TOP ARENA HEADER (COMPACT)                        */}
        {/* ================================================= */}
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#ffd43b] p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#38aef0] text-black border border-black rounded-full px-2 py-0.2 text-[9px] font-mono font-black tracking-widest uppercase shadow-[1px_1px_0_#000000] mb-1">
              <BookOpen className="w-2.5 h-2.5 text-black" />
              <span>MODULE 02 // SPEED PRACTICE</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black leading-tight">
              QUESTION BANK
            </h1>
            <p className="text-xs font-body font-semibold text-black/70">
              Master quantitative, logical, and data aptitude patterns with progressive speed challenges.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePickRandom}
              className="px-3 py-2 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] font-display font-black text-xs uppercase tracking-wider transition-transform hover:-translate-x-0.5 cursor-pointer flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>RANDOM PROBLEM</span>
            </button>

            <div className="px-3 py-2 bg-black text-white border-2 border-black rounded-xl shadow-[2px_2px_0_#ffd43b] font-display font-black text-xs uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#ffd43b] fill-[#ffd43b]" />
              <span className="font-mono">{stats.totalPoints} XP</span>
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* DENSE PROGRESS & DIFFICULTY SUMMARY STRIP         */}
        {/* ================================================= */}
        <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[4px_4px_0_#000000] p-3 sm:p-3.5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-2.5 items-center">
            {/* Solved Summary */}
            <div className="p-2.5 bg-[#e9f6ff] border-2 border-black rounded-xl shadow-[1.5px_1.5px_0_#000000]">
              <div className="flex items-center justify-between font-mono text-[10px] font-black text-black">
                <span>SOLVED</span>
                <span className="bg-[#38aef0] text-black px-1.5 py-0.2 rounded border border-black text-[9px]">
                  {stats.accuracyRate}% ACC
                </span>
              </div>
              <div className="font-display font-black text-lg text-black mt-0.5">
                {stats.solvedCount} <span className="text-xs font-bold text-black/60">/ {stats.totalQuestions}</span>
              </div>
            </div>

            {/* Easy Progress */}
            <div className="p-2.5 bg-[#f0fdf4] border-2 border-black rounded-xl shadow-[1.5px_1.5px_0_#000000]">
              <div className="flex justify-between items-center font-display font-black text-[11px] mb-1">
                <span className="text-[#15803d]">EASY</span>
                <span className="font-mono text-[10px]">{stats.easySolved}/{stats.easyTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-white border border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#32e875] rounded-full"
                  style={{
                    width: `${stats.easyTotal > 0 ? (stats.easySolved / stats.easyTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Medium Progress */}
            <div className="p-2.5 bg-[#fefce8] border-2 border-black rounded-xl shadow-[1.5px_1.5px_0_#000000]">
              <div className="flex justify-between items-center font-display font-black text-[11px] mb-1">
                <span className="text-[#a16207]">MEDIUM</span>
                <span className="font-mono text-[10px]">{stats.mediumSolved}/{stats.mediumTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-white border border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ffd43b] rounded-full"
                  style={{
                    width: `${stats.mediumTotal > 0 ? (stats.mediumSolved / stats.mediumTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Hard Progress */}
            <div className="p-2.5 bg-[#fef2f2] border-2 border-black rounded-xl shadow-[1.5px_1.5px_0_#000000]">
              <div className="flex justify-between items-center font-display font-black text-[11px] mb-1">
                <span className="text-[#b91c1c]">HARD</span>
                <span className="font-mono text-[10px]">{stats.hardSolved}/{stats.hardTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-white border border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff5b5b] rounded-full"
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
              className={`p-2.5 border-2 border-black rounded-xl shadow-[1.5px_1.5px_0_#000000] cursor-pointer transition-colors col-span-2 md:col-span-1 flex items-center justify-between ${
                selectedStatus === 'bookmarked' ? 'bg-[#ffd43b]' : 'bg-white hover:bg-[#e9f6ff]'
              }`}
            >
              <div>
                <div className="flex items-center gap-1 font-display font-black text-[11px]">
                  <Bookmark className="w-3 h-3 fill-current" />
                  <span>SAVED</span>
                </div>
                <div className="font-mono text-[9px] font-bold text-black/70">
                  {selectedStatus === 'bookmarked' ? 'Filtering' : 'Click to filter'}
                </div>
              </div>
              <span className="font-display font-black text-base">{stats.bookmarkedCount}</span>
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
                  px-3 py-1.5 sm:px-3.5 sm:py-2 border-2 border-black rounded-xl font-display font-black text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all duration-150 flex items-center gap-1.5 select-none
                  ${
                    isActive
                      ? 'bg-[#ffd43b] text-black shadow-[2.5px_2.5px_0_#000000] -translate-y-0.5'
                      : 'bg-white text-black/75 hover:text-black hover:bg-[#e9f6ff] shadow-[1.5px_1.5px_0_#000000]'
                  }
                `}
              >
                <span>{cat.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full border ${
                    isActive
                      ? 'bg-black text-[#ffd43b] border-black font-black'
                      : 'bg-black/5 text-black/60 border-black/20'
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
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[4px_4px_0_#000000] p-2.5 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="flex-1 flex items-center bg-white border-2 border-black rounded-xl shadow-[1.5px_1.5px_0_#000000] overflow-hidden">
            <span className="px-2.5 text-black">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search problems by title, topic, or pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-1.5 px-1.5 outline-none font-display font-bold text-xs bg-transparent placeholder:text-black/35"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Topic Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-black uppercase text-black">TOPIC:</span>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="py-1.5 px-2.5 bg-white border-2 border-black rounded-xl font-display font-bold text-[11px] shadow-[1.5px_1.5px_0_#000000] outline-none cursor-pointer"
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
            <div className="flex items-center gap-1 bg-[#f1f5f9] border-1.5 border-black rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setSelectedDifficulty('all')}
                className={`px-2 py-0.5 rounded-lg font-display font-black text-[9px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'all' ? 'bg-black text-white' : 'text-black hover:bg-black/10'
                }`}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('easy')}
                className={`px-2 py-0.5 rounded-lg font-display font-black text-[9px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'easy' ? 'bg-[#32e875] text-black font-black' : 'text-black hover:bg-black/10'
                }`}
              >
                EASY
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('medium')}
                className={`px-2 py-0.5 rounded-lg font-display font-black text-[9px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'medium' ? 'bg-[#ffd43b] text-black font-black' : 'text-black hover:bg-black/10'
                }`}
              >
                MED
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('hard')}
                className={`px-2 py-0.5 rounded-lg font-display font-black text-[9px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'hard' ? 'bg-[#ff5b5b] text-white font-black' : 'text-black hover:bg-black/10'
                }`}
              >
                HARD
              </button>
            </div>

            {/* Quick Reset Filters Action when active */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset all active filters"
                className="px-2.5 py-1 bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] border-1.5 border-black rounded-lg font-display font-black text-[10px] uppercase shadow-[1px_1px_0_#000000] cursor-pointer flex items-center gap-1 transition-transform hover:-translate-x-0.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET</span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* PROBLEMS TABLE (DESKTOP) / CARDS (MOBILE)         */}
        {/* ================================================= */}
        <div className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#000000] overflow-hidden">
          {/* Header Strip with Result Count */}
          <div className="px-3.5 py-2 bg-[#f8fafc] border-b-2 border-black flex items-center justify-between text-xs font-mono font-bold text-black/70">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
              <span>
                SHOWING <strong className="text-black">{filteredQuestions.length}</strong> OF{' '}
                <strong className="text-black">{questions.length}</strong> PROBLEMS
              </span>
            </div>

            {selectedCategory !== 'all' && (
              <span className="bg-[#ffd43b] text-black border border-black rounded-full px-2 py-0.2 text-[9px] font-display font-black uppercase">
                {selectedCategory}
              </span>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#071a2b] text-white border-b-2 border-black font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-center w-12">STATUS</th>
                  <th className="py-2.5 px-2 text-center w-10">SAVE</th>
                  <th className="py-2.5 px-3">PROBLEM TITLE</th>
                  <th className="py-2.5 px-3">CATEGORY // TOPIC</th>
                  <th className="py-2.5 px-3 text-center w-24">DIFFICULTY</th>
                  <th className="py-2.5 px-3 text-center w-20">ACCURACY</th>
                  <th className="py-2.5 px-4 text-right w-28">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 font-body text-xs">
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-4 text-center">
                      <div className="max-w-md mx-auto">
                        <div className="w-10 h-10 bg-[#ffd43b] border-2 border-black rounded-xl mx-auto mb-2 flex items-center justify-center font-display font-black shadow-[2px_2px_0_#000000]">
                          !
                        </div>
                        <div className="font-display font-black text-lg uppercase text-black">
                          NO QUESTIONS FOUND
                        </div>
                        <p className="mt-1 text-xs font-body font-semibold text-black/65">
                          No problems match your current combination of category, topic, difficulty, and search filters.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-3 px-4 py-2 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] transition-transform hover:-translate-x-0.5 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>RESET ALL FILTERS</span>
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
                        className="hover:bg-[#f8fafc] transition-colors cursor-pointer"
                      >
                        {/* Status Checkmark */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex justify-center">
                            {isSolved ? (
                              <span className="w-5 h-5 rounded-full bg-[#32e875] border-1.5 border-black flex items-center justify-center font-black text-[10px] text-black">
                                ✓
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full border-1.5 border-black/30" />
                            )}
                          </div>
                        </td>

                        {/* Bookmark Button */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleBookmark(e, q.id)}
                            className={`p-1 border-1.5 border-black rounded-lg transition-transform hover:scale-110 cursor-pointer ${
                              isBookmarked ? 'bg-[#ffd43b] text-black' : 'bg-white text-black/40'
                            }`}
                            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Problem'}
                          >
                            <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-black' : ''}`} />
                          </button>
                        </td>

                        {/* Title & Tags */}
                        <td className="py-2.5 px-3">
                          <div className="font-display font-black text-sm text-black uppercase tracking-tight hover:text-[#2563eb]">
                            {q.title}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {q.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-[9px] font-mono font-bold bg-[#f1f5f9] border border-black/30 rounded px-1 py-0.2"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Category & Topic */}
                        <td className="py-2.5 px-3">
                          <div className="font-display font-black text-[11px] uppercase text-black">
                            {q.topic}
                          </div>
                          <div className="text-[10px] font-semibold text-black/60">
                            {q.category}
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-2.5 px-3 text-center">
                          {q.difficulty === 'easy' && (
                            <span className="bg-[#32e875] text-black border border-black rounded-full px-2 py-0.2 text-[9px] font-display font-black uppercase shadow-[1px_1px_0_#000000]">
                              EASY
                            </span>
                          )}
                          {q.difficulty === 'medium' && (
                            <span className="bg-[#ffd43b] text-black border border-black rounded-full px-2 py-0.2 text-[9px] font-display font-black uppercase shadow-[1px_1px_0_#000000]">
                              MEDIUM
                            </span>
                          )}
                          {q.difficulty === 'hard' && (
                            <span className="bg-[#ff5b5b] text-white border border-black rounded-full px-2 py-0.2 text-[9px] font-display font-black uppercase shadow-[1px_1px_0_#000000]">
                              HARD
                            </span>
                          )}
                        </td>

                        {/* Acceptance */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-[11px]">
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
                            className={`px-3 py-1 border-2 border-black rounded-lg font-display font-black text-[11px] uppercase tracking-wider shadow-[1.5px_1.5px_0_#000000] cursor-pointer transition-transform hover:-translate-x-0.5 ${
                              isSolved
                                ? 'bg-white text-black hover:bg-[#e9f6ff]'
                                : 'bg-[#ffd43b] text-black hover:bg-[#facc15]'
                            }`}
                          >
                            {isSolved ? 'REVIEW →' : 'SOLVE →'}
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
          <div className="md:hidden divide-y divide-black/10">
            {filteredQuestions.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-8 h-8 bg-[#ffd43b] border-2 border-black rounded-lg mx-auto mb-2 flex items-center justify-center font-display font-black text-xs shadow-[1.5px_1.5px_0_#000000]">
                  !
                </div>
                <div className="font-display font-black text-base uppercase text-black">
                  NO QUESTIONS FOUND
                </div>
                <p className="mt-1 text-xs font-body font-semibold text-black/60">
                  Try changing your category, topic, difficulty, or search.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 px-3.5 py-1.5 bg-[#ffd43b] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#000000] inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>RESET FILTERS</span>
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
                    className="p-3 bg-white active:bg-[#f8fafc] cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isSolved ? (
                          <span className="px-1.5 py-0.2 bg-[#32e875] border border-black rounded-full font-display font-black text-[9px] uppercase">
                            SOLVED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 bg-slate-100 border border-black rounded-full font-display font-bold text-[9px] uppercase">
                            UNSOLVED
                          </span>
                        )}

                        {q.difficulty === 'easy' && (
                          <span className="bg-[#32e875] border border-black rounded-full px-1.5 py-0.2 text-[8px] font-display font-black uppercase">
                            EASY
                          </span>
                        )}
                        {q.difficulty === 'medium' && (
                          <span className="bg-[#ffd43b] border border-black rounded-full px-1.5 py-0.2 text-[8px] font-display font-black uppercase">
                            MED
                          </span>
                        )}
                        {q.difficulty === 'hard' && (
                          <span className="bg-[#ff5b5b] text-white border border-black rounded-full px-1.5 py-0.2 text-[8px] font-display font-black uppercase">
                            HARD
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleBookmark(e, q.id)}
                        className={`p-1 border-1.5 border-black rounded-lg ${
                          isBookmarked ? 'bg-[#ffd43b]' : 'bg-white'
                        }`}
                      >
                        <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-black' : ''}`} />
                      </button>
                    </div>

                    <h3 className="font-display font-black text-sm uppercase text-black leading-tight">
                      {q.title}
                    </h3>

                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-black/60">
                        {q.topic} • {q.category}
                      </span>
                      <span className="font-display font-black text-xs text-[#2563eb]">
                        {isSolved ? 'REVIEW →' : 'SOLVE →'}
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
