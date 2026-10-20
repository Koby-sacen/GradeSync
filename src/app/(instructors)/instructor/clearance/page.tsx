'use client'

import React, { useEffect, useState, useRef } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, query, where, serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import SignaturePad from 'signature_pad'
import { Plus, RefreshCw, Save, CheckCircle2, X, PenTool, Trash2 } from 'lucide-react'

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

interface SavedSignature {
  id: string
  instructorUid: string
  signatureUrl: string
}

export default function InstructorRequestsPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [requests, setRequests] = useState<ClearanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<ClearanceRequest | null>(null)
  const [saving, setSaving] = useState(false)

  // Signature Modal state
  const [isSigningOpen, setIsSigningOpen] = useState(false)
  const [activeSigningSubjectId, setActiveSigningSubjectId] = useState<string | null>(null)
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([])
  const [selectedSavedSigUrl, setSelectedSavedSigUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'existing' | 'draw'>('existing')
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [savingSignature, setSavingSignature] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [signaturePadInstance, setSignaturePadInstance] = useState<SignaturePad | null>(null)

  const fetchRequests = async (instructorUid: string) => {
    try {
      setLoading(true)
      const querySnapshot = await getDocs(collection(db, 'requests'))
      const loadedRequests: ClearanceRequest[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        const subjects: SubjectRow[] = data.subjects || []

        const isAssignedToThisInstructor = subjects.some(
          (subj) => subj.instructorId === instructorUid
        )

        if (isAssignedToThisInstructor) {
          loadedRequests.push({
            id: docSnap.id,
            studentUid: data.studentUid || '',
            studentName: data.studentName || 'Unnamed Student',
            yearAndSection: data.yearAndSection || '',
            studentId: data.studentId || '',
            studentEmail: data.studentEmail || '',
            instructorId: data.instructorId || '',
            instructorName: data.instructorName || '',
            subjects: subjects,
            status: data.status || 'Pending',
          })
        }
      })

      setRequests(loadedRequests)
      if (selectedStudent && !loadedRequests.some((r) => r.id === selectedStudent.id)) {
        setSelectedStudent(null)
      } else if (!selectedStudent && loadedRequests.length > 0) {
        setSelectedStudent(loadedRequests[0])
      }
    } catch (error) {
      console.error('Error fetching clearance requests from "requests" collection:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSavedSignatures = async (instructorUid: string) => {
    try {
      const q = query(collection(db, 'signature'), where('instructorUid', '==', instructorUid))
      const querySnapshot = await getDocs(q)
      const fetchedSigs: SavedSignature[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        fetchedSigs.push({
          id: docSnap.id,
          instructorUid: data.instructorUid || instructorUid,
          signatureUrl: data.signatureUrl || '',
        })
      })

      setSavedSignatures(fetchedSigs)
      if (fetchedSigs.length > 0) {
        setSelectedSavedSigUrl(fetchedSigs[0].signatureUrl)
        setActiveTab('existing')
      } else {
        setActiveTab('draw')
      }
    } catch (error) {
      console.error('Error fetching saved signatures:', error)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        await fetchRequests(user.uid)
        await fetchSavedSignatures(user.uid)
      } else {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (isSigningOpen && activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)

      const pad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
      })
      setSignaturePadInstance(pad)

      return () => {
        pad.off()
      }
    }
  }, [isSigningOpen, activeTab])

  const handleRefresh = async () => {
    if (currentUser) {
      await fetchRequests(currentUser.uid)
      await fetchSavedSignatures(currentUser.uid)
    }
  }

  const handleSubjectChange = (subjectId: string, field: keyof SubjectRow, value: string) => {
    if (!selectedStudent || !currentUser) return

    const updatedSubjects = selectedStudent.subjects.map((subj) => {
      if (subj.id === subjectId) {
        if (subj.instructorId !== currentUser.uid) {
          return subj
        }
        return { ...subj, [field]: value }
      }
      return subj
    })

    setSelectedStudent({ ...selectedStudent, subjects: updatedSubjects })
  }

  const handleOpenSignatureModal = (subjectId: string | null = null) => {
    setActiveSigningSubjectId(subjectId)
    setIsSigningOpen(true)
    if (currentUser) {
      fetchSavedSignatures(currentUser.uid)
    }
  }

  const handleClearSignature = () => {
    if (signaturePadInstance) {
      signaturePadInstance.clear()
    }
  }

  const handleSaveSignature = async () => {
    if (!currentUser) return

    let finalSignatureUrl = ''

    if (activeTab === 'existing') {
      if (!selectedSavedSigUrl) {
        alert('Please select an existing signature.')
        return
      }
      finalSignatureUrl = selectedSavedSigUrl
    } else {
      if (!signaturePadInstance || signaturePadInstance.isEmpty()) {
        alert('Please provide a signature first.')
        return
      }
      finalSignatureUrl = signaturePadInstance.toDataURL('image/png')

      if (saveToLibrary || !activeSigningSubjectId) {
        try {
          setSavingSignature(true)
          await addDoc(collection(db, 'signature'), {
            instructorUid: currentUser.uid,
            signatureUrl: finalSignatureUrl,
            createdAt: serverTimestamp(),
          })
          await fetchSavedSignatures(currentUser.uid)
        } catch (err) {
          console.error('Error saving signature to Firestore collection:', err)
        } finally {
          setSavingSignature(false)
        }
      }
    }

    if (activeSigningSubjectId) {
      handleSubjectChange(activeSigningSubjectId, 'signature', finalSignatureUrl)
    } else {
      alert('Signature saved to your library successfully!')
    }

    setIsSigningOpen(false)
    setActiveSigningSubjectId(null)
  }

  const handleSaveChanges = async () => {
    if (!selectedStudent) return
    try {
      setSaving(true)
      const docRef = doc(db, 'requests', selectedStudent.id)
      await updateDoc(docRef, {
        subjects: selectedStudent.subjects,
        status: 'Reviewed',
        updatedAt: serverTimestamp(),
      })
      alert('Clearance updated successfully!')
      handleRefresh()
    } catch (error) {
      console.error('Error updating clearance request:', error)
      alert('Failed to update clearance.')
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Clearance Requests</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review submissions, update grades, and sign student clearances.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleOpenSignatureModal(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Add Signature
            </button>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-600 font-medium">Loading student clearance requests...</div>
        ) : requests.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
            No clearance requests assigned to you found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Requests List Sidebar */}
            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
              <h2 className="font-semibold text-slate-900 border-b border-slate-100 pb-3 px-1 text-sm uppercase tracking-wider">Submitted Clearances</h2>
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedStudent(req)}
                    className={`p-4 rounded-xl cursor-pointer transition border ${
                      selectedStudent?.id === req.id
                        ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white border-transparent shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <p className="font-semibold text-sm">{req.studentName}</p>
                    <p className={`text-xs mt-0.5 ${selectedStudent?.id === req.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      Section: {req.yearAndSection}
                    </p>
                    <span className={`inline-block mt-2.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                      selectedStudent?.id === req.id
                        ? 'bg-white/20 text-white'
                        : req.status === 'Reviewed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Student Clearance Details / Editor */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 text-slate-900">
              {selectedStudent ? (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-6 mb-6 gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{selectedStudent.studentName}</h2>
                      <p className="text-sm text-slate-600 mt-0.5">Section: {selectedStudent.yearAndSection}</p>
                      <p className="text-xs text-slate-400 mt-0.5">ID: {selectedStudent.studentId} | Email: {selectedStudent.studentEmail}</p>
                    </div>
                    <button
                      onClick={handleSaveChanges}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Grades & Sign'}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-200 text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th className="border border-slate-200 p-3 w-28">Code</th>
                          <th className="border border-slate-200 p-3">Description</th>
                          <th className="border border-slate-200 p-3 w-36 text-center">Assigned To</th>
                          <th className="border border-slate-200 p-3 w-24 text-center">Grades</th>
                          <th className="border border-slate-200 p-3 w-28 text-center">Remarks</th>
                          <th className="border border-slate-200 p-3 w-36 text-center">Signature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudent.subjects.map((subj) => {
                          const isAssignedToMe = currentUser && subj.instructorId === currentUser.uid
                          return (
                            <tr key={subj.id} className={!isAssignedToMe ? 'bg-slate-50/60' : 'hover:bg-slate-50/40 transition'}>
                              <td className="border border-slate-200 p-3 font-medium text-slate-900">{subj.code}</td>
                              <td className="border border-slate-200 p-3 text-slate-700">{subj.description}</td>
                              <td className="border border-slate-200 p-3 text-center text-xs text-slate-600">
                                {subj.instructorName || 'Unassigned'}
                              </td>
                              <td className="border border-slate-200 p-3 text-center">
                                {isAssignedToMe ? (
                                  <input
                                    type="text"
                                    value={subj.grades}
                                    onChange={(e) => handleSubjectChange(subj.id, 'grades', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg text-center py-1.5 px-1 focus:outline-none focus:ring-2 focus:ring-slate-400 font-semibold text-slate-900"
                                    placeholder="Grade"
                                  />
                                ) : (
                                  <span className="font-semibold text-xs text-slate-700">{subj.grades || '—'}</span>
                                )}
                              </td>
                              <td className="border border-slate-200 p-3 text-center">
                                {isAssignedToMe ? (
                                  <input
                                    type="text"
                                    value={subj.remarks}
                                    onChange={(e) => handleSubjectChange(subj.id, 'remarks', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg text-center py-1.5 px-1 focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900"
                                    placeholder="Remarks"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-700">{subj.remarks || '—'}</span>
                                )}
                              </td>
                              <td className="border border-slate-200 p-3 text-center align-middle">
                                {isAssignedToMe ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {subj.signature && subj.signature.startsWith('data:image/') ? (
                                      <div className="relative group">
                                        <img
                                          src={subj.signature}
                                          alt="Signature"
                                          className="h-10 w-24 object-contain border border-slate-200 bg-white rounded-lg shadow-sm"
                                        />
                                        <button
                                          onClick={() => handleOpenSignatureModal(subj.id)}
                                          className="absolute inset-0 bg-slate-900/60 text-white text-[10px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg"
                                        >
                                          Re-sign
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenSignatureModal(subj.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg border border-slate-300 transition shadow-sm"
                                      >
                                        <PenTool className="w-3.5 h-3.5" />
                                        Add Sign
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-700">
                                    {subj.signature && subj.signature.startsWith('data:image/') ? (
                                      <img src={subj.signature} alt="Signature" className="h-8 w-20 object-contain mx-auto" />
                                    ) : (
                                      subj.signature || '—'
                                    )}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
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

        {/* Signature Pad Modal with Existing & Draw Option */}
        {isSigningOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col items-center">
              <div className="flex justify-between items-center w-full mb-1">
                <h2 className="text-lg font-bold text-slate-900">
                  {activeSigningSubjectId ? 'Apply E-Signature' : 'Add E-Signature to Collection'}
                </h2>
                <button
                  onClick={() => {
                    setIsSigningOpen(false)
                    setActiveSigningSubjectId(null)
                  }}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4 text-center">
                Choose an existing signature from your library or draw a new one below.
              </p>

              {/* Tab Selector */}
              <div className="flex w-full bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('existing')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    activeTab === 'existing'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Existing Signatures ({savedSignatures.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('draw')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    activeTab === 'draw'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Draw New
                </button>
              </div>

              {/* Existing Signatures Selector */}
              {activeTab === 'existing' && (
                <div className="w-full mb-4">
                  {savedSignatures.length === 0 ? (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No saved signatures found. Switch to Draw New to create and save your signature.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                      {savedSignatures.map((sig) => (
                        <div
                          key={sig.id}
                          onClick={() => setSelectedSavedSigUrl(sig.signatureUrl)}
                          className={`p-2 border-2 rounded-xl cursor-pointer bg-white flex items-center justify-center transition ${
                            selectedSavedSigUrl === sig.signatureUrl
                              ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-200'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <img src={sig.signatureUrl} alt="Saved Signature" className="h-12 object-contain" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Canvas Drawing Section */}
              {activeTab === 'draw' && (
                <div className="w-full mb-4">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden w-full bg-white mb-2">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-40 cursor-crosshair touch-none"
                    />
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveToLibrary}
                        onChange={(e) => setSaveToLibrary(e.target.checked)}
                        className="rounded text-slate-900 focus:ring-slate-900"
                      />
                      Save to signature collection
                    </label>
                    <button
                      onClick={handleClearSignature}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 rounded-lg shadow-sm hover:bg-rose-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Canvas
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex justify-end w-full gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={() => {
                    setIsSigningOpen(false)
                    setActiveSigningSubjectId(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSignature}
                  disabled={savingSignature}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingSignature
                    ? 'Saving...'
                    : activeSigningSubjectId
                    ? 'Confirm & Apply'
                    : 'Save Signature'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}