
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  Activity,
  Search,
  PenLine,
  FileCheck2,
  BookmarkCheck,
  Trash2,
  Clock3,
  UserRound,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

type ActivityCategory =
  | 'signature'
  | 'clearance'
  | 'document'
  | 'other'

type ActivityStatus = 'success' | 'failed'

interface ActivityRecord {
  id: string
  actorUid: string
  actorEmail: string
  actorName: string
  action: string
  category: ActivityCategory
  status: ActivityStatus
  description: string
  studentName: string
  studentUid: string
  subjectCode: string
  clearanceId: string
  signatureId: string
  createdAt: Timestamp | null
}

type FilterType =
  | 'all'
  | 'signature'
  | 'clearance'
  | 'other'

interface ClearanceSectionRecord {
  yearAndSection: string
  studentUid: string
  studentName: string
}

const PAGE_SIZE = 10

function getActivityIcon(action: string) {
  if (action === 'signature_deleted') {
    return Trash2
  }

  if (action === 'signature_saved') {
    return BookmarkCheck
  }

  if (action === 'signature_applied') {
    return PenLine
  }

  if (action.includes('clearance')) {
    return FileCheck2
  }

  return Activity
}

function getActivityTitle(action: string) {
  const titles: Record<string, string> = {
    signature_saved: 'Signature saved',
    signature_applied: 'Signature applied',
    signature_deleted: 'Signature deleted',
    clearance_updated: 'Clearance updated',
    clearance_signed: 'Clearance signed',
    clearance_approved: 'Clearance approved',
    clearance_rejected: 'Clearance rejected',
    grade_updated: 'Grade updated',
    remarks_updated: 'Remarks updated',
  }

  return (
    titles[action] ||
    action
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  )
}

function formatDate(timestamp: Timestamp | null) {
  if (!timestamp) return 'Pending timestamp'

  return timestamp.toDate().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getDayLabel(timestamp: Timestamp | null) {
  if (!timestamp) return 'Pending'

  const date = timestamp.toDate()
  const today = new Date()

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const startOfActivity = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  const difference = Math.round(
    (startOfToday.getTime() -
      startOfActivity.getTime()) /
      86400000
  )

  if (difference === 0) return 'Today'
  if (difference === 1) return 'Yesterday'

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Supports searches such as:
// "4B - BSIS", "BSIS-4B", "BSIS 4B", and "4B BSIS".
function normalizeSection(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// UPDATED:
// Handles both "4B - BSIS" and "BSIS-4B".
function getSectionSearchVariants(value: string) {
  const normalized = normalizeSection(value)

  const parts = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  return {
    normalized,
    reversed: parts.length === 2
      ? parts.reverse().join('')
      : normalized,
  }
}

export default function ActivityPage() {
  const [currentUser, setCurrentUser] =
    useState<User | null>(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [activities, setActivities] =
    useState<ActivityRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')

  const [filter, setFilter] =
    useState<FilterType>('all')

  const [page, setPage] = useState(1)

  const [selectedActivity, setSelectedActivity] =
    useState<ActivityRecord | null>(null)

  const [clearanceRecords, setClearanceRecords] =
    useState<Record<string, ClearanceSectionRecord>>({})

  const [sectionLoading, setSectionLoading] =
    useState(false)

  const [sectionError, setSectionError] =
    useState('')

  // FIXED:
  // State updates happen inside Firebase's
  // authentication callback, not synchronously
  // inside the useEffect body.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user)

        // Clear previous account's records.
        setActivities([])
        setClearanceRecords({})

        // Initialize loading states for this user.
        setLoading(Boolean(user))
        setSectionLoading(Boolean(user))

        setError('')
        setSectionError('')
        setSelectedActivity(null)

        setAuthLoading(false)
      },
      (authError) => {
        console.error(
          'Authentication error:',
          authError
        )

        setCurrentUser(null)
        setActivities([])
        setClearanceRecords({})
        setLoading(false)
        setSectionLoading(false)
        setAuthLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // FIXED ERROR #1:
  // Removed synchronous setActivities([])
  // and setLoading() from the effect body.
  useEffect(() => {
    if (authLoading || !currentUser) {
      return
    }

    const activityQuery = query(
      collection(db, 'activities'),
      where('actorUid', '==', currentUser.uid)
    )

    const unsubscribe = onSnapshot(
      activityQuery,
      (snapshot) => {
        const records: ActivityRecord[] =
          snapshot.docs.map((document) => {
            const data = document.data()

            return {
              id: document.id,
              actorUid: data.actorUid || '',
              actorEmail: data.actorEmail || '',
              actorName: data.actorName || '',
              action: data.action || 'unknown',
              category: data.category || 'other',
              status: data.status || 'success',
              description: data.description || '',
              studentName: data.studentName || '',
              studentUid: data.studentUid || '',
              subjectCode: data.subjectCode || '',
              clearanceId: data.clearanceId || '',
              signatureId: data.signatureId || '',
              createdAt:
                data.createdAt instanceof Timestamp
                  ? data.createdAt
                  : null,
            }
          })

        records.sort((a, b) => {
          const first =
            a.createdAt?.toMillis() || 0

          const second =
            b.createdAt?.toMillis() || 0

          return second - first
        })

        setActivities(records)
        setError('')
        setLoading(false)
      },
      (snapshotError) => {
        console.error(
          'Error loading instructor activities:',
          snapshotError
        )

        setError(
          'Unable to load activity history. Please check your Firestore permissions.'
        )

        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [currentUser, authLoading])

  // FIXED ERROR #2:
  // Removed synchronous setClearanceRecords({})
  // and setSectionLoading() from the effect body.
  //
  // Reads the existing requests collection
  // and retrieves the exact yearAndSection field.
  useEffect(() => {
    if (authLoading || !currentUser) {
      return
    }

    const unsubscribe = onSnapshot(
      collection(db, 'requests'),
      (snapshot) => {
        const records: Record<
          string,
          ClearanceSectionRecord
        > = {}

        snapshot.docs.forEach((document) => {
          const data = document.data()

          records[document.id] = {
            yearAndSection:
              typeof data.yearAndSection === 'string'
                ? data.yearAndSection.trim()
                : '',

            studentUid:
              typeof data.studentUid === 'string'
                ? data.studentUid
                : '',

            studentName:
              typeof data.studentName === 'string'
                ? data.studentName
                : '',
          }
        })

        setClearanceRecords(records)
        setSectionLoading(false)
        setSectionError('')
      },
      (snapshotError) => {
        console.error(
          'Error loading clearance sections:',
          snapshotError
        )

        setSectionError(
          'Unable to load clearance sections. Check the requests collection and its Firestore permissions.'
        )

        setSectionLoading(false)
      }
    )

    return () => unsubscribe()
  }, [currentUser, authLoading])

  // Resolve a section using clearanceId first.
  // If clearanceId is missing, try studentUid.
  // The fallback only works when the student
  // has exactly one matching clearance.
  const getActivitySection = (
    item: ActivityRecord
  ): string => {
    if (
      item.clearanceId &&
      clearanceRecords[item.clearanceId]
    ) {
      return (
        clearanceRecords[item.clearanceId]
          .yearAndSection || ''
      )
    }

    if (!item.studentUid) {
      return ''
    }

    const matchingRecords = Object.values(
      clearanceRecords
    ).filter(
      (record) =>
        record.studentUid === item.studentUid &&
        record.yearAndSection
    )

    if (matchingRecords.length === 1) {
      return matchingRecords[0].yearAndSection
    }

    return ''
  }

  // Search includes the clearance section.
  // Document activities remain hidden.
  const filteredActivities = useMemo(() => {
    const searchText = search.trim().toLowerCase()

    const sectionVariants =
      getSectionSearchVariants(search)

    return activities.filter((item) => {
      if (
        item.category === 'document' ||
        item.action.startsWith('document_')
      ) {
        return false
      }

      const matchesCategory =
        filter === 'all' ||
        item.category === filter

      let section = ''

      if (
        item.clearanceId &&
        clearanceRecords[item.clearanceId]
      ) {
        section =
          clearanceRecords[item.clearanceId]
            .yearAndSection || ''
      } else if (item.studentUid) {
        const matchingRecords = Object.values(
          clearanceRecords
        ).filter(
          (record) =>
            record.studentUid === item.studentUid &&
            record.yearAndSection
        )

        if (matchingRecords.length === 1) {
          section =
            matchingRecords[0].yearAndSection
        }
      }

      const searchableText = [
        item.actorName,
        item.actorEmail,
        item.action,
        getActivityTitle(item.action),
        item.description,
        item.studentName,
        item.studentUid,
        item.subjectCode,
        item.clearanceId,
        section,
      ]
        .join(' ')
        .toLowerCase()

      const normalizedSection =
        normalizeSection(section)

      const matchesSearch =
        searchText === '' ||
        searchableText.includes(searchText) ||
        (
          sectionVariants.normalized.length > 0 &&
          (
            normalizedSection.includes(
              sectionVariants.normalized
            ) ||
            normalizedSection.includes(
              sectionVariants.reversed
            )
          )
        )

      return matchesCategory && matchesSearch
    })
  }, [
    activities,
    search,
    filter,
    clearanceRecords,
  ])

  // Existing statistics, excluding unused documents.
  const visibleActivities = useMemo(() => {
    return activities.filter(
      (item) =>
        item.category !== 'document' &&
        !item.action.startsWith('document_')
    )
  }, [activities])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / PAGE_SIZE)
  )

  const safePage = Math.min(page, totalPages)

  const paginatedActivities =
    filteredActivities.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    )

  const totalSignatures = visibleActivities.filter(
    (item) => item.category === 'signature'
  ).length

  const totalClearances = visibleActivities.filter(
    (item) => item.category === 'clearance'
  ).length

  const totalToday = visibleActivities.filter(
    (item) =>
      getDayLabel(item.createdAt) === 'Today'
  ).length

  const handleFilterChange = (
    value: FilterType
  ) => {
    setFilter(value)
    setPage(1)
  }

  const handleSearchChange = (
    value: string
  ) => {
    setSearch(value)
    setPage(1)
  }

  if (authLoading || (currentUser && loading)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-slate-500" />

        <p className="text-sm text-slate-500">
          Loading activity history...
        </p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <ShieldCheck className="w-10 h-10 text-slate-400" />

        <h2 className="text-lg font-bold text-slate-900">
          Authentication Required
        </h2>

        <p className="text-sm text-slate-500">
          Please sign in to view your instructor activity history.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Activity History
                </h1>

                <p className="text-sm text-slate-500">
                  Track your signatures and clearance activities.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-slate-600" />
            Instructor Activity Log
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Total Activities',
              value: visibleActivities.length,
              icon: Activity,
            },
            {
              label: 'Signatures',
              value: totalSignatures,
              icon: PenLine,
            },
            {
              label: 'Clearance Updates',
              value: totalClearances,
              icon: FileCheck2,
            },
            {
              label: 'Today',
              value: totalToday,
              icon: CalendarDays,
            },
          ].map((stat) => {
            const Icon = stat.icon

            return (
              <div
                key={stat.label}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm"
              >
                <div className="flex justify-between items-start gap-2 mb-4">
                  <span className="text-xs sm:text-sm font-medium text-slate-500">
                    {stat.label}
                  </span>

                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-slate-700" />
                  </div>
                </div>

                <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {stat.value}
                </p>
              </div>
            )
          })}
        </div>

        {/* Activity List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              Recent Activities
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Actions recorded under your instructor account.
            </p>

            <div className="flex flex-col lg:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    handleSearchChange(
                      event.target.value
                    )
                  }
                  placeholder="Search activity, student, subject, section (4B - BSIS)..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', 'All'],
                    ['signature', 'Signatures'],
                    ['clearance', 'Clearances'],
                    ['other', 'Others'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      handleFilterChange(value)
                    }
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
                      filter === value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {sectionLoading && (
              <p className="text-xs text-slate-500 mt-3">
                Loading clearance sections...
              </p>
            )}

            {sectionError && (
              <p className="text-xs text-amber-700 mt-3">
                {sectionError}
              </p>
            )}
          </div>

          {error ? (
            <div className="p-10 text-center">
              <AlertCircle className="w-9 h-9 text-rose-500 mx-auto mb-3" />

              <p className="text-sm text-rose-600">
                {error}
              </p>
            </div>
          ) : paginatedActivities.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-slate-400" />
              </div>

              <h3 className="text-sm font-bold text-slate-800">
                No activities found
              </h3>

              <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
                {search || filter !== 'all'
                  ? 'Try changing your search or activity filter.'
                  : 'Your recorded instructor activities will appear here when activity logging is enabled.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedActivities.map((item) => {
                const Icon =
                  getActivityIcon(item.action)

                const section =
                  getActivitySection(item)

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedActivity(item)
                    }
                    className="w-full text-left flex items-start gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-slate-50 transition"
                  >
                    <div className="w-10 h-10 shrink-0 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {getActivityTitle(
                            item.action
                          )}
                        </h3>

                        {item.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1 break-words">
                        {item.description ||
                          'Instructor activity recorded.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="w-3.5 h-3.5" />

                          {item.actorName ||
                            item.actorEmail ||
                            'Instructor'}
                        </span>

                        {item.studentName && (
                          <span>
                            Student: {item.studentName}
                          </span>
                        )}

                        {section && (
                          <span>
                            Section: {section}
                          </span>
                        )}

                        {item.subjectCode && (
                          <span>
                            Subject: {item.subjectCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-medium text-slate-600">
                        {getDayLabel(
                          item.createdAt
                        )}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-1">
                        {item.createdAt
                          ? item.createdAt
                              .toDate()
                              .toLocaleTimeString(
                                'en-PH',
                                {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                }
                              )
                          : 'Pending'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {!error &&
            filteredActivities.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Showing{' '}
                  {(safePage - 1) * PAGE_SIZE + 1}
                  {'–'}
                  {Math.min(
                    safePage * PAGE_SIZE,
                    filteredActivities.length
                  )}{' '}
                  of {filteredActivities.length} activities
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        Math.max(
                          1,
                          safePage - 1
                        )
                      )
                    }
                    disabled={safePage === 1}
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs text-slate-600 px-2">
                    Page {safePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        Math.min(
                          totalPages,
                          safePage + 1
                        )
                      )
                    }
                    disabled={
                      safePage === totalPages
                    }
                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* Activity Details Modal */}
        {selectedActivity && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="activity-details-title"
              className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2
                  id="activity-details-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Activity Details
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedActivity(null)
                  }
                  className="text-slate-400 hover:text-slate-700 text-xl"
                  aria-label="Close activity details"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {[
                  [
                    'Activity',
                    getActivityTitle(
                      selectedActivity.action
                    ),
                  ],
                  [
                    'Performed By',
                    selectedActivity.actorName ||
                      'Instructor',
                  ],
                  [
                    'Instructor Email',
                    selectedActivity.actorEmail,
                  ],
                  [
                    'Student',
                    selectedActivity.studentName,
                  ],
                  [
                    'Section',
                    getActivitySection(
                      selectedActivity
                    ),
                  ],
                  [
                    'Subject',
                    selectedActivity.subjectCode,
                  ],
                  [
                    'Clearance ID',
                    selectedActivity.clearanceId,
                  ],
                  [
                    'Signature ID',
                    selectedActivity.signatureId,
                  ],
                  [
                    'Status',
                    selectedActivity.status,
                  ],
                  [
                    'Date and Time',
                    formatDate(
                      selectedActivity.createdAt
                    ),
                  ],
                  [
                    'Description',
                    selectedActivity.description,
                  ],
                ].map(([label, value]) =>
                  value ? (
                    <div
                      key={label}
                      className="border-b border-slate-100 pb-3"
                    >
                      <p className="text-xs text-slate-400 mb-1">
                        {label}
                      </p>

                      <p className="text-sm font-medium text-slate-800 break-words">
                        {value}
                      </p>
                    </div>
                  ) : null
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedActivity(null)
                }
                className="w-full mt-6 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Clock3 className="w-4 h-4 shrink-0" />
          Activity records update automatically when new events are written to Firestore.
        </div>
      </div>
    </div>
  )
}
