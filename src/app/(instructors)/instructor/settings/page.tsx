
'use client'

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Settings as SettingsIcon,
  ShieldCheck,
  Bell,
  BellRing,
  Mail,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
  LogOut,
  ChevronRight,
  X,
  Sun,
  Moon,
  Monitor,
  Palette,
  Eye,
  Accessibility,
  Type,
  Zap,
  FileText,
  History,
  Share2,
  GraduationCap,
  Check,
  Info,
  RotateCcw,
  UserRound,
  SlidersHorizontal,
  Smartphone,
  ClipboardCheck,
  PenLine,
  Users,
  Megaphone,
} from 'lucide-react'

type ThemeMode = 'light' | 'dark' | 'system'
type DensityMode = 'comfortable' | 'compact'
type FontSizeMode = 'normal' | 'large'

type SectionId =
  | 'appearance'
  | 'notifications'
  | 'clearance'
  | 'accessibility'
  | 'privacy'
  | 'security'

type Notice = {
  type: 'success' | 'error' | 'info'
  message: string
} | null

interface SystemPreferences {
  theme: ThemeMode
  density: DensityMode
  fontSize: FontSizeMode
  reduceMotion: boolean
  highContrast: boolean
  inAppNotifications: boolean
  browserNotifications: boolean
  emailNotifications: boolean
  clearanceRequests: boolean
  studentResponses: boolean
  signatureUpdates: boolean
  announcementUpdates: boolean
  showPendingRequests: boolean
  showClearanceStatus: boolean
  confirmBeforeSigning: boolean
  confirmBeforeUpdating: boolean
  showRecentActivity: boolean
  showActivityDetails: boolean
}

type IconComponent = React.ComponentType<{
  className?: string
}>

const DEFAULT_PREFERENCES: SystemPreferences = {
  theme: 'light',
  density: 'comfortable',
  fontSize: 'normal',
  reduceMotion: false,
  highContrast: false,
  inAppNotifications: true,
  browserNotifications: false,
  emailNotifications: false,
  clearanceRequests: true,
  studentResponses: true,
  signatureUpdates: true,
  announcementUpdates: true,
  showPendingRequests: true,
  showClearanceStatus: true,
  confirmBeforeSigning: true,
  confirmBeforeUpdating: true,
  showRecentActivity: true,
  showActivityDetails: true,
}

const NAVIGATION: {
  id: SectionId
  label: string
  icon: IconComponent
}[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
  },
  {
    id: 'clearance',
    label: 'Clearance Preferences',
    icon: FileText,
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: Accessibility,
  },
  {
    id: 'privacy',
    label: 'Privacy & Activity',
    icon: ShieldCheck,
  },
  {
    id: 'security',
    label: 'Account Security',
    icon: LockKeyhole,
  },
]

function SettingToggle({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  icon: Icon,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  icon?: IconComponent
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
            <Icon className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {title}
          </p>

          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-blue-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconComponent
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-700" />

          <h2 className="text-base font-bold text-slate-900">
            {title}
          </h2>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <div className="divide-y divide-slate-100 px-5 sm:px-6">
        {children}
      </div>
    </section>
  )
}

function OptionButton({
  active,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  active: boolean
  onClick: () => void
  icon: IconComponent
  title: string
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200 ${
        active
          ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <Icon
          className={`h-5 w-5 ${
            active ? 'text-blue-700' : 'text-slate-500'
          }`}
        />

        {active && (
          <Check className="h-4 w-4 text-blue-700" />
        )}
      </div>

      <span className="text-sm font-semibold text-slate-900">
        {title}
      </span>

      {description && (
        <span className="text-xs text-slate-500">
          {description}
        </span>
      )}
    </button>
  )
}

type PanelAnimation = 'idle' | 'exit' | 'enter'

function useSmoothSettingsNavigation(
  initialSection: SectionId,
  reduceMotion: boolean
) {
  const [activeSection, setActiveSection] =
    useState<SectionId>(initialSection)

  const [displayedSection, setDisplayedSection] =
    useState<SectionId>(initialSection)

  const [animation, setAnimation] =
    useState<PanelAnimation>('idle')

  const [direction, setDirection] =
    useState<1 | -1>(1)

  const activeRef = useRef<SectionId>(initialSection)
  const displayedRef = useRef<SectionId>(initialSection)

  const exitTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const frameRef = useRef<number | null>(null)

  const clearAnimations = useCallback(() => {
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const switchSection = useCallback(
    (sectionId: SectionId) => {
      if (sectionId === activeRef.current) return

      clearAnimations()

      const previousIndex = NAVIGATION.findIndex(
        (item) => item.id === displayedRef.current
      )

      const nextIndex = NAVIGATION.findIndex(
        (item) => item.id === sectionId
      )

      const nextDirection: 1 | -1 =
        nextIndex >= previousIndex ? 1 : -1

      activeRef.current = sectionId
      setActiveSection(sectionId)
      setDirection(nextDirection)

      if (reduceMotion) {
        displayedRef.current = sectionId
        setDisplayedSection(sectionId)
        setAnimation('idle')
        return
      }

      setAnimation('exit')

      exitTimerRef.current = setTimeout(() => {
        displayedRef.current = sectionId
        setDisplayedSection(sectionId)
        setAnimation('enter')

        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = requestAnimationFrame(() => {
            setAnimation('idle')
            frameRef.current = null
          })
        })
      }, 170)
    },
    [clearAnimations, reduceMotion]
  )

  useEffect(() => {
    return () => clearAnimations()
  }, [clearAnimations])

  return {
    activeSection,
    displayedSection,
    animation,
    direction,
    switchSection,
  }
}

export default function InstructorSettingsPage() {
  const [preferences, setPreferences] =
    useState<SystemPreferences>({
      ...DEFAULT_PREFERENCES,
    })

  const [savedPreferences, setSavedPreferences] =
    useState<SystemPreferences>({
      ...DEFAULT_PREFERENCES,
    })

  const [notice, setNotice] = useState<Notice>(null)

  const {
    activeSection,
    displayedSection,
    animation,
    direction,
    switchSection,
  } = useSmoothSettingsNavigation(
    'appearance',
    preferences.reduceMotion
  )

  const updatePreference = useCallback(
    <K extends keyof SystemPreferences>(
      key: K,
      value: SystemPreferences[K]
    ) => {
      setPreferences((previous) => ({
        ...previous,
        [key]: value,
      }))

      setNotice(null)
    },
    []
  )

  const saveSettings = () => {
    setSavedPreferences({ ...preferences })

    setNotice({
      type: 'success',
      message:
        'UI preview saved locally. No changes were sent to Firebase.',
    })
  }

  const discardChanges = () => {
    setPreferences({ ...savedPreferences })

    setNotice({
      type: 'info',
      message:
        'Unsaved preview changes have been discarded.',
    })
  }

  const restoreDefaults = () => {
    setPreferences({ ...DEFAULT_PREFERENCES })

    setNotice({
      type: 'info',
      message:
        'Default preferences restored in this preview. No database changes were made.',
    })
  }

  const showPreviewNotice = (action: string) => {
    setNotice({
      type: 'info',
      message: `${action} is currently a UI preview. No account action was performed.`,
    })
  }

  const hasChanges =
    JSON.stringify(preferences) !==
    JSON.stringify(savedPreferences)

  const getPanelAnimationStyle = (): React.CSSProperties => {
    if (preferences.reduceMotion) {
      return {
        opacity: 1,
        transform: 'translateX(0)',
      }
    }

    if (animation === 'exit') {
      return {
        opacity: 0,
        transform:
          direction === 1
            ? 'translateX(-22px)'
            : 'translateX(22px)',
        filter: 'blur(3px)',
      }
    }

    if (animation === 'enter') {
      return {
        opacity: 0,
        transform:
          direction === 1
            ? 'translateX(22px)'
            : 'translateX(-22px)',
        filter: 'blur(3px)',
      }
    }

    return {
      opacity: 1,
      transform: 'translateX(0)',
      filter: 'blur(0)',
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
              <SettingsIcon className="h-4 w-4" />
              GradeSync Preferences
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Settings
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Personalize your GradeSync instructor
              experience, notifications, and system behavior.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">
            <ShieldCheck className="h-4 w-4" />
            Instructor Portal
          </div>
        </div>

        {/* NOTICE */}

        {notice && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : notice.type === 'error'
                  ? 'border-red-200 bg-red-50'
                  : 'border-blue-200 bg-blue-50'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
            ) : notice.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
            )}

            <p className="flex-1 text-sm font-medium text-slate-700">
              {notice.message}
            </p>

            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="rounded-lg p-1 text-slate-500 hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* SETTINGS HERO */}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <SlidersHorizontal className="h-10 w-10 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
                System Preferences
              </p>

              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Make GradeSync Yours
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100/80">
                Customize how you interact with student
                clearance requests, electronic signatures,
                notifications, activity history, and your
                instructor dashboard.
              </p>
            </div>

            <div className="self-start rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-blue-200">
                Preview Mode
              </p>

              <p className="mt-1 text-sm font-bold">
                STILL ON DEVELOPMENT
              </p>
            </div>
          </div>
        </div>

        {/* MAIN LAYOUT */}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">

          {/* SIDEBAR */}

          <aside className="lg:col-span-1">
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6">
              <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                Settings Menu
              </p>

              <nav
                aria-label="Settings sections"
                className="space-y-2"
              >
                {NAVIGATION.map((item) => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={
                        isActive ? 'page' : undefined
                      }
                      onClick={() => switchSection(item.id)}
                      className={`group relative flex w-full items-center justify-between overflow-hidden rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-300 ${
                        isActive
                          ? 'bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-100'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-700 transition-all duration-300 ${
                          isActive
                            ? 'scale-y-100 opacity-100'
                            : 'scale-y-0 opacity-0'
                        }`}
                      />

                      <span className="relative flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 transition-all duration-300 ${
                            isActive
                              ? 'scale-110 text-blue-700'
                              : 'text-slate-500 group-hover:text-blue-700'
                          }`}
                        />

                        {item.label}
                      </span>

                      <span className="relative">
                        {isActive ? (
                          <Check className="h-4 w-4 text-blue-700" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
                        )}
                      </span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* ACTIVE SETTINGS PANEL */}

          <div className="min-w-0 space-y-6 lg:col-span-3">
            <div
              className="relative min-w-0 overflow-hidden"
              aria-live="off"
            >
              <div
                style={{
                  ...getPanelAnimationStyle(),
                  transition: preferences.reduceMotion
                    ? 'none'
                    : 'opacity 170ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 170ms ease',
                  willChange:
                    'opacity, transform, filter',
                }}
              >

                {/* APPEARANCE */}

                {displayedSection === 'appearance' && (
                  <div id="appearance">
                    <SettingsSection
                      icon={Palette}
                      title="Appearance"
                      description="Choose how GradeSync looks and feels."
                    >
                      <div className="py-5">
                        <p className="text-sm font-semibold text-slate-900">
                          Theme
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Select your preferred application appearance.
                        </p>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <OptionButton
                            icon={Sun}
                            title="Light"
                            active={
                              preferences.theme === 'light'
                            }
                            onClick={() =>
                              updatePreference('theme', 'light')
                            }
                          />

                          <OptionButton
                            icon={Moon}
                            title="Dark"
                            active={
                              preferences.theme === 'dark'
                            }
                            onClick={() =>
                              updatePreference('theme', 'dark')
                            }
                          />

                          <OptionButton
                            icon={Monitor}
                            title="System"
                            active={
                              preferences.theme === 'system'
                            }
                            onClick={() =>
                              updatePreference('theme', 'system')
                            }
                          />
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Theme selection is a visual preview only.
                          It does not change your application&apos;s
                          global theme.
                        </p>
                      </div>

                      <div className="py-5">
                        <p className="text-sm font-semibold text-slate-900">
                          Layout Density
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Choose how much spacing to use in
                          supported GradeSync interfaces.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <OptionButton
                            icon={Smartphone}
                            title="Comfortable"
                            description="More breathing room"
                            active={
                              preferences.density ===
                              'comfortable'
                            }
                            onClick={() =>
                              updatePreference(
                                'density',
                                'comfortable'
                              )
                            }
                          />

                          <OptionButton
                            icon={SlidersHorizontal}
                            title="Compact"
                            description="Fit more on screen"
                            active={
                              preferences.density === 'compact'
                            }
                            onClick={() =>
                              updatePreference(
                                'density',
                                'compact'
                              )
                            }
                          />
                        </div>
                      </div>
                    </SettingsSection>
                  </div>
                )}

                {/* NOTIFICATIONS */}

                {displayedSection === 'notifications' && (
                  <div id="notifications">
                    <SettingsSection
                      icon={Bell}
                      title="Notifications"
                      description="Control which GradeSync instructor updates you want to receive."
                    >
                      <SettingToggle
                        icon={BellRing}
                        title="In-App Notifications"
                        description="Enable notification display inside supported GradeSync instructor pages."
                        checked={
                          preferences.inAppNotifications
                        }
                        onChange={(value) =>
                          updatePreference(
                            'inAppNotifications',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Monitor}
                        title="Browser Notifications"
                        description="Preview the browser notification preference. No browser permission will be requested."
                        checked={
                          preferences.browserNotifications
                        }
                        onChange={(value) =>
                          updatePreference(
                            'browserNotifications',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Mail}
                        title="Email Notifications"
                        description="Preview the email notification preference. No emails will be sent."
                        checked={
                          preferences.emailNotifications
                        }
                        onChange={(value) =>
                          updatePreference(
                            'emailNotifications',
                            value
                          )
                        }
                      />

                      <div className="py-5">
                        <p className="text-sm font-bold text-slate-900">
                          Notification Categories
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Choose which instructor-related events
                          should generate notifications when
                          supported by your notification service.
                        </p>
                      </div>

                      <SettingToggle
                        icon={ClipboardCheck}
                        title="New Clearance Requests"
                        description="Receive updates when students share new clearance requests with you."
                        checked={
                          preferences.clearanceRequests
                        }
                        onChange={(value) =>
                          updatePreference(
                            'clearanceRequests',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Users}
                        title="Student Responses"
                        description="Receive updates when students respond to or modify shared clearance requests."
                        checked={
                          preferences.studentResponses
                        }
                        onChange={(value) =>
                          updatePreference(
                            'studentResponses',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={PenLine}
                        title="Signature Updates"
                        description="Receive updates about electronic signatures associated with clearance documents."
                        checked={
                          preferences.signatureUpdates
                        }
                        onChange={(value) =>
                          updatePreference(
                            'signatureUpdates',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Megaphone}
                        title="Announcement Updates"
                        description="Receive updates when new official announcements are published for instructors."
                        checked={
                          preferences.announcementUpdates
                        }
                        onChange={(value) =>
                          updatePreference(
                            'announcementUpdates',
                            value
                          )
                        }
                      />
                    </SettingsSection>
                  </div>
                )}

                {/* CLEARANCE PREFERENCES */}

                {displayedSection === 'clearance' && (
                  <div id="clearance">
                    <SettingsSection
                      icon={FileText}
                      title="Clearance Preferences"
                      description="Personalize your instructor clearance review and signing workflow."
                    >
                      <SettingToggle
                        icon={ClipboardCheck}
                        title="Show Pending Requests"
                        description="Display pending student clearance requests on supported instructor dashboard sections."
                        checked={
                          preferences.showPendingRequests
                        }
                        onChange={(value) =>
                          updatePreference(
                            'showPendingRequests',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={FileText}
                        title="Show Clearance Status"
                        description="Display the latest status of student clearance documents assigned to you."
                        checked={
                          preferences.showClearanceStatus
                        }
                        onChange={(value) =>
                          updatePreference(
                            'showClearanceStatus',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={PenLine}
                        title="Confirm Before Signing"
                        description="Preview a confirmation step before applying your electronic signature to a clearance document."
                        checked={
                          preferences.confirmBeforeSigning
                        }
                        onChange={(value) =>
                          updatePreference(
                            'confirmBeforeSigning',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Share2}
                        title="Confirm Before Updating"
                        description="Preview a confirmation step before updating a student's clearance information."
                        checked={
                          preferences.confirmBeforeUpdating
                        }
                        onChange={(value) =>
                          updatePreference(
                            'confirmBeforeUpdating',
                            value
                          )
                        }
                      />

                      <div className="flex items-start gap-3 py-5">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                        <p className="text-xs leading-relaxed text-slate-500">
                          These preferences are UI previews only.
                          They do not modify student clearance
                          documents, electronic signatures,
                          request statuses, or Firestore permissions.
                          Existing clearance functionality remains
                          unchanged.
                        </p>
                      </div>
                    </SettingsSection>
                  </div>
                )}

                {/* ACCESSIBILITY */}

                {displayedSection === 'accessibility' && (
                  <div id="accessibility">
                    <SettingsSection
                      icon={Accessibility}
                      title="Accessibility"
                      description="Adjust readability and motion preferences."
                    >
                      <div className="py-5">
                        <p className="text-sm font-semibold text-slate-900">
                          Text Size
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Choose your preferred text size for
                          supported GradeSync pages.
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <OptionButton
                            icon={Type}
                            title="Normal"
                            description="Standard text"
                            active={
                              preferences.fontSize ===
                              'normal'
                            }
                            onClick={() =>
                              updatePreference(
                                'fontSize',
                                'normal'
                              )
                            }
                          />

                          <OptionButton
                            icon={Type}
                            title="Large"
                            description="Larger text"
                            active={
                              preferences.fontSize ===
                              'large'
                            }
                            onClick={() =>
                              updatePreference(
                                'fontSize',
                                'large'
                              )
                            }
                          />
                        </div>
                      </div>

                      <SettingToggle
                        icon={Zap}
                        title="Reduce Motion"
                        description="Reduce animations and transitions in supported interfaces."
                        checked={preferences.reduceMotion}
                        onChange={(value) =>
                          updatePreference(
                            'reduceMotion',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Eye}
                        title="High Contrast"
                        description="Preview stronger visual contrast for supported application interfaces."
                        checked={preferences.highContrast}
                        onChange={(value) =>
                          updatePreference(
                            'highContrast',
                            value
                          )
                        }
                      />
                    </SettingsSection>
                  </div>
                )}

                {/* PRIVACY */}

                {displayedSection === 'privacy' && (
                  <div id="privacy">
                    <SettingsSection
                      icon={ShieldCheck}
                      title="Privacy & Activity"
                      description="Control the visibility of your instructor activity information."
                    >
                      <SettingToggle
                        icon={History}
                        title="Show Recent Activity"
                        description="Display your recent clearance reviews, document updates, and signature activity on supported dashboard sections."
                        checked={
                          preferences.showRecentActivity
                        }
                        onChange={(value) =>
                          updatePreference(
                            'showRecentActivity',
                            value
                          )
                        }
                      />

                      <SettingToggle
                        icon={Eye}
                        title="Show Activity Details"
                        description="Show additional information in supported instructor activity history interfaces."
                        checked={
                          preferences.showActivityDetails
                        }
                        onChange={(value) =>
                          updatePreference(
                            'showActivityDetails',
                            value
                          )
                        }
                      />

                      <div className="flex items-start gap-3 py-5">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                        <p className="text-xs leading-relaxed text-slate-500">
                          These settings are UI previews only.
                          They do not delete Firestore activity
                          records, expose student information,
                          change account permissions, or override
                          database security rules.
                        </p>
                      </div>
                    </SettingsSection>
                  </div>
                )}

                {/* SECURITY */}

                {displayedSection === 'security' && (
                  <div id="security">
                    <SettingsSection
                      icon={LockKeyhole}
                      title="Account Security"
                      description="Manage authentication and instructor account access."
                    >
                      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Authentication
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            GradeSync uses Firebase Authentication
                            to manage account access.
                          </p>
                        </div>

                        <span className="inline-flex self-start items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                          <ShieldCheck className="h-4 w-4" />
                          Account Security
                        </span>
                      </div>

                      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Reset Password
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Request a password reset link for
                            your registered email address.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            showPreviewNotice(
                              'Password reset'
                            )
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Mail className="h-4 w-4" />
                          Send Reset Email
                        </button>
                      </div>

                      <div className="flex items-start gap-3 py-5">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

                        <p className="text-xs leading-relaxed text-slate-500">
                          Accounts using connected sign-in
                          providers such as Google or Facebook
                          may have their passwords managed
                          by those providers.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Instructor Profile
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Update your name, instructor
                            information, department, and other
                            personal details on your dedicated
                            Profile page.
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
                          <UserRound className="h-4 w-4" />
                          Managed Separately
                        </div>
                      </div>

                      <div className="py-5">
                        <button
                          type="button"
                          onClick={() =>
                            showPreviewNotice('Sign out')
                          }
                          className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <span className="flex items-center gap-2">
                            <LogOut className="h-4 w-4" />
                            Sign Out of GradeSync
                          </span>

                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </SettingsSection>
                  </div>
                )}
              </div>
            </div>

            {/* RESTORE DEFAULTS */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-slate-600" />

                    <h3 className="text-sm font-bold text-slate-900">
                      Restore Default Settings
                    </h3>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Reset appearance, notification, clearance,
                    privacy, and accessibility preferences
                    to their default values.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={restoreDefaults}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore Defaults
                </button>
              </div>
            </div>

            {/* SAVE BAR */}

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {hasChanges
                    ? 'You have unsaved changes'
                    : 'Your preview settings are up to date'}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Preview your preferences without saving
                  anything to your GradeSync account.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={discardChanges}
                  disabled={!hasChanges}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                  Discard
                </button>

                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={!hasChanges}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-700" />
            GradeSync Instructor Settings
          </div>

          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            UI Preview Mode
          </div>
        </div>
      </div>
    </div>
  )
}
