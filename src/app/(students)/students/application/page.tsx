
'use client'

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileImage,
  GraduationCap,
  IdCard,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type ApplicationForm = {
  fullName: string
  employeeId: string
  email: string
  phone: string
  college: string
  department: string
  position: string
}

type ApplicationStatus = 'pending' | 'approved' | 'rejected'

type SubmissionStage =
  | 'idle'
  | 'checking'
  | 'compressing'
  | 'saving'
  | 'verifying'

const initialForm: ApplicationForm = {
  fullName: '',
  employeeId: '',
  email: '',
  phone: '',
  college: '',
  department: '',
  position: '',
}

const colleges = [
  'College of Arts and Sciences',
  'College of Education',
  'College of Engineering',
  'College of Industrial Technology',
  'College of Nursing and Health Sciences',
  'College of Information and Communications Technology',
  'College of Agriculture and Fisheries',
  'Other',
]

const positions = [
  'Instructor',
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Lecturer',
  'Part-Time Instructor',
  'Other',
]

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10'

const OPERATION_TIMEOUT_MS = 25000
const MAX_ORIGINAL_FILE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_DATA_URL_LENGTH = 650000

function getApplicationStatus(value: unknown): ApplicationStatus {
  const status = String(value || 'pending').toLowerCase()

  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'

  return 'pending'
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code)
  }

  return ''
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}

function friendlyFirebaseError(error: unknown): string {
  const code = getErrorCode(error)

  if (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied'
  ) {
    return 'Firestore permission denied. Your published Firestore rules must allow the signed-in student to create their own application in the applications collection.'
  }

  if (
    code === 'unavailable' ||
    code === 'firestore/unavailable'
  ) {
    return 'Firestore is currently unavailable. Please check your internet connection and try again.'
  }

  if (
    code === 'deadline-exceeded' ||
    code === 'firestore/deadline-exceeded'
  ) {
    return 'Firestore took too long to respond. Please check your application status before trying again.'
  }

  if (
    code === 'resource-exhausted' ||
    code === 'firestore/resource-exhausted'
  ) {
    return 'The application document may be too large or your Firestore quota may have been exceeded.'
  }

  if (
    code === 'unauthenticated' ||
    code === 'firestore/unauthenticated'
  ) {
    return 'Your authentication session has expired. Please sign in again.'
  }

  return getErrorMessage(error)
}

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(message))
    }, milliseconds)

    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

type CompressedImage = {
  dataUrl: string
  width: number
  height: number
  estimatedBytes: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(
        new Error(
          'The selected image could not be opened. Please choose a valid JPG, PNG, or WEBP image.'
        )
      )
    }

    image.src = objectUrl
  })
}

async function compressImageForFirestore(
  file: File
): Promise<CompressedImage> {
  const image = await loadImage(file)

  const maxDimensions = [1400, 1200, 1000, 800]
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42]

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error(
      'Your browser could not process the image. Please try another browser.'
    )
  }

  for (const maxDimension of maxDimensions) {
    const scale = Math.min(
      1,
      maxDimension / Math.max(image.width, image.height)
    )

    const width = Math.max(
      1,
      Math.round(image.width * scale)
    )

    const height = Math.max(
      1,
      Math.round(image.height * scale)
    )

    canvas.width = width
    canvas.height = height

    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL(
        'image/jpeg',
        quality
      )

      if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
        return {
          dataUrl,
          width,
          height,
          estimatedBytes: Math.ceil(
            (dataUrl.split(',')[1]?.length || 0) * 0.75
          ),
        }
      }
    }
  }

  throw new Error(
    'This identification image is too detailed to fit safely inside a Firestore document. Please crop unnecessary background areas and select the image again.'
  )
}

function SectionHeading({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: string
  title: string
  description: string
  icon: React.ComponentType<{
    size?: number
    className?: string
  }>
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-5 sm:px-7">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
        <Icon size={21} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
          Section {number}
        </div>

        <h2 className="text-base font-bold text-slate-900 sm:text-lg">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  )
}

function FormField({
  label,
  required = false,
  hint,
  className = '',
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-2">
        <label className="text-sm font-semibold text-slate-700">
          {label}
          {required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </label>
      </div>

      {children}

      {hint && (
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
}

function TimelineItem({
  number,
  title,
  description,
  last = false,
}: {
  number: string
  title: string
  description: string
  last?: boolean
}) {
  return (
    <div className="relative flex gap-3">
      {!last && (
        <div className="absolute bottom-[-18px] left-[13px] top-7 w-px bg-slate-200" />
      )}

      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700">
        {number}
      </div>

      <div className="pb-2">
        <p className="text-sm font-semibold text-slate-800">
          {title}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  )
}

export default function ApplicationPage() {
  const [form, setForm] = useState<ApplicationForm>(initialForm)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [existingApplication, setExistingApplication] =
    useState<ApplicationStatus | null>(null)
  const [checkingApplication, setCheckingApplication] =
    useState(true)

  const [submissionStage, setSubmissionStage] =
    useState<SubmissionStage>('idle')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setAuthLoading(false)
      setCheckingApplication(true)
      setExistingApplication(null)
    })
  }, [])

  const checkApplicationStatus = useCallback(
    async (user: User): Promise<ApplicationStatus | null> => {
      const applicationRef = doc(
        db,
        'applications',
        user.uid
      )

      const snapshot = await withTimeout(
        getDoc(applicationRef),
        OPERATION_TIMEOUT_MS,
        'Checking your existing application took too long. Please check your connection.'
      )

      if (!snapshot.exists()) return null

      return getApplicationStatus(snapshot.data().status)
    },
    []
  )

  useEffect(() => {
    if (authLoading) return

    let active = true

    const checkApplication = async () => {
      if (!currentUser) {
        if (active) {
          setCheckingApplication(false)
        }
        return
      }

      try {
        const status = await checkApplicationStatus(currentUser)

        if (!active) return

        setExistingApplication(status)
      } catch (err) {
        console.error(
          '[GradeSync Application] Status check failed:',
          err
        )

        if (active) {
          setError(friendlyFirebaseError(err))
        }
      } finally {
        if (active) {
          setCheckingApplication(false)
        }
      }
    }

    void checkApplication()

    return () => {
      active = false
    }
  }, [
    authLoading,
    currentUser,
    checkApplicationStatus,
  ])

  useEffect(() => {
    return () => {
      if (idPreview) {
        URL.revokeObjectURL(idPreview)
      }
    }
  }, [idPreview])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [error])

  const updateField = (
    field: keyof ApplicationForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
    setError('')
  }

  const handleFile = (file?: File) => {
    if (!file || submitting) return

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.')
      return
    }

    if (file.size === 0) {
      setError('The selected image is empty.')
      return
    }

    if (file.size > MAX_ORIGINAL_FILE_BYTES) {
      setError(
        'The original image must not exceed 10 MB. Please select a smaller image.'
      )
      return
    }

    setIdFile(file)
    setIdPreview(URL.createObjectURL(file))
    setError('')
  }

  const removeFile = () => {
    if (submitting) return

    setIdFile(null)
    setIdPreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const resetForm = () => {
    if (submitting) return

    setForm(initialForm)
    removeFile()
    setAgreed(false)
    setError('')
    setSubmitted(false)
    setSubmissionStage('idle')
    setShowResetConfirm(false)
  }

  const personalComplete = Boolean(
    form.fullName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
      form.phone.trim()
  )

  const facultyComplete = Boolean(
    form.employeeId.trim() &&
      form.position &&
      form.college &&
      form.department.trim()
  )

  const checklist = [
    {
      title: 'Personal Information',
      description: 'Name and contact information',
      complete: personalComplete,
    },
    {
      title: 'Faculty Information',
      description: 'Employment and department details',
      complete: facultyComplete,
    },
    {
      title: 'Identification Document',
      description: 'Valid faculty or employee ID',
      complete: Boolean(idFile),
    },
    {
      title: 'Declaration',
      description: 'Accuracy and consent confirmation',
      complete: agreed,
    },
  ]

  const completedCount = checklist.filter(
    (item) => item.complete
  ).length

  const progress = Math.round(
    (completedCount / checklist.length) * 100
  )

  const stageMessage: Record<SubmissionStage, string> = {
    idle: '',
    checking: 'Checking your application...',
    compressing: 'Preparing your ID image for Firestore...',
    saving: 'Saving your application to Firestore...',
    verifying: 'Verifying your application...',
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (submittingRef.current) return

    setError('')

    if (!currentUser) {
      setError(
        'You must be signed in to submit an instructor application.'
      )
      return
    }

    if (authLoading || checkingApplication) {
      setError(
        'Please wait while your account information is being verified.'
      )
      return
    }

    if (existingApplication) {
      setError(
        'You already have an instructor application on record.'
      )
      return
    }

    if (Object.values(form).some((value) => !value.trim())) {
      setError(
        'Please complete all required instructor information.'
      )
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.')
      return
    }

    if (!idFile) {
      setError(
        'Please upload a valid faculty or employee ID.'
      )
      return
    }

    if (!agreed) {
      setError(
        'Please confirm the declaration before continuing.'
      )
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setSubmissionStage('checking')

    let firestoreSaveStarted = false

    try {
      const user = auth.currentUser

      if (!user || user.uid !== currentUser.uid) {
        throw new Error(
          'Your session has changed. Please sign in again.'
        )
      }

      await withTimeout(
        user.getIdToken(),
        OPERATION_TIMEOUT_MS,
        'Firebase Authentication took too long to respond.'
      )

      const applicationRef = doc(
        db,
        'applications',
        user.uid
      )

      const existingSnapshot = await withTimeout(
        getDoc(applicationRef),
        OPERATION_TIMEOUT_MS,
        'Firestore took too long to check your existing application.'
      )

      if (existingSnapshot.exists()) {
        const status = getApplicationStatus(
          existingSnapshot.data().status
        )

        setExistingApplication(status)

        throw new Error(
          'You have already submitted an instructor application.'
        )
      }

      setSubmissionStage('compressing')

      console.info(
        '[GradeSync Application] Compressing ID image'
      )

      const compressedImage =
        await compressImageForFirestore(idFile)

      console.info(
        '[GradeSync Application] Image ready:',
        compressedImage.estimatedBytes,
        'bytes'
      )

      const trimmedForm = {
        fullName: form.fullName.trim(),
        employeeId: form.employeeId.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        college: form.college.trim(),
        department: form.department.trim(),
        position: form.position.trim(),
      }

      setSubmissionStage('saving')
      firestoreSaveStarted = true

      console.info(
        '[GradeSync Application] Saving to applications collection'
      )

      await withTimeout(
        runTransaction(db, async (transaction) => {
          const latestApplication =
            await transaction.get(applicationRef)

          if (latestApplication.exists()) {
            throw new Error(
              'An application has already been submitted for this account.'
            )
          }

          transaction.set(applicationRef, {
            ...trimmedForm,

            userId: user.uid,
            uid: user.uid,
            applicantUid: user.uid,

            accountEmail: user.email || '',
            accountDisplayName: user.displayName || '',

            applicationType: 'instructor',
            status: 'pending',
            verificationStatus: 'pending',

            idImageUrl: compressedImage.dataUrl,
            idImageData: compressedImage.dataUrl,
            idImagePath: '',
            idImageStorage: 'firestore-base64',

            idFileName: idFile.name,
            idFileType: 'image/jpeg',
            idFileSize: compressedImage.estimatedBytes,
            idOriginalFileName: idFile.name,
            idOriginalFileType: idFile.type,
            idOriginalFileSize: idFile.size,
            idImageWidth: compressedImage.width,
            idImageHeight: compressedImage.height,

            declarationAccepted: true,
            declarationAcceptedAt: serverTimestamp(),

            submittedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            reviewedAt: null,
            reviewedBy: '',
            rejectionReason: '',
          })
        }),
        OPERATION_TIMEOUT_MS,
        'Firestore took too long to save your application. The result may be uncertain; please check your application status before trying again.'
      )

      console.info(
        '[GradeSync Application] Successfully saved to Firestore'
      )

      setExistingApplication('pending')
      setSubmitted(true)
      setError('')
    } catch (err) {
      console.error(
        '[GradeSync Application] Submission error:',
        err
      )

      if (firestoreSaveStarted) {
        setSubmissionStage('verifying')

        try {
          const snapshot = await withTimeout(
            getDoc(
              doc(db, 'applications', currentUser.uid)
            ),
            OPERATION_TIMEOUT_MS,
            'Unable to verify the application status.'
          )

          if (snapshot.exists()) {
            const status = getApplicationStatus(
              snapshot.data().status
            )

            setExistingApplication(status)
            setSubmitted(status === 'pending')
            setError('')
            return
          }
        } catch (verificationError) {
          console.error(
            '[GradeSync Application] Verification error:',
            verificationError
          )

          setError(
            'The submission result could not be confirmed. Refresh this page and check your application status before submitting again. ' +
              friendlyFirebaseError(err)
          )

          return
        }
      }

      setError(friendlyFirebaseError(err))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      setSubmissionStage('idle')
    }
  }

  if (submitted || existingApplication) {
    const status = submitted
      ? 'pending'
      : existingApplication

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
              status === 'rejected'
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {status === 'rejected' ? (
              <AlertCircle size={34} />
            ) : (
              <CheckCircle2 size={34} />
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {status === 'approved'
              ? 'Application Approved'
              : status === 'rejected'
                ? 'Application Reviewed'
                : 'Application Submitted'}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-500">
            {status === 'approved'
              ? 'Your instructor application has been approved. Your account has been granted instructor privileges.'
              : status === 'rejected'
                ? 'Your instructor application has been reviewed and rejected. Please contact the GradeSync administrator for further assistance.'
                : 'Your instructor application has been submitted for administrator review. Your existing account role will remain unchanged until approval.'}
          </p>

          <div
            className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${
              status === 'rejected'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <ShieldCheck size={15} />
            {status === 'approved'
              ? 'Approved'
              : status === 'rejected'
                ? 'Rejected'
                : 'Pending Administrator Review'}
          </div>

          {submitted && (
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-7 block w-full rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              View Application Status
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 font-sans text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <GraduationCap
              size={16}
              className="text-emerald-700"
            />
            <span>GradeSync</span>
            <span className="text-slate-300">/</span>
            <span>Account Services</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-emerald-700">
              Instructor Application
            </span>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Instructor Account Application
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Complete the official application form below to
                request instructor access to the GradeSync
                platform.
              </p>
            </div>

            <div className="flex w-fit shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck size={16} />
              Account Verification
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-emerald-900 text-white shadow-sm">
          <div className="relative p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-white/10" />

            <div className="relative flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 sm:flex">
                <BadgeCheck size={25} />
              </div>

              <div className="max-w-3xl">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                  GradeSync Faculty Registration
                </div>

                <h2 className="text-xl font-bold leading-snug sm:text-2xl">
                  Request Instructor Access
                </h2>

                <p className="mt-3 text-sm leading-7 text-emerald-50/85">
                  GradeSync provides a convenient and organized
                  digital clearance experience for students and
                  instructors. Submit your official faculty
                  information and a valid institutional ID to
                  request access to instructor features. All
                  applications are subject to administrator
                  verification and approval.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 bg-emerald-950/30 px-6 py-3 text-xs text-emerald-100/90 sm:px-8">
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} />
              Identity Verification Required
            </span>
            <span className="flex items-center gap-2">
              <ClipboardCheck size={14} />
              Administrator Approval Required
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              number: '01',
              title: 'Complete the Form',
              description:
                'Provide your official faculty information.',
              icon: UserRound,
            },
            {
              number: '02',
              title: 'Upload Identification',
              description: 'Attach a valid institutional ID.',
              icon: IdCard,
            },
            {
              number: '03',
              title: 'Submit for Review',
              description: 'Await administrator verification.',
              icon: ClipboardCheck,
            },
          ].map((step) => {
            const Icon = step.icon

            return (
              <div
                key={step.number}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icon size={20} />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    Step {step.number}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-slate-800">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3"
        >
          <div className="space-y-6 lg:col-span-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                number="01"
                title="Instructor Information"
                description="Please provide your official personal and professional details."
                icon={UserRound}
              />

              <div className="space-y-7 p-5 sm:p-7">
                <div>
                  <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <UserRound
                      size={17}
                      className="text-emerald-700"
                    />
                    <h3 className="text-sm font-bold text-slate-800">
                      A. Personal & Contact Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      label="Full Name"
                      required
                      className="sm:col-span-2"
                      hint="Enter your name as it appears on your institutional ID."
                    >
                      <div className="relative">
                        <UserRound
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          suppressHydrationWarning
                          type="text"
                          autoComplete="name"
                          value={form.fullName}
                          onChange={(e) =>
                            updateField(
                              'fullName',
                              e.target.value
                            )
                          }
                          placeholder="e.g. Juan Dela Cruz"
                          className={`${inputClass} pl-10`}
                          required
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Institutional Email Address"
                      required
                    >
                      <div className="relative">
                        <Mail
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          suppressHydrationWarning
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) =>
                            updateField(
                              'email',
                              e.target.value
                            )
                          }
                          placeholder="name@ssu.edu.ph"
                          className={`${inputClass} pl-10`}
                          required
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Contact Number"
                      required
                    >
                      <div className="relative">
                        <Phone
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          suppressHydrationWarning
                          type="tel"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={(e) =>
                            updateField(
                              'phone',
                              e.target.value
                            )
                          }
                          placeholder="09XXXXXXXXX"
                          className={`${inputClass} pl-10`}
                          required
                        />
                      </div>
                    </FormField>
                  </div>
                </div>

                <div>
                  <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Building2
                      size={17}
                      className="text-emerald-700"
                    />
                    <h3 className="text-sm font-bold text-slate-800">
                      B. Employment & Academic Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      label="Employee / Faculty ID Number"
                      required
                    >
                      <div className="relative">
                        <IdCard
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          suppressHydrationWarning
                          type="text"
                          value={form.employeeId}
                          onChange={(e) =>
                            updateField(
                              'employeeId',
                              e.target.value
                            )
                          }
                          placeholder="Enter your employee ID"
                          className={`${inputClass} pl-10`}
                          required
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Academic Position"
                      required
                    >
                      <div className="relative">
                        <select
                          suppressHydrationWarning
                          value={form.position}
                          onChange={(e) =>
                            updateField(
                              'position',
                              e.target.value
                            )
                          }
                          className={`${inputClass} appearance-none pr-10`}
                          required
                        >
                          <option value="">
                            Select academic position
                          </option>
                          {positions.map((position) => (
                            <option
                              key={position}
                              value={position}
                            >
                              {position}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={17}
                          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="College"
                      required
                      className="sm:col-span-2"
                    >
                      <div className="relative">
                        <Building2
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <select
                          suppressHydrationWarning
                          value={form.college}
                          onChange={(e) =>
                            updateField(
                              'college',
                              e.target.value
                            )
                          }
                          className={`${inputClass} appearance-none pl-10 pr-10`}
                          required
                        >
                          <option value="">
                            Select your college
                          </option>
                          {colleges.map((college) => (
                            <option
                              key={college}
                              value={college}
                            >
                              {college}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={17}
                          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Department / Program"
                      required
                      className="sm:col-span-2"
                    >
                      <div className="relative">
                        <BookOpen
                          size={17}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          suppressHydrationWarning
                          type="text"
                          value={form.department}
                          onChange={(e) =>
                            updateField(
                              'department',
                              e.target.value
                            )
                          }
                          placeholder="e.g. Information Systems Department"
                          className={`${inputClass} pl-10`}
                          required
                        />
                      </div>
                    </FormField>
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                number="02"
                title="Identity Verification"
                description="Attach a valid institutional identification card to verify your faculty credentials."
                icon={IdCard}
              />

              <div className="p-5 sm:p-7">
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Info
                      size={18}
                      className="mt-0.5 shrink-0 text-blue-700"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900">
                        Identification Requirements
                      </h4>
                      <p className="mt-1.5 text-xs leading-6 text-blue-800">
                        Upload a clear, readable image of your
                        faculty or employee identification card.
                        Ensure that your name, photograph, and
                        identification number are visible and
                        match the details provided above.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    Faculty / Employee ID
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <span className="text-xs text-slate-400">
                    One image required
                  </span>
                </div>

                <input
                  suppressHydrationWarning
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    handleFile(e.target.files?.[0])
                  }
                  aria-label="Upload faculty or employee ID"
                />

                {!idFile ? (
                  <div
                    suppressHydrationWarning
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' ||
                        e.key === ' '
                      ) {
                        e.preventDefault()
                        fileInputRef.current?.click()
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleFile(e.dataTransfer.files[0])
                    }}
                    className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:text-emerald-700">
                      <UploadCloud size={27} />
                    </div>

                    <h3 className="text-sm font-bold text-slate-800">
                      Upload your identification card
                    </h3>

                    <p className="mt-2 text-xs text-slate-500">
                      Drag and drop your image here, or click
                      to browse
                    </p>

                    <span className="mt-5 rounded-lg border border-emerald-700 bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white transition group-hover:bg-emerald-800">
                      Choose File
                    </span>

                    <p className="mt-4 text-xs text-slate-400">
                      JPG, PNG, WEBP • Maximum original size 10 MB
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="relative flex min-h-56 items-center justify-center bg-slate-100 p-5">
                      {idPreview && (
                        <img
                          src={idPreview}
                          alt="Uploaded identification preview"
                          className="max-h-80 max-w-full rounded-lg object-contain shadow-sm"
                        />
                      )}

                      <button
                        suppressHydrationWarning
                        type="button"
                        onClick={removeFile}
                        disabled={submitting}
                        aria-label="Remove uploaded ID"
                        className="absolute right-3 top-3 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
                          <FileImage size={20} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {idFile.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {(idFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={15} />
                        File Ready
                      </span>
                    </div>
                  </div>
                )}

                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <LockKeyhole size={14} />
                  Your ID will be compressed and saved directly
                  in your Firestore application document for
                  administrator verification.
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeading
                number="03"
                title="Application Declaration"
                description="Please review and confirm the accuracy of your application."
                icon={ClipboardCheck}
              />

              <div className="p-5 sm:p-7">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-sm font-bold text-slate-800">
                    Declaration of Accuracy
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    I hereby certify that all information
                    provided in this application is true,
                    accurate, and complete to the best of my
                    knowledge. I confirm that the identification
                    document submitted belongs to me and is
                    authentic. I understand that my application
                    is subject to verification and approval by
                    an authorized GradeSync administrator, and
                    that submitting this form does not
                    automatically grant instructor privileges.
                  </p>
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50">
                  <input
                    suppressHydrationWarning
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked)
                      setError('')
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700"
                  />

                  <span className="text-sm font-medium leading-6 text-slate-700">
                    I have read and understood the declaration
                    above, and I agree to the verification of
                    my submitted information for this
                    application.
                  </span>
                </label>
              </div>
            </section>

            {error && (
              <div
                ref={errorRef}
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <AlertCircle
                  size={19}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="font-semibold">
                    Application submission issue
                  </p>
                  <p className="mt-1 leading-6">{error}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Ready to submit your application?
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Please review all information before
                    submitting.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={() =>
                      setShowResetConfirm(true)
                    }
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RotateCcw size={16} />
                    Reset Form
                  </button>

                  <button
                    suppressHydrationWarning
                    type="submit"
                    disabled={
                      submitting ||
                      authLoading ||
                      checkingApplication
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Processing...
                      </>
                    ) : authLoading || checkingApplication ? (
                      <>
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                        Checking Account...
                      </>
                    ) : (
                      <>
                        Submit Application
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {submitting && (
                <div
                  className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    {stageMessage[submissionStage]}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-blue-700">
                    Please keep this page open until your
                    application has been submitted.
                  </p>
                </div>
              )}

              <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-700"
                />
                Your current student account will remain active
                until your instructor application has been
                approved.
              </div>
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck
                    size={19}
                    className="text-emerald-700"
                  />
                  <h3 className="text-sm font-bold text-slate-900">
                    Application Checklist
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Track the completion of your application
                  requirements.
                </p>
              </div>

              <div className="p-5">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Completion Progress
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {progress}%
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {completedCount} of {checklist.length} completed
                  </span>
                </div>

                <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="space-y-4">
                  {checklist.map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-3"
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          item.complete
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'border border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        {item.complete ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <ShieldCheck
                  size={19}
                  className="text-emerald-700"
                />
                <h3 className="text-sm font-bold text-slate-900">
                  Verification Process
                </h3>
              </div>

              <div className="space-y-4">
                <TimelineItem
                  number="1"
                  title="Application Submission"
                  description="Provide your official instructor details and institutional ID."
                />
                <TimelineItem
                  number="2"
                  title="Administrator Verification"
                  description="An authorized administrator reviews your submitted credentials."
                />
                <TimelineItem
                  number="3"
                  title="Account Approval"
                  description="Instructor privileges are granted only after approval."
                  last
                />
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="mb-3 flex items-center gap-2 text-emerald-800">
                <Info size={18} />
                <h3 className="text-sm font-bold">
                  Important Reminder
                </h3>
              </div>

              <p className="text-xs leading-6 text-emerald-900/80">
                Ensure that all information is correct and
                that your institutional ID is authentic and
                readable. Your student account will remain
                accessible while your application is under
                review.
              </p>
            </div>
          </aside>
        </form>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <RotateCcw size={23} />
            </div>

            <h2
              id="reset-dialog-title"
              className="text-lg font-bold text-slate-900"
            >
              Reset Application Form?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will clear all entered information and
              remove your uploaded identification image.
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowResetConfirm(false)
                }
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Reset Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
