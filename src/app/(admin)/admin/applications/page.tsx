
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Filter,
  Image as ImageIcon,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UsersRound,
  X,
  XCircle,
  ExternalLink,
  Mail,
  IdCard,
  GraduationCap,
  RefreshCw,
} from 'lucide-react'

type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'unknown'

type StatusFilter =
  | 'all'
  | 'pending'
  | 'approved'
  | 'rejected'

type ReviewAction = 'approve' | 'reject'

type Application = {
  id: string
  source: string
  userId: string
  fullName: string
  email: string
  employeeId: string
  phone: string
  college: string
  department: string
  position: string
  status: ApplicationStatus
  createdAt: Date | null
  reviewedAt: Date | null
  reviewedBy: string
  rejectionReason: string
  idImage: string
  data: DocumentData
}

type ApplicantProfile = {
  id: string
  data: DocumentData
}

const APPLICATION_COLLECTION = 'applications'
const PAGE_SIZE = 8

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate()
    } catch {
      return null
    }
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function formatDate(date: Date | null): string {
  if (!date) return 'Not available'

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(date: Date | null): string {
  if (!date) return 'Not available'

  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function normalizeStatus(value: unknown): ApplicationStatus {
  const status = getString(value).toLowerCase()

  if (
    ['pending', 'submitted', 'under_review', 'under review'].includes(
      status
    )
  ) {
    return 'pending'
  }

  if (['approved', 'accepted', 'verified'].includes(status)) {
    return 'approved'
  }

  if (['rejected', 'declined', 'denied'].includes(status)) {
    return 'rejected'
  }

  return 'unknown'
}

function getImage(data: DocumentData): string {
  const possibleImage =
    getString(data.idImageData) ||
    getString(data.idImageUrl) ||
    getString(data.facultyIdImage) ||
    getString(data.idImage)

  if (
    possibleImage.startsWith('data:image/jpeg;base64,') ||
    possibleImage.startsWith('data:image/png;base64,') ||
    possibleImage.startsWith('data:image/webp;base64,')
  ) {
    return possibleImage
  }

  if (
    possibleImage.startsWith('https://') ||
    possibleImage.startsWith('http://')
  ) {
    return possibleImage
  }

  return ''
}

function normalizeApplication(
  id: string,
  data: DocumentData
): Application {
  return {
    id,
    source: APPLICATION_COLLECTION,
    userId:
      getString(data.userId) ||
      getString(data.uid) ||
      getString(data.applicantUid) ||
      id,
    fullName:
      getString(data.fullName) ||
      getString(data.accountDisplayName) ||
      getString(data.displayName) ||
      'Unnamed Applicant',
    email:
      getString(data.email) ||
      getString(data.accountEmail) ||
      getString(data.applicantEmail),
    employeeId: getString(data.employeeId),
    phone: getString(data.phone),
    college: getString(data.college),
    department: getString(data.department),
    position: getString(data.position),
    status: normalizeStatus(
      data.status || data.verificationStatus
    ),
    createdAt:
      getDate(data.submittedAt) ||
      getDate(data.createdAt) ||
      getDate(data.appliedAt),
    reviewedAt: getDate(data.reviewedAt),
    reviewedBy: getString(data.reviewedBy),
    rejectionReason: getString(data.rejectionReason),
    idImage: getImage(data),
    data,
  }
}

function prettyLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—'

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (typeof value === 'string') {
    return value || '—'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  const date = getDate(value)

  if (date) return formatDateTime(date)

  if (Array.isArray(value)) {
    return value.map((item) => displayValue(item)).join(', ')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function StatusBadge({
  status,
}: {
  status: ApplicationStatus
}) {
  const config = {
    pending: {
      label: 'Pending Review',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
    },
    approved: {
      label: 'Approved',
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
    },
    rejected: {
      label: 'Rejected',
      className: 'border-red-200 bg-red-50 text-red-700',
      dot: 'bg-red-500',
    },
    unknown: {
      label: 'Unknown',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
      dot: 'bg-slate-400',
    },
  }[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  title: string
  value: number
  icon: React.ComponentType<{
    size?: number
    className?: string
  }>
  accent: 'blue' | 'amber' | 'green' | 'red'
  loading: boolean
}) {
  const theme = {
    blue: 'bg-[#E9F5FF] text-[#287FC1]',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
  }[accent]

  return (
    <div className="rounded-2xl border border-[#E0EAF4] bg-white p-5 shadow-[0_3px_14px_rgba(31,87,137,0.035)]">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme}`}
      >
        <Icon size={21} />
      </div>

      {loading ? (
        <div className="mt-5 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <p className="mt-4 text-[29px] font-extrabold tracking-[-0.05em] text-[#173B5E]">
          {value.toLocaleString()}
        </p>
      )}

      <p className="mt-1 text-[12px] font-medium text-slate-500">
        {title}
      </p>
    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#E8EFF6] bg-[#FBFDFF] p-3.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8AA4B9]">
        {label}
      </p>

      <div className="break-words text-[12px] font-semibold leading-5 text-[#254D6E]">
        {value}
      </div>
    </div>
  )
}

export default function ApplicationsPage() {
  const [adminUser, setAdminUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null)

  const [applicantProfile, setApplicantProfile] =
    useState<ApplicantProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [reviewAction, setReviewAction] =
    useState<ReviewAction | null>(null)

  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!active) return

        setAdminUser(user)
        setAuthLoading(true)
        setIsAuthorized(false)

        if (!user) {
          setError('Please sign in with an administrator account.')
          setAuthLoading(false)
          setLoading(false)
          return
        }

        try {
          const userSnapshot = await getDoc(
            doc(db, 'users', user.uid)
          )

          if (!active) return

          const role = userSnapshot.exists()
            ? getString(userSnapshot.data().role).toLowerCase()
            : ''

          if (role !== 'admin') {
            setError(
              'Access denied. Only GradeSync administrators can review instructor applications.'
            )
            setIsAuthorized(false)
          } else {
            setError('')
            setIsAuthorized(true)
          }
        } catch (authError) {
          console.error(
            '[GradeSync Admin] Authorization error:',
            authError
          )

          if (active) {
            setError('Unable to verify administrator permissions.')
            setIsAuthorized(false)
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

  useEffect(() => {
    if (!isAuthorized || !adminUser) return

    const unsubscribe = onSnapshot(
      collection(db, APPLICATION_COLLECTION),
      (snapshot) => {
        const records = snapshot.docs.map((item) =>
          normalizeApplication(item.id, item.data())
        )

        setApplications(records)
        setLoading(false)
        setError('')
      },
      (snapshotError) => {
        console.error(
          '[GradeSync Admin] Applications listener error:',
          snapshotError
        )

        setLoading(false)

        setError(
          snapshotError.code === 'permission-denied'
            ? 'Firestore permission denied. Make sure your account has the admin role and the published Firestore rules allow admins to list the applications collection.'
            : 'Unable to load instructor applications. Please check your connection and try again.'
        )
      }
    )

    return () => unsubscribe()
  }, [isAuthorized, adminUser])

  useEffect(() => {
    if (!selectedApplication) return

    let active = true

    const loadProfile = async () => {
      setProfileLoading(true)
      setApplicantProfile(null)

      if (!selectedApplication.userId) {
        setProfileLoading(false)
        return
      }

      try {
        const snapshot = await getDoc(
          doc(db, 'users', selectedApplication.userId)
        )

        if (!active) return

        setApplicantProfile(
          snapshot.exists()
            ? {
                id: snapshot.id,
                data: snapshot.data(),
              }
            : null
        )
      } catch (profileError) {
        console.error(
          '[GradeSync Admin] Applicant profile error:',
          profileError
        )
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [
    selectedApplication?.id,
    selectedApplication?.userId,
  ])

  useEffect(() => {
    if (!selectedApplication && !reviewAction && !imagePreviewOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedApplication, reviewAction, imagePreviewOpen])

  const sortedApplications = useMemo(
    () =>
      [...applications].sort(
        (a, b) =>
          (b.createdAt?.getTime() || 0) -
          (a.createdAt?.getTime() || 0)
      ),
    [applications]
  )

  const stats = useMemo(
    () => ({
      total: applications.length,
      pending: applications.filter(
        (application) => application.status === 'pending'
      ).length,
      approved: applications.filter(
        (application) => application.status === 'approved'
      ).length,
      rejected: applications.filter(
        (application) => application.status === 'rejected'
      ).length,
    }),
    [applications]
  )

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase()

    return sortedApplications.filter((application) => {
      if (
        statusFilter !== 'all' &&
        application.status !== statusFilter
      ) {
        return false
      }

      if (!term) return true

      return [
        application.fullName,
        application.email,
        application.employeeId,
        application.college,
        application.department,
        application.position,
        application.id,
        application.userId,
      ].some((value) => value.toLowerCase().includes(term))
    })
  }, [sortedApplications, search, statusFilter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredApplications.length / PAGE_SIZE)
  )

  const currentPage = Math.min(page, totalPages)

  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const openApplication = (application: Application) => {
    setSelectedApplication(application)
    setReviewAction(null)
    setActionError('')
    setSuccessMessage('')
    setImagePreviewOpen(false)
  }

  const openReview = (action: ReviewAction) => {
    setReviewAction(action)
    setRejectionReason('')
    setActionError('')
  }

  const closeReview = () => {
    if (processing) return
    setReviewAction(null)
    setActionError('')
  }

  const handleReview = async () => {
    if (!selectedApplication || !reviewAction || !adminUser) {
      setActionError('Administrator session is unavailable.')
      return
    }

    if (!isAuthorized) {
      setActionError('Administrator authorization is required.')
      return
    }

    if (!selectedApplication.userId) {
      setActionError(
        'This application has no linked Firebase user ID.'
      )
      return
    }

    if (
      reviewAction === 'reject' &&
      !rejectionReason.trim()
    ) {
      setActionError('Please provide a reason for rejection.')
      return
    }

    setProcessing(true)
    setActionError('')

    const action = reviewAction
    const application = selectedApplication

    try {
      const applicationRef = doc(
        db,
        APPLICATION_COLLECTION,
        application.id
      )

      const userRef = doc(
        db,
        'users',
        application.userId
      )

      await runTransaction(db, async (transaction) => {
        const applicationSnapshot =
          await transaction.get(applicationRef)

        const userSnapshot = await transaction.get(userRef)

        if (!applicationSnapshot.exists()) {
          throw new Error('Application no longer exists.')
        }

        if (!userSnapshot.exists()) {
          throw new Error(
            'The linked user account could not be found.'
          )
        }

        const currentApplication = applicationSnapshot.data()

        const currentStatus = normalizeStatus(
          currentApplication.status ||
          currentApplication.verificationStatus
        )

        if (currentStatus !== 'pending') {
          throw new Error(
            'This application has already been reviewed.'
          )
        }

        const applicationOwner =
          getString(currentApplication.userId) ||
          getString(currentApplication.uid) ||
          getString(currentApplication.applicantUid)

        if (
          applicationOwner !== application.userId ||
          application.id !== application.userId
        ) {
          throw new Error(
            'Application ownership verification failed.'
          )
        }

        const currentUser = userSnapshot.data()

        if (currentUser.role === 'admin') {
          throw new Error(
            'Administrator accounts cannot be modified through instructor applications.'
          )
        }

        if (action === 'approve') {
          if (currentUser.role !== 'student') {
            throw new Error(
              'Only student accounts can be approved for instructor access.'
            )
          }

          transaction.update(userRef, {
            role: 'instructor',
            isInstructorVerified: true,
            verificationStatus: 'approved',
            updatedAt: serverTimestamp(),
          })

          transaction.update(applicationRef, {
            status: 'approved',
            verificationStatus: 'approved',
            reviewedAt: serverTimestamp(),
            reviewedBy: adminUser.uid,
            approvedAt: serverTimestamp(),
            approvedBy: adminUser.uid,
            rejectionReason: '',
            updatedAt: serverTimestamp(),
          })
        } else {
          if (currentUser.role !== 'student') {
            throw new Error(
              'Only student accounts can have their instructor applications rejected.'
            )
          }

          transaction.update(userRef, {
            verificationStatus: 'rejected',
            isInstructorVerified: false,
            updatedAt: serverTimestamp(),
          })

          transaction.update(applicationRef, {
            status: 'rejected',
            verificationStatus: 'rejected',
            reviewedAt: serverTimestamp(),
            reviewedBy: adminUser.uid,
            rejectedAt: serverTimestamp(),
            rejectedBy: adminUser.uid,
            rejectionReason: rejectionReason.trim(),
            updatedAt: serverTimestamp(),
          })
        }
      })

      setSuccessMessage(
        action === 'approve'
          ? `${application.fullName} has been approved as an instructor.`
          : `${application.fullName}'s application has been rejected.`
      )

      setReviewAction(null)
      setSelectedApplication(null)
      setRejectionReason('')
    } catch (reviewError) {
      console.error(
        '[GradeSync Admin] Application review failed:',
        reviewError
      )

      setActionError(
        reviewError instanceof Error
          ? reviewError.message
          : 'Unable to process this application.'
      )
    } finally {
      setProcessing(false)
    }
  }

  const closeApplication = () => {
    if (processing) return

    setSelectedApplication(null)
    setReviewAction(null)
    setImagePreviewOpen(false)
    setActionError('')
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
            {error ||
              'Only authorized GradeSync administrators can access instructor applications.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F9FD] px-4 pb-12 pt-6 font-sans sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1600px]">

        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[#86A1B9]">
          <ShieldCheck size={14} />
          Administration
          <ChevronRight size={13} />
          <span className="text-[#2C7CB8]">
            Applications
          </span>
        </div>

        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.045em] text-[#173B5E] sm:text-[30px]">
              Instructor Applications
            </h1>

            <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
              Review account requests and manage instructor verification.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#D9EAF7] bg-white px-3.5 py-2.5 text-[11px] font-semibold text-[#467EA9] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live Firestore Updates
          </div>
        </div>

        {/* Banner */}
        <div className="relative mb-7 overflow-hidden rounded-[22px] bg-gradient-to-r from-[#1768AD] via-[#318CD0] to-[#78BFED] px-6 py-7 text-white shadow-[0_10px_30px_rgba(42,122,190,0.14)] sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/20" />
          <div className="pointer-events-none absolute right-4 top-0 h-44 w-44 rounded-full border border-white/15" />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                <ShieldCheck size={13} />
                Account Verification
              </div>

              <h2 className="text-[21px] font-bold tracking-tight sm:text-[24px]">
                Review with confidence.
              </h2>

              <p className="mt-2 max-w-xl text-[12px] leading-6 text-blue-50">
                Verify applicant information and faculty identification
                before granting instructor access to GradeSync.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur-sm">
              <Clock3 size={22} />

              <div>
                <p className="text-[23px] font-extrabold leading-none">
                  {stats.pending}
                </p>

                <p className="mt-1 text-[10px] font-medium text-blue-50">
                  Awaiting Review
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <AlertCircle size={19} className="shrink-0" />
            <p className="text-xs leading-5">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2
                size={18}
                className="text-emerald-600"
              />

              <p className="text-xs font-semibold text-emerald-800">
                {successMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              aria-label="Dismiss success message"
              className="text-emerald-600"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Applications"
            value={stats.total}
            icon={FileCheck2}
            accent="blue"
            loading={loading}
          />

          <StatCard
            title="Pending Review"
            value={stats.pending}
            icon={Clock3}
            accent="amber"
            loading={loading}
          />

          <StatCard
            title="Approved"
            value={stats.approved}
            icon={UserCheck}
            accent="green"
            loading={loading}
          />

          <StatCard
            title="Rejected"
            value={stats.rejected}
            icon={XCircle}
            accent="red"
            loading={loading}
          />
        </div>

        {/* Application table */}
        <div className="overflow-hidden rounded-2xl border border-[#DFEAF4] bg-white shadow-sm">
          <div className="border-b border-[#EDF2F7] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#173B5E]">
                  Application Records
                </h2>

                <p className="mt-1 text-[11px] text-slate-400">
                  Select an applicant to view details and take action.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Search applicants..."
                    className="h-10 w-full rounded-xl border border-[#DEEAF5] bg-[#FAFCFF] pl-10 pr-4 text-xs outline-none transition focus:border-[#83BCE7] sm:w-[240px]"
                  />
                </div>

                <div className="relative">
                  <Filter
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F93B0]"
                  />

                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(
                        event.target.value as StatusFilter
                      )
                      setPage(1)
                    }}
                    className="h-10 w-full appearance-none rounded-xl border border-[#DEEAF5] bg-[#FAFCFF] py-2 pl-9 pr-9 text-xs font-semibold text-[#537A99] outline-none sm:w-[160px]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
              <Loader2
                size={25}
                className="animate-spin text-[#3189C9]"
              />

              <p className="text-xs text-slate-400">
                Loading applications...
              </p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBF6FF] text-[#438FC8]">
                <FileCheck2 size={25} />
              </div>

              <h3 className="text-sm font-bold text-[#254D6E]">
                No applications found
              </h3>

              <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or status filter.'
                  : 'Instructor applications submitted by students will appear here automatically.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[#F8FBFE]">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#89A3B8]">
                      <th className="px-6 py-4">Applicant</th>
                      <th className="px-6 py-4">Submitted</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EDF2F7]">
                    {paginatedApplications.map((application) => (
                      <tr
                        key={application.id}
                        className="transition hover:bg-[#F8FBFF]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#E7F5FF] to-[#CCE7FA] text-sm font-bold text-[#2B7CB9]">
                              {application.fullName
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p className="max-w-[240px] truncate text-[12px] font-bold text-[#254D6E]">
                                {application.fullName}
                              </p>

                              <p className="mt-1 max-w-[240px] truncate text-[11px] text-slate-400">
                                {application.email ||
                                  'No email provided'}
                              </p>

                              {application.employeeId && (
                                <p className="mt-1 text-[10px] text-[#7F9BB1]">
                                  ID: {application.employeeId}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-[11px] text-slate-500">
                          {formatDate(application.createdAt)}
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={application.status} />
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openApplication(application)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF5FF] px-3.5 py-2 text-[11px] font-bold text-[#287DBB] transition hover:bg-[#D9EDFC]"
                          >
                            Review
                            <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-[#EDF2F7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-[11px] text-slate-400">
                  Showing{' '}
                  {Math.min(
                    (currentPage - 1) * PAGE_SIZE + 1,
                    filteredApplications.length
                  )}{' '}
                  –{' '}
                  {Math.min(
                    currentPage * PAGE_SIZE,
                    filteredApplications.length
                  )}{' '}
                  of {filteredApplications.length} applications
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0EAF4] text-[#5A88A9] transition hover:bg-[#F0F8FF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <span className="px-2 text-[11px] font-semibold text-[#456F91]">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E0EAF4] text-[#5A88A9] transition hover:bg-[#F0F8FF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Applicant Details Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94dvh] w-full max-w-[850px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#E7EFF6] px-5 py-4 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6295BB]">
                  Application Review
                </p>

                <h2 className="mt-1 text-lg font-extrabold text-[#173B5E]">
                  Applicant Information
                </h2>
              </div>

              <button
                type="button"
                onClick={closeApplication}
                disabled={processing}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#DCEBF7] bg-gradient-to-r from-[#F1F9FF] to-[#E5F3FE] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-bold text-[#3484BF] shadow-sm">
                    {selectedApplication.fullName
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-[17px] font-bold text-[#214C70]">
                      {selectedApplication.fullName}
                    </h3>

                    <p className="mt-1 truncate text-xs text-[#6A91AF]">
                      {selectedApplication.email || 'No email'}
                    </p>

                    <div className="mt-2">
                      <StatusBadge
                        status={selectedApplication.status}
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86A8C1]">
                    Submitted
                  </p>

                  <p className="mt-1 text-xs font-bold text-[#356F9B]">
                    {formatDate(selectedApplication.createdAt)}
                  </p>
                </div>
              </div>

              {/* Application Details */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound
                    size={17}
                    className="text-[#3788C6]"
                  />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Application Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Full Name"
                    value={selectedApplication.fullName}
                  />

                  <DetailField
                    label="Email Address"
                    value={
                      selectedApplication.email || 'Not provided'
                    }
                  />

                  <DetailField
                    label="Employee ID"
                    value={
                      selectedApplication.employeeId ||
                      'Not provided'
                    }
                  />

                  <DetailField
                    label="Phone Number"
                    value={
                      selectedApplication.phone ||
                      'Not provided'
                    }
                  />

                  <DetailField
                    label="College"
                    value={
                      selectedApplication.college ||
                      'Not provided'
                    }
                  />

                  <DetailField
                    label="Department"
                    value={
                      selectedApplication.department ||
                      'Not provided'
                    }
                  />

                  <DetailField
                    label="Position"
                    value={
                      selectedApplication.position ||
                      'Not provided'
                    }
                  />

                  <DetailField
                    label="Firebase User ID"
                    value={
                      selectedApplication.userId ||
                      'Not linked'
                    }
                  />

                  <DetailField
                    label="Application Status"
                    value={
                      <StatusBadge
                        status={selectedApplication.status}
                      />
                    }
                  />

                  <DetailField
                    label="Submission Date"
                    value={formatDateTime(
                      selectedApplication.createdAt
                    )}
                  />

                  <DetailField
                    label="Application ID"
                    value={selectedApplication.id}
                  />

                  <DetailField
                    label="Declaration Accepted"
                    value={
                      selectedApplication.data.declarationAccepted ===
                      true
                        ? 'Yes'
                        : 'No'
                    }
                  />
                </div>
              </div>

              {/* Faculty ID Verification */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <IdCard
                    size={17}
                    className="text-[#3788C6]"
                  />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Faculty ID Verification
                  </h3>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E0EAF4] bg-[#FBFDFF]">
                  {selectedApplication.idImage ? (
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="flex h-[200px] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E0EAF4] bg-white sm:w-[280px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedApplication.idImage}
                            alt="Submitted faculty identification"
                            className="h-full w-full object-contain"
                          />
                        </div>

                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 size={12} />
                              Image Submitted
                            </div>

                            <p className="text-sm font-bold text-[#254D6E]">
                              Faculty Identification
                            </p>

                            <p className="mt-2 break-all text-[11px] text-slate-500">
                              {getString(
                                selectedApplication.data.idOriginalFileName
                              ) ||
                                getString(
                                  selectedApplication.data.idFileName
                                ) ||
                                'Faculty ID Image'}
                            </p>

                            <p className="mt-2 text-[11px] leading-5 text-slate-400">
                              Review the submitted identification and
                              verify that it matches the applicants
                              information.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setImagePreviewOpen(true)}
                            className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-[#EAF5FF] px-4 py-2.5 text-xs font-bold text-[#287DBB] transition hover:bg-[#D9EDFC]"
                          >
                            <ExternalLink size={15} />
                            View Full Image
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-5 py-9 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <ImageIcon size={22} />
                      </div>

                      <p className="text-xs font-bold text-[#254D6E]">
                        No Faculty ID Image Available
                      </p>

                      <p className="mt-2 max-w-sm text-[11px] leading-5 text-slate-400">
                        The application does not contain a supported
                        faculty ID image.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Registered Account */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <UsersRound
                    size={17}
                    className="text-[#3788C6]"
                  />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Registered Account
                  </h3>
                </div>

                {profileLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#E5EEF6] p-4 text-xs text-slate-400">
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Loading user profile...
                  </div>
                ) : applicantProfile ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailField
                      label="Current Role"
                      value={displayValue(
                        applicantProfile.data.role
                      )}
                    />

                    <DetailField
                      label="Account Name"
                      value={
                        getString(
                          applicantProfile.data.fullName
                        ) ||
                        getString(
                          applicantProfile.data.displayName
                        ) ||
                        'Not provided'
                      }
                    />

                    <DetailField
                      label="Account Email"
                      value={displayValue(
                        applicantProfile.data.email
                      )}
                    />

                    <DetailField
                      label="Verification Status"
                      value={displayValue(
                        applicantProfile.data.verificationStatus
                      )}
                    />

                    <DetailField
                      label="Student ID"
                      value={displayValue(
                        applicantProfile.data.studentId
                      )}
                    />

                    <DetailField
                      label="Year & Section"
                      value={displayValue(
                        applicantProfile.data.yearAndSection
                      )}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                    No linked user profile was found. The application
                    must reference an existing Firebase user account
                    before approval.
                  </div>
                )}
              </div>

              {/* Additional Submitted Information */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileCheck2
                    size={17}
                    className="text-[#3788C6]"
                  />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Additional Submitted Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(selectedApplication.data)
                    .filter(
                      ([key]) =>
                        ![
                          'fullName',
                          'displayName',
                          'name',
                          'applicantName',
                          'email',
                          'applicantEmail',
                          'accountEmail',
                          'userEmail',
                          'employeeId',
                          'phone',
                          'college',
                          'department',
                          'position',
                          'userId',
                          'uid',
                          'applicantUid',
                          'studentUid',
                          'userUid',
                          'status',
                          'verificationStatus',
                          'submittedAt',
                          'createdAt',
                          'appliedAt',
                          'updatedAt',
                          'reviewedAt',
                          'reviewedBy',
                          'approvedAt',
                          'approvedBy',
                          'rejectedAt',
                          'rejectedBy',
                          'rejectionReason',
                          'idImageUrl',
                          'idImageData',
                          'idImage',
                          'facultyIdImage',
                          'idImagePath',
                          'declarationAccepted',
                        ].includes(key)
                    )
                    .map(([key, value]) => (
                      <DetailField
                        key={key}
                        label={prettyLabel(key)}
                        value={displayValue(value)}
                      />
                    ))}
                </div>

                {selectedApplication.reviewedAt && (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailField
                      label="Reviewed At"
                      value={formatDateTime(
                        selectedApplication.reviewedAt
                      )}
                    />

                    <DetailField
                      label="Reviewed By"
                      value={
                        selectedApplication.reviewedBy || '—'
                      }
                    />
                  </div>
                )}

                {selectedApplication.rejectionReason && (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-[11px] font-bold text-red-700">
                      Rejection Reason
                    </p>

                    <p className="mt-2 text-xs leading-6 text-red-700">
                      {selectedApplication.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-[#E7EFF6] bg-[#FAFCFF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-[11px] text-slate-400">
                {selectedApplication.status === 'pending'
                  ? 'Review applicant details before making a decision.'
                  : 'This application has already been reviewed.'}
              </p>

              {selectedApplication.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openReview('reject')}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 sm:flex-none"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => openReview('approve')}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2788CA] to-[#176BB1] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-[#2079B7] hover:to-[#155D99] sm:flex-none"
                  >
                    <CheckCircle2 size={16} />
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Faculty ID Image Preview */}
      {selectedApplication &&
        imagePreviewOpen &&
        selectedApplication.idImage && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
            <div className="relative flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-[#173B5E]">
                    Faculty ID Verification
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {selectedApplication.fullName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setImagePreviewOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#F1F5F9] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedApplication.idImage}
                  alt="Full faculty ID preview"
                  className="max-h-[75dvh] max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        )}

      {/* Confirmation modal */}
      {selectedApplication && reviewAction && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-confirm-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="p-6">
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                  reviewAction === 'approve'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {reviewAction === 'approve' ? (
                  <UserCheck size={24} />
                ) : (
                  <XCircle size={24} />
                )}
              </div>

              <h2
                id="review-confirm-title"
                className="text-lg font-bold text-[#173B5E]"
              >
                {reviewAction === 'approve'
                  ? 'Approve Instructor Application?'
                  : 'Reject Instructor Application?'}
              </h2>

              <p className="mt-3 text-[13px] leading-6 text-slate-500">
                {reviewAction === 'approve' ? (
                  <>
                    You are about to approve{' '}
                    <strong className="text-slate-700">
                      {selectedApplication.fullName}
                    </strong>
                    . Their account role will be changed to{' '}
                    <strong className="text-[#247CB9]">
                      Instructor
                    </strong>
                    , granting access to instructor features.
                  </>
                ) : (
                  <>
                    You are about to reject the application
                    submitted by{' '}
                    <strong className="text-slate-700">
                      {selectedApplication.fullName}
                    </strong>
                    .
                  </>
                )}
              </p>

              {reviewAction === 'reject' && (
                <div className="mt-5">
                  <label className="mb-2 block text-xs font-bold text-[#315A7A]">
                    Reason for Rejection
                  </label>

                  <textarea
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(event.target.value)
                    }
                    rows={4}
                    maxLength={1000}
                    placeholder="Explain why the application was rejected..."
                    className="w-full resize-none rounded-xl border border-[#DCE8F2] p-3 text-xs leading-6 outline-none transition focus:border-[#85BCE5]"
                  />
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700"
                >
                  {actionError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReview}
                  disabled={processing}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleReview}
                  disabled={processing}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition disabled:opacity-60 ${
                    reviewAction === 'approve'
                      ? 'bg-[#247FC1] hover:bg-[#1769A6]'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      Processing...
                    </>
                  ) : reviewAction === 'approve' ? (
                    <>
                      <Check size={16} />
                      Confirm Approval
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Confirm Rejection
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
