
'use client'

import React, {
  useEffect,
  useState,
  type ComponentType,
} from 'react'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import {
  Cloud,
  Users,
  User,
  Settings,
  LogOut,
  X,
  AlertTriangle,
  Menu,
  Activity,
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
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

// Types

interface InstructorUserData {
  fullName?: string
  displayName?: string
  name?: string
  email?: string
  instructorEmail?: string
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

interface ClearanceSubject {
  instructorId?: string
}

interface ClearanceRequestData {
  status?: string
  instructorId?: string
  instructorUid?: string
  sharedWithUid?: string
  instructorEmail?: string
  sharedWithEmail?: string
  subjects?: ClearanceSubject[]
}

// Navigation sections

const navigationSections: NavigationSection[] = [
  {
    title: 'MAIN',
    links: [
      {
        name: 'Dashboard',
        href: '/instructor/home',
        icon: Cloud,
      },
      {
        name: 'Clearance Request',
        href: '/instructor/clearance',
        icon: Users,
      },
      {
        name: 'Activity',
        href: '/instructor/activity',
        icon: Activity,
      },
    ],
  },
  {
    title: 'COMMUNICATIONS',
    links: [
      {
        name: 'Notifications',
        href: '/instructor/Notifications',
        icon: Bell,
      },
      {
        name: 'Announcements',
        href: '/instructor/Announcements',
        icon: Megaphone,
      },
    ],
  },
  {
    title: 'HELP',
    links: [
      {
        name: 'Feedback & Support',
        href: '/instructor/Feedback&Support',
        icon: MessageSquare,
      },
    ],
  },
  {
    title: 'ACCOUNT',
    links: [
      {
        name: 'Profile',
        href: '/instructor/profile',
        icon: User,
      },
      {
        name: 'Settings',
        href: '/instructor/settings',
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

function isPendingStatus(
  status: unknown
): boolean {
  return (
    getText(status).toLowerCase() === 'pending'
  )
}

function isRequestAssignedToInstructor(
  request: ClearanceRequestData,
  instructorUid: string,
  instructorEmail: string
): boolean {
  const normalizedEmail =
    instructorEmail.toLowerCase()

  const directUidMatch =
    request.instructorId === instructorUid ||
    request.instructorUid === instructorUid ||
    request.sharedWithUid === instructorUid

  const directEmailMatch =
    normalizedEmail.length > 0 &&
    (
      getText(request.instructorEmail)
        .toLowerCase() === normalizedEmail ||
      getText(request.sharedWithEmail)
        .toLowerCase() === normalizedEmail
    )

  const subjectMatch =
    Array.isArray(request.subjects) &&
    request.subjects.some(
      (subject) =>
        subject.instructorId === instructorUid
    )

  return (
    directUidMatch ||
    directEmailMatch ||
    subjectMatch
  )
}

// Instructor Sidebar

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] =
    useState<FirebaseUser | null>(null)

  const [dbUserData, setDbUserData] =
    useState<InstructorUserData | null>(null)

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

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0)

  const [
    unreadClearanceCount,
    setUnreadClearanceCount,
  ] = useState(0)

  const [
    pendingClearanceCount,
    setPendingClearanceCount,
  ] = useState(0)

  // Firebase authentication and live profile

  useEffect(() => {
    let active = true

    let unsubscribeProfile:
      | (() => void)
      | null = null

    let unsubscribeNotifications:
      | (() => void)
      | null = null

    let unsubscribeRequests:
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

        if (unsubscribeNotifications) {
          unsubscribeNotifications()
          unsubscribeNotifications = null
        }

        if (unsubscribeRequests) {
          unsubscribeRequests()
          unsubscribeRequests = null
        }

        setUser(currentUser)
        setDbUserData(null)
        setImageError(false)
        setUnreadNotificationCount(0)
        setUnreadClearanceCount(0)
        setPendingClearanceCount(0)

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
                snapshot.data() as InstructorUserData
              )
            } else {
              setDbUserData(null)
            }

            setLoading(false)
          },
          (error) => {
            console.error(
              '[Instructor Sidebar] Profile listener error:',
              error
            )

            if (!active) return

            setDbUserData(null)
            setLoading(false)
          }
        )

        // Live notifications and clearance notifications

        const notificationsQuery = query(
          collection(db, 'Notifications'),
          where(
            'recipientUid',
            '==',
            currentUser.uid
          )
        )

        unsubscribeNotifications = onSnapshot(
          notificationsQuery,
          (snapshot) => {
            if (!active) return

            let unreadNotifications = 0
            let unreadClearances = 0

            snapshot.docs.forEach(
              (notificationDoc) => {
                const data =
                  notificationDoc.data()

                const isUnread =
                  data.read !== true &&
                  data.isRead !== true

                if (!isUnread) return

                unreadNotifications += 1

                const isClearanceRequest =
                  data.type ===
                    'clearance_shared' ||
                  data.category ===
                    'clearance'

                if (isClearanceRequest) {
                  unreadClearances += 1
                }
              }
            )

            setUnreadNotificationCount(
              unreadNotifications
            )

            setUnreadClearanceCount(
              unreadClearances
            )
          },
          (error) => {
            console.error(
              '[Instructor Sidebar] Notification listener error:',
              error
            )

            if (!active) return

            setUnreadNotificationCount(0)
            setUnreadClearanceCount(0)
          }
        )

        // Live pending clearance requests

        const requestsQuery = query(
          collection(db, 'requests'),
          where('status', '==', 'Pending')
        )

        unsubscribeRequests = onSnapshot(
          requestsQuery,
          (snapshot) => {
            if (!active) return

            const instructorUid =
              currentUser.uid

            const instructorEmail =
              getText(currentUser.email)

            const pendingCount =
              snapshot.docs.filter(
                (requestDoc) => {
                  const requestData =
                    requestDoc.data() as ClearanceRequestData

                  return (
                    isPendingStatus(
                      requestData.status
                    ) &&
                    isRequestAssignedToInstructor(
                      requestData,
                      instructorUid,
                      instructorEmail
                    )
                  )
                }
              ).length

            setPendingClearanceCount(
              pendingCount
            )
          },
          (error) => {
            console.error(
              '[Instructor Sidebar] Pending clearance listener error:',
              error
            )

            if (!active) return

            setPendingClearanceCount(0)
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

      if (unsubscribeNotifications) {
        unsubscribeNotifications()
      }

      if (unsubscribeRequests) {
        unsubscribeRequests()
      }
    }
  }, [])

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
        '[Instructor Sidebar] Logout error:',
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

  // Firestore displayName is the primary instructor name

  const displayName =
    getText(dbUserData?.displayName) ||
    getText(dbUserData?.fullName) ||
    getText(dbUserData?.name) ||
    getText(user?.displayName) ||
    getText(googleProvider?.displayName) ||
    getText(user?.providerData?.[0]?.displayName) ||
    'Instructor'

  const email =
    getText(user?.email) ||
    getText(googleProvider?.email) ||
    getText(dbUserData?.email) ||
    getText(dbUserData?.instructorEmail) ||
    getText(user?.providerData?.[0]?.email) ||
    ''

  // Active route detection

  const isLinkActive = (
    href: string
  ): boolean => {
    if (pathname === href) {
      return true
    }

    if (href === '/instructor/home') {
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
      link.href === '/instructor/Notifications'

    const isClearanceLink =
      link.href === '/instructor/clearance'

    const notificationCount =
      isNotificationsLink
        ? unreadNotificationCount
        : isClearanceLink
          ? pendingClearanceCount
          : 0

    const hasUnreadItems =
      notificationCount > 0

    const hasUnreadClearanceNotifications =
      isClearanceLink &&
      unreadClearanceCount > 0

    const hasPendingClearances =
      isClearanceLink &&
      pendingClearanceCount > 0

    const showBlinkingDot =
      hasUnreadItems ||
      hasUnreadClearanceNotifications ||
      hasPendingClearances

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={handleNavigation}
        aria-current={
          isActive ? 'page' : undefined
        }
        suppressHydrationWarning
        className={`group flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'border-blue-400/30 bg-blue-600/30 font-semibold text-white shadow-inner'
            : 'border-transparent text-blue-100/80 hover:border-white/10 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="relative flex shrink-0 items-center justify-center">
          <Icon
            size={18}
            className={`shrink-0 transition-colors duration-200 ${
              isActive
                ? 'text-blue-300'
                : 'text-blue-400 group-hover:text-blue-200'
            }`}
          />

          {showBlinkingDot && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-2.5 w-2.5"
              aria-hidden="true"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-blue-950" />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1 truncate">
          {link.name}
        </span>

        {hasUnreadItems && (
          <span
            className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
            aria-label={`${notificationCount} ${
              isClearanceLink
                ? 'pending clearance requests'
                : 'unread notifications'
            }`}
            title={`${notificationCount} ${
              isClearanceLink
                ? 'pending clearance requests'
                : 'unread notifications'
            }`}
          >
            {notificationCount > 99
              ? '99+'
              : notificationCount}
          </span>
        )}

        {isActive && (
          <ChevronRight
            size={15}
            className="shrink-0 text-blue-300"
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
        aria-controls="instructor-sidebar"
        aria-expanded={sidebarOpen}
        suppressHydrationWarning
        className={`fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-white shadow-lg transition hover:bg-blue-800 lg:hidden ${
          sidebarOpen
            ? 'pointer-events-none opacity-0'
            : 'opacity-100'
        }`}
      >
        <Menu size={21} aria-hidden="true" />

        {(unreadNotificationCount > 0 ||
          unreadClearanceCount > 0 ||
          pendingClearanceCount > 0) &&
          !sidebarOpen && (
            <span
              className="absolute right-1 top-1 flex h-2.5 w-2.5"
              aria-label="Unread notifications or pending clearance requests"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-blue-900" />
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
            suppressHydrationWarning
            className="absolute inset-0 h-full w-full cursor-default"
          />
        </div>
      )}

      {/* Instructor sidebar */}

      <aside
        id="instructor-sidebar"
        aria-label="Instructor sidebar"
        suppressHydrationWarning
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[280px] max-w-[85vw] flex-col overflow-hidden bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 lg:h-[100dvh] lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        {/* Fixed profile section */}

        <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
          {/* Mobile sidebar header */}

          <div className="mb-5 flex items-center justify-between lg:hidden">
            <div className="text-sm font-semibold tracking-wide text-blue-200">
              Instructor Portal
            </div>

            <button
              type="button"
              onClick={handleCloseSidebar}
              aria-label="Close navigation"
              suppressHydrationWarning
              className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-100/80 transition hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* User information */}

          <div className="flex min-w-0 items-center gap-3 pb-5">
            {/* Profile photo */}

            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-blue-400/30 bg-blue-800 shadow-md">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-blue-700" />
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
                <div className="flex h-full w-full items-center justify-center bg-blue-600 font-bold text-white">
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
                  <div className="mb-2 h-4 w-24 animate-pulse rounded bg-blue-900/50" />
                  <div className="h-3 w-32 animate-pulse rounded bg-blue-900/40" />
                </>
              ) : (
                <>
                  <p
                    className="truncate text-sm font-semibold text-white"
                    title={displayName}
                  >
                    {displayName}
                  </p>

                  <p
                    className="truncate text-xs text-blue-200/70"
                    title={email}
                  >
                    {email}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Profile divider */}

          <div className="border-t border-blue-700/30" />
        </div>

        {/* Independently scrollable navigation */}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor:
              'rgba(147, 197, 253, 0.35) transparent',
          }}
        >
          <nav
            aria-label="Instructor navigation"
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
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300/65">
                      {section.title}
                    </span>

                    <div className="h-px flex-1 bg-blue-400/10" />
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
                      <div className="border-t border-blue-700/20" />
                    </div>
                  )}
                </div>
              )
            )}
          </nav>
        </div>

        {/* Fixed logout footer */}

        <div className="z-10 shrink-0 border-t border-blue-700/40 bg-slate-950/40 px-4 pb-4 pt-3 sm:px-5">
          {/* Logout button */}

          <button
            type="button"
            onClick={handleOpenLogoutModal}
            suppressHydrationWarning
            className="group flex min-h-[44px] w-full shrink-0 items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 text-sm font-medium text-blue-100/80 transition-all duration-200 hover:border-red-400/20 hover:bg-red-500/10 hover:text-white"
          >
            <LogOut
              size={18}
              className="shrink-0 text-blue-400 transition group-hover:text-red-300"
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
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-red-50 text-red-600">
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
                suppressHydrationWarning
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
                instructor account?
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                You will need to sign in again to access the
                Instructor Portal.
              </p>
            </div>

            {/* Modal actions */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={handleCloseLogoutModal}
                disabled={loggingOut}
                suppressHydrationWarning
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogOut}
                disabled={loggingOut}
                suppressHydrationWarning
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
