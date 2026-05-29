import type { ImportedAudiobookBook } from "./audiobookTypes";
import { isSupportedEpubBookFile, readEpubBookFile } from "./epubImport";
import {
  isSupportedPlainTextBookFile,
  readPlainTextBookFile,
} from "./textSegmentation";

export const AUDIOBOOK_FILE_ACCEPT =
  ".txt,.md,.markdown,.epub,text/plain,text/markdown,application/epub+zip";

export function isSupportedAudiobookBookFile(file: File): boolean {
  return isSupportedPlainTextBookFile(file) || isSupportedEpubBookFile(file);
}

export async function readAudiobookBookFile(
  file: File,
): Promise<ImportedAudiobookBook> {
  if (isSupportedEpubBookFile(file)) {
    return readEpubBookFile(file);
  }

  if (isSupportedPlainTextBookFile(file)) {
    return readPlainTextBookFile(file);
  }

  throw new Error("听书支持 txt、markdown 和 EPUB 文件");
}
