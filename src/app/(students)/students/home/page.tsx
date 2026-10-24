
'use client'

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FilePlus2,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  LockKeyhole,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  AlertCircle,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface SubjectRow {
  code: string
  description: string
  grade: string
  remarks: string
  signature: string
  completed: boolean
}

interface ClearanceRequest {
  id: string
  status: string
  studentUid: string
  studentName: string
  instructorName: string
  yearAndSection: string
  createdAt: unknown
  updatedAt: unknown
  subjects: SubjectRow[]
}

interface ActivityRecord {
  id: string
  actorUid: string
  actorName: string
  action: string
  category: string
  status: string
  description: string
  subjectCode: string
  createdAt: unknown
}

interface StudentProfile {
  firstName: string
  lastName: string
  fullName: string
  displayName: string
  course: string
  program: string
  yearAndSection: string
  email: string
  studentEmail: string
}

// ============================================
// GENERAL HELPERS
// ============================================

const getText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

const getDate = (value: unknown): Date | null => {
  if (!value) return null

  if (value instanceof Timestamp) {
    return value.toDate()
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value
  ) {
    const seconds = (
      value as { seconds?: unknown }
    ).seconds

    if (typeof seconds === 'number') {
      return new Date(seconds * 1000)
    }
  }

  return null
}

const formatDate = (value: unknown): string => {
  const date = getDate(value)

  if (!date) return 'Date unavailable'

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatRelativeTime = (value: unknown): string => {
  const date = getDate(value)

  if (!date) return 'Recently'

  const difference = Date.now() - date.getTime()

  if (difference < 0) {
    return formatDate(value)
  }

  const minutes = Math.floor(difference / 60000)
  const hours = Math.floor(difference / 3600000)
  const days = Math.floor(difference / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return formatDate(value)
}

const isCompletedStatus = (status: string): boolean => {
  return [
    'reviewed',
    'approved',
    'completed',
    'complete',
    'cleared',
  ].includes(status.toLowerCase())
}

const getStatusStyle = (status: string): string => {
  const normalized = status.toLowerCase()

  if (isCompletedStatus(status)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  if (
    normalized === 'pending' ||
    normalized === 'submitted' ||
    normalized === 'in progress'
  ) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  if (
    normalized === 'rejected' ||
    normalized === 'failed'
  ) {
    return 'bg-red-50 text-red-700 border-red-200'
  }

  return 'bg-slate-100 text-slate-600 border-slate-200'
}

// ============================================
// SUBJECT COMPLETION HELPERS
// ============================================

// A subject is complete ONLY when:
// 1. Grade is provided
// 2. Remarks are provided
// 3. Signature is provided

const hasValidValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'boolean') {
    return value
  }

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
        '–',
        'n/a',
        'na',
        'none',
        'null',
        'undefined',
        'pending',
        'not yet',
        'not signed',
        'unsigned',
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

    if (data.signed === false) return false

    if (data.isSigned === false) return false

    if (data.signed === true) return true

    if (data.isSigned === true) return true

    return [
      data.url,
      data.dataUrl,
      data.image,
      data.imageUrl,
      data.value,
      data.text,
      data.name,
      data.signature,
      data.signatureUrl,
      data.signedBy,
    ].some(hasValidValue)
  }

  return false
}

const firstValidValue = (
  ...values: unknown[]
): unknown => {
  return values.find(hasValidValue) ?? ''
}

const extractSubjectRows = (
  data: Record<string, unknown>
): SubjectRow[] => {
  const formData =
    data.formData &&
    typeof data.formData === 'object' &&
    !Array.isArray(data.formData)
      ? data.formData as Record<string, unknown>
      : {}

  const possibleArrays = [
    data.subjects,
    data.subjectRows,
    data.rows,
    data.clearanceRows,
    data.clearanceSubjects,
    data.items,
    formData.subjects,
    formData.subjectRows,
    formData.rows,
    formData.clearanceRows,
    formData.clearanceSubjects,
    formData.items,
  ]

  const rawRows = possibleArrays.find(
    (value) => Array.isArray(value)
  )

  if (!Array.isArray(rawRows)) {
    return []
  }

  return rawRows
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item)
    )
    .map((row) => {
      const code = getText(
        row.code ??
        row.subjectCode ??
        row.subject_code ??
        row.courseCode
      )

      const description = getText(
        row.description ??
        row.subjectDescription ??
        row.subjectName ??
        row.name
      )

      const gradeValue = firstValidValue(
        row.grade,
        row.grades,
        row.finalGrade,
        row.final_grade
      )

      const remarksValue = firstValidValue(
        row.remarks,
        row.remark,
        row.result
      )

      const signatureValue = firstValidValue(
        row.signature,
        row.signatureUrl,
        row.signatureData,
        row.signatureImage,
        row.instructorSignature,
        row.signedBy,
        row.isSigned
      )

      const grade = getText(gradeValue)
      const remarks = getText(remarksValue)

      const signature =
        typeof signatureValue === 'string' ||
        typeof signatureValue === 'number'
          ? getText(signatureValue)
          : hasValidValue(signatureValue)
            ? 'Signed'
            : ''

      const completed =
        hasValidValue(gradeValue) &&
        hasValidValue(remarksValue) &&
        hasValidValue(signatureValue)

      return {
        code,
        description,
        grade,
        remarks,
        signature,
        completed,
      }
    })
    .filter(
      (row) =>
        Boolean(row.code) ||
        Boolean(row.description)
    )
}

const mapClearance = (
  id: string,
  data: Record<string, unknown>
): ClearanceRequest => {
  const formData =
    data.formData &&
    typeof data.formData === 'object' &&
    !Array.isArray(data.formData)
      ? data.formData as Record<string, unknown>
      : {}

  return {
    id,
    status: getText(data.status) || 'Pending',
    studentUid: getText(data.studentUid),
    studentName:
      getText(data.studentName) ||
      getText(formData.fullName),
    instructorName: getText(data.instructorName),
    yearAndSection:
      getText(data.yearAndSection) ||
      getText(formData.yearSection),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    subjects: extractSubjectRows(data),
  }
}

// ============================================
// ACTIVITY HELPERS
// ============================================

const getActivityTitle = (
  activity: ActivityRecord
): string => {
  const titles: Record<string, string> = {
    clearance_created: 'Clearance created',
    clearance_saved: 'Clearance saved',
    clearance_updated: 'Clearance updated',
    clearance_reviewed: 'Clearance reviewed',
    clearance_shared: 'Clearance shared',
    clearance_submitted: 'Clearance submitted',
    clearance_approved: 'Clearance approved',
    signature_applied: 'Clearance signed',
    signature_updated: 'Signature updated',
    signature_removed: 'Signature removed',
    grade_updated: 'Grade updated',
    remarks_updated: 'Remarks updated',
    document_uploaded: 'Document uploaded',
    document_updated: 'Document updated',
    document_shared: 'Document shared',
    document_downloaded: 'Document downloaded',
  }

  return (
    titles[activity.action.toLowerCase()] ||
    activity.action
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      ) ||
    'Clearance activity'
  )
}

const getActivityDescription = (
  activity: ActivityRecord,
  instructorNames: Record<string, string>
): string => {
  const instructorName =
    instructorNames[activity.actorUid] ||
    activity.actorName ||
    'Your instructor'

  const subject = activity.subjectCode
    ? ` for ${activity.subjectCode}`
    : ''

  const action = activity.action.toLowerCase()

  if (action === 'signature_applied') {
    if (activity.status.toLowerCase() === 'failed') {
      return `${instructorName} could not sign your clearance${subject}.`
    }

    return `${instructorName} has signed your clearance${subject}.`
  }

  if (action === 'signature_updated') {
    return `${instructorName} updated a clearance signature${subject}.`
  }

  if (action === 'signature_removed') {
    return `${instructorName} removed a clearance signature${subject}.`
  }

  if (action === 'grade_updated') {
    return `${instructorName} updated your grade${subject}.`
  }

  if (action === 'remarks_updated') {
    return `${instructorName} updated your clearance remarks${subject}.`
  }

  if (action === 'clearance_reviewed') {
    return `${instructorName} reviewed your clearance.`
  }

  if (action === 'clearance_approved') {
    return `${instructorName} approved your clearance.`
  }

  return (
    activity.description ||
    'An update was recorded for your clearance.'
  )
}

const getActivityIcon = (action: string) => {
  const normalized = action.toLowerCase()

  if (normalized.includes('signature')) return PenTool
  if (normalized.includes('grade')) return GraduationCap
  if (normalized.includes('approved')) return CheckCircle2
  if (normalized.includes('review')) return ClipboardCheck
  if (normalized.includes('share')) return Users

  return FileText
}

const getGreeting = (): string => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'

  return 'Good evening'
}

// ============================================
// STUDENT PROFILE DATA
// ============================================

const buildStudentProfile = (
  userData: Record<string, unknown>
): StudentProfile => {
  return {
    firstName: getText(userData.firstName),
    lastName: getText(userData.lastName),
    fullName: getText(userData.fullName),
    displayName: getText(userData.displayName),
    course: getText(userData.course),
    program: getText(userData.program),
    yearAndSection: getText(userData.yearAndSection),
    email: getText(userData.email),
    studentEmail: getText(userData.studentEmail),
  }
}

// ============================================
// EMAIL RESOLUTION
// ============================================

const resolveStudentEmail = (
  currentUser: FirebaseUser | null,
  studentProfile: StudentProfile | null
): string => {
  if (!currentUser) {
    return (
      studentProfile?.email ||
      studentProfile?.studentEmail ||
      'Not available'
    )
  }

  const googleProvider = currentUser.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  const otherProvider = currentUser.providerData.find(
    (provider) => Boolean(getText(provider.email))
  )

  return (
    getText(currentUser.email) ||
    getText(googleProvider?.email) ||
    getText(otherProvider?.email) ||
    getText(studentProfile?.email) ||
    getText(studentProfile?.studentEmail) ||
    'Not available'
  )
}

// ============================================
// MAIN STUDENT DASHBOARD
// ============================================

export default function Page() {
  const router = useRouter()

  const [user, setUser] =
    useState<FirebaseUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [imageError, setImageError] = useState(false)

  const [profile, setProfile] =
    useState<StudentProfile | null>(null)

  const [clearances, setClearances] =
    useState<ClearanceRequest[]>([])

  const [documentClearances, setDocumentClearances] =
    useState<ClearanceRequest[]>([])

  const [activities, setActivities] =
    useState<ActivityRecord[]>([])

  const [instructorNames, setInstructorNames] =
    useState<Record<string, string>>({})

  const [fetchingData, setFetchingData] =
    useState(true)

  const [fetchingDocuments, setFetchingDocuments] =
    useState(true)

  const [dataError, setDataError] =
    useState('')

  const [documentError, setDocumentError] =
    useState('')

  // ============================================
  // AUTHENTICATION AND STUDENT ROLE VERIFICATION
  // ============================================

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) return

        setLoading(true)
        setAuthorized(false)
        setUser(null)
        setProfile(null)
        setClearances([])
        setDocumentClearances([])
        setActivities([])
        setInstructorNames({})
        setFetchingData(true)
        setFetchingDocuments(true)
        setDataError('')
        setDocumentError('')
        setImageError(false)

        if (!currentUser) {
          router.replace('/login')

          if (active) {
            setLoading(false)
            setFetchingData(false)
            setFetchingDocuments(false)
          }

          return
        }

        try {
          const userRef = doc(
            db,
            'users',
            currentUser.uid
          )

          const userSnap = await getDoc(userRef)

          if (!active) return

          if (!userSnap.exists()) {
            console.warn(
              '[Student Access] User profile not found:',
              currentUser.uid
            )

            router.replace('/login')
            return
          }

          const userData = userSnap.data()
          const role = userData?.role

          if (role !== 'student') {
            console.warn(
              '[Student Access] Access denied. Role:',
              role
            )

            if (role === 'instructor') {
              router.replace('/instructor/home')
            } else {
              router.replace('/login')
            }

            return
          }

          const studentProfile = buildStudentProfile(
            userData
          )

          setProfile(studentProfile)
          setUser(currentUser)
          setAuthorized(true)
          setLoading(false)
        } catch (error) {
          console.error(
            '[Student Access] Failed to verify student role:',
            error
          )

          if (!active) return

          setAuthorized(false)
          setUser(null)
          router.replace('/login')
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  // ============================================
  // LIVE FIRESTORE STUDENT PROFILE
  // ============================================

  useEffect(() => {
    if (!authorized || !user) return

    const userRef = doc(db, 'users', user.uid)

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.warn(
            '[Student Dashboard] Student profile no longer exists.'
          )

          setAuthorized(false)
          router.replace('/login')
          return
        }

        const userData = snapshot.data()

        if (userData.role !== 'student') {
          setAuthorized(false)

          if (userData.role === 'instructor') {
            router.replace('/instructor/home')
          } else {
            router.replace('/login')
          }

          return
        }

        setProfile(buildStudentProfile(userData))
      },
      (error) => {
        console.error(
          '[Student Dashboard] Failed to synchronize profile:',
          error
        )
      }
    )

    return () => unsubscribe()
  }, [authorized, user, router])

  // ============================================
  // LIVE CLEARANCE REQUEST DATA
  // ORIGINAL REQUESTS COLLECTION PRESERVED
  // ============================================

  useEffect(() => {
    if (!authorized || !user) return

    const clearanceQuery = query(
      collection(db, 'requests'),
      where('studentUid', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      clearanceQuery,
      (snapshot) => {
        const records: ClearanceRequest[] =
          snapshot.docs.map((document) => {
            return mapClearance(
              document.id,
              document.data()
            )
          })

        setClearances(records)
        setFetchingData(false)
        setDataError('')
      },
      (error) => {
        console.error(
          '[Student Dashboard] Error loading clearances:',
          error
        )

        setClearances([])
        setFetchingData(false)
        setDataError(
          'Unable to load your clearance information. Please check your connection or Firestore permissions.'
        )
      }
    )

    return () => unsubscribe()
  }, [authorized, user])

  // ============================================
  // NEW: LIVE CLEARANCE DOCUMENT SUBJECT DATA
  // ============================================

  useEffect(() => {
    if (!authorized || !user) return

    const documentsQuery = query(
      collection(db, 'clearances'),
      where('studentUid', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      documentsQuery,
      (snapshot) => {
        const records = snapshot.docs.map((document) =>
          mapClearance(
            document.id,
            document.data()
          )
        )

        setDocumentClearances(records)
        setFetchingDocuments(false)
        setDocumentError('')
      },
      (error) => {
        console.error(
          '[Student Dashboard] Error loading clearance documents:',
          error
        )

        setDocumentClearances([])
        setFetchingDocuments(false)

        setDocumentError(
          'Unable to load subject progress from clearance documents. Check your Firestore permissions.'
        )
      }
    )

    return () => unsubscribe()
  }, [authorized, user])

  // ============================================
  // LIVE STUDENT ACTIVITIES
  // ============================================

  useEffect(() => {
    if (!authorized || !user) return

    const activityQuery = query(
      collection(db, 'activities'),
      where('studentUid', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      activityQuery,
      (snapshot) => {
        const records: ActivityRecord[] =
          snapshot.docs.map((document) => {
            const data = document.data()

            return {
              id: document.id,
              actorUid: getText(data.actorUid),
              actorName: getText(data.actorName),
              action: getText(data.action),
              category: getText(data.category),
              status: getText(data.status),
              description: getText(
                data.description
              ),
              subjectCode: getText(
                data.subjectCode
              ),
              createdAt: data.createdAt ?? null,
            }
          })

        setActivities(records)
      },
      (error) => {
        console.error(
          '[Student Dashboard] Error loading activities:',
          error
        )
      }
    )

    return () => unsubscribe()
  }, [authorized, user])

  // ============================================
  // FETCH INSTRUCTOR NAMES
  // ============================================

  useEffect(() => {
    if (!authorized || !user || activities.length === 0) {
      return
    }

    let cancelled = false

    const instructorUids = Array.from(
      new Set(
        activities
          .filter(
            (activity) =>
              activity.actorUid &&
              activity.actorUid !== user.uid
          )
          .map((activity) => activity.actorUid)
      )
    )

    const fetchInstructorNames = async () => {
      const entries = await Promise.all(
        instructorUids.map(async (uid) => {
          try {
            const snapshot = await getDoc(
              doc(db, 'users', uid)
            )

            if (!snapshot.exists()) {
              return [uid, ''] as const
            }

            const data = snapshot.data()

            const combinedName = [
              getText(data.firstName),
              getText(data.lastName),
            ]
              .filter(Boolean)
              .join(' ')

            const name =
              getText(data.fullName) ||
              getText(data.name) ||
              getText(data.displayName) ||
              combinedName

            return [uid, name] as const
          } catch (error) {
            console.error(
              '[Student Dashboard] Instructor lookup failed:',
              error
            )

            return [uid, ''] as const
          }
        })
      )

      if (!cancelled) {
        setInstructorNames(
          Object.fromEntries(entries)
        )
      }
    }

    void fetchInstructorNames()

    return () => {
      cancelled = true
    }
  }, [authorized, user, activities])

  // ============================================
  // UPDATED: SUBJECT-BASED DASHBOARD CALCULATIONS
  // ============================================

  const latestClearance = useMemo(() => {
    const allRecords = [
      ...clearances,
      ...documentClearances,
    ]

    return [...allRecords].sort((a, b) => {
      const aDate = getDate(
        a.updatedAt || a.createdAt
      )?.getTime() ?? 0

      const bDate = getDate(
        b.updatedAt || b.createdAt
      )?.getTime() ?? 0

      return bDate - aDate
    })[0] ?? null
  }, [clearances, documentClearances])

  const progressClearance = useMemo(() => {
    const allRecords = [
      ...documentClearances,
      ...clearances,
    ]

    const recordsWithSubjects = allRecords.filter(
      (record) => record.subjects.length > 0
    )

    return [...recordsWithSubjects].sort((a, b) => {
      const aDate = getDate(
        a.updatedAt || a.createdAt
      )?.getTime() ?? 0

      const bDate = getDate(
        b.updatedAt || b.createdAt
      )?.getTime() ?? 0

      return bDate - aDate
    })[0] ?? null
  }, [clearances, documentClearances])

  const stats = useMemo(() => {
    const subjects =
      progressClearance?.subjects ?? []

    const total = subjects.length

    const completed = subjects.filter(
      (subject) => subject.completed
    ).length

    const pending = total - completed

    const signatures = activities.filter(
      (activity) =>
        activity.action === 'signature_applied' &&
        activity.status.toLowerCase() === 'success'
    ).length

    const signedSubjects = subjects.filter(
      (subject) =>
        hasValidValue(subject.signature)
    ).length

    const progress =
      total > 0
        ? Math.round((completed / total) * 100)
        : 0

    return {
      total,
      completed,
      pending,
      signatures,
      signedSubjects,
      progress,
    }
  }, [progressClearance, activities])

  const recentActivities = useMemo(() => {
    return [...activities]
      .sort((a, b) => {
        const aDate =
          getDate(a.createdAt)?.getTime() ?? 0

        const bDate =
          getDate(b.createdAt)?.getTime() ?? 0

        return bDate - aDate
      })
      .slice(0, 5)
  }, [activities])

  const displayName = useMemo(() => {
    const profileName =
      profile?.fullName ||
      profile?.displayName ||
      [
        profile?.firstName,
        profile?.lastName,
      ]
        .filter(Boolean)
        .join(' ')

    return (
      profileName ||
      user?.displayName ||
      user?.providerData?.[0]?.displayName ||
      'Student'
    )
  }, [profile, user])

  const studentEmail = useMemo(() => {
    return resolveStudentEmail(user, profile)
  }, [user, profile])

  const firstName =
    displayName.split(' ')[0] || 'Student'

  const photoURL =
    user?.photoURL ||
    user?.providerData?.[0]?.photoURL ||
    null

  const clearanceStatus =
    latestClearance?.status || 'Not Started'

  const hasClearance =
    clearances.length > 0 ||
    documentClearances.length > 0

  const fetchingProgress =
    fetchingData || fetchingDocuments

  const greeting = getGreeting()

  const today = new Date().toLocaleDateString(
    'en-PH',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  )

  // ============================================
  // SECURITY: STUDENT ACCESS ONLY
  // ============================================

  if (loading || !authorized || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <RefreshCw className="w-6 h-6 text-emerald-700 animate-spin" />
          </div>

          <p className="text-sm font-semibold text-slate-800">
            {loading
              ? 'Verifying student access...'
              : 'Redirecting...'}
          </p>

          <p className="text-xs text-slate-500 mt-1">
            Preparing your GradeSync dashboard
          </p>
        </div>
      </div>
    )
  }

  // ============================================
  // MAIN DASHBOARD
  // ============================================

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* PAGE HEADING */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
              <LayoutDashboard className="h-4 w-4" />
              Student Dashboard
            </div>

            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Your academic overview
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Everything you need to stay on top of your clearance.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 shadow-sm">
            <CalendarDays className="h-4 w-4 text-emerald-700" />
            {today}
          </div>
        </div>

        {/* WELCOME HERO */}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 sm:p-8 lg:p-10 text-white shadow-xl shadow-emerald-950/10">
          <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="absolute right-10 bottom-0 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shrink-0">
                  {photoURL && !imageError ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={() =>
                        setImageError(true)
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
                      {firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-emerald-100/80">
                    {greeting},
                  </p>

                  <h2 className="text-xl sm:text-2xl font-bold">
                    {firstName}!
                    <span className="ml-2">👋</span>
                  </h2>
                </div>
              </div>

              <h3 className="mt-7 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                Your clearance process,
                <span className="block text-emerald-200">
                  made simpler.
                </span>
              </h3>

              <p className="mt-4 max-w-lg text-sm sm:text-base leading-relaxed text-emerald-50/80">
                Create your clearance, collaborate with your
                instructors, and follow every update from
                one convenient place.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/students/Clearance"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"
                >
                  <FilePlus2 className="h-4 w-4" />
                  {hasClearance
                    ? 'Manage Clearance'
                    : 'Get Started'}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/students/activity"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  <History className="h-4 w-4" />
                  View Activity
                </Link>
              </div>
            </div>

            {/* UPDATED OVERALL PROGRESS */}

            <div className="w-full lg:w-72 shrink-0">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/80">
                    Clearance Overview
                  </p>

                  <Sparkles className="h-5 w-5 text-emerald-200" />
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div
                    className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#a7f3d0 ${stats.progress}%, rgba(255,255,255,0.15) ${stats.progress}%)`,
                    }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950">
                      <span className="text-xl font-bold text-white">
                        {fetchingProgress
                          ? '...'
                          : `${stats.progress}%`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Overall Progress
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-emerald-100/75">
                      {fetchingProgress
                        ? 'Loading your subjects...'
                        : `${stats.completed} of ${stats.total} subjects completed`}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-emerald-200 transition-all duration-500"
                    style={{
                      width: `${stats.progress}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-emerald-100/75">
                  A subject is completed when its grade,
                  remarks, and instructor signature
                  are all provided.
                </p>

                {!fetchingProgress && stats.total > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-xs">
                    <span className="text-emerald-100/75">
                      Remaining subjects
                    </span>

                    <span className="font-bold text-white">
                      {stats.pending}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* DATA ERRORS */}

        {(dataError || documentError) && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />

            <div>
              <p className="text-sm font-semibold text-red-800">
                Some dashboard data could not be loaded
              </p>

              {dataError && (
                <p className="mt-1 text-xs text-red-700">
                  {dataError}
                </p>
              )}

              {documentError && (
                <p className="mt-1 text-xs text-red-700">
                  {documentError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* UPDATED STATISTICS */}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

          {/* TOTAL SUBJECTS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <FileText className="h-5 w-5 text-blue-700" />
              </div>

              <TrendingUp className="h-4 w-4 text-slate-300" />
            </div>

            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {fetchingProgress ? '—' : stats.total}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Total Subjects
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Subjects in your clearance
            </p>
          </div>

          {/* NOT COMPLETED */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                <Clock3 className="h-5 w-5 text-amber-600" />
              </div>

              <span className="h-2 w-2 rounded-full bg-amber-400" />
            </div>

            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {fetchingProgress ? '—' : stats.pending}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Not Completed
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Subjects requiring attention
            </p>
          </div>

          {/* COMPLETED */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              </div>

              <Check className="h-4 w-4 text-emerald-500" />
            </div>

            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {fetchingProgress ? '—' : stats.completed}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Completed
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Graded, reviewed, and signed subjects
            </p>
          </div>

          {/* SIGNING EVENTS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
                <PenTool className="h-5 w-5 text-violet-700" />
              </div>

              <Activity className="h-4 w-4 text-slate-300" />
            </div>

            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
              {stats.signatures}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Signing Events
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Successful signature activities
            </p>
          </div>
        </div>

        {/* MAIN CONTENT GRID */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* LEFT COLUMN */}

          <div className="space-y-6 xl:col-span-2">

            {/* CURRENT CLEARANCE */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Clearance Status
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Your most recently updated clearance
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                  <ClipboardCheck className="h-5 w-5 text-emerald-700" />
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {fetchingProgress ? (
                  <div className="flex items-center gap-3 py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />

                    <p className="text-sm text-slate-500">
                      Checking your clearance status...
                    </p>
                  </div>
                ) : !latestClearance ? (
                  <div className="py-7 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                      <FilePlus2 className="h-8 w-8 text-emerald-700" />
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-900">
                      Ready to begin?
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                      You haven&apos;t created a clearance yet.
                      Start your first clearance and share it
                      with your instructors.
                    </p>

                    <Link
                      href="/students/Clearance"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Create Clearance
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Latest Record
                        </p>

                        <h3 className="mt-2 text-xl font-bold text-slate-900">
                          {latestClearance.studentName ||
                            'Student Clearance'}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {latestClearance.yearAndSection ||
                            profile?.yearAndSection ||
                            'Academic clearance'}
                        </p>
                      </div>

                      <span
                        className={`inline-flex self-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusStyle(clearanceStatus)}`}
                      >
                        {isCompletedStatus(clearanceStatus) ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}

                        {clearanceStatus}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                          Last Updated
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {formatDate(
                            latestClearance.updatedAt ||
                            latestClearance.createdAt
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">
                          Assigned Instructor
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {latestClearance.instructorName ||
                            'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* NEW: SUBJECT COMPLETION SUMMARY */}

                    {stats.total > 0 && (
                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Subject Completion
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {stats.completed} completed out of {stats.total} subjects
                            </p>
                          </div>

                          <span className="text-lg font-bold text-emerald-700">
                            {stats.progress}%
                          </span>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                            style={{
                              width: `${stats.progress}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <div className="flex items-start gap-3">
                        {stats.total > 0 &&
                        stats.completed === stats.total ? (
                          <CheckCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                        ) : (
                          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                        )}

                        <div>
                          <p className="text-sm font-semibold text-emerald-950">
                            {stats.total > 0 &&
                            stats.completed === stats.total
                              ? 'All your subjects are completed'
                              : 'Stay updated on your clearance'}
                          </p>

                          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                            {stats.total > 0 &&
                            stats.completed === stats.total
                              ? 'All subjects have grades, remarks, and signatures. Check your clearance form for the latest details.'
                              : 'Review your clearance and activity history to see instructor updates, grades, remarks, and signatures.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href="/students/Clearance"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                      >
                        Open Clearance
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <Link
                        href="/students/activity"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        View History
                        <History className="h-4 w-4" />
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* NEW: SUBJECT PROGRESS DETAILS */}

            {stats.total > 0 && progressClearance && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Subject Progress
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Track grades, remarks, and signatures for each subject
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <BookOpen className="h-5 w-5 text-blue-700" />
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {progressClearance.subjects.map(
                    (subject, index) => (
                      <div
                        key={`${subject.code}-${index}`}
                        className="px-5 py-4 sm:px-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {subject.code ||
                                `Subject ${index + 1}`}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {subject.description ||
                                'Subject details'}
                            </p>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                              subject.completed
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {subject.completed ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Clock3 className="h-3.5 w-3.5" />
                            )}

                            {subject.completed
                              ? 'Completed'
                              : 'Incomplete'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                              hasValidValue(subject.grade)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Grade: {subject.grade || 'Pending'}
                          </span>

                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                              hasValidValue(subject.remarks)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Remarks: {subject.remarks || 'Pending'}
                          </span>

                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                              hasValidValue(subject.signature)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            Signature: {hasValidValue(subject.signature)
                              ? 'Signed'
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* RECENT ACTIVITY */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Recent Activity
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    The latest updates from your instructors
                  </p>
                </div>

                <Link
                  href="/students/activity"
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 transition hover:text-emerald-600"
                >
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              {recentActivities.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <History className="h-7 w-7 text-slate-400" />
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-slate-900">
                    No recent activity yet
                  </h3>

                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                    Instructor reviews, clearance signatures,
                    and other recorded updates will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentActivities.map((activity) => {
                    const ActivityIcon = getActivityIcon(
                      activity.action
                    )

                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50 sm:px-6"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                          <ActivityIcon className="h-5 w-5 text-emerald-700" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {getActivityTitle(activity)}
                            </h3>

                            <span className="text-[11px] text-slate-400">
                              {formatRelativeTime(
                                activity.createdAt
                              )}
                            </span>
                          </div>

                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {getActivityDescription(
                              activity,
                              instructorNames
                            )}
                          </p>

                          {activity.subjectCode && (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                              <BookOpen className="h-3 w-3" />
                              {activity.subjectCode}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* GETTING STARTED GUIDE */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Sparkles className="h-5 w-5 text-blue-700" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    How GradeSync Works
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Four simple steps to manage your clearance
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    step: '01',
                    title: 'Create your clearance',
                    description:
                      'Open the clearance form and enter your academic information.',
                    icon: FilePlus2,
                  },
                  {
                    step: '02',
                    title: 'Share with instructors',
                    description:
                      'Send your clearance to the instructor who needs to review it.',
                    icon: Users,
                  },
                  {
                    step: '03',
                    title: 'Track updates',
                    description:
                      'See when your instructors review, update, or sign your clearance.',
                    icon: History,
                  },
                  {
                    step: '04',
                    title: 'Complete your clearance',
                    description:
                      'Check the final details and prepare your clearance for submission.',
                    icon: CheckCircle2,
                  },
                ].map((item) => {
                  const StepIcon = item.icon

                  return (
                    <div
                      key={item.step}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
                          <StepIcon className="h-4 w-4 text-emerald-700" />
                        </div>

                        <span className="text-xs font-bold text-slate-300">
                          {item.step}
                        </span>
                      </div>

                      <h3 className="mt-3 text-sm font-bold text-slate-900">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}

          <div className="space-y-6">

            {/* QUICK ACTIONS */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-700" />

                <h2 className="text-base font-bold text-slate-900">
                  Quick Actions
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Jump straight to what you need
              </p>

              <div className="mt-5 space-y-3">
                <Link
                  href="/students/Clearance"
                  className="group flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 transition hover:bg-emerald-100"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900 text-white">
                    <FilePlus2 className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-emerald-950">
                      Clearance Form
                    </p>

                    <p className="mt-0.5 text-xs text-emerald-800/70">
                      Create or manage clearance
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-emerald-700 transition group-hover:translate-x-1" />
                </Link>

                <Link
                  href="/students/activity"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:bg-slate-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                    <History className="h-5 w-5 text-violet-700" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      Activity History
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Track instructor updates
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                </Link>

                <Link
                  href="/students/profile"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:bg-slate-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <UserRound className="h-5 w-5 text-blue-700" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      My Profile
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      View your account details
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* STUDENT INFORMATION */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-emerald-700" />

                <h2 className="text-base font-bold text-slate-900">
                  Student Information
                </h2>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs text-slate-400">
                    Student Name
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {displayName}
                  </p>
                </div>

                {/* EMAIL ADDRESS */}

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">
                    Email Address
                  </p>

                  <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                    {studentEmail}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">
                    Program
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {profile?.program ||
                      profile?.course ||
                      'Not specified'}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">
                    Year & Section
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {profile?.yearAndSection ||
                      latestClearance?.yearAndSection ||
                      'Not specified'}
                  </p>
                </div>
              </div>

              <Link
                href="/students/profile"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                View Profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* SECURITY */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />

                <h2 className="text-base font-bold text-slate-900">
                  Account & Security
                </h2>
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <LockKeyhole className="h-4 w-4 text-emerald-700" />
                </div>

                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    Authenticated
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                    You are signed in with Firebase Authentication
                    and verified as a student.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Account Role
                </span>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
                  Student
                </span>
              </div>
            </div>

            {/* HELPFUL TIP */}

            <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-sm sm:p-6">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/10" />

              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <CircleHelp className="h-5 w-5 text-emerald-300" />
                </div>

                <h2 className="mt-4 text-base font-bold">
                  Helpful Reminder
                </h2>

                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Double-check your subject codes and student
                  information before sharing your clearance.
                  Accurate details help instructors review
                  your document more efficiently.
                </p>

                <Link
                  href="/students/Clearance"
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-emerald-300 transition hover:text-white"
                >
                  Check My Clearance
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 pb-2 text-xs text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-700" />

            <span className="font-semibold text-slate-600">
              GradeSync
            </span>

            <span>Student Portal</span>
          </div>

          <p>
            Making academic clearance management easier.
          </p>
        </div>
      </div>
    </div>
  )
}
