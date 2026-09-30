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
  | 'spell_word'
  | 'sentence_listen_choose'
  | 'sentence_fill_blank'
  | 'sentence_choose_response'
  | 'phonics_image_initial_letter'
  | 'phonics_audio_initial_letter'
  | 'phonics_missing_initial_letter'
  | 'phonics_letter_case_match'
  | 'phonics_audio_vowel'
  | 'phonics_missing_vowel'
  | 'phonics_cvc_build_word'
  | 'phonics_image_blend'
  | 'phonics_audio_blend'
  | 'phonics_missing_blend'
  | 'phonics_same_initial_blend'

type VisualOption = {
  key: string
  english: string
  asset: Asset
}

type LetterButton = {
  id: string
  letter: string
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
  letterBank?: LetterButton[]
  phonicsPrompt?: string
  phonicsWord?: string
}

const IMAGE_BASE_PATH =
  '/kids-english-practice/assets/images/vocabulary/'

const LETTER_POOL =
  'abcdefghijklmnopqrstuvwxyz'.split('')

const VOWELS = ['a', 'e', 'i', 'o', 'u']

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

function getPhonics(
  content: ContentItem[],
  lessonId: string,
) {
  return content.filter(
    (item) =>
      item.lesson_id === lessonId &&
      item.type === 'phonics' &&
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
  const distractors = shuffle([
    ...new Set(
      sentences
        .filter(
          (other) =>
            other.item_id !== item.item_id &&
            other.english.trim() !== '' &&
            other.english !== item.english,
        )
        .map((other) => other.english.trim()),
    ),
  ]).slice(0, 3)

  return shuffle([
    item.english,
    ...distractors,
  ])
}

function createResponseOptions(
  item: ContentItem,
  allSentences: ContentItem[],
) {
  const correct = item.response.trim()

  if (!correct) {
    return []
  }

  const responsePool = [
    ...new Set(
      allSentences
        .filter(
          (other) =>
            other.item_id !== item.item_id &&
            other.response.trim() !== '' &&
            other.response.trim() !== correct,
        )
        .map((other) => other.response.trim()),
    ),
  ]

  const distractors =
    shuffle(responsePool).slice(0, 3)

  if (distractors.length < 3) {
    const sentencePool = shuffle(
      allSentences
        .filter(
          (other) =>
            other.item_id !== item.item_id &&
            other.english.trim() !== '' &&
            other.english.trim() !== correct &&
            !distractors.includes(
              other.english.trim(),
            ),
        )
        .map((other) => other.english.trim()),
    )

    for (const candidate of sentencePool) {
      if (distractors.length >= 3) break

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
  const word = item.english.toLowerCase()

  const validIndexes = word
    .split('')
    .map((char, index) => ({ char, index }))
    .filter(({ char }) => /^[a-z]$/.test(char))

  if (validIndexes.length === 0) {
    return null
  }

  const picked =
    validIndexes[
      Math.floor(
        Math.random() * validIndexes.length,
      )
    ]

  const missingLetter = picked.char

  const maskedWord = word
    .split('')
    .map((char, index) =>
      index === picked.index ? '_' : char,
    )
    .join('')

  const wrongLetters = shuffle(
    LETTER_POOL.filter(
      (letter) => letter !== missingLetter,
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
  const pattern = item.answer_pattern.trim()

  if (!pattern || !pattern.includes('____')) {
    return null
  }

  const blankIndex = pattern.indexOf('____')
  const prefix = pattern.slice(0, blankIndex)
  const suffix = pattern.slice(blankIndex + 4)

  if (!item.english.startsWith(prefix)) {
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
      : item.english.length - suffix.length

  const answer = item.english
    .slice(prefix.length, endIndex)
    .trim()

  return answer || null
}

function createSentenceBlank(
  item: ContentItem,
  sentences: ContentItem[],
) {
  const pattern = item.answer_pattern.trim()

  if (!pattern || !pattern.includes('____')) {
    return null
  }

  const answer = extractBlankAnswer(item)

  if (!answer) {
    return null
  }

  const otherAnswers = sentences
    .map((other) => extractBlankAnswer(other))
    .filter(
      (value): value is string =>
        Boolean(value) && value !== answer,
    )

  const distractors = shuffle([
    ...new Set(otherAnswers),
  ]).slice(0, 3)

  const fallbackWords = shuffle(
    sentences
      .flatMap((other) =>
        other.english
          .replace(/[.,!?]/g, '')
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
    const candidate = fallbackWords.shift()

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
  if (!item.image_key) return undefined

  const asset = assetMap.get(item.image_key)

  if (!asset) return undefined

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
    getUsableAsset(item, assetMap)

  if (!correctAsset) return []

  const distractorItems = shuffle(
    vocab.filter(
      (other) =>
        other.item_id !== item.item_id &&
        getUsableAsset(other, assetMap),
    ),
  ).slice(0, 3)

  const options: VisualOption[] = [
    {
      key: item.image_key,
      english: item.english,
      asset: correctAsset,
    },
    ...distractorItems.map((other) => ({
      key: other.image_key,
      english: other.english,
      asset:
        getUsableAsset(other, assetMap) as Asset,
    })),
  ]

  return shuffle(options)
}

function createLetterBank(word: string) {
  const correctLetters = word
    .toLowerCase()
    .split('')

  const extraCount =
    Math.random() < 0.5 ? 2 : 3

  const extras = shuffle(
    LETTER_POOL.filter(
      (letter) => !correctLetters.includes(letter),
    ),
  ).slice(0, extraCount)

  return shuffle([
    ...correctLetters,
    ...extras,
  ]).map((letter, index) => ({
    id: `${letter}-${index}-${Math.random()}`,
    letter,
  }))
}

function isSpellableItem(
  item: ContentItem,
  assetMap: Map<string, Asset>,
) {
  return (
    !isPersonName(item) &&
    /^[A-Za-z]+$/.test(item.english.trim()) &&
    Boolean(getUsableAsset(item, assetMap))
  )
}

function buildVocabularyQuestions(
  vocab: ContentItem[],
  assets: Asset[],
  recommendedTypes: string[],
  targetCount = 10,
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

  const availableTypes: QuestionType[] = [
    ...supportedRecommended,
    'word_to_image',
    'spell_word',
  ]

  const uniqueTypes = [
    ...new Set(availableTypes),
  ]

  const selectedItems = shuffle(vocab).slice(
    0,
    Math.min(targetCount, vocab.length),
  )

  return selectedItems.map((item, index) => {
    let type =
      uniqueTypes[index % uniqueTypes.length]

    const asset =
      getUsableAsset(item, assetMap)

    if (
      type === 'spell_word' &&
      !isSpellableItem(item, assetMap)
    ) {
      type = asset
        ? 'image_to_word'
        : 'audio_to_word'
    }

    if (
      type === 'image_to_word' &&
      !asset
    ) {
      type = 'audio_to_word'
    }

    if (
      type === 'word_to_image' ||
      type === 'audio_to_image'
    ) {
      const visualOptions = createVisualOptions(
        item,
        vocab,
        assetMap,
      )

      if (visualOptions.length < 2) {
        type = 'audio_to_word'
      } else {
        return {
          id:
            type === 'audio_to_image'
              ? `${item.item_id}-audio-image`
              : `${item.item_id}-word-image`,
          type,
          item,
          correctAnswer: item.english,
          visualOptions,
        }
      }
    }

    if (type === 'spell_word') {
      return {
        id: `${item.item_id}-spell-word`,
        type,
        item,
        asset,
        correctAnswer:
          item.english.toLowerCase(),
        letterBank:
          createLetterBank(item.english),
      }
    }

    if (type === 'image_to_word') {
      return {
        id: `${item.item_id}-image-word`,
        type,
        item,
        asset,
        correctAnswer: item.english,
        textOptions:
          createEnglishOptions(item, vocab),
      }
    }

    if (type === 'audio_to_word') {
      return {
        id: `${item.item_id}-audio-word`,
        type,
        item,
        correctAnswer: item.english,
        textOptions:
          createEnglishOptions(item, vocab),
      }
    }

    if (type === 'missing_letter') {
      const missing =
        createMissingLetterQuestion(item)

      if (missing) {
        return {
          id: `${item.item_id}-missing`,
          type,
          item,
          correctAnswer:
            missing.missingLetter,
          textOptions: missing.options,
          maskedWord: missing.maskedWord,
        }
      }
    }

    return {
      id: `${item.item_id}-fallback`,
      type: 'audio_to_word',
      item,
      correctAnswer: item.english,
      textOptions:
        createEnglishOptions(item, vocab),
    }
  })
}

function buildSentenceQuestions(
  lessonSentences: ContentItem[],
  allSentences: ContentItem[],
  recommendedTypes: string[],
  targetCount = 8,
): Question[] {
  const allowedTypes =
    recommendedTypes.filter(
      (type) =>
        type === 'choose_response' ||
        type === 'fill_blank' ||
        type === 'listen_and_choose',
    )

  if (allowedTypes.length === 0) {
    allowedTypes.push(
      'choose_response',
      'listen_and_choose',
      'fill_blank',
    )
  }

  /*
   * One sentence item is used at most once in a practice round.
   * This prevents the same sentence from reappearing as multiple
   * question types (for example listen-and-choose + response).
   */
  const result: Question[] = []
  const shuffledItems = shuffle(lessonSentences)
  const usedPrompts = new Set<string>()
  const usedEnglish = new Set<string>()

  for (let index = 0; index < shuffledItems.length; index += 1) {
    if (result.length >= targetCount) break

    const item = shuffledItems[index]
    const variants: Question[] = []

    if (
      allowedTypes.includes('choose_response') &&
      item.prompt.trim() &&
      item.response.trim()
    ) {
      const prompt = item.prompt.trim()
      const options = createResponseOptions(
        item,
        allSentences,
      )

      if (
        options.length === 4 &&
        !usedPrompts.has(prompt)
      ) {
        variants.push({
          id: `${item.item_id}-sentence-response`,
          type: 'sentence_choose_response',
          item,
          correctAnswer: item.response.trim(),
          textOptions: options,
          sentencePrompt: prompt,
        })
      }
    }

    if (allowedTypes.includes('fill_blank')) {
      const blank = createSentenceBlank(
        item,
        lessonSentences,
      )

      if (
        blank &&
        blank.options.length >= 2 &&
        !usedEnglish.has(item.english.trim())
      ) {
        variants.push({
          id: `${item.item_id}-sentence-blank`,
          type: 'sentence_fill_blank',
          item,
          correctAnswer: blank.answer,
          textOptions: [
            ...new Set(blank.options),
          ],
          sentencePrompt: blank.prompt,
        })
      }
    }

    if (
      allowedTypes.includes('listen_and_choose') &&
      !usedEnglish.has(item.english.trim())
    ) {
      variants.push({
        id: `${item.item_id}-sentence-listen`,
        type: 'sentence_listen_choose',
        item,
        correctAnswer: item.english,
        textOptions: createSentenceOptions(
          item,
          allSentences,
        ),
      })
    }

    if (variants.length === 0) continue

    const preferredType =
      allowedTypes[index % allowedTypes.length]

    const picked =
      variants.find((question) => {
        if (preferredType === 'choose_response') {
          return question.type === 'sentence_choose_response'
        }
        if (preferredType === 'fill_blank') {
          return question.type === 'sentence_fill_blank'
        }
        return question.type === 'sentence_listen_choose'
      }) ?? variants[0]

    result.push(picked)
    usedEnglish.add(item.english.trim())
    if (item.prompt.trim()) {
      usedPrompts.add(item.prompt.trim())
    }
  }

  return result
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function normalizeLetterToken(token: string) {
  const match = token.match(/[A-Za-z]/)
  return match ? match[0].toLowerCase() : ''
}

function createFourOptions(
  correct: string,
  pool: string[],
) {
  const others = shuffle([
    ...new Set(
      pool.filter(
        (value) => value && value !== correct,
      ),
    ),
  ]).slice(0, 3)

  return shuffle([
    correct,
    ...others,
  ])
}

function makeMaskedVowelWord(word: string) {
  const lower = word.toLowerCase()
  const index = lower
    .split('')
    .findIndex((char) => VOWELS.includes(char))

  if (index < 0) return null

  const correct = lower[index]
  const masked = lower
    .split('')
    .map((char, i) =>
      i === index ? '_' : char,
    )
    .join('')

  return {
    masked,
    correct,
  }
}

function firstVowel(word: string) {
  const lower = word.toLowerCase()
  const index = lower
    .split('')
    .findIndex((char) => VOWELS.includes(char))

  if (index < 0) return null

  return {
    vowel: lower[index],
    masked: lower
      .split('')
      .map((char, i) => (i === index ? '_' : char))
      .join(''),
  }
}

function getWordAsset(
  word: string,
  vocab: ContentItem[],
  assetMap: Map<string, Asset>,
) {
  const item = vocab.find(
    (v) => v.english.toLowerCase() === word.toLowerCase(),
  )
  if (!item) return undefined
  return getUsableAsset(item, assetMap)
}

function buildPhonicsQuestions(
  phonicsRows: ContentItem[],
  vocab: ContentItem[],
  assets: Asset[],
  recommendedTypes: string[],
  targetCount = 7,
): Question[] {
  const assetMap = new Map(
    assets.map((asset) => [asset.image_key, asset]),
  )

  const candidates: Question[] = []
  const requested = new Set(recommendedTypes)

  for (const row of phonicsRows) {
    const examples = splitCsv(row.example)
    const tokens = splitCsv(row.english)

    const letters = tokens
      .map(normalizeLetterToken)
      .filter(Boolean)

    const blends = tokens
      .map((token) => token.toLowerCase())
      .filter((token) => /^[a-z]{2,3}$/.test(token))

    if (
      requested.has('image_to_initial_letter') ||
      requested.has('audio_to_initial_letter') ||
      requested.has('missing_initial_letter') ||
      requested.has('letter_case_match')
    ) {
      examples.forEach((word, index) => {
        const letter = letters[index]
        if (!letter) return

        const startsCorrectly =
          word.toLowerCase().startsWith(letter)

        const asset = getWordAsset(word, vocab, assetMap)
        const letterOptions = createFourOptions(
          letter,
          letters.length >= 4 ? letters : LETTER_POOL,
        )

        if (
          requested.has('image_to_initial_letter') &&
          startsCorrectly &&
          asset
        ) {
          candidates.push({
            id: `${row.item_id}-image-initial-${index}`,
            type: 'phonics_image_initial_letter',
            item: row,
            correctAnswer: letter,
            textOptions: letterOptions,
            phonicsWord: word,
            asset,
          })
        }

        if (
          requested.has('audio_to_initial_letter') &&
          startsCorrectly
        ) {
          candidates.push({
            id: `${row.item_id}-audio-initial-${index}`,
            type: 'phonics_audio_initial_letter',
            item: row,
            correctAnswer: letter,
            textOptions: letterOptions,
            phonicsWord: word,
            asset,
          })
        }

        if (
          requested.has('missing_initial_letter') &&
          startsCorrectly
        ) {
          candidates.push({
            id: `${row.item_id}-missing-initial-${index}`,
            type: 'phonics_missing_initial_letter',
            item: row,
            correctAnswer: letter,
            textOptions: letterOptions,
            maskedWord: `_${word.slice(1).toLowerCase()}`,
            phonicsWord: word,
            asset,
          })
        }

        if (requested.has('letter_case_match')) {
          candidates.push({
            id: `${row.item_id}-case-${index}`,
            type: 'phonics_letter_case_match',
            item: row,
            correctAnswer: letter,
            textOptions: letterOptions,
            phonicsPrompt: letter.toUpperCase(),
          })
        }
      })
    }

    if (
      requested.has('audio_to_vowel') ||
      requested.has('missing_vowel') ||
      requested.has('cvc_build_word')
    ) {
      for (const wordRaw of examples) {
        const word = wordRaw.toLowerCase()
        if (!/^[a-z]+$/.test(word)) continue

        const data = firstVowel(word)
        if (!data) continue

        const asset = getWordAsset(word, vocab, assetMap)

        if (requested.has('audio_to_vowel')) {
          candidates.push({
            id: `${row.item_id}-audio-vowel-${word}`,
            type: 'phonics_audio_vowel',
            item: row,
            correctAnswer: data.vowel,
            textOptions: shuffle(VOWELS),
            phonicsWord: word,
            asset,
          })
        }

        if (requested.has('missing_vowel')) {
          candidates.push({
            id: `${row.item_id}-missing-vowel-${word}`,
            type: 'phonics_missing_vowel',
            item: row,
            correctAnswer: data.vowel,
            textOptions: shuffle(VOWELS),
            maskedWord: data.masked,
            phonicsWord: word,
            asset,
          })
        }

        if (requested.has('cvc_build_word')) {
          const sameLengthPool = examples
            .map((value) => value.toLowerCase())
            .filter(
              (value) =>
                /^[a-z]+$/.test(value) &&
                value.length === word.length,
            )

          const displayedLetters = shuffle(word.split('')).join('   ')

          candidates.push({
            id: `${row.item_id}-cvc-build-${word}`,
            type: 'phonics_cvc_build_word',
            item: row,
            correctAnswer: word,
            textOptions: createFourOptions(
              word,
              sameLengthPool.length >= 4
                ? sameLengthPool
                : examples.map((value) => value.toLowerCase()),
            ),
            phonicsPrompt: displayedLetters,
            phonicsWord: word,
            asset,
          })
        }
      }
    }

    if (
      requested.has('image_to_blend') ||
      requested.has('audio_to_blend') ||
      requested.has('missing_blend') ||
      requested.has('same_initial_blend')
    ) {
      examples.forEach((wordRaw, index) => {
        const word = wordRaw.toLowerCase()
        const blend = blends[index]
        if (!blend || !word.startsWith(blend)) return

        const asset = getWordAsset(word, vocab, assetMap)
        const blendOptions = createFourOptions(
          blend,
          blends,
        )

        if (requested.has('image_to_blend') && asset) {
          candidates.push({
            id: `${row.item_id}-image-blend-${index}`,
            type: 'phonics_image_blend',
            item: row,
            correctAnswer: blend,
            textOptions: blendOptions,
            phonicsWord: word,
            asset,
          })
        }

        if (requested.has('audio_to_blend')) {
          candidates.push({
            id: `${row.item_id}-audio-blend-${index}`,
            type: 'phonics_audio_blend',
            item: row,
            correctAnswer: blend,
            textOptions: blendOptions,
            phonicsWord: word,
            asset,
          })
        }

        if (requested.has('missing_blend')) {
          candidates.push({
            id: `${row.item_id}-missing-blend-${index}`,
            type: 'phonics_missing_blend',
            item: row,
            correctAnswer: blend,
            textOptions: blendOptions,
            maskedWord: `__${word.slice(blend.length)}`,
            phonicsWord: word,
            asset,
          })
        }

        if (requested.has('same_initial_blend')) {
          const sameBlend = vocab
            .map((v) => v.english.toLowerCase())
            .filter(
              (value) =>
                value !== word &&
                value.startsWith(blend),
            )

          if (sameBlend.length > 0) {
            const correctWord = shuffle(sameBlend)[0]
            const distractors = vocab
              .map((v) => v.english.toLowerCase())
              .filter(
                (value) =>
                  value !== word &&
                  value !== correctWord &&
                  !value.startsWith(blend),
              )

            candidates.push({
              id: `${row.item_id}-same-blend-${index}`,
              type: 'phonics_same_initial_blend',
              item: row,
              correctAnswer: correctWord,
              textOptions: createFourOptions(
                correctWord,
                distractors,
              ),
              phonicsWord: word,
              phonicsPrompt: blend,
            })
          }
        }
      })
    }
  }

  if (candidates.length === 0) return []

  const shuffled = shuffle(candidates)
  const result: Question[] = []
  const seenWords = new Set<string>()

  while (
    result.length < targetCount &&
    shuffled.length > 0
  ) {
    const last = result[result.length - 1]

    let index = shuffled.findIndex((question) => {
      const wordKey = question.phonicsWord ?? question.id
      return (
        (!last || question.type !== last.type) &&
        !seenWords.has(wordKey)
      )
    })

    if (index < 0) {
      index = shuffled.findIndex(
        (question) => !last || question.type !== last.type,
      )
    }
    if (index < 0) index = 0

    const [picked] = shuffled.splice(index, 1)
    result.push(picked)
    seenWords.add(picked.phonicsWord ?? picked.id)
  }

  return result.slice(0, targetCount)
}

function mixQuestionGroups(
  groups: Question[][],
) {
  const remaining = groups.map((group) => [
    ...group,
  ])
  const result: Question[] = []

  while (remaining.some((group) => group.length > 0)) {
    const availableIndexes = remaining
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.length > 0)
      .map(({ index }) => index)

    const last = result[result.length - 1]

    let candidates = availableIndexes.filter(
      (index) =>
        !last ||
        remaining[index][0]?.type !== last.type,
    )

    if (candidates.length === 0) {
      candidates = availableIndexes
    }

    const chosenGroup =
      candidates[
        Math.floor(Math.random() * candidates.length)
      ]

    const next = remaining[chosenGroup].shift()
    if (next) result.push(next)
  }

  return result
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

  window.speechSynthesis.speak(utterance)
}

function getImageUrl(asset: Asset) {
  const file = asset.image_file.trim()

  return `${IMAGE_BASE_PATH}${encodeURIComponent(
    file,
  )}`
}

function Visual({
  asset,
  size = 'large',
}: {
  asset: Asset
  size?: 'large' | 'small' | 'inline'
}) {
  if (
    asset.display_type === 'emoji' &&
    asset.emoji
  ) {
    return (
      <span
        className={
          size === 'large'
            ? 'text-8xl'
            : size === 'small'
              ? 'text-6xl'
              : 'text-5xl'
        }
      >
        {asset.emoji}
      </span>
    )
  }

  if (asset.display_type === 'image') {
    return (
      <img
        src={getImageUrl(asset)}
        alt=""
        className={
          size === 'large'
            ? 'h-52 w-52 object-contain'
            : size === 'small'
              ? 'h-28 w-28 object-contain'
              : 'h-16 w-16 object-contain'
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
    new URLSearchParams(location.search)

  const lessonId = params.get('lesson') ?? ''
  const rawMode = params.get('mode') ?? 'vocab'

  const mode: PracticeMode =
    rawMode === 'sentence' ||
    rawMode === 'daily' ||
    rawMode === 'phonics'
      ? rawMode
      : 'vocab'

  const [questions, setQuestions] =
    useState<Question[]>([])
  const [currentIndex, setCurrentIndex] =
    useState(0)
  const [selected, setSelected] =
    useState<string | null>(null)
  const [wrongAnswers, setWrongAnswers] =
    useState<string[]>([])
  const [hasAttempted, setHasAttempted] =
    useState(false)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [spellPickedIds, setSpellPickedIds] =
    useState<string[]>([])
  const [spellPickedLetters, setSpellPickedLetters] =
    useState<string[]>([])
  const [spellError, setSpellError] =
    useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await loadAppData()

        const vocab = getVocabulary(
          data.content,
          lessonId,
        )
        const sentences = getSentences(
          data.content,
          lessonId,
        )
        const phonics = getPhonics(
          data.content,
          lessonId,
        )

        const allSentences = data.content.filter(
          (item) =>
            item.type === 'sentence' &&
            item.english.trim() !== '',
        )

        const vocabTypes = getRecommendedTypes(
          data.lessonPractice,
          lessonId,
          'vocab',
        )

        const sentenceTypes = getRecommendedTypes(
          data.lessonPractice,
          lessonId,
          'sentence',
        )

        const phonicsTypes = getRecommendedTypes(
          data.lessonPractice,
          lessonId,
          'phonics',
        )

        if (mode === 'sentence') {
          if (sentences.length === 0) {
            throw new Error(
              'No sentence practice found for this lesson.',
            )
          }

          setQuestions(
            buildSentenceQuestions(
              sentences,
              allSentences,
              sentenceTypes,
              10,
            ),
          )
          return
        }

        if (mode === 'phonics') {
          const phonicsQuestions =
            buildPhonicsQuestions(
              phonics,
              vocab,
              data.assets,
              phonicsTypes,
              10,
            )

          if (phonicsQuestions.length === 0) {
            throw new Error(
              'No phonics practice found for this lesson.',
            )
          }

          setQuestions(phonicsQuestions)
          return
        }

        if (vocab.length === 0) {
          throw new Error(
            'No vocabulary found for this lesson.',
          )
        }

        if (mode === 'daily') {
          /*
           * Target mix: 10 Vocabulary + 8 Sentence + 7 Phonics.
           * Some early lessons have fewer than 8 unique sentence items.
           * We never repeat the same sentence just to reach 25;
           * any shortage is backfilled with unused vocab/phonics questions.
           */
          const vocabPool =
            buildVocabularyQuestions(
              vocab,
              data.assets,
              vocabTypes,
              Math.min(vocab.length, 16),
            )

          const sentenceQuestions =
            buildSentenceQuestions(
              sentences,
              allSentences,
              sentenceTypes,
              8,
            )

          const phonicsPool =
            buildPhonicsQuestions(
              phonics,
              vocab,
              data.assets,
              phonicsTypes,
              12,
            )

          const primaryVocab = vocabPool.slice(0, 10)
          const primaryPhonics = phonicsPool.slice(0, 7)

          let selectedQuestions = [
            ...primaryVocab,
            ...sentenceQuestions,
            ...primaryPhonics,
          ]

          const extras = shuffle([
            ...vocabPool.slice(10),
            ...phonicsPool.slice(7),
          ])

          while (
            selectedQuestions.length < 25 &&
            extras.length > 0
          ) {
            const next = extras.shift()
            if (next) selectedQuestions.push(next)
          }

          const mixed = mixQuestionGroups([
            shuffle(
              selectedQuestions.filter((question) =>
                question.type.startsWith('sentence_') === false &&
                question.type.startsWith('phonics_') === false,
              ),
            ),
            shuffle(
              selectedQuestions.filter((question) =>
                question.type.startsWith('sentence_'),
              ),
            ),
            shuffle(
              selectedQuestions.filter((question) =>
                question.type.startsWith('phonics_'),
              ),
            ),
          ])

          setQuestions(mixed.slice(0, 25))
          return
        }

        setQuestions(
          buildVocabularyQuestions(
            vocab,
            data.assets,
            vocabTypes,
            10,
          ),
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
      setError('Missing lesson id.')
      setLoading(false)
    }

    return () => {
      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel()
      }
    }
  }, [lessonId, mode])

  const currentQuestion = useMemo(
    () => questions[currentIndex],
    [questions, currentIndex],
  )

  useEffect(() => {
    setSelected(null)
    setWrongAnswers([])
    setHasAttempted(false)
    setSpellPickedIds([])
    setSpellPickedLetters([])
    setSpellError(false)

    if (!currentQuestion) return

    let autoText = ''

    if (currentQuestion.type === 'spell_word') {
      autoText = `How do you spell ${currentQuestion.item.english}?`
    } else if (
      currentQuestion.type === 'audio_to_word' ||
      currentQuestion.type === 'audio_to_image'
    ) {
      autoText = currentQuestion.item.english
    } else if (
      currentQuestion.type === 'sentence_listen_choose'
    ) {
      autoText = currentQuestion.item.english
    } else if (
      currentQuestion.type === 'phonics_audio_initial_letter' ||
      currentQuestion.type === 'phonics_audio_vowel' ||
      currentQuestion.type === 'phonics_audio_blend'
    ) {
      autoText = currentQuestion.phonicsWord ?? ''
    }

    if (!autoText) return

    const timer = window.setTimeout(() => {
      speakEnglish(autoText)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [currentQuestion?.id])

  const finished =
    questions.length > 0 &&
    currentIndex >= questions.length

  function chooseAnswer(answer: string) {
    if (
      !currentQuestion ||
      selected ||
      wrongAnswers.includes(answer)
    ) {
      return
    }

    const isCorrect =
      answer === currentQuestion.correctAnswer

    if (isCorrect) {
      if (!hasAttempted) {
        setScore((value) => value + 1)
      }
      setHasAttempted(true)
      setSelected(answer)
      return
    }

    setHasAttempted(true)
    setWrongAnswers((answers) => [
      ...answers,
      answer,
    ])
  }

  function pickSpellLetter(button: LetterButton) {
    if (
      !currentQuestion ||
      currentQuestion.type !== 'spell_word' ||
      selected ||
      spellPickedIds.includes(button.id)
    ) {
      return
    }

    const target =
      currentQuestion.correctAnswer.toLowerCase()

    if (spellPickedLetters.length >= target.length) {
      return
    }

    const nextIds = [
      ...spellPickedIds,
      button.id,
    ]
    const nextLetters = [
      ...spellPickedLetters,
      button.letter,
    ]

    setSpellPickedIds(nextIds)
    setSpellPickedLetters(nextLetters)
    setSpellError(false)

    if (nextLetters.length === target.length) {
      const attempt = nextLetters.join('')

      if (attempt === target) {
        if (!hasAttempted) {
          setScore((value) => value + 1)
        }
        setHasAttempted(true)
        setSelected(attempt)
      } else {
        setHasAttempted(true)
        setSpellError(true)
      }
    }
  }

  function removeSpellLetter() {
    if (selected || spellPickedIds.length === 0) {
      return
    }

    setSpellPickedIds((values) => values.slice(0, -1))
    setSpellPickedLetters((values) => values.slice(0, -1))
    setSpellError(false)
  }

  function clearSpellLetters() {
    if (selected) return

    setSpellPickedIds([])
    setSpellPickedLetters([])
    setSpellError(false)
  }

  function nextQuestion() {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel()
    }

    setSelected(null)
    setWrongAnswers([])
    setHasAttempted(false)
    setSpellPickedIds([])
    setSpellPickedLetters([])
    setSpellError(false)
    setCurrentIndex((value) => value + 1)
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
    const isDaily = mode === 'daily'

    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">
            {isDaily
              ? '🌱'
              : mode === 'sentence'
                ? '💬'
                : mode === 'phonics'
                  ? '🔤'
                  : '📚'}
          </div>

          <h1 className="mt-4 text-3xl font-bold">
            Practice complete!
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            You got {score} / {questions.length} correct.
          </p>

          {isDaily && (
            <>
              <div className="mt-6 text-4xl">💧</div>
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

  if (!currentQuestion) return null

  const progress =
    ((currentIndex + 1) / questions.length) * 100

  const usesVisualOptions =
    currentQuestion.type === 'word_to_image' ||
    currentQuestion.type === 'audio_to_image'

  const isSpellQuestion =
    currentQuestion.type === 'spell_word'

  return (
    <main className="mx-auto max-w-3xl p-6">
      <section className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Question {currentIndex + 1} / {questions.length}
          </span>
          <span>Score {score}</span>
        </div>

        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">
        {currentQuestion.type === 'image_to_word' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the word.
            </p>

            <div className="mt-6 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} />
              )}
            </div>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish('Choose the word.')
                }
                className="rounded-full bg-sky-50 px-4 py-3 text-2xl transition hover:bg-sky-100"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {currentQuestion.type === 'audio_to_word' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose.
            </p>

            <div className="my-8 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(currentQuestion.item.english)
                }
                className="rounded-full bg-sky-100 px-8 py-6 text-5xl shadow-sm transition hover:scale-105"
              >
                🔊
              </button>
              <p className="mt-3 text-sm text-slate-400">
                Tap to listen again
              </p>
            </div>
          </>
        )}

        {currentQuestion.type === 'word_to_image' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the picture.
            </p>

            <h1 className="mt-4 text-center text-5xl font-bold text-slate-800">
              {currentQuestion.item.english}
            </h1>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(currentQuestion.item.english)
                }
                className="rounded-full px-4 py-2 text-2xl hover:bg-slate-100"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {currentQuestion.type === 'audio_to_image' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the picture.
            </p>

            <div className="my-8 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(currentQuestion.item.english)
                }
                className="rounded-full bg-sky-100 px-8 py-6 text-5xl shadow-sm transition hover:scale-105"
              >
                🔊
              </button>
              <p className="mt-3 text-sm text-slate-400">
                Tap to listen again
              </p>
            </div>
          </>
        )}

        {currentQuestion.type === 'missing_letter' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing letter.
            </p>

            <div className="mt-5 text-center">
              <div className="text-5xl font-bold tracking-[0.18em] text-slate-800">
                {currentQuestion.maskedWord}
              </div>

              <button
                type="button"
                onClick={() =>
                  speakEnglish(currentQuestion.item.english)
                }
                className="mt-4 rounded-full bg-sky-50 px-4 py-3 text-3xl hover:bg-sky-100"
              >
                🔊
              </button>
            </div>
          </>
        )}

        {currentQuestion.type === 'spell_word' && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3 text-center text-2xl font-bold text-slate-700 sm:text-3xl">
              <span>How do you spell</span>
              {currentQuestion.asset && (
                <Visual
                  asset={currentQuestion.asset}
                  size="inline"
                />
              )}
              <span>?</span>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(
                    `How do you spell ${currentQuestion.item.english}?`,
                  )
                }
                className="rounded-full bg-amber-50 px-5 py-4 text-3xl transition hover:bg-amber-100"
              >
                🔊
              </button>
              <p className="mt-2 text-sm text-slate-400">
                Tap to hear the question again
              </p>
            </div>

            <div className="mt-8 flex min-h-16 flex-wrap items-center justify-center gap-2">
              {currentQuestion.correctAnswer
                .split('')
                .map((_, index) => (
                  <div
                    key={index}
                    className="flex h-14 w-12 items-center justify-center border-b-4 border-slate-400 text-3xl font-bold text-slate-800"
                  >
                    {spellPickedLetters[index] ?? ''}
                  </div>
                ))}
            </div>

            {spellError && (
              <p className="mt-4 text-center font-bold text-amber-600">
                Try again 🙂
              </p>
            )}

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {currentQuestion.letterBank?.map((button) => {
                const used = spellPickedIds.includes(button.id)

                return (
                  <button
                    key={button.id}
                    type="button"
                    disabled={used || selected !== null}
                    onClick={() => pickSpellLetter(button)}
                    className={
                      used
                        ? 'h-14 w-14 rounded-2xl bg-slate-100 text-xl font-bold text-slate-300'
                        : 'h-14 w-14 rounded-2xl border-2 border-slate-200 bg-white text-xl font-bold text-slate-800 shadow-sm transition hover:border-amber-400'
                    }
                  >
                    {button.letter}
                  </button>
                )
              })}
            </div>

            {!selected && (
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={removeSpellLetter}
                  disabled={spellPickedIds.length === 0}
                  className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-600 disabled:opacity-40"
                >
                  ⌫ Delete
                </button>

                <button
                  type="button"
                  onClick={clearSpellLetters}
                  disabled={spellPickedIds.length === 0}
                  className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-600 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            )}
          </>
        )}

        {currentQuestion.type === 'sentence_choose_response' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the best response.
            </p>

            <div className="mt-6 text-center text-3xl font-bold leading-relaxed text-slate-800">
              {currentQuestion.sentencePrompt}
            </div>

            <button
              type="button"
              onClick={() =>
                speakEnglish(
                  currentQuestion.sentencePrompt ?? '',
                )
              }
              className="mx-auto mt-5 block rounded-full bg-violet-50 px-5 py-4 text-3xl transition hover:bg-violet-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'sentence_listen_choose' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the sentence.
            </p>

            <div className="my-8 text-center">
              <button
                type="button"
                onClick={() =>
                  speakEnglish(currentQuestion.item.english)
                }
                className="rounded-full bg-violet-100 px-8 py-6 text-5xl shadow-sm transition hover:scale-105"
              >
                🔊
              </button>
              <p className="mt-3 text-sm text-slate-400">
                Tap to listen again
              </p>
            </div>
          </>
        )}

        {currentQuestion.type === 'sentence_fill_blank' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing word.
            </p>

            <div className="mt-6 text-center text-3xl font-bold leading-relaxed text-slate-800">
              {currentQuestion.sentencePrompt}
            </div>

            <button
              type="button"
              onClick={() =>
                speakEnglish('Choose the missing word.')
              }
              className="mx-auto mt-5 block rounded-full bg-violet-50 px-4 py-3 text-3xl hover:bg-violet-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_image_initial_letter' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the beginning letter.
            </p>
            <div className="mt-6 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} />
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish('Choose the beginning letter.')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_audio_initial_letter' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the beginning letter.
            </p>
            <div className="mt-6 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-100 px-6 py-5 text-4xl hover:bg-indigo-200"
            >
              🔊
            </button>
            <p className="mt-2 text-center text-sm text-slate-400">
              Tap to listen again
            </p>
          </>
        )}

        {currentQuestion.type === 'phonics_missing_initial_letter' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing beginning letter.
            </p>
            <div className="mt-5 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <div className="mt-5 text-center text-5xl font-bold tracking-[0.18em] text-slate-800">
              {currentQuestion.maskedWord}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_letter_case_match' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Match the capital and small letter.
            </p>
            <div className="mt-6 text-center text-6xl font-bold text-slate-800">
              {currentQuestion.phonicsPrompt}
            </div>
          </>
        )}

        {currentQuestion.type === 'phonics_audio_vowel' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the vowel.
            </p>
            <div className="mt-5 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-100 px-6 py-5 text-4xl hover:bg-indigo-200"
            >
              🔊
            </button>
            <p className="mt-2 text-center text-sm text-slate-400">
              Tap to listen again
            </p>
          </>
        )}

        {currentQuestion.type === 'phonics_missing_vowel' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing vowel.
            </p>
            <div className="mt-5 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <div className="mt-5 text-center text-5xl font-bold tracking-[0.18em] text-slate-800">
              {currentQuestion.maskedWord}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_cvc_build_word' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Put the sounds together. Choose the word.
            </p>
            <div className="mt-5 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <div className="mt-6 text-center text-4xl font-bold tracking-[0.18em] text-slate-800">
              {currentQuestion.phonicsPrompt}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_image_blend' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the beginning blend.
            </p>
            <div className="mt-6 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} />
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish('Choose the beginning blend.')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_audio_blend' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Listen and choose the beginning blend.
            </p>
            <div className="mt-5 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-100 px-6 py-5 text-4xl hover:bg-indigo-200"
            >
              🔊
            </button>
            <p className="mt-2 text-center text-sm text-slate-400">
              Tap to listen again
            </p>
          </>
        )}

        {currentQuestion.type === 'phonics_missing_blend' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Choose the missing beginning blend.
            </p>
            <div className="mt-5 flex justify-center">
              {currentQuestion.asset && (
                <Visual asset={currentQuestion.asset} size="inline" />
              )}
            </div>
            <div className="mt-5 text-center text-5xl font-bold tracking-[0.18em] text-slate-800">
              {currentQuestion.maskedWord}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {currentQuestion.type === 'phonics_same_initial_blend' && (
          <>
            <p className="text-center text-lg font-bold tracking-wide text-slate-600">
              Which word begins with the same sound?
            </p>
            <div className="mt-6 text-center text-4xl font-bold text-slate-800">
              {currentQuestion.phonicsWord}
            </div>
            <button
              type="button"
              onClick={() =>
                speakEnglish(currentQuestion.phonicsWord ?? '')
              }
              className="mx-auto mt-4 block rounded-full bg-indigo-50 px-4 py-3 text-3xl hover:bg-indigo-100"
            >
              🔊
            </button>
          </>
        )}

        {!isSpellQuestion &&
          (usesVisualOptions ? (
            <div className="mt-8 grid grid-cols-2 gap-4">
              {currentQuestion.visualOptions?.map((option) => {
                const isCorrect =
                  option.english === currentQuestion.correctAnswer
                const isSelected =
                  option.english === selected
                const isWrong =
                  wrongAnswers.includes(option.english)

                let className =
                  'flex min-h-40 items-center justify-center rounded-2xl border-2 p-4 transition '

                if (isSelected && isCorrect) {
                  className +=
                    'border-emerald-500 bg-emerald-50'
                } else if (isWrong) {
                  className +=
                    'border-red-400 bg-red-50 opacity-70'
                } else if (selected) {
                  className +=
                    'border-slate-200 bg-slate-50 opacity-50'
                } else {
                  className +=
                    'border-slate-200 bg-white hover:border-emerald-400'
                }

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => chooseAnswer(option.english)}
                    disabled={
                      selected !== null || isWrong
                    }
                    className={className}
                  >
                    <Visual
                      asset={option.asset}
                      size="small"
                    />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {currentQuestion.textOptions?.map((option) => {
                const isCorrect =
                  option === currentQuestion.correctAnswer
                const isSelected = option === selected
                const isWrong =
                  wrongAnswers.includes(option)

                let className =
                  'rounded-2xl border-2 p-4 text-lg font-semibold transition '

                if (isSelected && isCorrect) {
                  className +=
                    'border-emerald-500 bg-emerald-50 text-emerald-700'
                } else if (isWrong) {
                  className +=
                    'border-red-400 bg-red-50 text-red-600'
                } else if (selected) {
                  className +=
                    'border-slate-200 bg-slate-50 text-slate-400'
                } else {
                  className +=
                    'border-slate-200 bg-white text-slate-900 hover:border-emerald-400'
                }

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => chooseAnswer(option)}
                    disabled={
                      selected !== null || isWrong
                    }
                    className={className}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          ))}

        {!selected && wrongAnswers.length > 0 && (
          <div className="mt-6 text-center">
            <p className="font-bold text-amber-600">
              Try again 🙂
            </p>
          </div>
        )}

        {selected && (
          <div className="mt-6 text-center">
            <p className="font-bold text-emerald-600">
              Correct! 🎉
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
