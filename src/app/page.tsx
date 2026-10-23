
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return

      // No authenticated account
      if (!user) {
        router.replace('/login')
        return
      }

      try {
        // Retrieve the authenticated user's Firestore profile
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        if (!active) return

        // User profile doesn't exist
        if (!userSnap.exists()) {
          console.warn(
            '[GradeSync] User profile not found:',
            user.uid
          )

          router.replace('/login')
          return
        }

        const userData = userSnap.data()
        const role = userData?.role

        // Only instructors enter the instructor dashboard
        if (role === 'instructor') {
          router.replace('/instructor/home')
          return
        }

        // Only students enter the student dashboard
        if (role === 'student') {
          router.replace('/students/home')
          return
        }

        // Unknown or invalid roles are denied
        console.warn(
          '[GradeSync] Unrecognized account role:',
          role
        )

        router.replace('/login')
      } catch (error) {
        console.error(
          '[GradeSync] Failed to verify user role:',
          error
        )

        if (active) {
          router.replace('/login')
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />

        <p className="text-sm font-medium text-slate-600">
          Verifying your account...
        </p>
      </div>
    </div>
  )
}
