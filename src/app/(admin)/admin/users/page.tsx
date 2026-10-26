
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
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  IdCard,
  Loader2,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

type UserRole = 'student' | 'instructor' | 'admin' | 'other'
type RoleFilter = 'all' | UserRole
type AccountFilter = 'all' | 'verified' | 'unverified'
type SortOption = 'newest' | 'oldest' | 'name'
type RoleAction = 'student' | 'instructor'

interface UserRecord {
  id: string
  uid: string
  name: string
  email: string
  photoURL: string
  role: UserRole
  studentId: string
  yearAndSection: string
  verificationStatus: string
  isInstructorVerified: boolean
  createdAt: Date | null
  updatedAt: Date | null
  raw: DocumentData
}

const PAGE_SIZE = 10

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getDate(value: unknown): Date | null {
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
      const date = (value as { toDate: () => Date }).toDate()
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

function normalizeRole(value: unknown): UserRole {
  const role = getString(value).toLowerCase()

  if (role === 'student') return 'student'
  if (role === 'instructor') return 'instructor'
  if (role === 'admin') return 'admin'

  return 'other'
}

function normalizeUser(id: string, data: DocumentData): UserRecord {
  return {
    id,
    uid: getString(data.uid) || id,
    name:
      getString(data.fullName) ||
      getString(data.displayName) ||
      getString(data.name) ||
      'Unnamed User',
    email: getString(data.email),
    photoURL: getString(data.photoURL),
    role: normalizeRole(data.role),
    studentId: getString(data.studentId),
    yearAndSection: getString(data.yearAndSection),
    verificationStatus: getString(data.verificationStatus),
    isInstructorVerified: data.isInstructorVerified === true,
    createdAt: getDate(data.createdAt),
    updatedAt: getDate(data.updatedAt),
    raw: data,
  }
}

function getRoleLabel(role: UserRole): string {
  if (role === 'student') return 'Student'
  if (role === 'instructor') return 'Instructor'
  if (role === 'admin') return 'Administrator'
  return 'Unassigned'
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return 'U'

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    student: 'border-sky-200 bg-sky-50 text-sky-700',
    instructor: 'border-violet-200 bg-violet-50 text-violet-700',
    admin: 'border-blue-200 bg-blue-50 text-blue-800',
    other: 'border-slate-200 bg-slate-50 text-slate-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles[role]}`}
    >
      {getRoleLabel(role)}
    </span>
  )
}

function VerificationBadge({ user }: { user: UserRecord }) {
  const verified =
    user.role === 'instructor' && user.isInstructorVerified

  if (user.role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
        <ShieldCheck size={14} />
        Administrator
      </span>
    )
  }

  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={14} />
        Verified
      </span>
    )
  }

  if (user.role === 'instructor') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
        <Clock3 size={14} />
        Unverified
      </span>
    )
  }

  return (
    <span className="text-[11px] text-slate-400">
      Not applicable
    </span>
  )
}

function UserAvatar({
  name,
  photoURL,
  size = 'md',
}: {
  name: string
  photoURL?: string
  size?: 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)

  const sizeClass =
    size === 'lg'
      ? 'h-16 w-16 rounded-2xl text-xl'
      : 'h-10 w-10 rounded-xl text-xs'

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#CFE5F6] bg-gradient-to-br from-[#E7F5FF] to-[#C8E5F9] font-bold text-[#287DB9] ${sizeClass}`}
    >
      {photoURL && !failed ? (
        <img
          src={photoURL}
          alt={name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
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
  icon: React.ComponentType<{ size?: number }>
  accent: 'blue' | 'cyan' | 'violet' | 'indigo'
  loading: boolean
}) {
  const theme = {
    blue: 'bg-[#E9F5FF] text-[#287FC1]',
    cyan: 'bg-cyan-50 text-cyan-700',
    violet: 'bg-violet-50 text-violet-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  }[accent]

  return (
    <div className="rounded-2xl border border-[#DFEAF4] bg-white p-5 shadow-[0_3px_14px_rgba(31,87,137,0.035)]">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme}`}
      >
        <Icon size={21} />
      </div>

      {loading ? (
        <div className="mt-5 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <p className="mt-4 text-[30px] font-extrabold tracking-[-0.05em] text-[#173B5E]">
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
    <div className="rounded-xl border border-[#E5EEF6] bg-[#FBFDFF] p-4">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8AA4B9]">
        {label}
      </p>

      <div className="break-words text-[12px] font-semibold leading-5 text-[#254D6E]">
        {value}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [accountFilter, setAccountFilter] =
    useState<AccountFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [roleAction, setRoleAction] = useState<RoleAction | null>(null)
  const [processing, setProcessing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, setAdminUser)
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((item) =>
            normalizeUser(item.id, item.data())
          )
        )
        setError('')
        setLoading(false)
      },
      (snapshotError) => {
        console.error(
          '[GradeSync Admin] Users listener error:',
          snapshotError
        )

        setError(
          'Unable to load user accounts. Please check Firestore permissions.'
        )
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const stats = useMemo(
    () => ({
      total: users.length,
      students: users.filter((user) => user.role === 'student').length,
      instructors: users.filter(
        (user) => user.role === 'instructor'
      ).length,
      admins: users.filter((user) => user.role === 'admin').length,
    }),
    [users]
  )

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return users
      .filter((user) => {
        if (roleFilter !== 'all' && user.role !== roleFilter) {
          return false
        }

        if (accountFilter === 'verified') {
          if (
            user.role !== 'instructor' ||
            !user.isInstructorVerified
          ) {
            return false
          }
        }

        if (accountFilter === 'unverified') {
          if (
            user.role !== 'instructor' ||
            user.isInstructorVerified
          ) {
            return false
          }
        }

        if (!term) return true

        return [
          user.name,
          user.email,
          user.studentId,
          user.yearAndSection,
          user.uid,
          user.role,
        ].some((value) => value.toLowerCase().includes(term))
      })
      .sort((a, b) => {
        if (sortOption === 'name') {
          return a.name.localeCompare(b.name)
        }

        const first = a.createdAt?.getTime() || 0
        const second = b.createdAt?.getTime() || 0

        return sortOption === 'oldest'
          ? first - second
          : second - first
      })
  }, [users, search, roleFilter, accountFilter, sortOption])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / PAGE_SIZE)
  )

  const currentPage = Math.min(page, totalPages)

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  )

  useEffect(() => {
    if (!selectedUserId) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedUserId])

  const openUser = (user: UserRecord) => {
    setSelectedUserId(user.id)
    setRoleAction(null)
    setActionError('')
  }

  const closeUser = () => {
    if (processing) return

    setSelectedUserId(null)
    setRoleAction(null)
    setActionError('')
  }

  const handleRoleUpdate = async () => {
    if (!selectedUser || !roleAction || !adminUser) {
      setActionError('Administrator session is unavailable.')
      return
    }

    if (selectedUser.uid === adminUser.uid) {
      setActionError(
        'You cannot modify your own administrator account.'
      )
      return
    }

    if (selectedUser.role === 'admin') {
      setActionError(
        'Administrator accounts cannot be modified from this page.'
      )
      return
    }

    if (selectedUser.role === roleAction) {
      setActionError('This account already has the selected role.')
      return
    }

    setProcessing(true)
    setActionError('')

    try {
      const userRef = doc(db, 'users', selectedUser.id)

      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(userRef)

        if (!snapshot.exists()) {
          throw new Error('This user account no longer exists.')
        }

        const currentData = snapshot.data()

        if (currentData.role === 'admin') {
          throw new Error(
            'Administrator accounts cannot be modified.'
          )
        }

        if (roleAction === 'instructor') {
          transaction.update(userRef, {
            role: 'instructor',
            isInstructorVerified: true,
            verificationStatus: 'approved',
            updatedAt: serverTimestamp(),
          })
        } else {
          transaction.update(userRef, {
            role: 'student',
            isInstructorVerified: false,
            verificationStatus: 'none',
            updatedAt: serverTimestamp(),
          })
        }
      })

      setSuccessMessage(
        `${selectedUser.name} has been updated to ${getRoleLabel(
          roleAction
        )}.`
      )

      setRoleAction(null)
      setSelectedUserId(null)
    } catch (updateError) {
      console.error(
        '[GradeSync Admin] Role update failed:',
        updateError
      )

      setActionError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update the user role.'
      )
    } finally {
      setProcessing(false)
    }
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
            Users
          </span>
        </div>

        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.045em] text-[#173B5E] sm:text-[30px]">
              User Management
            </h1>

            <p className="mt-1.5 text-[13px] leading-6 text-slate-500">
              Manage registered accounts, roles, and instructor verification.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#D9EAF7] bg-white px-3.5 py-2.5 text-[11px] font-semibold text-[#467EA9] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live User Directory
          </div>
        </div>

        {/* Banner */}
        <div className="relative mb-7 overflow-hidden rounded-[22px] bg-gradient-to-r from-[#1768AD] via-[#318CD0] to-[#78BFED] px-6 py-7 text-white shadow-[0_10px_30px_rgba(42,122,190,0.14)] sm:px-8">
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/20" />
          <div className="pointer-events-none absolute right-4 top-0 h-44 w-44 rounded-full border border-white/15" />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                <UsersRound size={13} />
                Account Administration
              </div>

              <h2 className="text-[21px] font-bold tracking-tight sm:text-[24px]">
                Every account. Fully organized.
              </h2>

              <p className="mt-2 max-w-xl text-[12px] leading-6 text-blue-50">
                Monitor users, inspect registered profiles, and
                manage access across the GradeSync platform.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/20 bg-white/15 px-4 py-3 backdrop-blur-sm">
              <UsersRound size={23} />

              <div>
                <p className="text-[23px] font-extrabold leading-none">
                  {stats.total}
                </p>

                <p className="mt-1 text-[10px] font-medium text-blue-50">
                  Registered Accounts
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle size={19} className="shrink-0 text-amber-600" />
            <p className="text-xs leading-5 text-amber-800">
              {error}
            </p>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />

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

        {/* Statistics */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.total}
            icon={UsersRound}
            accent="blue"
            loading={loading}
          />

          <StatCard
            title="Students"
            value={stats.students}
            icon={GraduationCap}
            accent="cyan"
            loading={loading}
          />

          <StatCard
            title="Instructors"
            value={stats.instructors}
            icon={UserCheck}
            accent="violet"
            loading={loading}
          />

          <StatCard
            title="Administrators"
            value={stats.admins}
            icon={ShieldCheck}
            accent="indigo"
            loading={loading}
          />
        </div>

        {/* Directory */}
        <div className="overflow-hidden rounded-2xl border border-[#DFEAF4] bg-white shadow-sm">

          {/* Toolbar */}
          <div className="border-b border-[#EDF2F7] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#173B5E]">
                  Registered Accounts
                </h2>

                <p className="mt-1 text-[11px] text-slate-400">
                  Search and manage every GradeSync user.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Search name, email, ID..."
                    className="h-10 w-full rounded-xl border border-[#DEEAF5] bg-[#FAFCFF] pl-9 pr-3 text-xs outline-none transition focus:border-[#83BCE7] sm:w-[220px]"
                  />
                </div>

                <div className="relative">
                  <select
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value as RoleFilter)
                      setPage(1)
                    }}
                    className="h-10 w-full appearance-none rounded-xl border border-[#DEEAF5] bg-[#FAFCFF] py-2 pl-3 pr-8 text-xs font-semibold text-[#537A99] outline-none sm:w-[135px]"
                  >
                    <option value="all">All Roles</option>
                    <option value="student">Students</option>
                    <option value="instructor">Instructors</option>
                    <option value="admin">Administrators</option>
                    <option value="other">Unassigned</option>
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                <div className="relative">
                  <select
                    value={accountFilter}
                    onChange={(event) => {
                      setAccountFilter(
                        event.target.value as AccountFilter
                      )
                      setPage(1)
                    }}
                    className="h-10 w-full appearance-none rounded-xl border border-[#DEEAF5] bg-[#FAFCFF] py-2 pl-3 pr-8 text-xs font-semibold text-[#537A99] outline-none sm:w-[145px]"
                  >
                    <option value="all">All Verification</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                <div className="relative">
                  <select
                    value={sortOption}
                    onChange={(event) => {
                      setSortOption(event.target.value as SortOption)
                      setPage(1)
                    }}
                    className="h-10 w-full appearance-none rounded-xl border border-[#DEEAF5] bg-[#FAFCFF] py-2 pl-3 pr-8 text-xs font-semibold text-[#537A99] outline-none sm:w-[135px]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name A–Z</option>
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
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <Loader2
                size={25}
                className="animate-spin text-[#3189C9]"
              />

              <p className="text-xs text-slate-400">
                Loading registered users...
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBF6FF] text-[#438FC8]">
                <UsersRound size={25} />
              </div>

              <h3 className="text-sm font-bold text-[#254D6E]">
                No users found
              </h3>

              <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="bg-[#F8FBFE]">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#89A3B8]">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Verification</th>
                      <th className="px-6 py-4">Registered</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EDF2F7]">
                    {paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="transition hover:bg-[#F8FBFF]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              key={`${user.id}-${user.photoURL}`}
                              name={user.name}
                              photoURL={user.photoURL}
                            />

                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate text-[12px] font-bold text-[#254D6E]">
                                {user.name}
                              </p>

                              <p className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400">
                                {user.email || 'No email provided'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <RoleBadge role={user.role} />
                        </td>

                        <td className="px-6 py-4">
                          <VerificationBadge user={user} />
                        </td>

                        <td className="px-6 py-4 text-[11px] text-slate-500">
                          {formatDate(user.createdAt)}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openUser(user)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAF5FF] px-3.5 py-2 text-[11px] font-bold text-[#287DBB] transition hover:bg-[#D9EDFC]"
                          >
                            View Profile
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
                    filteredUsers.length
                  )}{' '}
                  –{' '}
                  {Math.min(
                    currentPage * PAGE_SIZE,
                    filteredUsers.length
                  )}{' '}
                  of {filteredUsers.length} users
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

      {/* User Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[94dvh] w-full max-w-[850px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">

            <div className="flex shrink-0 items-center justify-between border-b border-[#E7EFF6] px-5 py-4 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6295BB]">
                  Account Directory
                </p>

                <h2 className="mt-1 text-lg font-extrabold text-[#173B5E]">
                  User Profile
                </h2>
              </div>

              <button
                type="button"
                onClick={closeUser}
                disabled={processing}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
                aria-label="Close profile"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#DCEBF7] bg-gradient-to-r from-[#F1F9FF] to-[#E5F3FE] p-5 sm:flex-row sm:items-center">
                <UserAvatar
                  key={`profile-${selectedUser.id}-${selectedUser.photoURL}`}
                  name={selectedUser.name}
                  photoURL={selectedUser.photoURL}
                  size="lg"
                />

                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-[#214C70]">
                    {selectedUser.name}
                  </h3>

                  <p className="mt-1 truncate text-xs text-[#6A91AF]">
                    {selectedUser.email || 'No email provided'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <RoleBadge role={selectedUser.role} />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound size={17} className="text-[#3788C6]" />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Personal Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField label="Full Name" value={selectedUser.name} />
                  <DetailField
                    label="Email Address"
                    value={selectedUser.email || 'Not provided'}
                  />
                  <DetailField
                    label="Student ID"
                    value={selectedUser.studentId || 'Not provided'}
                  />
                  <DetailField
                    label="Year & Section"
                    value={selectedUser.yearAndSection || 'Not provided'}
                  />
                  <DetailField
                    label="Firebase UID"
                    value={selectedUser.uid}
                  />
                  <DetailField
                    label="Account Role"
                    value={<RoleBadge role={selectedUser.role} />}
                  />
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={17} className="text-[#3788C6]" />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Account Verification
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Instructor Verification"
                    value={
                      <VerificationBadge user={selectedUser} />
                    }
                  />

                  <DetailField
                    label="Verification Status"
                    value={selectedUser.verificationStatus || 'None'}
                  />
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays size={17} className="text-[#3788C6]" />

                  <h3 className="text-sm font-bold text-[#214C70]">
                    Account History
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Date Registered"
                    value={formatDateTime(selectedUser.createdAt)}
                  />

                  <DetailField
                    label="Last Updated"
                    value={formatDateTime(selectedUser.updatedAt)}
                  />
                </div>
              </div>

              {selectedUser.role !== 'admin' && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <UserCog size={17} className="text-[#3788C6]" />

                    <h3 className="text-sm font-bold text-[#214C70]">
                      Role Management
                    </h3>
                  </div>

                  <div className="rounded-xl border border-[#DCEBF7] bg-[#F6FBFF] p-4">
                    <p className="text-xs leading-6 text-slate-500">
                      Change this user&apos;s access level within GradeSync.
                      Instructor accounts can manage student clearance
                      requests and digital signatures.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedUser.role !== 'instructor' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRoleAction('instructor')
                            setActionError('')
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#318FD0] to-[#176DB3] px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
                        >
                          <UserCheck size={16} />
                          Make Instructor
                        </button>
                      )}

                      {selectedUser.role !== 'student' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRoleAction('student')
                            setActionError('')
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#CFE3F3] bg-white px-4 py-2.5 text-xs font-bold text-[#387FAF] transition hover:bg-[#EAF5FF]"
                        >
                          <GraduationCap size={16} />
                          Make Student
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedUser.role === 'admin' && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <ShieldCheck
                    size={20}
                    className="shrink-0 text-blue-700"
                  />

                  <p className="text-xs leading-6 text-blue-800">
                    This account has administrator privileges.
                    Administrator roles cannot be modified from
                    this management page.
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end border-t border-[#E7EFF6] bg-[#FAFCFF] px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={closeUser}
                className="rounded-xl border border-[#DCE8F2] bg-white px-5 py-2.5 text-xs font-bold text-[#567D9B] transition hover:bg-[#F1F8FE]"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Confirmation Modal */}
      {selectedUser && roleAction && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#287FC1]">
              {roleAction === 'instructor' ? (
                <UserCheck size={24} />
              ) : (
                <GraduationCap size={24} />
              )}
            </div>

            <h2
              id="role-confirm-title"
              className="text-lg font-bold text-[#173B5E]"
            >
              Confirm Role Change
            </h2>

            <p className="mt-3 text-[13px] leading-6 text-slate-500">
              You are about to change{' '}
              <strong className="text-slate-700">
                {selectedUser.name}
              </strong>
              &apos;s account role to{' '}
              <strong className="text-[#287DB9]">
                {getRoleLabel(roleAction)}
              </strong>
              .
            </p>

            {roleAction === 'instructor' && (
              <div className="mt-4 rounded-xl border border-[#D8EAF8] bg-[#F1F9FF] p-3 text-xs leading-6 text-[#39749E]">
                This action will grant the user instructor access
                and mark their instructor account as verified.
              </div>
            )}

            {roleAction === 'student' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                This action will remove the user&apos;s instructor
                privileges and restore student access.
              </div>
            )}

            {actionError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
              >
                {actionError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  setRoleAction(null)
                  setActionError('')
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={handleRoleUpdate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#318FD0] to-[#176DB3] px-5 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Confirm Change
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
