export interface AudiobookSegment {
  id: string;
  order: number;
  text: string;
}

export interface PlainTextBook {
  title: string;
  text: string;
}

export type AudiobookPlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";
