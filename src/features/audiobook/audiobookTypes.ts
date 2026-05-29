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

export interface PlainTextBook {
  kind: "plain-text";
  title: string;
  text: string;
}

export interface SegmentedAudiobookBook {
  kind: "segmented";
  format: "epub";
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
