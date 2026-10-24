
'use client'

import React, { useEffect, useState } from 'react'
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
} from 'lucide-react'
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
      setImageError(false)
    })

    return () => unsubscribe()
  }, [])

  const handleCloseLogoutModal = () => {
    if (loggingOut) return
    setShowLogoutModal(false)
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showLogoutModal && !loggingOut) {
          setShowLogoutModal(false)
          return
        }

        if (sidebarOpen) {
          setSidebarOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showLogoutModal, loggingOut, sidebarOpen])

  useEffect(() => {
    if (sidebarOpen || showLogoutModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen, showLogoutModal])

  const handleNavigation = () => {
    setSidebarOpen(false)
  }

  const handleOpenLogoutModal = () => {
    setShowLogoutModal(true)
  }

  const handleLogOut = async () => {
    if (loggingOut) return

    try {
      setLoggingOut(true)

      await signOut(auth)

      setShowLogoutModal(false)
      setSidebarOpen(false)

      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      setLoggingOut(false)
    }
  }

  const photoURL =
    user?.photoURL ||
    user?.providerData?.[0]?.photoURL ||
    null

  const displayName =
    user?.displayName ||
    user?.providerData?.[0]?.displayName ||
    'Instructor'

  const email =
    user?.email ||
    user?.providerData?.[0]?.email ||
    ''

  // Navigation links
  // Activity page added without removing existing pages.
  const navLinks = [
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
    {
      name: 'Profile',
      href: '/instructor/profile',
      icon: User,
    },
  ]

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-white shadow-lg transition hover:bg-blue-800 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={sidebarOpen}
      >
        <Menu size={21} />
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-[100dvh] w-[280px] max-w-[85vw]
          flex-col overflow-y-auto
          bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950
          p-4 sm:p-5 text-white
          shadow-2xl
          transition-transform duration-300 ease-in-out
          lg:sticky lg:top-0 lg:z-30
          lg:h-screen lg:w-64 lg:max-w-none
          lg:translate-x-0
          lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="min-h-0 space-y-6 sm:space-y-8">
          {/* Mobile Sidebar Header */}
          <div className="flex items-center justify-between lg:hidden">
            <div className="text-sm font-semibold tracking-wide text-white/90">
              Instructor Portal
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-100/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          {/* User Info */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/30 bg-slate-300 shadow-md">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-slate-400" />
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
                <div className="flex h-full w-full items-center justify-center bg-blue-800 font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {loading ? (
                <>
                  <div className="mb-2 h-4 w-24 animate-pulse rounded bg-blue-900/50" />
                  <div className="h-3 w-32 animate-pulse rounded bg-blue-900/40" />
                </>
              ) : (
                <>
                  <p className="truncate text-sm font-semibold text-white">
                    {displayName}
                  </p>

                  <p className="truncate text-xs text-blue-200/70">
                    {email}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon

              const isActive =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`)

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavigation}
                  className={`
                    flex items-center gap-3 rounded-xl
                    px-4 py-3
                    text-sm font-medium
                    transition
                    ${
                      isActive
                        ? 'bg-white/15 font-semibold text-white shadow-inner'
                        : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Icon
                    size={18}
                    className="shrink-0"
                  />

                  <span className="truncate">
                    {link.name}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="mt-auto space-y-2 border-t border-blue-800/40 pt-6 pb-2">
          <Link
            href="/settings"
            onClick={handleNavigation}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-blue-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <Settings
              size={18}
              className="shrink-0"
            />

            <span>Settings</span>
          </Link>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleOpenLogoutModal}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-blue-100/80 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut
              size={18}
              className="shrink-0"
            />

            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
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
            {/* Modal Header */}
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Content */}
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

            {/* Modal Actions */}
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
