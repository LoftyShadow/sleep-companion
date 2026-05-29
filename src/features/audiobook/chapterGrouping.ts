import type { AudiobookChapter, AudiobookSegment } from "./audiobookTypes";

function getSegmentChapterKey(segment: AudiobookSegment): string {
  return segment.sourceHref ?? segment.chapterTitle ?? "plain-text";
}

function getChapterTitle(segment: AudiobookSegment, chapterNumber: number): string {
  return segment.chapterTitle?.trim() || `第 ${chapterNumber} 章`;
}

export function buildAudiobookChapters(
  segments: readonly AudiobookSegment[],
): AudiobookChapter[] {
  if (segments.length === 0) {
    return [];
  }

  const chapters: AudiobookChapter[] = [];
  let currentKey = getSegmentChapterKey(segments[0]);
  let startSegmentIndex = 0;

  for (let index = 1; index <= segments.length; index += 1) {
    const segment = segments[index];
    const nextKey = segment ? getSegmentChapterKey(segment) : null;

    if (nextKey === currentKey) {
      continue;
    }

    const firstSegment = segments[startSegmentIndex];
    const endSegmentIndex = index - 1;
    const chapterNumber = chapters.length + 1;

    if (firstSegment) {
      chapters.push({
        endSegmentIndex,
        id: `chapter-${chapterNumber}`,
        segmentCount: endSegmentIndex - startSegmentIndex + 1,
        sourceHref: firstSegment.sourceHref,
        startSegmentIndex,
        title:
          firstSegment.sourceHref || firstSegment.chapterTitle
            ? getChapterTitle(firstSegment, chapterNumber)
            : "全文",
      });
    }

    if (segment) {
      currentKey = getSegmentChapterKey(segment);
      startSegmentIndex = index;
    }
  }

  return chapters;
}

export function findChapterIndexForSegment(
  chapters: readonly AudiobookChapter[],
  segmentIndex: number,
): number {
  if (chapters.length === 0) {
    return -1;
  }

  const chapterIndex = chapters.findIndex(
    (chapter) =>
      segmentIndex >= chapter.startSegmentIndex &&
      segmentIndex <= chapter.endSegmentIndex,
  );

  return chapterIndex >= 0 ? chapterIndex : 0;
}
