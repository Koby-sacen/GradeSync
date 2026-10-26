
'use client'

import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  GraduationCap,
  ShieldCheck,
  Loader2,
  LockKeyhole,
} from 'lucide-react'
import SideBar from '../../components/features/admin/shared/sideBar'

type AuthStatus = 'loading' | 'authorized' | 'unauthorized'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const isLoginPage =
    pathname === '/admin/login' ||
    pathname === '/admin/login/'

  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    if (isLoginPage) return

    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return

      if (!user) {
        setAuthStatus('unauthorized')
        router.replace('/admin/login')
        return
      }

      try {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        if (!active) return

        if (!userSnap.exists()) {
          setAuthStatus('unauthorized')
          router.replace('/admin/login')
          return
        }

        const userData = userSnap.data()
        const role = userData?.role

        if (role !== 'admin') {
          setAuthStatus('unauthorized')
          router.replace('/admin/login')
          return
        }

        setAuthStatus('authorized')
      } catch (error) {
        console.error(
          '[GradeSync Admin] Failed to verify administrator:',
          error
        )

        if (active) {
          setAuthStatus('unauthorized')
          router.replace('/admin/login')
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [isLoginPage, router])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (authStatus !== 'authorized') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 font-sans">
        <div className="w-full max-w-sm text-center">

          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
            <ShieldCheck
              size={38}
              strokeWidth={1.7}
              className="text-emerald-700"
            />
          </div>

          <div className="mb-4 flex items-center justify-center gap-2">
            <GraduationCap
              size={23}
              className="text-emerald-700"
            />

            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              GradeSync
            </h1>
          </div>

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <LockKeyhole size={13} />
            Secure Administration
          </div>

          <div className="mb-5 flex justify-center">
            <Loader2
              size={28}
              className="animate-spin text-emerald-700"
            />
          </div>

          <h2 className="text-lg font-bold text-slate-800">
            {authStatus === 'unauthorized'
              ? 'Access Restricted'
              : 'Verifying Administrator Access'}
          </h2>

          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500">
            {authStatus === 'unauthorized'
              ? 'You do not have permission to access this area. Redirecting to the administrator login...'
              : 'Please wait while GradeSync securely verifies your account and administrator permissions.'}
          </p>

          <div className="mx-auto mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-600" />
          </div>

          <p className="mt-5 text-[11px] text-slate-400">
            No Distance. No Delays. Just GradeSync.
          </p>

        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] lg:flex">
      <SideBar />

      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}
