
'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  AlertTriangle,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react'

interface AdminProfile {
  fullName?: string
  displayName?: string
  name?: string
  email?: string
  photoURL?: string
  role?: string
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{
    size?: number
    strokeWidth?: number
    className?: string
  }>
  description: string
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    description: 'Overview & analytics',
  },
  {
    name: 'Applications',
    href: '/admin/applications',
    icon: FileCheck2,
    description: 'Review applications',
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: UsersRound,
    description: 'Manage accounts',
  },
]

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function SideBar() {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    let active = true
    let unsubscribeProfile: (() => void) | null = null

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (!active) return

        if (unsubscribeProfile) {
          unsubscribeProfile()
          unsubscribeProfile = null
        }

        setUser(currentUser)
        setProfile(null)
        setImageError(false)

        if (!currentUser) {
          setProfileLoading(false)
          return
        }

        setProfileLoading(true)

        unsubscribeProfile = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (snapshot) => {
            if (!active) return

            setProfile(
              snapshot.exists()
                ? (snapshot.data() as AdminProfile)
                : null
            )
            setProfileLoading(false)
          },
          (error) => {
            console.error(
              '[GradeSync Admin] Profile listener error:',
              error
            )

            if (!active) return

            setProfile(null)
            setProfileLoading(false)
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

  useEffect(() => {
    if (!mobileOpen && !showLogoutConfirm) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen, showLogoutConfirm])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      if (showLogoutConfirm && !loggingOut) {
        setShowLogoutConfirm(false)
        return
      }

      if (mobileOpen) {
        setMobileOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [mobileOpen, showLogoutConfirm, loggingOut])

  const googleProvider =
    user?.providerData.find(
      (provider) => provider.providerId === 'google.com'
    ) || null

  const displayName =
    getText(profile?.fullName) ||
    getText(profile?.displayName) ||
    getText(profile?.name) ||
    getText(user?.displayName) ||
    getText(googleProvider?.displayName) ||
    'Administrator'

  const email =
    getText(user?.email) ||
    getText(googleProvider?.email) ||
    getText(profile?.email) ||
    'GradeSync Administrator'

  const photoURL =
    getText(profile?.photoURL) ||
    getText(user?.photoURL) ||
    getText(googleProvider?.photoURL) ||
    null

  const currentPage =
    navigation.find((item) =>
      isActiveRoute(pathname, item.href)
    )?.name || 'Administration'

  const handleLogout = async () => {
    if (loggingOut) return

    setLoggingOut(true)
    setLogoutError('')

    try {
      await signOut(auth)

      setShowLogoutConfirm(false)
      setMobileOpen(false)

      router.replace('/admin/login')
    } catch (error) {
      console.error(
        '[GradeSync Admin] Logout failed:',
        error
      )

      setLogoutError(
        'Unable to sign out. Please try again.'
      )
    } finally {
      setLoggingOut(false)
    }
  }

  const openLogoutModal = () => {
    setMobileOpen(false)
    setLogoutError('')
    setShowLogoutConfirm(true)
  }

  const renderSidebar = (
    compact: boolean,
    mobile: boolean
  ) => (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#F1F9FF] via-[#DCEFFF] to-[#B7DCFA] text-slate-800">

      {/* Soft background details */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-24 h-72 w-72 rounded-full bg-white/60 blur-3xl" />
        <div className="absolute -bottom-36 -left-28 h-80 w-80 rounded-full bg-[#82C4F5]/30 blur-3xl" />
      </div>

      {/* Brand */}
      <div
        className={`relative z-10 flex shrink-0 items-center border-b border-[#B6D9F3]/65 ${
          compact
            ? 'h-[84px] justify-center px-2'
            : 'h-[84px] justify-between px-5'
        }`}
      >
        <Link
          href="/admin/dashboard"
          onClick={() => {
            if (mobile) setMobileOpen(false)
          }}
          title="GradeSync Administration"
          className={`flex min-w-0 items-center ${
            compact ? 'justify-center' : 'gap-3'
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#3A9BEB] to-[#1768B6] text-white shadow-[0_4px_12px_rgba(37,116,190,0.18)]">
            <GraduationCap size={25} strokeWidth={1.8} />
          </div>

          {!compact && (
            <div className="min-w-0">
              <h1 className="truncate text-[21px] font-extrabold tracking-[-0.055em] text-[#173E68]">
                GradeSync
              </h1>

              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5785AA]">
                Administration
              </p>
            </div>
          )}
        </Link>

        {mobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#487BA5] transition hover:bg-white/60 hover:text-[#174F86]"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Administrator profile */}
      <div
        className={`relative z-10 shrink-0 ${
          compact ? 'px-2.5 pt-5' : 'px-4 pt-6'
        }`}
      >
        {compact ? (
          <div className="flex justify-center">
            <div
              title={displayName}
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[#4B9CD8] text-white shadow-sm"
            >
              {photoURL && !imageError ? (
                <img
                  key={photoURL}
                  src={photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-base font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/85 bg-white/55 p-4 shadow-[0_3px_14px_rgba(57,119,169,0.055)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-gradient-to-br from-[#67B5ED] to-[#2477BB] text-white shadow-sm">
                {profileLoading ? (
                  <div className="h-full w-full animate-pulse bg-[#A7D7F6]" />
                ) : photoURL && !imageError ? (
                  <img
                    key={photoURL}
                    src={photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-base font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {profileLoading ? (
                  <div className="space-y-2">
                    <div className="h-3.5 w-28 animate-pulse rounded bg-[#BDDDF3]" />
                    <div className="h-3 w-36 animate-pulse rounded bg-[#D2E7F7]" />
                  </div>
                ) : (
                  <>
                    <p className="truncate text-[13px] font-bold text-[#183F67]">
                      {displayName}
                    </p>

                    <p className="mt-1 truncate text-[11px] text-[#6B91AF]">
                      {email}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-[#C9E2F5]/80 pt-3">
              <ShieldCheck
                size={15}
                className="text-[#2E84C6]"
              />

              <span className="text-[11px] font-semibold text-[#3876A7]">
                System Administrator
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Administrator navigation"
        className={`relative z-10 mt-8 min-h-0 flex-1 overflow-y-auto overscroll-contain ${
          compact ? 'px-2.5' : 'px-4'
        }`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#A4CCE9 transparent',
        }}
      >
        {!compact && (
          <div className="mb-3 flex items-center gap-3 px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#6B98B8]">
              Main Navigation
            </span>

            <div className="h-px flex-1 bg-[#B4D7F0]/75" />
          </div>
        )}

        <div className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon
            const active = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                title={compact ? item.name : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (mobile) setMobileOpen(false)
                }}
                className={`group relative flex min-h-[53px] items-center rounded-xl border transition-all duration-200 ${
                  compact
                    ? 'justify-center px-2'
                    : 'gap-3 px-3'
                } ${
                  active
                    ? 'border-[#A7D2F1] bg-gradient-to-r from-white via-white/95 to-[#E9F6FF] text-[#185B96] shadow-[0_3px_12px_rgba(55,128,190,0.09)]'
                    : 'border-transparent text-[#527E9F] hover:border-white/60 hover:bg-white/45 hover:text-[#195C96]'
                }`}
              >
                {active && (
                  <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full bg-[#2789D5]" />
                )}

                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
                    active
                      ? 'bg-[#E3F3FF] text-[#217DC4]'
                      : 'text-[#6797B9] group-hover:bg-white/60 group-hover:text-[#267DBD]'
                  }`}
                >
                  <Icon
                    size={19}
                    strokeWidth={active ? 2.2 : 1.9}
                  />
                </div>

                {!compact && (
                  <>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[13px] ${
                          active
                            ? 'font-bold text-[#185B96]'
                            : 'font-semibold'
                        }`}
                      >
                        {item.name}
                      </p>

                      <p
                        className={`mt-0.5 truncate text-[10px] ${
                          active
                            ? 'text-[#6095BC]'
                            : 'text-[#8AABC3]'
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>

                    {active && (
                      <ChevronRight
                        size={15}
                        className="shrink-0 text-[#4E9BD2]"
                      />
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div
        className={`relative z-10 shrink-0 border-t border-[#A7CFEA]/70 bg-white/25 backdrop-blur-sm ${
          compact ? 'px-2.5 py-4' : 'px-4 py-4'
        }`}
      >
        <button
          suppressHydrationWarning
          type="button"
          title={compact ? 'Sign out' : undefined}
          onClick={openLogoutModal}
          className={`group flex min-h-[45px] w-full items-center rounded-xl border border-transparent text-[#587E9D] transition-all duration-200 hover:border-red-200/80 hover:bg-red-50/80 hover:text-red-600 ${
            compact
              ? 'justify-center px-2'
              : 'gap-3 px-3.5'
          }`}
        >
          <LogOut
            size={18}
            className="shrink-0 transition-colors group-hover:text-red-600"
          />

          {!compact && (
            <span className="flex-1 text-left text-[13px] font-semibold">
              Sign Out
            </span>
          )}
        </button>

        {!compact && (
          <div className="mt-4 flex items-center justify-between border-t border-[#B6D8EF]/65 px-1 pt-4">
            <span className="text-[10px] font-medium text-[#789FBC]">
              GradeSync Administration
            </span>

            <span className="text-[10px] font-semibold text-[#789FBC]">
              v1.0
            </span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Admin sidebar"
        className={`relative hidden h-[100dvh] shrink-0 border-r border-[#C6E0F3] shadow-[4px_0_20px_rgba(70,128,176,0.035)] transition-[width] duration-300 ease-in-out lg:sticky lg:top-0 lg:block ${
          collapsed ? 'w-[82px]' : 'w-[280px]'
        }`}
      >
        {renderSidebar(collapsed, false)}

        <button
          suppressHydrationWarning
          type="button"
          onClick={() => setCollapsed((previous) => !previous)}
          aria-label={
            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
          }
          title={
            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
          }
          className="absolute -right-3.5 top-[104px] z-30 flex h-7 w-7 items-center justify-center rounded-full border border-[#B9D8ED] bg-white text-[#5487AD] shadow-sm transition hover:border-[#79B9E9] hover:text-[#1769A9]"
        >
          {collapsed ? (
            <PanelLeftOpen size={14} />
          ) : (
            <PanelLeftClose size={14} />
          )}
        </button>
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[#C6E0F3] bg-[#F2F9FF]/95 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open administrator navigation"
            aria-expanded={mobileOpen}
            aria-controls="gradesync-admin-mobile-sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#C6E0F3] bg-white text-[#2876B2] shadow-sm transition hover:bg-[#E5F3FE]"
          >
            <Menu size={21} />
          </button>

          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-[#184A76]">
              GradeSync
              <span className="ml-1.5 font-semibold text-[#4B9BD3]">
                Admin
              </span>
            </p>

            <p className="mt-0.5 text-[10px] font-medium text-[#7A9DB9]">
              {currentPage}
            </p>
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C8E4F8] bg-white text-[#3789C7]">
          <ShieldCheck size={19} />
        </div>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button
            suppressHydrationWarning
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-900/45 backdrop-blur-[2px]"
          />

          <aside
            id="gradesync-admin-mobile-sidebar"
            aria-label="Mobile administrator navigation"
            className="absolute inset-y-0 left-0 h-[100dvh] w-[min(310px,88vw)] shadow-2xl"
          >
            {renderSidebar(false, true)}
          </aside>
        </div>
      )}

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !loggingOut
            ) {
              setShowLogoutConfirm(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-logout-title"
            aria-describedby="admin-logout-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertTriangle size={20} />
                </div>

                <h2
                  id="admin-logout-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Sign Out
                </h2>
              </div>

              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                aria-label="Close logout confirmation"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="px-5 py-6 sm:px-6">
              <p
                id="admin-logout-description"
                className="text-sm leading-6 text-slate-600"
              >
                Are you sure you want to sign out of the
                GradeSync Administration Portal?
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                You will need to sign in again to access
                your administrator workspace.
              </p>

              {logoutError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  {logoutError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>

              <button
                suppressHydrationWarning
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60 sm:w-auto"
              >
                {loggingOut ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing out...
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    Sign Out
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
