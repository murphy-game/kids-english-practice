import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadAppData } from '../services/dataLoader'

import type { Lesson } from '../types'

export default function Home() {
  const navigate = useNavigate()

  const [lessons, setLessons] =
    useState<Lesson[]>([])

  const [
    selectedLesson,
    setSelectedLesson,
  ] =
    useState<Lesson | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(() => {
    async function load() {
      try {
        const data =
          await loadAppData()

        const activeLessons =
          data.lessons.filter(
            (lesson) =>
              lesson.active === true ||
              String(
                lesson.active,
              ).toLowerCase() ===
                'true',
          )

        setLessons(
          activeLessons,
        )
      } catch (err) {
        setError(
          String(err),
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  function openPractice(
    mode:
      | 'daily'
      | 'vocab'
      | 'sentence'
      | 'phonics',
  ) {
    if (!selectedLesson) {
      return
    }

    navigate(
      `/practice?lesson=${encodeURIComponent(
        selectedLesson.lesson_id,
      )}&mode=${mode}`,
    )
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-slate-500">
          Loading lessons...
        </p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="font-semibold text-red-600">
          Failed to load lessons.
        </p>

        <p className="mt-2 text-sm text-slate-500">
          {error}
        </p>
      </main>
    )
  }

  /*
   * Lesson Hub
   */
  if (selectedLesson) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <button
          type="button"
          onClick={() =>
            setSelectedLesson(
              null,
            )
          }
          className="mb-6 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          ← Back to lessons
        </button>

        <section className="mb-8 text-center">
          <div className="text-sm font-semibold text-slate-400">
            {
              selectedLesson.course
            }
          </div>

          <h1 className="mt-1 text-4xl font-bold text-slate-800">
            {
              selectedLesson.lesson
            }
          </h1>

          <p className="mt-2 text-lg text-slate-600">
            {
              selectedLesson.topic
            }
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Pages{' '}
            {
              selectedLesson.page
            }
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">

          {/* Daily Practice */}
          <button
            type="button"
            onClick={() =>
              openPractice(
                'daily',
              )
            }
            className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md md:col-span-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-4xl">
                  🌟
                </div>

                <h2 className="mt-3 text-2xl font-bold text-slate-800">
                  Today's Practice
                </h2>

                <p className="mt-2 text-slate-600">
                  10 mixed questions
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Vocabulary +
                  Sentence +
                  Phonics
                </p>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-3xl">
                  💧
                </div>

                <div className="mt-1 text-xs font-bold text-emerald-600">
                  EARN WATER
                </div>
              </div>
            </div>

            <div className="mt-5 font-bold text-emerald-700">
              Start today's practice →
            </div>
          </button>

          {/* Vocabulary */}
          <button
            type="button"
            onClick={() =>
              openPractice(
                'vocab',
              )
            }
            className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-4xl">
              📚
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-800">
              Vocabulary
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Words, pictures,
              listening and spelling
            </p>

            <div className="mt-5 font-semibold text-sky-600">
              Practice →
            </div>
          </button>

          {/* Sentence */}
          <button
            type="button"
            onClick={() =>
              openPractice(
                'sentence',
              )
            }
            className="rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-4xl">
              💬
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-800">
              Sentence
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Listening,
              sentence patterns
              and fill-in-the-blank
            </p>

            <div className="mt-5 font-semibold text-violet-600">
              Practice →
            </div>
          </button>

          {/* Phonics */}
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-3xl bg-white p-6 text-left opacity-60 shadow-sm"
          >
            <div className="text-4xl">
              🔤
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-800">
              Phonics
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Letters, sounds
              and beginning sounds
            </p>

            <div className="mt-5 text-sm font-semibold text-slate-400">
              Coming next
            </div>
          </button>
        </section>

        <p className="mt-6 text-center text-sm text-slate-400">
          Free practice does
          not use or earn water.
        </p>
      </main>
    )
  }

  /*
   * Lesson List
   */
  return (
    <main className="mx-auto max-w-5xl p-6">
      <section className="mb-8 text-center">
        <div className="text-5xl">
          🌱
        </div>

        <h1 className="mt-3 text-3xl font-bold">
          Kids English Practice
        </h1>

        <p className="mt-2 text-slate-500">
          Pick a lesson to
          start practicing.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">
          Choose a lesson
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map(
            (lesson) => (
              <button
                key={
                  lesson.lesson_id
                }
                type="button"
                onClick={() =>
                  setSelectedLesson(
                    lesson,
                  )
                }
                className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-sm font-medium text-slate-400">
                  {
                    lesson.course
                  }
                </div>

                <div className="mt-1 text-xl font-bold text-slate-800">
                  {
                    lesson.lesson
                  }
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {
                    lesson.topic
                  }
                </div>

                <div className="mt-2 text-xs text-slate-400">
                  Pages{' '}
                  {
                    lesson.page
                  }
                </div>

                <div className="mt-4 text-sm font-semibold text-emerald-600">
                  Open lesson →
                </div>
              </button>
            ),
          )}
        </div>
      </section>
    </main>
  )
}
