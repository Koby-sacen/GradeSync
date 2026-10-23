
import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export type UserRole = 'student' | 'instructor'

export async function requireRole(
  requiredRole: UserRole
): Promise<{
  uid: string
  role: UserRole
}> {
  const cookieStore = await cookies()

  const sessionCookie =
    cookieStore.get('gradesync_session')?.value

  if (!sessionCookie) {
    redirect('/login')
  }

  let uid: string

  try {
    const decoded = await adminAuth.verifySessionCookie(
      sessionCookie,
      true
    )

    uid = decoded.uid
  } catch (error) {
    console.error(
      '[GradeSync] Invalid or expired session:',
      error
    )

    redirect('/login')
  }

  let role: unknown

  try {
    const userDoc = await adminDb
      .collection('users')
      .doc(uid)
      .get()

    if (!userDoc.exists) {
      redirect('/login')
    }

    role = userDoc.data()?.role
  } catch (error) {
    // Preserve Next.js redirects instead of swallowing them.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }

    console.error(
      '[GradeSync] Failed to verify Firestore role:',
      error
    )

    redirect('/login')
  }

  if (role !== 'student' && role !== 'instructor') {
    redirect('/login')
  }

  if (role !== requiredRole) {
    redirect(
      role === 'instructor'
        ? '/instructor/home'
        : '/students/home'
    )
  }

  return {
    uid,
    role,
  }
}
