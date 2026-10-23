
import type { User } from 'firebase/auth'

type SessionResponse = {
  success?: boolean
  role?: 'student' | 'instructor'
  redirectPath?: string
  error?: string
}

export async function createServerSession(
  user: User
): Promise<string> {
  const idToken = await user.getIdToken()

  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ idToken }),
  })

  const result: SessionResponse = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(
      result.error || 'Failed to establish a secure session.'
    )
  }

  if (
    result.redirectPath !== '/students/home' &&
    result.redirectPath !== '/instructor/home'
  ) {
    throw new Error('Invalid dashboard redirect path.')
  }

  return result.redirectPath
}
