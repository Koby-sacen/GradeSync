
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  Activity,
  Search,
  FileText,
  Share2,
  PenTool,
  GraduationCap,
  CheckCircle2,
  Clock3,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
  UserRound,
  BookOpen,
  AlertCircle,
  RefreshCw,
  History,
  Eye,
  ArrowUpDown,
  PlusCircle,
  Trash2,
  Pencil,
} from 'lucide-react'

type ActivityCategory =
  | 'clearance'
  | 'signature'
  | 'document'
  | 'other'

type ActivityFilter = 'all' | ActivityCategory
type ActorFilter = 'all' | 'student' | 'instructor'

interface ActivityRecord {
  id: string
  actorUid: string
  actorName: string
  actorEmail: string
  action: string
  category: ActivityCategory
  status: string
  description: string
  studentUid: string
  studentName: string
  clearanceId: string
  subjectCode: string
  subjectName: string
  signatureId: string
  recipientUid: string
  recipientName: string
  recipientEmail: string
  documentName: string
  oldValue: string
  newValue: string
  changedField: string
  createdAt: Timestamp | null
}

interface StudentClearance {
  id: string
  source: 'requests'
  studentUid: string
  studentName: string
  yearAndSection: string
  status: string
  instructorName: string
  sharedWithEmail: string
  data: DocumentData
}

const ITEMS_PER_PAGE = 8

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const result = text(value)
    if (result) return result
  }
  return ''
}

function object(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function getTimestamp(value: Timestamp | null): number {
  return value?.toMillis() || 0
}

function formatDate(value: Timestamp | null): string {
  if (!value) return 'Pending timestamp'
  return value.toDate().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })
}

function formatTime(value: Timestamp | null): string {
  if (!value) return 'Pending'
  return value.toDate().toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  })
}

function formatFullDate(value: Timestamp | null): string {
  if (!value) return 'Pending timestamp'
  return value.toDate().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  })
}

function mapActivity(
  id: string,
  data: DocumentData
): ActivityRecord {
  const metadata = object(data.metadata)
  const details = object(data.details)
  const subject = object(data.subject)

  return {
    id,
    actorUid: text(data.actorUid),
    actorName: text(data.actorName),
    actorEmail: text(data.actorEmail),
    action: firstText(data.action, 'unknown'),
    category:
      ['clearance', 'signature', 'document'].includes(text(data.category))
        ? text(data.category) as ActivityCategory
        : 'other',
    status: firstText(data.status, 'success'),
    description: text(data.description),
    studentUid: text(data.studentUid),
    studentName: text(data.studentName),
    clearanceId: text(data.clearanceId),
    subjectCode: firstText(
      data.subjectCode,
      metadata.subjectCode,
      details.subjectCode,
      subject.code
    ),
    subjectName: firstText(
      data.subjectName,
      data.subjectDescription,
      metadata.subjectName,
      details.subjectName,
      subject.description,
      subject.name
    ),
    signatureId: text(data.signatureId),
    recipientUid: firstText(
      data.recipientUid,
      data.instructorUid,
      data.sharedWithUid
    ),
    recipientName: firstText(
      data.recipientName,
      data.instructorName,
      data.sharedWithName
    ),
    recipientEmail: firstText(
      data.recipientEmail,
      data.instructorEmail,
      data.sharedWithEmail
    ),
    documentName: firstText(
      data.documentName,
      data.fileName
    ),
    oldValue: firstText(
      data.oldValue,
      data.previousValue
    ),
    newValue: firstText(
      data.newValue,
      data.updatedValue
    ),
    changedField: firstText(
      data.changedField,
      data.field
    ),
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt
        : null,
  }
}

// Clearance information comes ONLY from requests.
function mapRequest(
  id: string,
  data: DocumentData
): StudentClearance {
  const form = object(data.formData)

  return {
    id,
    source: 'requests',
    studentUid: text(data.studentUid),
    studentName: firstText(
      data.studentName,
      form.fullName
    ),
    yearAndSection: firstText(
      data.yearAndSection,
      form.yearSection
    ),
    status: firstText(data.status, 'Pending'),
    instructorName: text(data.instructorName),
    sharedWithEmail: text(data.sharedWithEmail),
    data,
  }
}

function getTitle(action: string): string {
  const titles: Record<string, string> = {
    clearance_created: 'Clearance Created',
    clearance_saved: 'Clearance Saved',
    clearance_updated: 'Clearance Updated',
    clearance_shared: 'Clearance Shared',
    clearance_submitted: 'Clearance Submitted',
    clearance_reviewed: 'Clearance Reviewed',
    clearance_approved: 'Clearance Approved',
    clearance_signed: 'Clearance Signed',
    clearance_rejected: 'Clearance Rejected',
    subject_added: 'Subject Added',
    subject_created: 'Subject Added',
    subject_deleted: 'Subject Deleted',
    subject_removed: 'Subject Deleted',
    subject_updated: 'Subject Updated',
    subject_edited: 'Subject Edited',
    grade_updated: 'Grade Updated',
    remarks_updated: 'Remarks Updated',
    signature_saved: 'Signature Saved',
    signature_applied: 'Signature Applied',
    signature_updated: 'Signature Updated',
    signature_deleted: 'Signature Deleted',
    signature_removed: 'Signature Removed',
    document_uploaded: 'Document Uploaded',
    document_updated: 'Document Updated',
    document_shared: 'Document Shared',
    document_downloaded: 'Document Downloaded',
    document_deleted: 'Document Deleted',
  }

  return titles[action] ||
    action.replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase())
}

function isStudentAction(activity: ActivityRecord): boolean {
  return Boolean(activity.actorUid) &&
    activity.actorUid === activity.studentUid
}

function getSubjectLabel(activity: ActivityRecord): string {
  const { subjectName, subjectCode } = activity

  if (
    subjectName &&
    subjectCode &&
    subjectName.toLowerCase() !== subjectCode.toLowerCase()
  ) {
    return `"${subjectName}" (${subjectCode})`
  }

  if (subjectName) return `"${subjectName}"`
  if (subjectCode) return `"${subjectCode}"`
  return ''
}

function getIcon(action: string) {
  if (['subject_added', 'subject_created'].includes(action)) {
    return PlusCircle
  }

  if (['subject_deleted', 'subject_removed'].includes(action)) {
    return Trash2
  }

  if (['subject_updated', 'subject_edited'].includes(action)) {
    return Pencil
  }

  if (action.includes('grade')) return GraduationCap
  if (action.includes('share')) return Share2
  if (action.includes('signature')) return PenTool

  if (action.includes('approved') || action.includes('reviewed')) {
    return CheckCircle2
  }

  if (action.includes('document') || action.includes('clearance')) {
    return FileText
  }

  return Activity
}

function categoryStyle(category: ActivityCategory): string {
  switch (category) {
    case 'clearance':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'signature':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'document':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function profileName(data: DocumentData): string {
  return firstText(
    data.fullName,
    data.displayName,
    data.name,
    [text(data.firstName), text(data.lastName)].filter(Boolean).join(' ')
  )
}

export default function ActivityPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [requests, setRequests] = useState<StudentClearance[]>([])
  const [instructorNames, setInstructorNames] = useState<Record<string, string>>({})

  const [activityLoading, setActivityLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(true)

  const [activityError, setActivityError] = useState('')
  const [requestError, setRequestError] = useState('')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ActivityRecord | null>(null)

  // Authentication listener
  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user)
        setActivities([])
        setRequests([])
        setInstructorNames({})
        setActivityError('')
        setRequestError('')
        setActivityLoading(Boolean(user))
        setRequestsLoading(Boolean(user))
        setSelected(null)
        setPage(1)
        setAuthLoading(false)
      },
      (error) => {
        console.error('Authentication failed:', error)
        setCurrentUser(null)
        setActivities([])
        setRequests([])
        setInstructorNames({})
        setActivityLoading(false)
        setRequestsLoading(false)
        setActivityError('Unable to verify your account.')
        setAuthLoading(false)
      }
    )
  }, [])

  // Listen to activities and requests only.
  useEffect(() => {
    if (!currentUser) return

    const uid = currentUser.uid

    const stopActivities = onSnapshot(
      query(
        collection(db, 'activities'),
        where('studentUid', '==', uid)
      ),
      (snapshot) => {
        const records = snapshot.docs.map((item) =>
          mapActivity(item.id, item.data())
        )

        records.sort(
          (a, b) =>
            getTimestamp(b.createdAt) -
            getTimestamp(a.createdAt)
        )

        setActivities(records)
        setActivityLoading(false)
        setActivityError('')
      },
      (error) => {
        console.error('Student activities listener:', error)
        setActivityError(
          'Unable to load activities. Check Firestore permissions.'
        )
        setActivityLoading(false)
      }
    )

    const stopRequests = onSnapshot(
      query(
        collection(db, 'requests'),
        where('studentUid', '==', uid)
      ),
      (snapshot) => {
        setRequests(
          snapshot.docs.map((item) =>
            mapRequest(item.id, item.data())
          )
        )
        setRequestsLoading(false)
        setRequestError('')
      },
      (error) => {
        console.error('Requests listener:', error)
        setRequestError('Unable to load clearance requests.')
        setRequestsLoading(false)
      }
    )

    return () => {
      stopActivities()
      stopRequests()
    }
  }, [currentUser])

  // All clearance records now originate from requests.
  const clearances = requests

  const instructorUids = useMemo(
    () => Array.from(new Set(
      activities.flatMap((activity) => [
        activity.actorUid,
        activity.recipientUid,
      ]).filter((uid) =>
        uid && uid !== currentUser?.uid
      )
    )).sort(),
    [activities, currentUser]
  )

  const instructorUidKey = instructorUids.join('|')

  // Resolve instructor names without synchronous setState in an effect.
  useEffect(() => {
    if (!currentUser || !instructorUidKey) return

    let cancelled = false

    const loadNames = async () => {
      const entries = await Promise.all(
        instructorUidKey.split('|').map(async (uid) => {
          try {
            const snapshot = await getDoc(doc(db, 'users', uid))
            return [
              uid,
              snapshot.exists() ? profileName(snapshot.data()) : '',
            ] as const
          } catch (error) {
            console.error('Unable to fetch instructor:', uid, error)
            return [uid, ''] as const
          }
        })
      )

      if (!cancelled) {
        setInstructorNames((previous) => ({
          ...previous,
          ...Object.fromEntries(entries),
        }))
      }
    }

    void loadNames()

    return () => {
      cancelled = true
    }
  }, [currentUser, instructorUidKey])

  const findClearance = (activity: ActivityRecord) =>
    clearances.find((item) => item.id === activity.clearanceId)

  const actorName = (activity: ActivityRecord) =>
    isStudentAction(activity)
      ? 'You'
      : firstText(
          instructorNames[activity.actorUid],
          activity.actorName,
          activity.actorEmail,
          'Instructor'
        )

  const recipientName = (activity: ActivityRecord) => {
    const clearance = findClearance(activity)

    return firstText(
      instructorNames[activity.recipientUid],
      activity.recipientName,
      activity.recipientEmail,
      clearance?.instructorName,
      clearance?.sharedWithEmail,
      'an instructor'
    )
  }

  const description = (activity: ActivityRecord): string => {
    const action = activity.action.toLowerCase()
    const person = actorName(activity)
    const subject = getSubjectLabel(activity)
    const subjectText = subject ? `subject ${subject}` : 'a subject'
    const recorded = activity.description

    switch (action) {
      case 'subject_added':
      case 'subject_created':
        return subject
          ? `${person} added ${subjectText} to your clearance.`
          : recorded || `${person} added a subject to your clearance.`

      case 'subject_deleted':
      case 'subject_removed':
        return subject
          ? `${person} deleted ${subjectText} from your clearance.`
          : recorded || `${person} deleted a subject from your clearance.`

      case 'subject_updated':
      case 'subject_edited':
        return recorded ||
          `${person} updated ${subjectText} in your clearance.`

      case 'clearance_shared':
        // Preserve the instructor named when the activity was recorded.
        return recorded ||
          (isStudentAction(activity)
            ? `You shared your clearance with ${recipientName(activity)}.`
            : `${person} shared your clearance with ${recipientName(activity)}.`)

      case 'clearance_created':
        return recorded || `${person} created your clearance.`

      case 'clearance_saved':
        return recorded || `${person} saved your clearance.`

      case 'clearance_updated':
        return recorded || `${person} updated your clearance.`

      case 'clearance_submitted':
        return recorded || `${person} submitted your clearance.`

      case 'clearance_reviewed':
        return recorded || `${person} reviewed your clearance.`

      case 'clearance_approved':
        return recorded || `${person} approved your clearance.`

      case 'clearance_signed':
        return recorded || `${person} signed your clearance.`

      case 'clearance_rejected':
        return recorded || `${person} rejected your clearance.`

      case 'grade_updated':
        return recorded ||
          `${person} updated the grade for ${subjectText}.`

      case 'remarks_updated':
        return recorded ||
          `${person} updated remarks for ${subjectText}.`

      case 'signature_applied':
        return recorded ||
          `${person} applied a signature${subject ? ` for ${subject}` : ''}.`

      case 'signature_saved':
        return recorded || `${person} saved a signature.`

      case 'signature_deleted':
      case 'signature_removed':
        return recorded || `${person} deleted a signature.`

      case 'document_uploaded':
        return recorded ||
          `${person} uploaded ${activity.documentName || 'a document'}.`

      case 'document_updated':
        return recorded ||
          `${person} updated ${activity.documentName || 'a document'}.`

      case 'document_deleted':
        return recorded ||
          `${person} deleted ${activity.documentName || 'a document'}.`

      case 'document_shared':
        return recorded ||
          `${person} shared ${activity.documentName || 'a document'} with ${recipientName(activity)}.`

      case 'document_downloaded':
        return recorded ||
          `${person} downloaded ${activity.documentName || 'a document'}.`

      default:
        return recorded ||
          `${person} performed ${getTitle(activity.action).toLowerCase()}.`
    }
  }

  const filtered = activities
    .filter((activity) => {
      if (filter !== 'all' && activity.category !== filter) {
        return false
      }

      if (
        actorFilter === 'student' &&
        !isStudentAction(activity)
      ) return false

      if (
        actorFilter === 'instructor' &&
        isStudentAction(activity)
      ) return false

      const term = search.trim().toLowerCase()
      if (!term) return true

      const clearance = clearances.find(
        (item) => item.id === activity.clearanceId
      )

      const searchable = [
        activity.action,
        getTitle(activity.action),
        description(activity),
        activity.description,
        activity.actorName,
        activity.actorEmail,
        activity.studentName,
        activity.subjectCode,
        activity.subjectName,
        activity.recipientName,
        activity.recipientEmail,
        activity.documentName,
        activity.oldValue,
        activity.newValue,
        activity.changedField,
        clearance?.yearAndSection,
        formatDate(activity.createdAt),
      ].join(' ').toLowerCase()

      return searchable.includes(term)
    })
    .sort((a, b) =>
      sort === 'newest'
        ? getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
        : getTimestamp(a.createdAt) - getTimestamp(b.createdAt)
    )

  const stats = {
    total: activities.length,
    clearances: activities.filter(
      (item) => item.category === 'clearance'
    ).length,
    signatures: activities.filter(
      (item) => item.category === 'signature'
    ).length,
    reviewed: activities.filter(
      (item) => item.action === 'clearance_reviewed'
    ).length,
    mine: activities.filter(isStudentAction).length,
    instructors: activities.filter(
      (item) => !isStudentAction(item)
    ).length,
    added: activities.filter(
      (item) => ['subject_added', 'subject_created'].includes(item.action)
    ).length,
    deleted: activities.filter(
      (item) => ['subject_deleted', 'subject_removed'].includes(item.action)
    ).length,
  }

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / ITEMS_PER_PAGE)
  )

  const safePage = Math.min(page, totalPages)

  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  )

  const loading =
    authLoading ||
    activityLoading ||
    requestsLoading

  const errors = [
    activityError,
    requestError,
  ].filter(Boolean)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <UserRound className="w-10 h-10 text-slate-400" />
        <h1 className="text-xl font-bold">Sign In Required</h1>
        <p className="text-sm text-slate-500">
          Please sign in to view your student activity history.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <History className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                My Activity History
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                View recorded clearance changes, subjects, shares,
                instructor actions and signatures.
              </p>
            </div>
          </div>
        </div>

        {/* Primary statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            ['Total Activities', stats.total, Activity],
            ['Clearance Activities', stats.clearances, FileText],
            ['Signature Activities', stats.signatures, PenTool],
            ['Review Activities', stats.reviewed, CheckCircle2],
          ] as const).map(([label, value, StatIcon]) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <p className="text-xs text-slate-500">{label}</p>
                <StatIcon className="w-5 h-5 text-emerald-700" />
              </div>
              <p className="text-3xl font-bold text-slate-900 mt-3">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Additional statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            ['My Actions', stats.mine, UserRound],
            ['Instructor Actions', stats.instructors, PenTool],
            ['Subjects Added', stats.added, PlusCircle],
            ['Subjects Deleted', stats.deleted, Trash2],
          ] as const).map(([label, value, StatIcon]) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-2xl p-5"
            >
              <div className="flex justify-between gap-2">
                <p className="text-xs text-slate-500">{label}</p>
                <StatIcon className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Clearance status from requests only */}
        {clearances.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">
                My Clearance Status
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clearances.map((clearance) => (
                <div
                  key={`requests:${clearance.id}`}
                  className="flex justify-between items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {clearance.studentName || 'Student Clearance'}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      {clearance.yearAndSection || 'No section'}
                    </p>

                    {(clearance.instructorName || clearance.sharedWithEmail) && (
                      <p className="text-xs text-slate-500 mt-1 break-words">
                        Shared with: {clearance.instructorName ||
                          clearance.sharedWithEmail}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 text-xs font-semibold px-3 py-1 bg-white border border-slate-200 rounded-full">
                    {clearance.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity history */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">
              Recent Activities
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Each entry comes from an actual Firestore activity record.
            </p>

            {/* Search and sort */}
            <div className="flex flex-col md:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search subjects, instructors, actions..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSort((previous) =>
                    previous === 'newest' ? 'oldest' : 'newest'
                  )
                  setPage(1)
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium"
              >
                <ArrowUpDown className="w-4 h-4" />
                {sort === 'newest' ? 'Newest First' : 'Oldest First'}
              </button>
            </div>

            {/* Actor filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              {([
                ['all', 'Everyone'],
                ['student', 'My Activities'],
                ['instructor', 'Instructor Activities'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setActorFilter(value)
                    setPage(1)
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                    actorFilter === value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-2 overflow-x-auto mt-4 pb-1">
              <Filter className="w-4 h-4 shrink-0 text-slate-400" />
              {([
                ['all', 'All Activities'],
                ['clearance', 'Clearances'],
                ['signature', 'Signatures'],
                ['document', 'Documents'],
                ['other', 'Others'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFilter(value)
                    setPage(1)
                  }}
                  className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-semibold ${
                    filter === value
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Firestore errors */}
          {errors.length > 0 && (
            <div className="m-5 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  {errors.map((error) => (
                    <p key={error} className="text-sm text-red-700">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading, empty state, or activity records */}
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-7 h-7 animate-spin text-emerald-600 mx-auto" />
              <p className="text-sm text-slate-500 mt-3">
                Loading activity history...
              </p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-20 px-6 text-center">
              <History className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="font-semibold text-slate-900 mt-4">
                No Activities Found
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                {search || filter !== 'all' || actorFilter !== 'all'
                  ? 'No activity records match your filters.'
                  : 'No activity documents have been recorded for your account yet.'}
              </p>

              {(search || filter !== 'all' || actorFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setFilter('all')
                    setActorFilter('all')
                    setPage(1)
                  }}
                  className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs rounded-lg"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginated.map((activity) => {
                const Icon = getIcon(activity.action)
                const subject = getSubjectLabel(activity)

                return (
                  <div
                    key={activity.id}
                    className="p-5 sm:p-6 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${categoryStyle(activity.category)}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                            {getTitle(activity.action)}
                          </h3>

                          <span className={`px-2 py-1 text-[11px] font-semibold border rounded-full ${categoryStyle(activity.category)}`}>
                            {activity.category}
                          </span>

                          {isStudentAction(activity) && (
                            <span className="px-2 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                              My Activity
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                          {description(activity)}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {formatDate(activity.createdAt)}
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            {formatTime(activity.createdAt)}
                          </span>

                          <span className="flex items-center gap-1">
                            <UserRound className="w-3.5 h-3.5" />
                            {actorName(activity)}
                          </span>

                          {subject && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              {subject}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelected(activity)}
                        className="shrink-0 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Details</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
                {' '}of {filtered.length} activities
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  className="p-2 border border-slate-200 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs text-slate-600">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  className="p-2 border border-slate-200 rounded-lg disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Activity details modal */}
        {selected && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Activity Details"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">
                  Activity Details
                </h2>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="p-2 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-900">
                  {getTitle(selected.action)}
                </h3>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {description(selected)}
                </p>

                {([
                  ['Date and Time', formatFullDate(selected.createdAt)],
                  ['Performed By', actorName(selected)],
                  ['Status', selected.status],
                  ['Category', selected.category],
                  ['Student', selected.studentName],
                  ['Subject', getSubjectLabel(selected)],
                  [
                    'Recipient',
                    selected.action.includes('shared')
                      ? recipientName(selected)
                      : '',
                  ],
                  ['Document', selected.documentName],
                  ['Changed Field', selected.changedField],
                  ['Previous Value', selected.oldValue],
                  ['New Value', selected.newValue],
                  ['Clearance ID', selected.clearanceId],
                  ['Signature ID', selected.signatureId],
                  ['Original Description', selected.description],
                ] as [string, string][])
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="border-b border-slate-100 pb-3"
                    >
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-1 break-words">
                        {value}
                      </p>
                    </div>
                  ))}
              </div>

              <div className="p-5 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-5 py-2.5 bg-slate-900 text-white text-sm rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
