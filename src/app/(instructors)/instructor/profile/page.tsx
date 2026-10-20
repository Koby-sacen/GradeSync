'use client'

import React, { useEffect, useState } from 'react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged, User as FirebaseUser, updateProfile } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { User, Mail, Shield, Calendar, Edit3, Save, X, CheckCircle2, AlertCircle } from 'lucide-react'

export default function InstructorProfilePage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form states
  const [displayName, setDisplayName] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [department, setDepartment] = useState('College of Information and Communications Technology')
  const [position, setPosition] = useState('Instructor I')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        setDisplayName(user.displayName || '')
        setPhotoURL(user.photoURL || '')

        // Fetch additional profile data from Firestore if stored there
        try {
          const userDocRef = doc(db, 'users', user.uid)
          const userSnap = await getDoc(userDocRef)
          if (userSnap.exists()) {
            const data = userSnap.data()
            if (data.department) setDepartment(data.department)
            if (data.position) setPosition(data.position)
          }
        } catch (err) {
          console.error('Error fetching additional profile details:', err)
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    try {
      setSaving(true)
      setSuccessMessage('')
      setErrorMessage('')

      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: displayName,
        photoURL: photoURL,
      })

      // Update Firestore user document if applicable
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        await updateDoc(userDocRef, {
          displayName,
          photoURL,
          department,
          position,
          updatedAt: serverTimestamp(),
        })
      } catch (firestoreErr) {
        console.warn('Firestore user doc update skipped or failed:', firestoreErr)
      }

      setSuccessMessage('Profile updated successfully!')
      setIsEditing(false)
    } catch (error: unknown) {
      console.error('Error updating profile:', error)
      const err = error as Error
      setErrorMessage(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 font-medium">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        
        {/* Header Banner */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Instructor Profile</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage your personal account credentials and institutional details.</p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Profile Card Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          
          {/* Cover gradient band */}
          <div className="h-32 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 px-6 sm:px-8 flex items-end">
            <div className="relative -bottom-10 h-24 w-24 rounded-2xl border-4 border-white bg-slate-300 shadow-md overflow-hidden flex items-center justify-center">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.displayName || 'Avatar'} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-emerald-700 text-white font-bold text-3xl flex items-center justify-center">
                  {(currentUser?.displayName || currentUser?.email || 'I').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Profile Details / Form */}
          <div className="pt-14 p-6 sm:p-8">
            {!isEditing ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{currentUser?.displayName || 'Unnamed Instructor'}</h2>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">{position} • {department}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Email Address</p>
                      <p className="text-sm font-semibold text-slate-900">{currentUser?.email || 'No email provided'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Account Role</p>
                      <p className="text-sm font-semibold text-slate-900">Faculty / Instructor</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Account UID</p>
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-[240px]">{currentUser?.uid}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Email Status</p>
                      <p className="text-sm font-semibold text-emerald-700">
                        {currentUser?.emailVerified ? 'Verified' : 'Unverified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Profile Photo URL</label>
                    <input
                      type="url"
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Department / College</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Academic Position</label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving Changes...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}