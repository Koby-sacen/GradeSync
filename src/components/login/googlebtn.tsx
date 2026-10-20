'use client'

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { auth, db } from '@/lib/firebase'

export default function GoogleBtn() {
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    try {
      // Clear current Firebase session to force account selection dialog
      await signOut(auth).catch(() => {})

      const provider = new GoogleAuthProvider()
      // Force Google to prompt account selection every time
      provider.setCustomParameters({
        prompt: 'select_account',
      })

      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      let userRole = 'student'

      if (!userSnap.exists()) {
        // Save new user document along with their Gmail address
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

        // Keep existing records updated with email if it was previously missing
        if (user.email && userData?.email !== user.email) {
          await updateDoc(userRef, {
            email: user.email,
            updatedAt: serverTimestamp(),
          })
        }
      }

      const successAudio = new Audio('/sounds/success.mp3')
      successAudio.play().catch((error) => console.warn('Audio playback prevented:', error))

      toast.success(`Welcome back, ${user.displayName || 'User'}!`, {
        description: 'Redirecting to dashboard...',
      })

      // Dynamic redirect based on role
      const redirectPath = userRole === 'instructor' ? '/instructor/home' : '/students/home'

      setTimeout(() => {
        router.push(redirectPath)
      }, 1000)
    } catch (error) {
      console.error('Google sign-in error:', error)

      const failedAudio = new Audio('/sounds/failed.mp3')
      failedAudio.play().catch((err) => console.warn('Audio playback prevented:', err))

      toast.error('Failed to sign in. Please try again.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.99]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 48 48"
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

      Continue with Google
    </button>
  )
}