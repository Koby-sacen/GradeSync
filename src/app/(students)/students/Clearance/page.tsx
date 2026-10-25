'use client'

import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'

import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

import {
  Save,
  Share2,
  Plus,
  Download,
  Trash2,
  X,
} from 'lucide-react'

import {
  recordStudentActivity,
  type StudentActivityAction,
} from '@/lib/student-activity'

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

interface Instructor {
  id: string
  name: string
  email: string
}

interface ActivityToRecord {
  action: StudentActivityAction
  description: string
  subjectCode?: string
}

const INITIAL_SUBJECTS: SubjectRow[] = Array.from(
  { length: 5 },
  (_, index) => ({
    id: String(index + 1),
    code: '',
    description: '',
    grades: '',
    remarks: '',
    signature: '',
    instructorId: '',
    instructorName: '',
  })
)

function normalizeSubject(
  value: Partial<SubjectRow>,
  index: number
): SubjectRow {
  return {
    id: String(value.id || `subject-${index}`),
    code: String(value.code || ''),
    description: String(value.description || ''),
    grades: String(value.grades || ''),
    remarks: String(value.remarks || ''),
    signature: String(value.signature || ''),
    instructorId: String(value.instructorId || ''),
    instructorName: String(value.instructorName || ''),
  }
}

function getSubjectName(subject: SubjectRow): string {
  return (
    subject.description.trim() ||
    subject.code.trim() ||
    'Unnamed Subject'
  )
}

function getSubjectReference(
  subject: SubjectRow
): string {
  const name = getSubjectName(subject)
  const code = subject.code.trim()

  if (
    code &&
    name.toLowerCase() !== code.toLowerCase()
  ) {
    return `"${name}" (${code})`
  }

  return `"${name}"`
}

function buildSubjectActivities(
  previousSubjects: SubjectRow[],
  currentSubjects: SubjectRow[]
): ActivityToRecord[] {
  const activities: ActivityToRecord[] = []

  const previousById = new Map(
    previousSubjects.map((subject) => [
      subject.id,
      subject,
    ])
  )

  const currentById = new Map(
    currentSubjects.map((subject) => [
      subject.id,
      subject,
    ])
  )

  for (const subject of currentSubjects) {
    const previous = previousById.get(subject.id)

    if (!previous) {
      activities.push({
        action: 'subject_added',
        subjectCode: subject.code,
        description:
          `You added subject ${getSubjectReference(subject)} to your clearance.`,
      })

      continue
    }

    const changes: string[] = []

    if (previous.code !== subject.code) {
      changes.push(
        `subject code from "${previous.code || 'Empty'}" to "${subject.code || 'Empty'}"`
      )
    }

    if (
      previous.description !==
      subject.description
    ) {
      changes.push(
        `subject name from "${previous.description || 'Empty'}" to "${subject.description || 'Empty'}"`
      )
    }

    if (
      (previous.instructorId || '') !==
      (subject.instructorId || '')
    ) {
      changes.push(
        `assigned instructor from "${previous.instructorName || 'Unassigned'}" to "${subject.instructorName || 'Unassigned'}"`
      )
    }

    if (previous.grades !== subject.grades) {
      changes.push('grade')
    }

    if (previous.remarks !== subject.remarks) {
      changes.push('remarks')
    }

    if (
      previous.signature !==
      subject.signature
    ) {
      changes.push('signature')
    }

    if (changes.length > 0) {
      activities.push({
        action: 'subject_updated',
        subjectCode: subject.code,
        description:
          `You updated subject ${getSubjectReference(subject)}. Changes: ${changes.join('; ')}.`,
      })
    }
  }

  for (const previous of previousSubjects) {
    if (!currentById.has(previous.id)) {
      activities.push({
        action: 'subject_deleted',
        subjectCode: previous.code,
        description:
          `You deleted subject ${getSubjectReference(previous)} from your clearance.`,
      })
    }
  }

  return activities
}

export default function Page() {
  const [user, setUser] =
    useState<FirebaseUser | null>(null)

  const [userRole, setUserRole] =
    useState('student')

  const [loading, setLoading] =
    useState(true)

  const [existingRequestId, setExistingRequestId] =
    useState<string | null>(null)

  const [clearanceStatus, setClearanceStatus] =
    useState('Not Shared')

  const [saving, setSaving] =
    useState(false)

  const [saveSuccess, setSaveSuccess] =
    useState(false)

  const [isModalOpen, setIsModalOpen] =
    useState(false)

  const [instructors, setInstructors] =
    useState<Instructor[]>([])

  const [searchQuery, setSearchQuery] =
    useState('')

  const [selectedInstructor, setSelectedInstructor] =
    useState<Instructor | null>(null)

  const [sharing, setSharing] =
    useState(false)

  const [shareSuccess, setShareSuccess] =
    useState(false)

  const [studentName, setStudentName] =
    useState('')

  const [yearAndSection, setYearAndSection] =
    useState('')

  const [studentId, setStudentId] =
    useState('')

  const [studentEmail, setStudentEmail] =
    useState('')

  const [subjects, setSubjects] =
    useState<SubjectRow[]>(INITIAL_SUBJECTS)

  const savedSubjectsRef =
    useRef<SubjectRow[]>([])

  const savedRequestRef =
    useRef<string | null>(null)

  const operationInProgressRef =
    useRef(false)

  const isInstructor =
    userRole === 'instructor'

  // Instructor directory

  const fetchInstructorsList = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, 'users')
      )

      const fetched: Instructor[] = []

      snapshot.forEach((document) => {
        const data = document.data()

        const role = String(
          data.role || ''
        ).toLowerCase().trim()

        if (role !== 'instructor') return

        const name =
          String(
            data.displayName ||
            data.fullName ||
            data.name ||
            ''
          ).trim() || 'Unnamed Instructor'

        const email =
          String(data.email || '').trim()

        fetched.push({
          id: document.id,
          name,
          email: email || 'No email provided',
        })
      })

      fetched.sort((a, b) =>
        a.name.localeCompare(b.name)
      )

      setInstructors(fetched)
    } catch (error) {
      console.error(
        'Error fetching instructors:',
        error
      )
    }
  }

  // Authentication and existing clearance

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) return

        setUser(currentUser)
        setLoading(true)

        savedSubjectsRef.current = []
        savedRequestRef.current = null

        setExistingRequestId(null)
        setClearanceStatus('Not Shared')
        setSubjects(INITIAL_SUBJECTS)

        setStudentName('')
        setYearAndSection('')
        setStudentId('')
        setStudentEmail('')
        setUserRole('student')

        if (currentUser) {
          await fetchInstructorsList()

          if (!active) return

          try {
            const userSnapshot = await getDoc(
              doc(db, 'users', currentUser.uid)
            )

            if (!active) return

            if (userSnapshot.exists()) {
              const role = userSnapshot.data().role

              if (role) {
                setUserRole(
                  String(role).toLowerCase()
                )
              }
            }
          } catch (error) {
            console.error(
              'Error fetching user role:',
              error
            )
          }

          try {
            const clearanceQuery = query(
              collection(db, 'requests'),
              where(
                'studentUid',
                '==',
                currentUser.uid
              )
            )

            const snapshot = await getDocs(
              clearanceQuery
            )

            if (!active) return

            if (!snapshot.empty) {
              const document = snapshot.docs[0]
              const data = document.data()

              const loadedSubjects:
                SubjectRow[] =
                Array.isArray(data.subjects)
                  ? data.subjects.map(
                      (
                        subject: Partial<SubjectRow>,
                        index: number
                      ) =>
                        normalizeSubject(
                          subject,
                          index
                        )
                    )
                  : INITIAL_SUBJECTS

              setExistingRequestId(document.id)

              savedRequestRef.current =
                document.id

              setSubjects(loadedSubjects)

              savedSubjectsRef.current =
                loadedSubjects.map(
                  (subject) => ({
                    ...subject,
                  })
                )

              setStudentName(
                String(data.studentName || '')
              )

              setYearAndSection(
                String(data.yearAndSection || '')
              )

              setStudentId(
                String(data.studentId || '')
              )

              setStudentEmail(
                String(data.studentEmail || '')
              )

              setClearanceStatus(
                String(
                  data.status || 'Not Shared'
                )
              )
            }
          } catch (error) {
            console.error(
              'Error fetching clearance:',
              error
            )
          }
        }

        if (active) {
          setLoading(false)
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Subject editing

  const handleSubjectChange = (
    id: string,
    field: keyof SubjectRow,
    value: string
  ) => {
    setSubjects((previous) =>
      previous.map((subject) =>
        subject.id === id
          ? {
              ...subject,
              [field]: value,
            }
          : subject
      )
    )
  }

  const handleAssignInstructorToSubject = (
    subjectId: string,
    instructorId: string
  ) => {
    const selected = instructors.find(
      (instructor) =>
        instructor.id === instructorId
    )

    setSubjects((previous) =>
      previous.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              instructorId,
              instructorName:
                selected?.name || '',
            }
          : subject
      )
    )
  }

  const handleAddSubject = () => {
    const newSubject: SubjectRow = {
      id:
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID ===
          'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      code: '',
      description: '',
      grades: '',
      remarks: '',
      signature: '',
      instructorId: '',
      instructorName: '',
    }

    setSubjects((previous) => [
      ...previous,
      newSubject,
    ])
  }

  const handleDeleteSubject = (
    id: string
  ) => {
    setSubjects((previous) =>
      previous.filter(
        (subject) => subject.id !== id
      )
    )
  }

  // Student activity history

  const saveActivityLogs = async (
    clearanceId: string,
    activitiesToRecord: ActivityToRecord[]
  ): Promise<void> => {
    if (!user || isInstructor) return

    for (const activity of activitiesToRecord) {
      await recordStudentActivity({
        action: activity.action,
        clearanceId,
        subjectCode:
          activity.subjectCode || '',
        studentName:
          studentName.trim() ||
          user.displayName ||
          user.email ||
          'Student',
        description:
          activity.description,
      })
    }
  }

  // Instructor notifications

  const createInstructorNotifications = async (
    clearanceId: string,
    primaryInstructor: Instructor,
    currentSubjects: SubjectRow[]
  ): Promise<void> => {
    if (!user || isInstructor) return

    const recipients = new Map<
      string,
      Instructor
    >()

    recipients.set(
      primaryInstructor.id,
      primaryInstructor
    )

    currentSubjects.forEach((subject) => {
      const instructorId =
        String(
          subject.instructorId || ''
        ).trim()

      if (!instructorId) return

      const assignedInstructor =
        instructors.find(
          (instructor) =>
            instructor.id === instructorId
        )

      recipients.set(
        instructorId,
        assignedInstructor || {
          id: instructorId,
          name:
            subject.instructorName ||
            'Instructor',
          email: '',
        }
      )
    })

    const senderName =
      studentName.trim() ||
      user.displayName ||
      user.email ||
      'Student'

    const batch = writeBatch(db)

    recipients.forEach((instructor) => {
      const assignedSubjects =
        currentSubjects.filter(
          (subject) =>
            subject.instructorId ===
            instructor.id
        )

      const subjectNames =
        assignedSubjects
          .map((subject) =>
            getSubjectName(subject)
          )
          .filter(Boolean)

      const message =
        assignedSubjects.length > 0
          ? `${senderName} shared a clearance with you. You have ${assignedSubjects.length} assigned subject(s): ${subjectNames.join(', ')}. Please review the clearance.`
          : `${senderName} shared a clearance document with you. Please review the clearance request.`

      const notificationRef = doc(
        collection(db, 'Notifications')
      )

      batch.set(
        notificationRef,
        {
          recipientUid: instructor.id,
          recipientEmail:
            instructor.email ===
            'No email provided'
              ? ''
              : instructor.email,

          senderUid: user.uid,
          senderName,

          studentUid: user.uid,
          studentName: senderName,

          studentEmail:
            studentEmail.trim() ||
            user.email ||
            '',

          clearanceId,
          requestId: clearanceId,

          title:
            'New Clearance Request',

          message,

          type:
            'clearance_shared',

          category:
            'clearance',

          read: false,
          isRead: false,

          link:
            `/instructor/clearance?requestId=${encodeURIComponent(clearanceId)}`,

          createdAt:
            serverTimestamp(),
        }
      )
    })

    await batch.commit()
  }

  // Save clearance

  const handleSaveClearance = async () => {
    if (!user || isInstructor) return

    if (
      saving ||
      sharing ||
      operationInProgressRef.current
    ) {
      return
    }

    operationInProgressRef.current = true
    setSaving(true)
    setSaveSuccess(false)

    let savedSuccessfully = false

    try {
      const previousSubjects =
        savedSubjectsRef.current.map(
          (subject) => ({
            ...subject,
          })
        )

      const currentSubjects =
        subjects.map(
          (subject) => ({
            ...subject,
          })
        )

      const subjectActivities =
        buildSubjectActivities(
          previousSubjects,
          currentSubjects
        )

      let clearanceId =
        existingRequestId

      const isNewClearance =
        !clearanceId

      if (clearanceId) {
        await updateDoc(
          doc(
            db,
            'requests',
            clearanceId
          ),
          {
            studentName,
            yearAndSection,
            studentId,
            studentEmail,
            subjects: currentSubjects,
            updatedAt:
              serverTimestamp(),
          }
        )
      } else {
        const document = await addDoc(
          collection(db, 'requests'),
          {
            studentUid: user.uid,
            studentName,
            yearAndSection,
            studentId,
            studentEmail,
            subjects: currentSubjects,
            status: clearanceStatus,
            createdAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp(),
          }
        )

        clearanceId = document.id

        setExistingRequestId(
          clearanceId
        )

        savedRequestRef.current =
          clearanceId
      }

      savedSuccessfully = true

      savedSubjectsRef.current =
        currentSubjects.map(
          (subject) => ({
            ...subject,
          })
        )

      setSaveSuccess(true)

      const activityLogs:
        ActivityToRecord[] = []

      if (isNewClearance) {
        activityLogs.push({
          action:
            'clearance_created',
          description:
            'You created your clearance.',
        })
      }

      activityLogs.push(
        ...subjectActivities
      )

      activityLogs.push({
        action:
          'clearance_saved',
        description:
          'You saved your clearance.',
      })

      await saveActivityLogs(
        clearanceId,
        activityLogs
      )

      setTimeout(
        () => setSaveSuccess(false),
        4000
      )
    } catch (error) {
      console.error(
        'Error saving clearance:',
        error
      )

      alert(
        savedSuccessfully
          ? 'Your clearance was saved, but some activity records could not be written. Check Firestore activity permissions.'
          : 'Failed to save clearance. Please try again.'
      )
    } finally {
      setSaving(false)
      operationInProgressRef.current =
        false
    }
  }

  // Share clearance and notify instructors

  const handleConfirmShare = async () => {
    if (!user || isInstructor) return

    if (!selectedInstructor) {
      alert(
        'Please select a primary instructor to send the request to.'
      )
      return
    }

    if (
      sharing ||
      saving ||
      operationInProgressRef.current
    ) {
      return
    }

    operationInProgressRef.current = true
    setSharing(true)
    setShareSuccess(false)

    let savedSuccessfully = false
    let notificationSucceeded = false

    try {
      const instructorToShare =
        selectedInstructor

      const previousSubjects =
        savedSubjectsRef.current.map(
          (subject) => ({
            ...subject,
          })
        )

      const currentSubjects =
        subjects.map(
          (subject) => ({
            ...subject,
          })
        )

      const subjectActivities =
        buildSubjectActivities(
          previousSubjects,
          currentSubjects
        )

      let clearanceId =
        existingRequestId

      const isNewClearance =
        !clearanceId

      if (clearanceId) {
        await updateDoc(
          doc(
            db,
            'requests',
            clearanceId
          ),
          {
            studentName,
            yearAndSection,
            studentId,
            studentEmail,
            instructorId:
              instructorToShare.id,
            instructorName:
              instructorToShare.name,
            subjects:
              currentSubjects,
            status: 'Pending',
            updatedAt:
              serverTimestamp(),
          }
        )
      } else {
        const document = await addDoc(
          collection(db, 'requests'),
          {
            studentUid:
              user.uid,
            studentName,
            yearAndSection,
            studentId,
            studentEmail,
            instructorId:
              instructorToShare.id,
            instructorName:
              instructorToShare.name,
            subjects:
              currentSubjects,
            status: 'Pending',
            createdAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp(),
          }
        )

        clearanceId =
          document.id

        setExistingRequestId(
          clearanceId
        )

        savedRequestRef.current =
          clearanceId
      }

      savedSuccessfully = true

      savedSubjectsRef.current =
        currentSubjects.map(
          (subject) => ({
            ...subject,
          })
        )

      setClearanceStatus('Pending')
      setShareSuccess(true)
      setIsModalOpen(false)
      setSelectedInstructor(null)

      // Notify the primary instructor and all assigned instructors.

      try {
        await createInstructorNotifications(
          clearanceId,
          instructorToShare,
          currentSubjects
        )

        notificationSucceeded = true
      } catch (notificationError) {
        console.error(
          '[Student Clearance] Notification error:',
          notificationError
        )
      }

      const activityLogs:
        ActivityToRecord[] = []

      if (isNewClearance) {
        activityLogs.push({
          action:
            'clearance_created',
          description:
            'You created your clearance.',
        })
      }

      activityLogs.push(
        ...subjectActivities
      )

      activityLogs.push({
        action:
          'clearance_shared',
        description:
          `You shared your clearance with ${instructorToShare.name} (${instructorToShare.email}).`,
      })

      await saveActivityLogs(
        clearanceId,
        activityLogs
      )

      if (!notificationSucceeded) {
        alert(
          'Your clearance was shared successfully, but instructor notifications could not be created. Please check the Firestore rules for the Notifications collection.'
        )
      }

      setTimeout(
        () => setShareSuccess(false),
        4000
      )
    } catch (error) {
      console.error(
        'Error sharing clearance:',
        error
      )

      alert(
        savedSuccessfully
          ? 'Your clearance was shared, but some activity records could not be written. Check Firestore activity permissions.'
          : 'Failed to share clearance. Please try again.'
      )
    } finally {
      setSharing(false)
      operationInProgressRef.current =
        false
    }
  }

  const handleOpenModal = () => {
    void fetchInstructorsList()
    setIsModalOpen(true)
  }

  const handleDownload = () => {
    window.print()
  }

  const filteredInstructors =
    instructors.filter(
      (instructor) =>
        instructor.name
          .toLowerCase()
          .includes(
            searchQuery.toLowerCase()
          ) ||
        instructor.email
          .toLowerCase()
          .includes(
            searchQuery.toLowerCase()
          )
    )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600 font-medium">
          Loading portal...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex flex-col items-center">
      {/* Top Action Bar */}

      <div className="w-full max-w-5xl mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">
            Clearance Form Portal (
            {isInstructor
              ? 'Instructor View'
              : 'Student View'}
            )
          </h1>

          {!isInstructor && clearanceStatus && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-200 text-slate-800">
              Status: {clearanceStatus}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {!isInstructor && (
            <>
              <button
                onClick={handleSaveClearance}
                disabled={saving || sharing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-500" />
                {saving
                  ? 'Saving...'
                  : saveSuccess
                    ? 'Saved'
                    : 'Save Clearance'}
              </button>

              <button
                onClick={handleOpenModal}
                disabled={saving || sharing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                {sharing
                  ? 'Sharing...'
                  : shareSuccess
                    ? 'Shared'
                    : 'Share'}
              </button>
            </>
          )}

          <button
            onClick={handleAddSubject}
            disabled={saving || sharing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-800 transition"
          >
            <Download className="w-4 h-4" />
            Download / Print
          </button>
        </div>
      </div>

      {/* Printable Clearance Form */}

      <div className="w-full max-w-5xl bg-white p-8 sm:p-12 shadow-lg rounded-2xl print:shadow-none print:p-0 print:w-full text-slate-900">
        {/* Header Information */}

        <div className="space-y-4 text-sm font-medium border-b border-slate-300 pb-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1 border-b border-slate-400 pb-1 flex items-center">
              <span className="text-slate-500 mr-2 shrink-0">
                Name:
              </span>

              <input
                type="text"
                value={studentName}
                onChange={(event) =>
                  setStudentName(
                    event.target.value
                  )
                }
                suppressHydrationWarning
                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-semibold placeholder:text-slate-300"
                placeholder="e.g., Student Full Name"
              />
            </div>

            <div className="w-full sm:w-72 border-b border-slate-400 pb-1 flex items-center">
              <span className="text-slate-500 mr-2 shrink-0">
                Year & Section:
              </span>

              <input
                type="text"
                value={yearAndSection}
                onChange={(event) =>
                  setYearAndSection(
                    event.target.value
                  )
                }
                suppressHydrationWarning
                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 placeholder:text-slate-300"
                placeholder="e.g., BSIS - 4B"
              />
            </div>

            <div className="w-full sm:w-48 border-b border-slate-400 pb-1 flex items-center">
              <span className="text-slate-500 mr-2 shrink-0">
                Date:
              </span>

              <span suppressHydrationWarning>
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="w-full sm:w-72 border-b border-slate-400 pb-1 flex items-center">
              <span className="text-slate-500 mr-2 shrink-0">
                ID no.:
              </span>

              <input
                type="text"
                value={studentId}
                onChange={(event) =>
                  setStudentId(
                    event.target.value
                  )
                }
                suppressHydrationWarning
                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                placeholder="e.g., 234157"
              />
            </div>

            <div className="flex-1 flex items-center justify-end">
              <input
                type="text"
                value={studentEmail}
                onChange={(event) =>
                  setStudentEmail(
                    event.target.value
                  )
                }
                suppressHydrationWarning
                className="w-full sm:w-72 text-right bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-xs text-slate-500"
                placeholder="e.g., student@gmail.com"
              />
            </div>
          </div>
        </div>

        {/* Clearance Subjects Table */}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-400 text-left text-sm print:table print:w-full">
            <thead>
              <tr className="bg-slate-50 print:bg-slate-100">
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-28">
                  Subject Code
                </th>

                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800">
                  Subject Description
                </th>

                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-44 text-center print:hidden">
                  Assigned Instructor
                </th>

                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-20 text-center">
                  Grades
                </th>

                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-24 text-center">
                  Remarks
                </th>

                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-32 text-center">
                  Signature
                </th>

                <th className="border border-slate-400 px-2 py-3 font-semibold text-slate-800 w-12 text-center print:hidden">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {subjects.map((subject) => {
                const isAssignedToThisInstructor =
                  isInstructor &&
                  user &&
                  subject.instructorId ===
                    user.uid

                return (
                  <tr
                    key={subject.id}
                    className="print:table-row"
                  >
                    <td className="border border-slate-400 p-2">
                      <input
                        type="text"
                        value={subject.code}
                        onChange={(event) =>
                          handleSubjectChange(
                            subject.id,
                            'code',
                            event.target.value
                          )
                        }
                        suppressHydrationWarning
                        className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-medium"
                        placeholder="Code"
                      />
                    </td>

                    <td className="border border-slate-400 p-2">
                      <input
                        type="text"
                        value={subject.description}
                        onChange={(event) =>
                          handleSubjectChange(
                            subject.id,
                            'description',
                            event.target.value
                          )
                        }
                        suppressHydrationWarning
                        className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                        placeholder="e.g., Software Engineering"
                      />
                    </td>

                    <td className="border border-slate-400 p-2 text-center print:hidden">
                      {isInstructor ? (
                        <span className="text-xs font-medium text-slate-700">
                          {subject.instructorName ||
                            'Unassigned'}
                        </span>
                      ) : (
                        <select
                          value={
                            subject.instructorId ||
                            ''
                          }
                          onChange={(event) =>
                            handleAssignInstructorToSubject(
                              subject.id,
                              event.target.value
                            )
                          }
                          suppressHydrationWarning
                          className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        >
                          <option value="">
                            Select Instructor
                          </option>

                          {instructors.map(
                            (instructor) => (
                              <option
                                key={instructor.id}
                                value={instructor.id}
                              >
                                {instructor.name}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </td>

                    <td
                      className={`relative group border border-slate-400 p-2 text-center ${
                        !isAssignedToThisInstructor &&
                        isInstructor
                          ? 'bg-slate-100/70 cursor-not-allowed select-none'
                          : ''
                      }`}
                    >
                      {!isAssignedToThisInstructor &&
                        isInstructor && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg pointer-events-none print:hidden">
                            You are not assigned to grade this subject
                          </div>
                        )}

                      {isAssignedToThisInstructor ? (
                        <input
                          type="text"
                          value={subject.grades}
                          onChange={(event) =>
                            handleSubjectChange(
                              subject.id,
                              'grades',
                              event.target.value
                            )
                          }
                          suppressHydrationWarning
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center font-semibold"
                          placeholder="Grade"
                        />
                      ) : (
                        <span className="text-slate-800 font-semibold text-xs">
                          {subject.grades || '—'}
                        </span>
                      )}
                    </td>

                    <td
                      className={`relative group border border-slate-400 p-2 text-center ${
                        !isAssignedToThisInstructor &&
                        isInstructor
                          ? 'bg-slate-100/70 cursor-not-allowed select-none'
                          : ''
                      }`}
                    >
                      {!isAssignedToThisInstructor &&
                        isInstructor && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg pointer-events-none print:hidden">
                            You are not assigned to grade this subject
                          </div>
                        )}

                      {isAssignedToThisInstructor ? (
                        <input
                          type="text"
                          value={subject.remarks}
                          onChange={(event) =>
                            handleSubjectChange(
                              subject.id,
                              'remarks',
                              event.target.value
                            )
                          }
                          suppressHydrationWarning
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center"
                          placeholder="Remarks"
                        />
                      ) : (
                        <span className="text-slate-800 text-xs">
                          {subject.remarks || '—'}
                        </span>
                      )}
                    </td>

                    <td
                      className={`relative group border border-slate-400 p-2 text-center ${
                        !isAssignedToThisInstructor &&
                        isInstructor
                          ? 'bg-slate-100/70 cursor-not-allowed select-none'
                          : ''
                      }`}
                    >
                      {!isAssignedToThisInstructor &&
                        isInstructor && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg pointer-events-none print:hidden">
                            You are not assigned to sign this subject
                          </div>
                        )}

                      {isAssignedToThisInstructor ? (
                        <input
                          type="text"
                          value={subject.signature}
                          onChange={(event) =>
                            handleSubjectChange(
                              subject.id,
                              'signature',
                              event.target.value
                            )
                          }
                          suppressHydrationWarning
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center"
                          placeholder="Sign"
                        />
                      ) : (
                        <span className="text-slate-800 text-xs flex items-center justify-center">
                          {subject.signature &&
                          subject.signature.startsWith(
                            'data:image/'
                          ) ? (
                            <img
                              src={subject.signature}
                              alt="Instructor Signature"
                              className="h-8 w-24 object-contain"
                            />
                          ) : (
                            subject.signature ||
                            '—'
                          )}
                        </span>
                      )}
                    </td>

                    <td className="border border-slate-400 p-2 text-center print:hidden">
                      <button
                        onClick={() =>
                          handleDeleteSubject(
                            subject.id
                          )
                        }
                        disabled={saving || sharing}
                        className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-red-600 rounded transition disabled:opacity-50"
                        title="Delete subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}

        <div className="mt-12 text-xs text-slate-500 text-center print:mt-16">
          <p>
            This is an official clearance document
            generated via GradeSync Student Portal.
          </p>
        </div>
      </div>

      {/* Instructor Selection Modal */}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-base font-semibold text-slate-900">
                Select Instructor to Share
              </h2>

              <button
                onClick={() =>
                  setIsModalOpen(false)
                }
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Choose an instructor from the directory
              or search below.
            </p>

            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
              {filteredInstructors.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No instructors found.
                </p>
              ) : (
                filteredInstructors.map(
                  (instructor) => (
                    <div
                      key={instructor.id}
                      onClick={() =>
                        setSelectedInstructor(
                          instructor
                        )
                      }
                      className={`p-3 rounded-lg border cursor-pointer transition flex flex-col ${
                        selectedInstructor?.id ===
                        instructor.id
                          ? 'border-slate-900 bg-slate-50 shadow-sm'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium text-slate-800 text-sm">
                        {instructor.name}
                      </span>

                      <span className="text-xs text-slate-500">
                        {instructor.email}
                      </span>
                    </div>
                  )
                )
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                onClick={() =>
                  setIsModalOpen(false)
                }
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmShare}
                disabled={
                  !selectedInstructor ||
                  sharing ||
                  saving
                }
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-lg shadow-sm hover:bg-slate-800 transition disabled:opacity-50"
              >
                {sharing
                  ? 'Sending...'
                  : 'Confirm & Share'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}