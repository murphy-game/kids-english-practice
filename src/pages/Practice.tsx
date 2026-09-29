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
  | 'word_to_meaning'

type Question = {
  id: string
  type: QuestionType
  item: ContentItem
  options: string[]
  correctAnswer: string
  asset?: Asset
}

const IMAGE_BASE_PATH =
  '/kids-english-practice/assets/images/vocabulary/'

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
      item.chinese.trim() !== '' &&
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

function createChineseOptions(
  item: ContentItem,
  vocab: ContentItem[],
) {
  const distractors = shuffle(
    vocab
      .filter(
        (other) =>
          other.item_id !== item.item_id &&
          other.chinese !== item.chinese,
      )
      .map((other) => other.chinese),
  ).slice(0, 3)

  return shuffle([
    item.chinese,
    ...distractors,
  ])
}

function hasUsableVisual(
  item: ContentItem,
  assetMap: Map<string, Asset>,
) {
  if (!item.image_key) {
    return false
  }

  const asset =
    assetMap.get(item.image_key)

  if (!asset) {
    return false
  }

  if (
    asset.display_type === 'emoji' &&
    asset.status === 'approved' &&
    asset.emoji
  ) {
    return true
  }

  if (
    asset.display_type === 'image' &&
    asset.status === 'approved'
  ) {
    return true
  }

  return false
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
        type === 'audio_to_word',
    )

  const availableTypes: QuestionType[] = [
    ...supportedRecommended as QuestionType[],
    'word_to_meaning',
  ]

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
          index % uniqueTypes.length
        ]

      if (
        type === 'image_to_word' &&
        !hasUsableVisual(item, assetMap)
      ) {
        type = 'audio_to_word'
      }

      if (type === 'image_to_word') {
        return {
          id: `${item.item_id}-image`,
          type,
          item,
          asset:
            assetMap.get(item.image_key),
          correctAnswer: item.english,
          options: createEnglishOptions(
            item,
            vocab,
          ),
        }
      }

      if (type === 'audio_to_word') {
        return {
          id: `${item.item_id}-audio`,
          type,
          item,
          correctAnswer: item.english,
          options: createEnglishOptions(
            item,
            vocab,
          ),
        }
      }

      return {
        id: `${item.item_id}-meaning`,
        type: 'word_to_meaning',
        item,
        correctAnswer: item.chinese,
        options: createChineseOptions(
          item,
          vocab,
        ),
      }
    },
  )
}

function speakEnglish(text: string) {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window)
  ) {
    return
  }

  window.speechSynthesis.cancel()

  const utterance =
    new SpeechSynthesisUtterance(text)

  utterance.lang = 'en-US'
  utterance.rate = 0.85
  utterance.pitch = 1

  window.speechSynthesis.speak(
    utterance,
  )
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

  const [questions, setQuestions] =
    useState<Question[]>([])

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0)

  const [
    selected,
    setSelected,
  ] = useState<string | null>(null)

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

        if (vocab.length === 0) {
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
        'speechSynthesis' in window
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
        (value) => value + 1,
      )
    }
  }

  function nextQuestion() {
    if (
      typeof window !==
        'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel()
    }

    setSelected(null)

    setCurrentIndex(
      (value) => value + 1,
    )
  }

  function renderVisual(
    question: Question,
  ) {
    const asset =
      question.asset

    if (!asset) {
      return null
    }

    if (
      asset.display_type ===
        'emoji' &&
      asset.emoji
    ) {
      return (
        <div className="my-6 text-center text-8xl">
          {asset.emoji}
        </div>
      )
    }

    if (
      asset.display_type ===
      'image'
    ) {
      const imageFile =
        asset.image_file.trim() ||
        `${question.item.image_key}.png`

      const imageUrl =
        `${IMAGE_BASE_PATH}${encodeURIComponent(
          imageFile,
        )}`

      return (
        <div className="my-6 flex justify-center">
          <img
            src={imageUrl}
            alt=""
            className="h-52 w-52 rounded-2xl object-contain"
          />
        </div>
      )
    }

    return null
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

            {renderVisual(
              currentQuestion,
            )}
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
                aria-label="Play pronunciation"
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
          'word_to_meaning' && (
          <>
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              What does this word mean?
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
                aria-label="Play pronunciation"
              >
                🔊
              </button>
            </div>
          </>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {currentQuestion.options.map(
            (option) => {
              const isCorrect =
                option ===
                currentQuestion.correctAnswer

              const isSelected =
                option === selected

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
                  key={option}
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
