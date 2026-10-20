const KEY = 'kids-english-speech-rate'
let currentRate = 0.8
export function getSpeechRate(): number {
  if (typeof window !== 'undefined') {
    const stored = Number(window.localStorage.getItem(KEY))
    if ([0.7, 0.8, 1].includes(stored)) currentRate = stored
  }
  return currentRate
}
export function setSpeechRate(rate: number): void {
  if (![0.7, 0.8, 1].includes(rate)) return
  currentRate = rate
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, String(rate))
}
export function speakEnglish(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return
  window.speechSynthesis.cancel()
  const normalized = text.replace(/\s*\/\s*/g, '. ').replace(/\s+/g, ' ').trim()
  const utterance = new SpeechSynthesisUtterance(normalized)
  utterance.lang = 'en-US'
  utterance.rate = getSpeechRate()
  utterance.pitch = 1
  const voices = window.speechSynthesis.getVoices()
  const english = voices.find((voice) => voice.lang.toLowerCase() === 'en-us') ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
  if (english) utterance.voice = english
  window.speechSynthesis.speak(utterance)
}
