import { NextRequest, NextResponse } from 'next/server'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import {
  FieldValue,
  getFirestore,
} from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SubjectData = {
  id?: string
  code?: string
  description?: string
  grades?: unknown
  remarks?: unknown
  signature?: unknown
  instructorId?: string
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasValidValue(value: unknown): boolean {
  if (value === null || value === undefined) return false

  if (typeof value === 'boolean') return value

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    return (
      normalized.length > 0 &&
      ![
        '-',
        '—',
        'n/a',
        'na',
        'none',
        'null',
        'undefined',
        'pending',
        'not yet',
        'unsigned',
        'not signed',
        'not graded',
        'not provided',
        'waiting',
      ].includes(normalized)
    )
  }

  if (Array.isArray(value)) {
    return value.some(hasValidValue)
  }

  if (typeof value === 'object') {
    const data = value as Record<string, unknown>

    if (data.signed === false || data.isSigned === false) {
      return false
    }

    if (data.signed === true || data.isSigned === true) {
      return true
    }

    return [
      data.url,
      data.dataUrl,
      data.image,
      data.imageUrl,
      data.value,
      data.text,
      data.signature,
      data.signatureUrl,
      data.signedBy,
    ].some(hasValidValue)
  }

  return false
}

function isSubjectComplete(subject: SubjectData): boolean {
  return (
    hasValidValue(subject.grades) &&
    hasValidValue(subject.remarks) &&
    hasValidValue(subject.signature)
  )
}

function getAdminServices() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not configured.'
    )
  }

  const credentials = JSON.parse(raw) as {
    project_id: string
    client_email: string
    private_key: string
  }

  const app =
    getApps().find((item) => item.name === 'gradesync-admin') ||
    initializeApp(
      {
        credential: cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key.replace(
            /\\n/g,
            '\n'
          ),
        }),
      },
      'gradesync-admin'
    )

  return {
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
  }
}

export async function POST(request: NextRequest) {
  let notificationId = ''
  let claimedNotification = false

  try {
    const authorization = request.headers.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication is required.' },
        { status: 401 }
      )
    }

    const token = authorization.slice(7).trim()

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid authentication token.' },
        { status: 401 }
      )
    }

    const { adminAuth, adminDb } = getAdminServices()

    const decodedToken = await adminAuth.verifyIdToken(token)

    const instructorUid = decodedToken.uid

    const instructorSnapshot = await adminDb
      .collection('users')
      .doc(instructorUid)
      .get()

    if (
      !instructorSnapshot.exists ||
      getText(instructorSnapshot.data()?.role).toLowerCase() !==
        'instructor'
    ) {
      return NextResponse.json(
        { error: 'Instructor access is required.' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const requestId =
      typeof body?.requestId === 'string'
        ? body.requestId.trim()
        : ''

    if (
      !requestId ||
      requestId.includes('/') ||
      requestId.length > 200
    ) {
      return NextResponse.json(
        { error: 'Invalid clearance request ID.' },
        { status: 400 }
      )
    }

    const clearanceSnapshot = await adminDb
      .collection('requests')
      .doc(requestId)
      .get()

    if (!clearanceSnapshot.exists) {
      return NextResponse.json(
        { error: 'Clearance request was not found.' },
        { status: 404 }
      )
    }

    const clearance = clearanceSnapshot.data() || {}

    const subjects: SubjectData[] = Array.isArray(
      clearance.subjects
    )
      ? clearance.subjects
      : []

    const assignedSubjects = subjects.filter(
      (subject) => subject.instructorId === instructorUid
    )

    if (assignedSubjects.length === 0) {
      return NextResponse.json(
        {
          error:
            'This clearance is not assigned to your instructor account.',
        },
        { status: 403 }
      )
    }

    // Send only when the entire student clearance is complete
    const entireClearanceComplete =
      subjects.length > 0 &&
      subjects.every(isSubjectComplete)

    if (!entireClearanceComplete) {
      return NextResponse.json(
        {
          sent: false,
          reason: 'incomplete',
          message:
            'The entire student clearance is not yet complete. Every subject must have a grade, remarks, and an e-signature before an email can be sent.',
          totalSubjects: subjects.length,
          completedSubjects: subjects.filter(isSubjectComplete).length,
        },
        { status: 200 }
      )
    }

    const studentUid = getText(clearance.studentUid)

    let studentEmail = getText(clearance.studentEmail)

    let studentName =
      getText(clearance.studentName) ||
      'Student'

    if (studentUid) {
      const studentSnapshot = await adminDb
        .collection('users')
        .doc(studentUid)
        .get()

      if (studentSnapshot.exists) {
        const studentData = studentSnapshot.data() || {}

        studentEmail =
          getText(studentData.email) ||
          studentEmail

        studentName =
          getText(studentData.displayName) ||
          getText(studentData.fullName) ||
          getText(studentData.name) ||
          studentName
      }
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)
    ) {
      return NextResponse.json(
        {
          sent: false,
          reason: 'missing_email',
          message:
            'The student does not have a valid email address.',
        },
        { status: 200 }
      )
    }

    const instructorData =
      instructorSnapshot.data() || {}

    const instructorName =
      getText(instructorData.displayName) ||
      getText(instructorData.fullName) ||
      getText(instructorData.name) ||
      'Your Instructor'

    const subjectNames = subjects
      .map((subject) => {
        const code = getText(subject.code)
        const description = getText(subject.description)

        return [code, description]
          .filter(Boolean)
          .join(' - ')
      })
      .filter(Boolean)
      .join('\n')

    const serviceId = process.env.EMAILJS_SERVICE_ID
    const templateId = process.env.EMAILJS_TEMPLATE_ID
    const publicKey = process.env.EMAILJS_PUBLIC_KEY
    const privateKey = process.env.EMAILJS_PRIVATE_KEY

    if (
      !serviceId ||
      !templateId ||
      !publicKey ||
      !privateKey
    ) {
      throw new Error(
        'EmailJS server environment variables are incomplete.'
      )
    }

    // One notification record per entire student clearance
    notificationId = requestId

    const notificationRef = adminDb
      .collection('clearanceEmailNotifications')
      .doc(notificationId)

    const claimResult = await adminDb.runTransaction(
      async (transaction) => {
        const notificationSnapshot =
          await transaction.get(notificationRef)

        if (notificationSnapshot.exists) {
          const previous =
            notificationSnapshot.data() || {}

          if (previous.status === 'sent') {
            return 'already_sent'
          }

          if (previous.status === 'sending') {
            return 'in_progress'
          }

          if (previous.status === 'failed') {
            const lastAttempt = previous.attemptedAt

            const lastAttemptMillis =
              typeof lastAttempt?.toMillis === 'function'
                ? lastAttempt.toMillis()
                : 0

            if (
              Date.now() - lastAttemptMillis <
              60_000
            ) {
              return 'retry_later'
            }
          }
        }

        transaction.set(
          notificationRef,
          {
            clearanceId: requestId,
            instructorUid,
            studentUid,
            studentEmail,
            studentName,
            instructorName,
            subjectNames,
            totalSubjects: subjects.length,
            completedSubjects: subjects.length,
            status: 'sending',
            attemptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )

        return 'claimed'
      }
    )

    if (claimResult !== 'claimed') {
      return NextResponse.json({
        sent: claimResult === 'already_sent',
        reason: claimResult,
        message:
          claimResult === 'already_sent'
            ? 'The student has already received the full clearance completion email.'
            : claimResult === 'in_progress'
              ? 'A clearance completion email is already being processed.'
              : 'Please wait before retrying the email.',
      })
    }

    claimedNotification = true

    const emailResponse = await fetch(
      'https://api.emailjs.com/api/v1.0/email/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_email: studentEmail,
            email: studentEmail,
            student_email: studentEmail,
            to_name: studentName,
            name: studentName,
            student_name: studentName,
            instructor_name: instructorName,
            subject_names: subjectNames,
            subject: subjectNames,
            clearance_id: requestId,
            status: 'Completed',
            total_subjects: subjects.length,
            completed_subjects: subjects.length,
            message:
              `Hello ${studentName}, your entire student clearance ` +
              `has been successfully completed. All ${subjects.length} ` +
              `subjects have been graded, provided with remarks, ` +
              `and signed by their assigned instructors. ` +
              `Please sign in to GradeSync to view your completed clearance.`,
          },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    )

    const emailResponseText =
      await emailResponse.text()

    if (!emailResponse.ok) {
      throw new Error(
        `EmailJS rejected the request (${emailResponse.status}): ${emailResponseText}`
      )
    }

    await notificationRef.set(
      {
        status: 'sent',
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return NextResponse.json({
      sent: true,
      studentEmail,
      totalSubjects: subjects.length,
      completedSubjects: subjects.length,
      message:
        'The full clearance completion email was sent successfully.',
    })
  } catch (error) {
    console.error(
      '[GradeSync Clearance Email] Error:',
      error
    )

    if (claimedNotification && notificationId) {
      try {
        const { adminDb } = getAdminServices()

        await adminDb
          .collection('clearanceEmailNotifications')
          .doc(notificationId)
          .set(
            {
              status: 'failed',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
      } catch (updateError) {
        console.error(
          '[GradeSync Clearance Email] Status update failed:',
          updateError
        )
      }
    }

    return NextResponse.json(
      {
        sent: false,
        error:
          'The email could not be sent. The saved clearance was not reversed.',
      },
      { status: 500 }
    )
  }
}