
'use client'

import React, {
  useEffect,
  useState,
  type ComponentType,
} from 'react'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import {
  Home,
  FileText,
  User,
  Settings,
  LogOut,
  X,
  AlertTriangle,
  Menu,
  History,
  Bell,
  Megaphone,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'

import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

// Types

interface StudentUserData {
  fullName?: string
  displayName?: string
  name?: string
  email?: string
  studentEmail?: string
  photoURL?: string
}

interface NavigationLink {
  name: string
  href: string
  icon: ComponentType<{
    size?: number
    className?: string
  }>
}

interface NavigationSection {
  title: string
  links: NavigationLink[]
}

interface NotificationRecord {
  id: string
  read: boolean
}

interface ClearanceRecord {
  id: string
  completed: boolean
}

// Navigation sections

const navigationSections: NavigationSection[] = [
  {
    title: 'MAIN',
    links: [
      {
        name: 'Home',
        href: '/students/home',
        icon: Home,
      },
      {
        name: 'Create Clearance',
        href: '/students/Clearance',
        icon: FileText,
      },
      {
        name: 'Activity',
        href: '/students/activity',
        icon: History,
      },
    ],
  },
  {
    title: 'COMMUNICATIONS',
    links: [
      {
        name: 'Notifications',
        href: '/students/Notifications',
        icon: Bell,
      },
      {
        name: 'Announcements',
        href: '/students/Announcements',
        icon: Megaphone,
      },
    ],
  },
  {
    title: 'HELP',
    links: [
      {
        name: 'Feedback & Support',
        href: '/students/Feedback&Support',
        icon: MessageSquare,
      },
    ],
  },
  {
    title: 'ACCOUNT',
    links: [
      {
        name: 'Profile',
        href: '/students/profile',
        icon: User,
      },
      {
        name: 'Settings',
        href: '/students/settings',
        icon: Settings,
      },
    ],
  },
]

// Helpers

function getText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getGoogleProvider(
  user: FirebaseUser | null
) {
  if (!user) return null

  return (
    user.providerData.find(
      (provider) =>
        provider.providerId === 'google.com'
    ) || null
  )
}

function isSignedSubject(
  subject: unknown
): boolean {
  if (
    !subject ||
    typeof subject !== 'object' ||
    Array.isArray(subject)
  ) {
    return false
  }

  const data = subject as Record<string, unknown>

  const status = getText(
    data.status
  ).toLowerCase()

  const signature =
    getText(data.signature) ||
    getText(data.instructorSignature) ||
    getText(data.signatureId)

  return (
    data.signed === true ||
    data.isSigned === true ||
    data.instructorSigned === true ||
    Boolean(signature) ||
    Boolean(data.signedAt) ||
    status === 'signed' ||
    status === 'approved' ||
    status === 'completed' ||
    status === 'complete'
  )
}

function isFullySignedClearance(
  data: DocumentData
): boolean {
  const status = getText(data.status)
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

  if (
    [
      'fullysigned',
      'allsigned',
      'completed',
      'complete',
      'fullyapproved',
    ].includes(status)
  ) {
    return true
  }

  if (
    !Array.isArray(data.subjects) ||
    data.subjects.length === 0
  ) {
    return false
  }

  return data.subjects.every(isSignedSubject)
}

function getViewedClearanceIds(
  uid: string
): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const saved = window.localStorage.getItem(
      `gradesync-student-viewed-clearances-${uid}`
    )

    if (!saved) return []

    const parsed: unknown = JSON.parse(saved)

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === 'string'
        )
      : []
  } catch {
    return []
  }
}

// Student Sidebar

export default function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] =
    useState<FirebaseUser | null>(null)

  const [dbUserData, setDbUserData] =
    useState<StudentUserData | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [imageError, setImageError] =
    useState(false)

  const [showLogoutModal, setShowLogoutModal] =
    useState(false)

  const [loggingOut, setLoggingOut] =
    useState(false)

  const [sidebarOpen, setSidebarOpen] =
    useState(false)

  const [primaryNotifications, setPrimaryNotifications] =
    useState<NotificationRecord[]>([])

  const [secondaryNotifications, setSecondaryNotifications] =
    useState<NotificationRecord[]>([])

  const [requestClearances, setRequestClearances] =
    useState<ClearanceRecord[]>([])

  const [savedClearances, setSavedClearances] =
    useState<ClearanceRecord[]>([])

  const [viewedClearanceIds, setViewedClearanceIds] =
    useState<string[]>([])

  // Firebase authentication and live profile

  useEffect(() => {
    let active = true

    let unsubscribeProfile:
      | (() => void)
      | null = null

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!active) return

        if (unsubscribeProfile) {
          unsubscribeProfile()
          unsubscribeProfile = null
        }

        setUser(currentUser)
        setDbUserData(null)
        setImageError(false)

        if (!currentUser) {
          setLoading(false)
          return
        }

        setLoading(true)

        const userRef = doc(
          db,
          'users',
          currentUser.uid
        )

        unsubscribeProfile = onSnapshot(
          userRef,
          (snapshot) => {
            if (!active) return

            if (snapshot.exists()) {
              setDbUserData(
                snapshot.data() as StudentUserData
              )
            } else {
              setDbUserData(null)
            }

            setLoading(false)
          },
          (error) => {
            console.error(
              '[Student Sidebar] Profile listener error:',
              error
            )

            if (!active) return

            setDbUserData(null)
            setLoading(false)
          }
        )
      }
    )

    return () => {
      active = false
      unsubscribeAuth()

      if (unsubscribeProfile) {
        unsubscribeProfile()
      }
    }
  }, [])

  // Live student notifications

  useEffect(() => {
    if (!user) return

    const uid = user.uid

    const primaryQuery = query(
      collection(db, 'Notifications'),
      where('recipientUid', '==', uid)
    )

    const secondaryQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', uid)
    )

    const requestsQuery = query(
      collection(db, 'requests'),
      where('studentUid', '==', uid)
    )

    const clearancesQuery = query(
      collection(db, 'clearances'),
      where('studentUid', '==', uid)
    )

    const unsubscribePrimary = onSnapshot(
      primaryQuery,
      (snapshot) => {
        setPrimaryNotifications(
          snapshot.docs.map((item) => {
            const data = item.data()

            return {
              id: item.id,
              read:
                data.read === true ||
                data.isRead === true,
            }
          })
        )
      },
      (error) => {
        console.error(
          '[Student Sidebar] Notifications listener error:',
          error
        )
      }
    )

    const unsubscribeSecondary = onSnapshot(
      secondaryQuery,
      (snapshot) => {
        setSecondaryNotifications(
          snapshot.docs.map((item) => {
            const data = item.data()

            return {
              id: item.id,
              read:
                data.read === true ||
                data.isRead === true,
            }
          })
        )
      },
      (error) => {
        console.error(
          '[Student Sidebar] Secondary notifications listener error:',
          error
        )
      }
    )

    const unsubscribeRequests = onSnapshot(
      requestsQuery,
      (snapshot) => {
        setRequestClearances(
          snapshot.docs.map((item) => ({
            id: item.id,
            completed: isFullySignedClearance(
              item.data()
            ),
          }))
        )
      },
      (error) => {
        console.error(
          '[Student Sidebar] Requests listener error:',
          error
        )
      }
    )

    const unsubscribeClearances = onSnapshot(
      clearancesQuery,
      (snapshot) => {
        setSavedClearances(
          snapshot.docs.map((item) => ({
            id: item.id,
            completed: isFullySignedClearance(
              item.data()
            ),
          }))
        )
      },
      (error) => {
        console.error(
          '[Student Sidebar] Clearances listener error:',
          error
        )
      }
    )

    return () => {
      unsubscribePrimary()
      unsubscribeSecondary()
      unsubscribeRequests()
      unsubscribeClearances()
    }
  }, [user])

  // Sync viewed clearance state

  useEffect(() => {
    if (!user) return

    const uid = user.uid

    const syncViewedClearances = () => {
      setViewedClearanceIds(
        getViewedClearanceIds(uid)
      )
    }

    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        event.key ===
        `gradesync-student-viewed-clearances-${uid}`
      ) {
        syncViewedClearances()
      }
    }

    const handleFocus = () => {
      syncViewedClearances()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncViewedClearances()
      }
    }

    const handleCustomUpdate = () => {
      syncViewedClearances()
    }

    const handleInitialSync = () => {
      syncViewedClearances()
    }

    queueMicrotask(handleInitialSync)

    window.addEventListener(
      'storage',
      handleStorage
    )

    window.addEventListener(
      'focus',
      handleFocus
    )

    window.addEventListener(
      'gradesync-notifications-updated',
      handleCustomUpdate
    )

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      )

      window.removeEventListener(
        'focus',
        handleFocus
      )

      window.removeEventListener(
        'gradesync-notifications-updated',
        handleCustomUpdate
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [user])

  // Notification unread count

  const unreadStoredNotifications =
    primaryNotifications.filter(
      (notification) => !notification.read
    ).length +
    secondaryNotifications.filter(
      (notification) => !notification.read
    ).length

  const completedClearanceIds = [
    ...new Set(
      [
        ...requestClearances,
        ...savedClearances,
      ]
        .filter((item) => item.completed)
        .map((item) => `clearance-${item.id}`)
    ),
  ]

  const unreadCompletedClearances =
    completedClearanceIds.filter(
      (id) => !viewedClearanceIds.includes(id)
    ).length

  const unreadNotificationCount =
    unreadStoredNotifications +
    unreadCompletedClearances

  // Escape key support

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key !== 'Escape') {
        return
      }

      if (showLogoutModal && !loggingOut) {
        setShowLogoutModal(false)
        return
      }

      if (sidebarOpen) {
        setSidebarOpen(false)
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
  }, [
    showLogoutModal,
    loggingOut,
    sidebarOpen,
  ])

  // Prevent background scrolling

  useEffect(() => {
    if (!sidebarOpen && !showLogoutModal) {
      return
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow =
        previousOverflow
    }
  }, [
    sidebarOpen,
    showLogoutModal,
  ])

  // Navigation handlers

  const handleNavigation = () => {
    setSidebarOpen(false)
  }

  const handleOpenSidebar = () => {
    setSidebarOpen(true)
  }

  const handleCloseSidebar = () => {
    setSidebarOpen(false)
  }

  const handleOpenLogoutModal = () => {
    setSidebarOpen(false)
    setShowLogoutModal(true)
  }

  const handleCloseLogoutModal = () => {
    if (loggingOut) return

    setShowLogoutModal(false)
  }

  // Logout

  const handleLogOut = async () => {
    if (loggingOut) return

    try {
      setLoggingOut(true)

      await signOut(auth)

      setShowLogoutModal(false)
      setSidebarOpen(false)

      router.replace('/login')
    } catch (error) {
      console.error(
        '[Student Sidebar] Logout error:',
        error
      )

      setLoggingOut(false)
    }
  }

  // Google account information

  const googleProvider =
    getGoogleProvider(user)

  const photoURL =
    getText(dbUserData?.photoURL) ||
    getText(user?.photoURL) ||
    getText(googleProvider?.photoURL) ||
    getText(user?.providerData?.[0]?.photoURL) ||
    null

  const displayName =
    getText(dbUserData?.fullName) ||
    getText(dbUserData?.displayName) ||
    getText(dbUserData?.name) ||
    getText(user?.displayName) ||
    getText(googleProvider?.displayName) ||
    getText(user?.providerData?.[0]?.displayName) ||
    'Student'

  const email =
    getText(user?.email) ||
    getText(googleProvider?.email) ||
    getText(dbUserData?.email) ||
    getText(dbUserData?.studentEmail) ||
    getText(user?.providerData?.[0]?.email) ||
    ''

  // Active route detection

  const isLinkActive = (
    href: string
  ): boolean => {
    if (pathname === href) {
      return true
    }

    if (href === '/students/home') {
      return false
    }

    return pathname.startsWith(`${href}/`)
  }

  // Navigation link renderer

  const renderNavigationLink = (
    link: NavigationLink
  ) => {
    const Icon = link.icon
    const isActive = isLinkActive(link.href)

    const isNotificationsLink =
      link.href === '/students/Notifications'

    const showNotificationBadge =
      isNotificationsLink &&
      unreadNotificationCount > 0

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={handleNavigation}
        aria-current={
          isActive ? 'page' : undefined
        }
        className={`group flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'border-emerald-500/30 bg-emerald-600/30 font-semibold text-white shadow-inner'
            : 'border-transparent text-emerald-100/80 hover:border-white/10 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="relative shrink-0">
          <Icon
            size={18}
            className={`shrink-0 transition-colors duration-200 ${
              isActive
                ? 'text-emerald-300'
                : 'text-emerald-400 group-hover:text-emerald-200'
            }`}
          />

          {showNotificationBadge && (
            <span className="absolute -right-1.5 -top-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-emerald-900" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1 truncate">
          {link.name}
        </span>

        {showNotificationBadge && (
          <span
            className="relative inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white shadow-sm"
            aria-label={`${unreadNotificationCount} unread notifications`}
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-20 motion-reduce:animate-none" />

            <span className="relative">
              {unreadNotificationCount > 99
                ? '99+'
                : unreadNotificationCount}
            </span>
          </span>
        )}

        {isActive && (
          <ChevronRight
            size={15}
            className="shrink-0 text-emerald-300"
          />
        )}
      </Link>
    )
  }

  // Sidebar UI

  return (
    <>
      {/* Mobile menu button */}

      <button
        type="button"
        onClick={handleOpenSidebar}
        aria-label="Open navigation"
        aria-controls="student-sidebar"
        aria-expanded={sidebarOpen}
        className={`fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-lg transition hover:bg-emerald-800 lg:hidden ${
          sidebarOpen
            ? 'pointer-events-none opacity-0'
            : 'opacity-100'
        }`}
      >
        <Menu size={21} aria-hidden="true" />

        {unreadNotificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
          </span>
        )}
      </button>

      {/* Mobile overlay */}

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden">
          <button
            type="button"
            onClick={handleCloseSidebar}
            aria-label="Close navigation overlay"
            className="absolute inset-0 h-full w-full cursor-default"
          />
        </div>
      )}

      {/* Student sidebar */}

      <aside
        id="student-sidebar"
        aria-label="Student sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[280px] max-w-[85vw] flex-col overflow-hidden bg-gradient-to-b from-emerald-900 to-teal-950 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 lg:h-[100dvh] lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        {/* Fixed profile section */}

        <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">

          {/* Mobile sidebar header */}

          <div className="mb-5 flex items-center justify-between lg:hidden">
            <div className="text-sm font-semibold tracking-wide text-emerald-200">
              Student Portal
            </div>

            <button
              type="button"
              onClick={handleCloseSidebar}
              aria-label="Close navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-100/80 transition hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* User information */}

          <div className="flex min-w-0 items-center gap-3 pb-5">

            {/* Profile photo */}

            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-emerald-400/30 bg-emerald-800 shadow-md">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-emerald-700" />
              ) : photoURL && !imageError ? (
                <img
                  key={photoURL}
                  src={photoURL}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    setImageError(true)
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-600 font-bold text-white">
                  {displayName
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>

            {/* User name and email */}

            <div className="flex min-w-0 flex-1 flex-col">
              {loading ? (
                <>
                  <div className="mb-2 h-4 w-24 animate-pulse rounded bg-emerald-900/50" />
                  <div className="h-3 w-32 animate-pulse rounded bg-emerald-900/40" />
                </>
              ) : (
                <>
                  <p className="truncate text-sm font-semibold text-white">
                    {displayName}
                  </p>

                  <p className="truncate text-xs text-emerald-200/70">
                    {email}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Profile divider */}

          <div className="border-t border-emerald-700/30" />
        </div>

        {/* Independently scrollable navigation */}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor:
              'rgba(110, 231, 183, 0.35) transparent',
          }}
        >
          <nav
            aria-label="Student navigation"
            className="space-y-5"
          >
            {navigationSections.map(
              (section, sectionIndex) => (
                <div
                  key={section.title}
                  className="space-y-1"
                >

                  {/* Section label */}

                  <div className="flex items-center gap-3 px-3.5 pb-1.5 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/65">
                      {section.title}
                    </span>

                    <div className="h-px flex-1 bg-emerald-400/10" />
                  </div>

                  {/* Section links */}

                  <div className="space-y-1">
                    {section.links.map(
                      renderNavigationLink
                    )}
                  </div>

                  {/* Section separator */}

                  {sectionIndex <
                    navigationSections.length - 1 && (
                    <div className="pt-3">
                      <div className="border-t border-emerald-700/20" />
                    </div>
                  )}
                </div>
              )
            )}
          </nav>
        </div>

        {/* Fixed logout footer */}

        <div className="z-10 shrink-0 border-t border-emerald-700/40 bg-teal-950/40 px-4 pb-4 pt-3 sm:px-5">

          {/* Logout button */}

          <button
            type="button"
            onClick={handleOpenLogoutModal}
            className="group flex min-h-[44px] w-full shrink-0 items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 text-sm font-medium text-emerald-100/80 transition-all duration-200 hover:border-red-400/20 hover:bg-red-500/10 hover:text-white"
          >
            <LogOut
              size={18}
              className="shrink-0 text-emerald-400 transition group-hover:text-red-300"
            />

            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Logout confirmation modal */}

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !loggingOut
            ) {
              handleCloseLogoutModal()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >

            {/* Modal header */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertTriangle size={20} />
                </div>

                <h2
                  id="logout-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Log out
                </h2>
              </div>

              <button
                type="button"
                onClick={handleCloseLogoutModal}
                disabled={loggingOut}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal content */}

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <p
                id="logout-description"
                className="text-sm leading-6 text-slate-600"
              >
                Are you sure you want to log out of your
                student account?
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                You will need to sign in again to access the
                Student Portal.
              </p>
            </div>

            {/* Modal actions */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={handleCloseLogoutModal}
                disabled={loggingOut}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogOut}
                disabled={loggingOut}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {loggingOut ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    Log out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
