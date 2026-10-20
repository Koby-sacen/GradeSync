'use client'

import Link from 'next/link'
import Image from 'next/image'
import LoginForm from '@/components/login/loginform'

export default function Page() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Container matching the split layout */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px]">
        
        {/* LEFT PANEL: Replaced plain blue panel with ssu.png background */}
        <div className="md:col-span-5 lg:col-span-6 relative p-8 sm:p-12 flex flex-col justify-between text-white overflow-hidden bg-slate-800">
          
          {/* Background Image (ssu.png) with sizes prop included */}
          <Image
            src="/images/ssu.png"
            alt="SSU Background"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center z-0"
          />

          {/* Semi-transparent dark overlay to make ssu.png visible while keeping text readable */}
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

          {/* Center Welcome Text */}
          <div className="relative z-10 my-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white drop-shadow-md">
              Hello, <br />
              welcome!
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-200 max-w-md leading-relaxed drop-shadow-md">
              Sign in to access your Digital Office account, track grade requests, and manage clearance documents.
            </p>
          </div>

          {/* Bottom Info / Security */}
          <div className="relative z-10 pt-4 border-t border-white/20 flex items-center gap-2 text-xs text-slate-200">
            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Authorized personnel only. Encrypted institutional access.</span>
          </div>
        </div>

        {/* RIGHT PANEL: Clean White Form Area */}
        <div className="md:col-span-7 lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div>
            {/* Header Info */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Account Sign In</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Enter your registered credentials or use institutional single sign-on.
              </p>
            </div>

            {/* Reusable Login Form Component */}
            <LoginForm />

            {/* Separator */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                DONT HAVE AN ACCOUNT?
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Sign Up Link Box */}
            <div className="text-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center w-full rounded-xl border border-blue-600 bg-white py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-[0.99]"
              >
                Sign-up for a New Account
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