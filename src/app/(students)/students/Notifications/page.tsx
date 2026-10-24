
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
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  FileText,
  FileCheck2,
  FilePenLine,
  Info,
  Megaphone,
  MessageSquare,
  Search,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Inbox,
  X,
  Filter,
} from 'lucide-react'

// Types

type NotificationFilter = 'all' | 'unread' | 'read'

type NotificationCategory =
  | 'clearance'
  | 'signature'
  | 'announcement'
  | 'account'
  | 'message'
  | 'general'

interface StudentNotification {
  id: string
  title: string
  message: string
  type: string
  category: NotificationCategory
  read: boolean
  createdAt: unknown
  link: string
  senderName: string
}

type NotificationIcon = React.ComponentType<{
  size?: number
  className?: string
}>

type NotificationFeedState = {
  ownerUid: string | null
  records: StudentNotification[]
  loading: boolean
  error: string
}

// Helpers

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Timestamp) {
    return value.toDate()
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
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
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function formatDate(value: unknown): string {
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

function formatRelativeTime(value: unknown): string {
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

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getCategory(type: string): NotificationCategory {
  const normalized = type.toLowerCase()

  if (
    normalized.includes('signature') ||
    normalized.includes('signed')
  ) {
    return 'signature'
  }

  if (
    normalized.includes('clearance') ||
    normalized.includes('document') ||
    normalized.includes('grade') ||
    normalized.includes('review')
  ) {
    return 'clearance'
  }

  if (
    normalized.includes('announcement') ||
    normalized.includes('notice')
  ) {
    return 'announcement'
  }

  if (
    normalized.includes('account') ||
    normalized.includes('security') ||
    normalized.includes('profile')
  ) {
    return 'account'
  }

  if (
    normalized.includes('message') ||
    normalized.includes('feedback') ||
    normalized.includes('support')
  ) {
    return 'message'
  }

  return 'general'
}

function getNotificationIcon(
  category: NotificationCategory,
  type: string
): NotificationIcon {
  if (category === 'signature') return FileCheck2

  if (category === 'clearance') {
    if (type.includes('approved')) return CheckCircle2
    if (type.includes('updated')) return FilePenLine
    return FileText
  }

  if (category === 'announcement') return Megaphone
  if (category === 'account') return ShieldCheck
  if (category === 'message') return MessageSquare

  return Bell
}

function getCategoryStyle(
  category: NotificationCategory
): {
  icon: string
  badge: string
  label: string
} {
  switch (category) {
    case 'signature':
      return {
        icon: 'bg-violet-50 text-violet-700',
        badge: 'bg-violet-50 text-violet-700 border-violet-100',
        label: 'Signature',
      }

    case 'clearance':
      return {
        icon: 'bg-emerald-50 text-emerald-700',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        label: 'Clearance',
      }

    case 'announcement':
      return {
        icon: 'bg-blue-50 text-blue-700',
        badge: 'bg-blue-50 text-blue-700 border-blue-100',
        label: 'Announcement',
      }

    case 'account':
      return {
        icon: 'bg-amber-50 text-amber-700',
        badge: 'bg-amber-50 text-amber-700 border-amber-100',
        label: 'Account',
      }

    case 'message':
      return {
        icon: 'bg-cyan-50 text-cyan-700',
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-100',
        label: 'Message',
      }

    default:
      return {
        icon: 'bg-slate-100 text-slate-600',
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        label: 'General',
      }
  }
}

function safeNotificationLink(value: unknown): string {
  const link = getText(value)

  if (
    link.startsWith('/students/') &&
    !link.startsWith('//') &&
    !link.includes('\\')
  ) {
    return link
  }

  return ''
}

function mapNotification(
  id: string,
  data: DocumentData
): StudentNotification {
  const type =
    getText(data.type) ||
    getText(data.action) ||
    'general'

  return {
    id,
    title:
      getText(data.title) ||
      getText(data.subject) ||
      'GradeSync Notification',
    message:
      getText(data.message) ||
      getText(data.description) ||
      'You have a new notification.',
    type: type.toLowerCase(),
    category: getCategory(type),
    read: data.read === true || data.isRead === true,
    createdAt: data.createdAt ?? data.timestamp ?? null,
    link: safeNotificationLink(data.link || data.href),
    senderName:
      getText(data.senderName) ||
      getText(data.actorName) ||
      'GradeSync',
  }
}

// Notifications page

export default function Notifications() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [notificationFeed, setNotificationFeed] =
    useState<NotificationFeedState>({
      ownerUid: null,
      records: [],
      loading: true,
      error: '',
    })

  const [filter, setFilter] =
    useState<NotificationFilter>('all')
  const [search, setSearch] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [processingIds, setProcessingIds] =
    useState<string[]>([])
  const [markingAll, setMarkingAll] = useState(false)
  const [selectedNotification, setSelectedNotification] =
    useState<StudentNotification | null>(null)

  const notifications =
    notificationFeed.ownerUid === user?.uid
      ? notificationFeed.records
      : []

  const notificationsLoading =
    notificationFeed.ownerUid !== user?.uid ||
    notificationFeed.loading

  const displayedError =
    errorMessage ||
    (notificationFeed.ownerUid === user?.uid
      ? notificationFeed.error
      : '')

  // Authentication and role verification

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
            doc(db, 'users', currentUser.uid)
          )

          if (!active) return

          if (!userSnapshot.exists()) {
            setUser(null)
            setAuthLoading(false)
            router.replace('/login')
            return
          }

          const role = getText(userSnapshot.data().role)

          if (role !== 'student') {
            setUser(null)
            setAuthLoading(false)

            if (role === 'instructor') {
              router.replace('/instructor/home')
            } else {
              router.replace('/login')
            }

            return
          }

          setUser(currentUser)
          setErrorMessage('')
        } catch (error) {
          console.error(
            '[Notifications] Authentication check failed:',
            error
          )

          if (!active) return

          setErrorMessage(
            'Unable to verify your account. Please try again.'
          )
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

  // Real-time Firestore notifications without synchronous effect state updates

  useEffect(() => {
    if (!user) return

    const recipientUid = user.uid

    const notificationsQuery = query(
      collection(db, 'Notifications'),
      where('recipientUid', '==', recipientUid)
    )

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const records = snapshot.docs.map((document) =>
          mapNotification(document.id, document.data())
        )

        records.sort((a, b) => {
          const aTime =
            getDate(a.createdAt)?.getTime() ?? 0
          const bTime =
            getDate(b.createdAt)?.getTime() ?? 0

          return bTime - aTime
        })

        setNotificationFeed({
          ownerUid: recipientUid,
          records,
          loading: false,
          error: '',
        })
      },
      (error) => {
        console.error(
          '[Notifications] Firestore listener failed:',
          error
        )

        setNotificationFeed({
          ownerUid: recipientUid,
          records: [],
          loading: false,
          error:
            error.code === 'permission-denied'
              ? 'Permission denied. Verify your published Firestore rules and account permissions.'
              : 'Unable to load notifications. Please check your internet connection.',
        })
      }
    )

    return () => unsubscribe()
  }, [user])

  // Notification statistics and filters

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !notification.read
      ).length,
    [notifications]
  )

  const readCount = notifications.length - unreadCount

  const filteredNotifications = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return notifications.filter((notification) => {
      if (filter === 'unread' && notification.read) {
        return false
      }

      if (filter === 'read' && !notification.read) {
        return false
      }

      if (!keyword) return true

      return [
        notification.title,
        notification.message,
        notification.senderName,
        notification.type,
      ].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    })
  }, [notifications, filter, search])

  // Mark a single notification as read

  const markAsRead = useCallback(
    async (notification: StudentNotification) => {
      if (
        !user ||
        notification.read ||
        processingIds.includes(notification.id)
      ) {
        return
      }

      setProcessingIds((previous) => [
        ...previous,
        notification.id,
      ])

      setErrorMessage('')

      try {
        await updateDoc(
          doc(db, 'Notifications', notification.id),
          {
            read: true,
            isRead: true,
            readAt: serverTimestamp(),
          }
        )
      } catch (error) {
        console.error(
          '[Notifications] Failed to mark as read:',
          error
        )

        setErrorMessage(
          'Unable to mark the notification as read.'
        )

        throw error
      } finally {
        setProcessingIds((previous) =>
          previous.filter(
            (id) => id !== notification.id
          )
        )
      }
    },
    [user, processingIds]
  )

  // Open notification details

  const handleOpenNotification = async (
    notification: StudentNotification
  ) => {
    setSelectedNotification(notification)

    if (!notification.read) {
      try {
        await markAsRead(notification)
      } catch {
        // Keep details visible if the update fails.
      }
    }
  }

  // Mark all unread notifications as read

  const handleMarkAllAsRead = async () => {
    if (!user || markingAll || unreadCount === 0) {
      return
    }

    setMarkingAll(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const unreadNotifications = notifications.filter(
        (notification) => !notification.read
      )

      const chunkSize = 200

      for (
        let index = 0;
        index < unreadNotifications.length;
        index += chunkSize
      ) {
        const chunk = unreadNotifications.slice(
          index,
          index + chunkSize
        )

        const batch = writeBatch(db)

        for (const notification of chunk) {
          batch.update(
            doc(db, 'Notifications', notification.id),
            {
              read: true,
              isRead: true,
              readAt: serverTimestamp(),
            }
          )
        }

        await batch.commit()
      }

      setSuccessMessage(
        'All notifications have been marked as read.'
      )
    } catch (error) {
      console.error(
        '[Notifications] Mark all as read failed:',
        error
      )

      setErrorMessage(
        'Some notifications could not be updated. Please try again.'
      )
    } finally {
      setMarkingAll(false)
    }
  }

  // Close notification details

  const handleCloseDetails = () => {
    setSelectedNotification(null)
  }

  // Authentication loading screen

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-emerald-700" />
          <p className="text-sm font-medium text-slate-500">
            Loading notifications...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] p-6">
        <p className="text-sm text-slate-500">
          Redirecting to sign in...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Page header */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-emerald-700" />
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
                Communications
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Notifications
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Stay informed about your clearance,
              instructor updates, and account activity.
            </p>
          </div>

          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={
              unreadCount === 0 ||
              markingAll ||
              notificationsLoading
            }
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}

            {markingAll
              ? 'Updating...'
              : 'Mark All as Read'}
          </button>
        </div>

        {/* Success message */}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />

            <p className="flex-1 text-sm font-medium text-emerald-800">
              {successMessage}
            </p>

            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4 text-emerald-700" />
            </button>
          </div>
        )}

        {/* Error message */}

        {displayedError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />

            <p className="flex-1 text-sm font-medium text-red-700">
              {displayedError}
            </p>

            <button
              type="button"
              onClick={() => setErrorMessage('')}
              aria-label="Dismiss error message"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        )}

        {/* Notification statistics */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <Bell className="h-5 w-5 text-blue-700" />
              </div>

              <span className="text-xs font-medium text-slate-400">
                All time
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {notificationsLoading
                ? '—'
                : notifications.length}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Total Notifications
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Notifications received
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                <BellRing className="h-5 w-5 text-amber-600" />
              </div>

              {unreadCount > 0 && (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              )}
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {notificationsLoading
                ? '—'
                : unreadCount}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Unread Notifications
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Updates waiting for you
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCheck className="h-5 w-5 text-emerald-700" />
              </div>

              <Check className="h-4 w-4 text-emerald-600" />
            </div>

            <p className="mt-4 text-3xl font-bold text-slate-900">
              {notificationsLoading
                ? '—'
                : readCount}
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Read Notifications
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Updates already viewed
            </p>
          </div>
        </div>

        {/* Notification inbox */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Notification Inbox
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Your latest GradeSync updates appear here.
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
                  placeholder="Search notifications..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            {/* Filters */}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Filter className="mr-1 h-4 w-4 text-slate-400" />

              {([
                {
                  value: 'all',
                  label: 'All',
                  count: notifications.length,
                },
                {
                  value: 'unread',
                  label: 'Unread',
                  count: unreadCount,
                },
                {
                  value: 'read',
                  label: 'Read',
                  count: readCount,
                },
              ] as const).map((item) => {
                const active = filter === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-emerald-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}

                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-slate-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Loading, empty state, and notification list */}

          {notificationsLoading ? (
            <div className="flex flex-col items-center justify-center px-6 py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-700" />

              <p className="mt-4 text-sm font-medium text-slate-500">
                Fetching your notifications...
              </p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50">
                {search.trim() ? (
                  <Search className="h-9 w-9 text-emerald-700" />
                ) : filter === 'unread' ? (
                  <CheckCheck className="h-9 w-9 text-emerald-700" />
                ) : (
                  <Inbox className="h-9 w-9 text-emerald-700" />
                )}
              </div>

              <h3 className="mt-5 text-lg font-bold text-slate-900">
                {search.trim()
                  ? 'No matching notifications'
                  : filter === 'unread'
                    ? 'You’re all caught up!'
                    : filter === 'read'
                      ? 'No read notifications yet'
                      : 'No notifications yet'}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                {search.trim()
                  ? 'Try searching for a different keyword.'
                  : filter === 'unread'
                    ? 'You have no unread notifications at the moment.'
                    : filter === 'read'
                      ? 'Notifications you have opened will appear here.'
                      : 'When your instructors update, review, or sign your clearance, notifications will appear here once notification events are configured.'}
              </p>

              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-5 rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notification) => {
                const Icon = getNotificationIcon(
                  notification.category,
                  notification.type
                )

                const style = getCategoryStyle(
                  notification.category
                )

                const isProcessing = processingIds.includes(
                  notification.id
                )

                return (
                  <div
                    key={notification.id}
                    className={`group flex items-start gap-4 p-5 transition-colors sm:p-6 ${
                      notification.read
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
                    >
                      <Icon size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`text-sm ${
                            notification.read
                              ? 'font-semibold text-slate-800'
                              : 'font-bold text-slate-950'
                          }`}
                        >
                          {notification.title}
                        </h3>

                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        )}

                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                        >
                          {style.label}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                        {notification.message}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatRelativeTime(
                            notification.createdAt
                          )}
                        </span>

                        <span className="text-xs text-slate-400">
                          From: {notification.senderName}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenNotification(notification)
                          }
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 transition hover:text-emerald-600"
                        >
                          View Details
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>

                        {!notification.read && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              void markAsRead(
                                notification
                              ).catch(() => {})
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-emerald-700 disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}

                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Information footer */}

        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
              <Info className="h-5 w-5 text-emerald-700" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Stay informed with GradeSync
              </h3>

              <p className="mt-1 max-w-xl text-xs leading-relaxed text-emerald-800">
                Notifications help you keep track of important
                clearance updates. You can also review
                detailed instructor actions in your activity history.
              </p>
            </div>
          </div>

          <Link
            href="/students/activity"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
          >
            View Activity
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Notification details modal */}

      {selectedNotification && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseDetails()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-detail-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                  <Bell className="h-5 w-5 text-emerald-700" />
                </div>

                <div>
                  <h2
                    id="notification-detail-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    {selectedNotification.title}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(
                      selectedNotification.createdAt
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseDetails}
                aria-label="Close notification details"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    getCategoryStyle(
                      selectedNotification.category
                    ).badge
                  }`}
                >
                  {
                    getCategoryStyle(
                      selectedNotification.category
                    ).label
                  }
                </span>

                <span className="text-xs text-slate-400">
                  From: {selectedNotification.senderName}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {selectedNotification.message}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:px-6">
              <button
                type="button"
                onClick={handleCloseDetails}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>

              {selectedNotification.link && (
                <Link
                  href={selectedNotification.link}
                  onClick={handleCloseDetails}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  View Related Page
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
