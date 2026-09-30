import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadAppData } from '../services/dataLoader'

import type {
  Asset,
  ContentItem,
  LessonPractice,
} from '../types'

type PracticeMode =
  | 'daily'
  | 'vocab'
  | 'sentence'
  | 'phonics'

type QuestionType =
  | 'image_to_word'
  | 'audio_to_word'
  | 'word_to_image'
  | 'audio_to_image'
  | 'missing_letter'
  | 'sentence_listen_choose'
  | 'sentence_fill_blank'
  | 'sentence_choose_response'

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
  sentencePrompt?: string
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

function getSentences(
  content: ContentItem[],
  lessonId: string,
) {
  return content.filter(
    (item) =>
      item.lesson_id === lessonId &&
      item.type === 'sentence' &&
      item.english.trim() !== '',
  )
}

function getRecommendedTypes(
  lessonPractice: LessonPractice[],
  lessonId: string,
  category: string,
): string[] {
  const row = lessonPractice.find(
    (item) =>
      item.lesson_id === lessonId &&
      item.category === category,
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

function createSentenceOptions(
  item: ContentItem,
  sentences: ContentItem[],
) {
  const distractors = shuffle(
    sentences
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

function createResponseOptions(
  item: ContentItem,
  sentences: ContentItem[],
) {
  const correct =
    item.response.trim()

  if (!correct) {
    return []
  }

  const responsePool = [
    ...new Set(
      sentences
        .filter(
          (other) =>
            other.item_id !== item.item_id &&
            other.response.trim() !== '' &&
            other.response.trim() !== correct,
        )
        .map((other) =>
          other.response.trim(),
        ),
    ),
  ]

  const distractors =
    shuffle(responsePool).slice(0, 3)

  /*
   * 如果同一課 response 太少，
   * 再用該課其他 sentence 補選項。
   */
  if (distractors.length < 3) {
    const sentencePool = shuffle(
      sentences
        .filter(
          (other) =>
            other.item_id !== item.item_id &&
            other.english.trim() !== '' &&
            other.english.trim() !== correct &&
            !distractors.includes(
              other.english.trim(),
            ),
        )
        .map((other) =>
          other.english.trim(),
        ),
    )

    for (const candidate of sentencePool) {
      if (distractors.length >= 3) {
        break
      }

      if (
        candidate &&
        candidate !== correct &&
        !distractors.includes(candidate)
      ) {
        distractors.push(candidate)
      }
    }
  }

  return shuffle([
    correct,
    ...distractors.slice(0, 3),
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

  const wrongLetters = shuffle(
    LETTER_POOL.filter(
      (letter) =>
        letter !== missingLetter,
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

function extractBlankAnswer(
  item: ContentItem,
) {
  const pattern =
    item.answer_pattern.trim()

  if (
    !pattern ||
    !pattern.includes('____')
  ) {
    return null
  }

  const blankIndex =
    pattern.indexOf('____')

  const prefix =
    pattern.slice(
      0,
      blankIndex,
    )

  const suffix =
    pattern.slice(
      blankIndex + 4,
    )

  if (
    !item.english.startsWith(prefix)
  ) {
    return null
  }

  if (
    suffix &&
    !item.english.endsWith(suffix)
  ) {
    return null
  }

  const endIndex =
    suffix === ''
      ? item.english.length
      : item.english.length -
        suffix.length

  const answer =
    item.english
      .slice(
        prefix.length,
        endIndex,
      )
      .trim()

  return answer || null
}

function createSentenceBlank(
  item: ContentItem,
  sentences: ContentItem[],
) {
  const pattern =
    item.answer_pattern.trim()

  if (
    !pattern ||
    !pattern.includes('____')
  ) {
    return null
  }

  const answer =
    extractBlankAnswer(item)

  if (!answer) {
    return null
  }

  const otherAnswers =
    sentences
      .map((other) =>
        extractBlankAnswer(other),
      )
      .filter(
        (value): value is string =>
          Boolean(value) &&
          value !== answer,
      )

  const distractors =
    shuffle([
      ...new Set(otherAnswers),
    ]).slice(0, 3)

  const fallbackWords =
    shuffle(
      sentences
        .flatMap((other) =>
          other.english
            .replace(
              /[.,!?]/g,
              '',
            )
            .split(/\s+/),
        )
        .filter(
          (word) =>
            word &&
            word !== answer &&
            /^[A-Za-z]+$/.test(word),
        ),
    )

  while (
    distractors.length < 3 &&
    fallbackWords.length > 0
  ) {
    const candidate =
      fallbackWords.shift()

    if (
      candidate &&
      !distractors.includes(candidate)
    ) {
      distractors.push(candidate)
    }
  }

  return {
    prompt: pattern,
    answer,
    options: shuffle([
      answer,
      ...distractors.slice(0, 3),
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
    assetMap.get(item.image_key)

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
    asset.status === 'approved' &&
    asset.image_file
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
        english:
          other.english,
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

function buildVocabularyQuestions(
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
    ) as QuestionType[]

  const availableTypes:
    QuestionType[] = [
      ...supportedRecommended,
    ]

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
    ...new Set(
      availableTypes,
    ),
  ]

  if (
    uniqueTypes.length === 0
  ) {
    uniqueTypes.push(
      'image_to_word',
      'audio_to_word',
      'word_to_image',
      'audio_to_image',
      'missing_letter',
    )
  }

  const selectedItems =
    shuffle(vocab).slice(
      0,
      Math.min(
        10,
        vocab.length,
      ),
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
          'word_to_image' ||
        type ===
          'audio_to_image'
      ) {
        const visualOptions =
          createVisualOptions(
            item,
            vocab,
            assetMap,
          )

        if (
          visualOptions.length < 2
        ) {
          type =
            'audio_to_word'
        } else {
          return {
            id:
              type ===
              'audio_to_image'
                ? `${item.item_id}-audio-image`
                : `${item.item_id}-word-image`,
            type,
            item,
            correctAnswer:
              item.english,
            visualOptions,
          }
        }
      }

      if (
        type === 'image_to_word'
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
        type === 'audio_to_word'
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
        type === 'missing_letter'
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
        type:
          'audio_to_word',
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

function buildSentenceQuestions(
  sentences: ContentItem[],
  recommendedTypes: string[],
): Question[] {
  const allowedTypes =
    recommendedTypes.filter(
      (type) =>
        type === 'choose_response' ||
        type === 'fill_blank' ||
        type === 'listen_and_choose',
    )

  if (
    allowedTypes.length === 0
  ) {
    allowedTypes.push(
      'choose_response',
      'listen_and_choose',
      'fill_blank',
    )
  }

  const selectedItems =
    shuffle(sentences).slice(
      0,
      Math.min(
        10,
        sentences.length,
      ),
    )

  return selectedItems.map(
    (item, index) => {
      const preferredType =
        allowedTypes[
          index %
            allowedTypes.length
        ]

      /*
       * 1. Choose the response
       */
      if (
        preferredType ===
          'choose_response' &&
        item.prompt.trim() &&
        item.response.trim()
      ) {
        const options =
          createResponseOptions(
            item,
            sentences,
          )

        if (options.length >= 2) {
          return {
            id: `${item.item_id}-sentence-response`,
            type:
              'sentence_choose_response',
            item,
            correctAnswer:
              item.response.trim(),
            textOptions:
              options,
            sentencePrompt:
              item.prompt.trim(),
          }
        }
      }

      /*
       * 2. Fill in the blank
       */
      if (
        preferredType ===
        'fill_blank'
      ) {
        const blank =
          createSentenceBlank(
            item,
            sentences,
          )

        if (
          blank &&
          blank.options.length >= 2
        ) {
          return {
            id: `${item.item_id}-sentence-blank`,
            type:
              'sentence_fill_blank',
            item,
            correctAnswer:
              blank.answer,
            textOptions:
              blank.options,
            sentencePrompt:
              blank.prompt,
          }
        }
      }

      /*
       * 如果原本指定的題型做不了，
       * 優先嘗試 choose_response。
       */
      if (
        item.prompt.trim() &&
        item.response.trim()
      ) {
        const options =
          createResponseOptions(
            item,
            sentences,
          )

        if (options.length >= 2) {
          return {
            id: `${item.item_id}-sentence-response-fallback`,
            type:
              'sentence_choose_response',
            item,
            correctAnswer:
              item.response.trim(),
            textOptions:
              options,
            sentencePrompt:
              item.prompt.trim(),
          }
        }
      }

      /*
       * 再嘗試 fill_blank。
       */
      const fallbackBlank =
        createSentenceBlank(
          item,
          sentences,
        )

      if (
        fallbackBlank &&
        fallbackBlank.options.length >= 2
      ) {
        return {
          id: `${item.item_id}-sentence-blank-fallback`,
          type:
            'sentence_fill_blank',
          item,
          correctAnswer:
            fallbackBlank.answer,
          textOptions:
            fallbackBlank.options,
          sentencePrompt:
            fallbackBlank.prompt,
        }
      }

      /*
       * 最後 fallback：
       * listen and choose
       */
      return {
        id: `${item.item_id}-sentence-listen`,
        type:
          'sentence_listen_choose',
        item,
        correctAnswer:
          item.english,
        textOptions:
          createSentenceOptions(
            item,
            sentences,
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

  utterance.lang =
    'en-US'

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
  const location =
    useLocation()

  const navigate =
    useNavigate()

  const params =
    new URLSearchParams(
      location.search,
    )

  const lessonId =
    params.get('lesson') ??
    ''

  const rawMode =
    params.get('mode') ??
    'vocab'

  const mode: PracticeMode =
    rawMode === 'sentence' ||
    rawMode === 'daily' ||
    rawMode === 'phonics'
      ? rawMode
      : 'vocab'

  const [
    questions,
    setQuestions,
  ] =
    useState<Question[]>([])

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0)

  const [
    selected,
    setSelected,
  ] =
    useState<
      string | null
    >(null)

  const [
    score,
    setScore,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data =
          await loadAppData()

        if (
          mode ===
          'sentence'
        ) {
          const sentences =
            getSentences(
              data.content,
              lessonId,
            )

          if (
            sentences.length ===
            0
          ) {
            throw new Error(
              'No sentence practice found for this lesson.',
            )
          }

          const types =
            getRecommendedTypes(
              data.lessonPractice,
              lessonId,
              'sentence',
            )

          setQuestions(
            buildSentenceQuestions(
              sentences,
              types,
            ),
          )

          return
        }

        /*
         * Daily 暫時仍使用 Vocabulary。
         * 等 Phonics 完成後再改成 4 + 3 + 3。
         */
        const vocab =
          getVocabulary(
            data.content,
            lessonId,
          )

        if (
          vocab.length ===
          0
        ) {
          throw new Error(
            'No vocabulary found for this lesson.',
          )
        }

        const types =
          getRecommendedTypes(
            data.lessonPractice,
            lessonId,
            'vocab',
          )

        setQuestions(
          buildVocabularyQuestions(
            vocab,
            data.assets,
            types,
          ),
        )
      } catch (err) {
        setError(
          String(err),
        )
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
        window
          .speechSynthesis
          .cancel()
      }
    }
  }, [
    lessonId,
    mode,
  ])

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
      window
        .speechSynthesis
        .cancel()
    }

    setSelected(null)

    setCurrentIndex(
      (value) =>
        value + 1,
    )
  }

  function goBack() {
    navigate('/')
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
            onClick={goBack}
            className="mt-5 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white"
          >
            Back home
          </button>
        </div>
      </main>
    )
  }

  if (finished) {
    const isDaily =
      mode === 'daily'

    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">
            {isDaily
              ? '🌱'
              : mode ===
                  'sentence'
                ? '💬'
                : '📚'}
          </div>

          <h1 className="mt-4 text-3xl font-bold">
            Practice complete!
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            You got {score} /{' '}
            {questions.length}{' '}
            correct.
          </p>

          {isDaily && (
            <>
              <div className="mt-6 text-4xl">
                💧
              </div>

              <p className="mt-2 font-semibold text-emerald-600">
                You earned water for your tree!
              </p>
            </>
          )}

          {!isDaily && (
            <p className="mt-5 text-sm text-slate-400">
              Free practice does not earn water.
            </p>
          )}

          <button
            type="button"
            onClick={goBack}
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

  const usesVisualOptions =
    currentQuestion.type ===
      'word_to_image' ||
    currentQuestion.type ===
      'audio_to_image'

  return (
    <main className="mx-auto max-w-3xl p-6">

      <section className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Question{' '}
            {currentIndex + 1}{' '}
            /{' '}
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
              width: `${progress}%`,
            }}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">

        {/* Vocabulary: image -> word */}
        {currentQuestion.type ===
          'image_to_word' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the word.
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
                    'Choose the word.',
                  )
                }
                className="rounded-full bg-sky-50 px-4 py-3 text-2xl transition hover:bg-sky-100"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {/* Vocabulary: audio -> word */}
        {currentQuestion.type ===
          'audio_to_word' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose.
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

        {/* Vocabulary: word -> image */}
        {currentQuestion.type ===
          'word_to_image' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the picture.
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

        {/* Vocabulary: audio -> image */}
        {currentQuestion.type ===
          'audio_to_image' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the picture.
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

        {/* Vocabulary: missing letter */}
        {currentQuestion.type ===
          'missing_letter' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing letter.
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

        {/* Sentence: choose response */}
        {currentQuestion.type ===
          'sentence_choose_response' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the best response.
            </p>

            <div className="mt-6 text-center text-3xl font-bold leading-relaxed text-slate-800">
              {
                currentQuestion
                  .sentencePrompt
              }
            </div>

            <button
              type="button"
              onClick={() =>
                speakEnglish(
                  currentQuestion
                    .sentencePrompt ??
                    '',
                )
              }
              className="mx-auto mt-5 block rounded-full bg-violet-50 px-5 py-4 text-3xl transition hover:bg-violet-100"
              aria-label="Play question"
            >
              🔊
            </button>

            <p className="mt-2 text-center text-sm text-slate-400">
              Tap to hear the question
            </p>
          </>
        )}

        {/* Sentence: listen and choose */}
        {currentQuestion.type ===
          'sentence_listen_choose' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the sentence.
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
                className="rounded-full bg-violet-100 px-8 py-6 text-5xl shadow-sm transition hover:scale-105"
              >
                🔊
              </button>

              <p className="mt-3 text-sm text-slate-400">
                Tap to listen
              </p>
            </div>
          </>
        )}

        {/* Sentence: fill blank */}
        {currentQuestion.type ===
          'sentence_fill_blank' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing word.
            </p>

            <div className="mt-6 text-center text-3xl font-bold leading-relaxed text-slate-800">
              {
                currentQuestion
                  .sentencePrompt
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
              className="mx-auto mt-5 block rounded-full bg-violet-50 px-4 py-3 text-3xl hover:bg-violet-100"
            >
              🔊
            </button>
          </>
        )}

        {/* Image choices */}
        {usesVisualOptions ? (
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
