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
  jet: '✈️',
  jellyfish: '🪼',
  kangaroo: '🦘',
  koala: '🐨',
  lion: '🦁',
  monkey: '🐒',
  money: '💰',
  nuts: '🥜',
  octopus: '🐙',
  ox: '🐂',
  olive: '🫒',
  pig: '🐷',
  pizza: '🍕',
  queen: '👑',
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
  smoke: '💨',
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
  glass: '🥛',
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

export function checkAssets(
  content: ContentItem[],
  assets: Asset[],
): AssetCheckResult {
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

    // 已明確核准 Emoji
    if (
      asset?.display_type === 'emoji' &&
      asset.status === 'approved' &&
      asset.emoji
    ) {
      emojiApproved.push(asset)
      continue
    }

    // 已明確指定使用圖片
    // 不再提供 Emoji suggestion
    if (asset?.display_type === 'image') {
      if (
        asset.status === 'approved' &&
        asset.image_file
      ) {
        imageReady.push(asset)
      } else {
        missing.push(key)
      }

      continue
    }

    // ASSETS 尚未設定時，才提供 Emoji suggestion
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
