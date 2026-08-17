import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'


function ChooseUsername() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {

    event.preventDefault()

    setError('')
    setSuccess('')

    const cleanUsername = username.trim().toLowerCase()


    // -----------------------------------------
    // Validate username
    // -----------------------------------------

    if (!cleanUsername) {
      setError('Please choose a username.')
      return
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setError(
        'Username can only contain letters, numbers, dots, hyphens and underscores.'
      )
      return
    }

    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    if (cleanUsername.length > 30) {
      setError('Username must be 30 characters or less.')
      return
    }


    setLoading(true)


    try {

      // -----------------------------------------
      // Get authenticated user
      // -----------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()


      if (userError || !user) {

        setError(
          'Your session has expired. Please login again.'
        )

        navigate('/login', {
          replace: true,
        })

        return
      }


      // -----------------------------------------
      // Check username availability
      // -----------------------------------------

      const {
        data: existingProfile,
        error: usernameError,
      } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle()


      if (usernameError) {

        console.error(
          'Username check error:',
          usernameError
        )

        setError(
          'Unable to check username. Please try again.'
        )

        return
      }


      if (
        existingProfile &&
        existingProfile.id !== user.id
      ) {

        setError('Username is already taken.')

        return
      }


      // -----------------------------------------
      // Check current profile
      // -----------------------------------------

      const {
        data: currentProfile,
        error: currentProfileError,
      } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()


      if (currentProfileError) {

        console.error(
          'Current profile lookup error:',
          currentProfileError
        )

        setError(
          'Unable to load your profile. Please try again.'
        )

        return
      }


      // -----------------------------------------
      // Update existing profile
      // -----------------------------------------

      if (currentProfile) {

        const {
          error: updateError,
        } = await supabase
          .from('profiles')
          .update({
            username: cleanUsername,
            display_name: cleanUsername,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)


        if (updateError) {

          console.error(
            'Profile update error:',
            updateError
          )

          if (updateError.code === '23505') {
            setError('Username is already taken.')
          } else {
            setError(
              'Unable to save username. Please try again.'
            )
          }

          return
        }

      } else {

        // -----------------------------------------
        // Create profile
        // -----------------------------------------

        const {
          error: insertError,
        } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: cleanUsername,
            display_name: cleanUsername,
          })


        if (insertError) {

          console.error(
            'Profile creation error:',
            insertError
          )

          if (insertError.code === '23505') {
            setError('Username is already taken.')
          } else {
            setError(
              'Unable to create your profile. Please try again.'
            )
          }

          return
        }
      }


      // -----------------------------------------
      // Success
      // -----------------------------------------

      setSuccess('Username saved!')


      setTimeout(() => {

        navigate('/dashboard', {
          replace: true,
        })

      }, 500)


    } catch (error) {

      console.error(
        'Choose username error:',
        error
      )

      setError(
        'Something went wrong. Please try again.'
      )

    } finally {

      setLoading(false)

    }
  }


  return (

    <div className="relative min-h-screen bg-[#071a2b] overflow-hidden flex items-center justify-center px-6 py-12">

      {/* =========================================
          DECORATIVE FLOATING SHAPES
      ========================================= */}

      {/* Yellow plus */}

      <div
        className="
          absolute
          top-[28%]
          left-[7%]
          w-12
          h-12
          bg-[#ffd43b]
          border-4
          border-black
          shadow-[5px_5px_0_#ffffff]
          rotate-[-8deg]
          flex
          items-center
          justify-center
          text-black
          font-black
          text-2xl
        "
      >
        +
      </div>


      {/* Blue number */}

      <div
        className="
          absolute
          top-[22%]
          right-[7%]
          w-11
          h-11
          bg-[#38aef0]
          border-4
          border-black
          shadow-[5px_5px_0_#ffffff]
          rotate-[8deg]
          flex
          items-center
          justify-center
          text-black
          font-black
          text-xl
        "
      >
        7
      </div>


      {/* Green equals */}

      <div
        className="
          absolute
          bottom-[20%]
          left-[9%]
          w-12
          h-12
          bg-[#35d98b]
          border-4
          border-black
          shadow-[5px_5px_0_#ffffff]
          rotate-[-5deg]
          flex
          items-center
          justify-center
          text-black
          font-black
          text-xl
        "
      >
        =
      </div>


      {/* Red X */}

      <div
        className="
          absolute
          bottom-[25%]
          right-[8%]
          w-12
          h-12
          bg-[#ff5c5c]
          border-4
          border-black
          shadow-[5px_5px_0_#ffffff]
          rotate-[8deg]
          flex
          items-center
          justify-center
          text-black
          font-black
          text-xl
        "
      >
        ×
      </div>


      {/* =========================================
          MAIN CARD
      ========================================= */}

      <div
        className="
          relative
          z-10
          w-full
          max-w-[590px]
          bg-white
          text-black
          border-[4px]
          border-black
          shadow-[12px_12px_0_#38aef0]
          p-8
          md:p-12
        "
      >

        {/* =========================================
            BRAND
        ========================================= */}

        <div className="flex items-center gap-3 mb-8">

          <div
            className="
              w-12
              h-12
              bg-[#ffd43b]
              border-[4px]
              border-black
              shadow-[4px_4px_0_#000]
              flex
              items-center
              justify-center
              font-black
              text-2xl
            "
          >
            A
          </div>

          <span className="text-2xl font-black tracking-tight">
            APTIVERSE
          </span>

        </div>


        {/* =========================================
            SMALL LABEL
        ========================================= */}

        <div
          className="
            inline-block
            bg-[#38aef0]
            border-[3px]
            border-black
            shadow-[4px_4px_0_#000]
            px-4
            py-2
            text-xs
            font-black
            tracking-[0.12em]
            mb-7
          "
        >
          PROFILE SETUP
        </div>


        {/* =========================================
            HEADING
        ========================================= */}

        <h1
          className="
            text-5xl
            md:text-6xl
            font-black
            leading-[0.88]
            tracking-[-0.04em]
            uppercase
          "
        >
          CHOOSE
          <br />
          YOUR
          <br />
          USERNAME
        </h1>


        <p
          className="
            mt-7
            text-base
            md:text-lg
            font-semibold
            leading-relaxed
            text-black/75
            max-w-[480px]
          "
        >
          Pick a unique username to complete your AptiVerse profile.
        </p>


        {/* =========================================
            FORM
        ========================================= */}

        <form
          onSubmit={handleSubmit}
          className="mt-9"
        >

          <label
            htmlFor="username"
            className="
              block
              mb-3
              text-sm
              font-black
              tracking-wider
            "
          >
            USERNAME
          </label>


          {/* Username Input */}

          <div
            className="
              flex
              items-center
              bg-white
              border-[4px]
              border-black
              shadow-[5px_5px_0_#000]
              focus-within:shadow-[7px_7px_0_#38aef0]
              transition-shadow
            "
          >

            <span
              className="
                px-4
                text-xl
                font-black
                text-black
                border-r-[4px]
                border-black
                h-full
                flex
                items-center
              "
            >
              @
            </span>

            <input
              id="username"
              type="text"
              placeholder="your_username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              maxLength={30}
              autoComplete="username"
              autoFocus
              className="
                w-full
                bg-transparent
                py-4
                px-4
                outline-none
                text-black
                font-bold
                placeholder:text-black/30
              "
            />

          </div>


          {/* Hint */}

          <p className="mt-4 text-sm font-semibold text-black/55">
            3–30 characters • letters, numbers, _, -, and .
          </p>


          {/* =========================================
              ERROR
          ========================================= */}

          {error && (

            <div
              className="
                mt-6
                p-4
                bg-[#ff5c5c]
                border-[3px]
                border-black
                shadow-[4px_4px_0_#000]
                text-black
                font-bold
                text-sm
              "
            >
              {error}
            </div>

          )}


          {/* =========================================
              SUCCESS
          ========================================= */}

          {success && (

            <div
              className="
                mt-6
                p-4
                bg-[#35d98b]
                border-[3px]
                border-black
                shadow-[4px_4px_0_#000]
                text-black
                font-bold
                text-sm
              "
            >
              {success}
            </div>

          )}


          {/* =========================================
              CONTINUE BUTTON
          ========================================= */}

          <button
            type="submit"
            disabled={loading}
            className="
              mt-7
              w-full
              py-4
              bg-[#ffd43b]
              border-[4px]
              border-black
              shadow-[6px_6px_0_#000]
              text-black
              font-black
              tracking-wide
              hover:translate-x-[2px]
              hover:translate-y-[2px]
              hover:shadow-[4px_4px_0_#000]
              active:translate-x-[5px]
              active:translate-y-[5px]
              active:shadow-none
              disabled:opacity-50
              disabled:cursor-not-allowed
              transition-all
            "
          >
            {loading
              ? 'CHECKING...'
              : 'CONTINUE →'}
          </button>

        </form>


        {/* =========================================
            FOOTER INFO
        ========================================= */}

        <div
          className="
            mt-8
            p-4
            bg-[#e8f5fc]
            border-[3px]
            border-black
            flex
            items-center
            gap-3
          "
        >

          <div
            className="
              w-8
              h-8
              shrink-0
              bg-[#38aef0]
              border-[3px]
              border-black
              flex
              items-center
              justify-center
              font-black
            "
          >
            @
          </div>

          <p className="text-xs md:text-sm font-bold">
            Your username will be visible to other AptiVerse users.
          </p>

        </div>

      </div>

    </div>
  )
}


export default ChooseUsername