import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadAppData } from '../services/dataLoader'

type LessonOption = {
  lesson_id: string
  title?: string
  lesson_no?: string | number
}

export default function Home() {
  const navigate = useNavigate()

  const [lessons, setLessons] = useState<LessonOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await loadAppData()

        setLessons(
          data.lessons.map((lesson) => ({
            lesson_id: lesson.lesson_id,
            title:
              'title' in lesson && typeof lesson.title === 'string'
                ? lesson.title
                : undefined,
            lesson_no:
              'lesson_no' in lesson
                ? lesson.lesson_no
                : undefined,
          })),
        )
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  function startLesson(lessonId: string) {
    navigate(`/practice?lesson=${encodeURIComponent(lessonId)}`)
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
        <p className="text-red-600">
          Failed to load lessons.
        </p>

        <p className="mt-2 text-sm text-slate-500">
          {error}
        </p>
      </main>
    )
  }

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
          Pick a lesson and practice a little every day.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">
          Choose a lesson
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson, index) => {
            const lessonNumber =
              lesson.lesson_no ??
              index + 1

            const displayTitle =
              lesson.title?.trim() ||
              `Lesson ${lessonNumber}`

            return (
              <button
                key={lesson.lesson_id}
                type="button"
                onClick={() =>
                  startLesson(lesson.lesson_id)
                }
                className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-sm font-medium text-slate-400">
                  Lesson {lessonNumber}
                </div>

                <div className="mt-1 text-xl font-bold text-slate-800">
                  {displayTitle}
                </div>

                <div className="mt-4 text-sm font-semibold text-emerald-600">
                  Start practice →
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
