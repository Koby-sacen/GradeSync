
'use client'

import React, { useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { auth } from '@/lib/firebase'
import GoogleBtn from './googlebtn'
import FacebookBtn from './facebookbtn'

interface LoginFormProps {
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  redirectTo?: string
}

export default function LoginForm({
  onSubmit,
  redirectTo = '/instructor/home',
}: LoginFormProps) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    setError(null)

    if (onSubmit) {
      onSubmit(e)
    }

    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      )

      // Play success audio feedback
      const successAudio = new Audio('/sounds/success.mp3')
      successAudio.play().catch(() => {})

      toast.success(
        `Welcome back, ${
          userCredential.user.displayName ||
          userCredential.user.email
        }!`,
        {
          description: 'Redirecting to dashboard...',
        }
      )

      // Redirect user after successful authentication
      setTimeout(() => {
        router.push(redirectTo)
      }, 1000)
    } catch (err: unknown) {
      console.error('Email sign-in error:', err)

      // Play failure audio feedback
      const failedAudio = new Audio('/sounds/failed.mp3')
      failedAudio.play().catch(() => {})

      let errorMessage =
        'Failed to sign in. Please try again.'

      if (err instanceof FirebaseError) {
        if (
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/invalid-credential'
        ) {
          errorMessage = 'Invalid email or password.'
        } else if (err.code === 'auth/too-many-requests') {
          errorMessage =
            'Too many failed attempts. Please try again later.'
        }
      }

      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit}
      suppressHydrationWarning
    >
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-center text-xs font-medium text-red-600">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          Email address
        </label>

        <input
          suppressHydrationWarning
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu.ph"
          autoComplete="email"
          required
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
        </div>

        <div className="relative">
          <input
            suppressHydrationWarning
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-white pl-4 pr-11 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
          />

          <button
            suppressHydrationWarning
            type="button"
            aria-label={
              showPassword ? 'Hide password' : 'Show password'
            }
            onClick={() =>
              setShowPassword((prev) => !prev)
            }
            disabled={loading}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 focus:outline-none disabled:opacity-50"
          >
            {showPassword ? (
              /* Eye Slash Icon (Hide) */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            ) : (
              /* Eye Icon (Show) */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12c1.274 4.057 5.065 7 9.542 7 4.477 0 8.268-2.943 9.542-7-1.274-4.057-5.064-7-9.542-7-4.477 0-8.268 2.943-9.542 7z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          suppressHydrationWarning
          id="remember"
          name="remember"
          type="checkbox"
          disabled={loading}
          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
        />

        <label
          htmlFor="remember"
          className="text-sm text-slate-600"
        >
          Remember me
        </label>
      </div>

      <button
        suppressHydrationWarning
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-[0.99] disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <div className="relative my-4 flex items-center justify-center">
        <div className="w-full border-t border-slate-200" />

        <span className="absolute bg-white px-3 text-xs uppercase tracking-wider text-slate-400">
          OR CONTINUE WITH
        </span>
      </div>

      <div className="space-y-3">
        <GoogleBtn />
        <FacebookBtn />
      </div>
    </form>
  )
}
