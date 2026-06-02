export interface AudiobookSegment {
  id: string;
  order: number;
  text: string;
  chapterTitle?: string;
  sourceHref?: string;
}

export interface AudiobookChapter {
  id: string;
  title: string;
  startSegmentIndex: number;
  endSegmentIndex: number;
  segmentCount: number;
  sourceHref?: string;
}

export interface ImportedAudiobookCover {
  blob: Blob;
  type: string;
}

export interface PlainTextBook {
  kind: "plain-text";
  title: string;
  text: string;
}

export interface SegmentedAudiobookBook {
  kind: "segmented";
  format: "epub";
  author?: string;
  coverImage?: ImportedAudiobookCover;
  title: string;
  segments: AudiobookSegment[];
}

export type ImportedAudiobookBook = PlainTextBook | SegmentedAudiobookBook;

export type AudiobookPlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type AudiobookBookId = `audiobook:${string}`;

export type StoredAudiobookFormat = "plain-text" | "epub";

export type AudiobookCover =
  | {
      kind: "generated";
      accent: string;
      initials: string;
    }
  | {
      kind: "image";
      mimeType: string;
      path: string;
    };

export interface AudiobookProgress {
  segmentId: string | null;
  segmentIndex: number;
  percent: number;
  updatedAt: number;
  chapterTitle?: string;
  sourceHref?: string;
}

export interface AudiobookLibraryItem {
  id: AudiobookBookId;
  title: string;
  format: StoredAudiobookFormat;
  fileName: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  segmentCount: number;
  chapterCount: number;
  progress: AudiobookProgress;
  cover: AudiobookCover;
  author?: string;
}

export interface StoredAudiobookBook {
  book: ImportedAudiobookBook;
  item: AudiobookLibraryItem;
}
