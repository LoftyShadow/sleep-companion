import type { AudiobookSegment } from "./audiobookTypes";
import type { ManifestItem, SpineItem } from "./epubPackage";
import { selectReadableSpineItems, XHTML_MEDIA_TYPES } from "./epubPackage";
import { extractChapterTitle, extractReadableText } from "./epubTextExtraction";
import { parseContentDocument, resolveZipHref } from "./epubXml";
import { segmentBookText } from "./textSegmentation";

export interface ReadEpubSegmentsOptions {
  loadText: (path: string) => Promise<string>;
  manifestItems: Map<string, ManifestItem>;
  opfPath: string;
  spineItems: SpineItem[];
}

export async function readEpubSegments({
  loadText,
  manifestItems,
  opfPath,
  spineItems,
}: ReadEpubSegmentsOptions): Promise<AudiobookSegment[]> {
  const segments: AudiobookSegment[] = [];
  let chapterIndex = 0;

  for (const spineItem of selectReadableSpineItems(spineItems)) {
    const manifestItem = manifestItems.get(spineItem.idref);
    if (!manifestItem || !XHTML_MEDIA_TYPES.has(manifestItem.mediaType)) {
      continue;
    }

    const sourceHref = resolveZipHref(manifestItem.href, opfPath);
    const chapterDocument = parseContentDocument(await loadText(sourceHref));
    const fallbackTitle = `第 ${chapterIndex + 1} 章`;
    const chapterTitle = extractChapterTitle(chapterDocument, fallbackTitle);
    const chapterText = extractReadableText(chapterDocument);

    if (chapterText.length === 0) {
      chapterIndex += 1;
      continue;
    }

    segments.push(
      ...segmentBookText(chapterText, {
        chapterTitle,
        idPrefix: `epub-${chapterIndex + 1}`,
        sourceHref,
        startingOrder: segments.length + 1,
      }),
    );
    chapterIndex += 1;
  }

  if (segments.length === 0) {
    throw new Error("EPUB 中没有可朗读的正文");
  }

  return segments;
}
