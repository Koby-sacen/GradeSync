
'use client'

import React, {
  useEffect,
  useState,
} from 'react'

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
  User,
  Mail,
  Shield,
  Calendar,
  Edit3,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  RefreshCw,
  Camera,
  IdCard,
  BookOpen,
  LockKeyhole,
} from 'lucide-react'

interface StudentProfileData {
  displayName: string
  photoURL: string
  email: string
  studentId: string
  yearAndSection: string
  program: string
}

const EMPTY_PROFILE: StudentProfileData = {
  displayName: '',
  photoURL: '',
  email: '',
  studentId: '',
  yearAndSection: '',
  program: '',
}

const getText = (value: unknown): string => {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

const getGoogleProviderEmail = (
  user: FirebaseUser
): string => {
  const googleProvider = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  return getText(googleProvider?.email)
}

const getGoogleProviderName = (
  user: FirebaseUser
): string => {
  const googleProvider = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  return getText(googleProvider?.displayName)
}

const getGoogleProviderPhoto = (
  user: FirebaseUser
): string => {
  const googleProvider = user.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  return getText(googleProvider?.photoURL)
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

export default function StudentProfilePage() {
  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [isEditing, setIsEditing] =
    useState(false)

  const [imageError, setImageError] =
    useState(false)

  const [profile, setProfile] =
    useState<StudentProfileData>(EMPTY_PROFILE)

  const [formData, setFormData] =
    useState<StudentProfileData>(EMPTY_PROFILE)

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
          setLoading(false)
          return
        }

        try {
          // Refresh Firebase Authentication information.
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

          const firestoreEmail =
            getText(data?.email) ||
            getText(data?.studentEmail)

          const firestoreName =
            getText(data?.displayName) ||
            getText(data?.fullName) ||
            getText(data?.name)

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

          setProfile(resolvedProfile)
          setFormData(resolvedProfile)
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
            'Unable to load your saved Firestore profile. Your Google account information is still available.'
          )
        } finally {
          if (active) {
            setLoading(false)
          }
        }
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
        'Please enter your full name.'
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

      // Update profile fields without overwriting
      // the user's role or verification permissions.
      await updateDoc(userDocRef, {
        displayName: updatedDisplayName,
        photoURL: updatedPhotoURL,
        email: resolvedEmail,
        studentId: updatedStudentId,
        yearAndSection: updatedYearAndSection,
        program: updatedProgram,
        updatedAt: serverTimestamp(),
      })

      // Synchronize editable profile information
      // with Firebase Authentication.
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

      if (authSyncError) {
        setSuccessMessage(
          'Your profile was saved to Firestore successfully.'
        )

        setErrorMessage(
          'Your Firebase Authentication display name or photo could not be synchronized. Your Firestore changes were saved.'
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-emerald-700 animate-spin" />

          <p className="text-sm font-medium text-slate-600">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <User className="w-10 h-10 text-slate-400 mx-auto mb-4" />

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

  const googleProvider = currentUser.providerData.find(
    (provider) => provider.providerId === 'google.com'
  )

  const isGoogleAccount = Boolean(googleProvider)

  // ============================================
  // PROFILE PAGE
  // ============================================

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">

        {/* HEADER BANNER */}

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-emerald-700" />

              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Student Account
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Student Profile
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Manage your personal credentials and academic clearance details.
            </p>
          </div>

          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEditing}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelEditing}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>

        {/* SUCCESS MESSAGE */}

        {successMessage && (
          <div
            role="status"
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-start gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />

            <span>{successMessage}</span>
          </div>
        )}

        {/* ERROR MESSAGE */}

        {errorMessage && (
          <div
            role="alert"
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />

            <span>{errorMessage}</span>
          </div>
        )}

        {/* PROFILE CARD */}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">

          {/* COVER */}

          <div className="h-32 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 px-6 sm:px-8 flex items-end">
            <div className="relative -bottom-10 h-24 w-24 rounded-2xl border-4 border-white bg-slate-300 shadow-md overflow-hidden flex items-center justify-center">
              {visiblePhoto && !imageError ? (
                <img
                  src={visiblePhoto}
                  alt={visibleName}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-full w-full bg-emerald-700 text-white font-bold text-3xl flex items-center justify-center">
                  {visibleName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* PROFILE DETAILS / EDIT FORM */}

          <div className="pt-14 p-6 sm:p-8">
            {!isEditing ? (
              <div className="space-y-6">

                {/* NAME AND SECTION */}

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {visibleName}
                  </h2>

                  <p className="text-sm text-slate-500 font-medium mt-1">
                    Section:{' '}
                    {profile.yearAndSection ||
                      'Not specified'}

                    {profile.studentId
                      ? ` • ID: ${profile.studentId}`
                      : ''}
                  </p>

                  {profile.program && (
                    <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                      <GraduationCap className="w-4 h-4 text-emerald-700" />

                      <span className="text-xs font-semibold text-emerald-800">
                        {profile.program}
                      </span>
                    </div>
                  )}
                </div>

                {/* INFORMATION GRID */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">

                  {/* EMAIL ADDRESS */}

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60 min-w-0">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Email Address
                      </p>

                      <p className="text-sm font-semibold text-slate-900 break-all mt-1">
                        {visibleEmail ||
                          'Email unavailable'}
                      </p>
                    </div>
                  </div>

                  {/* ACCOUNT ROLE */}

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Account Role
                      </p>

                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        Student Portal User
                      </p>
                    </div>
                  </div>

                  {/* STUDENT ID */}

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                      <IdCard className="w-5 h-5" />
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Student ID
                      </p>

                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {profile.studentId ||
                          'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* PROGRAM */}

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Program
                      </p>

                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {profile.program ||
                          'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* YEAR AND SECTION */}

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Year & Section
                      </p>

                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {profile.yearAndSection ||
                          'Not specified'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSaveProfile}
                className="space-y-6"
              >
                {/* EDIT HEADER */}

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Edit Student Information
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Your changes will be saved to your Firestore user profile.
                  </p>
                </div>

                {/* FORM FIELDS */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* FULL NAME */}

                  <div>
                    <label
                      htmlFor="student-display-name"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Full Name
                    </label>

                    <input
                      id="student-display-name"
                      type="text"
                      value={formData.displayName}
                      onChange={(event) =>
                        updateField(
                          'displayName',
                          event.target.value
                        )
                      }
                      placeholder="Enter your full name"
                      required
                      disabled={saving}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:opacity-60"
                    />
                  </div>

                  {/* PROFILE PHOTO */}

                  <div>
                    <label
                      htmlFor="student-photo-url"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Profile Photo URL
                    </label>

                    <div className="relative">
                      <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

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
                        placeholder="https://example.com/avatar.jpg"
                        disabled={saving}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* STUDENT ID */}

                  <div>
                    <label
                      htmlFor="student-id"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Student ID No.
                    </label>

                    <input
                      id="student-id"
                      type="text"
                      value={formData.studentId}
                      onChange={(event) =>
                        updateField(
                          'studentId',
                          event.target.value
                        )
                      }
                      placeholder="e.g. 233594"
                      disabled={saving}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:opacity-60"
                    />
                  </div>

                  {/* YEAR AND SECTION */}

                  <div>
                    <label
                      htmlFor="student-year-section"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Year & Section
                    </label>

                    <input
                      id="student-year-section"
                      type="text"
                      value={formData.yearAndSection}
                      onChange={(event) =>
                        updateField(
                          'yearAndSection',
                          event.target.value
                        )
                      }
                      placeholder="e.g. 4B - BSIS"
                      disabled={saving}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:opacity-60"
                    />
                  </div>

                  {/* PROGRAM */}

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="student-program"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Program
                    </label>

                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                      <input
                        id="student-program"
                        type="text"
                        value={formData.program}
                        onChange={(event) =>
                          updateField(
                            'program',
                            event.target.value
                          )
                        }
                        placeholder="e.g. Bachelor of Science in Information Systems"
                        disabled={saving}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium disabled:opacity-60"
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-slate-400">
                      Enter your academic program as it appears in your school records.
                    </p>
                  </div>

                </div>

                {/* EMAIL INFORMATION */}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">
                        Connected Email Address
                      </p>

                      <p className="text-sm text-slate-900 font-medium mt-1 break-all">
                        {visibleEmail ||
                          'Email unavailable from authentication providers'}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        Your email is managed by Firebase Authentication and cannot be edited from this form.
                      </p>
                    </div>
                  </div>
                </div>

                {/* SAVE AND CANCEL */}

                <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={saving}
                    className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}

                    {saving
                      ? 'Saving Changes...'
                      : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ACCOUNT CONNECTION INFORMATION */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50">
              <Shield className="w-5 h-5 text-emerald-700" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Account Connection
              </h3>

              <p className="text-xs text-slate-500 mt-0.5">
                Authentication information for your student account
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">
                Sign-In Provider
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {isGoogleAccount
                  ? 'Google'
                  : currentUser.providerData.length > 0
                    ? currentUser.providerData
                        .map((provider) => provider.providerId)
                        .join(', ')
                    : 'Firebase Authentication'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs text-slate-500">
                Profile Storage
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                Firestore / users
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
