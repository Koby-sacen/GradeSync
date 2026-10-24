
'use client'

import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'

import { User as FirebaseUser } from 'firebase/auth'
import { db } from '@/lib/firebase'

import {
  CheckCircle2,
  X,
  PenLine,
  ImagePlus,
  Type,
} from 'lucide-react'

import ExistingSignatures, {
  type SavedSignature,
} from '../shared/signatureOptions/ExistingSignatures'

import DrawSignature, {
  type DrawSignatureHandle,
} from '../shared/signatureOptions/DrawSignature'

import UploadSignature from '../shared/signatureOptions/UploadSignature'

import TypedSignature, {
  type TypedSignatureHandle,
} from '../shared/signatureOptions/TypedSignature'

interface ESignatureProps {
  isSigningOpen: boolean
  activeSigningSubjectId: string | null
  currentUser: FirebaseUser | null
  onClose: () => void
  onApplySignature: (
    subjectId: string,
    signatureUrl: string
  ) => void
}

type SignatureTab =
  | 'existing'
  | 'draw'
  | 'upload'
  | 'type'

export default function ESignature({
  isSigningOpen,
  activeSigningSubjectId,
  currentUser,
  onClose,
  onApplySignature,
}: ESignatureProps) {
  const [savedSignatures, setSavedSignatures] =
    useState<SavedSignature[]>([])

  const [
    selectedSavedSigUrl,
    setSelectedSavedSigUrl,
  ] = useState<string | null>(null)

  const [activeTab, setActiveTab] =
    useState<SignatureTab>('existing')

  const [saveToLibrary, setSaveToLibrary] =
    useState(true)

  const [savingSignature, setSavingSignature] =
    useState(false)

  const [deletingSignature, setDeletingSignature] =
    useState(false)

  const [processingImage, setProcessingImage] =
    useState(false)

  const [
    processingTypedSignature,
    setProcessingTypedSignature,
  ] = useState(false)

  const [
    uploadedSignatureUrl,
    setUploadedSignatureUrl,
  ] = useState<string | null>(null)

  const drawSignatureRef =
    useRef<DrawSignatureHandle | null>(null)

  const typedSignatureRef =
    useRef<TypedSignatureHandle | null>(null)

  // Fetch saved signatures belonging to the instructor.
  const fetchSavedSignatures = async (
    instructorUid: string
  ) => {
    try {
      const q = query(
        collection(db, 'signature'),
        where(
          'instructorUid',
          '==',
          instructorUid
        )
      )

      const querySnapshot = await getDocs(q)

      const fetchedSigs: SavedSignature[] = []

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()

        fetchedSigs.push({
          id: docSnap.id,
          instructorUid:
            data.instructorUid || instructorUid,
          signatureUrl:
            data.signatureUrl || '',
        })
      })

      setSavedSignatures(fetchedSigs)

      if (fetchedSigs.length > 0) {
        setSelectedSavedSigUrl(
          fetchedSigs[0].signatureUrl
        )

        setActiveTab('existing')
      } else {
        setSelectedSavedSigUrl(null)
        setActiveTab('draw')
      }
    } catch (error) {
      console.error(
        'Error fetching saved signatures:',
        error
      )
    }
  }

  // Load signatures whenever the modal opens.
  useEffect(() => {
    if (!isSigningOpen || !currentUser?.uid) {
      return
    }

    let cancelled = false
    const instructorUid = currentUser.uid

    const loadSignatures = async () => {
      try {
        const q = query(
          collection(db, 'signature'),
          where(
            'instructorUid',
            '==',
            instructorUid
          )
        )

        const querySnapshot = await getDocs(q)

        if (cancelled) return

        const fetchedSigs: SavedSignature[] = []

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data()

          fetchedSigs.push({
            id: docSnap.id,
            instructorUid:
              data.instructorUid || instructorUid,
            signatureUrl:
              data.signatureUrl || '',
          })
        })

        setSavedSignatures(fetchedSigs)

        if (fetchedSigs.length > 0) {
          setSelectedSavedSigUrl(
            fetchedSigs[0].signatureUrl
          )

          setActiveTab('existing')
        } else {
          setSelectedSavedSigUrl(null)
          setActiveTab('draw')
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Error fetching saved signatures:',
            error
          )
        }
      }
    }

    void loadSignatures()

    return () => {
      cancelled = true
    }
  }, [isSigningOpen, currentUser?.uid])

  // Save a signature to the library AND log its
  // activity in the same Firestore batch.
  const saveSignatureWithActivity = async (
    signatureUrl: string,
    signatureType: SignatureTab
  ) => {
    if (!currentUser) {
      throw new Error(
        'You must be signed in to save a signature.'
      )
    }

    const signatureRef = doc(
      collection(db, 'signature')
    )

    const activityRef = doc(
      collection(db, 'activities')
    )

    const batch = writeBatch(db)

    batch.set(signatureRef, {
      instructorUid: currentUser.uid,
      signatureUrl,
      createdAt: serverTimestamp(),
    })

    batch.set(activityRef, {
      actorUid: currentUser.uid,

      actorEmail:
        currentUser.email || '',

      actorName:
        currentUser.displayName ||
        currentUser.email ||
        'Instructor',

      action: 'signature_saved',
      category: 'signature',
      status: 'success',

      description:
        `Saved a new ${signatureType} signature ` +
        'to the instructor signature library.',

      studentName: '',
      studentUid: '',
      subjectCode: '',
      clearanceId: '',

      signatureId: signatureRef.id,

      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return signatureRef.id
  }

  // Handle existing, drawn, uploaded and typed signatures.
  const handleSaveSignature = async () => {
    if (
      !currentUser ||
      savingSignature ||
      deletingSignature ||
      processingImage ||
      processingTypedSignature
    ) {
      return
    }

    let finalSignatureUrl = ''

    if (activeTab === 'existing') {
      if (!selectedSavedSigUrl) {
        alert(
          'Please select an existing signature.'
        )
        return
      }

      finalSignatureUrl =
        selectedSavedSigUrl
    } else if (activeTab === 'draw') {
      const signature =
        drawSignatureRef.current?.getSignature()

      if (!signature) {
        alert(
          'Please provide a signature first.'
        )
        return
      }

      finalSignatureUrl = signature
    } else if (activeTab === 'upload') {
      if (!uploadedSignatureUrl) {
        alert(
          'Please upload a signature image first.'
        )
        return
      }

      finalSignatureUrl =
        uploadedSignatureUrl
    } else if (activeTab === 'type') {
      try {
        setProcessingTypedSignature(true)

        if (!typedSignatureRef.current) {
          alert(
            'Please type your signature first.'
          )
          return
        }

        finalSignatureUrl =
          await typedSignatureRef.current.getSignature()
      } catch (error) {
        console.error(
          'Error generating typed signature:',
          error
        )

        alert(
          error instanceof Error
            ? error.message
            : 'Failed to generate the typed signature.'
        )

        return
      } finally {
        setProcessingTypedSignature(false)
      }
    }

    if (!finalSignatureUrl) {
      alert('Please provide a valid signature.')
      return
    }

    // Preserve existing save-to-library behavior.
    const shouldSaveToLibrary =
      activeTab !== 'existing' &&
      (
        saveToLibrary ||
        !activeSigningSubjectId
      )

    if (shouldSaveToLibrary) {
      try {
        setSavingSignature(true)

        // Saves signature and activity atomically.
        await saveSignatureWithActivity(
          finalSignatureUrl,
          activeTab
        )

        await fetchSavedSignatures(
          currentUser.uid
        )
      } catch (error) {
        console.error(
          'Error saving signature and activity:',
          error
        )

        // When adding directly to the library,
        // a failed save must not show success.
        if (!activeSigningSubjectId) {
          alert(
            'Failed to save signature and activity. ' +
            'Please check Firestore permissions.'
          )
          return
        }

        // Preserve the original behavior:
        // a signature may still be applied locally
        // even when saving it to the library fails.
      } finally {
        setSavingSignature(false)
      }
    }

    // Preserve the original callback behavior.
    // The parent clearance page logs this application
    // when Save Grades & Sign persists the clearance.
    if (activeSigningSubjectId) {
      onApplySignature(
        activeSigningSubjectId,
        finalSignatureUrl
      )
    } else {
      alert(
        'Signature saved to your library successfully!'
      )
    }

    onClose()
  }

  if (!isSigningOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col items-center max-h-[90vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="flex justify-between items-center w-full mb-1">
          <h2 className="text-lg font-bold text-slate-900">
            {activeSigningSubjectId
              ? 'Apply E-Signature'
              : 'Add E-Signature to Collection'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            aria-label="Close signature modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4 text-center">
          Choose an existing signature, draw, upload an image, or type your signature.
        </p>

        {/* Four Signature Options */}
        <div className="grid grid-cols-4 w-full bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200 gap-1">
          <button
            type="button"
            onClick={() =>
              setActiveTab('existing')
            }
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-semibold rounded-lg transition ${
              activeTab === 'existing'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Existing ({savedSignatures.length})
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('draw')
            }
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-semibold rounded-lg transition ${
              activeTab === 'draw'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <PenLine className="w-4 h-4" />
            Draw New
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('upload')
            }
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-semibold rounded-lg transition ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ImagePlus className="w-4 h-4" />
            Upload Image
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab('type')
            }
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] sm:text-xs font-semibold rounded-lg transition ${
              activeTab === 'type'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Type className="w-4 h-4" />
            Type Signature
          </button>
        </div>

        {/* Existing Signature Collection */}
        {activeTab === 'existing' && (
          <ExistingSignatures
            savedSignatures={savedSignatures}
            setSavedSignatures={setSavedSignatures}
            selectedSavedSigUrl={
              selectedSavedSigUrl
            }
            setSelectedSavedSigUrl={
              setSelectedSavedSigUrl
            }
            currentUser={currentUser}
            onEmpty={() =>
              setActiveTab('draw')
            }
            onRefresh={
              fetchSavedSignatures
            }
            onDeletingChange={
              setDeletingSignature
            }
          />
        )}

        {/* Draw Signature */}
        {activeTab === 'draw' && (
          <DrawSignature
            ref={drawSignatureRef}
            saveToLibrary={saveToLibrary}
            onSaveToLibraryChange={
              setSaveToLibrary
            }
          />
        )}

        {/* Upload Signature */}
        {activeTab === 'upload' && (
          <UploadSignature
            uploadedSignatureUrl={
              uploadedSignatureUrl
            }
            onUploadedSignatureChange={
              setUploadedSignatureUrl
            }
            onProcessingChange={
              setProcessingImage
            }
            saveToLibrary={saveToLibrary}
            onSaveToLibraryChange={
              setSaveToLibrary
            }
          />
        )}

        {/* Typed Signature */}
        {activeTab === 'type' && (
          <TypedSignature
            ref={typedSignatureRef}
            saveToLibrary={saveToLibrary}
            onSaveToLibraryChange={
              setSaveToLibrary
            }
          />
        )}

        {/* Original Modal Action Buttons */}
        <div className="flex justify-end w-full gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={savingSignature}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              void handleSaveSignature()
            }
            disabled={
              savingSignature ||
              deletingSignature ||
              processingImage ||
              processingTypedSignature
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />

            {savingSignature
              ? 'Saving...'
              : processingImage ||
                  processingTypedSignature
                ? 'Processing...'
                : activeSigningSubjectId
                  ? 'Confirm & Apply'
                  : 'Save Signature'}
          </button>
        </div>
      </div>
    </div>
  )
}
