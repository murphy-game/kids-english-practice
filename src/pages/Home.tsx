import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadAppData } from '../services/dataLoader'

import type { Lesson, ContentItem, LessonPractice } from '../types'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
type AbcMode = 'learn' | 'uppercase' | 'lowercase' | 'listen'

function sayLetter(letter: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const voice = new SpeechSynthesisUtterance(letter.toUpperCase())
  voice.lang = 'en-US'
  voice.rate = 0.75
  window.speechSynthesis.speak(voice)
}

function AlphabetPlay({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<AbcMode>('learn')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const target = ALPHABET[index]
  const options = [target, ALPHABET[(index + 7) % 26], ALPHABET[(index + 15) % 26], ALPHABET[(index + 21) % 26]]
    .sort((a, b) => ((a.charCodeAt(0) * 17 + index * 11) % 29) - ((b.charCodeAt(0) * 17 + index * 11) % 29))
  const showLower = mode === 'lowercase'

  function changeMode(next: AbcMode) {
    setMode(next)
    setIndex(0)
    setAnswer(null)
    setScore(0)
    setFinished(false)
  }

  function nextQuestion() {
    if (index === 25) {
      setFinished(true)
    } else {
      setIndex((n) => n + 1)
      setAnswer(null)
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <button type="button" onClick={onBack} className="mb-5 font-semibold text-slate-600 hover:text-slate-900">← Back to lessons</button>
      <div className="mb-6 text-center">
        <div className="text-5xl">🔤</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-800">ABC 字母樂園</h1>
        <p className="mt-2 text-slate-500">A–Z Alphabet Practice · 獨立練習</p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([['learn', '認識字母'], ['uppercase', '找大寫'], ['lowercase', '找小寫'], ['listen', '聽音選字母']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => changeMode(key)} className={`rounded-xl px-3 py-3 font-semibold ${mode === key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{label}</button>
        ))}
      </div>
      {mode === 'learn' ? (
        <section className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7">
          {ALPHABET.map((letter) => (
            <button key={letter} type="button" onClick={() => sayLetter(letter)} className="rounded-2xl bg-white p-3 text-center shadow-sm hover:bg-emerald-50" aria-label={`Listen to letter ${letter}`}>
              <span className="block text-3xl font-bold text-slate-800">{letter}</span>
              <span className="block text-2xl text-emerald-600">{letter.toLowerCase()}</span>
              <span className="mt-1 block text-xs text-slate-400">🔊</span>
            </button>
          ))}
        </section>
      ) : finished ? (
        <section className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-5xl">🌟</div>
          <h2 className="mt-3 text-2xl font-bold">完成 26 題！</h2>
          <p className="mt-3 text-lg">答對 {score} / 26 題</p>
          <button type="button" onClick={() => changeMode(mode)} className="mt-5 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white">再玩一次</button>
        </section>
      ) : (
        <section className="rounded-3xl bg-white p-6 text-center shadow-sm sm:p-10">
          <p className="text-sm text-slate-500">Question {index + 1} / 26 · Score {score}</p>
          <h2 className="mt-5 text-xl font-bold text-slate-700">
            {mode === 'listen' ? 'Listen and choose the letter.' : mode === 'uppercase' ? 'Choose the uppercase letter.' : 'Choose the lowercase letter.'}
          </h2>
          <div className="my-7 flex min-h-24 items-center justify-center">
            {mode === 'listen' ? (
              <button type="button" onClick={() => sayLetter(target)} className="rounded-full bg-violet-100 px-8 py-5 text-4xl" aria-label="Listen again">🔊</button>
            ) : <span className="text-7xl font-bold text-slate-800">{mode === 'uppercase' ? target.toLowerCase() : target}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {options.map((letter) => {
              const isCorrect = letter === target
              const isPicked = answer === letter
              return (
                <button key={letter} type="button" disabled={answer !== null} onClick={() => { setAnswer(letter); if (isCorrect) setScore((n) => n + 1) }}
                  className={`rounded-2xl border-2 p-5 text-4xl font-bold ${answer !== null && isCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : isPicked ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-800'}`}>
                  {showLower ? letter.toLowerCase() : letter}
                </button>
              )
            })}
          </div>
          {answer !== null && <div className="mt-6">
            <p className="mb-3 font-semibold">{answer === target ? '答對了！🎉' : `再加油！正確答案是 ${showLower ? target.toLowerCase() : target}`}</p>
            <button type="button" onClick={nextQuestion} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white">{index === 25 ? '看結果' : '下一題 →'}</button>
          </div>}
        </section>
      )}
    </main>
  )
}

export default function Home() {
  const navigate = useNavigate()

  const [showAlphabet, setShowAlphabet] = useState(false)

  const [content, setContent] = useState<ContentItem[]>([])
  const [lessonPractice, setLessonPractice] = useState<LessonPractice[]>([])

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
        setContent(data.content)
        setLessonPractice(data.lessonPractice)
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

  const lessonContent = selectedLesson
    ? content.filter((item) => item.lesson_id === selectedLesson.lesson_id)
    : []
  const hasVocab = lessonContent.some(
    (item) => item.type === 'vocab' && item.english.trim() !== '' &&
      !String(item.chinese ?? '').includes('人名') &&
      !(item.lesson_id === 'TU-L11' && item.english.trim().toLowerCase() === 'spell'),
  )
  const hasSentence = lessonContent.some(
    (item) => item.type === 'sentence' && item.english.trim() !== '',
  )
  const phonicsSetting = selectedLesson
    ? lessonPractice.find(
        (item) => item.lesson_id === selectedLesson.lesson_id && item.category === 'phonics',
      )
    : undefined
  const hasPhonicsContent = lessonContent.some(
    (item) => item.type === 'phonics' && item.english.trim() !== '',
  )
  // A configuration and phonics rows are necessary, but the practice generator
  // may impose additional requirements for each question type.
  const hasPhonics = hasPhonicsContent && hasVocab && Boolean(
    phonicsSetting?.recommended_question_types.trim(),
  )

  function openPractice(
    mode:
      | 'daily'
      | 'vocab'
      | 'sentence'
      | 'phonics',
  ) {
    if (!selectedLesson ||
      (mode === 'daily' && !hasVocab) ||
      (mode === 'vocab' && !hasVocab) ||
      (mode === 'sentence' && !hasSentence) ||
      (mode === 'phonics' && !hasPhonics)) {
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

  if (showAlphabet) return <AlphabetPlay onBack={() => setShowAlphabet(false)} />

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
            disabled={!hasVocab}
            onClick={() =>
              openPractice(
                'daily',
              )
            }
            className="disabled:cursor-not-allowed disabled:opacity-50 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md md:col-span-2"
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
                  Mixed practice questions
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
            disabled={!hasVocab}
            onClick={() =>
              openPractice(
                'vocab',
              )
            }
            className="disabled:cursor-not-allowed disabled:opacity-50 rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
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
            disabled={!hasSentence}
            onClick={() =>
              openPractice(
                'sentence',
              )
            }
            className="disabled:cursor-not-allowed disabled:opacity-50 rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
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
            disabled={!hasPhonics}
            onClick={() => openPractice('phonics')}
            className="disabled:cursor-not-allowed disabled:opacity-50 rounded-3xl bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
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
              {hasPhonics ? 'Practice →' : 'Coming next'}
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

      <section className="mb-8">
        <button type="button" onClick={() => setShowAlphabet(true)} className="w-full rounded-3xl border-2 border-violet-200 bg-violet-50 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="text-4xl">🔤</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-800">ABC 字母樂園</h2>
          <p className="mt-2 text-slate-600">A–Z · 大小寫辨識 · 聽音選字母</p>
          <div className="mt-4 font-semibold text-violet-700">開始練習 →</div>
        </button>
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
