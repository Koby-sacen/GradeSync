
'use client'

import { useEffect, useRef, useState } from 'react'
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

export default function FacebookBtn() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const signingInRef = useRef(false)
  const processingRedirectRef = useRef(false)

  // Play original success and failure sounds
  const playSound = (type: 'success' | 'failed') => {
    try {
      const audio = new Audio(`/sounds/${type}.mp3`)

      audio.play().catch((error) => {
        console.warn('Audio playback prevented:', error)
      })
    } catch (error) {
      console.warn('Audio playback unavailable:', error)
    }
  }

  // Detect Facebook and Messenger in-app browsers
  const isFacebookOrMessengerBrowser = () => {
    if (typeof navigator === 'undefined') {
      return false
    }

    const userAgent = navigator.userAgent

    return /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger|Orca/i.test(
      userAgent
    )
  }

  // Detect mobile devices
  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') {
      return false
    }

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  }

  // Detect mobile Chrome
  const isMobileChrome = () => {
    if (typeof navigator === 'undefined') {
      return false
    }

    const userAgent = navigator.userAgent

    const isAndroidChrome =
      /Android/i.test(userAgent) &&
      /Chrome|CriOS/i.test(userAgent)

    const isIOSChrome =
      /iPhone|iPad|iPod/i.test(userAgent) &&
      /CriOS/i.test(userAgent)

    const isOtherBrowser =
      /EdgA|EdgiOS|OPR|OPT|SamsungBrowser|UCBrowser/i.test(
        userAgent
      )

    return (
      (isAndroidChrome || isIOSChrome) &&
      !isOtherBrowser &&
      !isFacebookOrMessengerBrowser()
    )
  }

  // Shared successful authentication handler
  // Preserves your original Firestore behavior
  const handleAuthenticatedUser = async (user: User) => {
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
  }

  // Preserve redirect result handling for
  // Facebook and Messenger in-app browsers
  useEffect(() => {
    let isMounted = true

    // Only process redirect results in browsers
    // that still use the original redirect flow.
    if (isMobileChrome()) {
      return () => {
        isMounted = false
      }
    }

    if (processingRedirectRef.current) {
      return () => {
        isMounted = false
      }
    }

    processingRedirectRef.current = true

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || !isMounted) {
          return
        }

        await handleAuthenticatedUser(result.user)
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return
        }

        const err = error as {
          code?: string
          message?: string
        }

        console.error(
          'Facebook redirect sign-in error:',
          err
        )

        playSound('failed')

        if (
          err.code === 'auth/missing-initial-state' ||
          err.code === 'auth/invalid-credential'
        ) {
          toast.error(
            'Facebook login session could not be restored. Please try signing in again.'
          )
        } else {
          toast.error(
            err.message ||
            'Failed to sign in with Facebook. Please try again.'
          )
        }
      })
      .finally(() => {
        processingRedirectRef.current = false
      })

    return () => {
      isMounted = false
    }
    // Run redirect processing when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Facebook sign-in
  const handleFacebookSignIn = async () => {
    if (signingInRef.current) {
      return
    }

    signingInRef.current = true
    setLoading(true)

    try {
      const provider = new FacebookAuthProvider()

      provider.addScope('email')
      provider.addScope('public_profile')

      const mobile = isMobileDevice()
      const mobileChrome = isMobileChrome()
      const inAppBrowser = isFacebookOrMessengerBrowser()

      console.log('Facebook authentication browser:', {
        mobile,
        mobileChrome,
        inAppBrowser,
      })

      // IMPORTANT:
      // Preserve the original redirect authentication
      // for Facebook and Messenger in-app browsers.
      //
      // Also preserve redirect for other mobile browsers
      // except Chrome, matching your original behavior.
      if (mobile && !mobileChrome) {
        await signInWithRedirect(auth, provider)
        return
      }

      // FIX:
      // Mobile Chrome uses popup authentication.
      // Desktop browsers continue using popup.
      //
      // This avoids the mobile Chrome redirect flow
      // that was producing missing initial state.
      const result = await signInWithPopup(auth, provider)

      await handleAuthenticatedUser(result.user)
    } catch (error: unknown) {
      const err = error as {
        code?: string
        message?: string
      }

      console.error('Facebook sign-in error:', err)

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
          'Chrome blocked the Facebook login popup. Please allow popups for this website.'
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
      } else if (
        err.code === 'auth/missing-initial-state'
      ) {
        toast.error(
          'Firebase could not restore the Facebook login session. Please check your browser storage settings.'
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
