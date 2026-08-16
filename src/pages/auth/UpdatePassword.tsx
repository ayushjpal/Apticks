import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'


function UpdatePassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')
    setSuccess('')


    // -----------------------------
    // Validation
    // -----------------------------

    if (!password) {
      setError('Please enter a new password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }


    setLoading(true)


    try {

      // -----------------------------
      // Update Supabase password
      // -----------------------------

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        })


      if (updateError) {

        console.error(
          'Password update error:',
          updateError
        )

        setError(
          updateError.message ||
          'Unable to update password. Please try again.'
        )

        return
      }


      // -----------------------------
      // Success
      // -----------------------------

      setSuccess(
        'Password updated successfully!'
      )


      setTimeout(() => {

        navigate('/login', {
          replace: true,
          state: {
            message:
              'Password updated successfully. Please sign in.',
          },
        })

      }, 1200)


    } catch (error) {

      console.error(
        'Unexpected password update error:',
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

    <div
      className="
        min-h-screen
        bg-[#061a2d]
        flex
        items-center
        justify-center
        px-4
        py-10
        relative
        overflow-hidden
      "
    >

      {/* -------------------------------- */}
      {/* Background Grid                  */}
      {/* -------------------------------- */}

      <div
        className="
          absolute
          inset-0
          opacity-30
          pointer-events-none
        "
        style={{
          backgroundImage: `
            linear-gradient(#16344d 1px, transparent 1px),
            linear-gradient(90deg, #16344d 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />


      {/* -------------------------------- */}
      {/* Decorative Shapes                */}
      {/* -------------------------------- */}

      <div
        className="
          absolute
          left-[8%]
          top-[30%]
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
        "
      >
        +
      </div>


      <div
        className="
          absolute
          right-[8%]
          top-[22%]
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
        "
      >
        7
      </div>


      <div
        className="
          absolute
          left-[9%]
          bottom-[18%]
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
        "
      >
        =
      </div>


      <div
        className="
          absolute
          right-[7%]
          bottom-[22%]
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
        "
      >
        ×
      </div>


      {/* -------------------------------- */}
      {/* Main Card                         */}
      {/* -------------------------------- */}

      <div
        className="
          relative
          z-10
          w-full
          max-w-[520px]
          bg-white
          text-black
          border-4
          border-black
          shadow-[10px_10px_0_#38aef0]
          px-8
          py-9
          sm:px-10
          sm:py-10
        "
      >

        {/* -------------------------------- */}
        {/* Logo                             */}
        {/* -------------------------------- */}

        <div className="flex items-center gap-3 mb-7">

          <div
            className="
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
            "
          >
            A
          </div>

          <span className="font-black text-xl tracking-tight">
            APTICKS
          </span>

        </div>


        {/* -------------------------------- */}
        {/* Badge                            */}
        {/* -------------------------------- */}

        <div
          className="
            inline-block
            bg-[#38aef0]
            border-4
            border-black
            shadow-[4px_4px_0_#000]
            px-3
            py-2
            text-[11px]
            font-black
            tracking-[0.12em]
            mb-6
          "
        >
          ACCOUNT SECURITY
        </div>


        {/* -------------------------------- */}
        {/* Heading                          */}
        {/* -------------------------------- */}

        <h1
          className="
            text-[46px]
            sm:text-[52px]
            leading-[0.88]
            font-black
            tracking-[-0.04em]
            uppercase
          "
        >
          UPDATE
          <br />
          PASSWORD
        </h1>


        <p className="mt-5 text-sm font-semibold text-black/70">
          Create a new password for your Apticks account.
        </p>


        {/* -------------------------------- */}
        {/* Form                             */}
        {/* -------------------------------- */}

        <form
          onSubmit={handleSubmit}
          className="mt-7"
        >

          {/* New Password */}

          <label
            htmlFor="password"
            className="
              block
              mb-2
              text-xs
              font-black
              tracking-wider
            "
          >
            NEW PASSWORD
          </label>


          <div
            className="
              flex
              items-center
              border-4
              border-black
              bg-white
              shadow-[4px_4px_0_#000]
              focus-within:shadow-[4px_4px_0_#38aef0]
              transition-shadow
            "
          >

            <span className="px-3 text-lg">
              🔒
            </span>

            <input
              id="password"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter new password"
              autoComplete="new-password"
              className="
                w-full
                py-3.5
                bg-transparent
                outline-none
                text-sm
                font-semibold
                placeholder:text-black/40
              "
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              className="
                px-3
                text-lg
                hover:scale-110
                transition-transform
              "
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
            >
              {showPassword ? '🙈' : '👁️'}
            </button>

          </div>


          {/* Password strength */}

          <div className="mt-3 flex gap-1.5">

            {[1, 2, 3, 4].map((level) => {

              const strength =
                password.length >= 12
                  ? 4
                  : password.length >= 10
                    ? 3
                    : password.length >= 8
                      ? 2
                      : 0

              return (
                <div
                  key={level}
                  className={`
                    h-2
                    flex-1
                    border-2
                    border-black
                    ${
                      level <= strength
                        ? 'bg-[#32e875]'
                        : 'bg-gray-200'
                    }
                  `}
                />
              )
            })}

          </div>


          {/* Confirm Password */}

          <label
            htmlFor="confirmPassword"
            className="
              block
              mt-6
              mb-2
              text-xs
              font-black
              tracking-wider
            "
          >
            CONFIRM PASSWORD
          </label>


          <div
            className="
              flex
              items-center
              border-4
              border-black
              bg-white
              shadow-[4px_4px_0_#000]
              focus-within:shadow-[4px_4px_0_#38aef0]
              transition-shadow
            "
          >

            <span className="px-3 text-lg">
              ✓
            </span>

            <input
              id="confirmPassword"
              type={
                showConfirmPassword
                  ? 'text'
                  : 'password'
              }
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="
                w-full
                py-3.5
                bg-transparent
                outline-none
                text-sm
                font-semibold
                placeholder:text-black/40
              "
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
              className="
                px-3
                text-lg
                hover:scale-110
                transition-transform
              "
              aria-label={
                showConfirmPassword
                  ? 'Hide password'
                  : 'Show password'
              }
            >
              {showConfirmPassword
                ? '🙈'
                : '👁️'}
            </button>

          </div>


          {/* Error */}

          {error && (

            <div
              className="
                mt-5
                border-4
                border-black
                bg-[#ff5b5b]
                px-4
                py-3
                text-sm
                font-bold
                shadow-[4px_4px_0_#000]
              "
            >
              {error}
            </div>

          )}


          {/* Success */}

          {success && (

            <div
              className="
                mt-5
                border-4
                border-black
                bg-[#32e875]
                px-4
                py-3
                text-sm
                font-bold
                shadow-[4px_4px_0_#000]
              "
            >
              {success}
            </div>

          )}


          {/* -------------------------------- */}
          {/* Submit                           */}
          {/* -------------------------------- */}

          <button
            type="submit"
            disabled={loading}
            className="
              mt-6
              w-full
              border-4
              border-black
              bg-[#ffd43b]
              py-3.5
              font-black
              text-sm
              tracking-wide
              shadow-[5px_5px_0_#000]
              hover:translate-x-[2px]
              hover:translate-y-[2px]
              hover:shadow-[3px_3px_0_#000]
              active:translate-x-[5px]
              active:translate-y-[5px]
              active:shadow-none
              disabled:opacity-50
              disabled:cursor-not-allowed
              transition-all
            "
          >
            {loading
              ? 'UPDATING...'
              : 'UPDATE PASSWORD →'}
          </button>

        </form>


        {/* -------------------------------- */}
        {/* Back to login                    */}
        {/* -------------------------------- */}

        <button
          type="button"
          onClick={() =>
            navigate('/login')
          }
          className="
            block
            mx-auto
            mt-6
            text-xs
            font-black
            border-b-2
            border-black
            hover:text-[#168bd1]
            hover:border-[#168bd1]
            transition-colors
          "
        >
          ← BACK TO SIGN IN
        </button>


        {/* -------------------------------- */}
        {/* Security tip                     */}
        {/* -------------------------------- */}

        <div
          className="
            mt-7
            border-4
            border-black
            bg-[#e9f6ff]
            p-4
            flex
            items-center
            gap-3
          "
        >

          <div
            className="
              shrink-0
              w-8
              h-8
              bg-[#38aef0]
              border-3
              border-black
              flex
              items-center
              justify-center
              font-black
            "
          >
            ?
          </div>

          <p className="text-xs font-bold leading-relaxed">
            Use a strong password that you
            don't use on other websites.
          </p>

        </div>

      </div>

    </div>
  )
}


export default UpdatePassword