'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  collection,
  getDocs,
  getDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  Plus,
  RefreshCw,
  Save,
  PenTool,
  X,
} from 'lucide-react'
import ESignature from '@/components/features/instructors/signature/E-Signature'

interface SubjectRow {
  id: string
  code: string
  description: string
  grades: string
  remarks: string
  signature: string
  instructorId?: string
  instructorName?: string
}

interface ClearanceRequest {
  id: string
  studentUid: string
  studentName: string
  yearAndSection: string
  studentId: string
  studentEmail: string
  instructorId: string
  instructorName: string
  subjects: SubjectRow[]
  status: string
}

interface ActivityInput {
  action: string
  category: 'signature' | 'clearance' | 'document' | 'other'
  description: string
  subjectCode?: string
}

interface InstructorProfile {
  displayName?: string
  fullName?: string
  name?: string
  role?: string
}

interface EmailNotificationResult {
  sent?: boolean
  reason?: string
  message?: string
  error?: string
  studentEmail?: string
  totalSubjects?: number
  completedSubjects?: number
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveInstructorName(
  profile: InstructorProfile
): string {
  return (
    getText(profile.displayName) ||
    getText(profile.fullName) ||
    getText(profile.name) ||
    'Unnamed Instructor'
  )
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

function isSubjectComplete(subject: SubjectRow): boolean {
  return (
    hasValidValue(subject.grades) &&
    hasValidValue(subject.remarks) &&
    hasValidValue(subject.signature)
  )
}

function isEntireClearanceComplete(
  subjects: SubjectRow[]
): boolean {
  return (
    subjects.length > 0 &&
    subjects.every(isSubjectComplete)
  )
}

function getMatchingSubjects(
  request: ClearanceRequest,
  instructorUid: string,
  subjectCode: string
): SubjectRow[] {
  const normalizedCode = subjectCode.trim().toLowerCase()

  return request.subjects.filter(
    (subject) =>
      subject.instructorId === instructorUid &&
      (!normalizedCode ||
        subject.code.trim().toLowerCase() === normalizedCode)
  )
}

function hasPendingSubject(
  request: ClearanceRequest,
  instructorUid: string,
  subjectCode: string
): boolean {
  return getMatchingSubjects(
    request,
    instructorUid,
    subjectCode
  ).some((subject) => !isSubjectComplete(subject))
}

function getPendingCount(
  request: ClearanceRequest,
  instructorUid: string,
  subjectCode: string
): number {
  return getMatchingSubjects(
    request,
    instructorUid,
    subjectCode
  ).filter((subject) => !isSubjectComplete(subject)).length
}

export default function InstructorRequestsPage() {
  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null)

  const [requests, setRequests] =
    useState<ClearanceRequest[]>([])

  const [instructorDisplayNames, setInstructorDisplayNames] =
    useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)

  const [selectedStudent, setSelectedStudent] =
    useState<ClearanceRequest | null>(null)

  const [saving, setSaving] = useState(false)

  const initialSelectionAppliedRef = useRef(false)

  const [subjectFilter, setSubjectFilter] = useState('')

  const [isSigningOpen, setIsSigningOpen] = useState(false)

  const [
    activeSigningSubjectId,
    setActiveSigningSubjectId,
  ] = useState<string | null>(null)

  const visibleRequests = subjectFilter
    ? requests.filter((request) =>
        request.subjects.some(
          (subject) =>
            subject.instructorId === currentUser?.uid &&
            subject.code.trim().toLowerCase() ===
              subjectFilter.trim().toLowerCase()
        )
      )
    : requests

  const sortedVisibleRequests = [...visibleRequests].sort(
    (a, b) => {
      if (!currentUser) return 0

      const aPending = hasPendingSubject(
        a,
        currentUser.uid,
        subjectFilter
      )

      const bPending = hasPendingSubject(
        b,
        currentUser.uid,
        subjectFilter
      )

      if (aPending !== bPending) {
        return aPending ? -1 : 1
      }

      return 0
    }
  )

  const fetchInstructorDisplayNames = async (
    instructorUid: string,
    loadedRequests: ClearanceRequest[]
  ): Promise<Record<string, string>> => {
    const names: Record<string, string> = {}
    const instructorIds = new Set<string>()

    instructorIds.add(instructorUid)

    loadedRequests.forEach((request) => {
      if (request.instructorId) {
        instructorIds.add(request.instructorId)
      }

      request.subjects.forEach((subject) => {
        if (subject.instructorId) {
          instructorIds.add(subject.instructorId)
        }
      })
    })

    await Promise.all(
      Array.from(instructorIds).map(async (uid) => {
        try {
          const instructorSnapshot = await getDoc(
            doc(db, 'users', uid)
          )

          if (!instructorSnapshot.exists()) return

          const data =
            instructorSnapshot.data() as InstructorProfile

          const role = getText(data.role).toLowerCase()

          if (role && role !== 'instructor') return

          names[uid] = resolveInstructorName(data)
        } catch (error) {
          console.error(
            `Error loading instructor profile ${uid}:`,
            error
          )
        }
      })
    )

    setInstructorDisplayNames(names)

    return names
  }

  const fetchRequests = async (
    instructorUid: string,
    options?: {
      advanceAfterSave?: boolean
      completedRequestId?: string
    }
  ) => {
    try {
      setLoading(true)

      const querySnapshot = await getDocs(
        collection(db, 'requests')
      )

      const loadedRequests: ClearanceRequest[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()

        const subjects: SubjectRow[] = Array.isArray(data.subjects)
          ? data.subjects
          : []

        const isAssignedToThisInstructor = subjects.some(
          (subject) =>
            subject.instructorId === instructorUid
        )

        if (isAssignedToThisInstructor) {
          loadedRequests.push({
            id: docSnap.id,
            studentUid: data.studentUid || '',
            studentName:
              data.studentName || 'Unnamed Student',
            yearAndSection: data.yearAndSection || '',
            studentId: data.studentId || '',
            studentEmail: data.studentEmail || '',
            instructorId: data.instructorId || '',
            instructorName: data.instructorName || '',
            subjects,
            status: data.status || 'Pending',
          })
        }
      })

      await fetchInstructorDisplayNames(
        instructorUid,
        loadedRequests
      )

      const params = new URLSearchParams(
        window.location.search
      )

      const requestedClearanceId = params.get('requestId')

      const requestedSubject =
        params.get('subject')?.trim() || ''

      const shouldApplyInitialSelection =
        !initialSelectionAppliedRef.current

      if (shouldApplyInitialSelection) {
        setSubjectFilter(requestedSubject)
      }

      const activeSubject = shouldApplyInitialSelection
        ? requestedSubject
        : subjectFilter

      const subjectMatches = (
        request: ClearanceRequest
      ) =>
        getMatchingSubjects(
          request,
          instructorUid,
          activeSubject
        ).length > 0

      const matchingRequests =
        loadedRequests.filter(subjectMatches)

      const pendingRequests =
        matchingRequests.filter((request) =>
          hasPendingSubject(
            request,
            instructorUid,
            activeSubject
          )
        )

      const requestedClearance = requestedClearanceId
        ? matchingRequests.find(
            (request) =>
              request.id === requestedClearanceId
          )
        : undefined

      const requestedClearancePending =
        requestedClearance &&
        hasPendingSubject(
          requestedClearance,
          instructorUid,
          activeSubject
        )

      initialSelectionAppliedRef.current = true

      setRequests(loadedRequests)

      setSelectedStudent((previous) => {
        if (options?.advanceAfterSave) {
          const nextPending = pendingRequests.find(
            (request) =>
              request.id !== options.completedRequestId
          )

          if (nextPending) {
            return nextPending
          }

          const savedRequest = matchingRequests.find(
            (request) =>
              request.id === options.completedRequestId
          )

          if (savedRequest) {
            const stillPending = hasPendingSubject(
              savedRequest,
              instructorUid,
              activeSubject
            )

            if (stillPending) {
              return savedRequest
            }
          }

          return (
            pendingRequests[0] ||
            savedRequest ||
            matchingRequests[0] ||
            loadedRequests[0] ||
            null
          )
        }

        if (shouldApplyInitialSelection) {
          if (
            requestedClearance &&
            requestedClearancePending
          ) {
            return requestedClearance
          }

          if (pendingRequests.length > 0) {
            return pendingRequests[0]
          }

          if (requestedClearance) {
            return requestedClearance
          }

          return (
            matchingRequests[0] ||
            loadedRequests[0] ||
            null
          )
        }

        if (previous) {
          const existingClearance =
            loadedRequests.find(
              (request) =>
                request.id === previous.id
            )

          if (existingClearance) {
            return existingClearance
          }
        }

        return (
          pendingRequests[0] ||
          matchingRequests[0] ||
          loadedRequests[0] ||
          null
        )
      })
    } catch (error) {
      console.error(
        'Error fetching clearance requests:',
        error
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setCurrentUser(user)

        if (user) {
          await fetchRequests(user.uid)
        } else {
          initialSelectionAppliedRef.current = false
          setSubjectFilter('')
          setRequests([])
          setSelectedStudent(null)
          setInstructorDisplayNames({})
          setLoading(false)
        }
      }
    )

    return () => unsubscribe()
  }, [])

  const handleClearSubjectFilter = () => {
    setSubjectFilter('')

    const url = new URL(window.location.href)

    url.searchParams.delete('subject')
    url.searchParams.delete('requestId')

    window.history.replaceState(
      null,
      '',
      url.pathname + url.search + url.hash
    )
  }

  const handleRefresh = async () => {
    if (currentUser) {
      await fetchRequests(currentUser.uid)
    }
  }

  const getAssignedInstructorName = (
    subject: SubjectRow
  ): string => {
    if (!subject.instructorId) {
      return 'Unassigned'
    }

    return (
      instructorDisplayNames[subject.instructorId] ||
      getText(subject.instructorName) ||
      'Unnamed Instructor'
    )
  }

  const handleSubjectChange = (
    subjectId: string,
    field: keyof SubjectRow,
    value: string
  ) => {
    if (!currentUser) return

    setSelectedStudent((previous) => {
      if (!previous) return previous

      const updatedSubjects = previous.subjects.map(
        (subject) => {
          if (
            subject.id !== subjectId ||
            subject.instructorId !== currentUser.uid
          ) {
            return subject
          }

          return {
            ...subject,
            [field]: value,
          }
        }
      )

      return {
        ...previous,
        subjects: updatedSubjects,
      }
    })
  }

  const handleOpenSignatureModal = (
    subjectId: string | null = null
  ) => {
    setActiveSigningSubjectId(subjectId)
    setIsSigningOpen(true)
  }

  const handleCloseSignatureModal = () => {
    setIsSigningOpen(false)
    setActiveSigningSubjectId(null)
  }

  const handleApplySignature = (
    subjectId: string,
    signatureUrl: string
  ) => {
    handleSubjectChange(
      subjectId,
      'signature',
      signatureUrl
    )
  }

  const sendClearanceCompletionEmail = async (
    clearanceId: string,
    instructor: FirebaseUser
  ): Promise<EmailNotificationResult> => {
    try {
      const idToken = await instructor.getIdToken()

      const response = await fetch('/api/clearance-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          requestId: clearanceId,
        }),
      })

      const result =
        (await response.json()) as EmailNotificationResult

      if (!response.ok) {
        return {
          sent: false,
          error:
            result.error ||
            'The clearance completion email could not be sent.',
        }
      }

      return result
    } catch (error) {
      console.error(
        'Error sending clearance completion email:',
        error
      )

      return {
        sent: false,
        error:
          'Unable to contact the email notification service.',
      }
    }
  }

  const handleSaveChanges = async () => {
    if (!selectedStudent || !currentUser || saving) {
      return
    }

    let clearanceSaved = false

    try {
      setSaving(true)

      const selected = selectedStudent

      const docRef = doc(
        db,
        'requests',
        selected.id
      )

      const latestSnapshot = await getDoc(docRef)

      if (!latestSnapshot.exists()) {
        throw new Error(
          'This clearance request no longer exists.'
        )
      }

      const latestData = latestSnapshot.data()

      const originalSubjects: SubjectRow[] =
        Array.isArray(latestData.subjects)
          ? latestData.subjects
          : []

      const activityRecords: ActivityInput[] = []

      const updatedSubjects = originalSubjects.map(
        (originalSubject) => {
          if (
            originalSubject.instructorId !== currentUser.uid
          ) {
            return originalSubject
          }

          const editedSubject = selected.subjects.find(
            (subject) =>
              subject.id === originalSubject.id
          )

          if (!editedSubject) {
            return originalSubject
          }

          const subjectCode =
            originalSubject.code ||
            editedSubject.code ||
            'Unknown Subject'

          if (
            (originalSubject.grades || '') !==
            (editedSubject.grades || '')
          ) {
            activityRecords.push({
              action: 'grade_updated',
              category: 'clearance',
              description:
                `Updated grade for ${subjectCode} ` +
                `from "${originalSubject.grades || 'Empty'}" ` +
                `to "${editedSubject.grades || 'Empty'}".`,
              subjectCode,
            })
          }

          if (
            (originalSubject.remarks || '') !==
            (editedSubject.remarks || '')
          ) {
            activityRecords.push({
              action: 'remarks_updated',
              category: 'clearance',
              description:
                `Updated remarks for ${subjectCode} ` +
                `from "${originalSubject.remarks || 'Empty'}" ` +
                `to "${editedSubject.remarks || 'Empty'}".`,
              subjectCode,
            })
          }

          if (
            (originalSubject.signature || '') !==
            (editedSubject.signature || '')
          ) {
            activityRecords.push({
              action: 'signature_applied',
              category: 'signature',
              description: originalSubject.signature
                ? `Replaced the e-signature for ${subjectCode}.`
                : `Applied an e-signature to ${subjectCode}.`,
              subjectCode,
            })
          }

          return {
            ...originalSubject,
            grades: editedSubject.grades || '',
            remarks: editedSubject.remarks || '',
            signature: editedSubject.signature || '',
          }
        }
      )

      const previousStatus =
        latestData.status || 'Pending'

      if (previousStatus !== 'Reviewed') {
        activityRecords.push({
          action: 'clearance_updated',
          category: 'clearance',
          description:
            "Reviewed the student's clearance.",
        })
      }

      if (activityRecords.length === 0) {
        activityRecords.push({
          action: 'clearance_updated',
          category: 'clearance',
          description:
            'Saved the clearance review without changing existing values.',
        })
      }

      if (activityRecords.length > 499) {
        throw new Error(
          'Too many activity changes in one save.'
        )
      }

      const batch = writeBatch(db)

      batch.update(docRef, {
        subjects: updatedSubjects,
        status: 'Reviewed',
        updatedAt: serverTimestamp(),
      })

      for (const activity of activityRecords) {
        const activityRef = doc(
          collection(db, 'activities')
        )

        batch.set(activityRef, {
          actorUid: currentUser.uid,
          actorEmail: currentUser.email || '',
          actorName:
            instructorDisplayNames[currentUser.uid] ||
            currentUser.displayName ||
            currentUser.email ||
            'Instructor',
          action: activity.action,
          category: activity.category,
          status: 'success',
          description: activity.description,
          studentName: selected.studentName || '',
          studentUid: selected.studentUid || '',
          subjectCode: activity.subjectCode || '',
          clearanceId: selected.id,
          signatureId: '',
          createdAt: serverTimestamp(),
        })
      }

      await batch.commit()

      clearanceSaved = true

      const activeSubjectCode =
        subjectFilter ||
        new URLSearchParams(
          window.location.search
        ).get('subject') ||
        ''

      const matchingUpdatedSubjects =
        updatedSubjects.filter(
          (subject) =>
            subject.instructorId === currentUser.uid &&
            (!activeSubjectCode ||
              subject.code.trim().toLowerCase() ===
                activeSubjectCode.trim().toLowerCase())
        )

      const completedSelectedReview =
        matchingUpdatedSubjects.length > 0 &&
        matchingUpdatedSubjects.every(isSubjectComplete)

      const entireClearanceComplete =
        isEntireClearanceComplete(updatedSubjects)

      let emailResult: EmailNotificationResult | null = null

      // Email only when every subject across all instructors is complete.
      if (entireClearanceComplete) {
        emailResult = await sendClearanceCompletionEmail(
          selected.id,
          currentUser
        )
      }

      let successMessage =
        `Clearance updated successfully!\n` +
        `${activityRecords.length} activity record(s) saved.`

      if (!entireClearanceComplete) {
        const completedCount =
          updatedSubjects.filter(isSubjectComplete).length

        successMessage +=
          `\n\nEntire clearance progress: ` +
          `${completedCount}/${updatedSubjects.length} subjects completed.` +
          '\nNo email was sent. The student will be notified only when ALL subjects have grades, remarks, and e-signatures.'
      } else if (emailResult?.reason === 'already_sent') {
        successMessage +=
          '\n\nThe student has already received the full clearance completion email.'
      } else if (emailResult?.sent) {
        successMessage +=
          '\n\nThe entire clearance is complete!' +
          '\nA completion email was sent to the student.'

        if (emailResult.studentEmail) {
          successMessage +=
            `\nRecipient: ${emailResult.studentEmail}`
        }
      } else if (emailResult?.reason === 'missing_email') {
        successMessage +=
          '\n\nThe entire clearance is complete, but the student has no valid email address.'
      } else if (emailResult?.reason === 'in_progress') {
        successMessage +=
          '\n\nThe completion email is already being processed.'
      } else if (emailResult?.reason === 'retry_later') {
        successMessage +=
          '\n\nThe email was recently attempted. Please retry later.'
      } else if (emailResult?.error) {
        successMessage +=
          '\n\nThe entire clearance is complete, but the email could not be sent.' +
          '\nPlease check your EmailJS configuration and server logs.'
      }

      alert(successMessage)

      await fetchRequests(currentUser.uid, {
        advanceAfterSave: completedSelectedReview,
        completedRequestId: selected.id,
      })
    } catch (error) {
      console.error(
        'Error saving clearance and activities:',
        error
      )

      if (clearanceSaved) {
        alert(
          'The clearance was saved successfully, but an error occurred afterward. Check the browser console.'
        )
      } else {
        alert(
          'Failed to save clearance and activities. ' +
          'Please check the browser console and ' +
          'your Firestore Security Rules.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const displayedStudent =
    selectedStudent &&
    sortedVisibleRequests.some(
      (request) => request.id === selectedStudent.id
    )
      ? selectedStudent
      : null

  const totalPendingForSubject = currentUser
    ? visibleRequests.reduce(
        (total, request) =>
          total +
          getPendingCount(
            request,
            currentUser.uid,
            subjectFilter
          ),
        0
      )
    : 0

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* Top Header Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Student Clearance Requests
            </h1>

            <p className="text-sm text-slate-500 mt-0.5">
              Review submissions, update grades, and sign student clearances.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleOpenSignatureModal(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Signature
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh List
            </button>
          </div>
        </div>

        {/* Active Subject Filter */}
        {subjectFilter && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-emerald-900">
                Showing clearance requests for{' '}
                <strong>{subjectFilter}</strong>

                <span className="ml-2 text-emerald-700">
                  ({visibleRequests.length} matching students)
                </span>
              </p>

              <p className="mt-1 text-xs text-emerald-800">
                {totalPendingForSubject > 0
                  ? `${totalPendingForSubject} subject review(s) still need completion. Pending students are shown first.`
                  : 'All matching subject reviews are complete.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClearSubjectFilter}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
              Show All Clearances
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-slate-600 font-medium">
            Loading student clearance requests...
          </div>
        ) : sortedVisibleRequests.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
            {subjectFilter
              ? `No clearance requests for ${subjectFilter} are assigned to you.`
              : 'No clearance requests assigned to you found yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Requests List Sidebar */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
              <div className="border-b border-slate-100 pb-3 px-1">
                <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">
                  Submitted Clearances
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Pending reviews appear first.
                </p>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {sortedVisibleRequests.map((req) => {
                  const pendingCount = currentUser
                    ? getPendingCount(
                        req,
                        currentUser.uid,
                        subjectFilter
                      )
                    : 0

                  const isPending = pendingCount > 0

                  const isSelected =
                    displayedStudent?.id === req.id

                  const entireClearanceComplete =
                    isEntireClearanceComplete(req.subjects)

                  return (
                    <button
                      type="button"
                      key={req.id}
                      onClick={() => {
                        setSelectedStudent(req)

                        const url = new URL(
                          window.location.href
                        )

                        url.searchParams.set(
                          'requestId',
                          req.id
                        )

                        window.history.replaceState(
                          null,
                          '',
                          url.pathname +
                            url.search +
                            url.hash
                        )
                      }}
                      className={`block w-full text-left p-4 rounded-xl cursor-pointer transition border ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white border-transparent shadow-md ring-2 ring-emerald-500/30'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">
                            {req.studentName}
                          </p>

                          <p
                            className={`text-xs mt-0.5 ${
                              isSelected
                                ? 'text-slate-300'
                                : 'text-slate-500'
                            }`}
                          >
                            Section: {req.yearAndSection}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isPending ? 'Pending' : 'Completed'}
                        </span>
                      </div>

                      <span
                        className={`inline-block mt-2.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : entireClearanceComplete
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'Reviewed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {entireClearanceComplete
                          ? 'Fully Cleared'
                          : req.status}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Student Clearance Details */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 text-slate-900">
              {displayedStudent ? (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {displayedStudent.studentName}
                      </h2>

                      <p className="text-sm text-slate-600 mt-0.5">
                        Section: {displayedStudent.yearAndSection}
                      </p>

                      <p className="text-xs text-slate-400 mt-0.5">
                        ID: {displayedStudent.studentId}
                        {' | '}
                        Email: {displayedStudent.studentEmail}
                      </p>

                      <p className="text-xs text-slate-500 mt-2">
                        Full clearance progress:{' '}
                        {
                          displayedStudent.subjects.filter(
                            isSubjectComplete
                          ).length
                        }
                        /{displayedStudent.subjects.length} subjects
                        completed
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      {saving
                        ? 'Saving...'
                        : 'Save Grades & Sign'}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-200 p-3 w-28">
                            Code
                          </th>

                          <th className="border border-slate-200 p-3">
                            Description
                          </th>

                          <th className="border border-slate-200 p-3 w-36 text-center">
                            Assigned To
                          </th>

                          <th className="border border-slate-200 p-3 w-24 text-center">
                            Grades
                          </th>

                          <th className="border border-slate-200 p-3 w-28 text-center">
                            Remarks
                          </th>

                          <th className="border border-slate-200 p-3 w-36 text-center">
                            Signature
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {displayedStudent.subjects.map((subj) => {
                          const isAssignedToMe =
                            currentUser &&
                            subj.instructorId === currentUser.uid

                          const isHighlightedSubject =
                            subjectFilter &&
                            subj.code.trim().toLowerCase() ===
                              subjectFilter.trim().toLowerCase()

                          const isComplete =
                            isSubjectComplete(subj)

                          return (
                            <tr
                              key={subj.id}
                              className={
                                isHighlightedSubject
                                  ? 'bg-emerald-50/80'
                                  : !isAssignedToMe
                                    ? 'bg-slate-50/60'
                                    : 'hover:bg-slate-50/40 transition'
                              }
                            >
                              <td className="border border-slate-200 p-3 font-medium text-slate-900">
                                <div className="flex flex-col gap-1">
                                  <span>{subj.code}</span>

                                  {isAssignedToMe && (
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        isComplete
                                          ? 'text-emerald-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {isComplete
                                        ? 'Complete'
                                        : 'Pending'}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="border border-slate-200 p-3 text-slate-700">
                                {subj.description}
                              </td>

                              <td className="border border-slate-200 p-3 text-center text-xs text-slate-600">
                                {getAssignedInstructorName(subj)}
                              </td>

                              <td className="border border-slate-200 p-3 text-center">
                                {isAssignedToMe ? (
                                  <input
                                    type="text"
                                    suppressHydrationWarning
                                    value={subj.grades}
                                    onChange={(e) =>
                                      handleSubjectChange(
                                        subj.id,
                                        'grades',
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg text-center py-1.5 px-1 focus:outline-none focus:ring-2 focus:ring-slate-400 font-semibold text-slate-900"
                                    placeholder="Grade"
                                  />
                                ) : (
                                  <span className="font-semibold text-xs text-slate-700">
                                    {subj.grades || '—'}
                                  </span>
                                )}
                              </td>

                              <td className="border border-slate-200 p-3 text-center">
                                {isAssignedToMe ? (
                                  <input
                                    type="text"
                                    suppressHydrationWarning
                                    value={subj.remarks}
                                    onChange={(e) =>
                                      handleSubjectChange(
                                        subj.id,
                                        'remarks',
                                        e.target.value
                                      )
                                    }
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg text-center py-1.5 px-1 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900"
                                    placeholder="Remarks"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-700">
                                    {subj.remarks || '—'}
                                  </span>
                                )}
                              </td>

                              <td className="border border-slate-200 p-3 text-center align-middle">
                                {isAssignedToMe ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {subj.signature &&
                                    subj.signature.startsWith(
                                      'data:image/'
                                    ) ? (
                                      <div className="relative group">
                                        <Image
                                          src={subj.signature}
                                          alt="Signature"
                                          width={96}
                                          height={40}
                                          unoptimized
                                          className="h-10 w-24 object-contain border border-slate-200 bg-white rounded-lg shadow-sm"
                                        />

                                        <button
                                          type="button"
                                          suppressHydrationWarning
                                          onClick={() =>
                                            handleOpenSignatureModal(
                                              subj.id
                                            )
                                          }
                                          className="absolute inset-0 bg-slate-900/60 text-white text-[10px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg"
                                        >
                                          Re-sign
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        suppressHydrationWarning
                                        onClick={() =>
                                          handleOpenSignatureModal(
                                            subj.id
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg border border-slate-300 transition shadow-sm"
                                      >
                                        <PenTool className="w-3.5 h-3.5" />
                                        Add Sign
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-700">
                                    {subj.signature &&
                                    subj.signature.startsWith(
                                      'data:image/'
                                    ) ? (
                                      <Image
                                        src={subj.signature}
                                        alt="Signature"
                                        width={80}
                                        height={32}
                                        unoptimized
                                        className="h-8 w-20 object-contain mx-auto"
                                      />
                                    ) : (
                                      subj.signature || '—'
                                    )}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
                  Select a student request from the list to view and grade their clearance.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing E-Signature Component */}
        <ESignature
          isSigningOpen={isSigningOpen}
          activeSigningSubjectId={activeSigningSubjectId}
          currentUser={currentUser}
          onClose={handleCloseSignatureModal}
          onApplySignature={handleApplySignature}
        />
      </div>
    </div>
  )
}