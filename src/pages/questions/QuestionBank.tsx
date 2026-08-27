import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { QuestionService } from '../../services/questionService'
import { ProfileService } from '../../services/profileService'
import type {
  Question,
  UserQuestionProgress,
  Category,
  Difficulty,
} from '../../types/questions'
import './QuestionBank.css'

export default function QuestionBank() {
  const navigate = useNavigate()

  const [userId, setUserId] = useState<string | undefined>()
  const [userProfile, setUserProfile] = useState<{
    username: string | null
    displayName: string | null
  } | null>(null)

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

  // -----------------------------------------
  // 1. Initial Load: User & Questions Data
  // -----------------------------------------
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setUserId(user.id)

          // Fetch profile using centralized service
          const profile = await ProfileService.fetchProfile(user.id)

          if (isMounted) {
            setUserProfile({
              username: profile?.username || user.user_metadata?.username || null,
              displayName: profile?.display_name || user.user_metadata?.display_name || null,
            })
          }
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

  // -----------------------------------------
  // 2. Computed Stats
  // -----------------------------------------
  const stats = useMemo(() => {
    return QuestionService.calculateStats(questions, progressMap)
  }, [questions, progressMap])

  // -----------------------------------------
  // 3. Unique Topics for Dropdown
  // -----------------------------------------
  const availableTopics = useMemo(() => {
    const relevant =
      selectedCategory === 'all'
        ? questions
        : questions.filter((q) => q.category === selectedCategory)
    const topicsSet = new Set(relevant.map((q) => q.topic))
    return Array.from(topicsSet).sort()
  }, [questions, selectedCategory])

  // -----------------------------------------
  // 4. Filtered Questions
  // -----------------------------------------
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Category filter
      if (selectedCategory !== 'all' && q.category !== selectedCategory) {
        return false
      }

      // Topic filter
      if (selectedTopic !== 'all' && q.topic !== selectedTopic) {
        return false
      }

      // Difficulty filter
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false
      }

      // Status filter
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

      // Search Query filter (matches title, prompt, topic, tags)
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

  // -----------------------------------------
  // 5. Handlers
  // -----------------------------------------
  const handleToggleBookmark = async (e: React.MouseEvent, questionId: string) => {
    e.stopPropagation()

    // Optimistic UI update
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
      <div className="min-h-screen bg-[#061a2d] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 w-12 h-12 border-4 border-white/20 border-t-[#ffd43b] rounded-full animate-spin" />
          <p className="font-black tracking-wider text-xl">LOADING QUESTION BANK...</p>
        </div>
      </div>
    )
  }

  const username =
    userProfile?.username || userProfile?.displayName || 'Aptitude Ace'

  return (
    <div className="qb-page">
      {/* Background Grid */}
      <div className="qb-bg-grid" />

      {/* Decorative Neo-brutalist Floating Shapes */}
      <div
        className="qb-floating-shape"
        style={{
          left: '20px',
          top: '120px',
          width: '40px',
          height: '40px',
          backgroundColor: '#ffd43b',
          boxShadow: '4px 4px 0 #38aef0',
          transform: 'rotate(-8deg)',
        }}
      >
        +
      </div>
      <div
        className="qb-floating-shape"
        style={{
          right: '30px',
          top: '150px',
          width: '38px',
          height: '38px',
          backgroundColor: '#38aef0',
          boxShadow: '4px 4px 0 #ffffff',
          transform: 'rotate(10deg)',
        }}
      >
        7
      </div>
      <div
        className="qb-floating-shape"
        style={{
          left: '30px',
          bottom: '80px',
          width: '40px',
          height: '40px',
          backgroundColor: '#32e875',
          boxShadow: '4px 4px 0 #ffffff',
          transform: 'rotate(-5deg)',
        }}
      >
        =
      </div>
      <div
        className="qb-floating-shape"
        style={{
          right: '30px',
          bottom: '100px',
          width: '40px',
          height: '40px',
          backgroundColor: '#ff5b5b',
          color: '#ffffff',
          boxShadow: '4px 4px 0 #ffffff',
          transform: 'rotate(8deg)',
        }}
      >
        ×
      </div>

      {/* Main Layout */}
      <div className="qb-layout">
        {/* ================================================= */}
        {/* SIDEBAR NAVIGATION                                */}
        {/* ================================================= */}
        <aside className="qb-sidebar hidden lg:flex">
          <div className="qb-logo-area">
            <div className="flex items-center gap-3">
              <div className="qb-logo-box">A</div>
              <div>
                <div className="font-black text-xl leading-tight">APTIVERSE</div>
                <div className="text-[9px] font-black tracking-[0.18em] text-black/50">
                  APTITUDE ARENA
                </div>
              </div>
            </div>
          </div>

          <nav className="px-4 space-y-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="qb-nav-btn"
            >
              <span className="text-lg">▣</span>
              DASHBOARD
            </button>

            <button
              onClick={() => navigate('/contests')}
              className="qb-nav-btn"
            >
              <span className="text-lg">◷</span>
              CONTESTS
            </button>

            <button className="qb-nav-btn active">
              <span className="text-lg">▤</span>
              <span className="flex-1">QUESTION BANK</span>
              <span className="text-[9px] bg-[#32e875] border-2 border-black px-1.5 py-0.5 shadow-[2px_2px_0_#000]">
                ACTIVE
              </span>
            </button>

            <button
              onClick={() => navigate('/leaderboard')}
              className="qb-nav-btn"
            >
              <span className="text-lg">♛</span>
              LEADERBOARD
            </button>
          </nav>

          <div className="mt-auto p-4 space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-4 border-black bg-[#e9f6ff] shadow-[4px_4px_0_#000] font-black text-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] transition-all"
            >
              ← BACK TO HOME
            </button>
          </div>
        </aside>

        {/* ================================================= */}
        {/* MAIN QUESTION BANK ARENA                          */}
        {/* ================================================= */}
        <main className="qb-main">
          {/* TOP HEADER */}
          <header className="qb-header">
            <div>
              <div className="text-xs font-black tracking-widest text-[#38aef0] uppercase">
                MODULE 2 // PRACTICE ARENA
              </div>
              <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tight">
                QUESTION BANK
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePickRandom}
                className="px-4 py-2.5 bg-[#ffd43b] border-3 border-black shadow-[3px_3px_0_#000] font-black text-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000] transition-all flex items-center gap-2"
              >
                RANDOM PROBLEM
              </button>

              <div className="px-4 py-2 bg-black text-white border-3 border-black font-black text-sm shadow-[3px_3px_0_#ffd43b] flex items-center gap-2">
                <span className="text-[#ffd43b]">PTS:</span>
                <span>{stats.totalPoints}</span>
              </div>
            </div>
          </header>

          {/* ================================================= */}
          {/* STATS OVERVIEW DECK (LeetCode Style)              */}
          {/* ================================================= */}
          <section className="qb-stats-container">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b-3 border-black">
              <div>
                <span className="font-black text-base uppercase">
                  Solved Problems Summary
                </span>
                <span className="text-xs font-bold text-black/60 ml-2">
                  (Logged in as: {username})
                </span>
              </div>
              <div className="flex items-center gap-3 font-black text-sm">
                <span className="bg-[#e9f6ff] border-2 border-black px-2.5 py-1">
                  Total Solved: {stats.solvedCount} / {stats.totalQuestions}
                </span>
                <span className="bg-[#fff3cd] border-2 border-black px-2.5 py-1">
                  Accuracy: {stats.accuracyRate}%
                </span>
              </div>
            </div>

            <div className="qb-stats-grid">
              {/* EASY STATS */}
              <div className="qb-stat-card">
                <div className="flex justify-between items-center font-black">
                  <span className="text-[#107038] text-xs uppercase tracking-wider">
                    EASY
                  </span>
                  <span className="text-sm">
                    {stats.easySolved} / {stats.easyTotal}
                  </span>
                </div>
                <div className="qb-progress-track">
                  <div
                    className="qb-progress-fill"
                    style={{
                      width: `${
                        stats.easyTotal > 0
                          ? (stats.easySolved / stats.easyTotal) * 100
                          : 0
                      }%`,
                      backgroundColor: '#32e875',
                    }}
                  />
                </div>
              </div>

              {/* MEDIUM STATS */}
              <div className="qb-stat-card">
                <div className="flex justify-between items-center font-black">
                  <span className="text-[#926002] text-xs uppercase tracking-wider">
                    MEDIUM
                  </span>
                  <span className="text-sm">
                    {stats.mediumSolved} / {stats.mediumTotal}
                  </span>
                </div>
                <div className="qb-progress-track">
                  <div
                    className="qb-progress-fill"
                    style={{
                      width: `${
                        stats.mediumTotal > 0
                          ? (stats.mediumSolved / stats.mediumTotal) * 100
                          : 0
                      }%`,
                      backgroundColor: '#ffd43b',
                    }}
                  />
                </div>
              </div>

              {/* HARD STATS */}
              <div className="qb-stat-card">
                <div className="flex justify-between items-center font-black">
                  <span className="text-[#b91c1c] text-xs uppercase tracking-wider">
                    HARD
                  </span>
                  <span className="text-sm">
                    {stats.hardSolved} / {stats.hardTotal}
                  </span>
                </div>
                <div className="qb-progress-track">
                  <div
                    className="qb-progress-fill"
                    style={{
                      width: `${
                        stats.hardTotal > 0
                          ? (stats.hardSolved / stats.hardTotal) * 100
                          : 0
                      }%`,
                      backgroundColor: '#ff5b5b',
                    }}
                  />
                </div>
              </div>

              {/* BOOKMARKS SHORTCUT */}
              <div
                onClick={() =>
                  setSelectedStatus(
                    selectedStatus === 'bookmarked' ? 'all' : 'bookmarked'
                  )
                }
                className="qb-stat-card cursor-pointer hover:bg-[#fffde7] transition-colors"
              >
                <div className="flex justify-between items-center font-black">
                  <span className="text-amber-800 text-xs uppercase tracking-wider flex items-center gap-1">
                    SAVED REVISION
                  </span>
                  <span className="text-sm">{stats.bookmarkedCount} items</span>
                </div>
                <div className="text-[11px] font-bold text-black/60 mt-2">
                  {selectedStatus === 'bookmarked'
                    ? 'Click to show all'
                    : 'Click to filter bookmarked'}
                </div>
              </div>
            </div>
          </section>

          {/* ================================================= */}
          {/* CATEGORY TABS                                     */}
          {/* ================================================= */}
          <div className="qb-category-tabs">
            <button
              onClick={() => {
                setSelectedCategory('all')
                setSelectedTopic('all')
              }}
              className={`qb-cat-tab ${
                selectedCategory === 'all' ? 'active' : ''
              }`}
            >
              ALL CATEGORIES
            </button>

            <button
              onClick={() => {
                setSelectedCategory('Quantitative Aptitude')
                setSelectedTopic('all')
              }}
              className={`qb-cat-tab ${
                selectedCategory === 'Quantitative Aptitude' ? 'active' : ''
              }`}
            >
              QUANTITATIVE APTITUDE
            </button>

            <button
              onClick={() => {
                setSelectedCategory('Logical Reasoning')
                setSelectedTopic('all')
              }}
              className={`qb-cat-tab ${
                selectedCategory === 'Logical Reasoning' ? 'active' : ''
              }`}
            >
              LOGICAL REASONING
            </button>

            <button
              onClick={() => {
                setSelectedCategory('Data Interpretation')
                setSelectedTopic('all')
              }}
              className={`qb-cat-tab ${
                selectedCategory === 'Data Interpretation' ? 'active' : ''
              }`}
            >
              DATA INTERPRETATION
            </button>

            <button
              onClick={() => {
                setSelectedCategory('Verbal & Abstract')
                setSelectedTopic('all')
              }}
              className={`qb-cat-tab ${
                selectedCategory === 'Verbal & Abstract' ? 'active' : ''
              }`}
            >
              VERBAL & ABSTRACT
            </button>
          </div>

          {/* ================================================= */}
          {/* FILTER BAR                                        */}
          {/* ================================================= */}
          <div className="qb-filter-bar">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by problem title, topic, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="qb-search-input"
            />

            {/* Topic Sub-filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="font-black text-xs uppercase">Topic:</span>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="px-3 py-2 border-3 border-black font-bold text-sm bg-white shadow-[2px_2px_0_#000] outline-none cursor-pointer"
              >
                <option value="all">All Topics ({availableTopics.length})</option>
                {availableTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Chips */}
            <div className="qb-chip-group">
              <span className="font-black text-xs uppercase">Difficulty:</span>
              <button
                onClick={() => setSelectedDifficulty('all')}
                className={`qb-filter-chip ${
                  selectedDifficulty === 'all' ? 'active' : ''
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setSelectedDifficulty('easy')}
                className={`qb-filter-chip ${
                  selectedDifficulty === 'easy' ? 'active' : ''
                }`}
                style={
                  selectedDifficulty === 'easy'
                    ? { backgroundColor: '#32e875', color: '#000' }
                    : {}
                }
              >
                EASY
              </button>
              <button
                onClick={() => setSelectedDifficulty('medium')}
                className={`qb-filter-chip ${
                  selectedDifficulty === 'medium' ? 'active' : ''
                }`}
                style={
                  selectedDifficulty === 'medium'
                    ? { backgroundColor: '#ffd43b', color: '#000' }
                    : {}
                }
              >
                MEDIUM
              </button>
              <button
                onClick={() => setSelectedDifficulty('hard')}
                className={`qb-filter-chip ${
                  selectedDifficulty === 'hard' ? 'active' : ''
                }`}
                style={
                  selectedDifficulty === 'hard'
                    ? { backgroundColor: '#ff5b5b', color: '#fff' }
                    : {}
                }
              >
                HARD
              </button>
            </div>

            {/* Status Chips */}
            <div className="qb-chip-group">
              <span className="font-black text-xs uppercase">Status:</span>
              <button
                onClick={() => setSelectedStatus('all')}
                className={`qb-filter-chip ${
                  selectedStatus === 'all' ? 'active' : ''
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setSelectedStatus('unsolved')}
                className={`qb-filter-chip ${
                  selectedStatus === 'unsolved' ? 'active' : ''
                }`}
              >
                UNSOLVED
              </button>
              <button
                onClick={() => setSelectedStatus('solved')}
                className={`qb-filter-chip ${
                  selectedStatus === 'solved' ? 'active' : ''
                }`}
              >
                SOLVED
              </button>
              <button
                onClick={() => setSelectedStatus('bookmarked')}
                className={`qb-filter-chip ${
                  selectedStatus === 'bookmarked' ? 'active' : ''
                }`}
              >
                BOOKMARKED
              </button>
            </div>
          </div>

          {/* ================================================= */}
          {/* QUESTIONS LIST TABLE                              */}
          {/* ================================================= */}
          <div className="qb-table-wrapper">
            <table className="qb-table">
              <thead>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>SAVED</th>
                  <th>PROBLEM TITLE</th>
                  <th>TOPIC / CATEGORY</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>
                    DIFFICULTY
                  </th>
                  <th style={{ width: '100px', textAlign: 'center' }}>
                    ACCURACY
                  </th>
                  <th style={{ width: '130px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="qb-empty-state">
                        <div className="text-2xl font-black mb-2">[ NO MATCHES ]</div>
                        <h3 className="font-black text-xl uppercase mb-2">
                          No matching problems found
                        </h3>
                        <p className="font-bold text-black/60 mb-5">
                          Try adjusting your search query, topic filter, or
                          difficulty selection.
                        </p>
                        <button
                          onClick={handleResetFilters}
                          className="px-5 py-2.5 bg-[#ffd43b] border-3 border-black font-black text-sm shadow-[3px_3px_0_#000]"
                        >
                          RESET ALL FILTERS
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
                        className="cursor-pointer"
                      >
                        {/* Status Checkmark */}
                        <td style={{ textAlign: 'center' }}>
                          <div className="flex justify-center">
                            {isSolved ? (
                              <div
                                className="qb-status-solved"
                                title="Solved!"
                              >
                                ✓
                              </div>
                            ) : (
                              <div
                                className="qb-status-unsolved"
                                title="Not solved yet"
                              />
                            )}
                          </div>
                        </td>

                        {/* Bookmark Star */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => handleToggleBookmark(e, q.id)}
                            className={`qb-star-btn ${
                              isBookmarked ? 'bookmarked' : 'unbookmarked'
                            }`}
                            title={
                              isBookmarked
                                ? 'Remove from Saved'
                                : 'Save for Revision'
                            }
                          >
                            {isBookmarked ? '[SAVED]' : '[+]'}
                          </button>
                        </td>

                        {/* Title & Tags */}
                        <td>
                          <div className="font-black text-base text-[#071a2b] hover:text-[#2563eb] transition-colors">
                            {q.title}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {q.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] bg-[#f1f5f9] border border-black px-1.5 py-0.5 font-bold"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Topic & Category */}
                        <td>
                          <div className="font-black text-xs text-black">
                            {q.topic}
                          </div>
                          <div className="text-[11px] font-bold text-black/60">
                            {q.category}
                          </div>
                        </td>

                        {/* Difficulty Badge */}
                        <td style={{ textAlign: 'center' }}>
                          {q.difficulty === 'easy' && (
                            <span className="qb-badge-easy">EASY</span>
                          )}
                          {q.difficulty === 'medium' && (
                            <span className="qb-badge-medium">MEDIUM</span>
                          )}
                          {q.difficulty === 'hard' && (
                            <span className="qb-badge-hard">HARD</span>
                          )}
                        </td>

                        {/* Acceptance / Accuracy */}
                        <td style={{ textAlign: 'center' }}>
                          <span className="font-black text-xs">
                            {q.acceptanceRate ?? 75}%
                          </span>
                        </td>

                        {/* Action Button */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/questions/${q.id}`)
                            }}
                            className={`qb-solve-btn ${isSolved ? 'review' : ''}`}
                          >
                            {isSolved ? 'REVIEW' : 'SOLVE'} →
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Count */}
          <div className="mt-4 text-xs font-black text-white/80 flex justify-between items-center px-1">
            <span>
              Showing {filteredQuestions.length} of {questions.length} problems
            </span>
            <span className="text-black bg-[#ffd43b] px-2 py-0.5 border border-black font-black">
              NEO-BRUTALIST APTITUDE ENGINE
            </span>
          </div>
        </main>
      </div>
    </div>
  )
}
