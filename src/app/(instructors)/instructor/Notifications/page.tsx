
'use client'

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Search,
  X,
  Inbox,
  FileText,
  PenLine,
  Megaphone,
  ShieldCheck,
  MessageSquare,
  Info,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Filter,
  CalendarDays,
  UserRound,
  Loader2,
} from 'lucide-react'

import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  writeBatch,
  serverTimestamp,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

// Types

type NotificationFilter =
  | 'all'
  | 'unread'
  | 'read'

type NotificationCategory =
  | 'clearance'
  | 'signature'
  | 'announcement'
  | 'account'
  | 'message'
  | 'general'

interface InstructorNotification {
  id: string
  title: string
  message: string
  type: string
  category: NotificationCategory
  senderName: string
  read: boolean
  createdAt: Date | null
  link: string | null
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

  if (typeof value === 'number') {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  if (typeof value === 'string') {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  return null
}

function getCategory(
  type: string
): NotificationCategory {
  const normalized = type.toLowerCase()

  if (
    normalized.includes('signature') ||
    normalized.includes('signed') ||
    normalized.includes('signing')
  ) {
    return 'signature'
  }

  if (
    normalized.includes('clearance') ||
    normalized.includes('document') ||
    normalized.includes('grade') ||
    normalized.includes('review') ||
    normalized.includes('request')
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
    normalized.includes('profile') ||
    normalized.includes('login')
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

function getCategoryLabel(
  category: NotificationCategory
): string {
  const labels: Record<
    NotificationCategory,
    string
  > = {
    clearance: 'Clearance',
    signature: 'Signature',
    announcement: 'Announcement',
    account: 'Account',
    message: 'Message',
    general: 'General',
  }

  return labels[category]
}

function getCategoryIcon(
  category: NotificationCategory
) {
  switch (category) {
    case 'clearance':
      return FileText
    case 'signature':
      return PenLine
    case 'announcement':
      return Megaphone
    case 'account':
      return ShieldCheck
    case 'message':
      return MessageSquare
    default:
      return Bell
  }
}

function getCategoryStyle(
  category: NotificationCategory
): string {
  switch (category) {
    case 'clearance':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'signature':
      return 'bg-violet-50 text-violet-700 ring-violet-100'
    case 'announcement':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'account':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'message':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-100'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

function formatRelativeDate(
  date: Date | null
): string {
  if (!date) return 'Date unavailable'

  const difference =
    Math.max(0, Date.now() - date.getTime())

  const minutes =
    Math.floor(difference / 60000)

  const hours =
    Math.floor(difference / 3600000)

  const days =
    Math.floor(difference / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  if (hours < 24) {
    return `${hours}h ago`
  }

  if (days < 7) {
    return `${days}d ago`
  }

  return date.toLocaleDateString(
    'en-PH',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  )
}

function formatFullDate(
  date: Date | null
): string {
  if (!date) return 'Date unavailable'

  return date.toLocaleString(
    'en-PH',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  )
}

function getSafeLink(
  value: unknown
): string | null {
  const link = getText(value)

  if (!link) return null

  if (
    !link.startsWith('/') ||
    link.startsWith('//') ||
    link.includes('\\')
  ) {
    return null
  }

  if (
    link === '/instructor' ||
    link.startsWith('/instructor/')
  ) {
    return link
  }

  return null
}

function normalizeNotification(
  id: string,
  data: DocumentData
): InstructorNotification {
  const type =
    getText(data.type) ||
    getText(data.category) ||
    getText(data.action) ||
    'general'

  const read =
    data.read === true ||
    data.isRead === true

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

    type,
    category: getCategory(type),

    senderName:
      getText(data.senderName) ||
      getText(data.actorName) ||
      'GradeSync',

    read,

    createdAt: getDate(
      data.createdAt ?? data.timestamp
    ),

    link: getSafeLink(
      data.link ?? data.href
    ),
  }
}

// Instructor Notifications Page

export default function Notifications() {
  const router = useRouter()

  const [user, setUser] =
    useState<User | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [notifications, setNotifications] =
    useState<InstructorNotification[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<NotificationFilter>('all')

  const [selectedNotificationId, setSelectedNotificationId] =
    useState<string | null>(null)

  const [processingIds, setProcessingIds] =
    useState<string[]>([])

  const [markingAll, setMarkingAll] =
    useState(false)

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

  // Real-time Firestore notifications

  useEffect(() => {
    if (authLoading) return

    if (!user) return

    const notificationsQuery = query(
      collection(db, 'Notifications'),
      where('recipientUid', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const results = snapshot.docs.map(
          (document) =>
            normalizeNotification(
              document.id,
              document.data()
            )
        )

        results.sort((a, b) => {
          const aTime =
            a.createdAt?.getTime() ?? 0

          const bTime =
            b.createdAt?.getTime() ?? 0

          return bTime - aTime
        })

        setNotifications(results)
        setLoading(false)
        setError(null)
      },
      (firestoreError) => {
        console.error(
          '[Instructor Notifications] Listener error:',
          firestoreError
        )

        setError(
          firestoreError.code ===
            'permission-denied'
            ? 'You do not have permission to access these notifications. Please check your Firestore security rules.'
            : 'Unable to load notifications. Please check your connection and try again.'
        )

        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, authLoading])

  // Notification statistics

  const totalCount = notifications.length

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length

  const readCount =
    totalCount - unreadCount

  // Search and filters

  const filteredNotifications = useMemo(
    () => {
      const keyword =
        search.trim().toLowerCase()

      return notifications.filter(
        (notification) => {
          if (
            filter === 'unread' &&
            notification.read
          ) {
            return false
          }

          if (
            filter === 'read' &&
            !notification.read
          ) {
            return false
          }

          if (!keyword) return true

          const searchableText = [
            notification.title,
            notification.message,
            notification.senderName,
            notification.type,
            getCategoryLabel(
              notification.category
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
    [notifications, search, filter]
  )

  const selectedNotification =
    notifications.find(
      (notification) =>
        notification.id ===
        selectedNotificationId
    ) ?? null

  // Mark a notification as read

  const handleMarkAsRead = async (
    notification: InstructorNotification
  ) => {
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

    setError(null)
    setSuccess(null)

    try {
      await updateDoc(
        doc(
          db,
          'Notifications',
          notification.id
        ),
        {
          read: true,
          isRead: true,
          readAt: serverTimestamp(),
        }
      )
    } catch (updateError) {
      console.error(
        '[Instructor Notifications] Mark read error:',
        updateError
      )

      setError(
        'Unable to mark this notification as read.'
      )
    } finally {
      setProcessingIds((previous) =>
        previous.filter(
          (id) => id !== notification.id
        )
      )
    }
  }

  // Mark all notifications as read

  const handleMarkAllAsRead = async () => {
    if (
      !user ||
      markingAll ||
      unreadCount === 0
    ) {
      return
    }

    setMarkingAll(true)
    setError(null)
    setSuccess(null)

    try {
      const unreadNotifications =
        notifications.filter(
          (notification) =>
            !notification.read
        )

      const batchSize = 400

      for (
        let index = 0;
        index < unreadNotifications.length;
        index += batchSize
      ) {
        const batch = writeBatch(db)

        const chunk =
          unreadNotifications.slice(
            index,
            index + batchSize
          )

        chunk.forEach((notification) => {
          const notificationRef = doc(
            db,
            'Notifications',
            notification.id
          )

          batch.update(
            notificationRef,
            {
              read: true,
              isRead: true,
              readAt: serverTimestamp(),
            }
          )
        })

        await batch.commit()
      }

      setSuccess(
        'All notifications have been marked as read.'
      )
    } catch (updateError) {
      console.error(
        '[Instructor Notifications] Mark all error:',
        updateError
      )

      setError(
        'Unable to mark all notifications as read. Please try again.'
      )
    } finally {
      setMarkingAll(false)
    }
  }

  // Notification details

  const handleOpenNotification = (
    notification: InstructorNotification
  ) => {
    setSelectedNotificationId(
      notification.id
    )

    if (!notification.read) {
      void handleMarkAsRead(notification)
    }
  }

  const handleCloseDetails = () => {
    setSelectedNotificationId(null)
  }

  const handleOpenLink = (
    notification: InstructorNotification
  ) => {
    if (!notification.link) return

    setSelectedNotificationId(null)

    router.push(notification.link)
  }

  // Escape key for details modal

  useEffect(() => {
    if (!selectedNotificationId) return

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setSelectedNotificationId(null)
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
  }, [selectedNotificationId])

  // UI

  return (
    <div className="min-h-screen bg-slate-50/80 px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-7xl space-y-7">

        {/* Page Header */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                <BellRing size={13} />
                Communications
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Notifications
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Stay informed about clearance requests,
              document updates, signatures, and
              important announcements.
            </p>
          </div>

          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={
              markingAll ||
              unreadCount === 0 ||
              loading
            }
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <CheckCheck size={17} />
            )}

            {markingAll
              ? 'Updating...'
              : 'Mark all as read'}
          </button>
        </div>

        {/* Feedback Messages */}

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

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0"
            />

            <p className="flex-1">
              {success}
            </p>

            <button
              type="button"
              onClick={() => setSuccess(null)}
              aria-label="Dismiss message"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Inbox */}

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

          {/* Inbox Header */}

          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>
                <div className="flex items-center gap-2">
                  <Inbox
                    size={19}
                    className="text-blue-700"
                  />

                  <h2 className="text-base font-bold text-slate-900">
                    Notification Inbox
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {filteredNotifications.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Your latest updates and activities
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
                  placeholder="Search notifications..."
                  aria-label="Search notifications"
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
                    value: 'unread',
                    label: 'Unread',
                    count: unreadCount,
                  },
                  {
                    value: 'read',
                    label: 'Read',
                    count: readCount,
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

          {(loading || authLoading) ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <RefreshCw
                  size={24}
                  className="animate-spin text-blue-600"
                />
              </div>

              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  Loading notifications
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Please wait while we update your inbox.
                </p>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (

            /* Empty State */

            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
                {search ? (
                  <Search
                    size={32}
                    className="text-blue-400"
                  />
                ) : filter === 'read' ? (
                  <CheckCircle2
                    size={32}
                    className="text-blue-400"
                  />
                ) : (
                  <Bell
                    size={32}
                    className="text-blue-400"
                  />
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                {search
                  ? 'No matching notifications'
                  : filter === 'unread'
                    ? 'You are all caught up!'
                    : filter === 'read'
                      ? 'No read notifications'
                      : 'No notifications yet'}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search
                  ? 'Try another keyword or clear your search to see more notifications.'
                  : filter === 'unread'
                    ? 'You have no unread notifications at the moment.'
                    : filter === 'read'
                      ? 'Notifications you have already reviewed will appear here.'
                      : 'When you receive clearance requests, signatures, announcements, or other updates, they will appear here.'}
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
                  View all notifications
                </button>
              )}
            </div>
          ) : (

            /* Notification List */

            <div className="divide-y divide-slate-100">
              {filteredNotifications.map(
                (notification) => {
                  const Icon = getCategoryIcon(
                    notification.category
                  )

                  const categoryStyle =
                    getCategoryStyle(
                      notification.category
                    )

                  const processing =
                    processingIds.includes(
                      notification.id
                    )

                  return (
                    <div
                      key={notification.id}
                      className={`group relative transition-colors duration-200 ${
                        notification.read
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-blue-50/50 hover:bg-blue-50/80'
                      }`}
                    >
                      {!notification.read && (
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
                              <h3
                                className={`text-sm leading-6 ${
                                  notification.read
                                    ? 'font-semibold text-slate-800'
                                    : 'font-bold text-slate-900'
                                }`}
                              >
                                {notification.title}
                              </h3>

                              {!notification.read && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                              )}
                            </div>

                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                              <Clock3 size={13} />
                              {formatRelativeDate(
                                notification.createdAt
                              )}
                            </span>
                          </div>

                          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-500">
                            {notification.message}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold ring-1 ${categoryStyle}`}
                            >
                              {getCategoryLabel(
                                notification.category
                              )}
                            </span>

                            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-400">
                              <UserRound
                                size={12}
                                className="shrink-0"
                              />

                              <span className="truncate">
                                {notification.senderName}
                              </span>
                            </span>

                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                                notification.read
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {notification.read
                                ? 'Read'
                                : 'Unread'}
                            </span>
                          </div>

                          {/* Actions */}

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenNotification(
                                  notification
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                            >
                              <Info size={14} />
                              View details
                            </button>

                            {!notification.read && (
                              <button
                                type="button"
                                disabled={processing}
                                onClick={() =>
                                  void handleMarkAsRead(
                                    notification
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                {processing ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Check size={14} />
                                )}

                                Mark as read
                              </button>
                            )}

                            {notification.link && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenLink(
                                    notification
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                              >
                                Open page
                                <ArrowUpRight size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}

          {/* Inbox Footer */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {filteredNotifications.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700">
                {totalCount}
              </span>{' '}
              notifications
            </p>

            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <CheckCircle2
                size={14}
                className="text-blue-600"
              />
              Real-time inbox
            </span>
          </div>
        </div>

        {/* Activity Information */}

        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
            <Info size={19} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-blue-950">
              Stay up to date
            </h3>

            <p className="mt-1 text-xs leading-6 text-blue-900/70 sm:text-sm">
              GradeSync keeps your notification inbox
              synchronized with updates addressed to your
              instructor account. New notifications will
              appear automatically when they are sent
              through the system.
            </p>
          </div>
        </div>
      </div>

      {/* Notification Details Modal */}

      {selectedNotification && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
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

            {/* Modal Header */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${getCategoryStyle(
                    selectedNotification.category
                  )}`}
                >
                  {React.createElement(
                    getCategoryIcon(
                      selectedNotification.category
                    ),
                    { size: 21 }
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Notification Details
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    GradeSync Instructor Portal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseDetails}
                aria-label="Close notification details"
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
                    selectedNotification.category
                  )}`}
                >
                  {getCategoryLabel(
                    selectedNotification.category
                  )}
                </span>

                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {selectedNotification.read
                    ? 'Read'
                    : 'Unread'}
                </span>
              </div>

              <h2
                id="notification-detail-title"
                className="text-xl font-bold leading-8 text-slate-900"
              >
                {selectedNotification.title}
              </h2>

              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                {selectedNotification.message}
              </p>

              <div className="mt-6 space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <UserRound
                    size={17}
                    className="mt-0.5 text-slate-400"
                  />

                  <div>
                    <p className="text-xs text-slate-400">
                      From
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {selectedNotification.senderName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={17}
                    className="mt-0.5 text-slate-400"
                  />

                  <div>
                    <p className="text-xs text-slate-400">
                      Received
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatFullDate(
                        selectedNotification.createdAt
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={handleCloseDetails}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>

              {selectedNotification.link && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenLink(
                      selectedNotification
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  Open related page
                  <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
