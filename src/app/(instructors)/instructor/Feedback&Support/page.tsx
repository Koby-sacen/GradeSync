
'use client'

import React, {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import { useRouter } from 'next/navigation'

import {
  MessageSquare,
  Send,
  Search,
  Filter,
  Clock3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Bug,
  Lightbulb,
  MessageCircle,
  ShieldCheck,
  FileText,
  UserRound,
  CalendarDays,
  ChevronRight,
  X,
  Inbox,
  Loader2,
  Info,
  Headphones,
  LifeBuoy,
  RefreshCw,
  Check,
} from 'lucide-react'

import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

// Types

type FeedbackCategory =
  | 'technical'
  | 'clearance'
  | 'account'
  | 'suggestion'
  | 'general'

type FeedbackPriority =
  | 'low'
  | 'medium'
  | 'high'

type FeedbackStatus =
  | 'pending'
  | 'in-progress'
  | 'resolved'

type FeedbackFilter =
  | 'all'
  | 'pending'
  | 'in-progress'
  | 'resolved'

interface FeedbackRecord {
  id: string
  subject: string
  message: string
  category: FeedbackCategory
  priority: FeedbackPriority
  status: FeedbackStatus
  createdAt: Date | null
  response: string
  respondedAt: Date | null
}

interface FeedbackForm {
  category: FeedbackCategory
  subject: string
  priority: FeedbackPriority
  message: string
}

// Constants

const FEEDBACK_COLLECTION = 'feedback'

const initialForm: FeedbackForm = {
  category: 'general',
  subject: '',
  priority: 'medium',
  message: '',
}

const categoryOptions: {
  value: FeedbackCategory
  label: string
  description: string
  icon: typeof MessageSquare
}[] = [
  {
    value: 'technical',
    label: 'Technical Issue',
    description: 'Bugs, errors, and system problems',
    icon: Bug,
  },
  {
    value: 'clearance',
    label: 'Clearance Concern',
    description: 'Clearance requests and document issues',
    icon: FileText,
  },
  {
    value: 'account',
    label: 'Account Support',
    description: 'Profile, login, and account concerns',
    icon: ShieldCheck,
  },
  {
    value: 'suggestion',
    label: 'Suggestion',
    description: 'Ideas to improve GradeSync',
    icon: Lightbulb,
  },
  {
    value: 'general',
    label: 'General Inquiry',
    description: 'Other questions and concerns',
    icon: HelpCircle,
  },
]

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

  if (
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  return null
}

function getCategory(
  value: unknown
): FeedbackCategory {
  const category =
    getText(value).toLowerCase()

  if (
    category === 'technical' ||
    category.includes('bug') ||
    category.includes('system')
  ) {
    return 'technical'
  }

  if (
    category === 'clearance' ||
    category.includes('document')
  ) {
    return 'clearance'
  }

  if (
    category === 'account' ||
    category.includes('login') ||
    category.includes('profile')
  ) {
    return 'account'
  }

  if (
    category === 'suggestion' ||
    category.includes('feature') ||
    category.includes('improvement')
  ) {
    return 'suggestion'
  }

  return 'general'
}

function getPriority(
  value: unknown
): FeedbackPriority {
  const priority =
    getText(value).toLowerCase()

  if (
    priority === 'high' ||
    priority === 'urgent'
  ) {
    return 'high'
  }

  if (priority === 'low') {
    return 'low'
  }

  return 'medium'
}

function getStatus(
  value: unknown
): FeedbackStatus {
  const status =
    getText(value)
      .toLowerCase()
      .replace(/[\s_]+/g, '-')

  if (
    status === 'resolved' ||
    status === 'completed' ||
    status === 'closed'
  ) {
    return 'resolved'
  }

  if (
    status === 'in-progress' ||
    status === 'processing' ||
    status === 'reviewing'
  ) {
    return 'in-progress'
  }

  return 'pending'
}

function getCategoryLabel(
  category: FeedbackCategory
): string {
  return (
    categoryOptions.find(
      (option) =>
        option.value === category
    )?.label || 'General Inquiry'
  )
}

function getCategoryIcon(
  category: FeedbackCategory
) {
  return (
    categoryOptions.find(
      (option) =>
        option.value === category
    )?.icon || MessageSquare
  )
}

function getCategoryStyle(
  category: FeedbackCategory
): string {
  switch (category) {
    case 'technical':
      return 'bg-red-50 text-red-700 ring-red-100'
    case 'clearance':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'account':
      return 'bg-violet-50 text-violet-700 ring-violet-100'
    case 'suggestion':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

function getStatusLabel(
  status: FeedbackStatus
): string {
  switch (status) {
    case 'in-progress':
      return 'In Progress'
    case 'resolved':
      return 'Resolved'
    default:
      return 'Pending'
  }
}

function getStatusStyle(
  status: FeedbackStatus
): string {
  switch (status) {
    case 'in-progress':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'resolved':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-100'
  }
}

function getPriorityStyle(
  priority: FeedbackPriority
): string {
  switch (priority) {
    case 'high':
      return 'bg-red-50 text-red-700 ring-red-100'
    case 'low':
      return 'bg-slate-100 text-slate-600 ring-slate-200'
    default:
      return 'bg-blue-50 text-blue-700 ring-blue-100'
  }
}

function formatDate(
  date: Date | null
): string {
  if (!date) return 'Date unavailable'

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
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return formatDate(date)
}

function normalizeFeedback(
  id: string,
  data: DocumentData
): FeedbackRecord {
  return {
    id,

    subject:
      getText(data.subject) ||
      getText(data.title) ||
      'Support Request',

    message:
      getText(data.message) ||
      getText(data.description) ||
      '',

    category: getCategory(
      data.category
    ),

    priority: getPriority(
      data.priority
    ),

    status: getStatus(
      data.status
    ),

    createdAt: getDate(
      data.createdAt ??
      data.timestamp
    ),

    response:
      getText(data.adminResponse) ||
      getText(data.response) ||
      getText(data.reply) ||
      '',

    respondedAt: getDate(
      data.respondedAt ??
      data.updatedAt
    ),
  }
}

// Instructor Feedback and Support Page

export default function FeedbackAndSupport() {
  const router = useRouter()

  const [user, setUser] =
    useState<User | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [feedback, setFeedback] =
    useState<FeedbackRecord[]>([])

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [success, setSuccess] =
    useState<string | null>(null)

  const [form, setForm] =
    useState<FeedbackForm>(initialForm)

  const [search, setSearch] =
    useState('')

  const [filter, setFilter] =
    useState<FeedbackFilter>('all')

  const [selectedFeedbackId, setSelectedFeedbackId] =
    useState<string | null>(null)

  const [showForm, setShowForm] =
    useState(true)

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

  // Real-time feedback history

  useEffect(() => {
    if (authLoading || !user) return

    const feedbackQuery = query(
      collection(db, FEEDBACK_COLLECTION),
      where('userId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      feedbackQuery,
      (snapshot) => {
        const results = snapshot.docs.map(
          (document) =>
            normalizeFeedback(
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

        setFeedback(results)
        setLoading(false)
        setError(null)
      },
      (firestoreError) => {
        console.error(
          '[Instructor Feedback] Listener error:',
          firestoreError
        )

        setError(
          firestoreError.code ===
            'permission-denied'
            ? 'You do not have permission to view your feedback history. Please check your Firestore security rules.'
            : 'Unable to load your feedback history. Please check your connection.'
        )

        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, authLoading])

  // Statistics

  const totalCount = feedback.length

  const pendingCount = feedback.filter(
    (item) =>
      item.status === 'pending'
  ).length

  const inProgressCount = feedback.filter(
    (item) =>
      item.status === 'in-progress'
  ).length

  const resolvedCount = feedback.filter(
    (item) =>
      item.status === 'resolved'
  ).length

  // Search and filters

  const filteredFeedback = useMemo(
    () => {
      const keyword =
        search.trim().toLowerCase()

      return feedback.filter((item) => {
        if (
          filter !== 'all' &&
          item.status !== filter
        ) {
          return false
        }

        if (!keyword) return true

        const searchableText = [
          item.subject,
          item.message,
          item.response,
          getCategoryLabel(
            item.category
          ),
          getStatusLabel(
            item.status
          ),
        ]
          .join(' ')
          .toLowerCase()

        return searchableText.includes(
          keyword
        )
      })
    },
    [feedback, search, filter]
  )

  const selectedFeedback =
    feedback.find(
      (item) =>
        item.id === selectedFeedbackId
    ) ?? null

  // Form helpers

  const updateForm = <
    K extends keyof FeedbackForm
  >(
    key: K,
    value: FeedbackForm[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))

    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (submitting) return

    if (!user) {
      setError(
        'Please sign in to submit feedback.'
      )
      return
    }

    const subject =
      form.subject.trim()

    const message =
      form.message.trim()

    if (subject.length < 5) {
      setError(
        'Please enter a subject with at least 5 characters.'
      )
      return
    }

    if (message.length < 10) {
      setError(
        'Please provide at least 10 characters describing your concern.'
      )
      return
    }

    if (subject.length > 150) {
      setError(
        'The subject must not exceed 150 characters.'
      )
      return
    }

    if (message.length > 5000) {
      setError(
        'Your message must not exceed 5000 characters.'
      )
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await addDoc(
        collection(
          db,
          FEEDBACK_COLLECTION
        ),
        {
          userId: user.uid,
          userEmail: user.email || '',
          userName:
            user.displayName ||
            user.email ||
            'Instructor',
          userRole: 'instructor',

          subject,
          message,

          category: form.category,
          priority: form.priority,

          status: 'pending',

          adminResponse: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )

      setForm(initialForm)

      setSuccess(
        'Your feedback has been submitted successfully. You can track its status below.'
      )

      setShowForm(false)
    } catch (submitError) {
      console.error(
        '[Instructor Feedback] Submit error:',
        submitError
      )

      setError(
        'Unable to submit your feedback. Please check your connection and Firestore permissions.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Modal handlers

  const handleOpenFeedback = (
    item: FeedbackRecord
  ) => {
    setSelectedFeedbackId(item.id)
  }

  const handleCloseFeedback = () => {
    setSelectedFeedbackId(null)
  }

  // Escape key support

  useEffect(() => {
    if (!selectedFeedbackId) return

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setSelectedFeedbackId(null)
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
  }, [selectedFeedbackId])

  // UI

  return (
    <div className="min-h-screen bg-slate-50/80 px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-7xl space-y-7">

        {/* Page Header */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                <LifeBuoy size={13} />
                Help Center
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Feedback & Support
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Need assistance or have a suggestion?
              Submit your concerns, report issues,
              and track your support requests here.
            </p>
          </div>

          <button suppressHydrationWarning
            type="button"
            onClick={() =>
              setShowForm((previous) => !previous)
            }
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
          >
            {showForm ? (
              <>
                <X size={17} />
                Hide Form
              </>
            ) : (
              <>
                <Send size={17} />
                Submit Feedback
              </>
            )}
          </button>
        </div>

        {/* Statistics */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Total */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Requests
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                  {totalCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Submitted requests
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MessageSquare size={21} />
              </div>
            </div>
          </div>

          {/* Pending */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pending
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-amber-600">
                  {pendingCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Awaiting review
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock3 size={21} />
              </div>
            </div>
          </div>

          {/* In Progress */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  In Progress
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-blue-700">
                  {inProgressCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Being reviewed
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <RefreshCw size={21} />
              </div>
            </div>
          </div>

          {/* Resolved */}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Resolved
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-600">
                  {resolvedCount}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Completed requests
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={21} />
              </div>
            </div>
          </div>
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

            <button suppressHydrationWarning
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

            <button suppressHydrationWarning
              type="button"
              onClick={() => setSuccess(null)}
              aria-label="Dismiss message"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Feedback Submission Form */}

        {showForm && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

            {/* Form Header */}

            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <MessageCircle size={21} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Submit Feedback
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Tell us how we can help you.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Body */}

            <form
              onSubmit={handleSubmit}
              className="space-y-6 px-5 py-6 sm:px-6"
            >

              {/* Category */}

              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700">
                  What do you need help with?
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {categoryOptions.map(
                    (option) => {
                      const Icon = option.icon

                      const selected =
                        form.category ===
                        option.value

                      return (
                        <button suppressHydrationWarning
                          key={option.value}
                          type="button"
                          onClick={() =>
                            updateForm(
                              'category',
                              option.value
                            )
                          }
                          className={`relative flex min-h-[86px] items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                            selected
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Icon size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${
                                selected
                                  ? 'text-blue-900'
                                  : 'text-slate-800'
                              }`}
                            >
                              {option.label}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {option.description}
                            </p>
                          </div>

                          {selected && (
                            <Check
                              size={15}
                              className="absolute right-3 top-3 text-blue-600"
                            />
                          )}
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              {/* Subject */}

              <div>
                <label
                  htmlFor="feedback-subject"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Subject
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input suppressHydrationWarning
                  id="feedback-subject"
                  type="text"
                  value={form.subject}
                  onChange={(event) =>
                    updateForm(
                      'subject',
                      event.target.value
                    )
                  }
                  maxLength={150}
                  required
                  placeholder="Briefly describe your concern"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

                <div className="mt-1.5 flex justify-between text-xs text-slate-400">
                  <span>
                    Minimum 5 characters
                  </span>

                  <span>
                    {form.subject.length}/150
                  </span>
                </div>
              </div>

              {/* Priority */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Priority Level
                </label>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {(
                    [
                      {
                        value: 'low',
                        label: 'Low',
                        color: 'emerald',
                      },
                      {
                        value: 'medium',
                        label: 'Medium',
                        color: 'blue',
                      },
                      {
                        value: 'high',
                        label: 'High',
                        color: 'red',
                      },
                    ] as const
                  ).map((item) => (
                    <button suppressHydrationWarning
                      key={item.value}
                      type="button"
                      onClick={() =>
                        updateForm(
                          'priority',
                          item.value
                        )
                      }
                      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        form.priority === item.value
                          ? item.value === 'high'
                            ? 'border-red-400 bg-red-50 text-red-700 ring-2 ring-red-100'
                            : item.value === 'low'
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100'
                              : 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.value === 'high'
                            ? 'bg-red-500'
                            : item.value === 'low'
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                        }`}
                      />

                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}

              <div>
                <label
                  htmlFor="feedback-message"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Description
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <textarea suppressHydrationWarning
                  id="feedback-message"
                  value={form.message}
                  onChange={(event) =>
                    updateForm(
                      'message',
                      event.target.value
                    )
                  }
                  rows={6}
                  maxLength={5000}
                  required
                  placeholder="Please describe your concern in detail. Include what happened, when it happened, and any relevant information that could help us assist you."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

                <div className="mt-1.5 flex justify-between text-xs text-slate-400">
                  <span>
                    Minimum 10 characters
                  </span>

                  <span>
                    {form.message.length}/5000
                  </span>
                </div>
              </div>

              {/* Form Footer */}

              <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <Info
                    size={15}
                    className="mt-0.5 shrink-0 text-blue-500"
                  />

                  Your request will be saved to
                  GradeSync and can be tracked
                  through your feedback history.
                </p>

                <button suppressHydrationWarning
                  type="submit"
                  disabled={
                    submitting ||
                    authLoading ||
                    !user
                  }
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={17} />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Feedback History */}

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

          {/* History Header */}

          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Inbox
                    size={19}
                    className="text-blue-700"
                  />

                  <h2 className="text-base font-bold text-slate-900">
                    My Support Requests
                  </h2>

                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {filteredFeedback.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  View your submitted concerns and their current status.
                </p>
              </div>

              {/* Search */}

              <div className="relative w-full xl:max-w-xs">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input suppressHydrationWarning
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search support requests..."
                  aria-label="Search support requests"
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
                    value: 'pending',
                    label: 'Pending',
                    count: pendingCount,
                  },
                  {
                    value: 'in-progress',
                    label: 'In Progress',
                    count: inProgressCount,
                  },
                  {
                    value: 'resolved',
                    label: 'Resolved',
                    count: resolvedCount,
                  },
                ] as const
              ).map((item) => (
                <button suppressHydrationWarning
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
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <Loader2
                  size={24}
                  className="animate-spin text-blue-600"
                />
              </div>

              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  Loading support requests
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Please wait while we retrieve your feedback history.
                </p>
              </div>
            </div>
          ) : filteredFeedback.length === 0 ? (

            /* Empty State */

            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50">
                {search ? (
                  <Search
                    size={32}
                    className="text-blue-400"
                  />
                ) : (
                  <Headphones
                    size={32}
                    className="text-blue-400"
                  />
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                {search
                  ? 'No matching requests'
                  : filter !== 'all'
                    ? 'No requests found'
                    : 'No support requests yet'}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search
                  ? 'Try a different keyword or clear your search.'
                  : filter !== 'all'
                    ? 'There are no support requests matching this status.'
                    : 'Your submitted feedback and support requests will appear here.'}
              </p>

              {(search || filter !== 'all') && (
                <button suppressHydrationWarning
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setFilter('all')
                  }}
                  className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  View all requests
                </button>
              )}
            </div>
          ) : (

            /* Feedback List */

            <div className="divide-y divide-slate-100">
              {filteredFeedback.map(
                (item) => {
                  const Icon = getCategoryIcon(
                    item.category
                  )

                  return (
                    <div
                      key={item.id}
                      className="group px-4 py-5 transition hover:bg-slate-50 sm:px-6"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${getCategoryStyle(
                            item.category
                          )}`}
                        >
                          <Icon size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-sm font-bold leading-6 text-slate-900">
                              {item.subject}
                            </h3>

                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                              <Clock3 size={13} />
                              {formatRelativeDate(
                                item.createdAt
                              )}
                            </span>
                          </div>

                          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-500">
                            {item.message}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-bold ring-1 ${getCategoryStyle(
                                item.category
                              )}`}
                            >
                              {getCategoryLabel(
                                item.category
                              )}
                            </span>

                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-bold ring-1 ${getStatusStyle(
                                item.status
                              )}`}
                            >
                              {getStatusLabel(
                                item.status
                              )}
                            </span>

                            <span
                              className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ring-1 ${getPriorityStyle(
                                item.priority
                              )}`}
                            >
                              {item.priority} Priority
                            </span>
                          </div>

                          <button suppressHydrationWarning
                            type="button"
                            onClick={() =>
                              handleOpenFeedback(item)
                            }
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                          >
                            <Info size={14} />
                            View details
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}

          {/* History Footer */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
            <p className="text-xs text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {filteredFeedback.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700">
                {totalCount}
              </span>{' '}
              requests
            </p>

            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <CheckCircle2
                size={14}
                className="text-blue-600"
              />
              Real-time status updates
            </span>
          </div>
        </div>

        {/* Support Information */}

        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
            <Headphones size={19} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-blue-950">
              We are here to help
            </h3>

            <p className="mt-1 text-xs leading-6 text-blue-900/70 sm:text-sm">
              Submit your concerns with clear details so
              the GradeSync support team can review them.
              You can return to this page anytime to
              check the status of your requests and
              read any responses provided.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Details Modal */}

      {selectedFeedback && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              handleCloseFeedback()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-detail-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >

            {/* Modal Header */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <LifeBuoy size={21} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Support Request
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    GradeSync Instructor Portal
                  </p>
                </div>
              </div>

              <button suppressHydrationWarning
                type="button"
                onClick={handleCloseFeedback}
                aria-label="Close feedback details"
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
                    selectedFeedback.category
                  )}`}
                >
                  {getCategoryLabel(
                    selectedFeedback.category
                  )}
                </span>

                <span
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ${getStatusStyle(
                    selectedFeedback.status
                  )}`}
                >
                  {getStatusLabel(
                    selectedFeedback.status
                  )}
                </span>
              </div>

              <h2
                id="feedback-detail-title"
                className="text-xl font-bold leading-8 text-slate-900"
              >
                {selectedFeedback.subject}
              </h2>

              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                {selectedFeedback.message}
              </p>

              {/* Request Information */}

              <div className="mt-6 space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={17}
                    className="mt-0.5 text-slate-400"
                  />

                  <div>
                    <p className="text-xs text-slate-400">
                      Submitted on
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatFullDate(
                        selectedFeedback.createdAt
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertCircle
                    size={17}
                    className="mt-0.5 text-slate-400"
                  />

                  <div>
                    <p className="text-xs text-slate-400">
                      Priority
                    </p>

                    <p className="mt-1 text-sm font-semibold capitalize text-slate-700">
                      {selectedFeedback.priority}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <UserRound
                    size={17}
                    className="mt-0.5 text-slate-400"
                  />

                  <div>
                    <p className="text-xs text-slate-400">
                      Submitted by
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      Instructor
                    </p>
                  </div>
                </div>
              </div>

              {/* Support Response */}

              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <MessageCircle
                    size={18}
                    className="text-blue-600"
                  />

                  <h3 className="text-sm font-bold text-slate-900">
                    Support Response
                  </h3>
                </div>

                {selectedFeedback.response ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-blue-950">
                      {selectedFeedback.response}
                    </p>

                    {selectedFeedback.respondedAt && (
                      <p className="mt-3 text-xs text-blue-600/70">
                        Responded on{' '}
                        {formatFullDate(
                          selectedFeedback.respondedAt
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <Clock3
                        size={18}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />

                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Awaiting response
                        </p>

                        <p className="mt-1 text-xs leading-6 text-slate-500">
                          No support response has been
                          added to this request yet.
                          Please check back later for
                          updates.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
              <button suppressHydrationWarning
                type="button"
                onClick={handleCloseFeedback}
                className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
