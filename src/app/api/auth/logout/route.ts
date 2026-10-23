
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403 }
    )
  }

  const response = NextResponse.json({
    success: true,
    message: 'Server session cleared.',
  })

  response.cookies.set({
    name: 'gradesync_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.headers.set('Cache-Control', 'no-store')

  return response
}
