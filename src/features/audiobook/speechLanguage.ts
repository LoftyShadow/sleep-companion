import type { TtsVoice } from "./TtsEnginePort";

export const DEFAULT_SPEECH_LANGUAGE = "zh-CN";

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

export function detectSpeechLanguage(text: string): string {
  const hanCount = countMatches(text, /[\u3400-\u9fff]/gu);
  const kanaCount = countMatches(text, /[\u3040-\u30ff]/gu);
  const hangulCount = countMatches(text, /[\uac00-\ud7af]/gu);
  const latinCount = countMatches(text, /[A-Za-z]/gu);

  if (kanaCount > 0 && kanaCount >= hanCount) {
    return "ja-JP";
  }

  if (hangulCount > 0 && hangulCount >= hanCount) {
    return "ko-KR";
  }

  if (latinCount > 0 && hanCount === 0 && kanaCount === 0 && hangulCount === 0) {
    return "en-US";
  }

  return DEFAULT_SPEECH_LANGUAGE;
}

export function getLanguageFamily(language: string): string {
  const normalizedLanguage = language.toLowerCase();

  if (
    normalizedLanguage.startsWith("zh") ||
    normalizedLanguage.startsWith("cmn") ||
    normalizedLanguage.startsWith("yue") ||
    normalizedLanguage.startsWith("hak")
  ) {
    return "zh";
  }

  return normalizedLanguage.split("-")[0] ?? normalizedLanguage;
}

export function findPreferredVoiceId(
  voices: TtsVoice[],
  speechLanguage: string,
): string | null {
  const speechFamily = getLanguageFamily(speechLanguage);
  const matchingVoices = voices.filter(
    (voice) => getLanguageFamily(voice.language) === speechFamily,
  );
  const defaultMatchingVoice = matchingVoices.find((voice) => voice.isDefault);

  return defaultMatchingVoice?.id ?? matchingVoices[0]?.id ?? null;
}
