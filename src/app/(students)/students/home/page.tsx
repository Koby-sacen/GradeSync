
'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  BookOpen,
} from 'lucide-react'

interface ClearanceRequest {
  id: string
  status: string
  updatedAt?: unknown
}

export default function Page() {
  const router = useRouter()

  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [clearanceStatus, setClearanceStatus] = useState<string>('Not Started')
  const [fetchingData, setFetchingData] = useState(true)

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return

      setLoading(true)
      setAuthorized(false)
      setUser(null)
      setClearanceStatus('Not Started')
      setFetchingData(true)
      setImageError(false)

      // No authenticated user: return to login.
      if (!currentUser) {
        router.replace('/login')

        if (active) {
          setLoading(false)
          setFetchingData(false)
        }

        return
      }

      try {
        // SECURITY: Verify the user's role from Firestore.
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (!active) return

        if (!userSnap.exists()) {
          console.warn(
            '[Student Access] User profile not found:',
            currentUser.uid
          )

          router.replace('/login')
          return
        }

        const userData = userSnap.data()
        const role = userData?.role

        // SECURITY: Only students can access this page.
        if (role !== 'student') {
          console.warn(
            '[Student Access] Access denied. Role:',
            role
          )

          if (role === 'instructor') {
            router.replace('/instructor/home')
          } else {
            router.replace('/login')
          }

          return
        }

        // Role verified: allow student dashboard access.
        setUser(currentUser)
        setAuthorized(true)
        setLoading(false)

        // Fetch only this student's clearance requests.
        try {
          const q = query(
            collection(db, 'requests'),
            where('studentUid', '==', currentUser.uid)
          )

          const querySnapshot = await getDocs(q)

          if (!active) return

          if (!querySnapshot.empty) {
            const reqData = querySnapshot.docs[0].data()

            if (reqData.status) {
              setClearanceStatus(reqData.status)
            }
          }
        } catch (error) {
          console.error(
            '[Student Dashboard] Error fetching clearance status:',
            error
          )
        } finally {
          if (active) {
            setFetchingData(false)
          }
        }
      } catch (error) {
        console.error(
          '[Student Access] Failed to verify student role:',
          error
        )

        if (!active) return

        // Fail closed if the role cannot be verified.
        setAuthorized(false)
        setUser(null)
        router.replace('/login')
      } finally {
        if (active) {
          setLoading(false)
          setFetchingData(false)
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  const photoURL =
    user?.photoURL ||
    user?.providerData?.[0]?.photoURL ||
    null

  const displayName =
    user?.displayName ||
    user?.providerData?.[0]?.displayName ||
    'Student'

  // SECURITY: Never display student content until role verification succeeds.
  if (loading || !authorized || !user) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <p className="text-slate-600 font-medium">
          {loading
            ? 'Verifying student access...'
            : 'Redirecting...'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10 flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-8">

        {/* Top Welcome Banner */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-emerald-200 bg-emerald-50 shadow-inner shrink-0">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-emerald-100" />
              ) : photoURL && !imageError ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-900 text-lg font-semibold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Student Portal
              </p>

              {loading ? (
                <div className="h-7 w-48 animate-pulse rounded bg-slate-200 mt-1" />
              ) : (
                <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                  Welcome back, {displayName}
                </h1>
              )}

              <p className="text-sm text-slate-500 mt-0.5">
                Manage your academic clearance and track your requirements easily.
              </p>
            </div>
          </div>

          <Link
            href="/students/Clearance"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-950 border border-transparent rounded-xl shadow-sm hover:bg-emerald-900 transition focus:outline-none focus:ring-2 focus:ring-emerald-800 shrink-0"
          >
            Open Clearance Form
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Status Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Current Status
                </span>

                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800">
                  {clearanceStatus === 'Reviewed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : clearanceStatus === 'Pending' ? (
                    <Clock className="w-5 h-5 text-amber-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-emerald-700" />
                  )}
                </div>
              </div>

              <p className="text-2xl font-bold text-slate-900">
                {fetchingData ? 'Loading...' : clearanceStatus}
              </p>

              <p className="text-xs text-slate-500 mt-1">
                {clearanceStatus === 'Reviewed'
                  ? 'All requirements have been checked and verified.'
                  : clearanceStatus === 'Pending'
                  ? 'Awaiting verification from assigned instructors.'
                  : 'Get started by creating your clearance form.'}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>System Verification</span>
              <span className="font-medium text-emerald-700">
                Active
              </span>
            </div>
          </div>

          {/* Quick Action Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Clearance Form
                </span>

                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                Fill & Submit
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                Update your subject codes, grades, remarks, and share with your instructors.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                href="/students/Clearance"
                className="inline-flex items-center justify-between w-full text-xs font-semibold text-emerald-900 hover:text-emerald-700 transition"
              >
                <span>Proceed to Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Security & Support Info Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Portal Security
                </span>

                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-800">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                Authenticated Session
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                Your account is securely connected via university credentials and Firebase Auth.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Security Protocol</span>
              <span className="font-medium text-emerald-600">
                Secure
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
