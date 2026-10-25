
'use client'

import React, { useEffect, useState } from 'react'
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import {
  onAuthStateChanged,
  type User as FirebaseUser,
  updateProfile,
  reload,
  sendEmailVerification,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  UserRound,
  Mail,
  ShieldCheck,
  CalendarDays,
  Pencil,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  RefreshCw,
  Camera,
  BadgeCheck,
  LockKeyhole,
  Info,
  Building2,
  BriefcaseBusiness,
  Fingerprint,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Clock3,
  AtSign,
  Send,
} from 'lucide-react'

interface InstructorProfileData {
  displayName: string
  photoURL: string
  email: string
  department: string
  position: string
}

interface AccountMetadata {
  role: string
  verificationStatus: string
  createdAt: unknown
  updatedAt: unknown
}

const DEFAULT_DEPARTMENT =
  'College of Information and Communications Technology'

const DEFAULT_POSITION = 'Instructor I'

const EMPTY_PROFILE: InstructorProfileData = {
  displayName: '',
  photoURL: '',
  email: '',
  department: DEFAULT_DEPARTMENT,
  position: DEFAULT_POSITION,
}

const EMPTY_METADATA: AccountMetadata = {
  role: 'instructor',
  verificationStatus: 'none',
  createdAt: null,
  updatedAt: null,
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getProviderValue(
  user: FirebaseUser,
  field: 'email' | 'displayName' | 'photoURL'
): string {
  const google = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  const preferred = getText(google?.[field])

  if (preferred) return preferred

  const other = user.providerData.find(
    (provider) => Boolean(provider[field])
  )

  return getText(other?.[field])
}

function getFirebaseEmail(user: FirebaseUser): string {
  return (
    getText(user.email) ||
    getProviderValue(user, 'email')
  )
}

function getFirebaseName(user: FirebaseUser): string {
  return (
    getText(user.displayName) ||
    getProviderValue(user, 'displayName')
  )
}

function getFirebasePhoto(user: FirebaseUser): string {
  return (
    getText(user.photoURL) ||
    getProviderValue(user, 'photoURL')
  )
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return 'I'

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase()
  }

  return (
    words[0].charAt(0) +
    words[words.length - 1].charAt(0)
  ).toUpperCase()
}

function formatDate(value: unknown): string {
  if (!value) return 'Not available'

  let date: Date | null = null

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    date = (value as { toDate: () => Date }).toDate()
  } else if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string') {
    date = new Date(value)
  }

  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })
}

function InformationCard({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div
      className={`group flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/40 ${
        wide ? 'sm:col-span-2' : ''
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-slate-900">
          {value || 'Not specified'}
        </p>
      </div>
    </div>
  )
}

function ProfileField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required = false,
  type = 'text',
  description,
  icon: Icon,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled: boolean
  required?: boolean
  type?: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-semibold text-slate-700"
      >
        <Icon className="h-4 w-4 text-blue-700" />
        {label}
      </label>

      <input
        suppressHydrationWarning
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {description && (
        <p className="text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-900">
          {value}
        </p>
      </div>
    </div>
  )
}

export default function InstructorProfilePage() {
  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [copied, setCopied] = useState(false)

  const [checkingVerification, setCheckingVerification] =
    useState(false)
  const [sendingVerification, setSendingVerification] =
    useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  const [profile, setProfile] =
    useState<InstructorProfileData>(EMPTY_PROFILE)

  const [formData, setFormData] =
    useState<InstructorProfileData>(EMPTY_PROFILE)

  const [metadata, setMetadata] =
    useState<AccountMetadata>(EMPTY_METADATA)

  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    let requestId = 0

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        const thisRequest = ++requestId

        if (!active) return

        setLoading(true)
        setCurrentUser(user)
        setIsEditing(false)
        setImageError(false)
        setPreviewError(false)
        setSuccessMessage('')
        setErrorMessage('')

        if (!user) {
          setProfile(EMPTY_PROFILE)
          setFormData(EMPTY_PROFILE)
          setMetadata(EMPTY_METADATA)
          setEmailVerified(false)
          setLoading(false)
          return
        }

        setEmailVerified(user.emailVerified)

        try {
          try {
            await reload(user)
          } catch (reloadError) {
            console.warn(
              '[Instructor Profile] Auth refresh failed:',
              reloadError
            )
          }

          if (!active || thisRequest !== requestId) return

          setEmailVerified(user.emailVerified)

          const userRef = doc(db, 'users', user.uid)
          const snapshot = await getDoc(userRef)

          if (!active || thisRequest !== requestId) return

          const data = snapshot.exists()
            ? snapshot.data()
            : null

          const resolvedProfile: InstructorProfileData = {
            displayName:
              getText(data?.displayName) ||
              getText(data?.fullName) ||
              getText(data?.name) ||
              getFirebaseName(user),

            photoURL:
              getText(data?.photoURL) ||
              getFirebasePhoto(user),

            email:
              getFirebaseEmail(user) ||
              getText(data?.email) ||
              getText(data?.instructorEmail),

            department:
              getText(data?.department) ||
              DEFAULT_DEPARTMENT,

            position:
              getText(data?.position) ||
              DEFAULT_POSITION,
          }

          setProfile(resolvedProfile)
          setFormData(resolvedProfile)

          setMetadata({
            role: getText(data?.role) || 'instructor',
            verificationStatus:
              getText(data?.verificationStatus) || 'none',
            createdAt:
              data?.createdAt ??
              new Date(user.metadata.creationTime || ''),
            updatedAt: data?.updatedAt ?? null,
          })
        } catch (error) {
          console.error(
            '[Instructor Profile] Failed to load profile:',
            error
          )

          if (!active || thisRequest !== requestId) return

          const fallback: InstructorProfileData = {
            displayName: getFirebaseName(user),
            photoURL: getFirebasePhoto(user),
            email: getFirebaseEmail(user),
            department: DEFAULT_DEPARTMENT,
            position: DEFAULT_POSITION,
          }

          setProfile(fallback)
          setFormData(fallback)
          setMetadata({
            ...EMPTY_METADATA,
            createdAt: new Date(
              user.metadata.creationTime || ''
            ),
          })

          setErrorMessage(
            'Unable to load your Firestore profile. Your Firebase Authentication details are still available.'
          )
        } finally {
          if (active && thisRequest === requestId) {
            setLoading(false)
          }
        }
      },
      (error) => {
        if (!active) return

        console.error(
          '[Instructor Profile] Authentication error:',
          error
        )
        setErrorMessage('Unable to verify your account.')
        setLoading(false)
      }
    )

    return () => {
      active = false
      requestId++
      unsubscribe()
    }
  }, [])

  const updateField = (
    field: keyof InstructorProfileData,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const handleStartEditing = () => {
    setFormData({ ...profile })
    setPreviewError(false)
    setSuccessMessage('')
    setErrorMessage('')
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    if (saving) return

    setFormData({ ...profile })
    setPreviewError(false)
    setIsEditing(false)
    setErrorMessage('')
  }

  const handleRefreshVerification = async () => {
    if (!currentUser || checkingVerification) return

    setCheckingVerification(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await reload(currentUser)

      const verified = currentUser.emailVerified
      setEmailVerified(verified)

      setSuccessMessage(
        verified
          ? 'Your email address is verified!'
          : 'Your email is connected, but Firebase has not confirmed email verification yet.'
      )
    } catch (error) {
      console.error(
        '[Instructor Profile] Verification refresh failed:',
        error
      )

      setErrorMessage(
        'Unable to refresh email verification. Please try again.'
      )
    } finally {
      setCheckingVerification(false)
    }
  }

  const handleSendVerification = async () => {
    if (!currentUser || sendingVerification || emailVerified) {
      return
    }

    if (!getText(currentUser.email)) {
      setErrorMessage(
        'Firebase Authentication does not have an email address available for verification.'
      )
      return
    }

    setSendingVerification(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await sendEmailVerification(currentUser)

      setSuccessMessage(
        'Verification email sent! Check your inbox and spam folder, open the verification link, then click Refresh Status.'
      )
    } catch (error: unknown) {
      console.error(
        '[Instructor Profile] Verification email failed:',
        error
      )

      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : ''

      if (code === 'auth/too-many-requests') {
        setErrorMessage(
          'Too many verification requests. Please wait before trying again.'
        )
      } else if (code === 'auth/requires-recent-login') {
        setErrorMessage(
          'Please sign in again before requesting verification.'
        )
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to send verification email.'
        )
      }
    } finally {
      setSendingVerification(false)
    }
  }

  const handleSaveProfile = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!currentUser || saving) return

    const updatedName = formData.displayName.trim()
    const updatedPhoto = formData.photoURL.trim()
    const updatedDepartment = formData.department.trim()
    const updatedPosition = formData.position.trim()

    if (!updatedName) {
      setErrorMessage('Please enter your full name.')
      return
    }

    if (
      updatedPhoto &&
      !/^https?:\/\/\S+$/i.test(updatedPhoto)
    ) {
      setErrorMessage(
        'Please enter a valid HTTP or HTTPS profile photo URL.'
      )
      return
    }

    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const userRef = doc(db, 'users', currentUser.uid)

      const updatedProfile: InstructorProfileData = {
        displayName: updatedName,
        photoURL: updatedPhoto,
        email:
          getFirebaseEmail(currentUser) ||
          profile.email,
        department: updatedDepartment,
        position: updatedPosition,
      }

      await updateDoc(userRef, {
        displayName: updatedName,
        photoURL: updatedPhoto,
        department: updatedDepartment,
        position: updatedPosition,
        updatedAt: serverTimestamp(),
      })

      let authSyncError = false

      try {
        await updateProfile(currentUser, {
          displayName: updatedName,
          photoURL: updatedPhoto || null,
        })
      } catch (error) {
        authSyncError = true
        console.warn(
          '[Instructor Profile] Auth synchronization failed:',
          error
        )
      }

      setProfile(updatedProfile)
      setFormData(updatedProfile)
      setImageError(false)
      setPreviewError(false)
      setIsEditing(false)

      setMetadata((previous) => ({
        ...previous,
        updatedAt: new Date(),
      }))

      if (authSyncError) {
        setSuccessMessage(
          'Your instructor profile was saved to Firestore.'
        )
        setErrorMessage(
          'Firebase Authentication could not be synchronized. Your Firestore changes were saved.'
        )
      } else {
        setSuccessMessage(
          'Your instructor profile has been updated successfully!'
        )
      }
    } catch (error: unknown) {
      console.error(
        '[Instructor Profile] Failed to save profile:',
        error
      )

      setErrorMessage(
        error instanceof Error
          ? `Unable to save your profile: ${error.message}`
          : 'Unable to save your profile. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCopyUID = async () => {
    if (!currentUser) return

    try {
      await navigator.clipboard.writeText(currentUser.uid)
      setCopied(true)
    } catch (error) {
      console.error('Unable to copy account UID:', error)
      setErrorMessage('Unable to copy your account ID.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <RefreshCw className="h-7 w-7 animate-spin text-blue-700" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            Loading instructor profile...
          </p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <LockKeyhole className="h-8 w-8 text-blue-700" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Sign In Required
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Please sign in to access your instructor profile.
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Go to Login
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    )
  }

  const visibleName =
    profile.displayName ||
    getFirebaseName(currentUser) ||
    'Unnamed Instructor'

  const visibleEmail =
    getFirebaseEmail(currentUser) ||
    profile.email

  const visiblePhoto =
    profile.photoURL ||
    getFirebasePhoto(currentUser)

  const hasEmail = Boolean(visibleEmail)

  const emailStatus = !hasEmail
    ? 'No Email Connected'
    : emailVerified
      ? 'Verified Email'
      : 'Email Connected'

  const emailVerificationLabel = !hasEmail
    ? 'No Email Connected'
    : emailVerified
      ? 'Verified'
      : 'Verification Pending'

  const isGoogleAccount = currentUser.providerData.some(
    (provider) => provider.providerId === 'google.com'
  )

  const isFacebookAccount = currentUser.providerData.some(
    (provider) => provider.providerId === 'facebook.com'
  )

  const isPasswordAccount = currentUser.providerData.some(
    (provider) => provider.providerId === 'password'
  )

  const providerNames = [
    isGoogleAccount ? 'Google' : '',
    isFacebookAccount ? 'Facebook' : '',
    isPasswordAccount ? 'Email / Password' : '',
  ]
    .filter(Boolean)
    .join(', ')

  const previewPhoto = isEditing
    ? formData.photoURL.trim()
    : visiblePhoto

  const previewName = isEditing
    ? formData.displayName.trim() || visibleName
    : visibleName

  return (
    <div className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              <GraduationCap className="h-4 w-4" />
              GradeSync Faculty Portal
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Instructor Profile
            </h1>

            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Manage your professional identity, academic
              information, and account details.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800">
            <ShieldCheck className="h-4 w-4" />
            Faculty Account
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
            <p className="flex-1 text-sm font-medium text-emerald-800">
              {successMessage}
            </p>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setSuccessMessage('')}
              aria-label="Dismiss success message"
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="flex-1 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setErrorMessage('')}
              aria-label="Dismiss error message"
              className="rounded-lg p-1 text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Profile Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#102b60] via-[#153b82] to-[#2563eb] text-white shadow-xl shadow-blue-950/10">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border-[45px] border-white/5" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-44 w-44 rounded-full bg-blue-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-indigo-300/10 blur-3xl" />

          <div className="relative p-6 sm:p-8 lg:p-9">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                Faculty Identity
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Active Session
              </div>
            </div>

            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="relative shrink-0 self-start">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/20 bg-white/15 shadow-2xl sm:h-32 sm:w-32">
                  {visiblePhoto && !imageError ? (
                    <img
                      src={visiblePhoto}
                      alt={visibleName}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <span className="text-4xl font-bold text-white">
                      {getInitials(visibleName)}
                    </span>
                  )}
                </div>

                <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-4 border-[#19418a] bg-white text-blue-700 shadow-lg">
                  <GraduationCap className="h-5 w-5" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                  Instructor Account
                </p>

                <h2 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  {visibleName}
                </h2>

                <p className="mt-2 break-all text-sm text-blue-100/80">
                  {visibleEmail}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {profile.position || 'Instructor'}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    <Building2 className="h-3.5 w-3.5" />
                    {profile.department || 'Faculty'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 self-start">
                {!isEditing ? (
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={handleStartEditing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-950 shadow-lg transition hover:bg-blue-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Profile
                  </button>
                ) : (
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel Editing
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 bg-black/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 px-6 py-4">
              <ShieldCheck className="h-5 w-5 text-blue-200" />
              <div>
                <p className="text-[11px] text-blue-200">
                  Account Type
                </p>
                <p className="text-sm font-semibold">
                  Faculty / Instructor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4">
              <BadgeCheck className="h-5 w-5 text-blue-200" />
              <div>
                <p className="text-[11px] text-blue-200">
                  Email Status
                </p>
                <p className="text-sm font-semibold">
                  {emailStatus}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4">
              <CalendarDays className="h-5 w-5 text-blue-200" />
              <div>
                <p className="text-[11px] text-blue-200">
                  Member Since
                </p>
                <p className="text-sm font-semibold">
                  {formatDate(metadata.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">

          {/* Primary Column */}
          <div className="space-y-6 xl:col-span-2">

            {/* Personal Information */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <UserRound className="h-5 w-5 text-blue-700" />
                    <h3 className="text-base font-bold text-slate-900">
                      Personal Information
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Your professional identity and contact details.
                  </p>
                </div>

                {isEditing && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    Editing Profile
                  </span>
                )}
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
                  <InformationCard
                    icon={UserRound}
                    label="Full Name"
                    value={visibleName}
                  />
                  <InformationCard
                    icon={Mail}
                    label="Email Address"
                    value={visibleEmail}
                  />
                  <InformationCard
                    icon={ShieldCheck}
                    label="Account Role"
                    value="Faculty / Instructor"
                  />
                  <InformationCard
                    icon={BadgeCheck}
                    label="Email Status"
                    value={emailStatus}
                  />
                </div>
              ) : (
                <form
                  id="instructor-profile-form"
                  onSubmit={handleSaveProfile}
                  className="space-y-7 p-5 sm:p-6"
                >
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <ProfileField
                        id="instructor-display-name"
                        label="Full Name"
                        value={formData.displayName}
                        onChange={(value) =>
                          updateField('displayName', value)
                        }
                        placeholder="Enter your full name"
                        disabled={saving}
                        required
                        icon={UserRound}
                        description="This name appears on your instructor profile and supported GradeSync pages."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Mail className="h-4 w-4 text-blue-700" />
                        Email Address
                      </label>

                      <input
                        suppressHydrationWarning
                        type="email"
                        value={visibleEmail}
                        readOnly
                        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600"
                      />

                      <p className="mt-2 text-xs text-slate-500">
                        Your sign-in email is managed by Firebase
                        Authentication.
                      </p>
                    </div>
                  </div>

                  {/* Profile Photo */}
                  <div className="border-t border-slate-100 pt-6">
                    <div className="mb-5 flex items-center gap-2">
                      <Camera className="h-5 w-5 text-blue-700" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Profile Photo
                      </h4>
                    </div>

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-blue-50 text-blue-800">
                        {previewPhoto && !previewError ? (
                          <img
                            src={previewPhoto}
                            alt="Profile photo preview"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onError={() => setPreviewError(true)}
                          />
                        ) : (
                          <span className="text-2xl font-bold">
                            {getInitials(previewName)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <ProfileField
                          id="instructor-photo-url"
                          label="Profile Photo URL"
                          type="url"
                          value={formData.photoURL}
                          onChange={(value) => {
                            updateField('photoURL', value)
                            setPreviewError(false)
                          }}
                          placeholder="https://example.com/avatar.jpg"
                          disabled={saving}
                          icon={Camera}
                          description="Enter a publicly accessible image URL. Your preview updates automatically."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Professional Information */}
                  <div className="border-t border-slate-100 pt-6">
                    <div className="mb-5">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-blue-700" />
                        <h4 className="text-base font-bold text-slate-900">
                          Professional Information
                        </h4>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Update your academic affiliation and position.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <ProfileField
                        id="instructor-department"
                        label="Department / College"
                        value={formData.department}
                        onChange={(value) =>
                          updateField('department', value)
                        }
                        placeholder="Enter your department"
                        disabled={saving}
                        icon={Building2}
                      />

                      <ProfileField
                        id="instructor-position"
                        label="Academic Position"
                        value={formData.position}
                        onChange={(value) =>
                          updateField('position', value)
                        }
                        placeholder="e.g. Instructor I"
                        disabled={saving}
                        icon={BriefcaseBusiness}
                      />
                    </div>
                  </div>

                  {/* Save Actions */}
                  <div className="flex flex-col justify-end gap-3 border-t border-slate-100 pt-6 sm:flex-row">
                    <button
                      suppressHydrationWarning
                      type="button"
                      onClick={handleCancelEditing}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>

                    <button
                      suppressHydrationWarning
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saving
                        ? 'Saving Changes...'
                        : 'Save Profile'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Professional Details */}
            {!isEditing && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-5 w-5 text-blue-700" />
                    <h3 className="text-base font-bold text-slate-900">
                      Professional Information
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Your academic position and institutional affiliation.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
                  <InformationCard
                    icon={Building2}
                    label="Department / College"
                    value={profile.department}
                  />

                  <InformationCard
                    icon={BriefcaseBusiness}
                    label="Academic Position"
                    value={profile.position}
                  />

                  <InformationCard
                    icon={GraduationCap}
                    label="Portal Access"
                    value="Instructor Portal"
                  />

                  <InformationCard
                    icon={ShieldCheck}
                    label="Account Classification"
                    value="Faculty Member"
                  />
                </div>
              </section>
            )}

            {/* About Profile */}
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <h3 className="text-sm font-bold text-blue-950">
                  About Your Instructor Profile
                </h3>

                <p className="mt-1 text-xs leading-6 text-blue-900/80">
                  Your professional information is saved in
                  Firestore and synchronized with Firebase
                  Authentication where supported. Updating your
                  profile does not automatically modify historical
                  clearance requests or previously submitted records.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <aside className="space-y-6">

            {/* Account Details */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-blue-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Account Overview
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Your account information at a glance.
                </p>
              </div>

              <div className="divide-y divide-slate-100 px-5">
                <DetailRow
                  icon={ShieldCheck}
                  label="Account Role"
                  value={metadata.role || 'instructor'}
                />

                <DetailRow
                  icon={CalendarDays}
                  label="Member Since"
                  value={formatDate(metadata.createdAt)}
                />

                <DetailRow
                  icon={Clock3}
                  label="Last Profile Update"
                  value={formatDate(metadata.updatedAt)}
                />

                <DetailRow
                  icon={AtSign}
                  label="Authentication Provider"
                  value={
                    providerNames || 'Firebase Authentication'
                  }
                />

                <div className="py-4">
                  <p className="text-xs text-slate-500">
                    Account Status
                  </p>

                  <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed In
                  </span>
                </div>
              </div>
            </section>

            {/* Account Security */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-blue-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Account Security
                  </h3>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Firebase Authentication
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Your sign-in credentials are managed by
                      Firebase Authentication and your connected
                      sign-in providers.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-600">
                      Email Connection
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        hasEmail
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {hasEmail ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  <p className="mt-2 break-all text-xs text-slate-500">
                    {visibleEmail || 'No email available'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">
                      Email Verification
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        emailVerified
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {emailVerificationLabel}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {emailVerified
                      ? 'Firebase Authentication confirms this email address is verified.'
                      : hasEmail
                        ? 'Your email is connected to your account. Verification has not yet been confirmed by Firebase.'
                        : 'No email address is available for verification.'}
                  </p>

                  {hasEmail && (
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={handleRefreshVerification}
                        disabled={checkingVerification}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            checkingVerification
                              ? 'animate-spin'
                              : ''
                          }`}
                        />
                        {checkingVerification
                          ? 'Checking...'
                          : 'Refresh Verification Status'}
                      </button>

                      {!emailVerified && Boolean(currentUser.email) && (
                        <button
                          suppressHydrationWarning
                          type="button"
                          onClick={handleSendVerification}
                          disabled={sendingVerification}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
                        >
                          {sendingVerification ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {sendingVerification
                            ? 'Sending...'
                            : 'Send Verification Email'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-slate-500">
                  For security, changing your profile information
                  does not change your sign-in email or password.
                </p>
              </div>
            </section>

            {/* Account Identifier */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-blue-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Account Identifier
                  </h3>
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs leading-relaxed text-slate-500">
                  Your unique Firebase account identifier.
                </p>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="break-all font-mono text-xs leading-relaxed text-slate-700">
                    {currentUser.uid}
                  </p>
                </div>

                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={handleCopyUID}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}

                  {copied ? 'Copied Account ID' : 'Copy Account ID'}
                </button>
              </div>
            </section>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>
            GradeSync • Instructor Profile Management
          </p>

          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Powered by Firebase Authentication
          </div>
        </div>
      </div>
    </div>
  )
}
