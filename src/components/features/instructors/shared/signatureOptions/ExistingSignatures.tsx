
'use client'

import React, { useState } from 'react'
import {
  deleteDoc,
  doc,
  getDoc,
} from 'firebase/firestore'
import { User as FirebaseUser } from 'firebase/auth'
import { Trash2 } from 'lucide-react'
import { db } from '@/lib/firebase'

export interface SavedSignature {
  id: string
  instructorUid: string
  signatureUrl: string
}

interface ExistingSignaturesProps {
  savedSignatures: SavedSignature[]
  setSavedSignatures: React.Dispatch<
    React.SetStateAction<SavedSignature[]>
  >
  selectedSavedSigUrl: string | null
  setSelectedSavedSigUrl: React.Dispatch<
    React.SetStateAction<string | null>
  >
  currentUser: FirebaseUser | null
  onEmpty: () => void
  onRefresh: (instructorUid: string) => Promise<void>
  onDeletingChange?: (deleting: boolean) => void
}

export default function ExistingSignatures({
  savedSignatures,
  setSavedSignatures,
  selectedSavedSigUrl,
  setSelectedSavedSigUrl,
  currentUser,
  onEmpty,
  onRefresh,
  onDeletingChange,
}: ExistingSignaturesProps) {
  const [deletingSignatureId, setDeletingSignatureId] = useState<
    string | null
  >(null)

  const handleDeleteSignature = async (signatureId: string) => {
    if (!currentUser || deletingSignatureId) return

    const signatureToDelete = savedSignatures.find(
      (sig) => sig.id === signatureId
    )

    if (!signatureToDelete) {
      alert('Signature not found.')
      return
    }

    if (signatureToDelete.instructorUid !== currentUser.uid) {
      alert('You can only delete your own signatures.')
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this e-signature from your saved signatures?'
    )

    if (!confirmed) return

    try {
      setDeletingSignatureId(signatureId)
      onDeletingChange?.(true)

      const signatureRef = doc(db, 'signature', signatureId)
      const signatureSnapshot = await getDoc(signatureRef)

      if (!signatureSnapshot.exists()) {
        alert('This signature no longer exists.')
        await onRefresh(currentUser.uid)
        return
      }

      if (
        signatureSnapshot.data().instructorUid !== currentUser.uid
      ) {
        alert('You are not authorized to delete this signature.')
        return
      }

      await deleteDoc(signatureRef)

      const remainingSignatures = savedSignatures.filter(
        (sig) => sig.id !== signatureId
      )

      setSavedSignatures(remainingSignatures)

      if (
        selectedSavedSigUrl === signatureToDelete.signatureUrl
      ) {
        setSelectedSavedSigUrl(
          remainingSignatures.length > 0
            ? remainingSignatures[0].signatureUrl
            : null
        )
      }

      if (remainingSignatures.length === 0) {
        onEmpty()
      }

      alert('E-signature deleted successfully!')
    } catch (error) {
      console.error('Error deleting e-signature:', error)
      alert('Failed to delete e-signature. Please try again.')
    } finally {
      setDeletingSignatureId(null)
      onDeletingChange?.(false)
    }
  }

  return (
    <div className="w-full mb-4">
      {savedSignatures.length === 0 ? (
        <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
          No saved signatures found. Draw, upload, or type a new signature to save it.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
          {savedSignatures.map((sig) => (
            <div
              key={sig.id}
              onClick={() =>
                setSelectedSavedSigUrl(sig.signatureUrl)
              }
              className={`p-2 border-2 rounded-xl cursor-pointer bg-white flex flex-col items-center justify-center transition ${
                selectedSavedSigUrl === sig.signatureUrl
                  ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <img
                src={sig.signatureUrl}
                alt="Saved Signature"
                className="h-12 object-contain"
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDeleteSignature(sig.id)
                }}
                disabled={deletingSignatureId !== null}
                className="mt-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete this saved e-signature"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingSignatureId === sig.id
                  ? 'Deleting...'
                  : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
