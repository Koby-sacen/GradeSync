
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
  IdCard,
  BookOpen,
  BadgeCheck,
  LockKeyhole,
  Info,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface StudentProfileData {
  displayName: string
  photoURL: string
  email: string
  studentId: string
  yearAndSection: string
  program: string
}

interface AccountMetadata {
  role: string
  verificationStatus: string
  createdAt: unknown
  updatedAt: unknown
}

const EMPTY_PROFILE: StudentProfileData = {
  displayName: '',
  photoURL: '',
  email: '',
  studentId: '',
  yearAndSection: '',
  program: '',
}

const EMPTY_METADATA: AccountMetadata = {
  role: 'student',
  verificationStatus: 'none',
  createdAt: null,
  updatedAt: null,
}

// ============================================
// HELPERS
// ============================================

const getText = (value: unknown): string => {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

const getGoogleProviderEmail = (
  user: FirebaseUser
): string => {
  const provider = user.providerData.find(
    (item) => item.providerId === 'google.com'
  )

  return getText(provider?.email)
}

const getGoogleProviderName = (
  user: FirebaseUser
): string => {
  const provider = user.providerData.find(
    (item) => item.providerId === 'google.com'
  )

  return getText(provider?.displayName)
}

const getGoogleProviderPhoto = (
  user: FirebaseUser
): string => {
  const provider = user.providerData.find(
    (item) => item.providerId === 'google.com'
  )

  return getText(provider?.photoURL)
}

const getFirebaseEmail = (
  user: FirebaseUser
): string => {
  return (
    getText(user.email) ||
    getGoogleProviderEmail(user) ||
    getText(
      user.providerData.find(
        (provider) => Boolean(provider.email)
      )?.email
    )
  )
}

const getFirebaseName = (
  user: FirebaseUser
): string => {
  return (
    getText(user.displayName) ||
    getGoogleProviderName(user) ||
    getText(
      user.providerData.find(
        (provider) => Boolean(provider.displayName)
      )?.displayName
    )
  )
}

const getFirebasePhoto = (
  user: FirebaseUser
): string => {
  return (
    getText(user.photoURL) ||
    getGoogleProviderPhoto(user) ||
    getText(
      user.providerData.find(
        (provider) => Boolean(provider.photoURL)
      )?.photoURL
    )
  )
}

const getInitials = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'S'

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase()
  }

  return (
    words[0].charAt(0) +
    words[words.length - 1].charAt(0)
  ).toUpperCase()
}

const formatDate = (value: unknown): string => {
  if (!value) return 'Not available'

  let date: Date | null = null

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    date = (
      value as { toDate: () => Date }
    ).toDate()
  } else if (value instanceof Date) {
    date = value
  }

  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ============================================
// REUSABLE INFORMATION CARD
// ============================================

function InformationCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    className?: string
  }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4 min-w-0">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-semibold text-slate-900">
          {value || 'Not specified'}
        </p>
      </div>
    </div>
  )
}

// ============================================
// REUSABLE FORM FIELD
// ============================================

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
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {description && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      )}
    </div>
  )
}

// ============================================
// STUDENT PROFILE PAGE
// ============================================

export default function StudentProfilePage() {
  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [imageError, setImageError] = useState(false)

  const [profile, setProfile] =
    useState<StudentProfileData>(EMPTY_PROFILE)

  const [formData, setFormData] =
    useState<StudentProfileData>(EMPTY_PROFILE)

  const [metadata, setMetadata] =
    useState<AccountMetadata>(EMPTY_METADATA)

  const [successMessage, setSuccessMessage] =
    useState('')

  const [errorMessage, setErrorMessage] =
    useState('')

  // ============================================
  // LOAD FIREBASE AUTH AND FIRESTORE PROFILE
  // ============================================

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!active) return

        setLoading(true)
        setErrorMessage('')
        setSuccessMessage('')
        setCurrentUser(user)
        setIsEditing(false)
        setImageError(false)

        if (!user) {
          setProfile(EMPTY_PROFILE)
          setFormData(EMPTY_PROFILE)
          setMetadata(EMPTY_METADATA)
          setLoading(false)
          return
        }

        try {
          // Refresh Firebase Authentication data.
          try {
            await reload(user)
          } catch (reloadError) {
            console.warn(
              '[Student Profile] Unable to refresh Firebase Auth:',
              reloadError
            )
          }

          if (!active) return

          const authEmail = getFirebaseEmail(user)
          const authName = getFirebaseName(user)
          const authPhoto = getFirebasePhoto(user)

          const userDocRef = doc(
            db,
            'users',
            user.uid
          )

          const userSnap = await getDoc(userDocRef)

          if (!active) return

          const data = userSnap.exists()
            ? userSnap.data()
            : null

          // Always prioritize the Firestore displayName.
          const firestoreName =
            getText(data?.displayName) ||
            getText(data?.fullName) ||
            getText(data?.name)

          const firestoreEmail =
            getText(data?.email) ||
            getText(data?.studentEmail)

          const firestorePhoto =
            getText(data?.photoURL)

          const resolvedProfile: StudentProfileData = {
            displayName:
              firestoreName ||
              authName ||
              '',

            photoURL:
              firestorePhoto ||
              authPhoto ||
              '',

            email:
              authEmail ||
              firestoreEmail ||
              '',

            studentId:
              getText(data?.studentId),

            yearAndSection:
              getText(data?.yearAndSection),

            program:
              getText(data?.program) ||
              getText(data?.course),
          }

          const resolvedMetadata: AccountMetadata = {
            role: getText(data?.role) || 'student',
            verificationStatus:
              getText(data?.verificationStatus) ||
              'none',
            createdAt: data?.createdAt ?? null,
            updatedAt: data?.updatedAt ?? null,
          }

          setProfile(resolvedProfile)
          setFormData(resolvedProfile)
          setMetadata(resolvedMetadata)
          setCurrentUser(user)
        } catch (error) {
          console.error(
            '[Student Profile] Error loading profile:',
            error
          )

          if (!active) return

          const fallbackProfile: StudentProfileData = {
            displayName: getFirebaseName(user),
            photoURL: getFirebasePhoto(user),
            email: getFirebaseEmail(user),
            studentId: '',
            yearAndSection: '',
            program: '',
          }

          setProfile(fallbackProfile)
          setFormData(fallbackProfile)

          setErrorMessage(
            'Unable to load your saved Firestore profile. Your authentication account information is still available.'
          )
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      },
      (error) => {
        if (!active) return

        console.error(
          '[Student Profile] Authentication error:',
          error
        )

        setErrorMessage(
          'Unable to verify your account.'
        )
        setLoading(false)
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // ============================================
  // UPDATE FORM FIELD
  // ============================================

  const updateField = (
    field: keyof StudentProfileData,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  // ============================================
  // START EDITING
  // ============================================

  const handleStartEditing = () => {
    setFormData({ ...profile })
    setSuccessMessage('')
    setErrorMessage('')
    setIsEditing(true)
  }

  // ============================================
  // CANCEL EDITING
  // ============================================

  const handleCancelEditing = () => {
    setFormData({ ...profile })
    setIsEditing(false)
    setErrorMessage('')
  }

  // ============================================
  // SAVE PROFILE TO FIRESTORE AND FIREBASE AUTH
  // ============================================

  const handleSaveProfile = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!currentUser || saving) {
      return
    }

    const updatedDisplayName =
      formData.displayName.trim()

    const updatedPhotoURL =
      formData.photoURL.trim()

    const updatedStudentId =
      formData.studentId.trim()

    const updatedYearAndSection =
      formData.yearAndSection.trim()

    const updatedProgram =
      formData.program.trim()

    const resolvedEmail =
      getFirebaseEmail(currentUser) ||
      profile.email

    if (!updatedDisplayName) {
      setErrorMessage(
        'Please enter your display name.'
      )
      return
    }

    if (
      updatedPhotoURL &&
      !/^https?:\/\/\S+$/i.test(updatedPhotoURL)
    ) {
      setErrorMessage(
        'Please enter a valid profile photo URL.'
      )
      return
    }

    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const userDocRef = doc(
        db,
        'users',
        currentUser.uid
      )

      // Preserve fullName, role, verification fields,
      // and all other existing Firestore fields.
      await updateDoc(userDocRef, {
        displayName: updatedDisplayName,
        photoURL: updatedPhotoURL,
        email: resolvedEmail,
        studentId: updatedStudentId,
        yearAndSection: updatedYearAndSection,
        program: updatedProgram,
        updatedAt: serverTimestamp(),
      })

      let authSyncError = false

      try {
        await updateProfile(currentUser, {
          displayName: updatedDisplayName,
          photoURL: updatedPhotoURL || null,
        })
      } catch (error) {
        authSyncError = true

        console.warn(
          '[Student Profile] Firebase Auth profile synchronization failed:',
          error
        )
      }

      const updatedProfile: StudentProfileData = {
        displayName: updatedDisplayName,
        photoURL: updatedPhotoURL,
        email: resolvedEmail,
        studentId: updatedStudentId,
        yearAndSection: updatedYearAndSection,
        program: updatedProgram,
      }

      setProfile(updatedProfile)
      setFormData(updatedProfile)
      setImageError(false)
      setIsEditing(false)

      setMetadata((previous) => ({
        ...previous,
        updatedAt: new Date(),
      }))

      if (authSyncError) {
        setSuccessMessage(
          'Your profile was saved to Firestore successfully.'
        )

        setErrorMessage(
          'Firebase Authentication could not be synchronized, but your Firestore changes were saved.'
        )
      } else {
        setSuccessMessage(
          'Your student profile has been updated successfully!'
        )
      }
    } catch (error: unknown) {
      console.error(
        '[Student Profile] Error updating profile:',
        error
      )

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update your profile.'

      setErrorMessage(
        `Unable to save your profile to Firestore: ${message}`
      )
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // LOADING SCREEN
  // ============================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-emerald-700" />

          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading student profile...
          </p>
        </div>
      </div>
    )
  }

  // ============================================
  // NOT SIGNED IN
  // ============================================

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <UserRound className="mx-auto mb-4 h-10 w-10 text-slate-400" />

          <h2 className="text-lg font-bold text-slate-900">
            Sign In Required
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Please sign in to view your student profile.
          </p>
        </div>
      </div>
    )
  }

  const visibleName =
    profile.displayName ||
    getFirebaseName(currentUser) ||
    'Unnamed Student'

  const visibleEmail =
    getFirebaseEmail(currentUser) ||
    profile.email

  const visiblePhoto =
    profile.photoURL ||
    getFirebasePhoto(currentUser)

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

  // ============================================
  // PROFILE PAGE
  // ============================================

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">
              <UserRound className="h-4 w-4" />
              Student Account
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Profile
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your personal information and academic
              clearance details.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            Student Account
          </div>
        </div>

        {/* =====================================
            SUCCESS MESSAGE
        ===================================== */}

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
              type="button"
              onClick={() => setSuccessMessage('')}
              aria-label="Dismiss success message"
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =====================================
            ERROR MESSAGE
        ===================================== */}

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
              type="button"
              onClick={() => setErrorMessage('')}
              aria-label="Dismiss error message"
              className="rounded-lg p-1 text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =====================================
            PROFILE HERO
        ===================================== */}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">

            {/* PROFILE PHOTO */}
            <div className="shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                {visiblePhoto && !imageError ? (
                  <img
                    src={visiblePhoto}
                    alt={visibleName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-3xl font-bold">
                    {getInitials(visibleName)}
                  </span>
                )}
              </div>
            </div>

            {/* PROFILE IDENTITY */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">
                Student Profile
              </p>

              <h2 className="mt-2 break-words text-2xl font-bold sm:text-3xl">
                {visibleName}
              </h2>

              <p className="mt-1 break-all text-sm text-emerald-100/80">
                {visibleEmail}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Student
                </span>

                {profile.studentId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    <IdCard className="h-3.5 w-3.5" />
                    {profile.studentId}
                  </span>
                )}

                {profile.yearAndSection && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    <BookOpen className="h-3.5 w-3.5" />
                    {profile.yearAndSection}
                  </span>
                )}
              </div>
            </div>

            {/* EDIT PROFILE */}
            {!isEditing ? (
              <button
                type="button"
                onClick={handleStartEditing}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"
              >
                <Pencil className="h-4 w-4" />
                Edit Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel Editing
              </button>
            )}
          </div>
        </div>

        {/* =====================================
            MAIN CONTENT
        ===================================== */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* LEFT CONTENT */}
          <div className="space-y-6 xl:col-span-2">

            {/* =================================
                PROFILE INFORMATION
            ================================= */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <UserRound className="h-5 w-5 text-emerald-700" />

                    <h3 className="text-base font-bold text-slate-900">
                      Personal Information
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Your account identity and contact information.
                  </p>
                </div>

                {isEditing && (
                  <span className="self-start rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    Editing Profile
                  </span>
                )}
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
                  <InformationCard
                    icon={UserRound}
                    label="Display Name"
                    value={profile.displayName}
                  />

                  <InformationCard
                    icon={Mail}
                    label="Email Address"
                    value={visibleEmail}
                  />

                  <InformationCard
                    icon={IdCard}
                    label="Student ID"
                    value={profile.studentId}
                  />

                  <InformationCard
                    icon={ShieldCheck}
                    label="Account Role"
                    value="Student Portal User"
                  />
                </div>
              ) : (
                <form
                  id="student-profile-edit-form"
                  onSubmit={handleSaveProfile}
                  className="space-y-6 p-5 sm:p-6"
                >
                  {/* DISPLAY NAME */}
                  <ProfileField
                    id="student-display-name"
                    label="Display Name"
                    value={formData.displayName}
                    onChange={(value) =>
                      updateField('displayName', value)
                    }
                    placeholder="Enter your display name"
                    disabled={saving}
                    required
                    description="This is the preferred name shown on your profile and supported GradeSync pages."
                  />

                  {/* EMAIL ADDRESS */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Email Address
                    </label>

                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="email"
                        value={visibleEmail}
                        readOnly
                        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3 pl-11 pr-4 text-sm text-slate-600"
                      />
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Your sign-in email is managed by your
                      authentication provider.
                    </p>
                  </div>

                  {/* PROFILE PHOTO */}
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-emerald-700" />

                      <label
                        htmlFor="student-photo-url"
                        className="text-sm font-semibold text-slate-700"
                      >
                        Profile Photo URL
                      </label>
                    </div>

                    <input
                      id="student-photo-url"
                      type="url"
                      value={formData.photoURL}
                      onChange={(event) =>
                        updateField(
                          'photoURL',
                          event.target.value
                        )
                      }
                      disabled={saving}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                    />

                    <p className="mt-2 text-xs text-slate-500">
                      Enter a publicly accessible image URL.
                    </p>
                  </div>

                  {/* STUDENT ID */}
                  <ProfileField
                    id="student-id"
                    label="Student ID Number"
                    value={formData.studentId}
                    onChange={(value) =>
                      updateField('studentId', value)
                    }
                    placeholder="Enter your student ID"
                    disabled={saving}
                  />

                  {/* =================================
                      ACADEMIC INFORMATION
                  ================================= */}

                  <div className="border-t border-slate-100 pt-6">
                    <div className="mb-5 flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-emerald-700" />

                      <h3 className="text-base font-bold text-slate-900">
                        Academic Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <ProfileField
                        id="student-year-section"
                        label="Year & Section"
                        value={formData.yearAndSection}
                        onChange={(value) =>
                          updateField(
                            'yearAndSection',
                            value
                          )
                        }
                        placeholder="e.g. 4B - BSIS"
                        disabled={saving}
                      />

                      <ProfileField
                        id="student-program"
                        label="Academic Program"
                        value={formData.program}
                        onChange={(value) =>
                          updateField('program', value)
                        }
                        placeholder="Enter your program"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* SAVE ACTIONS */}
                  <div className="flex flex-col justify-end gap-3 border-t border-slate-100 pt-6 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleCancelEditing}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}

                      {saving
                        ? 'Saving Changes...'
                        : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* =================================
                ACADEMIC INFORMATION CARD
            ================================= */}

            {!isEditing && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-emerald-700" />

                    <h3 className="text-base font-bold text-slate-900">
                      Academic Information
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Academic details associated with your
                    GradeSync student account.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
                  <InformationCard
                    icon={GraduationCap}
                    label="Academic Program"
                    value={profile.program}
                  />

                  <InformationCard
                    icon={BookOpen}
                    label="Year & Section"
                    value={profile.yearAndSection}
                  />
                </div>
              </div>
            )}

            {/* =================================
                PROFILE INFORMATION NOTE
            ================================= */}

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  About Your Profile
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                  Your profile information is saved to
                  Firestore and used by supported GradeSync
                  features. Updating your display name does
                  not automatically rename existing clearance
                  request records.
                </p>
              </div>
            </div>
          </div>

          {/* =====================================
              RIGHT SIDEBAR
          ===================================== */}

          <div className="space-y-6">

            {/* ACCOUNT DETAILS */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-700" />

                  <h3 className="text-base font-bold text-slate-900">
                    Account Details
                  </h3>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <p className="text-xs text-slate-500">
                    Account Role
                  </p>

                  <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                    {metadata.role}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Member Since
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(metadata.createdAt)}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Last Profile Update
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(metadata.updatedAt)}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Authentication Provider
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {providerNames ||
                      'Firebase Authentication'}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Account Status
                  </p>

                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed In
                  </span>
                </div>
              </div>
            </div>

            {/* ACCOUNT SECURITY */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-emerald-700" />

                  <h3 className="text-base font-bold text-slate-900">
                    Account Security
                  </h3>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Firebase Authentication
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Your account uses Firebase Authentication
                      to manage your sign-in identity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* PROFILE SUMMARY */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-emerald-700" />

                  <h3 className="text-base font-bold text-slate-900">
                    Profile Summary
                  </h3>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs text-slate-500">
                    Preferred Display Name
                  </p>

                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {visibleName}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Student ID
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {profile.studentId || 'Not specified'}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Year & Section
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {profile.yearAndSection ||
                      'Not specified'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================
            FOOTER
        ===================================== */}

        <div className="flex flex-col items-center justify-between gap-3 py-4 text-xs text-slate-400 sm:flex-row">
          <p>
            GradeSync • Student Profile
          </p>

          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              Profile information managed with Firebase.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
