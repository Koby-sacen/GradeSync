
'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  ShieldCheck,
  GraduationCap,
  LockKeyhole,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Shield,
  Users,
  FileCheck2,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function AdminLogin() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSecurityInfo, setShowSecurityInfo] = useState(false)

  const handleGoogleLogin = async () => {
    if (loading) return

    setLoading(true)
    setError('')

    try {
      const provider = new GoogleAuthProvider()

      provider.setCustomParameters({
        prompt: 'select_account',
      })

      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await signOut(auth)

        setError(
          'Access denied. Your account is not registered as a GradeSync administrator.'
        )
        return
      }

      const userData = userSnap.data()
      const role = userData?.role

      if (role !== 'admin') {
        await signOut(auth)

        setError(
          'Access denied. This portal is restricted to authorized GradeSync administrators.'
        )
        return
      }

      router.replace('/admin/dashboard')
    } catch (err: unknown) {
      console.error('[GradeSync Admin] Login error:', err)

      const firebaseError = err as {
        code?: string
        message?: string
      }

      if (firebaseError.code === 'auth/popup-closed-by-user') {
        setError('Google Sign-In was cancelled.')
      } else if (firebaseError.code === 'auth/popup-blocked') {
        setError(
          'Your browser blocked the Google Sign-In popup. Please allow popups and try again.'
        )
      } else if (
        firebaseError.code === 'auth/cancelled-popup-request'
      ) {
        setError('The previous sign-in request was cancelled.')
      } else if (firebaseError.code === 'permission-denied') {
        setError(
          'Unable to verify administrator permissions. Please contact the system administrator.'
        )
      } else {
        setError(
          'Unable to sign in. Please check your connection and try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-100 px-4 py-8 font-sans antialiased sm:px-6 lg:px-8">

      {/* Background Decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[450px] w-[450px] rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 lg:min-h-[650px] lg:grid-cols-12">

        {/* Left Branding Panel */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-slate-800 p-8 text-white sm:p-10 lg:col-span-6 lg:p-12">

          {/* SSU Background Image */}
          <Image
            src="/images/ssu.png"
            alt="Samar State University Background"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="absolute inset-0 z-0 object-cover object-center"
          />

          {/* Dark Overlay */}
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-slate-900/75 via-slate-900/45 to-slate-900/55" />

          {/* Decorative Elements */}
          <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
            <div className="absolute -right-10 -top-10 h-60 w-60 rounded-full border border-white/10" />
            <div className="absolute -bottom-36 -left-24 h-80 w-80 rounded-full border border-white/10" />
            <div className="absolute bottom-16 right-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          {/* GradeSync Branding */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-sm">
                <GraduationCap size={26} />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  GradeSync
                </h1>

                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  Administration Portal
                </p>
              </div>
            </div>
          </div>

          {/* Welcome Section */}
          <div className="relative z-10 my-12 lg:my-0">

            {/* Restricted Access Badge */}
            <div className="mt-4 mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-slate-900/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-200 backdrop-blur-sm">
              <LockKeyhole size={13} />
              Restricted Access
            </div>

            {/* Main Headline */}
            <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-md sm:text-4xl">
              Manage with confidence.
              <span className="mt-2 block text-emerald-300">
                Lead with efficiency.
              </span>
            </h2>

            {/* GradeSync Tagline */}
            <div className="mt-6">
              <div className="mb-4 h-1 w-12 rounded-full bg-emerald-400" />

              <h3 className="text-lg font-bold leading-snug tracking-tight text-white drop-shadow-md sm:text-xl">
                No Distance. No Delays.
                <br />
                <span className="text-emerald-300">
                  Just GradeSync.
                </span>
              </h3>
            </div>

            {/* Description */}
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-100 drop-shadow-md">
              A centralized workspace for authorized GradeSync
              administrators to manage faculty applications,
              oversee accounts, and support a more efficient
              digital clearance experience.
            </p>

            {/* Feature Highlights */}
            <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Users,
                  label: 'User Management',
                },
                {
                  icon: FileCheck2,
                  label: 'Applications',
                },
                {
                  icon: Shield,
                  label: 'Secure Access',
                },
              ].map((feature) => {
                const Icon = feature.icon

                return (
                  <div
                    key={feature.label}
                    className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-slate-900/25 px-3 py-3 backdrop-blur-sm sm:flex-col sm:items-start"
                  >
                    <Icon
                      size={18}
                      className="shrink-0 text-emerald-300"
                    />

                    <span className="text-[11px] font-medium leading-5 text-white">
                      {feature.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Information */}
          <div className="relative z-10 border-t border-white/20 pt-5">
            <p className="text-xs font-semibold text-white">
              No Distance. No Delays. Just GradeSync.
            </p>

            <p className="mt-1.5 text-[11px] text-slate-200">
              Samar State University • Digital Clearance Management
            </p>
          </div>
        </div>

        {/* Right Login Panel */}
        <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:col-span-6 lg:px-12 lg:py-14">

          <div className="mx-auto w-full max-w-sm">

            {/* Login Header */}
            <div className="mb-8">

              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                <LockKeyhole size={26} strokeWidth={1.8} />
              </div>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Administrator Authentication
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Administrator Login
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Sign in using your authorized Google account
                to access the GradeSync administration portal.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <AlertCircle
                  size={19}
                  className="mt-0.5 shrink-0 text-red-600"
                />

                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Authentication Failed
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-700">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={20}
                    className="animate-spin text-emerald-700"
                  />
                  Verifying Administrator...
                </>
              ) : (
                <>
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.88 46.98 24.55z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>

                  Continue with Google

                  <ArrowRight
                    size={17}
                    className="ml-auto text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-700"
                  />
                </>
              )}
            </button>

            {/* Restricted Access Notice */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <ShieldCheck
                size={15}
                className="text-emerald-700"
              />

              <p className="text-center text-xs text-slate-500">
                Restricted to authorized administrators only
              </p>
            </div>

            {/* Security Information */}
            <div className="mt-9 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">

              <button
                type="button"
                onClick={() =>
                  setShowSecurityInfo(!showSecurityInfo)
                }
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-100"
                aria-expanded={showSecurityInfo}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck
                    size={18}
                    className="text-emerald-700"
                  />

                  <span className="text-xs font-semibold text-slate-700">
                    Security & Access Information
                  </span>
                </div>

                {showSecurityInfo ? (
                  <EyeOff
                    size={16}
                    className="text-slate-400"
                  />
                ) : (
                  <Eye
                    size={16}
                    className="text-slate-400"
                  />
                )}
              </button>

              {showSecurityInfo && (
                <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                  <div className="space-y-3">
                    {[
                      'Google Sign-In verifies your identity.',
                      'Your GradeSync administrator role is checked before dashboard access.',
                      'Student and instructor accounts are not permitted to access administrative functions.',
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-2.5"
                      >
                        <CheckCircle2
                          size={15}
                          className="mt-0.5 shrink-0 text-emerald-600"
                        />

                        <p className="text-xs leading-5 text-slate-600">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Access Notice */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <p className="text-center text-xs leading-6 text-slate-400">
                Administrative access is granted only to
                accounts approved by the GradeSync system administrator.
              </p>
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <GraduationCap size={15} />
              <span>GradeSync Administration Portal</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
