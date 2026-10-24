
'use client'

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import SignaturePad from 'signature_pad'
import { Trash2 } from 'lucide-react'

export interface DrawSignatureHandle {
  getSignature: () => string | null
  clear: () => void
}

interface DrawSignatureProps {
  saveToLibrary: boolean
  onSaveToLibraryChange: (value: boolean) => void
}

const DrawSignature = forwardRef<
  DrawSignatureHandle,
  DrawSignatureProps
>(function DrawSignature(
  {
    saveToLibrary,
    onSaveToLibraryChange,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const ratio = Math.max(window.devicePixelRatio || 1, 1)

    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio

    canvas.getContext('2d')?.scale(ratio, ratio)

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
    })

    signaturePadRef.current = pad

    return () => {
      pad.off()

      if (signaturePadRef.current === pad) {
        signaturePadRef.current = null
      }
    }
  }, [])

  useImperativeHandle(ref, () => ({
    getSignature: () => {
      const pad = signaturePadRef.current

      if (!pad || pad.isEmpty()) {
        return null
      }

      return pad.toDataURL('image/png')
    },

    clear: () => {
      signaturePadRef.current?.clear()
    },
  }), [])

  const handleClearSignature = () => {
    signaturePadRef.current?.clear()
  }

  return (
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
            onChange={(e) =>
              onSaveToLibraryChange(e.target.checked)
            }
            className="rounded text-slate-900 focus:ring-slate-900"
          />
          Save to signature collection
        </label>

        <button
          type="button"
          onClick={handleClearSignature}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 rounded-lg shadow-sm hover:bg-rose-100 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Canvas
        </button>
      </div>
    </div>
  )
})

export default DrawSignature
