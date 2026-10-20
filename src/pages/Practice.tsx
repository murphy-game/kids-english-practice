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
