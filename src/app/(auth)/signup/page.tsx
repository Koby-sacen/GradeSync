'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FirebaseError } from 'firebase/app'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { auth, db } from '@/lib/firebase'
import GoogleBtn from '../../../components/login/googlebtn'
import FacebookBtn from '../../../components/login/facebookbtn'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match.'
      setError(msg)
      toast.error(msg)
      return
    }

    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters long.'
      setError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // 2. Set Firebase Auth display name
      await updateProfile(user, {
        displayName: fullName,
      })

      // 3. Save user profile to Firestore under "users" collection with student default role
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName,
        email,
        role: 'student',
        isInstructorVerified: false,
        verificationStatus: 'none', // 'none' | 'pending' | 'verified' | 'rejected'
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // 4. Success audio feedback
      const successAudio = new Audio('/sounds/success.mp3')
      successAudio.play().catch(() => {})

      toast.success('Account created successfully!', {
        description: 'Welcome to Digital Office.',
      })

      // 5. Redirect to student portal
      setTimeout(() => {
        router.push('/instructor/home')
      }, 1000)
    } catch (err: unknown) {
      console.error('Sign-up error:', err)

      const failedAudio = new Audio('/sounds/failed.mp3')
      failedAudio.play().catch(() => {})

      let errorMessage = 'Failed to create account. Please try again.'

      if (err instanceof FirebaseError) {
        if (err.code === 'auth/email-already-in-use') {
          errorMessage = 'An account with this email already exists.'
        } else if (err.code === 'auth/invalid-email') {
          errorMessage = 'Please enter a valid email address.'
        } else if (err.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak. Choose a stronger password.'
        }
      }

      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Main split-panel container matching login page */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px]">
        
        {/* LEFT PANEL: Background image overlay + explicit sign-up branding */}
        <div className="md:col-span-5 lg:col-span-6 relative p-8 sm:p-12 flex flex-col justify-between text-white overflow-hidden bg-slate-800">
          
          {/* Background Image (ssu.png) */}
          <Image
            src="/images/ssu.png"
            alt="SSU Background"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center z-0"
          />

          {/* Adjusted semi-transparent overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/30 to-slate-900/40 z-10 pointer-events-none" />

          {/* Top Logo Section */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-sm text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <path d="M9 9v.01" />
                <path d="M9 12v.01" />
                <path d="M9 15v.01" />
                <path d="M9 18v.01" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-wider text-white">GradeSync</span>
              <span className="text-xs text-slate-200 font-medium tracking-wide">Digital Office Portal</span>
            </div>
          </div>

          {/* Center Welcome Text (Customized specifically for Sign Up) */}
          <div className="relative z-10 my-12">
            <span className="inline-block px-3 py-1 mb-4 rounded-full bg-blue-500/20 backdrop-blur-md border border-blue-400/30 text-xs font-semibold tracking-wide text-blue-200 uppercase">
              New Account Registration
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-md">
              Join Us Today!
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-200 max-w-md leading-relaxed drop-shadow-md">
              Create your Digital Office account to start requesting grades, managing clearance documents, and accessing student services.
            </p>
          </div>

          {/* Bottom Info / Security */}
          <div className="relative z-10 pt-4 border-t border-white/20 flex items-center gap-2 text-xs text-slate-200">
            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Authorized registration process. Encrypted setup.</span>
          </div>
        </div>

        {/* RIGHT PANEL: Registration Form Area */}
        <div className="md:col-span-7 lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div>
            {/* Header Info */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create an Account</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Fill in your details below or register using social providers.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-center text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-1.5 block text-xs font-medium text-slate-700 uppercase tracking-wider"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  autoComplete="name"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-slate-700 uppercase tracking-wider"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu.ph"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-4 pr-11 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={loading}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 focus:outline-none disabled:opacity-50"
                  >
                    {showPassword ? (
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

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-xs font-medium text-slate-700 uppercase tracking-wider"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-4 pr-11 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    disabled={loading}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 focus:outline-none disabled:opacity-50"
                  >
                    {showConfirmPassword ? (
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

              <div className="flex items-start gap-2 pt-1">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                <label
                  htmlFor="terms"
                  className="text-xs leading-snug text-slate-600"
                >
                  I agree to the{' '}
                  <a href="/terms" className="text-blue-600 hover:text-blue-700 font-medium">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-blue-600 hover:text-blue-700 font-medium">
                    Privacy Policy
                  </a>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-slate-200"></div>
                <span className="absolute bg-white px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  OR CONTINUE WITH
                </span>
              </div>

              <div className="space-y-3">
                <GoogleBtn />
                <FacebookBtn />
              </div>
            </form>

            {/* Separator to switch back to Login */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                ALREADY HAVE AN ACCOUNT?
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Login Link Box */}
            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full rounded-xl border border-blue-600 bg-white py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-[0.99]"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>

          {/* Footer Notice & Copyright */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-1.5">
            <p className="text-xs text-slate-400 leading-relaxed">
              Protected by institutional security policies.
            </p>
            <p className="text-xs font-medium text-slate-400">
              © 2026 Digital Office. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}