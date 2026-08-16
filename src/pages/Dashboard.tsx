import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Profile = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

function Dashboard() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  // -----------------------------------------
  // Load current user + profile
  // -----------------------------------------

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          navigate('/login', {
            replace: true,
          })

          return
        }

        const {
          data,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            'username, display_name, avatar_url'
          )
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          console.error(
            'Profile loading error:',
            profileError
          )

          return
        }

        setProfile(data)
      } catch (error) {
        console.error(
          'Dashboard loading error:',
          error
        )
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [navigate])

  // -----------------------------------------
  // Logout
  // -----------------------------------------

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      const { error } =
        await supabase.auth.signOut()

      if (error) {
        console.error(
          'Logout error:',
          error
        )

        setLoggingOut(false)

        return
      }

      navigate('/login', {
        replace: true,
      })
    } catch (error) {
      console.error(
        'Unexpected logout error:',
        error
      )

      setLoggingOut(false)
    }
  }

  // -----------------------------------------
  // Loading
  // -----------------------------------------

  if (loading) {
    return (
      <div className="
        min-h-screen
        bg-[#061a2d]
        flex
        items-center
        justify-center
        text-white
      ">
        <div className="text-center">
          <div className="
            mx-auto
            mb-5
            w-12
            h-12
            border-4
            border-white/20
            border-t-[#ffd43b]
            rounded-full
            animate-spin
          " />

          <p className="
            font-black
            tracking-wider
          ">
            LOADING APTICKS...
          </p>
        </div>
      </div>
    )
  }

  const username =
    profile?.username ||
    profile?.display_name ||
    'player'

  const displayName =
    profile?.display_name ||
    username

  const firstLetter =
    username.charAt(0).toUpperCase()

  return (
    <div className="
      min-h-screen
      bg-[#061a2d]
      text-black
      relative
      overflow-hidden
    ">

      {/* ===================================== */}
      {/* BACKGROUND GRID                       */}
      {/* ===================================== */}

      <div
        className="
          fixed
          inset-0
          pointer-events-none
          opacity-30
        "
        style={{
          backgroundImage: `
            linear-gradient(#16344d 1px, transparent 1px),
            linear-gradient(90deg, #16344d 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      {/* ===================================== */}
      {/* DECORATIVE SHAPES                     */}
      {/* ===================================== */}

      <div className="
        fixed
        left-5
        top-32
        w-10
        h-10
        bg-[#ffd43b]
        border-4
        border-black
        shadow-[4px_4px_0_#38aef0]
        rotate-[-8deg]
        flex
        items-center
        justify-center
        font-black
        text-xl
        pointer-events-none
      ">
        +
      </div>

      <div className="
        fixed
        right-8
        top-36
        w-9
        h-9
        bg-[#38aef0]
        border-4
        border-black
        shadow-[4px_4px_0_#fff]
        rotate-[8deg]
        flex
        items-center
        justify-center
        font-black
        pointer-events-none
      ">
        7
      </div>

      <div className="
        fixed
        left-8
        bottom-24
        w-10
        h-10
        bg-[#32e875]
        border-4
        border-black
        shadow-[4px_4px_0_#fff]
        rotate-[-5deg]
        flex
        items-center
        justify-center
        font-black
        pointer-events-none
      ">
        =
      </div>

      <div className="
        fixed
        right-8
        bottom-28
        w-10
        h-10
        bg-[#ff5b5b]
        border-4
        border-black
        shadow-[4px_4px_0_#fff]
        rotate-[8deg]
        flex
        items-center
        justify-center
        font-black
        text-xl
        pointer-events-none
      ">
        ×
      </div>

      {/* ===================================== */}
      {/* MAIN LAYOUT                            */}
      {/* ===================================== */}

      <div className="
        relative
        z-10
        min-h-screen
        flex
      ">

        {/* ================================= */}
        {/* SIDEBAR                           */}
        {/* ================================= */}

        <aside className="
          hidden
          lg:flex
          w-[250px]
          shrink-0
          min-h-screen
          bg-white
          border-r-4
          border-black
          flex-col
        ">

          {/* Logo */}

          <div className="p-6">
            <div className="flex items-center gap-3">

              <div className="
                w-11
                h-11
                bg-[#ffd43b]
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                flex
                items-center
                justify-center
                font-black
                text-2xl
              ">
                A
              </div>

              <div>
                <div className="font-black text-xl">
                  APTICKS
                </div>

                <div className="
                  text-[9px]
                  font-black
                  tracking-[0.18em]
                  text-black/50
                ">
                  APTITUDE ARENA
                </div>
              </div>

            </div>
          </div>

          {/* Navigation */}

          <nav className="px-4 space-y-2">

            {/* Dashboard */}

            <button
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                bg-[#ffd43b]
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                font-black
                text-sm
                text-left
              "
            >
              <span className="text-lg">
                ▣
              </span>

              DASHBOARD
            </button>

            {/* Contests */}

            <button
              onClick={() =>
                navigate('/contests')
              }
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                border-4
                border-transparent
                hover:border-black
                hover:bg-[#e9f6ff]
                font-black
                text-sm
                text-left
                transition-all
              "
            >
              <span className="text-lg">
                ◷
              </span>

              CONTESTS
            </button>

            {/* Question Bank */}

            <button
              type="button"
              disabled
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                border-4
                border-transparent
                hover:border-black
                hover:bg-[#e9f6ff]
                font-black
                text-sm
                text-left
                opacity-90
                cursor-not-allowed
              "
            >
              <span className="text-lg">
                ▤
              </span>

              <span className="flex-1">
                QUESTION BANK
              </span>

              <span className="
                text-[8px]
                bg-[#38aef0]
                border-2
                border-black
                px-1.5
                py-1
                shadow-[2px_2px_0_#000]
              ">
                SOON
              </span>
            </button>

            {/* Leaderboard */}

            <button
              onClick={() =>
                navigate('/leaderboard')
              }
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                border-4
                border-transparent
                hover:border-black
                hover:bg-[#e9f6ff]
                font-black
                text-sm
                text-left
                transition-all
              "
            >
              <span className="text-lg">
                ♛
              </span>

              LEADERBOARD
            </button>

            {/* Friends */}

            <button
              onClick={() =>
                navigate('/friends')
              }
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                border-4
                border-transparent
                hover:border-black
                hover:bg-[#e9f6ff]
                font-black
                text-sm
                text-left
                transition-all
              "
            >
              <span className="text-lg">
                ◎
              </span>

              FRIENDS
            </button>

          </nav>

          {/* Bottom */}

          <div className="
            mt-auto
            p-4
            space-y-3
          ">

            <button
              onClick={() =>
                navigate('/profile')
              }
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                border-4
                border-black
                bg-[#e9f6ff]
                shadow-[4px_4px_0_#000]
                font-black
                text-sm
                text-left
                hover:translate-x-[2px]
                hover:translate-y-[2px]
                hover:shadow-[2px_2px_0_#000]
                transition-all
              "
            >
              <span>●</span>

              PROFILE
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="
                w-full
                flex
                items-center
                gap-3
                px-4
                py-3
                border-4
                border-black
                bg-[#ff5b5b]
                shadow-[4px_4px_0_#000]
                font-black
                text-sm
                disabled:opacity-50
                hover:translate-x-[2px]
                hover:translate-y-[2px]
                hover:shadow-[2px_2px_0_#000]
                transition-all
              "
            >
              <span>
                ↪
              </span>

              {loggingOut
                ? 'LOGGING OUT...'
                : 'LOG OUT'}
            </button>

          </div>

        </aside>

        {/* ================================= */}
        {/* CONTENT                            */}
        {/* ================================= */}

        <main className="
          w-full
          min-w-0
          px-4
          py-5
          sm:px-6
          lg:px-8
          xl:px-10
        ">

          {/* ================================= */}
          {/* TOP BAR                           */}
          {/* ================================= */}

          <header className="
            bg-white
            border-4
            border-black
            shadow-[6px_6px_0_#38aef0]
            px-5
            py-4
            flex
            items-center
            justify-between
            gap-4
          ">

            <div>
              <p className="
                text-[10px]
                font-black
                tracking-[0.18em]
                text-black/50
              ">
                APTICKS / DASHBOARD
              </p>

              <h1 className="
                font-black
                text-lg
                sm:text-xl
              ">
                YOUR ARENA
              </h1>
            </div>

            <button
              onClick={() =>
                navigate('/profile')
              }
              className="
                w-11
                h-11
                shrink-0
                bg-[#ffd43b]
                border-4
                border-black
                shadow-[3px_3px_0_#000]
                flex
                items-center
                justify-center
                font-black
                text-lg
              "
            >
              {firstLetter}
            </button>

          </header>

          {/* ================================= */}
          {/* MOBILE NAV                         */}
          {/* ================================= */}

          <div className="
            lg:hidden
            mt-5
            grid
            grid-cols-2
            sm:grid-cols-3
            gap-3
          ">

            <button
              className="
                bg-[#ffd43b]
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                px-3
                py-3
                font-black
                text-xs
              "
            >
              ▣ DASHBOARD
            </button>

            <button
              onClick={() =>
                navigate('/contests')
              }
              className="
                bg-white
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                px-3
                py-3
                font-black
                text-xs
              "
            >
              ◷ CONTESTS
            </button>

            <button
              disabled
              className="
                bg-[#38aef0]
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                px-3
                py-3
                font-black
                text-xs
                opacity-70
              "
            >
              ▤ QUESTIONS
            </button>

            <button
              onClick={() =>
                navigate('/leaderboard')
              }
              className="
                bg-white
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                px-3
                py-3
                font-black
                text-xs
              "
            >
              ♛ RANKING
            </button>

            <button
              onClick={() =>
                navigate('/friends')
              }
              className="
                bg-white
                border-4
                border-black
                shadow-[4px_4px_0_#000]
                px-3
                py-3
                font-black
                text-xs
              "
            >
              ◎ FRIENDS
            </button>

          </div>

          {/* ================================= */}
          {/* COMPACT WELCOME                   */}
          {/* ================================= */}

          <section className="
            mt-6
            bg-white
            border-4
            border-black
            shadow-[7px_7px_0_#38aef0]
            p-5
            sm:p-6
            relative
            overflow-hidden
          ">

            <div className="
              flex
              flex-col
              lg:flex-row
              lg:items-center
              lg:justify-between
              gap-5
            ">

              <div>

                <div className="
                  inline-flex
                  items-center
                  gap-2
                  bg-[#38aef0]
                  border-4
                  border-black
                  shadow-[3px_3px_0_#000]
                  px-3
                  py-1.5
                  text-[9px]
                  font-black
                  tracking-[0.15em]
                ">
                  <span>
                    ●
                  </span>

                  PLAYER ONLINE
                </div>

                <h2 className="
                  mt-4
                  text-3xl
                  sm:text-4xl
                  font-black
                  leading-none
                  tracking-[-0.04em]
                ">
                  WELCOME BACK,
                  <span className="text-[#168bd1]">
                    {' '}@{username}
                  </span>
                </h2>

                <p className="
                  mt-3
                  text-sm
                  font-semibold
                  text-black/60
                ">
                  Ready to solve, compete and climb?
                </p>

              </div>

              <div className="
                flex
                flex-wrap
                gap-3
              ">

                <button
                  onClick={() =>
                    navigate('/contests')
                  }
                  className="
                    bg-[#ffd43b]
                    border-4
                    border-black
                    shadow-[4px_4px_0_#000]
                    px-5
                    py-3
                    font-black
                    text-sm
                    hover:translate-x-[2px]
                    hover:translate-y-[2px]
                    hover:shadow-[2px_2px_0_#000]
                    active:translate-x-[4px]
                    active:translate-y-[4px]
                    active:shadow-none
                    transition-all
                  "
                >
                  FIND A CONTEST →
                </button>

                <button
                  type="button"
                  disabled
                  className="
                    bg-[#38aef0]
                    border-4
                    border-black
                    shadow-[4px_4px_0_#000]
                    px-5
                    py-3
                    font-black
                    text-sm
                    opacity-60
                    cursor-not-allowed
                  "
                >
                  PRACTICE QUESTIONS
                </button>

              </div>

            </div>

          </section>

          {/* ================================= */}
          {/* STATS                              */}
          {/* ================================= */}

          <section className="
            mt-6
            grid
            grid-cols-2
            xl:grid-cols-4
            gap-4
          ">

            <div className="
              bg-white
              border-4
              border-black
              shadow-[5px_5px_0_#000]
              p-4
            ">
              <p className="
                text-[9px]
                font-black
                text-black/50
                tracking-wider
              ">
                CONTESTS PLAYED
              </p>

              <p className="
                mt-1
                text-3xl
                font-black
              ">
                0
              </p>
            </div>

            <div className="
              bg-[#ffd43b]
              border-4
              border-black
              shadow-[5px_5px_0_#000]
              p-4
            ">
              <p className="
                text-[9px]
                font-black
                tracking-wider
              ">
                TOTAL SCORE
              </p>

              <p className="
                mt-1
                text-3xl
                font-black
              ">
                0
              </p>
            </div>

            <div className="
              bg-[#38aef0]
              border-4
              border-black
              shadow-[5px_5px_0_#000]
              p-4
            ">
              <p className="
                text-[9px]
                font-black
                tracking-wider
              ">
                CURRENT RANK
              </p>

              <p className="
                mt-1
                text-3xl
                font-black
              ">
                —
              </p>
            </div>

            <div className="
              bg-[#32e875]
              border-4
              border-black
              shadow-[5px_5px_0_#000]
              p-4
            ">
              <p className="
                text-[9px]
                font-black
                tracking-wider
              ">
                WIN RATE
              </p>

              <p className="
                mt-1
                text-3xl
                font-black
              ">
                0%
              </p>
            </div>

          </section>

          {/* ================================= */}
          {/* MAIN DASHBOARD GRID                */}
          {/* ================================= */}

          <section className="
            mt-6
            grid
            lg:grid-cols-[1.5fr_1fr]
            gap-5
          ">

            {/* ================================= */}
            {/* QUESTION BANK PREVIEW              */}
            {/* ================================= */}

            <div className="
              bg-white
              border-4
              border-black
              shadow-[6px_6px_0_#38aef0]
            ">

              <div className="
                px-5
                py-4
                border-b-4
                border-black
                flex
                items-center
                justify-between
                gap-3
              ">

                <div>
                  <p className="
                    text-[9px]
                    font-black
                    tracking-[0.15em]
                    text-black/50
                  ">
                    PRACTICE
                  </p>

                  <h3 className="
                    font-black
                    text-lg
                  ">
                    QUESTION BANK
                  </h3>
                </div>

                <span className="
                  bg-[#38aef0]
                  border-2
                  border-black
                  shadow-[2px_2px_0_#000]
                  px-2
                  py-1
                  text-[8px]
                  font-black
                ">
                  COMING SOON
                </span>

              </div>

              <div className="p-5">

                <div className="
                  grid
                  sm:grid-cols-2
                  gap-4
                ">

                  <div className="
                    border-4
                    border-black
                    bg-[#fff8d6]
                    p-5
                  ">
                    <div className="
                      text-3xl
                      font-black
                    ">
                      0
                    </div>

                    <p className="
                      mt-1
                      font-black
                      text-sm
                    ">
                      QUESTIONS SOLVED
                    </p>

                    <p className="
                      mt-1
                      text-xs
                      text-black/50
                      font-semibold
                    ">
                      Start building your practice history.
                    </p>
                  </div>

                  <div className="
                    border-4
                    border-black
                    bg-[#e9f6ff]
                    p-5
                  ">
                    <div className="
                      text-3xl
                      font-black
                    ">
                      0%
                    </div>

                    <p className="
                      mt-1
                      font-black
                      text-sm
                    ">
                      ACCURACY
                    </p>

                    <p className="
                      mt-1
                      text-xs
                      text-black/50
                      font-semibold
                    ">
                      Your performance will appear here.
                    </p>
                  </div>

                </div>

                <div className="
                  mt-4
                  border-4
                  border-dashed
                  border-black/30
                  p-6
                  text-center
                ">

                  <div className="
                    text-3xl
                    font-black
                  ">
                    ▤
                  </div>

                  <p className="
                    mt-2
                    font-black
                  ">
                    QUESTION BANK IS NEXT
                  </p>

                  <p className="
                    mt-1
                    text-xs
                    font-semibold
                    text-black/50
                  ">
                    Quantitative • Logical • Verbal • Technical
                  </p>

                </div>

              </div>

            </div>

            {/* ================================= */}
            {/* DAILY CHALLENGE                   */}
            {/* ================================= */}

            <div className="
              bg-[#ffd43b]
              border-4
              border-black
              shadow-[6px_6px_0_#000]
            ">

              <div className="
                px-5
                py-4
                border-b-4
                border-black
              ">

                <p className="
                  text-[9px]
                  font-black
                  tracking-[0.15em]
                ">
                  DAILY
                </p>

                <h3 className="
                  font-black
                  text-lg
                ">
                  CHALLENGE
                </h3>

              </div>

              <div className="p-5">

                <div className="
                  bg-white
                  border-4
                  border-black
                  p-5
                  shadow-[4px_4px_0_#000]
                ">

                  <div className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  ">

                    <span className="
                      bg-[#38aef0]
                      border-2
                      border-black
                      px-2
                      py-1
                      text-[8px]
                      font-black
                    ">
                      LOCKED
                    </span>

                    <span className="
                      text-xs
                      font-black
                    ">
                      +XP
                    </span>

                  </div>

                  <h4 className="
                    mt-5
                    text-xl
                    font-black
                  ">
                    READY TO TEST YOUR SKILLS?
                  </h4>

                  <p className="
                    mt-2
                    text-xs
                    font-semibold
                    text-black/60
                  ">
                    Daily aptitude challenges will
                    appear here once the question
                    system is connected.
                  </p>

                  <button
                    type="button"
                    disabled
                    className="
                      mt-5
                      w-full
                      bg-black
                      text-white
                      border-4
                      border-black
                      px-4
                      py-3
                      font-black
                      text-sm
                      opacity-60
                    "
                  >
                    START CHALLENGE →
                  </button>

                </div>

              </div>

            </div>

          </section>

          {/* ================================= */}
          {/* LOWER GRID                         */}
          {/* ================================= */}

          <section className="
            mt-6
            grid
            lg:grid-cols-[1.5fr_1fr]
            gap-5
          ">

            {/* Upcoming contests */}

            <div className="
              bg-white
              border-4
              border-black
              shadow-[6px_6px_0_#38aef0]
            ">

              <div className="
                px-5
                py-4
                border-b-4
                border-black
                flex
                items-center
                justify-between
              ">

                <h3 className="
                  font-black
                  text-lg
                ">
                  UPCOMING CONTESTS
                </h3>

                <span className="
                  bg-[#ffd43b]
                  border-2
                  border-black
                  px-2
                  py-1
                  text-[9px]
                  font-black
                ">
                  SOON
                </span>

              </div>

              <div className="p-5">

                <div className="
                  border-4
                  border-dashed
                  border-black/30
                  p-8
                  text-center
                ">

                  <div className="
                    text-4xl
                    font-black
                  ">
                    ◷
                  </div>

                  <p className="
                    mt-3
                    font-black
                  ">
                    NO CONTESTS YET
                  </p>

                  <p className="
                    mt-2
                    text-xs
                    font-semibold
                    text-black/50
                  ">
                    New aptitude contests will
                    appear here.
                  </p>

                </div>

              </div>

            </div>

            {/* Quick actions */}

            <div className="
              bg-white
              border-4
              border-black
              shadow-[6px_6px_0_#000]
            ">

              <div className="
                px-5
                py-4
                border-b-4
                border-black
              ">
                <h3 className="
                  font-black
                  text-lg
                ">
                  QUICK ACTIONS
                </h3>
              </div>

              <div className="
                p-5
                space-y-3
              ">

                <button
                  onClick={() =>
                    navigate('/contests')
                  }
                  className="
                    w-full
                    text-left
                    bg-[#ffd43b]
                    border-4
                    border-black
                    shadow-[4px_4px_0_#000]
                    p-4
                    font-black
                    text-sm
                    hover:translate-x-[2px]
                    hover:translate-y-[2px]
                    hover:shadow-[2px_2px_0_#000]
                    transition-all
                  "
                >
                  ⚡ JOIN A CONTEST
                </button>

                <button
                  type="button"
                  disabled
                  className="
                    w-full
                    text-left
                    bg-[#e9f6ff]
                    border-4
                    border-black
                    shadow-[4px_4px_0_#000]
                    p-4
                    font-black
                    text-sm
                    opacity-60
                  "
                >
                  ▤ PRACTICE QUESTIONS
                </button>

                <button
                  onClick={() =>
                    navigate('/leaderboard')
                  }
                  className="
                    w-full
                    text-left
                    bg-[#38aef0]
                    border-4
                    border-black
                    shadow-[4px_4px_0_#000]
                    p-4
                    font-black
                    text-sm
                    hover:translate-x-[2px]
                    hover:translate-y-[2px]
                    hover:shadow-[2px_2px_0_#000]
                    transition-all
                  "
                >
                  ♛ VIEW LEADERBOARD
                </button>

                <button
                  onClick={() =>
                    navigate('/profile')
                  }
                  className="
                    w-full
                    text-left
                    bg-[#32e875]
                    border-4
                    border-black
                    shadow-[4px_4px_0_#000]
                    p-4
                    font-black
                    text-sm
                    hover:translate-x-[2px]
                    hover:translate-y-[2px]
                    hover:shadow-[2px_2px_0_#000]
                    transition-all
                  "
                >
                  ● EDIT PROFILE
                </button>

              </div>

            </div>

          </section>

          {/* ================================= */}
          {/* FOOTER                             */}
          {/* ================================= */}

          <footer className="
            mt-8
            pb-8
            text-center
            text-[10px]
            font-black
            tracking-[0.15em]
            text-white/40
          ">
            APTICKS • THINK FAST • PLAY SMART
          </footer>

        </main>

      </div>
    </div>
  )
}

export default Dashboard