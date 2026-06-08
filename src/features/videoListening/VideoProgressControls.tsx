import type { ChangeEvent } from "react";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";
import {
  formatPlaybackTime,
  getCurrentChapterIndex,
  getProgressDurationSeconds,
} from "./bilibiliVideoPlaybackUtils";

interface VideoProgressControlsProps {
  audioSource: BilibiliDirectAudioSource | null;
  currentTimeSeconds: number;
  durationSeconds: number;
  onPreviewSeek: (seconds: number) => void;
  onSeek: (seconds: number) => void;
}

export function VideoProgressControls({
  audioSource,
  currentTimeSeconds,
  durationSeconds,
  onPreviewSeek,
  onSeek,
}: VideoProgressControlsProps) {
  const chapters = audioSource?.chapters ?? [];
  const progressDurationSeconds = getProgressDurationSeconds(
    audioSource,
    durationSeconds,
  );
  const safeCurrentTimeSeconds =
    progressDurationSeconds > 0
      ? Math.min(Math.max(0, currentTimeSeconds), progressDurationSeconds)
      : Math.max(0, currentTimeSeconds);
  const canSeek = Boolean(audioSource && progressDurationSeconds > 0);
  const currentChapterIndex = getCurrentChapterIndex(
    chapters,
    safeCurrentTimeSeconds,
  );

  function handleProgressChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSeconds = Number(event.currentTarget.value);
    if (!Number.isFinite(nextSeconds)) {
      return;
    }

    const targetSeconds =
      progressDurationSeconds > 0
        ? Math.min(Math.max(0, nextSeconds), progressDurationSeconds)
        : Math.max(0, nextSeconds);
    onSeek(targetSeconds);
    onPreviewSeek(targetSeconds);
  }

  function handleChapterChange(event: ChangeEvent<HTMLSelectElement>) {
    const chapterIndex = Number(event.currentTarget.value);
    const chapter = Number.isInteger(chapterIndex)
      ? chapters[chapterIndex]
      : undefined;
    if (!chapter) {
      return;
    }

    onSeek(chapter.fromSeconds);
    onPreviewSeek(chapter.fromSeconds);
  }

  return (
    <div className="video-progress-shell" aria-label="播放进度">
      <div className="video-progress-time-row">
        <span>{formatPlaybackTime(safeCurrentTimeSeconds)}</span>
        <span>{formatPlaybackTime(progressDurationSeconds)}</span>
      </div>
      <div className="video-progress-range-shell">
        <input
          aria-label="播放进度"
          className="video-progress-range"
          disabled={!canSeek}
          max={Math.max(1, progressDurationSeconds)}
          min="0"
          step="1"
          type="range"
          value={Math.min(
            safeCurrentTimeSeconds,
            Math.max(1, progressDurationSeconds),
          )}
          onChange={handleProgressChange}
        />
        {canSeek && chapters.length > 0 ? (
          <div className="video-progress-markers" aria-hidden="true">
            {chapters.map((chapter) => (
              <span
                key={`${chapter.fromSeconds}:${chapter.content}`}
                style={{
                  left: `${Math.min(
                    100,
                    Math.max(
                      0,
                      (chapter.fromSeconds / progressDurationSeconds) * 100,
                    ),
                  )}%`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
      {chapters.length > 0 ? (
        <label className="video-chapter-control">
          <span>章节</span>
          <select
            aria-label="视频章节"
            value={currentChapterIndex >= 0 ? String(currentChapterIndex) : ""}
            onChange={handleChapterChange}
          >
            {chapters.map((chapter, index) => (
              <option
                key={`${chapter.fromSeconds}:${chapter.content}`}
                value={index}
              >
                {formatPlaybackTime(chapter.fromSeconds)} · {chapter.content}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
