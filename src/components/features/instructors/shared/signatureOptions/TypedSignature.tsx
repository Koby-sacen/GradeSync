
'use client'

import React, {
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react'

interface SignatureFont {
  name: string
  family: string
  googleFamily: string
}

const SIGNATURE_FONTS: SignatureFont[] = [
  {
    name: 'Great Vibes',
    family: 'Great Vibes',
    googleFamily: 'Great+Vibes',
  },
  {
    name: 'Allura',
    family: 'Allura',
    googleFamily: 'Allura',
  },
  {
    name: 'Dancing Script',
    family: 'Dancing Script',
    googleFamily: 'Dancing+Script',
  },
  {
    name: 'Sacramento',
    family: 'Sacramento',
    googleFamily: 'Sacramento',
  },
  {
    name: 'Alex Brush',
    family: 'Alex Brush',
    googleFamily: 'Alex+Brush',
  },
  {
    name: 'Parisienne',
    family: 'Parisienne',
    googleFamily: 'Parisienne',
  },
  {
    name: 'Caveat',
    family: 'Caveat',
    googleFamily: 'Caveat',
  },
  {
    name: 'Pinyon Script',
    family: 'Pinyon Script',
    googleFamily: 'Pinyon+Script',
  },
]

const MAX_SIGNATURE_DATA_URL_LENGTH = 700_000

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  SIGNATURE_FONTS.map(
    (font) => `family=${font.googleFamily}`
  ).join('&') +
  '&display=swap'

function getFontStyle(
  fontFamily: string
): React.CSSProperties {
  return {
    fontFamily: `"${fontFamily}", cursive`,
  }
}

async function createTypedSignatureImage(
  signatureText: string,
  fontFamily: string
): Promise<string> {
  const text = signatureText.trim()

  if (!text) {
    throw new Error('Please type your signature first.')
  }

  await document.fonts.load(
    `64px "${fontFamily}"`,
    text
  )

  if (
    !document.fonts.check(
      `64px "${fontFamily}"`,
      text
    )
  ) {
    throw new Error(
      'The selected signature font could not be loaded. Check your internet connection and try again.'
    )
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error(
      'Unable to generate the typed signature.'
    )
  }

  const maxWidth = 600
  const horizontalPadding = 24
  const verticalPadding = 20

  let fontSize = 64

  context.font = `${fontSize}px "${fontFamily}"`

  while (
    context.measureText(text).width >
      maxWidth - horizontalPadding * 2 &&
    fontSize > 16
  ) {
    fontSize -= 2
    context.font = `${fontSize}px "${fontFamily}"`
  }

  const metrics = context.measureText(text)

  const textWidth = Math.ceil(metrics.width)

  const ascent = Math.ceil(
    metrics.actualBoundingBoxAscent || fontSize
  )

  const descent = Math.ceil(
    metrics.actualBoundingBoxDescent ||
      fontSize * 0.3
  )

  const width = Math.min(
    maxWidth,
    Math.max(
      180,
      textWidth + horizontalPadding * 2
    )
  )

  const height = Math.max(
    100,
    ascent + descent + verticalPadding * 2
  )

  canvas.width = width
  canvas.height = height

  context.font = `${fontSize}px "${fontFamily}"`
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  context.fillStyle = '#111827'

  context.clearRect(0, 0, width, height)

  const baseline =
    (height - (ascent + descent)) / 2 + ascent

  context.fillText(
    text,
    width / 2,
    baseline,
    width - horizontalPadding * 2
  )

  const dataUrl = canvas.toDataURL('image/png')

  if (
    dataUrl.length >
    MAX_SIGNATURE_DATA_URL_LENGTH
  ) {
    throw new Error(
      'The generated signature is too large. Please shorten the text.'
    )
  }

  return dataUrl
}

export interface TypedSignatureHandle {
  getSignature: () => Promise<string>
}

interface TypedSignatureProps {
  saveToLibrary: boolean
  onSaveToLibraryChange: (value: boolean) => void
}

const TypedSignature = forwardRef<
  TypedSignatureHandle,
  TypedSignatureProps
>(function TypedSignature(
  {
    saveToLibrary,
    onSaveToLibraryChange,
  },
  ref
) {
  const [typedSignature, setTypedSignature] = useState('')
  const [selectedFont, setSelectedFont] = useState(
    SIGNATURE_FONTS[0].family
  )

  useImperativeHandle(
    ref,
    () => ({
      getSignature: async () => {
        return createTypedSignatureImage(
          typedSignature,
          selectedFont
        )
      },
    }),
    [typedSignature, selectedFont]
  )

  return (
    <div className="w-full mb-4 space-y-4">
      <link
        rel="stylesheet"
        href={GOOGLE_FONTS_URL}
      />

      <div>
        <label
          htmlFor="typed-signature-input"
          className="block text-xs font-semibold text-slate-700 mb-2"
        >
          Type Your Signature
        </label>

        <input
          id="typed-signature-input"
          type="text"
          value={typedSignature}
          onChange={(e) =>
            setTypedSignature(e.target.value)
          }
          placeholder="Enter your full name"
          maxLength={80}
          className="w-full px-4 py-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Choose a Signature Font
        </p>

        <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
          {SIGNATURE_FONTS.map((font) => (
            <button
              key={font.family}
              type="button"
              onClick={() =>
                setSelectedFont(font.family)
              }
              className={`min-h-20 p-2 rounded-xl border-2 transition flex flex-col items-center justify-center gap-1 ${
                selectedFont === font.family
                  ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span
                className="text-2xl text-slate-900 leading-normal max-w-full truncate"
                style={getFontStyle(font.family)}
              >
                {typedSignature.trim() ||
                  'Your Signature'}
              </span>

              <span className="text-[10px] font-medium text-slate-500">
                {font.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Signature Preview
        </p>

        <div className="w-full min-h-36 px-4 py-5 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center overflow-hidden">
          {typedSignature.trim() ? (
            <span
              className="text-4xl sm:text-5xl text-slate-900 text-center break-words leading-normal"
              style={getFontStyle(selectedFont)}
            >
              {typedSignature}
            </span>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              Your typed signature will appear here.
            </p>
          )}
        </div>
      </div>

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

      <p className="text-[11px] text-slate-400">
        Your typed signature will be converted into a PNG image using your selected font.
      </p>
    </div>
  )
})

export default TypedSignature
