'use client'

import { useEffect } from 'react'
import {
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { auth, db } from '@/lib/firebase'

export default function FacebookBtn() {
  const router = useRouter()

  // Handle the redirect result (fallback for restricted environments)
  useEffect(() => {
    let isMounted = true

    getRedirectResult(auth)
      .then(async (result) => {
        if (result && isMounted) {
          const user = result.user
          const userRef = doc(db, 'users', user.uid)
          const userSnap = await getDoc(userRef)

          let userRole = 'student'

          if (!userSnap.exists()) {
            const newUserDoc = {
              uid: user.uid,
              fullName: user.displayName || 'Facebook User',
              email: user.email || '',
              role: 'student',
              isInstructorVerified: false,
              verificationStatus: 'none',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
            await setDoc(userRef, newUserDoc)
          } else {
            const userData = userSnap.data()
            if (userData?.role) {
              userRole = userData.role
            }
          }

          const successAudio = new Audio('/sounds/success.mp3')
          successAudio.play().catch((error) => console.warn('Audio playback prevented:', error))

          toast.success(`Welcome back, ${user.displayName || 'User'}!`, {
            description: 'Redirecting to dashboard...',
          })

          const redirectPath = userRole === 'instructor' ? '/instructor/home' : '/students/home'

          setTimeout(() => {
            router.push(redirectPath)
          }, 1000)
        }
      })
      .catch((error: unknown) => {
        const err = error as { code?: string; message?: string }
        console.error('Facebook redirect sign-in error:', err)

        // Ignore missing initial state errors on initial page load if no redirect happened
        if (err.code && err.code !== 'auth/missing-initial-state') {
          const failedAudio = new Audio('/sounds/failed.mp3')
          failedAudio.play().catch((audioErr) => console.warn('Audio playback prevented:', audioErr))
          toast.error(err.message || 'Failed to sign in with Facebook. Please try again.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [router])

  const handleFacebookSignIn = async () => {
    try {
      const provider = new FacebookAuthProvider()
      provider.addScope('email')
      provider.addScope('public_profile')

      // Use popup across all devices (including mobile Chrome) to prevent sessionStorage wiping
      try {
        const result = await signInWithPopup(auth, provider)
        const user = result.user

        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        let userRole = 'student'

        if (!userSnap.exists()) {
          const newUserDoc = {
            uid: user.uid,
            fullName: user.displayName || 'Facebook User',
            email: user.email || '',
            role: 'student',
            isInstructorVerified: false,
            verificationStatus: 'none',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
          await setDoc(userRef, newUserDoc)
        } else {
          const userData = userSnap.data()
          if (userData?.role) {
            userRole = userData.role
          }
        }

        const successAudio = new Audio('/sounds/success.mp3')
        successAudio.play().catch((error) => console.warn('Audio playback prevented:', error))

        toast.success(`Welcome back, ${user.displayName || 'User'}!`, {
          description: 'Redirecting to dashboard...',
        })

        const redirectPath = userRole === 'instructor' ? '/instructor/home' : '/students/home'

        setTimeout(() => {
          router.push(redirectPath)
        }, 1000)
      } catch (popupError: unknown) {
        const err = popupError as { code?: string; message?: string }
        
        // If popup is blocked or not supported, gracefully fallback to redirect
        if (
          err.code === 'auth/popup-blocked' ||
          err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, provider)
        } else if (err.code !== 'auth/cancelled-popup-request') {
          throw err
        }
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string }
      console.error('Facebook sign-in error:', err)

      const failedAudio = new Audio('/sounds/failed.mp3')
      failedAudio.play().catch((audioErr) => console.warn('Audio playback prevented:', audioErr))

      toast.error(err.message || 'Failed to sign in with Facebook. Please try again.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleFacebookSignIn}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.99]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="#1877F2"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>

      Continue with Facebook
    </button>
  )
}