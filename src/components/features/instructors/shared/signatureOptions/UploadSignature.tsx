
'use client'

import React, { useRef, useState } from 'react'
import {
  Upload,
  ImagePlus,
  Trash2,
} from 'lucide-react'

interface UploadSignatureProps {
  uploadedSignatureUrl: string | null
  onUploadedSignatureChange: (url: string | null) => void
  onProcessingChange: (processing: boolean) => void
  saveToLibrary: boolean
  onSaveToLibraryChange: (value: boolean) => void
}

const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024
const MAX_SIGNATURE_DATA_URL_LENGTH = 700_000
const MAX_IMAGE_WIDTH = 600
const MAX_IMAGE_HEIGHT = 240

const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

function convertImageToSignature(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      try {
        const scale = Math.min(
          MAX_IMAGE_WIDTH / image.naturalWidth,
          MAX_IMAGE_HEIGHT / image.naturalHeight,
          1
        )

        const width = Math.max(
          1,
          Math.round(image.naturalWidth * scale)
        )

        const height = Math.max(
          1,
          Math.round(image.naturalHeight * scale)
        )

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('Unable to process the uploaded image.'))
          return
        }

        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, width, height)

        const signatureDataUrl = canvas.toDataURL('image/png')

        if (
          signatureDataUrl.length >
          MAX_SIGNATURE_DATA_URL_LENGTH
        ) {
          reject(
            new Error(
              'The processed signature image is too large. Please use a smaller or simpler image.'
            )
          )
          return
        }

        resolve(signatureDataUrl)
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(imageUrl)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('Unable to read the selected image.'))
    }

    image.src = imageUrl
  })
}

export default function UploadSignature({
  uploadedSignatureUrl,
  onUploadedSignatureChange,
  onProcessingChange,
  saveToLibrary,
  onSaveToLibraryChange,
}: UploadSignatureProps) {
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [processingImage, setProcessingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleUploadSignature = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      alert('Please select a PNG, JPG, JPEG, or WebP image.')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      return
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      alert('The image must be 10 MB or smaller.')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      return
    }

    try {
      setProcessingImage(true)
      onProcessingChange(true)

      const signatureDataUrl =
        await convertImageToSignature(file)

      onUploadedSignatureChange(signatureDataUrl)
      setUploadedFileName(file.name)
    } catch (error) {
      console.error(
        'Error processing uploaded signature:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to process the signature image.'
      )
    } finally {
      setProcessingImage(false)
      onProcessingChange(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveUploadedSignature = () => {
    onUploadedSignatureChange(null)
    setUploadedFileName('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full mb-4 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUploadSignature}
        className="hidden"
      />

      {!uploadedSignatureUrl ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 p-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-slate-500" />
            </div>
          </div>

          <p className="text-sm font-semibold text-slate-800 mb-1">
            Upload Your Signature
          </p>

          <p className="text-xs text-slate-500 mb-4">
            Select a picture of your handwritten signature.
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processingImage}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {processingImage
              ? 'Processing...'
              : 'Choose Image'}
          </button>

          <p className="text-[11px] text-slate-400 mt-3">
            PNG, JPG, JPEG, or WebP · Maximum 10 MB
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="border-2 border-slate-200 rounded-xl bg-white p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3">
              Signature Preview
            </p>

            <div className="w-full h-40 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
              <img
                src={uploadedSignatureUrl}
                alt="Uploaded Signature Preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>

            <p className="text-[11px] text-slate-500 mt-2 truncate">
              {uploadedFileName}
            </p>
          </div>

          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processingImage}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {processingImage
                ? 'Processing...'
                : 'Change Image'}
            </button>

            <button
              type="button"
              onClick={handleRemoveUploadedSignature}
              disabled={processingImage}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Image
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer px-1">
        <input
          type="checkbox"
          checked={saveToLibrary}
          onChange={(e) =>
            onSaveToLibraryChange(e.target.checked)
          }
          className="rounded text-slate-900 focus:ring-slate-900"
        />
        Save to signature collection
      </label>
    </div>
  )
}
