
'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
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
import { createServerSession } from '@/lib/create-session'

// --------------------------------------------------
// FACEBOOK CONFIGURATION
// --------------------------------------------------

const FACEBOOK_APP_ID = '1350948810219370'

const FACEBOOK_SDK_URL =
  'https://connect.facebook.net/en_US/sdk.js'

const FACEBOOK_SDK_VERSION = 'v23.0'

// --------------------------------------------------
// FACEBOOK JAVASCRIPT SDK TYPES
// --------------------------------------------------

type FacebookAuthResponse = {
  accessToken: string
  userID: string
  expiresIn?: number
  signedRequest?: string
}

type FacebookLoginResponse = {
  status?: string
  authResponse?: FacebookAuthResponse | null
}

type FacebookSDK = {
  init: (options: {
    appId: string
    cookie: boolean
    xfbml: boolean
    version: string
  }) => void

  login: (
    callback: (response: FacebookLoginResponse) => void,
    options?: {
      scope?: string
      return_scopes?: boolean
    }
  ) => void
}

declare global {
  interface Window {
    FB?: FacebookSDK
    fbAsyncInit?: () => void
  }
}

// --------------------------------------------------
// BROWSER DETECTION
// --------------------------------------------------

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger|Orca/i.test(
    navigator.userAgent
  )
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

function isAndroidChrome(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent

  const android = /Android/i.test(ua)
  const chrome = /Chrome/i.test(ua)

  const otherBrowser =
    /EdgA|OPR|OPT|SamsungBrowser|UCBrowser|Firefox|FxiOS/i.test(
      ua
    )

  return (
    android &&
    chrome &&
    !otherBrowser &&
    !isInAppBrowser()
  )
}

// Android Chrome: Facebook JavaScript SDK
// Messenger/mobile: Firebase redirect
// Desktop: Firebase popup

function getLoginMethod():
  | 'facebook-sdk'
  | 'firebase-redirect'
  | 'firebase-popup' {
  if (isAndroidChrome()) {
    return 'facebook-sdk'
  }

  if (isMobileDevice() || isInAppBrowser()) {
    return 'firebase-redirect'
  }

  return 'firebase-popup'
}

// --------------------------------------------------
// FACEBOOK SDK LOADER
// --------------------------------------------------

let facebookSDKPromise: Promise<FacebookSDK> | null = null

function loadFacebookSDK(): Promise<FacebookSDK> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Facebook SDK requires a browser.')
    )
  }

  if (window.FB) {
    return Promise.resolve(window.FB)
  }

  if (facebookSDKPromise) {
    return facebookSDKPromise
  }

  facebookSDKPromise = new Promise<FacebookSDK>(
    (resolve, reject) => {
      const scriptId = 'facebook-jssdk'

      const timeout = window.setTimeout(() => {
        facebookSDKPromise = null

        reject(
          new Error(
            'Facebook SDK loading timed out. Please check your connection.'
          )
        )
      }, 20000)

      const finish = (sdk: FacebookSDK) => {
        window.clearTimeout(timeout)
        resolve(sdk)
      }

      const fail = (error: Error) => {
        window.clearTimeout(timeout)
        facebookSDKPromise = null
        reject(error)
      }

      window.fbAsyncInit = () => {
        try {
          if (!window.FB) {
            fail(
              new Error(
                'Facebook SDK was loaded but is unavailable.'
              )
            )
            return
          }

          window.FB.init({
            appId: FACEBOOK_APP_ID,
            cookie: true,
            xfbml: false,
            version: FACEBOOK_SDK_VERSION,
          })

          console.info(
            '[Facebook Auth] JavaScript SDK initialized'
          )

          finish(window.FB)
        } catch (error) {
          fail(
            error instanceof Error
              ? error
              : new Error('Facebook SDK initialization failed.')
          )
        }
      }

      const existingScript =
        document.getElementById(scriptId)

      if (existingScript) {
        if (window.FB) {
          window.fbAsyncInit()
        }

        return
      }

      const script = document.createElement('script')

      script.id = scriptId
      script.src = FACEBOOK_SDK_URL
      script.async = true
      script.defer = true
      script.crossOrigin = 'anonymous'

      script.onerror = () => {
        script.remove()

        fail(
          new Error(
            'Unable to load Facebook JavaScript SDK.'
          )
        )
      }

      document.head.appendChild(script)
    }
  )

  return facebookSDKPromise
}

// --------------------------------------------------
// FACEBOOK SDK LOGIN
// --------------------------------------------------

function loginWithFacebookSDK(
  sdk: FacebookSDK
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let finished = false

    const timeout = window.setTimeout(() => {
      if (finished) return

      finished = true

      reject(
        new Error(
          'Facebook login timed out. Please try again.'
        )
      )
    }, 90000)

    const complete = (
      error: Error | null,
      accessToken?: string
    ) => {
      if (finished) return

      finished = true
      window.clearTimeout(timeout)

      if (error) {
        reject(error)
        return
      }

      if (!accessToken) {
        reject(
          new Error(
            'Facebook did not return an access token.'
          )
        )
        return
      }

      resolve(accessToken)
    }

    try {
      // Must be initiated from the login button.
      sdk.login(
        (response) => {
          console.info(
            '[Facebook Auth] SDK response status:',
            response?.status || 'unknown'
          )

          const accessToken =
            response?.authResponse?.accessToken

          if (accessToken) {
            complete(null, accessToken)
            return
          }

          complete(
            new Error(
              'Facebook login was cancelled, blocked, or did not return authorization.'
            )
          )
        },
        {
          scope: 'email,public_profile',
          return_scopes: true,
        }
      )
    } catch (error) {
      complete(
        error instanceof Error
          ? error
          : new Error('Facebook SDK login failed.')
      )
    }
  })
}

// --------------------------------------------------
// SOUNDS
// --------------------------------------------------

function playSound(type: 'success' | 'failed') {
  try {
    const audio = new Audio(`/sounds/${type}.mp3`)

    audio.play().catch((error) => {
      console.warn(
        '[Facebook Auth] Audio playback prevented:',
        error
      )
    })
  } catch (error) {
    console.warn(
      '[Facebook Auth] Audio playback unavailable:',
      error
    )
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

  return {
    message: String(error),
  }
}

function showFacebookError(error: unknown) {
  const err = getError(error)

  console.error(
    '[Facebook Auth] Authentication failed:',
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
  } else if (err.code === 'auth/invalid-credential') {
    toast.error(
      'Facebook returned an invalid or expired credential.'
    )
  } else {
    toast.error(
      err.message ||
      'Failed to sign in with Facebook. Please try again.'
    )
  }
}

// --------------------------------------------------
// FACEBOOK BUTTON
// --------------------------------------------------

export default function FacebookBtn() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  const [sdkReady, setSdkReady] = useState(false)

  const [sdkLoading, setSdkLoading] = useState(false)

  const [sdkError, setSdkError] = useState<string | null>(
    null
  )

  const signingInRef = useRef(false)

  const redirectProcessingRef = useRef(false)

  const completedUserRef = useRef<string | null>(null)

  // ------------------------------------------------
  // FIRESTORE ACCOUNT HANDLING + SERVER SESSION
  // ------------------------------------------------

  const handleAuthenticatedUser = useCallback(
    async (user: User) => {
      if (completedUserRef.current === user.uid) {
        return
      }

      completedUserRef.current = user.uid

      try {
        const userRef = doc(db, 'users', user.uid)

        const userSnap = await getDoc(userRef)

        let userRole = 'student'

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            fullName:
              user.displayName || 'Facebook User',
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

        console.info(
          '[Facebook Auth] Firebase authentication successful',
          {
            uid: user.uid,
            role: userRole,
          }
        )

        // --------------------------------------------
        // NEW: CREATE SECURE SERVER SESSION
        // --------------------------------------------

        // The server verifies the Firebase ID token,
        // retrieves the current role from Firestore,
        // and creates an HttpOnly session cookie.
        //
        // Wait until this succeeds before redirecting.
        // Do not rely on the client-side role alone.

        console.info(
          '[Facebook Auth] Creating secure server session'
        )

        const redirectPath =
          await createServerSession(user)

        console.info(
          '[Facebook Auth] Server session established',
          {
            redirectPath,
          }
        )

        // --------------------------------------------
        // PRESERVE SUCCESS SOUND AND TOAST
        // --------------------------------------------

        playSound('success')

        toast.success(
          `Welcome back, ${user.displayName || 'User'}!`,
          {
            description: 'Redirecting to dashboard...',
          }
        )

        // --------------------------------------------
        // REDIRECT AFTER SESSION CREATION
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
  // PRELOAD FACEBOOK SDK ON ANDROID CHROME
  // ------------------------------------------------

  useEffect(() => {
    if (!isAndroidChrome()) {
      return
    }

    let active = true

    const prepareSDK = async () => {
      setSdkLoading(true)

      try {
        await loadFacebookSDK()

        if (!active) return

        setSdkReady(true)
        setSdkError(null)

        console.info(
          '[Facebook Auth] Android Chrome SDK ready'
        )
      } catch (error) {
        if (!active) return

        const err = getError(error)

        setSdkReady(false)

        setSdkError(
          err.message ||
          'Unable to initialize Facebook login.'
        )

        console.error(
          '[Facebook Auth] SDK initialization failed:',
          error
        )
      } finally {
        if (active) {
          setSdkLoading(false)
        }
      }
    }

    void prepareSDK()

    return () => {
      active = false
    }
  }, [])

  // ------------------------------------------------
  // PRESERVE MESSENGER REDIRECT LOGIN
  // ------------------------------------------------

  useEffect(() => {
    if (getLoginMethod() !== 'firebase-redirect') {
      return
    }

    let active = true

    if (redirectProcessingRef.current) {
      return
    }

    redirectProcessingRef.current = true

    const processRedirect = async () => {
      try {
        console.info(
          '[Facebook Auth] Checking Firebase redirect'
        )

        const result = await getRedirectResult(auth)

        if (!active || !result) {
          return
        }

        if (result.providerId !== 'facebook.com') {
          return
        }

        console.info(
          '[Facebook Auth] Facebook redirect succeeded'
        )

        await handleAuthenticatedUser(result.user)
      } catch (error) {
        if (!active) return

        showFacebookError(error)
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
  // ANDROID CHROME:
  // FACEBOOK SDK -> FIREBASE CREDENTIAL
  // ------------------------------------------------

  const handleAndroidChromeLogin = async () => {
    if (!sdkReady || !window.FB) {
      throw new Error(
        sdkError ||
        'Facebook login is still initializing. Please try again.'
      )
    }

    console.info(
      '[Facebook Auth] Using Facebook JavaScript SDK'
    )

    // Obtain a Facebook access token without calling
    // Firebase signInWithPopup or signInWithRedirect.

    const accessToken = await loginWithFacebookSDK(
      window.FB
    )

    console.info(
      '[Facebook Auth] Facebook access token received'
    )

    // Never log the access token itself.

    const credential =
      FacebookAuthProvider.credential(accessToken)

    // Authenticate directly with Firebase.

    const result = await signInWithCredential(
      auth,
      credential
    )

    console.info(
      '[Facebook Auth] Firebase credential accepted'
    )

    // Also creates the server session before redirecting.

    await handleAuthenticatedUser(result.user)
  }

  // ------------------------------------------------
  // MAIN FACEBOOK SIGN-IN
  // ------------------------------------------------

  const handleFacebookSignIn = async () => {
    if (signingInRef.current) {
      return
    }

    signingInRef.current = true
    setLoading(true)

    let redirectStarted = false

    try {
      const method = getLoginMethod()

      console.info(
        '[Facebook Auth] Selected login method:',
        {
          method,
          mobile: isMobileDevice(),
          androidChrome: isAndroidChrome(),
          inAppBrowser: isInAppBrowser(),
          authDomain: auth.app.options.authDomain,
        }
      )

      // Android Chrome uses the alternative
      // Facebook JavaScript SDK authentication.

      if (method === 'facebook-sdk') {
        await handleAndroidChromeLogin()
        return
      }

      const provider = new FacebookAuthProvider()

      provider.addScope('email')

      // Messenger and other mobile browsers retain
      // their existing Firebase redirect process.

      if (method === 'firebase-redirect') {
        console.info(
          '[Facebook Auth] Starting Firebase redirect'
        )

        await signInWithRedirect(auth, provider)

        redirectStarted = true
        return
      }

      // Desktop retains its existing working popup.

      console.info(
        '[Facebook Auth] Starting Firebase popup'
      )

      const result = await signInWithPopup(
        auth,
        provider
      )

      // Creates the server session after login.

      await handleAuthenticatedUser(result.user)
    } catch (error) {
      showFacebookError(error)
    } finally {
      if (!redirectStarted) {
        signingInRef.current = false
        setLoading(false)
      }
    }
  }

  // ------------------------------------------------
  // BUTTON UI
  // ------------------------------------------------

  const androidChrome =
    typeof navigator !== 'undefined' &&
    isAndroidChrome()

  const buttonDisabled =
    loading ||
    (androidChrome && sdkLoading)

  const buttonText = loading
    ? 'Connecting to Facebook...'
    : androidChrome && sdkLoading
      ? 'Preparing Facebook Login...'
      : 'Continue with Facebook'

  return (
    <button
      type="button"
      onClick={handleFacebookSignIn}
      disabled={buttonDisabled}
      aria-busy={buttonDisabled}
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

      {buttonText}
    </button>
  )
}
