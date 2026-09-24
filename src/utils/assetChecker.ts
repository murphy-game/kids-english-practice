import type { Asset, ContentItem } from '../types'

export const EMOJI_SUGGESTIONS: Record<string, string> = {
  apple: '🍎',
  ant: '🐜',
  ball: '⚽',
  book: '📖',
  bear: '🐻',
  car: '🚗',
  cake: '🎂',
  cat: '🐱',
  duck: '🦆',
  dog: '🐶',
  door: '🚪',
  elephant: '🐘',
  egg: '🥚',
  fish: '🐟',
  fire: '🔥',
  goat: '🐐',
  guitar: '🎸',
  hamburger: '🍔',
  horse: '🐴',
  hand: '✋',
  insect: '🐞',
  jellyfish: '🪼',
  kangaroo: '🦘',
  koala: '🐨',
  lion: '🦁',
  monkey: '🐒',
  money: '💰',
  nuts: '🥜',
  octopus: '🐙',
  olive: '🫒',
  pig: '🐷',
  pizza: '🍕',
  rabbit: '🐰',
  rice: '🍚',
  ear: '👂',
  snake: '🐍',
  sock: '🧦',
  sun: '☀️',
  tiger: '🐯',
  umbrella: '☂️',
  bird: '🐦',
  van: '🚐',
  witch: '🧙‍♀️',
  window: '🪟',
  wolf: '🐺',
  fox: '🦊',
  box: '📦',
  'yo-yo': '🪀',
  zebra: '🦓',
  girl: '👧',
  teacher: '👩‍🏫',
  bag: '🎒',
  bat: '🦇',
  leg: '🦵',
  milk: '🥛',
  friend: '🧑‍🤝‍🧑',
  spoon: '🥄',
  spider: '🕷️',
  student: '🧑‍🎓',
  skirt: '👗',
  ski: '🎿',
  smile: '😊',
  snail: '🐌',
  snow: '❄️',
  swan: '🦢',
  sweater: '🧥',
  black: '⚫',
  blue: '🔵',
  plane: '✈️',
  clock: '🕒',
  cloud: '☁️',
  clown: '🤡',
  glove: '🧤',
  globe: '🌍',
  flag: '🚩',
  fly: '🪰',
  flower: '🌸',
  slipper: '🥿',
  one: '1️⃣',
  two: '2️⃣',
  three: '3️⃣',
  four: '4️⃣',
  five: '5️⃣',
  six: '6️⃣',
  ten: '🔟',
}

export interface AssetCheckResult {
  requiredKeys: string[]
  emojiApproved: Asset[]
  emojiSuggested: { image_key: string; emoji: string }[]
  imageReady: Asset[]
  missing: string[]
}

function getAssetBasePath() {
  return `${import.meta.env.BASE_URL}assets/images/vocabulary/`
}

async function fileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
    })

    if (response.ok) {
      return true
    }

    // 某些靜態主機可能不支援 HEAD，改用 GET 再試一次
    const fallbackResponse = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    })

    return fallbackResponse.ok
  } catch {
    return false
  }
}

export async function checkAssets(
  content: ContentItem[],
  assets: Asset[],
): Promise<AssetCheckResult> {
  const requiredKeys = [
    ...new Set(
      content
        .filter(
          (item) =>
            item.need_image === 'yes' &&
            item.image_key,
        )
        .map((item) => item.image_key),
    ),
  ].sort()

  const assetMap = new Map(
    assets.map((asset) => [
      asset.image_key,
      asset,
    ]),
  )

  const emojiApproved: Asset[] = []
  const emojiSuggested: {
    image_key: string
    emoji: string
  }[] = []
  const imageReady: Asset[] = []
  const missing: string[] = []

  const assetBasePath = getAssetBasePath()

  for (const key of requiredKeys) {
    const asset = assetMap.get(key)

    // 已核准 Emoji
    if (
      asset?.display_type === 'emoji' &&
      asset.status === 'approved' &&
      asset.emoji
    ) {
      emojiApproved.push(asset)
      continue
    }

    // 已指定 image 類型
    if (asset?.display_type === 'image') {
      const imageFile =
        asset.image_file ||
        `${key}.png`

      const imageUrl =
        `${assetBasePath}${imageFile}`

      const exists =
        await fileExists(imageUrl)

      if (
        asset.status === 'approved' &&
        imageFile &&
        exists
      ) {
        imageReady.push({
          ...asset,
          image_file: imageFile,
        })
      } else {
        missing.push(key)
      }

      continue
    }

    // 尚未設定 ASSETS 時，才給 Emoji suggestion
    const suggestion =
      EMOJI_SUGGESTIONS[key]

    if (suggestion) {
      emojiSuggested.push({
        image_key: key,
        emoji: suggestion,
      })
    } else {
      missing.push(key)
    }
  }

  return {
    requiredKeys,
    emojiApproved,
    emojiSuggested,
    imageReady,
    missing,
  }
}
