'use client'

import React, { useEffect, useState } from 'react'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Save, Share2, Plus, Download, Trash2, X } from 'lucide-react'

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

interface Instructor {
  id: string
  name: string
  email: string
}

export default function Page() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [loading, setLoading] = useState(true)

  // Request tracking state for student view
  const [existingRequestId, setExistingRequestId] = useState<string | null>(null)
  const [clearanceStatus, setClearanceStatus] = useState<string>('Not Shared')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Sharing & Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  // Editable header state (initialized empty so students type it themselves)
  const [studentName, setStudentName] = useState('')
  const [yearAndSection, setYearAndSection] = useState('')
  const [studentId, setStudentId] = useState('')
  const [studentEmail, setStudentEmail] = useState('')

  // Editable subjects table state
  const [subjects, setSubjects] = useState<SubjectRow[]>([
    { id: '1', code: 'DA 101', description: 'Data Analytics', grades: '', remarks: '', signature: '', instructorId: '', instructorName: '' },
    { id: '2', code: 'STAT 101', description: 'Statistics Essential for Analytics', grades: '', remarks: '', signature: '', instructorId: '', instructorName: '' },
    { id: '3', code: 'ADV 10', description: 'Business Intelligence', grades: '', remarks: '', signature: '', instructorId: '', instructorName: '' },
    { id: '4', code: 'IS 106', description: 'IS Project Management 1', grades: '', remarks: '', signature: '', instructorId: '', instructorName: '' },
    { id: '5', code: 'QUAMET', description: 'QUANTITATIVE METHODS', grades: '', remarks: '', signature: '', instructorId: '', instructorName: '' },
  ])

  // Fetch instructors from the 'users' collection where role is 'instructor' (declared before useEffect to prevent hoisting errors)
  const fetchInstructorsList = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'))
      const fetched: Instructor[] = []
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        const role = data.role ? String(data.role).toLowerCase().trim() : ''

        if (role === 'instructor') {
          fetched.push({
            id: docSnap.id,
            name: data.fullName || data.name || data.displayName || 'Unnamed Instructor',
            email: data.email && data.email !== '' ? data.email : 'No email provided',
          })
        }
      })

      setInstructors(fetched)
    } catch (error) {
      console.error('Error fetching instructors:', error)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Fetch instructors list early so row-level dropdowns have names available if loaded from DB
        await fetchInstructorsList()

        // Fetch user role from Firestore users collection
        try {
          const userDocRef = doc(db, 'users', currentUser.uid)
          const userDocSnap = await getDoc(userDocRef)
          if (userDocSnap.exists()) {
            const data = userDocSnap.data()
            if (data.role) {
              setUserRole(data.role.toLowerCase())
            }
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
        }

        // Fetch existing clearance request for this student to show updated grades/status and saved student info
        try {
          const q = query(collection(db, 'requests'), where('studentUid', '==', currentUser.uid))
          const querySnapshot = await getDocs(q)
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0]
            const reqData = docSnap.data()
            setExistingRequestId(docSnap.id)
            if (reqData.subjects) setSubjects(reqData.subjects)
            if (reqData.studentName) setStudentName(reqData.studentName)
            if (reqData.yearAndSection) setYearAndSection(reqData.yearAndSection)
            if (reqData.studentId) setStudentId(reqData.studentId)
            if (reqData.studentEmail) setStudentEmail(reqData.studentEmail)
            if (reqData.status) setClearanceStatus(reqData.status)
          }
        } catch (error) {
          console.error('Error fetching student clearance request:', error)
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const isInstructor = userRole === 'instructor'

  const handleOpenModal = () => {
    fetchInstructorsList()
    setIsModalOpen(true)
  }

  const handleSubjectChange = (id: string, field: keyof SubjectRow, value: string) => {
    setSubjects((prev) =>
      prev.map((subj) => {
        if (subj.id === id) {
          return { ...subj, [field]: value }
        }
        return subj
      })
    )
  }

  const handleAssignInstructorToSubject = (subjectId: string, instructorId: string) => {
    const selectedInst = instructors.find((i) => i.id === instructorId)
    setSubjects((prev) =>
      prev.map((subj) => {
        if (subj.id === subjectId) {
          return {
            ...subj,
            instructorId: instructorId,
            instructorName: selectedInst ? selectedInst.name : '',
          }
        }
        return subj
      })
    )
  }

  const handleAddSubject = () => {
    const newSubject: SubjectRow = {
      id: Date.now().toString(),
      code: '',
      description: '',
      grades: '',
      remarks: '',
      signature: '',
      instructorId: '',
      instructorName: '',
    }
    setSubjects((prev) => [...prev, newSubject])
  }

  const handleDeleteSubject = (id: string) => {
    setSubjects((prev) => prev.filter((subj) => subj.id !== id))
  }

  const handleSaveClearance = async () => {
    if (!user) return

    try {
      setSaving(true)
      setSaveSuccess(false)

      if (existingRequestId) {
        const docRef = doc(db, 'requests', existingRequestId)
        await updateDoc(docRef, {
          studentName,
          yearAndSection,
          studentId,
          studentEmail,
          subjects,
          updatedAt: serverTimestamp(),
        })
      } else {
        const docRef = await addDoc(collection(db, 'requests'), {
          studentUid: user.uid,
          studentName,
          yearAndSection,
          studentId,
          studentEmail,
          subjects,
          status: clearanceStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        setExistingRequestId(docRef.id)
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (error) {
      console.error('Error saving clearance:', error)
      alert('Failed to save clearance. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmShare = async () => {
    if (!user) return
    if (!selectedInstructor) {
      alert('Please select a primary instructor to send the request to.')
      return
    }

    try {
      setSharing(true)
      setShareSuccess(false)

      if (existingRequestId) {
        const docRef = doc(db, 'requests', existingRequestId)
        await updateDoc(docRef, {
          studentName,
          yearAndSection,
          studentId,
          studentEmail,
          instructorId: selectedInstructor.id,
          instructorName: selectedInstructor.name,
          subjects,
          status: 'Pending',
          updatedAt: serverTimestamp(),
        })
        setClearanceStatus('Pending')
      } else {
        const docRef = await addDoc(collection(db, 'requests'), {
          studentUid: user.uid,
          studentName,
          yearAndSection,
          studentId,
          studentEmail,
          instructorId: selectedInstructor.id,
          instructorName: selectedInstructor.name,
          subjects,
          status: 'Pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        setExistingRequestId(docRef.id)
        setClearanceStatus('Pending')
      }

      setShareSuccess(true)
      setIsModalOpen(false)
      setSelectedInstructor(null)
      setTimeout(() => setShareSuccess(false), 4000)
    } catch (error) {
      console.error('Error sharing clearance request:', error)
      alert('Failed to share clearance. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  const handleDownload = () => {
    window.print()
  }

  const filteredInstructors = instructors.filter((inst) =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Loading portal...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex flex-col items-center">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="w-full max-w-5xl mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">Clearance Form Portal ({isInstructor ? 'Instructor View' : 'Student View'})</h1>
          {!isInstructor && clearanceStatus && (
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${clearanceStatus === 'Reviewed' ? 'bg-slate-200 text-slate-800' : clearanceStatus === 'Pending' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200 text-slate-700'}`}>
              Status: {clearanceStatus}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          {!isInstructor && (
            <>
              <button
                onClick={handleSaveClearance}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-500" />
                {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Clearance'}
              </button>
              <button
                onClick={handleOpenModal}
                disabled={sharing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 transition disabled:opacity-50"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                {sharing ? 'Sharing...' : shareSuccess ? 'Shared' : 'Share'}
              </button>
            </>
          )}
          <button
            onClick={handleAddSubject}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            Add Subject
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-lg shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          >
            <Download className="w-4 h-4 text-slate-300" />
            Download / Print
          </button>
        </div>
      </div>

      {/* Printable Clearance Form Container */}
      <div className="w-full max-w-5xl bg-white p-8 sm:p-12 shadow-lg rounded-2xl print:shadow-none print:p-0 print:w-full text-slate-900">
        
        {/* Header Information */}
        <div className="space-y-4 text-sm font-medium border-b border-slate-300 pb-6 mb-6 print:border-b print:border-slate-400">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1 border-b border-slate-400 pb-1 flex items-center print:border-b print:border-slate-400">
              <span className="text-slate-500 mr-2 shrink-0">Name:</span>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                suppressHydrationWarning
                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-semibold placeholder:text-slate-300 print:border-none print:shadow-none print:outline-none"
                placeholder="e.g., Koby R. Sacendoncillo"
              />
            </div>
            <div className="w-full sm:w-72 border-b border-slate-400 pb-1 flex items-center print:border-b print:border-slate-400">
              <span className="text-slate-500 mr-2 shrink-0">Year & Section:</span>
              <input
                type="text"
                value={yearAndSection}
                onChange={(e) => setYearAndSection(e.target.value)}
                suppressHydrationWarning
                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 placeholder:text-slate-300 print:border-none print:shadow-none print:outline-none"
                placeholder="e.g., 4B - BSIS"
              />
            </div>
            <div className="w-full sm:w-48 border-b border-slate-400 pb-1 flex items-center print:border-b print:border-slate-400">
              <span className="text-slate-500 mr-2 shrink-0">Date:</span>
              <span suppressHydrationWarning>{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="w-full sm:w-72 border-b border-slate-400 pb-1 flex items-center print:border-b print:border-slate-400">
              <span className="text-slate-500 mr-2 shrink-0">ID no.:</span>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                suppressHydrationWarning
                className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 placeholder:text-slate-300 print:border-none print:shadow-none print:outline-none"
                placeholder="e.g., 2021-00123"
              />
            </div>
            <div className="flex-1 flex items-center justify-end">
              <input
                type="text"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                suppressHydrationWarning
                className="w-full sm:w-72 text-right bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-xs text-slate-500 placeholder:text-slate-300 print:border-none print:shadow-none print:outline-none"
                placeholder="e.g., student@gmail.com"
              />
            </div>
          </div>
        </div>

        {/* Clearance Subjects Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-400 text-left text-sm print:table print:w-full">
            <thead>
              <tr className="bg-slate-50 print:bg-slate-100">
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-28">Subject Code</th>
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800">Subject Description</th>
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-44 text-center print:hidden">Assigned Instructor</th>
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-20 text-center">Grades</th>
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-24 text-center">Remarks</th>
                <th className="border border-slate-400 px-3 py-3 font-semibold text-slate-800 w-32 text-center">Signature</th>
                <th className="border border-slate-400 px-2 py-3 font-semibold text-slate-800 w-12 text-center print:hidden">Action</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subj) => {
                const isAssignedToThisInstructor = isInstructor && user && subj.instructorId === user.uid
                
                return (
                  <tr key={subj.id} className="print:table-row">
                    <td className="border border-slate-400 p-2 print:p-2">
                      <input
                        type="text"
                        value={subj.code}
                        onChange={(e) => handleSubjectChange(subj.id, 'code', e.target.value)}
                        suppressHydrationWarning
                        className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-medium print:border-none print:bg-transparent print:p-0"
                        placeholder="Code"
                      />
                    </td>
                    <td className="border border-slate-400 p-2 print:p-2">
                      <input
                        type="text"
                        value={subj.description}
                        onChange={(e) => handleSubjectChange(subj.id, 'description', e.target.value)}
                        suppressHydrationWarning
                        className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 print:border-none print:bg-transparent print:p-0"
                        placeholder="Description"
                      />
                    </td>

                    {/* Assigned Instructor Selector / Display (Hidden on Print) */}
                    <td className="border border-slate-400 p-2 text-center print:hidden">
                      {isInstructor ? (
                        <span className="text-xs font-medium text-slate-700">
                          {subj.instructorName || 'Unassigned'}
                        </span>
                      ) : (
                        <select
                          value={subj.instructorId || ''}
                          onChange={(e) => handleAssignInstructorToSubject(subj.id, e.target.value)}
                          suppressHydrationWarning
                          className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        >
                          <option value="">Select Instructor</option>
                          {instructors.map((inst) => (
                            <option key={inst.id} value={inst.id}>
                              {inst.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Grades */}
                    <td className={`relative group border border-slate-400 p-2 text-center print:p-2 ${!isAssignedToThisInstructor && isInstructor ? 'bg-slate-100/70 cursor-not-allowed select-none' : ''}`}>
                      {!isAssignedToThisInstructor && isInstructor && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg pointer-events-none print:hidden">
                          You are not assigned to grade this subject
                        </div>
                      )}
                      {isAssignedToThisInstructor ? (
                        <input
                          type="text"
                          value={subj.grades}
                          onChange={(e) => handleSubjectChange(subj.id, 'grades', e.target.value)}
                          suppressHydrationWarning
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center print:border-none print:bg-transparent print:p-0 font-semibold"
                          placeholder="Grade"
                        />
                      ) : (
                        <span className="text-slate-800 font-semibold text-xs print:text-slate-900 print:not-italic" suppressHydrationWarning>
                          {subj.grades || '—'}
                        </span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className={`relative group border border-slate-400 p-2 text-center print:p-2 ${!isAssignedToThisInstructor && isInstructor ? 'bg-slate-100/70 cursor-not-allowed select-none' : ''}`}>
                      {!isAssignedToThisInstructor && isInstructor && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg pointer-events-none print:hidden">
                          You are not assigned to grade this subject
                        </div>
                      )}
                      {isAssignedToThisInstructor ? (
                        <input
                          type="text"
                          value={subj.remarks}
                          onChange={(e) => handleSubjectChange(subj.id, 'remarks', e.target.value)}
                          suppressHydrationWarning
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center print:border-none print:bg-transparent print:p-0"
                          placeholder="Remarks"
                        />
                      ) : (
                        <span className="text-slate-800 text-xs print:text-slate-900 print:not-italic" suppressHydrationWarning>
                          {subj.remarks || '—'}
                        </span>
                      )}
                    </td>

                    {/* Signature */}
                    <td className={`relative group border border-slate-400 p-2 text-center print:p-2 ${!isAssignedToThisInstructor && isInstructor ? 'bg-slate-100/70 cursor-not-allowed select-none' : ''}`}>
                      {!isAssignedToThisInstructor && isInstructor && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg pointer-events-none print:hidden">
                          You are not assigned to sign this subject
                        </div>
                      )}
                      {isAssignedToThisInstructor ? (
                        <input
                          type="text"
                          value={subj.signature}
                          onChange={(e) => handleSubjectChange(subj.id, 'signature', e.target.value)}
                          suppressHydrationWarning
                          className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 text-center print:border-none print:bg-transparent print:p-0"
                          placeholder="Sign"
                        />
                      ) : (
                        <span className="text-slate-800 text-xs print:text-slate-900 print:not-italic flex items-center justify-center" suppressHydrationWarning>
                          {subj.signature && subj.signature.startsWith('data:image/') ? (
                            <img src={subj.signature} alt="Instructor Signature" className="h-8 w-24 object-contain" />
                          ) : (
                            subj.signature || '—'
                          )}
                        </span>
                      )}
                    </td>

                    <td className="border border-slate-400 p-2 text-center print:hidden">
                      <button
                        onClick={() => handleDeleteSubject(subj.id)}
                        className="inline-flex items-center justify-center p-1 text-slate-400 hover:text-red-600 rounded transition"
                        title="Delete subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-xs text-slate-500 text-center print:mt-16">
          <p>This is an official clearance document generated via the Student Portal.</p>
        </div>
      </div>

      {/* Instructor Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-base font-semibold text-slate-900">Select Instructor to Share</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Choose an instructor from the directory or search below.</p>

            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
              {filteredInstructors.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No instructors found.</p>
              ) : (
                filteredInstructors.map((inst) => (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedInstructor(inst)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col ${
                      selectedInstructor?.id === inst.id
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium text-slate-800 text-sm">{inst.name}</span>
                    <span className="text-xs text-slate-500">{inst.email}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmShare}
                disabled={!selectedInstructor || sharing}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-lg shadow-sm hover:bg-slate-800 transition disabled:opacity-50"
              >
                {sharing ? 'Sending...' : 'Confirm & Share'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}