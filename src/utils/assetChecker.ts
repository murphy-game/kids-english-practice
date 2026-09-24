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
  emojiSuggested: {
    image_key: string
    emoji: string
  }[]
  imageReady: Asset[]
  missing: string[]
}

/*
 * GitHub Pages 網址：
 * https://murphy-game.github.io/kids-english-practice/
 *
 * vocabulary 圖片實際位置：
 * /kids-english-practice/assets/images/vocabulary/
 */
const ASSET_BASE_PATH =
  '/kids-english-practice/assets/images/vocabulary/'

async function fileExists(
  url: string,
): Promise<boolean> {
  try {
    // 加時間戳，避免瀏覽器拿到舊快取
    const separator = url.includes('?') ? '&' : '?'
    const checkUrl =
      `${url}${separator}check=${Date.now()}`

    const response = await fetch(checkUrl, {
      method: 'GET',
      cache: 'no-store',
    })

    return response.ok
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

  for (const key of requiredKeys) {
    const asset = assetMap.get(key)

    // 1. 已核准 Emoji
    if (
      asset?.display_type === 'emoji' &&
      asset.status === 'approved' &&
      asset.emoji
    ) {
      emojiApproved.push(asset)
      continue
    }

    // 2. Sheet 指定為圖片
    if (asset?.display_type === 'image') {
      // 若 Sheet 沒寫 image_file，
      // 自動使用 image_key.png
      const imageFile =
        asset.image_file?.trim() ||
        `${key}.png`

      const imageUrl =
        `${ASSET_BASE_PATH}${encodeURIComponent(
          imageFile,
        )}`

      const exists =
        await fileExists(imageUrl)

      // 必須同時：
      // A. Sheet = approved
      // B. GitHub Pages 實際找得到圖片
      if (
        asset.status === 'approved' &&
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

    // 3. Sheet 尚未指定時才提出 Emoji 建議
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
