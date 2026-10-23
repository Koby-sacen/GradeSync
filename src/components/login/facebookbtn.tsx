
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false

  return /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger|Orca/i.test(
    navigator.userAgent
  )
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

function isMobileChrome(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent

  const chrome =
    (/Android/i.test(ua) && /Chrome/i.test(ua)) ||
    (/iPhone|iPad|iPod/i.test(ua) && /CriOS/i.test(ua))

  const otherBrowser =
    /EdgA|EdgiOS|OPR|OPT|SamsungBrowser|UCBrowser/i.test(ua)

  return chrome && !otherBrowser && !isInAppBrowser()
}

function shouldUseRedirect(): boolean {
  return isMobileDevice() && !isMobileChrome()
}

function playSound(type: 'success' | 'failed') {
  try {
    const audio = new Audio(`/sounds/${type}.mp3`)

    audio.play().catch((error) => {
      console.warn('Audio playback prevented:', error)
    })
  } catch (error) {
    console.warn('Audio playback unavailable:', error)
  }
}

function getError(error: unknown): {
  code?: string
  message?: string
} {
  if (typeof error === 'object' && error !== null) {
    return error as {
      code?: string
      message?: string
    }
  }

  return { message: String(error) }
}

export default function FacebookBtn() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  const signingInRef = useRef(false)
  const redirectProcessingRef = useRef(false)
  const completedUserRef = useRef<string | null>(null)

  const handleAuthenticatedUser = useCallback(
    async (user: User) => {
      if (completedUserRef.current === user.uid) return

      completedUserRef.current = user.uid

      try {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        let userRole = 'student'

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            fullName: user.displayName || 'Facebook User',
            email: user.email || '',
            role: 'student',
            isInstructorVerified: false,
            verificationStatus: 'none',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        } else {
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

        setTimeout(() => {
          router.push(redirectPath)
        }, 1000)
      } catch (error) {
        completedUserRef.current = null
        throw error
      }
    },
    [router]
  )

  useEffect(() => {
    let active = true

    if (!shouldUseRedirect()) {
      return () => {
        active = false
      }
    }

    if (redirectProcessingRef.current) {
      return () => {
        active = false
      }
    }

    redirectProcessingRef.current = true

    const processRedirect = async () => {
      try {
        const result = await getRedirectResult(auth)

        if (!active || !result) return

        console.info(
          '[Facebook Auth] Redirect authentication succeeded'
        )

        await handleAuthenticatedUser(result.user)
      } catch (error: unknown) {
        if (!active) return

        const err = getError(error)

        console.error(
          '[Facebook Auth] Redirect failed:',
          err.code,
          err.message
        )

        playSound('failed')

        toast.error(
          err.message ||
          'Facebook redirect authentication failed.'
        )
      } finally {
        redirectProcessingRef.current = false
      }
    }

    void processRedirect()

    return () => {
      active = false
    }
  }, [handleAuthenticatedUser])

  const handleFacebookSignIn = async () => {
    if (signingInRef.current) return

    signingInRef.current = true
    setLoading(true)

    try {
      const provider = new FacebookAuthProvider()

      provider.addScope('email')

      const redirect = shouldUseRedirect()

      console.info('[Facebook Auth] Login method:', {
        method: redirect ? 'redirect' : 'popup',
        mobile: isMobileDevice(),
        mobileChrome: isMobileChrome(),
        inAppBrowser: isInAppBrowser(),
      })

      if (redirect) {
        // Preserve the working Messenger/Facebook login flow.
        await signInWithRedirect(auth, provider)
        return
      }

      // Match Google's popup-based authentication on Chrome.
      const result = await signInWithPopup(auth, provider)

      await handleAuthenticatedUser(result.user)
    } catch (error: unknown) {
      const err = getError(error)

      console.error(
        '[Facebook Auth] Login failed:',
        err.code,
        err.message
      )

      if (err.code === 'auth/cancelled-popup-request') {
        return
      }

      if (err.code === 'auth/popup-closed-by-user') {
        toast.info('Facebook login was cancelled.')
        return
      }

      playSound('failed')

      if (err.code === 'auth/popup-blocked') {
        toast.error(
          'Your browser blocked the Facebook login window. Please allow popups for GradeSync.'
        )
      } else if (err.code === 'auth/unauthorized-domain') {
        toast.error(
          'This website domain is not authorized in Firebase Authentication.'
        )
      } else if (
        err.code === 'auth/account-exists-with-different-credential'
      ) {
        toast.error(
          'An account already exists with this email using another login method.'
        )
      } else if (err.code === 'auth/operation-not-allowed') {
        toast.error(
          'Facebook authentication is not enabled in Firebase.'
        )
      } else if (err.code === 'auth/network-request-failed') {
        toast.error(
          'Network error. Please check your internet connection.'
        )
      } else if (err.code === 'auth/missing-initial-state') {
        toast.error(
          'Firebase could not restore the Facebook authentication session.'
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
