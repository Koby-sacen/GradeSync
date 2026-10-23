
'use client'

import React, { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth, db } from '@/lib/firebase'
import { Users, Clock, CheckCircle2, ArrowRight } from 'lucide-react'

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
  subjects: SubjectRow[]
  status: string
}

export default function InstructorHomePage() {
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [assignedRequests, setAssignedRequests] = useState<ClearanceRequest[]>([])

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return

      setLoading(true)
      setAuthorized(false)
      setCurrentUser(null)
      setAssignedRequests([])

      if (!user) {
        router.replace('/login')
        return
      }

      try {
        // SECURITY: Verify the user's role in Firestore.
        // Never trust a role stored in localStorage or URL parameters.
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        if (!active) return

        if (!userSnap.exists()) {
          console.warn(
            '[Instructor Access] User profile not found:',
            user.uid
          )

          router.replace('/students/home')
          return
        }

        const userData = userSnap.data()
        const role = userData?.role

        // SECURITY: Only instructors can enter this page.
        if (role !== 'instructor') {
          console.warn(
            '[Instructor Access] Access denied. Role:',
            role
          )

          router.replace('/students/home')
          return
        }

        // Authorized instructor: fetch assigned clearance requests.
        const querySnapshot = await getDocs(collection(db, 'requests'))

        if (!active) return

        const matchedRequests: ClearanceRequest[] = []

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data()
          const subjects: SubjectRow[] = Array.isArray(data.subjects)
            ? data.subjects
            : []

          const isAssigned = subjects.some(
            (subj) => subj.instructorId === user.uid
          )

          if (isAssigned) {
            matchedRequests.push({
              id: docSnap.id,
              studentUid: data.studentUid || '',
              studentName: data.studentName || 'Unnamed Student',
              yearAndSection: data.yearAndSection || '',
              studentId: data.studentId || '',
              studentEmail: data.studentEmail || '',
              subjects,
              status: data.status || 'Pending',
            })
          }
        })

        if (!active) return

        setCurrentUser(user)
        setAssignedRequests(matchedRequests)
        setAuthorized(true)
      } catch (error) {
        console.error(
          '[Instructor Access] Failed to verify access or load requests:',
          error
        )

        if (!active) return

        // Fail closed: never display instructor content if verification fails.
        setAuthorized(false)
        setCurrentUser(null)
        setAssignedRequests([])
        router.replace('/login')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  const totalRequestsCount = assignedRequests.length

  const pendingRequestsCount = assignedRequests.filter(
    (r) => r.status === 'Pending'
  ).length

  const reviewedRequestsCount = assignedRequests.filter(
    (r) => r.status === 'Reviewed'
  ).length

  // Do not render instructor content before role verification.
  if (loading || !authorized || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <p className="text-slate-600 font-medium">
          {loading
            ? 'Verifying instructor access...'
            : 'Redirecting...'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* Welcome Header */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {currentUser.displayName || 'Instructor'}! 👋
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Here is an overview of student clearance requests assigned to you.
            </p>
          </div>

          <Link
            href="/instructor/clearance"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl shadow-sm transition shrink-0"
          >
            Manage Requests
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dashboard Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* Total Requested Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Requests
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {totalRequestsCount}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Students assigned to you
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Pending Requests Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Pending Review
              </p>
              <p className="text-3xl font-extrabold text-amber-600 mt-2">
                {pendingRequestsCount}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Awaiting grade & signature
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Reviewed Requests Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Reviewed / Signed
              </p>
              <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                {reviewedRequestsCount}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Completed clearances
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Recent Student Activity Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">
              Recent Clearance Requests
            </h2>

            <Link
              href="/instructor/clearance"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {assignedRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No students have requested clearance from you yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium">
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Year & Section</th>
                    <th className="py-3 px-3">Student ID</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {assignedRequests.slice(0, 5).map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition"
                    >
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {req.studentName}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        {req.yearAndSection}
                      </td>

                      <td className="py-3.5 px-3 text-slate-500 text-xs">
                        {req.studentId || '—'}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full ${
                            req.status === 'Reviewed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
