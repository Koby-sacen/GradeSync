'use client'

import React, {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'

import { auth, db } from '@/lib/firebase'

import {
  MessageSquare,
  MessageCircle,
  Send,
  Bug,
  Lightbulb,
  CircleHelp,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Inbox,
  X,
  ShieldCheck,
  Headphones,
  ClipboardList,
  Sparkles,
  Info,
  Mail,
  UserRound,
  CheckCheck,
  History,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type FeedbackCategory =
  | 'bug'
  | 'suggestion'
  | 'feature'
  | 'support'
  | 'other'

type FeedbackPriority =
  | 'low'
  | 'medium'
  | 'high'

type FeedbackStatus =
  | 'pending'
  | 'in_progress'
  | 'resolved'
  | 'closed'

type TicketFilter =
  | 'all'
  | 'pending'
  | 'in_progress'
  | 'resolved'

interface SupportTicket {
  id: string
  studentUid: string
  studentName: string
  studentEmail: string
  category: FeedbackCategory
  subject: string
  message: string
  priority: FeedbackPriority
  status: FeedbackStatus
  createdAt: unknown
  updatedAt: unknown
  adminResponse: string
  respondedAt: unknown
}

interface CategoryOption {
  value: FeedbackCategory
  label: string
  description: string
  icon: React.ComponentType<{
    className?: string
    size?: number
  }>
}

interface FAQItem {
  question: string
  answer: string
}

// ============================================
// CONSTANTS
// ============================================

const SUPPORT_COLLECTION = 'supportTickets'

const MAX_SUBJECT_LENGTH = 120
const MAX_MESSAGE_LENGTH = 3000

const categoryOptions: CategoryOption[] = [
  {
    value: 'support',
    label: 'General Support',
    description: 'Get help using GradeSync.',
    icon: Headphones,
  },
  {
    value: 'bug',
    label: 'Report a Bug',
    description: 'Report errors or broken features.',
    icon: Bug,
  },
  {
    value: 'suggestion',
    label: 'Suggestion',
    description: 'Share ideas to improve GradeSync.',
    icon: Lightbulb,
  },
  {
    value: 'feature',
    label: 'Feature Request',
    description: 'Request a new feature.',
    icon: Sparkles,
  },
  {
    value: 'other',
    label: 'Other Concern',
    description: 'Something else you need help with.',
    icon: MessageCircle,
  },
]

const faqItems: FAQItem[] = [
  {
    question: 'How do I create my clearance?',
    answer:
      'Open Create Clearance from the sidebar. Fill in the required student and academic information, then follow the instructions to prepare your clearance document.',
  },
  {
    question: 'How do I share my clearance with an instructor?',
    answer:
      'Open your clearance form and use the available sharing option. Select or search for the intended instructor, confirm the recipient, and submit the sharing request.',
  },
  {
    question: 'Why can’t my instructor see my clearance?',
    answer:
      'First, confirm that you shared the clearance with the correct instructor account. Check the recipient email address and the sharing status. If the problem continues, submit a support request with the details.',
  },
  {
    question: 'How can I check if my clearance was signed?',
    answer:
      'Check the Activity page and your clearance document for instructor updates and recorded signatures. Notifications may also appear when the relevant events are configured.',
  },
  {
    question: 'How do I download my completed clearance?',
    answer:
      'Open your clearance document and use its download option when available. Review the downloaded file to confirm that all required details and signatures are present before printing.',
  },
  {
    question: 'Can I update my student information?',
    answer:
      'Yes. Open Profile from the sidebar to view or update supported fields such as your display name, student ID, program, and year and section.',
  },
  {
    question: 'What should I do if I encounter an error?',
    answer:
      'Try refreshing the page and checking your internet connection. If the issue continues, submit a Bug Report here. Include the affected page, what you were doing, and the error message if available.',
  },
  {
    question: 'When will I receive a response to my support request?',
    answer:
      'Your request will remain visible in My Support Requests. Once a support administrator is available and reviews your ticket, its status and response can be updated. Response times are not guaranteed.',
  },
]

// ============================================
// HELPERS
// ============================================

function getText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function getDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Timestamp) {
    return value.toDate()
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    const date = new Date(value.seconds * 1000)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  return null
}

function formatDate(value: unknown): string {
  const date = getDate(value)

  if (!date) {
    return 'Date unavailable'
  }

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: unknown): string {
  const date = getDate(value)

  if (!date) {
    return 'Date unavailable'
  }

  return date.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// FIXED: No Date.now() inside render.
// The current time is provided from React state.
function formatRelativeTime(
  value: unknown,
  currentTime: number | null
): string {
  const date = getDate(value)

  if (!date) {
    return 'Recently'
  }

  if (currentTime === null) {
    return formatDate(value)
  }

  const difference =
    currentTime - date.getTime()

  if (difference < 0) {
    return formatDate(value)
  }

  const minutes = Math.floor(
    difference / 60000
  )

  const hours = Math.floor(
    difference / 3600000
  )

  const days = Math.floor(
    difference / 86400000
  )

  if (minutes < 1) {
    return 'Just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  if (hours < 24) {
    return `${hours}h ago`
  }

  if (days < 7) {
    return `${days}d ago`
  }

  return formatDate(value)
}

function normalizeCategory(
  value: unknown
): FeedbackCategory {
  const category = getText(value).toLowerCase()

  if (
    category === 'bug' ||
    category === 'suggestion' ||
    category === 'feature' ||
    category === 'support'
  ) {
    return category
  }

  return 'other'
}

function normalizePriority(
  value: unknown
): FeedbackPriority {
  const priority = getText(value).toLowerCase()

  if (priority === 'high') {
    return 'high'
  }

  if (priority === 'low') {
    return 'low'
  }

  return 'medium'
}

function normalizeStatus(
  value: unknown
): FeedbackStatus {
  const status = getText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (status === 'in_progress') {
    return 'in_progress'
  }

  if (status === 'resolved') {
    return 'resolved'
  }

  if (status === 'closed') {
    return 'closed'
  }

  return 'pending'
}

function getCategoryLabel(
  category: FeedbackCategory
): string {
  return (
    categoryOptions.find(
      (option) => option.value === category
    )?.label || 'Other Concern'
  )
}

function getStatusLabel(
  status: FeedbackStatus
): string {
  switch (status) {
    case 'in_progress':
      return 'In Progress'

    case 'resolved':
      return 'Resolved'

    case 'closed':
      return 'Closed'

    default:
      return 'Pending'
  }
}

function getStatusStyle(
  status: FeedbackStatus
): string {
  switch (status) {
    case 'in_progress':
      return 'bg-blue-50 text-blue-700 border-blue-200'

    case 'resolved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'

    case 'closed':
      return 'bg-slate-100 text-slate-600 border-slate-200'

    default:
      return 'bg-amber-50 text-amber-700 border-amber-200'
  }
}

function getPriorityStyle(
  priority: FeedbackPriority
): string {
  switch (priority) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200'

    case 'low':
      return 'bg-slate-100 text-slate-600 border-slate-200'

    default:
      return 'bg-amber-50 text-amber-700 border-amber-200'
  }
}

function getFirebaseEmail(user: User): string {
  const googleProvider = user.providerData.find(
    (provider) =>
      provider.providerId === 'google.com'
  )

  const otherProvider = user.providerData.find(
    (provider) => Boolean(provider.email)
  )

  return (
    getText(user.email) ||
    getText(googleProvider?.email) ||
    getText(otherProvider?.email)
  )
}

function mapTicket(
  id: string,
  data: DocumentData
): SupportTicket {
  return {
    id,
    studentUid: getText(data.studentUid),
    studentName: getText(data.studentName),
    studentEmail: getText(data.studentEmail),
    category: normalizeCategory(data.category),
    subject: getText(data.subject),
    message: getText(data.message),
    priority: normalizePriority(data.priority),
    status: normalizeStatus(data.status),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    adminResponse: getText(data.adminResponse),
    respondedAt: data.respondedAt ?? null,
  }
}

// ============================================
// FEEDBACK & SUPPORT PAGE
// ============================================

export default function FeedbackAndSupport() {
  const router = useRouter()

  const [user, setUser] =
    useState<User | null>(null)

  const [studentName, setStudentName] =
    useState('Student')

  const [studentEmail, setStudentEmail] =
    useState('')

  const [authLoading, setAuthLoading] =
    useState(true)

  const [ticketsLoading, setTicketsLoading] =
    useState(true)

  const [tickets, setTickets] =
    useState<SupportTicket[]>([])

  const [category, setCategory] =
    useState<FeedbackCategory>('support')

  const [priority, setPriority] =
    useState<FeedbackPriority>('medium')

  const [subject, setSubject] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [submitting, setSubmitting] =
    useState(false)

  const [search, setSearch] =
    useState('')

  const [ticketFilter, setTicketFilter] =
    useState<TicketFilter>('all')

  const [activeTab, setActiveTab] =
    useState<'submit' | 'tickets'>('submit')

  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null)

  const [expandedFAQ, setExpandedFAQ] =
    useState<number | null>(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  // FIXED: Time is updated outside rendering.
  const [currentTime, setCurrentTime] =
    useState<number | null>(null)

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now())
    }

    updateTime()

    const interval = window.setInterval(
      updateTime,
      60000
    )

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  // ============================================
  // AUTHENTICATION AND STUDENT ROLE CHECK
  // ============================================

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!active) {
          return
        }

        if (!currentUser) {
          setUser(null)
          setAuthLoading(false)
          router.replace('/login')
          return
        }

        try {
          const userSnapshot = await getDoc(
            doc(
              db,
              'users',
              currentUser.uid
            )
          )

          if (!active) {
            return
          }

          if (!userSnapshot.exists()) {
            setUser(null)
            router.replace('/login')
            return
          }

          const data = userSnapshot.data()

          const role = getText(data.role)

          if (role !== 'student') {
            setUser(null)

            router.replace(
              role === 'instructor'
                ? '/instructor/home'
                : '/login'
            )

            return
          }

          const fullName = [
            getText(data.firstName),
            getText(data.lastName),
          ]
            .filter(Boolean)
            .join(' ')

          setStudentName(
            getText(data.fullName) ||
              getText(data.displayName) ||
              getText(data.name) ||
              fullName ||
              getText(currentUser.displayName) ||
              'Student'
          )

          setStudentEmail(
            getFirebaseEmail(currentUser) ||
              getText(data.email) ||
              getText(data.studentEmail)
          )

          setUser(currentUser)
        } catch (error) {
          console.error(
            '[Feedback & Support] Role verification failed:',
            error
          )

          if (active) {
            setErrorMessage(
              'Unable to verify your student account. Please refresh the page.'
            )
          }
        } finally {
          if (active) {
            setAuthLoading(false)
          }
        }
      }
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  // ============================================
  // REAL-TIME SUPPORT TICKETS
  // ============================================

    // ============================================
  // REAL-TIME SUPPORT TICKETS
  // ============================================

  useEffect(() => {
    if (!user) {
      return
    }

    const ticketsQuery = query(
      collection(db, 'supportTickets'),
      where('studentUid', '==', user.uid)
    )

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const records = snapshot.docs.map(
          (document) =>
            mapTicket(
              document.id,
              document.data()
            )
        )

        records.sort((a, b) => {
          const aDate =
            getDate(a.createdAt)?.getTime() ?? 0

          const bDate =
            getDate(b.createdAt)?.getTime() ?? 0

          return bDate - aDate
        })

        setTickets(records)
        setTicketsLoading(false)
      },
      (error) => {
        console.error(
          '[Feedback & Support] Ticket listener failed:',
          error
        )

        setTicketsLoading(false)

        setErrorMessage(
          'Unable to load your support requests. Check your connection and Firestore permissions.'
        )
      }
    )

    return () => {
      unsubscribe()
    }
  }, [user])

  // ============================================
  // COUNTS AND FILTERS
  // ============================================

  const pendingCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.status === 'pending'
      ).length,
    [tickets]
  )

  const inProgressCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.status === 'in_progress'
      ).length,
    [tickets]
  )

  const resolvedCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.status === 'resolved' ||
          ticket.status === 'closed'
      ).length,
    [tickets]
  )

  const filteredTickets = useMemo(() => {
    const keyword =
      search.trim().toLowerCase()

    return tickets.filter((ticket) => {
      if (
        ticketFilter === 'pending' &&
        ticket.status !== 'pending'
      ) {
        return false
      }

      if (
        ticketFilter === 'in_progress' &&
        ticket.status !== 'in_progress'
      ) {
        return false
      }

      if (
        ticketFilter === 'resolved' &&
        ticket.status !== 'resolved' &&
        ticket.status !== 'closed'
      ) {
        return false
      }

      if (!keyword) {
        return true
      }

      return [
        ticket.subject,
        ticket.message,
        ticket.adminResponse,
        getCategoryLabel(ticket.category),
      ].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    })
  }, [
    tickets,
    ticketFilter,
    search,
  ])

  // ============================================
  // SUBMIT SUPPORT REQUEST
  // ============================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!user || submitting) {
      return
    }

    setErrorMessage('')
    setSuccessMessage('')

    const trimmedSubject = subject.trim()
    const trimmedMessage = message.trim()

    if (!trimmedSubject) {
      setErrorMessage(
        'Please enter a subject for your request.'
      )
      return
    }

    if (
      trimmedSubject.length >
      MAX_SUBJECT_LENGTH
    ) {
      setErrorMessage(
        `Subject must not exceed ${MAX_SUBJECT_LENGTH} characters.`
      )
      return
    }

    if (trimmedMessage.length < 10) {
      setErrorMessage(
        'Please describe your concern in at least 10 characters.'
      )
      return
    }

    if (
      trimmedMessage.length >
      MAX_MESSAGE_LENGTH
    ) {
      setErrorMessage(
        `Message must not exceed ${MAX_MESSAGE_LENGTH} characters.`
      )
      return
    }

    try {
      setSubmitting(true)

      await addDoc(
        collection(
          db,
          SUPPORT_COLLECTION
        ),
        {
          studentUid: user.uid,
          studentName,
          studentEmail,
          category,
          subject: trimmedSubject,
          message: trimmedMessage,
          priority,
          status: 'pending',
          adminResponse: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          respondedAt: null,
        }
      )

      setSuccessMessage(
        'Your support request was submitted successfully. You can track it under My Support Requests.'
      )

      setCategory('support')
      setPriority('medium')
      setSubject('')
      setMessage('')
      setActiveTab('tickets')
    } catch (error) {
      console.error(
        '[Feedback & Support] Submission failed:',
        error
      )

      setErrorMessage(
        'Unable to submit your request. Please check your connection and Firestore permissions, then try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================
  // LOADING SCREEN
  // ============================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-emerald-700" />

          <p className="text-sm font-medium text-slate-500">
            Loading Feedback & Support...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] p-6">
        <p className="text-sm text-slate-500">
          Redirecting...
        </p>
      </div>
    )
  }

  // ============================================
  // MAIN PAGE
  // ============================================

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ======================================
            PAGE HEADER
        ====================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Headphones className="h-4 w-4 text-emerald-700" />

              <span className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
                Help & Support
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Feedback & Support
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Need help or have an idea? Let us know
              how we can improve your GradeSync experience.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Student Support Center
          </div>
        </div>

        {/* ======================================
            HERO SECTION
        ====================================== */}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-lg sm:p-8">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />

          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <MessageSquare className="h-4 w-4" />
                We&apos;re here to help
              </div>

              <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
                Your feedback helps make GradeSync better.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50/80">
                Report a problem, suggest an improvement,
                or submit a support request. Your feedback
                helps us identify what needs attention.
              </p>

              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"
              >
                Submit Feedback
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 sm:h-32 sm:w-32">
              <Headphones className="h-12 w-12 text-emerald-200 sm:h-14 sm:w-14" />
            </div>
          </div>
        </div>

        {/* ======================================
            SUCCESS / ERROR MESSAGES
        ====================================== */}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />

            <p className="flex-1 text-sm font-medium text-emerald-800">
              {successMessage}
            </p>

            <button
              type="button"
              onClick={() => setSuccessMessage('')}
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4 text-emerald-700" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />

            <p className="flex-1 text-sm font-medium text-red-700">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => setErrorMessage('')}
              aria-label="Dismiss error message"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        )}

        {/* ======================================
            SUPPORT STATISTICS
        ====================================== */}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[
            {
              label: 'Total Requests',
              value: tickets.length,
              description: 'Requests submitted',
              icon: ClipboardList,
              style: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Pending',
              value: pendingCount,
              description: 'Awaiting review',
              icon: Clock3,
              style: 'bg-amber-50 text-amber-700',
            },
            {
              label: 'In Progress',
              value: inProgressCount,
              description: 'Under review',
              icon: RefreshCw,
              style: 'bg-violet-50 text-violet-700',
            },
            {
              label: 'Resolved',
              value: resolvedCount,
              description: 'Completed requests',
              icon: CheckCheck,
              style: 'bg-emerald-50 text-emerald-700',
            },
          ].map((stat) => {
            const StatIcon = stat.icon

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.style}`}
                >
                  <StatIcon className="h-5 w-5" />
                </div>

                <p className="mt-4 text-3xl font-bold text-slate-900">
                  {ticketsLoading ? '—' : stat.value}
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {stat.label}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {stat.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* ======================================
            SUBMIT / REQUESTS TABS
        ====================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setActiveTab('submit')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === 'submit'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Send className="h-4 w-4" />
              Submit Feedback
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === 'tickets'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <History className="h-4 w-4" />
              My Support Requests

              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                  activeTab === 'tickets'
                    ? 'bg-white/20 text-white'
                    : 'bg-white text-slate-500'
                }`}
              >
                {tickets.length}
              </span>
            </button>
          </div>

          {/* ====================================
              SUBMIT FEEDBACK FORM
          ==================================== */}

          {activeTab === 'submit' && (
            <div className="p-5 sm:p-6 lg:p-8">
              <div className="mb-7">
                <h2 className="text-lg font-bold text-slate-900">
                  Tell us what&apos;s on your mind
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Complete the form below to submit
                  your concern or suggestion.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* CATEGORY */}

                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-800">
                    What do you need help with?
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryOptions.map((option) => {
                      const CategoryIcon = option.icon

                      const selected =
                        category === option.value

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setCategory(option.value)
                          }
                          disabled={submitting}
                          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? 'bg-emerald-900 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <CategoryIcon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {option.label}
                            </p>

                            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                              {option.description}
                            </p>
                          </div>

                          {selected && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* STUDENT INFORMATION */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800">
                      Student Name
                    </label>

                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="text"
                        value={studentName}
                        readOnly
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-600 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800">
                      Email Address
                    </label>

                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="email"
                        value={studentEmail}
                        placeholder="Email unavailable"
                        readOnly
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SUBJECT */}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="feedback-subject"
                      className="text-sm font-semibold text-slate-800"
                    >
                      Subject
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <span className="text-xs text-slate-400">
                      {subject.length}/{MAX_SUBJECT_LENGTH}
                    </span>
                  </div>

                  <input
                    id="feedback-subject"
                    type="text"
                    value={subject}
                    onChange={(event) =>
                      setSubject(event.target.value)
                    }
                    maxLength={MAX_SUBJECT_LENGTH}
                    disabled={submitting}
                    required
                    placeholder="Example: Unable to share my clearance"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                  />
                </div>

                {/* PRIORITY */}

                <div>
                  <label
                    htmlFor="feedback-priority"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                  >
                    Priority Level
                  </label>

                  <div className="relative">
                    <select
                      id="feedback-priority"
                      value={priority}
                      onChange={(event) =>
                        setPriority(
                          event.target.value as FeedbackPriority
                        )
                      }
                      disabled={submitting}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                    >
                      <option value="low">
                        Low — General feedback
                      </option>

                      <option value="medium">
                        Medium — Normal concern
                      </option>

                      <option value="high">
                        High — Important issue
                      </option>
                    </select>

                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* MESSAGE */}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="feedback-message"
                      className="text-sm font-semibold text-slate-800"
                    >
                      Describe Your Concern
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    </label>

                    <span className="text-xs text-slate-400">
                      {message.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>

                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    rows={7}
                    maxLength={MAX_MESSAGE_LENGTH}
                    disabled={submitting}
                    required
                    minLength={10}
                    placeholder="Please describe what happened, what you expected, and any relevant details that could help us understand your concern..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Please avoid sharing passwords or other sensitive information.
                  </p>
                </div>

                {/* FORM FOOTER */}

                <div className="flex flex-col gap-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                    <p className="max-w-md text-xs leading-relaxed text-emerald-800">
                      Your request will be saved to GradeSync.
                      You can track its status under
                      My Support Requests.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ====================================
              MY SUPPORT REQUESTS
          ==================================== */}

          {activeTab === 'tickets' && (
            <div>
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      My Support Requests
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      View and track the status of your submitted requests.
                    </p>
                  </div>

                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search requests..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                {/* FILTERS */}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Filter className="mr-1 h-4 w-4 text-slate-400" />

                  {([
                    {
                      value: 'all',
                      label: 'All',
                      count: tickets.length,
                    },
                    {
                      value: 'pending',
                      label: 'Pending',
                      count: pendingCount,
                    },
                    {
                      value: 'in_progress',
                      label: 'In Progress',
                      count: inProgressCount,
                    },
                    {
                      value: 'resolved',
                      label: 'Resolved',
                      count: resolvedCount,
                    },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        setTicketFilter(item.value)
                      }
                      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                        ticketFilter === item.value
                          ? 'bg-emerald-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}

                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          ticketFilter === item.value
                            ? 'bg-white/20 text-white'
                            : 'bg-white text-slate-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* LOADING */}

              {ticketsLoading ? (
                <div className="flex flex-col items-center justify-center px-6 py-20">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-700" />

                  <p className="mt-4 text-sm text-slate-500">
                    Loading your support requests...
                  </p>
                </div>
              ) : filteredTickets.length === 0 ? (
                /* EMPTY STATE */

                <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50">
                    <Inbox className="h-9 w-9 text-emerald-700" />
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-slate-900">
                    {search.trim() || ticketFilter !== 'all'
                      ? 'No matching requests'
                      : 'No support requests yet'}
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                    {search.trim() || ticketFilter !== 'all'
                      ? 'Try a different keyword or status filter.'
                      : 'You haven’t submitted any support requests yet. If you need help, you can create your first request.'}
                  </p>

                  {search.trim() || ticketFilter !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setTicketFilter('all')
                      }}
                      className="mt-5 rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Clear Filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab('submit')
                      }
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Submit Feedback
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                /* TICKET LIST */

                <div className="divide-y divide-slate-100">
                  {filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-5 transition hover:bg-slate-50 sm:p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                          <MessageSquare className="h-5 w-5 text-emerald-700" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                              {ticket.subject}
                            </h3>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusStyle(ticket.status)}`}
                            >
                              {getStatusLabel(ticket.status)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                              {getCategoryLabel(ticket.category)}
                            </span>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getPriorityStyle(ticket.priority)}`}
                            >
                              {ticket.priority.charAt(0).toUpperCase() +
                                ticket.priority.slice(1)}{' '}
                              Priority
                            </span>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
                            {ticket.message}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />

                              {formatRelativeTime(
                                ticket.createdAt,
                                currentTime
                              )}
                            </span>

                            <span>
                              Submitted:{' '}
                              {formatDate(ticket.createdAt)}
                            </span>

                            {ticket.adminResponse && (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                                <MessageCircle className="h-3.5 w-3.5" />
                                Response available
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedTicket(ticket)
                            }
                            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-800 transition hover:text-emerald-600"
                          >
                            View Details
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======================================
            FREQUENTLY ASKED QUESTIONS
        ====================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <CircleHelp className="h-5 w-5 text-blue-700" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Frequently Asked Questions
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Quick answers to common GradeSync questions.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {faqItems.map((faq, index) => {
              const expanded =
                expandedFAQ === index

              return (
                <div
                  key={faq.question}
                  className="px-5 py-1 sm:px-6"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedFAQ(
                        expanded ? null : index
                      )
                    }
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      {faq.question}
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        expanded
                          ? 'rotate-180'
                          : ''
                      }`}
                    />
                  </button>

                  {expanded && (
                    <p className="pb-5 pr-8 text-sm leading-7 text-slate-500">
                      {faq.answer}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ======================================
            FOOTER HELP CARD
        ====================================== */}

        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
              <Info className="h-5 w-5 text-emerald-700" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Need help with your clearance?
              </h3>

              <p className="mt-1 max-w-xl text-xs leading-relaxed text-emerald-800">
                You can review your clearance activity
                or submit a support request if you encounter
                a problem that needs attention.
              </p>
            </div>
          </div>

          <Link
            href="/students/activity"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-emerald-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
          >
            View Activity
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ============================================
          SUPPORT TICKET DETAILS MODAL
      ============================================ */}

      {selectedTicket && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedTicket(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-ticket-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusStyle(selectedTicket.status)}`}
                  >
                    {getStatusLabel(selectedTicket.status)}
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getPriorityStyle(selectedTicket.priority)}`}
                  >
                    {selectedTicket.priority} priority
                  </span>
                </div>

                <h2
                  id="support-ticket-title"
                  className="text-lg font-bold text-slate-900 sm:text-xl"
                >
                  {selectedTicket.subject}
                </h2>

                <p className="mt-2 text-xs text-slate-400">
                  Submitted:{' '}
                  {formatDateTime(
                    selectedTicket.createdAt
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTicket(null)
                }
                aria-label="Close ticket details"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Your Message
                </p>

                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {selectedTicket.message}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">
                  Request Category
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {getCategoryLabel(
                    selectedTicket.category
                  )}
                </p>
              </div>

              {selectedTicket.adminResponse ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                    <div>
                      <p className="text-sm font-bold text-emerald-950">
                        Support Response
                      </p>

                      {/* FIXED:
                          Convert the unknown Firestore
                          timestamp into a boolean
                          before rendering JSX.
                      */}

                      {getDate(
                        selectedTicket.respondedAt
                      ) !== null && (
                        <p className="mt-1 text-xs text-emerald-700">
                          {formatDateTime(
                            selectedTicket.respondedAt
                          )}
                        </p>
                      )}

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-900">
                        {selectedTicket.adminResponse}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        Awaiting Support Response
                      </p>

                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        No response has been recorded yet.
                        You can check this page again once
                        the support team begins reviewing requests.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4 sm:px-6">
              <button
                type="button"
                onClick={() =>
                  setSelectedTicket(null)
                }
                className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
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