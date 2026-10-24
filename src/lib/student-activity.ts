
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'

import type { User } from 'firebase/auth'

import { auth, db } from '@/lib/firebase'

export type StudentActivityAction =
  | 'clearance_created'
  | 'clearance_saved'
  | 'clearance_updated'
  | 'clearance_shared'
  | 'clearance_submitted'
  | 'subject_added'
  | 'subject_created'
  | 'subject_deleted'
  | 'subject_removed'
  | 'subject_updated'
  | 'subject_edited'
  | 'document_uploaded'
  | 'document_updated'
  | 'document_shared'
  | 'document_downloaded'
  | 'document_deleted'

export type StudentActivityCategory =
  | 'signature'
  | 'clearance'
  | 'document'
  | 'other'

export type StudentActivityStatus =
  | 'success'
  | 'failed'

export interface StudentActivityInput {
  action: StudentActivityAction
  clearanceId: string

  // Existing fields
  description: string
  subjectCode?: string
  studentName?: string

  // Additional details
  actor?: User
  category?: StudentActivityCategory
  status?: StudentActivityStatus
  studentUid?: string
  subjectName?: string
  recipientUid?: string
  recipientName?: string
  recipientEmail?: string
  documentName?: string
  oldValue?: string
  newValue?: string
  changedField?: string
  signatureId?: string
}

export async function recordStudentActivity(
  input: StudentActivityInput
): Promise<string> {
  const {
    action,
    clearanceId,
    description,
    subjectCode = '',
    studentName = '',
    actor,
    category = 'clearance',
    status = 'success',
    studentUid = '',
    subjectName = '',
    recipientUid = '',
    recipientName = '',
    recipientEmail = '',
    documentName = '',
    oldValue = '',
    newValue = '',
    changedField = '',
    signatureId = '',
  } = input

  const user = actor || auth.currentUser

  if (!user) {
    throw new Error(
      'You must be signed in to record student activity.'
    )
  }

  if (!clearanceId.trim()) {
    throw new Error(
      'A valid clearance ID is required.'
    )
  }

  const name =
    studentName.trim() ||
    user.displayName ||
    user.email ||
    'Student'

  const activityRef = await addDoc(
    collection(db, 'activities'),
    {
      actorUid: user.uid,
      actorName:
        user.displayName ||
        user.email ||
        'Student',
      actorEmail: user.email || '',

      action,
      category,
      status,
      description,

      studentUid: studentUid || user.uid,
      studentName: name,

      clearanceId,
      subjectCode,
      subjectName,
      signatureId,

      recipientUid,
      recipientName,
      recipientEmail,
      documentName,

      oldValue,
      newValue,
      changedField,

      createdAt: serverTimestamp(),
    }
  )

  return activityRef.id
}

export async function recordStudentActivitySafely(
  input: StudentActivityInput
): Promise<void> {
  try {
    await recordStudentActivity(input)
  } catch (error) {
    console.error(
      'Failed to record student activity:',
      error
    )
  }
}

// Additional names matching the instructor logger.
// Existing recordStudentActivity imports still work.
export const logStudentActivity = recordStudentActivity

export const logStudentActivitySafely =
  recordStudentActivitySafely
