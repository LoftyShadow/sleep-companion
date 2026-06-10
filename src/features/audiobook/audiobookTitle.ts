const DEFAULT_AUDIOBOOK_TITLE = "未命名书稿";
export const SHORT_AUDIOBOOK_TITLE_MAX_LENGTH = 24;

interface ShortAudiobookTitleOptions {
  fallbackTitle?: string;
  maxLength?: number;
}

export function getFullAudiobookTitle(
  title: string,
  fallbackTitle = DEFAULT_AUDIOBOOK_TITLE,
) {
  const normalizedTitle = title.trim();

  return normalizedTitle.length > 0 ? normalizedTitle : fallbackTitle;
}

export function getShortAudiobookTitle(
  title: string,
  {
    fallbackTitle = DEFAULT_AUDIOBOOK_TITLE,
    maxLength = SHORT_AUDIOBOOK_TITLE_MAX_LENGTH,
  }: ShortAudiobookTitleOptions = {},
) {
  const fullTitle = getFullAudiobookTitle(title, fallbackTitle);
  const titleCharacters = Array.from(fullTitle);

  if (titleCharacters.length <= maxLength) {
    return fullTitle;
  }

  return `${titleCharacters.slice(0, maxLength).join("")}...`;
}
