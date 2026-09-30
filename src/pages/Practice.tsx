import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadAppData } from '../services/dataLoader'

import type {
  Asset,
  ContentItem,
  LessonPractice,
} from '../types'

type QuestionType =
  | 'image_to_word'
  | 'audio_to_word'
  | 'word_to_image'
  | 'missing_letter'

type VisualOption = {
  key: string
  english: string
  asset: Asset
}

type Question = {
  id: string
  type: QuestionType
  item: ContentItem
  textOptions?: string[]
  visualOptions?: VisualOption[]
  correctAnswer: string
  asset?: Asset
  maskedWord?: string
}

const IMAGE_BASE_PATH =
  '/kids-english-practice/assets/images/vocabulary/'

const LETTER_POOL =
  'abcdefghijklmnopqrstuvwxyz'.split('')

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function isPersonName(item: ContentItem) {
  return item.chinese.includes('人名')
}

function getVocabulary(
  content: ContentItem[],
  lessonId: string,
) {
  return content.filter(
    (item) =>
      item.lesson_id === lessonId &&
      item.type === 'vocab' &&
      item.english.trim() !== '' &&
      !isPersonName(item),
  )
}

function getRecommendedTypes(
  lessonPractice: LessonPractice[],
  lessonId: string,
): string[] {
  const row = lessonPractice.find(
    (item) =>
      item.lesson_id === lessonId &&
      item.category === 'vocab',
  )

  if (!row) {
    return []
  }

  return row.recommended_question_types
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function createEnglishOptions(
  item: ContentItem,
  vocab: ContentItem[],
) {
  const distractors = shuffle(
    vocab
      .filter(
        (other) =>
          other.item_id !== item.item_id &&
          other.english !== item.english,
      )
      .map((other) => other.english),
  ).slice(0, 3)

  return shuffle([
    item.english,
    ...distractors,
  ])
}

function createMissingLetterQuestion(
  item: ContentItem,
) {
  const word =
    item.english.toLowerCase()

  const validIndexes = word
    .split('')
    .map((char, index) => ({
      char,
      index,
    }))
    .filter(({ char }) =>
      /^[a-z]$/.test(char),
    )

  if (validIndexes.length === 0) {
    return null
  }

  const picked =
    validIndexes[
      Math.floor(
        Math.random() *
          validIndexes.length,
      )
    ]

  const missingLetter =
    picked.char

  const maskedWord = word
    .split('')
    .map((char, index) =>
      index === picked.index
        ? '_'
        : char,
    )
    .join('')

  const wrongLetters =
    shuffle(
      LETTER_POOL.filter(
        (letter) =>
          letter !==
          missingLetter,
      ),
    ).slice(0, 3)

  return {
    maskedWord,
    missingLetter,
    options: shuffle([
      missingLetter,
      ...wrongLetters,
    ]),
  }
}

function getUsableAsset(
  item: ContentItem,
  assetMap: Map<string, Asset>,
) {
  if (!item.image_key) {
    return undefined
  }

  const asset =
    assetMap.get(
      item.image_key,
    )

  if (!asset) {
    return undefined
  }

  if (
    asset.display_type === 'emoji' &&
    asset.status === 'approved' &&
    asset.emoji
  ) {
    return asset
  }

  if (
    asset.display_type === 'image' &&
    asset.status === 'approved'
  ) {
    return asset
  }

  return undefined
}

function createVisualOptions(
  item: ContentItem,
  vocab: ContentItem[],
  assetMap: Map<string, Asset>,
): VisualOption[] {
  const correctAsset =
    getUsableAsset(
      item,
      assetMap,
    )

  if (!correctAsset) {
    return []
  }

  const distractorItems =
    shuffle(
      vocab.filter(
        (other) =>
          other.item_id !==
            item.item_id &&
          getUsableAsset(
            other,
            assetMap,
          ),
      ),
    ).slice(0, 3)

  const options: VisualOption[] = [
    {
      key: item.image_key,
      english: item.english,
      asset: correctAsset,
    },
    ...distractorItems.map(
      (other) => ({
        key: other.image_key,
        english: other.english,
        asset:
          getUsableAsset(
            other,
            assetMap,
          ) as Asset,
      }),
    ),
  ]

  return shuffle(options)
}

function buildQuestions(
  vocab: ContentItem[],
  assets: Asset[],
  recommendedTypes: string[],
): Question[] {
  const assetMap = new Map(
    assets.map((asset) => [
      asset.image_key,
      asset,
    ]),
  )

  const supportedRecommended =
    recommendedTypes.filter(
      (type) =>
        type === 'image_to_word' ||
        type === 'audio_to_word' ||
        type === 'audio_to_image' ||
        type === 'missing_letter',
    )

  const availableTypes: QuestionType[] = []

  for (const type of supportedRecommended) {
    if (type === 'audio_to_image') {
      availableTypes.push(
        'word_to_image',
      )
    } else {
      availableTypes.push(
        type as QuestionType,
      )
    }
  }

  if (
    !availableTypes.includes(
      'word_to_image',
    )
  ) {
    availableTypes.push(
      'word_to_image',
    )
  }

  const uniqueTypes = [
    ...new Set(availableTypes),
  ]

  const selectedItems =
    shuffle(vocab).slice(
      0,
      Math.min(10, vocab.length),
    )

  return selectedItems.map(
    (item, index) => {
      let type =
        uniqueTypes[
          index %
            uniqueTypes.length
        ]

      const asset =
        getUsableAsset(
          item,
          assetMap,
        )

      if (
        type ===
          'image_to_word' &&
        !asset
      ) {
        type =
          'audio_to_word'
      }

      if (
        type ===
        'word_to_image'
      ) {
        const visualOptions =
          createVisualOptions(
            item,
            vocab,
            assetMap,
          )

        if (
          visualOptions.length <
          2
        ) {
          type =
            'audio_to_word'
        } else {
          return {
            id: `${item.item_id}-word-image`,
            type,
            item,
            correctAnswer:
              item.english,
            visualOptions,
          }
        }
      }

      if (
        type ===
        'image_to_word'
      ) {
        return {
          id: `${item.item_id}-image-word`,
          type,
          item,
          asset,
          correctAnswer:
            item.english,
          textOptions:
            createEnglishOptions(
              item,
              vocab,
            ),
        }
      }

      if (
        type ===
        'audio_to_word'
      ) {
        return {
          id: `${item.item_id}-audio-word`,
          type,
          item,
          correctAnswer:
            item.english,
          textOptions:
            createEnglishOptions(
              item,
              vocab,
            ),
        }
      }

      if (
        type ===
        'missing_letter'
      ) {
        const missing =
          createMissingLetterQuestion(
            item,
          )

        if (missing) {
          return {
            id: `${item.item_id}-missing`,
            type,
            item,
            correctAnswer:
              missing.missingLetter,
            textOptions:
              missing.options,
            maskedWord:
              missing.maskedWord,
          }
        }
      }

      return {
        id: `${item.item_id}-fallback`,
        type: 'audio_to_word',
        item,
        correctAnswer:
          item.english,
        textOptions:
          createEnglishOptions(
            item,
            vocab,
          ),
      }
    },
  )
}

function speakEnglish(
  text: string,
) {
  if (
    typeof window ===
      'undefined' ||
    !(
      'speechSynthesis' in
      window
    )
  ) {
    return
  }

  window.speechSynthesis.cancel()

  const utterance =
    new SpeechSynthesisUtterance(
      text,
    )

  utterance.lang = 'en-US'
  utterance.rate = 0.85
  utterance.pitch = 1

  window.speechSynthesis.speak(
    utterance,
  )
}

function getImageUrl(
  asset: Asset,
) {
  const file =
    asset.image_file.trim()

  return `${IMAGE_BASE_PATH}${encodeURIComponent(
    file,
  )}`
}

function Visual({
  asset,
  size = 'large',
}: {
  asset: Asset
  size?: 'large' | 'small'
}) {
  if (
    asset.display_type ===
      'emoji' &&
    asset.emoji
  ) {
    return (
      <div
        className={
          size === 'large'
            ? 'text-8xl'
            : 'text-6xl'
        }
      >
        {asset.emoji}
      </div>
    )
  }

  if (
    asset.display_type ===
    'image'
  ) {
    return (
      <img
        src={getImageUrl(
          asset,
        )}
        alt=""
        className={
          size === 'large'
            ? 'h-52 w-52 object-contain'
            : 'h-28 w-28 object-contain'
        }
      />
    )
  }

  return null
}

export default function Practice() {
  const location = useLocation()
  const navigate = useNavigate()

  const params =
    new URLSearchParams(
      location.search,
    )

  const lessonId =
    params.get('lesson') ?? ''

  const [
    questions,
    setQuestions,
  ] = useState<Question[]>([])

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0)

  const [
    selected,
    setSelected,
  ] =
    useState<string | null>(
      null,
    )

  const [score, setScore] =
    useState(0)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(() => {
    async function load() {
      try {
        const data =
          await loadAppData()

        const vocab =
          getVocabulary(
            data.content,
            lessonId,
          )

        if (
          vocab.length === 0
        ) {
          throw new Error(
            'No vocabulary found for this lesson.',
          )
        }

        const recommendedTypes =
          getRecommendedTypes(
            data.lessonPractice,
            lessonId,
          )

        const builtQuestions =
          buildQuestions(
            vocab,
            data.assets,
            recommendedTypes,
          )

        setQuestions(
          builtQuestions,
        )
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    if (lessonId) {
      load()
    } else {
      setError(
        'Missing lesson id.',
      )
      setLoading(false)
    }

    return () => {
      if (
        typeof window !==
          'undefined' &&
        'speechSynthesis' in
          window
      ) {
        window.speechSynthesis.cancel()
      }
    }
  }, [lessonId])

  const currentQuestion =
    useMemo(
      () =>
        questions[
          currentIndex
        ],
      [
        questions,
        currentIndex,
      ],
    )

  const finished =
    questions.length > 0 &&
    currentIndex >=
      questions.length

  function chooseAnswer(
    answer: string,
  ) {
    if (
      !currentQuestion ||
      selected
    ) {
      return
    }

    setSelected(answer)

    if (
      answer ===
      currentQuestion.correctAnswer
    ) {
      setScore(
        (value) =>
          value + 1,
      )
    }
  }

  function nextQuestion() {
    if (
      typeof window !==
        'undefined' &&
      'speechSynthesis' in
        window
    ) {
      window.speechSynthesis.cancel()
    }

    setSelected(null)
    setCurrentIndex(
      (value) =>
        value + 1,
    )
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        Loading practice...
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            Practice unavailable
          </h1>

          <p className="mt-2 text-slate-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/')
            }
            className="mt-5 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white"
          >
            Back home
          </button>
        </div>
      </main>
    )
  }

  if (finished) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">
            🌱
          </div>

          <h1 className="mt-4 text-3xl font-bold">
            Practice complete!
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            You got {score} /{' '}
            {questions.length}{' '}
            correct.
          </p>

          <div className="mt-6 text-4xl">
            💧
          </div>

          <p className="mt-2 font-semibold text-emerald-600">
            You earned water
            for your tree!
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/')
            }
            className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white"
          >
            Back to lessons
          </button>
        </div>
      </main>
    )
  }

  if (!currentQuestion) {
    return null
  }

  const progress =
    ((currentIndex + 1) /
      questions.length) *
    100

  return (
    <main className="mx-auto max-w-3xl p-6">
      <section className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Question{' '}
            {currentIndex + 1} /{' '}
            {questions.length}
          </span>

          <span>
            Score {score}
          </span>
        </div>

        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{
              width:
                `${progress}%`,
            }}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">

        {currentQuestion.type ===
          'image_to_word' && (
          <>
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              What is this?
            </p>

            <div className="mt-6 flex justify-center">
              {currentQuestion.asset && (
                <Visual
                  asset={
                    currentQuestion.asset
                  }
                />
              )}
            </div>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(
                    currentQuestion
                      .item
                      .english,
                  )
                }
                className="rounded-full bg-sky-50 px-4 py-3 text-2xl transition hover:bg-sky-100"
                aria-label="Play pronunciation"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {currentQuestion.type ===
          'audio_to_word' && (
          <>
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              Listen and choose
            </p>

            <div className="my-8 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(
                    currentQuestion
                      .item
                      .english,
                  )
                }
                className="rounded-full bg-sky-100 px-8 py-6 text-5xl shadow-sm transition hover:scale-105"
              >
                🔊
              </button>

              <p className="mt-3 text-sm text-slate-400">
                Tap to listen
              </p>
            </div>
          </>
        )}

        {currentQuestion.type ===
          'word_to_image' && (
          <>
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              Choose the picture
            </p>

            <h1 className="mt-4 text-center text-5xl font-bold text-slate-800">
              {
                currentQuestion
                  .item
                  .english
              }
            </h1>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(
                    currentQuestion
                      .item
                      .english,
                  )
                }
                className="rounded-full px-4 py-2 text-2xl hover:bg-slate-100"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {currentQuestion.type ===
          'missing_letter' && (
          <>
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              Choose the missing letter
            </p>

            <div className="mt-5 text-center">
              <div className="text-5xl font-bold tracking-[0.18em] text-slate-800">
                {
                  currentQuestion
                    .maskedWord
                }
              </div>

              <button
                type="button"
                onClick={() =>
                  speakEnglish(
                    currentQuestion
                      .item
                      .english,
                  )
                }
                className="mt-4 rounded-full bg-sky-50 px-4 py-3 text-3xl hover:bg-sky-100"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {currentQuestion.type ===
          'word_to_image' ? (
          <div className="mt-8 grid grid-cols-2 gap-4">
            {currentQuestion.visualOptions?.map(
              (option) => {
                const isCorrect =
                  option.english ===
                    currentQuestion.correctAnswer

                const isSelected =
                  option.english ===
                    selected

                let className =
                  'flex min-h-40 items-center justify-center rounded-2xl border-2 p-4 transition '

                if (!selected) {
                  className +=
                    'border-slate-200 bg-white hover:border-emerald-400'
                } else if (
                  isCorrect
                ) {
                  className +=
                    'border-emerald-500 bg-emerald-50'
                } else if (
                  isSelected
                ) {
                  className +=
                    'border-red-400 bg-red-50'
                } else {
                  className +=
                    'border-slate-200 bg-slate-50 opacity-50'
                }

                return (
                  <button
                    key={
                      option.key
                    }
                    type="button"
                    onClick={() =>
                      chooseAnswer(
                        option.english,
                      )
                    }
                    disabled={
                      selected !==
                      null
                    }
                    className={
                      className
                    }
                  >
                    <Visual
                      asset={
                        option.asset
                      }
                      size="small"
                    />
                  </button>
                )
              },
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {currentQuestion.textOptions?.map(
              (option) => {
                const isCorrect =
                  option ===
                    currentQuestion.correctAnswer

                const isSelected =
                  option ===
                    selected

                let className =
                  'rounded-2xl border-2 p-4 text-lg font-semibold transition '

                if (!selected) {
                  className +=
                    'border-slate-200 bg-white hover:border-emerald-400'
                } else if (
                  isCorrect
                ) {
                  className +=
                    'border-emerald-500 bg-emerald-50 text-emerald-700'
                } else if (
                  isSelected
                ) {
                  className +=
                    'border-red-400 bg-red-50 text-red-600'
                } else {
                  className +=
                    'border-slate-200 bg-slate-50 text-slate-400'
                }

                return (
                  <button
                    key={
                      option
                    }
                    type="button"
                    onClick={() =>
                      chooseAnswer(
                        option,
                      )
                    }
                    disabled={
                      selected !==
                      null
                    }
                    className={
                      className
                    }
                  >
                    {option}
                  </button>
                )
              },
            )}
          </div>
        )}

        {selected && (
          <div className="mt-6 text-center">
            <p
              className={
                selected ===
                currentQuestion.correctAnswer
                  ? 'font-bold text-emerald-600'
                  : 'font-bold text-red-500'
              }
            >
              {selected ===
              currentQuestion.correctAnswer
                ? 'Correct! 🎉'
                : currentQuestion.type ===
                    'missing_letter'
                  ? `Answer: ${currentQuestion.correctAnswer}`
                  : `Answer: ${currentQuestion.correctAnswer}`}
            </p>

            <button
              type="button"
              onClick={
                nextQuestion
              }
              className="mt-4 rounded-xl bg-slate-800 px-5 py-3 font-semibold text-white"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
