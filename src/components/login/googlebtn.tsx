
'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
  type UserCredential,
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
import { createServerSession } from '@/lib/create-session'

// --------------------------------------------------
// BROWSER DETECTION
// --------------------------------------------------

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

// --------------------------------------------------
// SOUNDS
// --------------------------------------------------

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

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

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

// --------------------------------------------------
// GOOGLE ACCOUNT INFORMATION
// --------------------------------------------------

function getText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getGoogleEmail(user: User): string {
  const googleProvider = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  return (
    getText(googleProvider?.email) ||
    getText(user.email) ||
    getText(
      user.providerData.find(
        (provider) => Boolean(provider.email)
      )?.email
    )
  )
}

function getGoogleName(user: User): string {
  const googleProvider = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  return (
    getText(user.displayName) ||
    getText(googleProvider?.displayName) ||
    'Google User'
  )
}

function getGooglePhoto(user: User): string {
  const googleProvider = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  return (
    getText(user.photoURL) ||
    getText(googleProvider?.photoURL)
  )
}

// --------------------------------------------------
// EXTRACT EMAIL FROM GOOGLE ID TOKEN
// --------------------------------------------------

function getEmailFromGoogleCredential(
  result: UserCredential
): string {
  try {
    const credential =
      GoogleAuthProvider.credentialFromResult(result)

    if (!credential?.idToken) {
      return ''
    }

    const tokenParts = credential.idToken.split('.')

    if (tokenParts.length !== 3) {
      return ''
    }

    const payload = tokenParts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const decoded = JSON.parse(
      atob(payload)
    ) as {
      email?: string
      email_verified?: boolean
    }

    // The token is issued by Google's sign-in flow.
    // Firebase Authentication verifies the credential.
    // This decode is used only to obtain the email,
    // not as an independent authorization check.
    return getText(decoded.email)
  } catch (error) {
    console.warn(
      '[Google Auth] Could not extract email from Google credential:',
      error
    )

    return ''
  }
}

// --------------------------------------------------
// RESOLVE AUTHENTICATED GOOGLE EMAIL
// --------------------------------------------------

function resolveGoogleEmail(
  result: UserCredential
): string {
  return (
    getGoogleEmail(result.user) ||
    getEmailFromGoogleCredential(result)
  )
}

// --------------------------------------------------
// GOOGLE LOGIN BUTTON
// --------------------------------------------------

export default function GoogleBtn() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  const signingInRef = useRef(false)
  const redirectProcessingRef = useRef(false)
  const completedUserRef = useRef<string | null>(null)

  // ------------------------------------------------
  // FIRESTORE ACCOUNT HANDLING + SERVER SESSION
  // ------------------------------------------------

  const handleAuthenticatedUser = useCallback(
    async (
      user: User,
      credentialEmail?: string
    ) => {
      if (completedUserRef.current === user.uid) return

      completedUserRef.current = user.uid

      try {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        let userRole = 'student'

        const googleEmail =
          getText(credentialEmail) ||
          getGoogleEmail(user)

        const googleName = getGoogleName(user)
        const googlePhoto = getGooglePhoto(user)

        // --------------------------------------------
        // VALIDATE EMAIL BEFORE ACCOUNT SYNCHRONIZATION
        // --------------------------------------------

        if (!googleEmail) {
          console.warn(
            '[Google Auth] No email returned by Firebase Auth or Google credential.'
          )
        }

        // --------------------------------------------
        // CREATE NEW USER DOCUMENT
        // --------------------------------------------

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,

            fullName: googleName,
            displayName: googleName,

            email: googleEmail,

            photoURL: googlePhoto,

            role: 'student',

            isInstructorVerified: false,
            verificationStatus: 'none',

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })

          console.info(
            '[Google Auth] New user profile created in Firestore'
          )
        } else {
          // ------------------------------------------
          // UPDATE EXISTING USER EMAIL
          // ------------------------------------------

          const userData = userSnap.data()

          if (userData?.role) {
            userRole = userData.role
          }

          const storedEmail =
            getText(userData?.email)

          const updates: Record<string, unknown> = {}

          // Synchronize the email when Google actually
          // returned one. Never replace an existing
          // email with an empty string.
          if (
            googleEmail &&
            storedEmail !== googleEmail
          ) {
            updates.email = googleEmail
          }

          // Fill missing profile fields without
          // overwriting changes made in Profile.
          if (
            !getText(userData?.fullName) &&
            googleName
          ) {
            updates.fullName = googleName
          }

          if (
            !getText(userData?.displayName) &&
            googleName
          ) {
            updates.displayName = googleName
          }

          if (
            !getText(userData?.photoURL) &&
            googlePhoto
          ) {
            updates.photoURL = googlePhoto
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = serverTimestamp()

            await updateDoc(userRef, updates)

            console.info(
              '[Google Auth] Existing Firestore user profile synchronized'
            )
          }
        }

        console.info(
          '[Google Auth] Firebase authentication successful',
          {
            uid: user.uid,
            role: userRole,
            emailRecorded: Boolean(googleEmail),
          }
        )

        // --------------------------------------------
        // CREATE SECURE SERVER SESSION
        // --------------------------------------------

        // The server verifies the Firebase ID token,
        // checks the user's current Firestore role,
        // and creates an HttpOnly session cookie.
        //
        // Wait until this succeeds before redirecting.
        // The server determines the authorized dashboard.

        console.info(
          '[Google Auth] Creating secure server session'
        )

        const redirectPath =
          await createServerSession(user)

        console.info(
          '[Google Auth] Server session established',
          {
            redirectPath,
          }
        )

        // --------------------------------------------
        // PRESERVE SUCCESS SOUND AND NOTIFICATION
        // --------------------------------------------

        playSound('success')

        toast.success(
          `Welcome back, ${googleName}!`,
          {
            description: 'Redirecting to dashboard...',
          }
        )

        // --------------------------------------------
        // REDIRECT AFTER SERVER SESSION CREATION
        // --------------------------------------------

        setTimeout(() => {
          router.push(redirectPath)
          router.refresh()
        }, 1000)
      } catch (error) {
        completedUserRef.current = null
        throw error
      }
    },
    [router]
  )

  // ------------------------------------------------
  // PRESERVE MOBILE REDIRECT AUTHENTICATION
  // ------------------------------------------------

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

        const googleEmail =
          resolveGoogleEmail(result)

        await handleAuthenticatedUser(
          result.user,
          googleEmail
        )
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

  // ------------------------------------------------
  // MAIN GOOGLE SIGN-IN
  // ------------------------------------------------

  const handleGoogleSignIn = async () => {
    if (signingInRef.current) return

    signingInRef.current = true
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()

      // Request Google account email and profile.
      provider.addScope('email')
      provider.addScope('profile')

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
        // Preserve the Messenger-style redirect flow.
        await signInWithRedirect(auth, provider)
        return
      }

      // Preserve the working Google popup flow on Chrome.
      const result = await signInWithPopup(auth, provider)

      // Extract the authenticated Google account email.
      const googleEmail =
        resolveGoogleEmail(result)

      // Create/update Firestore and server session.
      await handleAuthenticatedUser(
        result.user,
        googleEmail
      )
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

  // --------------------------------------------------
  // BUTTON UI — PRESERVED
  // --------------------------------------------------

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
