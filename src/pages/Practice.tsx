import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadAppData } from '../services/dataLoader'
import type { ContentItem } from '../types'

type Question = {
  item: ContentItem
  options: string[]
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

export default function Practice() {
  const location = useLocation()
  const navigate = useNavigate()

  const params = new URLSearchParams(location.search)
  const lessonId = params.get('lesson') ?? ''

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await loadAppData()

        const vocab = data.content.filter(
          (item) =>
            item.lesson_id === lessonId &&
            item.type === 'vocab' &&
            item.english?.trim() &&
            item.chinese?.trim(),
        )

        if (vocab.length === 0) {
          throw new Error('No vocabulary found for this lesson.')
        }

        const picked = shuffle(vocab).slice(
          0,
          Math.min(10, vocab.length),
        )

        const questionList: Question[] = picked.map((item) => {
          const distractors = shuffle(
            vocab
              .filter(
                (other) =>
                  other.item_id !== item.item_id &&
                  other.chinese !== item.chinese,
              )
              .map((other) => other.chinese),
          ).slice(0, 3)

          return {
            item,
            options: shuffle([
              item.chinese,
              ...distractors,
            ]),
          }
        })

        setQuestions(questionList)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    if (lessonId) {
      load()
    } else {
      setError('Missing lesson id.')
      setLoading(false)
    }
  }, [lessonId])

  const currentQuestion = useMemo(
    () => questions[currentIndex],
    [questions, currentIndex],
  )

  const finished =
    questions.length > 0 &&
    currentIndex >= questions.length

  function chooseAnswer(answer: string) {
    if (!currentQuestion || selected) {
      return
    }

    setSelected(answer)

    if (answer === currentQuestion.item.chinese) {
      setScore((value) => value + 1)
    }
  }

  function nextQuestion() {
    setSelected(null)
    setCurrentIndex((value) => value + 1)
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
            onClick={() => navigate('/')}
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
            You got {score} / {questions.length} correct.
          </p>

          <div className="mt-6 text-4xl">
            💧
          </div>

          <p className="mt-2 font-semibold text-emerald-600">
            You earned water for your tree!
          </p>

          <button
            type="button"
            onClick={() => navigate('/')}
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
    ((currentIndex + 1) / questions.length) * 100

  return (
    <main className="mx-auto max-w-3xl p-6">
      <section className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Question {currentIndex + 1} / {questions.length}
          </span>

          <span>
            Score {score}
          </span>
        </div>

        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          What does this word mean?
        </p>

        <h1 className="mt-3 text-center text-5xl font-bold text-slate-800">
          {currentQuestion.item.english}
        </h1>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {currentQuestion.options.map((option) => {
            const isCorrect =
              option === currentQuestion.item.chinese

            const isSelected =
              option === selected

            let className =
              'rounded-2xl border-2 p-4 text-lg font-semibold transition '

            if (!selected) {
              className +=
                'border-slate-200 bg-white hover:border-emerald-400'
            } else if (isCorrect) {
              className +=
                'border-emerald-500 bg-emerald-50 text-emerald-700'
            } else if (isSelected) {
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
                onClick={() => chooseAnswer(option)}
                disabled={selected !== null}
                className={className}
              >
                {option}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="mt-6 text-center">
            <p
              className={
                selected === currentQuestion.item.chinese
                  ? 'font-bold text-emerald-600'
                  : 'font-bold text-red-500'
              }
            >
              {selected === currentQuestion.item.chinese
                ? 'Correct! 🎉'
                : `Answer: ${currentQuestion.item.chinese}`}
            </p>

            <button
              type="button"
              onClick={nextQuestion}
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
