import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Search,
  Bookmark,
  Shuffle,
  Zap,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { QuestionService } from '../../services/questionService'
import type {
  Question,
  UserQuestionProgress,
  Category,
  Difficulty,
} from '../../types/questions'
import AppLayout from '../../components/layout/AppLayout'

export default function QuestionBank() {
  const navigate = useNavigate()

  const [userId, setUserId] = useState<string | undefined>()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progressMap, setProgressMap] = useState<
    Record<string, UserQuestionProgress>
  >({})
  const [loading, setLoading] = useState(true)

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
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user && isMounted) {
          setUserId(user.id)
        }

        const { questions: qList, progressMap: pMap } =
          await QuestionService.getQuestionsWithProgress(user?.id)

        if (isMounted) {
          setQuestions(qList)
          setProgressMap(pMap)
        }
      } catch (err) {
        console.error('Error loading question bank data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo(() => {
    return QuestionService.calculateStats(questions, progressMap)
  }, [questions, progressMap])

  const availableTopics = useMemo(() => {
    const relevant =
      selectedCategory === 'all'
        ? questions
        : questions.filter((q) => q.category === selectedCategory)
    const topicsSet = new Set(relevant.map((q) => q.topic))
    return Array.from(topicsSet).sort()
  }, [questions, selectedCategory])

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) {
        return false
      }

      if (selectedTopic !== 'all' && q.topic !== selectedTopic) {
        return false
      }

      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false
      }

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

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchTitle = q.title.toLowerCase().includes(query)
        const matchTopic = q.topic.toLowerCase().includes(query)
        const matchPrompt = q.prompt.toLowerCase().includes(query)
        const matchTags = q.tags.some((t) => t.toLowerCase().includes(query))
        if (!matchTitle && !matchTopic && !matchPrompt && !matchTags) {
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

  const handleToggleBookmark = async (e: React.MouseEvent, questionId: string) => {
    e.stopPropagation()

    setProgressMap((prev) => {
      const existing = prev[questionId]
      const newStatus = !(existing?.isBookmarked ?? false)
      return {
        ...prev,
        [questionId]: {
          questionId,
          isSolved: existing?.isSolved ?? false,
          isCorrect: existing?.isCorrect ?? false,
          isBookmarked: newStatus,
          selectedOption: existing?.selectedOption,
          attemptsCount: existing?.attemptsCount ?? 0,
          timeSpentSeconds: existing?.timeSpentSeconds ?? 0,
          lastAttemptedAt: existing?.lastAttemptedAt ?? new Date().toISOString(),
        },
      }
    })

    await QuestionService.toggleBookmark(questionId, userId)
  }

  const handlePickRandom = () => {
    const unsolved = questions.filter((q) => !progressMap[q.id]?.isSolved)
    const pool = unsolved.length > 0 ? unsolved : questions
    if (pool.length > 0) {
      const randomQ = pool[Math.floor(Math.random() * pool.length)]
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
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-4" />
          <p className="tracking-wider">LOADING QUESTION ARENA...</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-entry">
        {/* ================================================= */}
        {/* TOP ARENA HEADER                                  */}
        {/* ================================================= */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[8px_8px_0_#ffd43b] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#38aef0] text-black border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-mono font-black tracking-widest uppercase shadow-[1.5px_1.5px_0_#000000] mb-2">
              <BookOpen className="w-3 h-3 text-black" />
              <span>MODULE 02 // SPEED PRACTICE</span>
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black leading-none">
              QUESTION BANK
            </h1>
            <p className="mt-2 text-xs sm:text-sm font-body font-semibold text-black/70 max-w-xl">
              Master quantitative, logical, and data aptitude patterns with progressive speed challenges.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePickRandom}
              className="px-4 py-3 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl shadow-[3px_3px_0_#000000] font-display font-black text-xs uppercase tracking-wider transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
            >
              <Shuffle className="w-4 h-4" />
              <span>RANDOM PROBLEM</span>
            </button>

            <div className="px-4 py-3 bg-black text-white border-2 border-black rounded-xl shadow-[3px_3px_0_#ffd43b] font-display font-black text-xs uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffd43b] fill-[#ffd43b]" />
              <span className="font-mono">{stats.totalPoints} XP</span>
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* DIFFICULTY PROGRESS SUMMARY                       */}
        {/* ================================================= */}
        <section className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b-2 border-black">
            <span className="font-display font-black text-sm uppercase text-black">
              SOLVED PROBLEMS SUMMARY
            </span>
            <div className="flex items-center gap-2.5 font-mono text-xs font-black">
              <span className="bg-[#e9f6ff] border-2 border-black rounded-full px-3 py-1">
                SOLVED: {stats.solvedCount} / {stats.totalQuestions}
              </span>
              <span className="bg-[#d1fae5] border-2 border-black rounded-full px-3 py-1 text-[#065f46]">
                ACCURACY: {stats.accuracyRate}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Easy */}
            <div className="p-4 bg-[#f0fdf4] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000]">
              <div className="flex justify-between items-center font-display font-black text-xs mb-1.5">
                <span className="text-[#15803d]">EASY</span>
                <span>
                  {stats.easySolved} / {stats.easyTotal}
                </span>
              </div>
              <div className="w-full h-2.5 bg-white border-2 border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#32e875] rounded-full"
                  style={{
                    width: `${stats.easyTotal > 0 ? (stats.easySolved / stats.easyTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Medium */}
            <div className="p-4 bg-[#fefce8] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000]">
              <div className="flex justify-between items-center font-display font-black text-xs mb-1.5">
                <span className="text-[#a16207]">MEDIUM</span>
                <span>
                  {stats.mediumSolved} / {stats.mediumTotal}
                </span>
              </div>
              <div className="w-full h-2.5 bg-white border-2 border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ffd43b] rounded-full"
                  style={{
                    width: `${stats.mediumTotal > 0 ? (stats.mediumSolved / stats.mediumTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Hard */}
            <div className="p-4 bg-[#fef2f2] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000]">
              <div className="flex justify-between items-center font-display font-black text-xs mb-1.5">
                <span className="text-[#b91c1c]">HARD</span>
                <span>
                  {stats.hardSolved} / {stats.hardTotal}
                </span>
              </div>
              <div className="w-full h-2.5 bg-white border-2 border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff5b5b] rounded-full"
                  style={{
                    width: `${stats.hardTotal > 0 ? (stats.hardSolved / stats.hardTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Saved */}
            <div
              onClick={() =>
                setSelectedStatus(
                  selectedStatus === 'bookmarked' ? 'all' : 'bookmarked'
                )
              }
              className={`p-4 border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] cursor-pointer transition-colors ${
                selectedStatus === 'bookmarked' ? 'bg-[#ffd43b]' : 'bg-[#e9f6ff] hover:bg-[#d0ebff]'
              }`}
            >
              <div className="flex justify-between items-center font-display font-black text-xs mb-1.5">
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 fill-current" />
                  SAVED REVISION
                </span>
                <span>{stats.bookmarkedCount} ITEMS</span>
              </div>
              <div className="font-mono text-[10px] font-bold text-black/70">
                {selectedStatus === 'bookmarked' ? 'Filtering saved' : 'Click to filter'}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* CATEGORY TABS                                     */}
        {/* ================================================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'ALL CATEGORIES' },
            { id: 'Quantitative Aptitude', label: 'QUANTITATIVE' },
            { id: 'Logical Reasoning', label: 'LOGICAL' },
            { id: 'Data Interpretation', label: 'DATA' },
            { id: 'Verbal & Abstract', label: 'VERBAL' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id as Category | 'all')
                setSelectedTopic('all')
              }}
              className={`
                px-4 py-2 border-2 sm:border-3 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all
                ${
                  selectedCategory === cat.id
                    ? 'bg-[#ffd43b] text-black shadow-[3px_3px_0_#000000] -translate-y-0.5'
                    : 'bg-white text-black/80 hover:bg-[#e9f6ff] shadow-[2px_2px_0_#000000]'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ================================================= */}
        {/* SEARCH & FILTERS BAR                              */}
        {/* ================================================= */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex-1 flex items-center bg-white border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] overflow-hidden">
            <span className="px-3 text-black">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search problems by title, topic, or pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 px-2 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Topic Filter */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black uppercase text-black">TOPIC:</span>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="py-2 px-3 bg-white border-2 border-black rounded-xl font-display font-bold text-xs shadow-[2px_2px_0_#000000] outline-none cursor-pointer"
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
            <div className="flex items-center gap-1 bg-[#f1f5f9] border-2 border-black rounded-xl p-1">
              <button
                type="button"
                onClick={() => setSelectedDifficulty('all')}
                className={`px-3 py-1 rounded-lg font-display font-black text-[10px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'all' ? 'bg-black text-white' : 'text-black hover:bg-black/10'
                }`}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('easy')}
                className={`px-3 py-1 rounded-lg font-display font-black text-[10px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'easy' ? 'bg-[#32e875] text-black font-black' : 'text-black hover:bg-black/10'
                }`}
              >
                EASY
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('medium')}
                className={`px-3 py-1 rounded-lg font-display font-black text-[10px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'medium' ? 'bg-[#ffd43b] text-black font-black' : 'text-black hover:bg-black/10'
                }`}
              >
                MED
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('hard')}
                className={`px-3 py-1 rounded-lg font-display font-black text-[10px] uppercase cursor-pointer transition-colors ${
                  selectedDifficulty === 'hard' ? 'bg-[#ff5b5b] text-white font-black' : 'text-black hover:bg-black/10'
                }`}
              >
                HARD
              </button>
            </div>
          </div>
        </div>

        {/* ================================================= */}
        {/* PROBLEMS TABLE (DESKTOP) / CARDS (MOBILE)         */}
        {/* ================================================= */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[8px_8px_0_#000000] overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#071a2b] text-white border-b-3 border-black font-mono text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-14">STATUS</th>
                  <th className="py-3.5 px-3 text-center w-12">SAVE</th>
                  <th className="py-3.5 px-4">PROBLEM TITLE</th>
                  <th className="py-3.5 px-4">CATEGORY // TOPIC</th>
                  <th className="py-3.5 px-4 text-center w-28">DIFFICULTY</th>
                  <th className="py-3.5 px-4 text-center w-24">ACCURACY</th>
                  <th className="py-3.5 px-6 text-right w-32">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/15 font-body">
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="font-display font-black text-2xl uppercase mb-2">
                        NO MATCHING PROBLEMS FOUND
                      </div>
                      <p className="text-xs font-semibold text-black/60 mb-4">
                        Try resetting your search query, topic filter, or difficulty settings.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-5 py-2.5 bg-[#ffd43b] border-2 border-black rounded-lg font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] cursor-pointer"
                      >
                        RESET ALL FILTERS
                      </button>
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
                        <td className="py-4 px-4 text-center">
                          <div className="flex justify-center">
                            {isSolved ? (
                              <span className="w-6 h-6 rounded-full bg-[#32e875] border-2 border-black flex items-center justify-center font-black text-xs text-black">
                                ✓
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border-2 border-black/30" />
                            )}
                          </div>
                        </td>

                        {/* Bookmark Button */}
                        <td className="py-4 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleBookmark(e, q.id)}
                            className={`p-1.5 border-2 border-black rounded-lg transition-transform hover:scale-110 cursor-pointer ${
                              isBookmarked ? 'bg-[#ffd43b] text-black' : 'bg-white text-black/40'
                            }`}
                            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Problem'}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-black' : ''}`} />
                          </button>
                        </td>

                        {/* Title & Tags */}
                        <td className="py-4 px-4">
                          <div className="font-display font-black text-base text-black uppercase tracking-tight hover:text-[#2563eb]">
                            {q.title}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {q.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono font-bold bg-[#f1f5f9] border border-black/40 rounded px-1.5 py-0.5"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Category & Topic */}
                        <td className="py-4 px-4">
                          <div className="font-display font-black text-xs uppercase text-black">
                            {q.topic}
                          </div>
                          <div className="text-xs font-semibold text-black/60">
                            {q.category}
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-4 px-4 text-center">
                          {q.difficulty === 'easy' && (
                            <span className="bg-[#32e875] text-black border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-display font-black uppercase shadow-[1.5px_1.5px_0_#000000]">
                              EASY
                            </span>
                          )}
                          {q.difficulty === 'medium' && (
                            <span className="bg-[#ffd43b] text-black border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-display font-black uppercase shadow-[1.5px_1.5px_0_#000000]">
                              MEDIUM
                            </span>
                          )}
                          {q.difficulty === 'hard' && (
                            <span className="bg-[#ff5b5b] text-white border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-display font-black uppercase shadow-[1.5px_1.5px_0_#000000]">
                              HARD
                            </span>
                          )}
                        </td>

                        {/* Acceptance */}
                        <td className="py-4 px-4 text-center font-mono font-bold text-xs">
                          {q.acceptanceRate ?? 75}%
                        </td>

                        {/* Solve Button */}
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/questions/${q.id}`)
                            }}
                            className={`px-4 py-1.5 border-2 border-black rounded-lg font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#000000] cursor-pointer transition-transform hover:-translate-x-0.5 ${
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
          <div className="md:hidden divide-y-2 divide-black/15">
            {filteredQuestions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="font-display font-black text-xl uppercase mb-2">
                  NO MATCHES FOUND
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-[#ffd43b] border-2 border-black rounded-lg font-display font-black text-xs uppercase mt-3"
                >
                  RESET FILTERS
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
                    className="p-4 bg-white active:bg-[#f8fafc] cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isSolved ? (
                          <span className="px-2 py-0.5 bg-[#32e875] border border-black rounded-full font-display font-black text-[10px] uppercase">
                            SOLVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 border border-black rounded-full font-display font-bold text-[10px] uppercase">
                            UNSOLVED
                          </span>
                        )}

                        {q.difficulty === 'easy' && (
                          <span className="bg-[#32e875] border border-black rounded-full px-2 py-0.5 text-[9px] font-display font-black uppercase">
                            EASY
                          </span>
                        )}
                        {q.difficulty === 'medium' && (
                          <span className="bg-[#ffd43b] border border-black rounded-full px-2 py-0.5 text-[9px] font-display font-black uppercase">
                            MED
                          </span>
                        )}
                        {q.difficulty === 'hard' && (
                          <span className="bg-[#ff5b5b] text-white border border-black rounded-full px-2 py-0.5 text-[9px] font-display font-black uppercase">
                            HARD
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleBookmark(e, q.id)}
                        className={`p-1.5 border-2 border-black rounded-lg ${
                          isBookmarked ? 'bg-[#ffd43b]' : 'bg-white'
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-black' : ''}`} />
                      </button>
                    </div>

                    <h3 className="font-display font-black text-base uppercase text-black leading-tight">
                      {q.title}
                    </h3>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-black/60">
                        {q.topic}
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
