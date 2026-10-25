
'use client'

import React, {
  useCallback,
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
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  BarChart3,
  ListTodo,
  Zap,
} from 'lucide-react'

interface SubjectRow {
  id: string
  code: string
  description: string
  grades: string
  remarks: string
  signature: unknown
  instructorId: string
  instructorName: string
}

interface ClearanceRequest {
  id: string
  studentUid: string
  studentName: string
  yearAndSection: string
  studentId: string
  studentEmail: string
  subjects: SubjectRow[]
  status: string
  createdAt: unknown
  updatedAt: unknown
}

interface InstructorProfile {
  displayName: string
  fullName: string
  firstName: string
  lastName: string
  email: string
  department: string
  position: string
  photoURL: string
  role: string
}

type AssignedRequest = ClearanceRequest & {
  assignedSubjects: SubjectRow[]
  completedSubjects: number
  pendingSubjects: number
  progress: number
}

interface SubjectGroup {
  key: string
  code: string
  description: string
  total: number
  completed: number
  requestIds: string[]
}

const CLEARANCE_ROUTE = '/instructor/clearance'

const getText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

const getDate = (value: unknown): Date | null => {
  if (!value) return null

  if (value instanceof Timestamp) return value.toDate()

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
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

const hasValidValue = (value: unknown): boolean => {
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

const isSubjectComplete = (subject: SubjectRow): boolean => {
  return (
    hasValidValue(subject.grades) &&
    hasValidValue(subject.remarks) &&
    hasValidValue(subject.signature)
  )
}

const mapRequest = (
  id: string,
  data: Record<string, unknown>
): ClearanceRequest => {
  const formData =
    data.formData &&
    typeof data.formData === 'object' &&
    !Array.isArray(data.formData)
      ? (data.formData as Record<string, unknown>)
      : {}

  const rawSubjects = Array.isArray(data.subjects)
    ? data.subjects
    : Array.isArray(data.subjectRows)
      ? data.subjectRows
      : Array.isArray(formData.subjects)
        ? formData.subjects
        : []

  const subjects: SubjectRow[] = rawSubjects
    .filter(
      (item: unknown): item is Record<string, unknown> =>
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item)
    )
    .map((item, index) => ({
      id: getText(item.id) || String(index),
      code: getText(item.code ?? item.subjectCode),
      description: getText(
        item.description ?? item.subjectDescription
      ),
      grades: getText(
        item.grades ?? item.grade ?? item.finalGrade
      ),
      remarks: getText(item.remarks ?? item.remark),
      signature:
        item.signature ??
        item.signatureUrl ??
        item.signatureData ??
        item.isSigned ??
        '',
      instructorId: getText(item.instructorId),
      instructorName: getText(item.instructorName),
    }))

  return {
    id,
    studentUid: getText(data.studentUid),
    studentName:
      getText(data.displayName) ||
      getText(data.studentName) ||
      getText(formData.fullName) ||
      'Unnamed Student',
    yearAndSection:
      getText(data.yearAndSection) ||
      getText(formData.yearSection),
    studentId:
      getText(data.studentId) ||
      getText(formData.idNumber),
    studentEmail: getText(data.studentEmail),
    subjects,
    status: getText(data.status) || 'Pending',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

const buildProfile = (
  data: Record<string, unknown>
): InstructorProfile => ({
  displayName: getText(data.displayName),
  fullName: getText(data.fullName),
  firstName: getText(data.firstName),
  lastName: getText(data.lastName),
  email: getText(data.email),
  department: getText(data.department),
  position: getText(data.position),
  photoURL: getText(data.photoURL),
  role: getText(data.role),
})

const getGreeting = (): string => {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const getClearanceHref = (
  requestId?: string,
  subjectCode?: string
): string => {
  const params = new URLSearchParams()

  if (requestId) {
    params.set('requestId', requestId)
  }

  if (subjectCode) {
    params.set('subject', subjectCode)
  }

  const queryString = params.toString()

  return queryString
    ? `${CLEARANCE_ROUTE}?${queryString}`
    : CLEARANCE_ROUTE
}

export default function InstructorHomePage() {
  const router = useRouter()

  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null)

  const [profile, setProfile] =
    useState<InstructorProfile | null>(null)

  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fetchingRequests, setFetchingRequests] =
    useState(true)

  const [assignedRequests, setAssignedRequests] =
    useState<ClearanceRequest[]>([])

  const [dataError, setDataError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true)
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!active) return

        setLoading(true)
        setAuthorized(false)
        setCurrentUser(null)
        setProfile(null)
        setAssignedRequests([])
        setFetchingRequests(true)
        setDataError('')

        if (!user) {
          router.replace('/login')
          return
        }

        try {
          const userSnapshot = await getDoc(
            doc(db, 'users', user.uid)
          )

          if (!active) return

          if (!userSnapshot.exists()) {
            router.replace('/login')
            return
          }

          const userData = userSnapshot.data()

          if (userData.role !== 'instructor') {
            router.replace(
              userData.role === 'student'
                ? '/students/home'
                : '/login'
            )
            return
          }

          setCurrentUser(user)
          setProfile(buildProfile(userData))
          setAuthorized(true)
        } catch (error) {
          console.error(
            '[Instructor Dashboard] Authorization failed:',
            error
          )

          if (active) {
            router.replace('/login')
          }
        } finally {
          if (active) setLoading(false)
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (!authorized || !currentUser) return

    const unsubscribe = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          setAuthorized(false)
          router.replace('/login')
          return
        }

        const data = snapshot.data()

        if (data.role !== 'instructor') {
          setAuthorized(false)
          router.replace(
            data.role === 'student'
              ? '/students/home'
              : '/login'
          )
          return
        }

        setProfile(buildProfile(data))
      },
      (error) => {
        console.error(
          '[Instructor Dashboard] Profile listener error:',
          error
        )
      }
    )

    return () => unsubscribe()
  }, [authorized, currentUser, router])

  useEffect(() => {
    if (!authorized || !currentUser) return

    let active = true

    const loadRequests = async () => {
      try {
        const snapshot = await getDocs(
          collection(db, 'requests')
        )

        if (!active) return

        const matched = snapshot.docs
          .map((document) =>
            mapRequest(document.id, document.data())
          )
          .filter((request) =>
            request.subjects.some(
              (subject) =>
                subject.instructorId === currentUser.uid
            )
          )

        setAssignedRequests(matched)
        setDataError('')
      } catch (error) {
        console.error(
          '[Instructor Dashboard] Requests error:',
          error
        )

        if (!active) return

        setDataError(
          'Unable to load assigned clearance requests. Please check your Firestore permissions and connection.'
        )
      } finally {
        if (active) setFetchingRequests(false)
      }
    }

    void loadRequests()

    return () => {
      active = false
    }
  }, [authorized, currentUser])

  const refreshRequests = useCallback(async () => {
    if (!currentUser || refreshing) return

    setRefreshing(true)

    try {
      const snapshot = await getDocs(
        collection(db, 'requests')
      )

      const matched = snapshot.docs
        .map((document) =>
          mapRequest(document.id, document.data())
        )
        .filter((request) =>
          request.subjects.some(
            (subject) =>
              subject.instructorId === currentUser.uid
          )
        )

      setAssignedRequests(matched)
      setDataError('')
    } catch (error) {
      console.error(
        '[Instructor Dashboard] Refresh error:',
        error
      )

      setDataError(
        'Unable to refresh your requests. Please try again.'
      )
    } finally {
      setRefreshing(false)
    }
  }, [currentUser, refreshing])

  const requests = useMemo<AssignedRequest[]>(() => {
    return assignedRequests
      .map((request) => {
        const assignedSubjects = request.subjects.filter(
          (subject) =>
            subject.instructorId === currentUser?.uid
        )

        const completedSubjects =
          assignedSubjects.filter(isSubjectComplete).length

        const pendingSubjects =
          assignedSubjects.length - completedSubjects

        return {
          ...request,
          assignedSubjects,
          completedSubjects,
          pendingSubjects,
          progress:
            assignedSubjects.length > 0
              ? Math.round(
                  (completedSubjects /
                    assignedSubjects.length) *
                    100
                )
              : 0,
        }
      })
      .sort((a, b) => {
        const aDate =
          getDate(a.updatedAt || a.createdAt)
            ?.getTime() ?? 0

        const bDate =
          getDate(b.updatedAt || b.createdAt)
            ?.getTime() ?? 0

        return bDate - aDate
      })
  }, [assignedRequests, currentUser])

  const stats = useMemo(() => {
    const totalRequests = requests.length

    const totalSubjects = requests.reduce(
      (sum, request) =>
        sum + request.assignedSubjects.length,
      0
    )

    const completedSubjects = requests.reduce(
      (sum, request) =>
        sum + request.completedSubjects,
      0
    )

    const pendingSubjects =
      totalSubjects - completedSubjects

    const completedRequests = requests.filter(
      (request) => request.pendingSubjects === 0
    ).length

    const pendingRequests =
      totalRequests - completedRequests

    const signedSubjects = requests.reduce(
      (sum, request) =>
        sum +
        request.assignedSubjects.filter((subject) =>
          hasValidValue(subject.signature)
        ).length,
      0
    )

    const gradedSubjects = requests.reduce(
      (sum, request) =>
        sum +
        request.assignedSubjects.filter((subject) =>
          hasValidValue(subject.grades)
        ).length,
      0
    )

    const progress =
      totalSubjects > 0
        ? Math.round(
            (completedSubjects / totalSubjects) * 100
          )
        : 0

    const uniqueStudents = new Set(
      requests.map(
        (request) =>
          request.studentUid ||
          request.studentId ||
          request.id
      )
    ).size

    return {
      totalRequests,
      totalSubjects,
      completedSubjects,
      pendingSubjects,
      completedRequests,
      pendingRequests,
      signedSubjects,
      gradedSubjects,
      progress,
      uniqueStudents,
    }
  }, [requests])

  const pendingQueue = useMemo(() => {
    return requests
      .filter((request) => request.pendingSubjects > 0)
      .sort((a, b) => {
        if (a.pendingSubjects !== b.pendingSubjects) {
          return b.pendingSubjects - a.pendingSubjects
        }

        return (
          (getDate(a.createdAt)?.getTime() ?? 0) -
          (getDate(b.createdAt)?.getTime() ?? 0)
        )
      })
      .slice(0, 4)
  }, [requests])

  const subjectBreakdown = useMemo<SubjectGroup[]>(() => {
    const map = new Map<string, SubjectGroup>()

    requests.forEach((request) => {
      request.assignedSubjects.forEach((subject) => {
        const key =
          subject.code.trim().toLowerCase() ||
          subject.description.trim().toLowerCase() ||
          'unspecified'

        const existing = map.get(key) || {
          key,
          code: subject.code || 'Unspecified',
          description: subject.description,
          total: 0,
          completed: 0,
          requestIds: [],
        }

        existing.total += 1

        if (isSubjectComplete(subject)) {
          existing.completed += 1
        }

        if (!existing.requestIds.includes(request.id)) {
          existing.requestIds.push(request.id)
        }

        map.set(key, existing)
      })
    })

    return Array.from(map.values()).sort(
      (a, b) => b.total - a.total
    )
  }, [requests])

  const displayName =
    profile?.displayName ||
    profile?.fullName ||
    [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    currentUser?.displayName ||
    'Instructor'

  const firstName =
    displayName.split(' ')[0] || 'Instructor'

  const photoURL =
    profile?.photoURL ||
    currentUser?.photoURL ||
    currentUser?.providerData?.[0]?.photoURL ||
    ''

  const email =
    profile?.email ||
    currentUser?.email ||
    'Not available'

  const today = mounted
    ? new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  if (loading || !authorized || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <RefreshCw className="h-7 w-7 animate-spin text-emerald-800" />
          </div>

          <h2 className="text-base font-bold text-slate-900">
            {loading
              ? 'Verifying instructor access'
              : 'Redirecting'}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Preparing your GradeSync workspace...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* PAGE HEADER */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
              <LayoutDashboard className="h-4 w-4" />
              Instructor Workspace
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard Overview
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Monitor student requests, review subjects, and manage your workload.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 shadow-sm">
              <CalendarDays className="h-4 w-4 text-emerald-700" />
              {today || 'Today'}
            </div>

            <button
              type="button"
              suppressHydrationWarning
              onClick={() => void refreshRequests()}
              disabled={refreshing}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* PREMIUM WELCOME BANNER */}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1535] via-[#172c66] to-[#204aab] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-4 -top-12 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute bottom-0 right-20 h-48 w-48 rounded-full bg-blue-300/10 blur-3xl" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/15">
                  {photoURL && !imageError ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <span className="text-xl font-bold">
                      {firstName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm text-blue-100/80">
                    {mounted ? getGreeting() : 'Welcome back'},
                  </p>

                  <h2 className="text-xl font-bold sm:text-2xl">
                    {displayName}
                  </h2>
                </div>
              </div>

              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Instructor
              </div>

              <h3 className="mt-5 max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                Review clearance responsibilities,
                <span className="block text-blue-200">
                  wherever you are.
                </span>
              </h3>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-50/80 sm:text-base">
                Stay organized, track clearance progress, and help students
                complete their academic requirements efficiently.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={CLEARANCE_ROUTE}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-950 transition hover:bg-blue-50"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Manage Clearances
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white">
                  <GraduationCap className="h-4 w-4" />
                  {profile?.position || 'Instructor'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100/80">
                  Workload Completion
                </p>
                <Sparkles className="h-5 w-5 text-blue-200" />
              </div>

              <div className="mt-6 flex items-center gap-5">
                <div
                  className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#93c5fd ${stats.progress}%, rgba(255,255,255,0.15) ${stats.progress}%)`,
                  }}
                >
                  <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#172c66]">
                    <span className="text-2xl font-bold">
                      {fetchingRequests
                        ? '...'
                        : `${stats.progress}%`}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-base font-bold">
                    Overall Progress
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-100/75">
                    {fetchingRequests
                      ? 'Loading assigned subjects...'
                      : `${stats.completedSubjects} of ${stats.totalSubjects} subject assignments completed`}
                  </p>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-blue-300 transition-all duration-500"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
                <div>
                  <p className="text-xs text-blue-100/70">
                    Completed
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {stats.completedSubjects}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-blue-100/70">
                    Remaining
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {stats.pendingSubjects}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* DATA ERROR */}

        {dataError && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Dashboard data could not be updated
              </p>
              <p className="mt-1 text-xs text-red-700">
                {dataError}
              </p>
            </div>
          </div>
        )}

        {/* STATISTICS */}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[
            {
              label: 'Assigned Students',
              value: stats.uniqueStudents,
              description: 'Students in your workload',
              icon: Users,
              color: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Pending Reviews',
              value: stats.pendingRequests,
              description: 'Requests needing attention',
              icon: Clock3,
              color: 'bg-amber-50 text-amber-700',
            },
            {
              label: 'Completed Requests',
              value: stats.completedRequests,
              description: 'Your assigned subjects done',
              icon: CheckCircle2,
              color: 'bg-emerald-50 text-emerald-700',
            },
            {
              label: 'Signed Subjects',
              value: stats.signedSubjects,
              description: 'Subjects with signatures',
              icon: PenTool,
              color: 'bg-violet-50 text-violet-700',
            },
          ].map((stat) => {
            const Icon = stat.icon

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <ArrowUpRight className="h-4 w-4 text-slate-300" />
                </div>

                <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                  {fetchingRequests ? '—' : stat.value}
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {stat.label}
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {stat.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* MAIN CONTENT */}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">

          {/* LEFT COLUMN */}

          <div className="min-w-0 space-y-6 xl:col-span-2">

            {/* PRIORITY QUEUE */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Needs Your Attention
                    </h2>

                    {stats.pendingRequests > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        {stats.pendingRequests}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Prioritized clearance requests awaiting your review
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                  <ListTodo className="h-5 w-5 text-amber-700" />
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {fetchingRequests ? (
                  <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
                    Loading requests...
                  </div>
                ) : pendingQueue.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                      <CheckCircle2 className="h-8 w-8 text-emerald-700" />
                    </div>

                    <h3 className="mt-4 text-base font-bold text-slate-900">
                      You&apos;re all caught up!
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                      There are currently no incomplete assigned clearance requests.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingQueue.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-emerald-800 shadow-sm">
                            {request.studentName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {request.studentName}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {request.yearAndSection ||
                                'Year & section unavailable'}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                                {request.pendingSubjects} pending
                              </span>

                              <span className="text-[11px] text-slate-400">
                                {request.assignedSubjects.length} assigned subjects
                              </span>
                            </div>
                          </div>
                        </div>

                        <Link
                          href={getClearanceHref(request.id)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                        >
                          Review
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}

                    <Link
                      href={CLEARANCE_ROUTE}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-emerald-800 transition hover:bg-slate-50"
                    >
                      View All Clearance Requests
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* RECENT REQUESTS */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Recent Clearance Requests
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Latest assigned student clearance records
                  </p>
                </div>

                <Link
                  href={CLEARANCE_ROUTE}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-600"
                >
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {fetchingRequests ? (
                <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
                  <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
                  Loading clearance records...
                </div>
              ) : requests.length === 0 ? (
                <div className="py-14 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No clearance requests yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Assigned student requests will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-4">Student</th>
                        <th className="px-4 py-4">Assigned Subjects</th>
                        <th className="px-4 py-4">Progress</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {requests.slice(0, 6).map((request) => (
                        <tr
                          key={request.id}
                          className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {request.studentName}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {request.yearAndSection || '—'}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {request.assignedSubjects.length}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-600"
                                  style={{
                                    width: `${request.progress}%`,
                                  }}
                                />
                              </div>

                              <span className="text-xs font-bold text-slate-700">
                                {request.progress}%
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                request.pendingSubjects === 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {request.pendingSubjects === 0
                                ? 'Completed'
                                : 'Needs Review'}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <Link
                              href={getClearanceHref(request.id)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-600"
                            >
                              Open
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SUBJECT WORKLOAD BREAKDOWN */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-emerald-700" />
                    <h2 className="text-base font-bold text-slate-900">
                      Subject Workload Breakdown
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Select a subject to view its assigned clearance requests
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {subjectBreakdown.length} Subject Groups
                </span>
              </div>

              {fetchingRequests ? (
                <div className="flex items-center justify-center gap-3 py-14 text-sm text-slate-500">
                  <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
                  Loading subject workload...
                </div>
              ) : subjectBreakdown.length === 0 ? (
                <div className="py-14 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No assigned subjects found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Your subject workload will appear once students assign you.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {subjectBreakdown.map((subject) => {
                    const progress =
                      subject.total > 0
                        ? Math.round(
                            (subject.completed / subject.total) *
                              100
                          )
                        : 0

                    const pending =
                      subject.total - subject.completed

                    const href = getClearanceHref(
                      subject.requestIds.length === 1
                        ? subject.requestIds[0]
                        : undefined,
                      subject.code
                    )

                    return (
                      <Link
                        key={subject.key}
                        href={href}
                        aria-label={`View clearances for ${subject.code}`}
                        className="group relative block rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-lg hover:shadow-emerald-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
                            <BookOpen className="h-5 w-5" />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                              {progress}%
                            </span>

                            <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-700" />
                          </div>
                        </div>

                        <h3 className="mt-4 text-sm font-bold text-slate-900 transition group-hover:text-emerald-800">
                          {subject.code}
                        </h3>

                        <p className="mt-1 min-h-8 text-xs leading-relaxed text-slate-500">
                          {subject.description ||
                            'Assigned academic subject'}
                        </p>

                        <div className="mt-5 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-500">
                            Completed Reviews
                          </span>

                          <span className="font-bold text-slate-800">
                            {subject.completed}/{subject.total}
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            {subject.total} student assignments
                          </span>

                          <span
                            className={`font-semibold ${
                              pending === 0
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {pending === 0
                              ? 'All completed'
                              : `${pending} pending`}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs font-semibold text-emerald-800">
                          <span>View Subject Clearances</span>
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN */}

          <div className="min-w-0 space-y-6">

            {/* INSTRUCTOR PROFILE */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Instructor Profile
                  </h2>

                  <UserRound className="h-5 w-5 text-slate-400" />
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Your academic account information
                </p>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-lg font-bold text-emerald-800">
                    {photoURL && !imageError ? (
                      <img
                        src={photoURL}
                        alt={displayName}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      firstName.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {displayName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {profile?.position || 'Instructor'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Email Address
                    </p>
                    <p className="mt-1 break-all text-xs font-medium text-slate-700">
                      {email}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Department
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {profile?.department || 'Not specified'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Account Role
                    </p>

                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Instructor
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* WORKLOAD SUMMARY */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Workload Summary
                  </h2>

                  <BarChart3 className="h-5 w-5 text-emerald-700" />
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Your subject review performance
                </p>
              </div>

              <div className="space-y-5 p-5">
                {[
                  {
                    label: 'Graded Subjects',
                    value: stats.gradedSubjects,
                    total: stats.totalSubjects,
                    color: 'bg-blue-600',
                  },
                  {
                    label: 'Signed Subjects',
                    value: stats.signedSubjects,
                    total: stats.totalSubjects,
                    color: 'bg-violet-600',
                  },
                  {
                    label: 'Fully Completed',
                    value: stats.completedSubjects,
                    total: stats.totalSubjects,
                    color: 'bg-emerald-600',
                  },
                ].map((item) => {
                  const percent =
                    item.total > 0
                      ? Math.round(
                          (item.value / item.total) * 100
                        )
                      : 0

                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">
                          {item.label}
                        </p>

                        <p className="text-xs font-bold text-slate-900">
                          {item.value}/{item.total}
                        </p>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}

                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        Completion Tracking
                      </p>

                      <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
                        A subject counts as completed when its grade,
                        remarks, and instructor signature are all provided.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Quick Actions
                  </h2>

                  <Zap className="h-5 w-5 text-amber-500" />
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Frequently used instructor tools
                </p>
              </div>

              <div className="space-y-2 p-4">
                {[
                  {
                    label: 'Manage Clearances',
                    description: 'Review student submissions',
                    href: CLEARANCE_ROUTE,
                    icon: ClipboardCheck,
                    color: 'bg-emerald-50 text-emerald-700',
                  },
                  {
                    label: 'Review Grades',
                    description: 'Check assigned subject grades',
                    href: CLEARANCE_ROUTE,
                    icon: GraduationCap,
                    color: 'bg-blue-50 text-blue-700',
                  },
                  {
                    label: 'Check Signatures',
                    description: 'Verify clearance signatures',
                    href: CLEARANCE_ROUTE,
                    icon: PenTool,
                    color: 'bg-violet-50 text-violet-700',
                  },
                ].map((action) => {
                  const Icon = action.icon

                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group flex items-center gap-3 rounded-xl p-3 transition hover:bg-slate-50"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">
                          {action.label}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400">
                          {action.description}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
                    </Link>
                  )
                })}
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER */}

        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 py-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-800">
                GradeSync Instructor Portal
              </p>

              <p className="text-[11px] text-slate-400">
                Academic clearance management workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Instructor access verified
          </div>
        </div>

      </div>
    </div>
  )
}
