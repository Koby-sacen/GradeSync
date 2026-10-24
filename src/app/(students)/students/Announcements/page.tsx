
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
  type User,
} from 'firebase/auth'

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

import {
  Megaphone,
  Search,
  CalendarDays,
  Clock3,
  Pin,
  AlertCircle,
  Info,
  ArrowRight,
  ChevronRight,
  X,
  RefreshCw,
  Inbox,
  GraduationCap,
  FileText,
  ShieldCheck,
  CalendarClock,
  Filter,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type AnnouncementCategory =
  | 'all'
  | 'clearance'
  | 'academic'
  | 'event'
  | 'general'

type AnnouncementPriority =
  | 'normal'
  | 'important'
  | 'urgent'

interface Announcement {
  id: string
  title: string
  content: string
  category: Exclude<AnnouncementCategory, 'all'>
  priority: AnnouncementPriority
  pinned: boolean
  publishedAt: unknown
  deadline: unknown
  authorName: string
}

type AnnouncementIcon = React.ComponentType<{
  size?: number
  className?: string
}>

// ============================================
// HELPERS
// ============================================

function getText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getDate(value: unknown): Date | null {
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
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    return new Date(value.seconds * 1000)
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

  return null
}

function formatDate(value: unknown): string {
  const date = getDate(value)

  if (!date) return 'Date not specified'

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: unknown): string {
  const date = getDate(value)

  if (!date) return 'Date unavailable'

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ============================================
// FIXED DEADLINE HELPER
//
// Current time is passed from state.
// No Date.now() or new Date() during render.
// ============================================

function getDeadlineText(
  value: unknown,
  currentTime: number | null
): string {
  const date = getDate(value)

  if (!date || currentTime === null) {
    return ''
  }

  const difference =
    date.getTime() - currentTime

  if (difference < 0) {
    return 'Deadline passed'
  }

  const days = Math.ceil(
    difference / (1000 * 60 * 60 * 24)
  )

  if (days === 0) {
    return 'Due today'
  }

  if (days === 1) {
    return 'Due tomorrow'
  }

  return `${days} days remaining`
}

function getCategory(
  value: unknown
): Exclude<AnnouncementCategory, 'all'> {
  const category = getText(value).toLowerCase()

  if (category === 'clearance') {
    return 'clearance'
  }

  if (category === 'academic') {
    return 'academic'
  }

  if (category === 'event') {
    return 'event'
  }

  return 'general'
}

function getPriority(
  value: unknown
): AnnouncementPriority {
  const priority = getText(value).toLowerCase()

  if (priority === 'urgent') {
    return 'urgent'
  }

  if (priority === 'important') {
    return 'important'
  }

  return 'normal'
}

function getCategoryIcon(
  category: AnnouncementCategory
): AnnouncementIcon {
  switch (category) {
    case 'clearance':
      return FileText

    case 'academic':
      return GraduationCap

    case 'event':
      return CalendarDays

    default:
      return Megaphone
  }
}

function getCategoryLabel(
  category: AnnouncementCategory
): string {
  switch (category) {
    case 'clearance':
      return 'Clearance'

    case 'academic':
      return 'Academic'

    case 'event':
      return 'Events'

    case 'general':
      return 'General'

    default:
      return 'All'
  }
}

function getCategoryStyle(
  category: AnnouncementCategory
): string {
  switch (category) {
    case 'clearance':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100'

    case 'academic':
      return 'bg-blue-50 text-blue-700 border-blue-100'

    case 'event':
      return 'bg-violet-50 text-violet-700 border-violet-100'

    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function getPriorityStyle(
  priority: AnnouncementPriority
): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-50 text-red-700 border-red-200'

    case 'important':
      return 'bg-amber-50 text-amber-700 border-amber-200'

    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function mapAnnouncement(
  id: string,
  data: DocumentData
): Announcement {
  return {
    id,

    title:
      getText(data.title) ||
      'Untitled Announcement',

    content:
      getText(data.content) ||
      getText(data.message) ||
      '',

    category: getCategory(data.category),

    priority: getPriority(data.priority),

    pinned: data.pinned === true,

    publishedAt:
      data.publishedAt ??
      data.createdAt ??
      null,

    deadline: data.deadline ?? null,

    authorName:
      getText(data.authorName) ||
      'GradeSync Administration',
  }
}

// ============================================
// ANNOUNCEMENTS PAGE
// ============================================

export default function Announcements() {
  const router = useRouter()

  const [user, setUser] =
    useState<User | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [loading, setLoading] =
    useState(true)

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([])

  const [search, setSearch] =
    useState('')

  const [category, setCategory] =
    useState<AnnouncementCategory>('all')

  const [
    selectedAnnouncement,
    setSelectedAnnouncement,
  ] = useState<Announcement | null>(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  // ============================================
  // FIXED CURRENT TIME STATE
  //
  // Initialize with null for stable SSR.
  // Update the time inside useEffect.
  // Refresh every 60 seconds.
  // ============================================

  const [currentTime, setCurrentTime] =
    useState<number | null>(null)

  useEffect(() => {
    const updateCurrentTime = () => {
      setCurrentTime(Date.now())
    }

    updateCurrentTime()

    const interval = window.setInterval(
      updateCurrentTime,
      60 * 1000
    )

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  // ============================================
  // AUTHENTICATION AND STUDENT ROLE
  // ============================================

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) return

        if (!currentUser) {
          setUser(null)
          setAuthLoading(false)

          router.replace('/login')
          return
        }

        try {
          const userSnapshot = await getDoc(
            doc(
              db,
              'users',
              currentUser.uid
            )
          )

          if (!active) return

          if (!userSnapshot.exists()) {
            router.replace('/login')
            return
          }

          const role = getText(
            userSnapshot.data().role
          )

          if (role !== 'student') {
            router.replace(
              role === 'instructor'
                ? '/instructor/home'
                : '/login'
            )

            return
          }

          setUser(currentUser)
        } catch (error) {
          console.error(
            '[Announcements] Role verification failed:',
            error
          )

          if (active) {
            setErrorMessage(
              'Unable to verify your student account.'
            )
          }
        } finally {
          if (active) {
            setAuthLoading(false)
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
  // LIVE FIRESTORE ANNOUNCEMENTS
  // ============================================

  useEffect(() => {
    if (!user) return

    const announcementsQuery = query(
      collection(
        db,
        'announcements'
      ),
      where(
        'published',
        '==',
        true
      )
    )

    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        // Date.now() is safe inside this
        // asynchronous Firestore callback.

        const now = Date.now()

        const records = snapshot.docs
          .map((document) =>
            mapAnnouncement(
              document.id,
              document.data()
            )
          )
          .filter((announcement) => {
            const publishedDate = getDate(
              announcement.publishedAt
            )

            return (
              !publishedDate ||
              publishedDate.getTime() <= now
            )
          })

        records.sort((a, b) => {
          if (a.pinned !== b.pinned) {
            return a.pinned ? -1 : 1
          }

          const aDate =
            getDate(
              a.publishedAt
            )?.getTime() ?? 0

          const bDate =
            getDate(
              b.publishedAt
            )?.getTime() ?? 0

          return bDate - aDate
        })

        setAnnouncements(records)
        setLoading(false)
        setErrorMessage('')
      },
      (error) => {
        console.error(
          '[Announcements] Firestore listener failed:',
          error
        )

        setLoading(false)

        setErrorMessage(
          'Unable to load announcements. Check your connection and Firestore permissions.'
        )
      }
    )

    return () => {
      unsubscribe()
    }
  }, [user])

  // ============================================
  // STATISTICS
  // ============================================

  const pinnedCount = useMemo(() => {
    return announcements.filter(
      (announcement) => announcement.pinned
    ).length
  }, [announcements])

  const urgentCount = useMemo(() => {
    return announcements.filter(
      (announcement) =>
        announcement.priority === 'urgent'
    ).length
  }, [announcements])

  // ============================================
  // FIXED UPCOMING DEADLINES
  //
  // Uses currentTime state instead of Date.now().
  // ============================================

  const upcomingDeadlines = useMemo(() => {
    if (currentTime === null) {
      return 0
    }

    return announcements.filter(
      (announcement) => {
        const deadline = getDate(
          announcement.deadline
        )

        return (
          deadline !== null &&
          deadline.getTime() >= currentTime
        )
      }
    ).length
  }, [
    announcements,
    currentTime,
  ])

  // ============================================
  // SEARCH AND CATEGORY FILTERS
  // ============================================

  const filteredAnnouncements = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase()

    return announcements.filter(
      (announcement) => {
        if (
          category !== 'all' &&
          announcement.category !== category
        ) {
          return false
        }

        if (!keyword) {
          return true
        }

        return [
          announcement.title,
          announcement.content,
          announcement.authorName,
          announcement.category,
        ].some((value) =>
          value
            .toLowerCase()
            .includes(keyword)
        )
      }
    )
  }, [
    announcements,
    category,
    search,
  ])

  // ============================================
  // FEATURED ANNOUNCEMENT
  // ============================================

  const featuredAnnouncement = useMemo(() => {
    return (
      announcements.find(
        (announcement) =>
          announcement.pinned
      ) ||
      announcements.find(
        (announcement) =>
          announcement.priority === 'urgent'
      ) ||
      announcements[0] ||
      null
    )
  }, [announcements])

  // ============================================
  // LOADING SCREEN
  // ============================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-emerald-700" />

          <p className="text-sm text-slate-500">
            Loading announcements...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <p className="text-sm text-slate-500">
          Redirecting...
        </p>
      </div>
    )
  }

  // ============================================
  // MAIN PAGE
  // ============================================

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ====================================
            PAGE HEADER
        ==================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-emerald-700" />

              <span className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
                Communications
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Announcements
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Stay updated on clearance deadlines,
              academic notices, and important announcements.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Official Announcements
          </div>
        </div>

        {/* ====================================
            ERROR MESSAGE
        ==================================== */}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />

            <p className="text-sm text-red-700">
              {errorMessage}
            </p>
          </div>
        )}

        {/* ====================================
            FEATURED ANNOUNCEMENT
        ==================================== */}

        {featuredAnnouncement ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-lg sm:p-8">

            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />

            <div className="relative z-10 max-w-3xl">

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <Megaphone className="h-3.5 w-3.5" />
                  Featured Announcement
                </span>

                {featuredAnnouncement.pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                    <Pin className="h-3.5 w-3.5" />
                    Pinned
                  </span>
                )}
              </div>

              <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
                {featuredAnnouncement.title}
              </h2>

              <p className="mt-3 line-clamp-3 text-sm leading-7 text-emerald-50/80">
                {featuredAnnouncement.content}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-emerald-100/80">

                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />

                  {formatDate(
                    featuredAnnouncement.publishedAt
                  )}
                </span>

                {getDate(
                  featuredAnnouncement.deadline
                ) && (
                  <span className="inline-flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />

                    Deadline:{' '}

                    {formatDate(
                      featuredAnnouncement.deadline
                    )}
                  </span>
                )}

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedAnnouncement(
                    featuredAnnouncement
                  )
                }
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"
              >
                Read Announcement

                <ArrowRight className="h-4 w-4" />
              </button>

            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-lg sm:p-8">

            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />

            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

              <div className="max-w-xl">

                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <Megaphone className="h-4 w-4" />
                  GradeSync Bulletin
                </div>

                <h2 className="mt-5 text-2xl font-bold sm:text-3xl">
                  Your campus updates, all in one place.
                </h2>

                <p className="mt-3 text-sm leading-7 text-emerald-50/80">
                  Important clearance deadlines, academic
                  reminders, and official notices will
                  appear here once they are published
                  by the administration.
                </p>

              </div>

              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 sm:h-32 sm:w-32">
                <Megaphone className="h-12 w-12 text-emerald-200 sm:h-14 sm:w-14" />
              </div>

            </div>
          </div>
        )}

        {/* ====================================
            STATISTICS
        ==================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          {[
            {
              label: 'Total Announcements',
              value: announcements.length,
              description: 'Published notices',
              icon: Megaphone,
              style: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Pinned Announcements',
              value: pinnedCount,
              description: 'Highlighted updates',
              icon: Pin,
              style: 'bg-violet-50 text-violet-700',
            },
            {
              label: 'Upcoming Deadlines',
              value: upcomingDeadlines,
              description: 'Important dates ahead',
              icon: CalendarClock,
              style: 'bg-amber-50 text-amber-700',
            },
          ].map((stat) => {
            const StatIcon = stat.icon

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.style}`}
                >
                  <StatIcon className="h-5 w-5" />
                </div>

                <p className="mt-4 text-3xl font-bold text-slate-900">
                  {loading || currentTime === null
                    ? '—'
                    : stat.value}
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {stat.label}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {stat.description}
                </p>

              </div>
            )
          })}

        </div>

        {/* ====================================
            ANNOUNCEMENT BOARD
        ==================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 p-5 sm:p-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Announcement Board
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Browse the latest published updates.
                </p>
              </div>

              <div className="relative w-full lg:w-72">

                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search announcements..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

              </div>

            </div>

            {/* CATEGORY FILTERS */}

            <div className="mt-5 flex flex-wrap items-center gap-2">

              <Filter className="mr-1 h-4 w-4 text-slate-400" />

              {([
                'all',
                'clearance',
                'academic',
                'event',
                'general',
              ] as AnnouncementCategory[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setCategory(item)
                    }
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                      category === item
                        ? 'bg-emerald-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {getCategoryLabel(item)}
                  </button>
                )
              )}

            </div>

          </div>

          {/* ==================================
              LOADING
          ================================== */}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">

              <RefreshCw className="h-8 w-8 animate-spin text-emerald-700" />

              <p className="mt-4 text-sm text-slate-500">
                Loading announcements...
              </p>

            </div>
          ) : filteredAnnouncements.length === 0 ? (

            /* ==================================
                EMPTY STATE
            ================================== */

            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">

              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50">

                {search.trim() ? (
                  <Search className="h-9 w-9 text-emerald-700" />
                ) : (
                  <Inbox className="h-9 w-9 text-emerald-700" />
                )}

              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                {search.trim() || category !== 'all'
                  ? 'No matching announcements'
                  : 'No announcements published yet'}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                {search.trim() || category !== 'all'
                  ? 'Try a different search term or category.'
                  : 'There are no official announcements available right now. Check back when the administration starts publishing updates.'}
              </p>

              {(search.trim() || category !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setCategory('all')
                  }}
                  className="mt-5 rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                >
                  Clear Filters
                </button>
              )}

            </div>
          ) : (

            /* ==================================
                ANNOUNCEMENT LIST
            ================================== */

            <div className="divide-y divide-slate-100">

              {filteredAnnouncements.map(
                (announcement) => {
                  const CategoryIcon = getCategoryIcon(
                    announcement.category
                  )

                  const deadlineText = getDeadlineText(
                    announcement.deadline,
                    currentTime
                  )

                  return (
                    <div
                      key={announcement.id}
                      className="p-5 transition hover:bg-slate-50 sm:p-6"
                    >

                      <div className="flex items-start gap-4">

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                          <CategoryIcon className="h-5 w-5 text-emerald-700" />
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                              {announcement.title}
                            </h3>

                            {announcement.pinned && (
                              <Pin className="h-4 w-4 text-emerald-700" />
                            )}

                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getCategoryStyle(
                                announcement.category
                              )}`}
                            >
                              {getCategoryLabel(
                                announcement.category
                              )}
                            </span>

                            {announcement.priority !== 'normal' && (
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getPriorityStyle(
                                  announcement.priority
                                )}`}
                              >
                                {announcement.priority === 'urgent'
                                  ? 'Urgent'
                                  : 'Important'}
                              </span>
                            )}

                          </div>

                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
                            {announcement.content}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">

                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5" />

                              {formatDate(
                                announcement.publishedAt
                              )}
                            </span>

                            {deadlineText && (
                              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">

                                <Clock3 className="h-3.5 w-3.5" />

                                {deadlineText}

                              </span>
                            )}

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAnnouncement(
                                announcement
                              )
                            }
                            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-800 transition hover:text-emerald-600"
                          >
                            Read More

                            <ChevronRight className="h-4 w-4" />
                          </button>

                        </div>

                      </div>

                    </div>
                  )
                }
              )}

            </div>
          )}

        </div>

        {/* ====================================
            INFORMATION FOOTER
        ==================================== */}

        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
              <Info className="h-5 w-5 text-emerald-700" />
            </div>

            <div>

              <h3 className="text-sm font-bold text-emerald-950">
                Never miss an important deadline
              </h3>

              <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                Check this page regularly for official
                clearance deadlines and academic notices.
                Announcements are managed by authorized
                university personnel.
              </p>

            </div>

          </div>

          <Link
            href="/students/notifications"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
          >
            Notifications

            <ArrowRight className="h-4 w-4" />
          </Link>

        </div>

      </div>

      {/* ============================================
          ANNOUNCEMENT DETAILS MODAL
      ============================================ */}

      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedAnnouncement(null)
            }
          }}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >

            {/* MODAL HEADER */}

            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">

              <div>

                <div className="mb-2 flex flex-wrap gap-2">

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getCategoryStyle(
                      selectedAnnouncement.category
                    )}`}
                  >
                    {getCategoryLabel(
                      selectedAnnouncement.category
                    )}
                  </span>

                  {selectedAnnouncement.priority !== 'normal' && (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getPriorityStyle(
                        selectedAnnouncement.priority
                      )}`}
                    >
                      {selectedAnnouncement.priority}
                    </span>
                  )}

                </div>

                <h2
                  id="announcement-title"
                  className="text-lg font-bold text-slate-900 sm:text-xl"
                >
                  {selectedAnnouncement.title}
                </h2>

                <p className="mt-2 text-xs text-slate-400">
                  Published:{' '}

                  {formatDateTime(
                    selectedAnnouncement.publishedAt
                  )}
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedAnnouncement(null)
                }
                aria-label="Close announcement"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* MODAL CONTENT */}

            <div className="space-y-5 p-5 sm:p-6">

              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {selectedAnnouncement.content}
              </p>

              {getDate(
                selectedAnnouncement.deadline
              ) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                  <div className="flex items-start gap-3">

                    <CalendarClock className="h-5 w-5 shrink-0 text-amber-700" />

                    <div>

                      <p className="text-sm font-bold text-amber-900">
                        Important Deadline
                      </p>

                      <p className="mt-1 text-sm text-amber-800">
                        {formatDate(
                          selectedAnnouncement.deadline
                        )}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        {getDeadlineText(
                          selectedAnnouncement.deadline,
                          currentTime
                        )}
                      </p>

                    </div>

                  </div>

                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-4">

                <p className="text-xs text-slate-400">
                  Published By
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selectedAnnouncement.authorName}
                </p>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4 sm:px-6">

              <button
                type="button"
                onClick={() =>
                  setSelectedAnnouncement(null)
                }
                className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
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
