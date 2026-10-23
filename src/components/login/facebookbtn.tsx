
'use client'

import { useRef, useState } from 'react'
import {
  FacebookAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { auth, db } from '@/lib/firebase'

export default function FacebookBtn() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const signingInRef = useRef(false)

  // Play login sounds safely
  const playSound = (type: 'success' | 'failed') => {
    try {
      const audio = new Audio(`/sounds/${type}.mp3`)

      audio.play().catch((error) => {
        console.warn('Audio playback prevented:', error)
      })
    } catch (error) {
      console.warn('Unable to play audio:', error)
    }
  }

  // Handle successful Facebook authentication
  const handleAuthenticatedUser = async (user: User) => {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    let userRole = 'student'

    // Create account for first-time Facebook users
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
      // Preserve existing account role and information
      const userData = userSnap.data()

      if (userData?.role) {
        userRole = userData.role
      }
    }

    playSound('success')

    toast.success(
      `Welcome back, ${user.displayName || 'User'}!`,
      {
        description: 'Redirecting to dashboard...',
      }
    )

    const redirectPath =
      userRole === 'instructor'
        ? '/instructor/home'
        : '/students/home'

    // Preserve the original dashboard redirect delay
    setTimeout(() => {
      router.push(redirectPath)
    }, 1000)
  }

  // Facebook login for both desktop and mobile browsers
  const handleFacebookSignIn = async () => {
    if (signingInRef.current) return

    signingInRef.current = true
    setLoading(true)

    try {
      const provider = new FacebookAuthProvider()

      provider.addScope('email')
      provider.addScope('public_profile')

      // IMPORTANT:
      // Use popup authentication on ALL devices.
      //
      // This avoids the Firebase redirect flow that can
      // fail with missing initial state on mobile Chrome.
      //
      // Call signInWithPopup directly from the click
      // handler so the browser recognizes user interaction.

      const result = await signInWithPopup(auth, provider)

      if (!result.user) {
        throw new Error(
          'Facebook authentication did not return a user.'
        )
      }

      await handleAuthenticatedUser(result.user)
    } catch (error: unknown) {
      const err = error as {
        code?: string
        message?: string
      }

      console.error('Facebook sign-in error:', err)

      // User intentionally closed the login popup
      if (err.code === 'auth/popup-closed-by-user') {
        toast.info('Facebook login was cancelled.')
        return
      }

      // Firebase cancelled an overlapping popup request
      if (err.code === 'auth/cancelled-popup-request') {
        return
      }

      playSound('failed')

      if (err.code === 'auth/popup-blocked') {
        toast.error(
          'Facebook popup was blocked. Please allow popups for this website in your browser settings.'
        )
      } else if (err.code === 'auth/unauthorized-domain') {
        toast.error(
          'This website domain is not authorized in Firebase Authentication.'
        )
      } else if (
        err.code === 'auth/account-exists-with-different-credential'
      ) {
        toast.error(
          'An account already exists with this email using another sign-in method.'
        )
      } else if (err.code === 'auth/operation-not-allowed') {
        toast.error(
          'Facebook authentication is not enabled in Firebase.'
        )
      } else if (err.code === 'auth/network-request-failed') {
        toast.error(
          'Network error. Please check your internet connection and try again.'
        )
      } else if (err.code === 'auth/invalid-credential') {
        toast.error(
          'Facebook authentication credentials are invalid. Please try again.'
        )
      } else if (err.code === 'auth/internal-error') {
        toast.error(
          'An authentication error occurred. Please try again.'
        )
      } else {
        toast.error(
          err.message ||
          'Failed to sign in with Facebook. Please try again.'
        )
      }
    } finally {
      signingInRef.current = false
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleFacebookSignIn}
      disabled={loading}
      aria-busy={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="#1877F2"
        aria-hidden="true"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>

      {loading
        ? 'Connecting to Facebook...'
        : 'Continue with Facebook'}
    </button>
  )
}
