
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

const SESSION_DURATION = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin')

    if (origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: 'Invalid request origin.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const idToken = body?.idToken

    if (typeof idToken !== 'string' || !idToken) {
      return NextResponse.json(
        { error: 'Missing authentication token.' },
        { status: 400 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true)

    // Require a recent sign-in before creating the session.
    const now = Math.floor(Date.now() / 1000)

    if (
      typeof decoded.auth_time !== 'number' ||
      decoded.auth_time > now + 60 ||
      now - decoded.auth_time > 300
    ) {
      return NextResponse.json(
        {
          error: 'Authentication is too old. Please sign in again.',
        },
        { status: 401 }
      )
    }

    const profile = await adminDb
      .collection('users')
      .doc(decoded.uid)
      .get()

    if (!profile.exists) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 403 }
      )
    }

    const role = profile.data()?.role

    if (role !== 'student' && role !== 'instructor') {
      return NextResponse.json(
        { error: 'Invalid account role.' },
        { status: 403 }
      )
    }

    const sessionCookie = await adminAuth.createSessionCookie(
      idToken,
      { expiresIn: SESSION_DURATION }
    )

    const response = NextResponse.json({
      success: true,
      role,
      redirectPath:
        role === 'instructor'
          ? '/instructor/home'
          : '/students/home',
    })

    response.cookies.set({
      name: 'gradesync_session',
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION / 1000,
    })

    response.headers.set('Cache-Control', 'no-store')

    return response
  } catch (error) {
    console.error('[Session] Failed to create session:', error)

    return NextResponse.json(
      { error: 'Unable to create a secure session.' },
      { status: 401 }
    )
  }
}
