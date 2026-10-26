
'use client'

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react'
import Link from 'next/link'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'
import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react'

type IconType = ComponentType<{
  size?: number
  className?: string
  strokeWidth?: number
}>

type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'unknown'

type UserRole =
  | 'student'
  | 'instructor'
  | 'admin'
  | 'other'

type TimeFilter = '7d' | '30d' | '90d' | 'all'

interface UserRecord {
  id: string
  name: string
  email: string
  photoURL: string
  role: UserRole
  createdAt: Date | null
  verificationStatus: string
}

interface ApplicationRecord {
  id: string
  name: string
  email: string
  userId: string
  status: ApplicationStatus
  submittedAt: Date | null
  reviewedAt: Date | null
  source: string
}

interface ActivityRecord {
  id: string
  title: string
  description: string
  date: Date | null
  type: 'user' | 'application'
  status?: ApplicationStatus
  href: string
}

const APPLICATION_COLLECTION = 'applications'

const TIME_FILTERS: {
  label: string
  value: TimeFilter
}[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
]

function text(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function dateFrom(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    try {
      const date = (value as Timestamp).toDate()
      return Number.isNaN(date.getTime()) ? null : date
    } catch {
      return null
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function formatDate(date: Date | null): string {
  if (!date) return 'Date unavailable'

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatTime(date: Date | null): string {
  if (!date) return 'Unknown time'

  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-PH').format(value)
}

function getRole(value: unknown): UserRole {
  const role = text(value).toLowerCase()

  if (role === 'student') return 'student'
  if (role === 'instructor') return 'instructor'
  if (role === 'admin') return 'admin'

  return 'other'
}

function getApplicationStatus(
  value: unknown
): ApplicationStatus {
  const status = text(value).toLowerCase()

  if (
    [
      'pending',
      'submitted',
      'under_review',
      'under review',
    ].includes(status)
  ) {
    return 'pending'
  }

  if (
    ['approved', 'accepted', 'verified'].includes(status)
  ) {
    return 'approved'
  }

  if (
    ['rejected', 'declined', 'denied'].includes(status)
  ) {
    return 'rejected'
  }

  return 'unknown'
}

function normalizeUser(
  id: string,
  data: DocumentData
): UserRecord {
  return {
    id,
    name:
      text(data.fullName) ||
      text(data.displayName) ||
      text(data.name) ||
      'Unnamed User',
    email:
      text(data.email) ||
      text(data.studentEmail) ||
      '',
    photoURL: text(data.photoURL),
    role: getRole(data.role),
    createdAt: dateFrom(data.createdAt),
    verificationStatus: text(data.verificationStatus),
  }
}

function normalizeApplication(
  id: string,
  data: DocumentData
): ApplicationRecord {
  return {
    id,
    name:
      text(data.fullName) ||
      text(data.accountDisplayName) ||
      text(data.displayName) ||
      text(data.name) ||
      text(data.applicantName) ||
      'Unnamed Applicant',
    email:
      text(data.email) ||
      text(data.accountEmail) ||
      text(data.applicantEmail) ||
      '',
    userId:
      text(data.userId) ||
      text(data.uid) ||
      text(data.applicantUid) ||
      id,
    status: getApplicationStatus(
      data.status || data.verificationStatus
    ),
    submittedAt:
      dateFrom(data.submittedAt) ||
      dateFrom(data.createdAt) ||
      dateFrom(data.appliedAt),
    reviewedAt: dateFrom(data.reviewedAt),
    source: APPLICATION_COLLECTION,
  }
}

function matchesTimeFilter(
  date: Date | null,
  filter: TimeFilter,
  now: number
): boolean {
  if (filter === 'all') return true
  if (!date) return false

  const days =
    filter === '7d'
      ? 7
      : filter === '30d'
        ? 30
        : 90

  const difference = now - date.getTime()

  return (
    difference >= 0 &&
    difference <= days * 24 * 60 * 60 * 1000
  )
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'student':
      return 'Student'
    case 'instructor':
      return 'Instructor'
    case 'admin':
      return 'Administrator'
    default:
      return 'Unassigned'
  }
}

function RoleBadge({ role }: { role: UserRole }) {
  const classes: Record<UserRole, string> = {
    student:
      'bg-sky-50 text-sky-700 border-sky-100',
    instructor:
      'bg-violet-50 text-violet-700 border-violet-100',
    admin:
      'bg-blue-50 text-blue-800 border-blue-100',
    other:
      'bg-slate-50 text-slate-600 border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold ${classes[role]}`}
    >
      {roleLabel(role)}
    </span>
  )
}

function StatusBadge({
  status,
}: {
  status: ApplicationStatus
}) {
  const config: Record<
    ApplicationStatus,
    { label: string; className: string }
  > = {
    pending: {
      label: 'Pending',
      className:
        'bg-amber-50 text-amber-700 border-amber-200',
    },
    approved: {
      label: 'Approved',
      className:
        'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    rejected: {
      label: 'Rejected',
      className:
        'bg-red-50 text-red-700 border-red-200',
    },
    unknown: {
      label: 'Unknown',
      className:
        'bg-slate-50 text-slate-600 border-slate-200',
    },
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold ${config[status].className}`}
    >
      {config[status].label}
    </span>
  )
}

function InitialAvatar({
  name,
  photoURL,
  size = 'md',
}: {
  name: string
  photoURL?: string
  size?: 'sm' | 'md'
}) {
  const [imageFailed, setImageFailed] = useState(false)

  const sizeClass =
    size === 'sm'
      ? 'h-9 w-9 text-xs'
      : 'h-10 w-10 text-sm'

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D5E8F8] bg-gradient-to-br from-[#E9F6FF] to-[#D1E9FB] font-bold text-[#347CB4] ${sizeClass}`}
    >
      {photoURL && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoURL}
          alt={name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase() || 'U'
      )}
    </div>
  )
}

function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-bold tracking-tight text-[#173A5C] sm:text-[17px]">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2378BA] transition hover:text-[#15568D]"
        >
          {linkLabel || 'View all'}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  href,
  accent,
  loading,
}: {
  title: string
  value: number
  icon: IconType
  description: string
  href: string
  accent: 'blue' | 'violet' | 'amber' | 'cyan'
  loading: boolean
}) {
  const themes = {
    blue: {
      icon: 'bg-[#E7F3FF] text-[#287EC2]',
      line: 'bg-[#398FD1]',
    },
    violet: {
      icon: 'bg-violet-50 text-violet-600',
      line: 'bg-violet-500',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-600',
      line: 'bg-amber-500',
    },
    cyan: {
      icon: 'bg-cyan-50 text-cyan-700',
      line: 'bg-cyan-500',
    },
  }

  const theme = themes[accent]

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-[#DFEAF4] bg-white p-5 shadow-[0_3px_14px_rgba(36,93,145,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B6D8F1] hover:shadow-[0_10px_25px_rgba(36,93,145,0.09)]"
    >
      <div
        className={`absolute left-0 top-0 h-1 w-full ${theme.line}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.icon}`}
        >
          <Icon size={21} strokeWidth={1.9} />
        </div>

        <ArrowUpRight
          size={17}
          className="text-slate-300 transition group-hover:text-[#3187C8]"
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-slate-500">
          {title}
        </p>

        {loading ? (
          <div className="mt-2 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <p className="mt-1.5 text-[30px] font-extrabold tracking-[-0.055em] text-[#173A5C]">
            {formatNumber(value)}
          </p>
        )}

        <p className="mt-2 text-[11px] text-slate-400">
          {description}
        </p>
      </div>
    </Link>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: IconType
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDF7FF] text-[#4A94C9]">
        <Icon size={22} />
      </div>

      <p className="text-sm font-semibold text-[#234969]">
        {title}
      </p>

      <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseUser | null>(null)

  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authorizationError, setAuthorizationError] = useState('')

  const [users, setUsers] = useState<UserRecord[]>([])
  const [applications, setApplications] =
    useState<ApplicationRecord[]>([])

  const [usersLoading, setUsersLoading] = useState(true)
  const [applicationsLoading, setApplicationsLoading] =
    useState(true)

  const [usersError, setUsersError] = useState('')
  const [applicationsError, setApplicationsError] =
    useState('')

  const [timeFilter, setTimeFilter] =
    useState<TimeFilter>('30d')

  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)
  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null)

  const [now, setNow] = useState(() => Date.now())

  // Verify administrator account
  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) return

        setFirebaseUser(currentUser)
        setAuthLoading(true)
        setIsAuthorized(false)
        setAuthorizationError('')

        if (!currentUser) {
          setAuthorizationError(
            'Please sign in with an administrator account.'
          )
          setAuthLoading(false)
          return
        }

        try {
          const profileSnapshot = await getDoc(
            doc(db, 'users', currentUser.uid)
          )

          if (!active) return

          const role = profileSnapshot.exists()
            ? getRole(profileSnapshot.data().role)
            : 'other'

          if (role !== 'admin') {
            setAuthorizationError(
              'Access denied. Only GradeSync administrators can view the administrative dashboard.'
            )
            setIsAuthorized(false)
          } else {
            setIsAuthorized(true)
            setAuthorizationError('')
          }
        } catch (error) {
          console.error(
            '[GradeSync Admin] Authorization error:',
            error
          )

          if (active) {
            setAuthorizationError(
              'Unable to verify administrator access. Check your Firestore permissions.'
            )
          }
        } finally {
          if (active) setAuthLoading(false)
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Real-time registered users
  useEffect(() => {
    if (!isAuthorized || !firebaseUser) return

    let active = true

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        if (!active) return

        setUsers(
          snapshot.docs.map((item) =>
            normalizeUser(item.id, item.data())
          )
        )

        setUsersError('')
        setUsersLoading(false)
        setLastUpdated(new Date())
      },
      (error) => {
        console.error(
          '[GradeSync Admin] Users listener error:',
          error
        )

        if (!active) return

        setUsersError(
          error.code === 'permission-denied'
            ? 'Firestore permission denied. Administrator accounts need permission to list the users collection.'
            : 'Unable to load user statistics. Please check your connection.'
        )

        setUsersLoading(false)
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [isAuthorized, firebaseUser, refreshKey])

  // Real-time instructor applications
  useEffect(() => {
    if (!isAuthorized || !firebaseUser) return

    let active = true

    const unsubscribe = onSnapshot(
      collection(db, APPLICATION_COLLECTION),
      (snapshot) => {
        if (!active) return

        const records = snapshot.docs.map((item) =>
          normalizeApplication(item.id, item.data())
        )

        setApplications(records)
        setApplicationsLoading(false)
        setApplicationsError('')
        setLastUpdated(new Date())
      },
      (error) => {
        console.error(
          '[GradeSync Admin] Applications listener error:',
          error
        )

        if (!active) return

        setApplicationsError(
          error.code === 'permission-denied'
            ? 'Firestore permission denied. Administrators need permission to list the applications collection.'
            : 'Unable to load instructor applications. Please check your connection.'
        )

        setApplicationsLoading(false)
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [isAuthorized, firebaseUser, refreshKey])

  // System statistics
  const stats = useMemo(() => {
    const students = users.filter(
      (user) => user.role === 'student'
    ).length

    const instructors = users.filter(
      (user) => user.role === 'instructor'
    ).length

    const admins = users.filter(
      (user) => user.role === 'admin'
    ).length

    const pending = applications.filter(
      (item) => item.status === 'pending'
    ).length

    const approved = applications.filter(
      (item) => item.status === 'approved'
    ).length

    const rejected = applications.filter(
      (item) => item.status === 'rejected'
    ).length

    const unknown = applications.filter(
      (item) => item.status === 'unknown'
    ).length

    return {
      totalUsers: users.length,
      students,
      instructors,
      admins,
      otherUsers:
        users.length - students - instructors - admins,
      totalApplications: applications.length,
      pending,
      approved,
      rejected,
      unknown,
    }
  }, [users, applications])

  // Time-filtered user registrations
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        matchesTimeFilter(user.createdAt, timeFilter, now)
      ),
    [users, timeFilter, now]
  )

  // Time-filtered application submissions
  const filteredApplications = useMemo(
    () =>
      applications.filter((application) =>
        matchesTimeFilter(
          application.submittedAt,
          timeFilter,
          now
        )
      ),
    [applications, timeFilter, now]
  )

  const filteredDecisions = useMemo(
    () =>
      applications.filter(
        (application) =>
          (application.status === 'approved' ||
            application.status === 'rejected') &&
          matchesTimeFilter(
            application.reviewedAt,
            timeFilter,
            now
          )
      ),
    [applications, timeFilter, now]
  )

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort(
          (a, b) =>
            (b.createdAt?.getTime() || 0) -
            (a.createdAt?.getTime() || 0)
        )
        .slice(0, 6),
    [users]
  )

  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort(
          (a, b) =>
            (b.submittedAt?.getTime() || 0) -
            (a.submittedAt?.getTime() || 0)
        )
        .slice(0, 5),
    [applications]
  )

  // Recent platform activity
  const activities = useMemo<ActivityRecord[]>(() => {
    const userActivities: ActivityRecord[] = users.map(
      (user) => ({
        id: `user-${user.id}`,
        title: 'User account created',
        description: `${user.name} joined as ${roleLabel(user.role).toLowerCase()}`,
        date: user.createdAt,
        type: 'user',
        href: '/admin/users',
      })
    )

    const applicationActivities: ActivityRecord[] =
      applications.map((application) => ({
        id: `application-${application.id}`,
        title: 'Instructor application submitted',
        description: `${application.name} submitted an instructor access request`,
        date: application.submittedAt,
        type: 'application',
        status: application.status,
        href: '/admin/applications',
      }))

    const reviewActivities: ActivityRecord[] =
      applications
        .filter(
          (application) =>
            application.reviewedAt &&
            (application.status === 'approved' ||
              application.status === 'rejected')
        )
        .map((application) => ({
          id: `review-${application.id}`,
          title:
            application.status === 'approved'
              ? 'Application approved'
              : 'Application rejected',
          description: `${application.name}'s instructor application was ${application.status}`,
          date: application.reviewedAt,
          type: 'application',
          status: application.status,
          href: '/admin/applications',
        }))

    return [
      ...userActivities,
      ...applicationActivities,
      ...reviewActivities,
    ]
      .sort(
        (a, b) =>
          (b.date?.getTime() || 0) -
          (a.date?.getTime() || 0)
      )
      .slice(0, 6)
  }, [users, applications])

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) return []

    return users
      .filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          user.role.includes(term)
      )
      .slice(0, 5)
  }, [users, searchTerm])

  const totalRoleCount =
    stats.students +
    stats.instructors +
    stats.admins +
    stats.otherUsers

  const roleSegments = [
    {
      label: 'Students',
      value: stats.students,
      color: '#55A9E9',
    },
    {
      label: 'Instructors',
      value: stats.instructors,
      color: '#8B7DE3',
    },
    {
      label: 'Administrators',
      value: stats.admins,
      color: '#286FB3',
    },
    {
      label: 'Other',
      value: stats.otherUsers,
      color: '#CBD5E1',
    },
  ]

  let cumulativePercentage = 0

  const donutGradient =
    totalRoleCount === 0
      ? 'conic-gradient(#E7EFF7 0% 100%)'
      : `conic-gradient(${roleSegments
          .filter((segment) => segment.value > 0)
          .map((segment) => {
            const start = cumulativePercentage
            const percentage =
              (segment.value / totalRoleCount) * 100

            cumulativePercentage += percentage

            return `${segment.color} ${start}% ${cumulativePercentage}%`
          })
          .join(', ')})`

  const approvalRate =
    stats.approved + stats.rejected > 0
      ? Math.round(
          (stats.approved /
            (stats.approved + stats.rejected)) *
            100
        )
      : 0

  const displayName =
    firebaseUser?.displayName?.split(' ')[0] ||
    'Administrator'

  const isLoading =
    usersLoading || applicationsLoading

  const handleRefresh = () => {
    setNow(Date.now())
    setUsersLoading(true)
    setApplicationsLoading(true)
    setUsersError('')
    setApplicationsError('')
    setRefreshKey((previous) => previous + 1)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F9FD]">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            size={30}
            className="animate-spin text-[#3189C9]"
          />

          <p className="text-xs text-slate-500">
            Verifying administrator access...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F9FD] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#DFEAF4] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldCheck size={28} />
          </div>

          <h1 className="text-xl font-extrabold text-[#173B5E]">
            Administrator Access Required
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {authorizationError ||
              'Only authorized GradeSync administrators can access this dashboard.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F9FD] font-sans text-slate-800">
      <div className="mx-auto max-w-[1600px] px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8">

        {/* Header */}
        <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[#7A9BB6]">
              <LayoutDashboard size={14} />
              <span>Administration</span>
              <ChevronRight size={13} />
              <span className="text-[#2B77B5]">
                Command Center
              </span>
            </div>

            <h1 className="text-[26px] font-extrabold tracking-[-0.045em] text-[#173A5C] sm:text-[30px]">
              Command Center
            </h1>

            <p className="mt-1.5 text-[13px] text-slate-500">
              Welcome back, {displayName}. Here&apos;s your
              GradeSync system overview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-[#DCEAF6] bg-white px-3.5 py-2.5 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>

              <span className="text-[11px] font-semibold text-slate-600">
                Live data
              </span>
            </div>

            <div className="relative">
              <select
                value={timeFilter}
                onChange={(event) =>
                  setTimeFilter(
                    event.target.value as TimeFilter
                  )
                }
                aria-label="Select reporting period"
                className="appearance-none rounded-xl border border-[#DCEAF6] bg-white py-2.5 pl-3.5 pr-9 text-[12px] font-semibold text-slate-600 shadow-sm outline-none transition focus:border-[#7DBBE9]"
              >
                {TIME_FILTERS.map((filter) => (
                  <option
                    key={filter.value}
                    value={filter.value}
                  >
                    {filter.label}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh dashboard data"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCEAF6] bg-white text-[#4A83AE] shadow-sm transition hover:bg-[#EDF7FF]"
            >
              <RefreshCw
                size={17}
                className={isLoading ? 'animate-spin' : ''}
              />
            </button>
          </div>
        </div>

        {/* Welcome Banner */}
        <div className="relative mb-7 overflow-hidden rounded-[22px] bg-gradient-to-r from-[#1768AD] via-[#318CD0] to-[#75BDEE] px-6 py-7 text-white shadow-[0_10px_30px_rgba(42,122,190,0.15)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -right-4 -top-12 h-56 w-56 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -bottom-28 right-28 h-52 w-52 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                <ShieldCheck size={13} />
                Administrator Workspace
              </div>

              <h2 className="text-[22px] font-bold tracking-tight sm:text-[26px]">
                Your entire system. One place.
              </h2>

              <p className="mt-2 max-w-lg text-[13px] leading-6 text-blue-50/90">
                Monitor accounts, review instructor applications,
                and manage GradeSync operations from one
                centralized dashboard.
              </p>
            </div>

            <Link
              href="/admin/applications"
              className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[12px] font-bold text-[#226FAE] shadow-sm transition hover:bg-[#EFF8FF]"
            >
              Review Applications
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Data Errors */}
        {(usersError || applicationsError) && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={19}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Some dashboard information is unavailable
                </p>

                {usersError && (
                  <p className="mt-1 text-xs text-amber-800">
                    {usersError}
                  </p>
                )}

                {applicationsError && (
                  <p className="mt-1 text-xs text-amber-800">
                    {applicationsError}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Statistics */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={UsersRound}
            description="All registered accounts"
            href="/admin/users"
            accent="blue"
            loading={usersLoading}
          />

          <StatCard
            title="Students"
            value={stats.students}
            icon={GraduationCap}
            description="Registered student accounts"
            href="/admin/users"
            accent="cyan"
            loading={usersLoading}
          />

          <StatCard
            title="Instructors"
            value={stats.instructors}
            icon={UserCheck}
            description="Registered instructor accounts"
            href="/admin/users"
            accent="violet"
            loading={usersLoading}
          />

          <StatCard
            title="Pending Applications"
            value={stats.pending}
            icon={Clock3}
            description="Awaiting administrator review"
            href="/admin/applications"
            accent="amber"
            loading={applicationsLoading}
          />
        </div>

        {/* Quick Access + Operations */}
        <div className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-3">

          {/* Quick actions */}
          <div className="rounded-2xl border border-[#DFEAF4] bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
            <SectionHeading
              title="Quick Access"
              subtitle="Jump directly into administrative operations"
            />

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Manage Users',
                  description: 'View registered accounts',
                  href: '/admin/users',
                  icon: UsersRound,
                  iconClass:
                    'bg-[#E9F5FF] text-[#2D83C5]',
                },
                {
                  title: 'Applications',
                  description: 'Review instructor requests',
                  href: '/admin/applications',
                  icon: FileCheck2,
                  iconClass:
                    'bg-amber-50 text-amber-600',
                },
                {
                  title: 'System Overview',
                  description: 'View platform statistics',
                  href: '/admin/dashboard',
                  icon: BarChart3,
                  iconClass:
                    'bg-violet-50 text-violet-600',
                },
              ].map((action) => {
                const Icon = action.icon

                return (
                  <Link
                    key={action.href + action.title}
                    href={action.href}
                    className="group rounded-xl border border-[#E5EEF6] bg-[#FAFCFF] p-4 transition hover:border-[#B9D9F0] hover:bg-[#F1F8FE]"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.iconClass}`}
                      >
                        <Icon size={19} />
                      </div>

                      <ArrowUpRight
                        size={15}
                        className="text-slate-300 transition group-hover:text-[#3588C6]"
                      />
                    </div>

                    <p className="mt-4 text-[13px] font-bold text-[#254C6C]">
                      {action.title}
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      {action.description}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Operational status */}
          <div className="rounded-2xl border border-[#DFEAF4] bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading
              title="Operations Summary"
              subtitle="Current application workload"
              href="/admin/applications"
            />

            <div className="mt-5 space-y-4">
              {[
                {
                  label: 'Pending Review',
                  value: stats.pending,
                  color: 'bg-amber-500',
                  text: 'text-amber-700',
                },
                {
                  label: 'Approved',
                  value: stats.approved,
                  color: 'bg-emerald-500',
                  text: 'text-emerald-700',
                },
                {
                  label: 'Rejected',
                  value: stats.rejected,
                  color: 'bg-red-400',
                  text: 'text-red-600',
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href="/admin/applications"
                  className="flex items-center justify-between gap-3 rounded-lg py-1 transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${item.color}`}
                    />

                    <span className="text-[12px] font-medium text-slate-600">
                      {item.label}
                    </span>
                  </div>

                  <span
                    className={`text-[14px] font-bold ${item.text}`}
                  >
                    {applicationsLoading
                      ? '—'
                      : formatNumber(item.value)}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Decision approval rate
                </span>

                <span className="text-[13px] font-bold text-[#2D79B5]">
                  {approvalRate}%
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EAF2F8]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#62B4EB] to-[#2A82C5] transition-all duration-500"
                  style={{
                    width: `${approvalRate}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-[10px] text-slate-400">
                Based on approved and rejected decisions.
              </p>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-5">

          {/* Role distribution */}
          <div className="rounded-2xl border border-[#DFEAF4] bg-white p-5 shadow-sm sm:p-6 xl:col-span-3">
            <SectionHeading
              title="User Distribution"
              subtitle="Account composition across GradeSync"
              href="/admin/users"
              linkLabel="Manage users"
            />

            <div className="mt-7 flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
              <Link
                href="/admin/users"
                className="group relative flex h-[190px] w-[190px] shrink-0 items-center justify-center rounded-full transition hover:scale-[1.025]"
                style={{
                  background: donutGradient,
                }}
                title="View all users"
              >
                <div className="flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full bg-white">
                  <p className="text-[32px] font-extrabold tracking-tight text-[#173A5C]">
                    {formatNumber(stats.totalUsers)}
                  </p>

                  <p className="text-[11px] font-medium text-slate-400">
                    Total Users
                  </p>
                </div>
              </Link>

              <div className="w-full flex-1 space-y-4">
                {roleSegments.map((segment) => {
                  const percentage =
                    totalRoleCount > 0
                      ? Math.round(
                          (segment.value / totalRoleCount) *
                            100
                        )
                      : 0

                  return (
                    <Link
                      key={segment.label}
                      href="/admin/users"
                      className="group flex items-center justify-between gap-3 rounded-lg px-1 py-1 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-[4px]"
                          style={{
                            backgroundColor: segment.color,
                          }}
                        />

                        <span className="text-[12px] font-medium text-slate-600 group-hover:text-[#226FAE]">
                          {segment.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-[12px] font-bold text-[#254C6C]">
                          {formatNumber(segment.value)}
                        </span>

                        <span className="w-10 text-right text-[11px] text-slate-400">
                          {percentage}%
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Activity snapshot */}
          <div className="rounded-2xl border border-[#DFEAF4] bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
            <SectionHeading
              title="Activity Snapshot"
              subtitle="New records during the selected period"
            />

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/admin/users"
                className="rounded-xl border border-[#E4EEF7] bg-[#F5FAFF] p-4 transition hover:border-[#ADD5F2]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E4F2FF] text-[#3188C9]">
                  <Users size={18} />
                </div>

                <p className="mt-4 text-[26px] font-extrabold text-[#173A5C]">
                  {formatNumber(filteredUsers.length)}
                </p>

                <p className="mt-1 text-[11px] text-slate-500">
                  New Users
                </p>
              </Link>

              <Link
                href="/admin/applications"
                className="rounded-xl border border-[#E4EEF7] bg-[#F5FAFF] p-4 transition hover:border-[#ADD5F2]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E4F2FF] text-[#3188C9]">
                  <FileCheck2 size={18} />
                </div>

                <p className="mt-4 text-[26px] font-extrabold text-[#173A5C]">
                  {formatNumber(filteredApplications.length)}
                </p>

                <p className="mt-1 text-[11px] text-slate-500">
                  Applications
                </p>
              </Link>
            </div>

            <div className="mt-5 rounded-xl border border-[#E4EEF7] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCheck size={20} />
                </div>

                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-[#254C6C]">
                    Application Decisions
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    Approved and rejected requests
                  </p>
                </div>

                <span className="text-xl font-extrabold text-[#173A5C]">
                  {formatNumber(filteredDecisions.length)}
                </span>
              </div>
            </div>

            <p className="mt-4 text-[11px] leading-5 text-slate-400">
              Activity counts use creation, submission, and review
              timestamps available in Firestore.
            </p>
          </div>
        </div>

        {/* Applications + Recent Activity */}
        <div className="mb-7 grid grid-cols-1 gap-5 xl:grid-cols-5">

          {/* Applications */}
          <div className="overflow-hidden rounded-2xl border border-[#DFEAF4] bg-white shadow-sm xl:col-span-3">
            <div className="border-b border-[#EDF2F7] p-5 sm:px-6">
              <SectionHeading
                title="Recent Applications"
                subtitle="Latest instructor verification requests"
                href="/admin/applications"
                linkLabel="View applications"
              />
            </div>

            {applicationsLoading ? (
              <div className="flex min-h-[230px] items-center justify-center">
                <Loader2
                  size={23}
                  className="animate-spin text-[#368CCB]"
                />
              </div>
            ) : recentApplications.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title="No applications found"
                description="Instructor applications submitted by students will appear here automatically."
              />
            ) : (
              <div className="divide-y divide-[#F0F4F8]">
                {recentApplications.map((application) => (
                  <Link
                    key={application.id}
                    href="/admin/applications"
                    className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#F7FBFF] sm:px-6"
                  >
                    <InitialAvatar
                      name={application.name}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#254C6C]">
                        {application.name}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {application.email ||
                          formatDate(application.submittedAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge
                        status={application.status}
                      />

                      <ChevronRight
                        size={15}
                        className="hidden text-slate-300 transition group-hover:text-[#368CCB] sm:block"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="overflow-hidden rounded-2xl border border-[#DFEAF4] bg-white shadow-sm xl:col-span-2">
            <div className="border-b border-[#EDF2F7] p-5 sm:px-6">
              <SectionHeading
                title="Recent Activity"
                subtitle="Latest recorded platform events"
              />
            </div>

            {isLoading ? (
              <div className="flex min-h-[230px] items-center justify-center">
                <Loader2
                  size={23}
                  className="animate-spin text-[#368CCB]"
                />
              </div>
            ) : activities.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Account registrations and applications will appear here."
              />
            ) : (
              <div className="px-5 py-4 sm:px-6">
                <div className="space-y-0">
                  {activities.map((activity, index) => {
                    const isApplication =
                      activity.type === 'application'

                    return (
                      <Link
                        key={activity.id}
                        href={activity.href}
                        className="group relative flex gap-3 pb-5 last:pb-0"
                      >
                        {index !== activities.length - 1 && (
                          <span className="absolute bottom-0 left-[17px] top-9 w-px bg-[#E5EDF5]" />
                        )}

                        <div
                          className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            isApplication
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-[#EAF5FF] text-[#3188C9]'
                          }`}
                        >
                          {isApplication ? (
                            <FileCheck2 size={16} />
                          ) : (
                            <UserRound size={16} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[12px] font-semibold text-[#254C6C] group-hover:text-[#287EBE]">
                            {activity.title}
                          </p>

                          <p className="mt-1 truncate text-[11px] text-slate-500">
                            {activity.description}
                          </p>

                          <p className="mt-1.5 text-[10px] text-slate-400">
                            {formatDate(activity.date)}
                            {activity.date &&
                              ` · ${formatTime(activity.date)}`}
                          </p>
                        </div>

                        <ChevronRight
                          size={14}
                          className="mt-2 shrink-0 text-slate-300 group-hover:text-[#3188C9]"
                        />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent users */}
        <div className="overflow-hidden rounded-2xl border border-[#DFEAF4] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#EDF2F7] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <SectionHeading
              title="Recently Registered Users"
              subtitle="Latest accounts added to GradeSync"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowSearch((previous) => !previous)
                }
                aria-label="Search users"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0EAF3] text-[#6086A5] transition hover:bg-[#F2F8FE]"
              >
                {showSearch ? (
                  <X size={17} />
                ) : (
                  <Search size={17} />
                )}
              </button>

              <Link
                href="/admin/users"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#EAF5FF] px-3.5 text-[11px] font-bold text-[#287CB9] transition hover:bg-[#D9EDFC]"
              >
                View All Users
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {showSearch && (
            <div className="border-b border-[#EDF2F7] bg-[#FBFDFF] px-5 py-4 sm:px-6">
              <div className="relative max-w-md">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Search name, email, or role..."
                  className="w-full rounded-xl border border-[#DCEAF6] bg-white py-2.5 pl-10 pr-4 text-[12px] outline-none transition placeholder:text-slate-400 focus:border-[#7DBBE9] focus:ring-2 focus:ring-[#E3F3FF]"
                />
              </div>
            </div>
          )}

          {usersLoading ? (
            <div className="flex min-h-[230px] items-center justify-center">
              <Loader2
                size={23}
                className="animate-spin text-[#368CCB]"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-[#F8FBFE]">
                  <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#88A0B4]">
                    <th className="px-6 py-3.5">
                      User
                    </th>

                    <th className="px-6 py-3.5">
                      Role
                    </th>

                    <th className="px-6 py-3.5">
                      Registered
                    </th>

                    <th className="px-6 py-3.5 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EDF2F7]">
                  {(showSearch && searchTerm.trim()
                    ? searchResults
                    : recentUsers
                  ).map((user) => (
                    <tr
                      key={user.id}
                      className="transition hover:bg-[#FAFCFF]"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <InitialAvatar
                            name={user.name}
                            photoURL={user.photoURL}
                            size="sm"
                          />

                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate text-[12px] font-semibold text-[#254C6C]">
                              {user.name}
                            </p>

                            <p className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400">
                              {user.email ||
                                'No email provided'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-3.5">
                        <RoleBadge role={user.role} />
                      </td>

                      <td className="px-6 py-3.5 text-[11px] text-slate-500">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="px-6 py-3.5 text-right">
                        <Link
                          href="/admin/users"
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2A7FBD] transition hover:text-[#155A93]"
                        >
                          View
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(showSearch && searchTerm.trim()
                ? searchResults.length === 0
                : recentUsers.length === 0) && (
                <EmptyState
                  icon={UsersRound}
                  title={
                    searchTerm.trim()
                      ? 'No matching users'
                      : 'No users found'
                  }
                  description={
                    searchTerm.trim()
                      ? 'Try a different name, email, or role.'
                      : 'Registered users will appear here.'
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-7 flex flex-col gap-2 border-t border-[#E0EAF3] pt-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            GradeSync Administration · Samar State University
          </p>

          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

            <span>
              {lastUpdated
                ? `Last updated ${formatTime(lastUpdated)}`
                : 'Waiting for data'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
