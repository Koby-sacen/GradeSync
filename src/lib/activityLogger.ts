
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'

import type { User } from 'firebase/auth'

import { db } from '@/lib/firebase'

export type ActivityCategory =
  | 'signature'
  | 'clearance'
  | 'document'
  | 'other'

export type ActivityStatus =
  | 'success'
  | 'failed'

export interface ActivityLogInput {
  actor: User

  action: string
  category: ActivityCategory
  description: string

  status?: ActivityStatus

  studentName?: string
  studentUid?: string
  subjectCode?: string
  clearanceId?: string
  signatureId?: string
}

export async function logInstructorActivity(
  input: ActivityLogInput
): Promise<string> {
  const {
    actor,
    action,
    category,
    description,
    status = 'success',
    studentName = '',
    studentUid = '',
    subjectCode = '',
    clearanceId = '',
    signatureId = '',
  } = input

  const activityRef = await addDoc(
    collection(db, 'activities'),
    {
      actorUid: actor.uid,

      actorEmail:
        actor.email || '',

      actorName:
        actor.displayName ||
        actor.email ||
        'Instructor',

      action,
      category,
      status,
      description,

      studentName,
      studentUid,
      subjectCode,
      clearanceId,
      signatureId,

      createdAt: serverTimestamp(),
    }
  )

  return activityRef.id
}

export async function logInstructorActivitySafely(
  input: ActivityLogInput
): Promise<void> {
  try {
    await logInstructorActivity(input)
  } catch (error) {
    console.error(
      'Failed to record instructor activity:',
      error
    )
  }
}
