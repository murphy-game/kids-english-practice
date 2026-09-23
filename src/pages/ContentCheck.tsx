import { useEffect, useMemo, useState } from 'react'
import { loadAppData } from '../services/dataLoader'
import { checkAssets } from '../utils/assetChecker'
import type { DataLoadResult } from '../types'

function CopyButton({
  label,
  text,
}: {
  label: string
  text: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)

    window.setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
    >
      {copied ? 'Copied ✓' : label}
    </button>
  )
}

export default function ContentCheck() {
  const [data, setData] = useState<DataLoadResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAppData()
      .then(setData)
      .catch((err) => {
        setError(String(err))
      })
  }, [])

  const stats = useMemo(() => {
    if (!data) {
      return null
    }

    const assetResult = checkAssets(data.content, data.assets)

    return {
      assets: assetResult,
      lessons: data.lessons.length,
      vocab: data.content.filter((item) => item.type === 'vocab').length,
      sentence: data.content.filter((item) => item.type === 'sentence').length,
      phonics: data.content.filter((item) => item.type === 'phonics').length,
    }
  }, [data])

  if (error) {
    return (
      <main className="p-6 text-red-600">
        {error}
      </main>
    )
  }

  if (!data || !stats) {
    return (
      <main className="p-6">
        Loading...
      </main>
    )
  }

  const emojiText = stats.assets.emojiSuggested
    .map((item) => `${item.image_key} -> ${item.emoji}`)
    .join('\n')

  const missingText = [
    'Missing Vocabulary Images:',
    '',
    ...stats.assets.missing,
    '',
    'Generation instruction:',
    'Create child-friendly vocabulary illustrations.',
    'One clear object or concept per image.',
    'Simple background.',
    'No text.',
    'Square composition.',
    'Consistent visual style.',
  ].join('\n')

  const cards = [
    { label: 'Lessons', value: stats.lessons },
    { label: 'Vocabulary', value: stats.vocab },
    { label: 'Sentence', value: stats.sentence },
    { label: 'Phonics', value: stats.phonics },
    { label: 'Image keys', value: stats.assets.requiredKeys.length },
    { label: 'Emoji approved', value: stats.assets.emojiApproved.length },
    { label: 'Emoji suggested', value: stats.assets.emojiSuggested.length },
    { label: 'Image ready', value: stats.assets.imageReady.length },
    { label: 'Missing', value: stats.assets.missing.length },
  ]

  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="mb-6">
        <h1 className="text-3xl font-bold">
          Content Check
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Data Source:{' '}
          {data.source === 'google_sheet'
            ? 'Google Sheet ✅'
            : 'Local fallback ⚠️'}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Last loaded:{' '}
          {new Date(data.loadedAt).toLocaleString()}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className="text-sm text-slate-500">
              {card.label}
            </div>

            <div className="mt-1 text-3xl font-bold">
              {card.value}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              Emoji Suggestions
            </h2>

            <CopyButton
              label="Copy Emoji Suggestions"
              text={emojiText || 'No emoji suggestions'}
            />
          </div>

          <div className="mt-4 max-h-96 overflow-auto">
            {stats.assets.emojiSuggested.length > 0 ? (
              stats.assets.emojiSuggested.map((item) => (
                <div
                  key={item.image_key}
                  className="flex items-center justify-between border-b py-2"
                >
                  <span>{item.image_key}</span>

                  <span className="text-2xl">
                    {item.emoji}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">
                No suggestions.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              Missing Images
            </h2>

            <CopyButton
              label="Copy Missing List"
              text={missingText}
            />
          </div>

          <div className="mt-4 max-h-96 overflow-auto">
            {stats.assets.missing.length > 0 ? (
              stats.assets.missing.map((imageKey) => (
                <div
                  key={imageKey}
                  className="border-b py-2"
                >
                  {imageKey}
                </div>
              ))
            ) : (
              <p className="text-emerald-600">
                All required image keys have a usable source.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
