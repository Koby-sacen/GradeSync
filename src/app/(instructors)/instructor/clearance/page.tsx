
'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  collection,
  getDocs,
  getDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import {
  Plus,
  RefreshCw,
  Save,
  PenTool,
} from 'lucide-react'
import ESignature from '@/components/features/instructors/signature/E-Signature'

interface SubjectRow {
  id: string
  code: string
  description: string
  grades: string
  remarks: string
  signature: string
  instructorId?: string
  instructorName?: string
}

interface ClearanceRequest {
  id: string
  studentUid: string
  studentName: string
  yearAndSection: string
  studentId: string
  studentEmail: string
  instructorId: string
  instructorName: string
  subjects: SubjectRow[]
  status: string
}

interface ActivityInput {
  action: string
  category: 'signature' | 'clearance' | 'document' | 'other'
  description: string
  subjectCode?: string
}

export default function InstructorRequestsPage() {
  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null)

  const [requests, setRequests] =
    useState<ClearanceRequest[]>([])

  const [loading, setLoading] = useState(true)

  const [selectedStudent, setSelectedStudent] =
    useState<ClearanceRequest | null>(null)

  const [saving, setSaving] = useState(false)

  // Signature modal state
  const [isSigningOpen, setIsSigningOpen] =
    useState(false)

  const [
    activeSigningSubjectId,
    setActiveSigningSubjectId,
  ] = useState<string | null>(null)

  // Load student clearance requests
  const fetchRequests = async (
    instructorUid: string
  ) => {
    try {
      setLoading(true)

      const querySnapshot = await getDocs(
        collection(db, 'requests')
      )

      const loadedRequests: ClearanceRequest[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()

        const subjects: SubjectRow[] =
          data.subjects || []

        const isAssignedToThisInstructor =
          subjects.some(
            (subj) =>
              subj.instructorId === instructorUid
          )

        if (isAssignedToThisInstructor) {
          loadedRequests.push({
            id: docSnap.id,
            studentUid: data.studentUid || '',
            studentName:
              data.studentName || 'Unnamed Student',
            yearAndSection:
              data.yearAndSection || '',
            studentId: data.studentId || '',
            studentEmail: data.studentEmail || '',
            instructorId: data.instructorId || '',
            instructorName:
              data.instructorName || '',
            subjects,
            status: data.status || 'Pending',
          })
        }
      })

      setRequests(loadedRequests)

      // Keep the selected student updated
      // without unnecessarily switching students.
      setSelectedStudent((previous) => {
        if (previous) {
          return (
            loadedRequests.find(
              (item) => item.id === previous.id
            ) || null
          )
        }

        return loadedRequests[0] || null
      })
    } catch (error) {
      console.error(
        'Error fetching clearance requests:',
        error
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setCurrentUser(user)

        if (user) {
          await fetchRequests(user.uid)
        } else {
          setRequests([])
          setSelectedStudent(null)
          setLoading(false)
        }
      }
    )

    return () => unsubscribe()
  }, [])

  const handleRefresh = async () => {
    if (currentUser) {
      await fetchRequests(currentUser.uid)
    }
  }

  // Edit a subject belonging to this instructor
  const handleSubjectChange = (
    subjectId: string,
    field: keyof SubjectRow,
    value: string
  ) => {
    if (!currentUser) return

    setSelectedStudent((previous) => {
      if (!previous) return previous

      const updatedSubjects =
        previous.subjects.map((subj) => {
          if (subj.id !== subjectId) {
            return subj
          }

          if (
            subj.instructorId !== currentUser.uid
          ) {
            return subj
          }

          return {
            ...subj,
            [field]: value,
          }
        })

      return {
        ...previous,
        subjects: updatedSubjects,
      }
    })
  }

  // Open the existing signature modal
  const handleOpenSignatureModal = (
    subjectId: string | null = null
  ) => {
    setActiveSigningSubjectId(subjectId)
    setIsSigningOpen(true)
  }

  // Close the existing signature modal
  const handleCloseSignatureModal = () => {
    setIsSigningOpen(false)
    setActiveSigningSubjectId(null)
  }

  // Receive a signature from ESignature.
  // The signature is saved permanently when
  // Save Grades & Sign is clicked.
  const handleApplySignature = (
    subjectId: string,
    signatureUrl: string
  ) => {
    handleSubjectChange(
      subjectId,
      'signature',
      signatureUrl
    )
  }

  // Save clearance changes and activity history
  // together in one Firestore batch.
  const handleSaveChanges = async () => {
    if (!selectedStudent || !currentUser || saving) {
      return
    }

    try {
      setSaving(true)

      const selected = selectedStudent

      const docRef = doc(
        db,
        'requests',
        selected.id
      )

      // Read the latest saved document so that
      // activity records reflect actual changes.
      const latestSnapshot = await getDoc(docRef)

      if (!latestSnapshot.exists()) {
        throw new Error(
          'This clearance request no longer exists.'
        )
      }

      const latestData = latestSnapshot.data()

      const originalSubjects: SubjectRow[] =
        latestData.subjects || []

      const activityRecords: ActivityInput[] = []

      // Only apply changes to subjects assigned
      // to the currently signed-in instructor.
      const updatedSubjects = originalSubjects.map(
        (originalSubject) => {
          if (
            originalSubject.instructorId !==
            currentUser.uid
          ) {
            return originalSubject
          }

          const editedSubject =
            selected.subjects.find(
              (subject) =>
                subject.id === originalSubject.id
            )

          if (!editedSubject) {
            return originalSubject
          }

          const subjectCode =
            originalSubject.code ||
            editedSubject.code ||
            'Unknown Subject'

          // Grade change
          if (
            (originalSubject.grades || '') !==
            (editedSubject.grades || '')
          ) {
            activityRecords.push({
              action: 'grade_updated',
              category: 'clearance',
              description:
                `Updated grade for ${subjectCode} ` +
                `from "${originalSubject.grades || 'Empty'}" ` +
                `to "${editedSubject.grades || 'Empty'}".`,
              subjectCode,
            })
          }

          // Remarks change
          if (
            (originalSubject.remarks || '') !==
            (editedSubject.remarks || '')
          ) {
            activityRecords.push({
              action: 'remarks_updated',
              category: 'clearance',
              description:
                `Updated remarks for ${subjectCode} ` +
                `from "${originalSubject.remarks || 'Empty'}" ` +
                `to "${editedSubject.remarks || 'Empty'}".`,
              subjectCode,
            })
          }

          // Signature change
          if (
            (originalSubject.signature || '') !==
            (editedSubject.signature || '')
          ) {
            activityRecords.push({
              action: 'signature_applied',
              category: 'signature',
              description:
                originalSubject.signature
                  ? `Replaced the e-signature for ${subjectCode}.`
                  : `Applied an e-signature to ${subjectCode}.`,
              subjectCode,
            })
          }

          return {
            ...originalSubject,
            grades: editedSubject.grades || '',
            remarks: editedSubject.remarks || '',
            signature:
              editedSubject.signature || '',
          }
        }
      )

      const previousStatus =
        latestData.status || 'Pending'

      // Updated professional activity description.
      if (previousStatus !== 'Reviewed') {
        activityRecords.push({
          action: 'clearance_updated',
          category: 'clearance',
          description:
            "Reviewed the student's clearance.",
        })
      }

      // Record the save operation even if the
      // instructor made no field changes.
      if (activityRecords.length === 0) {
        activityRecords.push({
          action: 'clearance_updated',
          category: 'clearance',
          description:
            'Saved the clearance review without changing existing values.',
        })
      }

      // Firestore batches support up to 500 writes.
      // One write is reserved for the clearance.
      if (activityRecords.length > 499) {
        throw new Error(
          'Too many activity changes in one save.'
        )
      }

      const batch = writeBatch(db)

      // Preserve the existing clearance fields.
      batch.update(docRef, {
        subjects: updatedSubjects,
        status: 'Reviewed',
        updatedAt: serverTimestamp(),
      })

      // Write each activity to the collection
      // used by the existing Activity page.
      for (const activity of activityRecords) {
        const activityRef = doc(
          collection(db, 'activities')
        )

        batch.set(activityRef, {
          actorUid: currentUser.uid,

          actorEmail:
            currentUser.email || '',

          actorName:
            currentUser.displayName ||
            currentUser.email ||
            'Instructor',

          action: activity.action,

          category: activity.category,

          status: 'success',

          description: activity.description,

          studentName:
            selected.studentName || '',

          studentUid:
            selected.studentUid || '',

          subjectCode:
            activity.subjectCode || '',

          clearanceId:
            selected.id,

          signatureId: '',

          createdAt: serverTimestamp(),
        })
      }

      // Both clearance and activities must
      // succeed, or neither is committed.
      await batch.commit()

      alert(
        `Clearance updated successfully!\n` +
        `${activityRecords.length} activity record(s) saved.`
      )

      await fetchRequests(currentUser.uid)
    } catch (error) {
      console.error(
        'Error saving clearance and activities:',
        error
      )

      alert(
        'Failed to save clearance and activities. ' +
        'Please check the browser console and ' +
        'your Firestore Security Rules.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* Top Header Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Student Clearance Requests
            </h1>

            <p className="text-sm text-slate-500 mt-0.5">
              Review submissions, update grades, and sign student clearances.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                handleOpenSignatureModal(null)
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Signature
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-600 font-medium">
            Loading student clearance requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
            No clearance requests assigned to you found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Requests List Sidebar */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
              <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3 px-1 text-sm uppercase tracking-wider">
                Submitted Clearances
              </h2>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() =>
                      setSelectedStudent(req)
                    }
                    className={`p-4 rounded-xl cursor-pointer transition border ${
                      selectedStudent?.id === req.id
                        ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white border-transparent shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <p className="font-semibold text-sm">
                      {req.studentName}
                    </p>

                    <p
                      className={`text-xs mt-0.5 ${
                        selectedStudent?.id === req.id
                          ? 'text-slate-300'
                          : 'text-slate-500'
                      }`}
                    >
                      Section: {req.yearAndSection}
                    </p>

                    <span
                      className={`inline-block mt-2.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                        selectedStudent?.id === req.id
                          ? 'bg-white/20 text-white'
                          : req.status === 'Reviewed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Student Clearance Details */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 text-slate-900">
              {selectedStudent ? (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {selectedStudent.studentName}
                      </h2>

                      <p className="text-sm text-slate-600 mt-0.5">
                        Section: {selectedStudent.yearAndSection}
                      </p>

                      <p className="text-xs text-slate-400 mt-0.5">
                        ID: {selectedStudent.studentId}
                        {' | '}
                        Email: {selectedStudent.studentEmail}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 shrink-0"
                    >
                      <Save className="w-4 h-4" />

                      {saving
                        ? 'Saving...'
                        : 'Save Grades & Sign'}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-200 p-3 w-28">
                            Code
                          </th>

                          <th className="border border-slate-200 p-3">
                            Description
                          </th>

                          <th className="border border-slate-200 p-3 w-36 text-center">
                            Assigned To
                          </th>

                          <th className="border border-slate-200 p-3 w-24 text-center">
                            Grades
                          </th>

                          <th className="border border-slate-200 p-3 w-28 text-center">
                            Remarks
                          </th>

                          <th className="border border-slate-200 p-3 w-36 text-center">
                            Signature
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedStudent.subjects.map(
                          (subj) => {
                            const isAssignedToMe =
                              currentUser &&
                              subj.instructorId ===
                                currentUser.uid

                            return (
                              <tr
                                key={subj.id}
                                className={
                                  !isAssignedToMe
                                    ? 'bg-slate-50/60'
                                    : 'hover:bg-slate-50/40 transition'
                                }
                              >
                                <td className="border border-slate-200 p-3 font-medium text-slate-900">
                                  {subj.code}
                                </td>

                                <td className="border border-slate-200 p-3 text-slate-700">
                                  {subj.description}
                                </td>

                                <td className="border border-slate-200 p-3 text-center text-xs text-slate-600">
                                  {subj.instructorName ||
                                    'Unassigned'}
                                </td>

                                <td className="border border-slate-200 p-3 text-center">
                                  {isAssignedToMe ? (
                                    <input
                                      type="text"
                                      value={subj.grades}
                                      onChange={(e) =>
                                        handleSubjectChange(
                                          subj.id,
                                          'grades',
                                          e.target.value
                                        )
                                      }
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg text-center py-1.5 px-1 focus:outline-none focus:ring-2 focus:ring-slate-400 font-semibold text-slate-900"
                                      placeholder="Grade"
                                    />
                                  ) : (
                                    <span className="font-semibold text-xs text-slate-700">
                                      {subj.grades || '—'}
                                    </span>
                                  )}
                                </td>

                                <td className="border border-slate-200 p-3 text-center">
                                  {isAssignedToMe ? (
                                    <input
                                      type="text"
                                      value={subj.remarks}
                                      onChange={(e) =>
                                        handleSubjectChange(
                                          subj.id,
                                          'remarks',
                                          e.target.value
                                        )
                                      }
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg text-center py-1.5 px-1 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900"
                                      placeholder="Remarks"
                                    />
                                  ) : (
                                    <span className="text-xs text-slate-700">
                                      {subj.remarks || '—'}
                                    </span>
                                  )}
                                </td>

                                <td className="border border-slate-200 p-3 text-center align-middle">
                                  {isAssignedToMe ? (
                                    <div className="flex flex-col items-center gap-1">
                                      {subj.signature &&
                                      subj.signature.startsWith(
                                        'data:image/'
                                      ) ? (
                                        <div className="relative group">
                                          <Image
                                            src={subj.signature}
                                            alt="Signature"
                                            width={96}
                                            height={40}
                                            unoptimized
                                            className="h-10 w-24 object-contain border border-slate-200 bg-white rounded-lg shadow-sm"
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleOpenSignatureModal(
                                                subj.id
                                              )
                                            }
                                            className="absolute inset-0 bg-slate-900/60 text-white text-[10px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg"
                                          >
                                            Re-sign
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOpenSignatureModal(
                                              subj.id
                                            )
                                          }
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg border border-slate-300 transition shadow-sm"
                                        >
                                          <PenTool className="w-3.5 h-3.5" />
                                          Add Sign
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-700">
                                      {subj.signature &&
                                      subj.signature.startsWith(
                                        'data:image/'
                                      ) ? (
                                        <Image
                                          src={subj.signature}
                                          alt="Signature"
                                          width={80}
                                          height={32}
                                          unoptimized
                                          className="h-8 w-20 object-contain mx-auto"
                                        />
                                      ) : (
                                        subj.signature || '—'
                                      )}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
                  Select a student request from the list to view and grade their clearance.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing E-Signature Component */}
        <ESignature
          isSigningOpen={isSigningOpen}
          activeSigningSubjectId={
            activeSigningSubjectId
          }
          currentUser={currentUser}
          onClose={handleCloseSignatureModal}
          onApplySignature={handleApplySignature}
        />

      </div>
    </div>
  )
}
