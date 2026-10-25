
'use client'

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import {
  Megaphone,
  Search,
  Filter,
  CalendarDays,
  Clock3,
  Pin,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Inbox,
  RefreshCw,
  UserRound,
  BellRing,
  FileText,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

import {
  collection,
  onSnapshot,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

// Types

type AnnouncementFilter =
  | 'all'
  | 'important'
  | 'recent'

type AnnouncementCategory =
  | 'general'
  | 'academic'
  | 'clearance'
  | 'system'
  | 'event'

interface InstructorAnnouncement {
  id: string
  title: string
  message: string
  category: AnnouncementCategory
  priority: string
  author: string
  audience: string
  pinned: boolean
  important: boolean
  createdAt: Date | null
  expiresAt: Date | null
}

// Helpers

function getText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const date = (value as Timestamp).toDate()

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  if (
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  return null
}

function getCategory(
  value: unknown
): AnnouncementCategory {
  const category = getText(value).toLowerCase()

  if (
    category.includes('academic') ||
    category.includes('class') ||
    category.includes('grade')
  ) {
    return 'academic'
  }

  if (
    category.includes('clearance') ||
    category.includes('document')
  ) {
    return 'clearance'
  }

  if (
    category.includes('system') ||
    category.includes('maintenance') ||
    category.includes('security')
  ) {
    return 'system'
  }

  if (
    category.includes('event') ||
    category.includes('activity')
  ) {
    return 'event'
  }

  return 'general'
}

function getCategoryLabel(
  category: AnnouncementCategory
): string {
  const labels: Record<
    AnnouncementCategory,
    string
  > = {
    general: 'General',
    academic: 'Academic',
    clearance: 'Clearance',
    system: 'System',
    event: 'Event',
  }

  return labels[category]
}

function getCategoryStyle(
  category: AnnouncementCategory
): string {
  switch (category) {
    case 'academic':
      return 'bg-violet-50 text-violet-700 ring-violet-100'

    case 'clearance':
      return 'bg-blue-50 text-blue-700 ring-blue-100'

    case 'system':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-100'

    case 'event':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'

    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

function getCategoryIcon(
  category: AnnouncementCategory
) {
  switch (category) {
    case 'academic':
      return FileText

    case 'clearance':
      return ShieldCheck

    case 'system':
      return Info

    case 'event':
      return CalendarDays

    default:
      return Megaphone
  }
}

function formatDate(
  date: Date | null
): string {
  if (!date) return 'Date unavailable'

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFullDate(
  date: Date | null
): string {
  if (!date) return 'Date unavailable'

  return date.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeDate(
  date: Date | null,
  currentTime: number
): string {
  if (!date) return 'Date unavailable'

  if (currentTime <= 0) {
    return formatDate(date)
  }

  const difference = Math.max(
    0,
    currentTime - date.getTime()
  )

  const minutes = Math.floor(
    difference / 60000
  )

  const hours = Math.floor(
    difference / 3600000
  )

  const days = Math.floor(
    difference / 86400000
  )

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return formatDate(date)
}

function normalizeAnnouncement(
  id: string,
  data: DocumentData
): InstructorAnnouncement {
  const priority =
    getText(data.priority) ||
    'normal'

  const important =
    data.important === true ||
    data.isImportant === true ||
    [
      'high',
      'urgent',
      'critical',
      'important',
    ].includes(priority.toLowerCase())

  return {
    id,

    title:
      getText(data.title) ||
      getText(data.subject) ||
      'GradeSync Announcement',

    message:
      getText(data.message) ||
      getText(data.content) ||
      getText(data.description) ||
      '',

    category: getCategory(
      data.category ?? data.type
    ),

    priority,

    author:
      getText(data.authorName) ||
      getText(data.createdByName) ||
      getText(data.senderName) ||
      'GradeSync Administration',

    audience:
      getText(data.audience) ||
      getText(data.targetAudience) ||
      'all',

    pinned:
      data.pinned === true ||
      data.isPinned === true,

    important,

    createdAt: getDate(
      data.publishedAt ??
        data.createdAt ??
        data.timestamp
    ),

    expiresAt: getDate(
      data.expiresAt ??
        data.expiryDate
    ),
  }
}

function isForInstructor(
  data: DocumentData
): boolean {
  const audienceValue =
    data.audience ??
    data.targetAudience ??
    data.recipients ??
    'all'

  const allowed = [
    'all',
    'everyone',
    'both',
    'instructor',
    'instructors',
    'faculty',
    'teacher',
    'teachers',
    'staff',
  ]

  if (Array.isArray(audienceValue)) {
    return audienceValue.some((item) =>
      allowed.includes(
        getText(item).toLowerCase()
      )
    )
  }

  const audience =
    getText(audienceValue).toLowerCase()

  if (!audience) return true

  return allowed.includes(audience)
}

function isPublished(
  data: DocumentData
): boolean {
  if (
    data.published === false ||
    data.isPublished === false
  ) {
    return false
  }

  const status =
    getText(data.status).toLowerCase()

  if (
    status === 'draft' ||
    status === 'archived' ||
    status === 'unpublished' ||
    status === 'scheduled'
  ) {
    return false
  }

  return true
}

// Instructor Announcements Page

export default function Announcements() {
  const router = useRouter()

  const [user, setUser] =
    useState<User | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [announcements, setAnnouncements] =
    useState<InstructorAnnouncement[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<AnnouncementFilter>('all')

  const [
    selectedAnnouncementId,
    setSelectedAnnouncementId,
  ] = useState<string | null>(null)

  const [currentTime, setCurrentTime] =
    useState(0)

  // Authentication

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setAuthLoading(false)

        if (!currentUser) {
          router.replace('/login')
        }
      }
    )

    return () => unsubscribe()
  }, [router])

  // Current time

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now())
    }

    updateTime()

    const interval = window.setInterval(
      updateTime,
      60000
    )

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  // Real-time announcements

  useEffect(() => {
    if (authLoading || !user) return

    const unsubscribe = onSnapshot(
      collection(db, 'announcements'),

      (snapshot) => {
        const now = Date.now()

        const results = snapshot.docs
          .filter((document) => {
            const data = document.data()

            if (!isForInstructor(data)) {
              return false
            }

            if (!isPublished(data)) {
              return false
            }

            const expiresAt = getDate(
              data.expiresAt ??
                data.expiryDate
            )

            if (
              expiresAt &&
              expiresAt.getTime() < now
            ) {
              return false
            }

            const publishedAt = getDate(
              data.publishedAt
            )

            if (
              publishedAt &&
              publishedAt.getTime() > now
            ) {
              return false
            }

            return true
          })
          .map((document) =>
            normalizeAnnouncement(
              document.id,
              document.data()
            )
          )

        results.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1
          }

          const aTime =
            a.createdAt?.getTime() ?? 0

          const bTime =
            b.createdAt?.getTime() ?? 0

          return bTime - aTime
        })

        setAnnouncements(results)
        setLoading(false)
        setError(null)
      },

      (firestoreError) => {
        console.error(
          '[Instructor Announcements] Listener error:',
          firestoreError
        )

        setError(
          firestoreError.code ===
            'permission-denied'
            ? 'You do not have permission to view announcements. Please check your Firestore security rules.'
            : 'Unable to load announcements. Please check your connection and try again.'
        )

        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, authLoading])

  // Statistics

  const totalCount = announcements.length

  const importantCount =
    announcements.filter(
      (announcement) =>
        announcement.important
    ).length

  const pinnedCount =
    announcements.filter(
      (announcement) =>
        announcement.pinned
    ).length

  const sevenDaysAgo =
    currentTime -
    7 * 24 * 60 * 60 * 1000

  const recentCount =
    announcements.filter(
      (announcement) =>
        announcement.createdAt !== null &&
        announcement.createdAt.getTime() >=
          sevenDaysAgo
    ).length

  // Filter announcements

  const filteredAnnouncements = useMemo(
    () => {
      const keyword =
        search.trim().toLowerCase()

      const recentThreshold =
        currentTime -
        7 * 24 * 60 * 60 * 1000

      return announcements.filter(
        (announcement) => {
          if (
            filter === 'important' &&
            !announcement.important
          ) {
            return false
          }

          if (
            filter === 'recent' &&
            (
              !announcement.createdAt ||
              announcement.createdAt.getTime() <
                recentThreshold
            )
          ) {
            return false
          }

          if (!keyword) return true

          const searchableText = [
            announcement.title,
            announcement.message,
            announcement.author,
            announcement.priority,
            getCategoryLabel(
              announcement.category
            ),
          ]
            .join(' ')
            .toLowerCase()

          return searchableText.includes(
            keyword
          )
        }
      )
    },
    [
      announcements,
      search,
      filter,
      currentTime,
    ]
  )

  const selectedAnnouncement =
    announcements.find(
      (announcement) =>
        announcement.id ===
        selectedAnnouncementId
    ) ?? null

  // Modal handlers

  const handleOpenAnnouncement = (
    announcement: InstructorAnnouncement
  ) => {
    setSelectedAnnouncementId(
      announcement.id
    )
  }

  const handleCloseAnnouncement = () => {
    setSelectedAnnouncementId(null)
  }

  // Escape key support

  useEffect(() => {
    if (!selectedAnnouncementId) return

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setSelectedAnnouncementId(null)
      }
    }

    document.addEventListener(
      'keydown',
      handleEscape
    )

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      )
    }
  }, [selectedAnnouncementId])

  // UI

  return (
    <div className="min-h-screen bg-slate-50/80 px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-7xl space-y-7">

        {/* Page Header */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                <Megaphone size={13} />
                Communications
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Announcements
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Stay informed about official updates,
              important notices, academic activities,
              and GradeSync announcements.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-blue-100 bg-white px-4 py-3 text-xs font-semibold text-blue-700 shadow-sm">
            <RefreshCw size={15} />
            Live announcements
          </div>
        </div>

        {/* Statistics */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          {/* Total */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Announcements
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {totalCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Available announcements
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Megaphone size={21} />
              </div>
            </div>
          </div>

          {/* Important */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Important
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-amber-600">
                  {importantCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Priority announcements
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertCircle size={21} />
              </div>
            </div>
          </div>

          {/* Pinned */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pinned
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {pinnedCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Highlighted notices
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Pin size={21} />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <p className="flex-1">
              {error}
            </p>

            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Announcements Board */}

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

          {/* Board Header */}

          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Inbox
                    size={19}
                    className="text-blue-700"
                  />

                  <h2 className="text-base font-bold text-slate-900">
                    Announcement Board
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {filteredAnnouncements.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Official notices and updates for instructors
                </p>
              </div>

              {/* Search */}

              <div className="relative w-full xl:max-w-xs">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search announcements..."
                  aria-label="Search announcements"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Filters */}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Filter
                size={15}
                className="mr-1 text-slate-400"
              />

              {(
                [
                  {
                    value: 'all',
                    label: 'All',
                    count: totalCount,
                  },
                  {
                    value: 'important',
                    label: 'Important',
                    count: importantCount,
                  },
                  {
                    value: 'recent',
                    label: 'Recent',
                    count: recentCount,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setFilter(item.value)
                  }
                  aria-pressed={
                    filter === item.value
                  }
                  className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                    filter === item.value
                      ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {item.label}

                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                      filter === item.value
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}

          {loading || authLoading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <Loader2
                  size={25}
                  className="animate-spin text-blue-600"
                />
              </div>

              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  Loading announcements
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Please wait while we update the announcement board.
                </p>
              </div>
            </div>
          ) : filteredAnnouncements.length === 0 ? (

            /* Empty State */

            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
                {search ? (
                  <Search
                    size={32}
                    className="text-blue-400"
                  />
                ) : (
                  <Megaphone
                    size={32}
                    className="text-blue-400"
                  />
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                {search
                  ? 'No matching announcements'
                  : filter === 'important'
                    ? 'No important announcements'
                    : filter === 'recent'
                      ? 'No recent announcements'
                      : 'No announcements yet'}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search
                  ? 'Try another keyword or clear your search to see more announcements.'
                  : filter === 'important'
                    ? 'Important announcements will appear here when they are published.'
                    : filter === 'recent'
                      ? 'There are no announcements published within the last seven days.'
                      : 'Official announcements and important notices for instructors will appear here once published.'}
              </p>

              {(search || filter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setFilter('all')
                  }}
                  className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  View all announcements
                </button>
              )}
            </div>
          ) : (

            /* Announcement List */

            <div className="divide-y divide-slate-100">
              {filteredAnnouncements.map(
                (announcement) => {
                  const Icon = getCategoryIcon(
                    announcement.category
                  )

                  const categoryStyle =
                    getCategoryStyle(
                      announcement.category
                    )

                  return (
                    <div
                      key={announcement.id}
                      className={`group relative transition-colors duration-200 ${
                        announcement.pinned
                          ? 'bg-blue-50/40 hover:bg-blue-50/70'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {announcement.pinned && (
                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-blue-600" />
                      )}

                      <div className="flex gap-3 px-4 py-5 sm:gap-4 sm:px-6">

                        {/* Category Icon */}

                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${categoryStyle}`}
                        >
                          <Icon size={20} />
                        </div>

                        {/* Content */}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold leading-6 text-slate-900">
                                {announcement.title}
                              </h3>

                              {announcement.pinned && (
                                <Pin
                                  size={14}
                                  className="text-blue-600"
                                />
                              )}
                            </div>

                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                              <Clock3 size={13} />

                              {formatRelativeDate(
                                announcement.createdAt,
                                currentTime
                              )}
                            </span>
                          </div>

                          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                            {announcement.message}
                          </p>

                          {/* Badges */}

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold ring-1 ${categoryStyle}`}
                            >
                              {getCategoryLabel(
                                announcement.category
                              )}
                            </span>

                            {announcement.important && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">
                                <AlertCircle size={11} />
                                Important
                              </span>
                            )}

                            {announcement.pinned && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">
                                <Pin size={11} />
                                Pinned
                              </span>
                            )}

                            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-400">
                              <UserRound
                                size={12}
                                className="shrink-0"
                              />

                              <span className="truncate">
                                {announcement.author}
                              </span>
                            </span>
                          </div>

                          {/* Actions */}

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenAnnouncement(
                                  announcement
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                            >
                              <Info size={14} />
                              View announcement
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}

          {/* Board Footer */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {filteredAnnouncements.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700">
                {totalCount}
              </span>{' '}
              announcements
            </p>

            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <CheckCircle2
                size={14}
                className="text-blue-600"
              />
              Real-time announcement board
            </span>
          </div>
        </div>

        {/* Information */}

        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
            <BellRing size={19} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-blue-950">
              Important reminders
            </h3>

            <p className="mt-1 text-xs leading-6 text-blue-900/70 sm:text-sm">
              Check the announcement board regularly for
              official notices, academic schedules,
              clearance-related updates, and other
              important information from GradeSync
              administrators.
            </p>
          </div>
        </div>
      </div>

      {/* Announcement Details Modal */}

      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              handleCloseAnnouncement()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-detail-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >

            {/* Modal Header */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <Megaphone size={21} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Official Announcement
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    GradeSync Instructor Portal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseAnnouncement}
                aria-label="Close announcement"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Body */}

            <div className="max-h-[65vh] overflow-y-auto px-5 py-6 sm:px-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ${getCategoryStyle(
                    selectedAnnouncement.category
                  )}`}
                >
                  {getCategoryLabel(
                    selectedAnnouncement.category
                  )}
                </span>

                {selectedAnnouncement.important && (
                  <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                    Important
                  </span>
                )}

                {selectedAnnouncement.pinned && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    <Pin size={12} />
                    Pinned
                  </span>
                )}
              </div>

              <h2
                id="announcement-detail-title"
                className="text-xl font-bold leading-8 text-slate-900"
              >
                {selectedAnnouncement.title}
              </h2>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound size={14} />
                  {selectedAnnouncement.author}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {formatFullDate(
                    selectedAnnouncement.createdAt
                  )}
                </span>
              </div>

              <div className="my-5 border-t border-slate-100" />

              <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                {selectedAnnouncement.message ||
                  'No additional information provided.'}
              </div>

              {selectedAnnouncement.expiresAt && (
                <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                  <Clock3
                    size={15}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    This announcement is available until{' '}
                    {formatFullDate(
                      selectedAnnouncement.expiresAt
                    )}.
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={handleCloseAnnouncement}
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
