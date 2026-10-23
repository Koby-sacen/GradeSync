
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
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

export default function GoogleBtn() {
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
            fullName: user.displayName || 'Google User',
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

          // Preserve existing email synchronization.
          if (user.email && userData?.email !== user.email) {
            await updateDoc(userRef, {
              email: user.email,
              updatedAt: serverTimestamp(),
            })
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
          '[Google Auth] Redirect authentication succeeded'
        )

        await handleAuthenticatedUser(result.user)
      } catch (error: unknown) {
        if (!active) return

        const err = getError(error)

        console.error(
          '[Google Auth] Redirect failed:',
          err.code,
          err.message
        )

        playSound('failed')

        toast.error(
          err.message ||
          'Google redirect authentication failed.'
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

  const handleGoogleSignIn = async () => {
    if (signingInRef.current) return

    signingInRef.current = true
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()

      provider.setCustomParameters({
        prompt: 'select_account',
      })

      const redirect = shouldUseRedirect()

      console.info('[Google Auth] Login method:', {
        method: redirect ? 'redirect' : 'popup',
        mobile: isMobileDevice(),
        mobileChrome: isMobileChrome(),
        inAppBrowser: isInAppBrowser(),
      })

      if (redirect) {
        // Use the Messenger-style redirect flow.
        await signInWithRedirect(auth, provider)
        return
      }

      // Preserve the working Google popup flow on Chrome.
      const result = await signInWithPopup(auth, provider)

      await handleAuthenticatedUser(result.user)
    } catch (error: unknown) {
      const err = getError(error)

      console.error(
        '[Google Auth] Login failed:',
        err.code,
        err.message
      )

      if (err.code === 'auth/cancelled-popup-request') {
        return
      }

      if (err.code === 'auth/popup-closed-by-user') {
        toast.info('Google login was cancelled.')
        return
      }

      playSound('failed')

      if (err.code === 'auth/popup-blocked') {
        toast.error(
          'Your browser blocked the Google login window. Please allow popups for GradeSync.'
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
          'Google authentication is not enabled in Firebase.'
        )
      } else if (err.code === 'auth/network-request-failed') {
        toast.error(
          'Network error. Please check your internet connection.'
        )
      } else if (err.code === 'auth/missing-initial-state') {
        toast.error(
          'Firebase could not restore the Google authentication session.'
        )
      } else {
        toast.error(
          err.message ||
          'Failed to sign in with Google. Please try again.'
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
      onClick={handleGoogleSignIn}
      disabled={loading}
      aria-busy={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6C44.42 37.92 46.98 31.73 46.98 24.55Z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.93 23.93 0 0 0 0 24c0 3.88.93 7.55 2.56 10.78l7.97-6.19Z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6-2.14 1.45-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
        />
      </svg>

      {loading
        ? 'Connecting to Google...'
        : 'Continue with Google'}
    </button>
  )
}
