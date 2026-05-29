import type { AudiobookPlaybackStatus } from "./audiobookTypes";

interface AudiobookTransportProps {
  canRead: boolean;
  currentSegmentIndex: number;
  isBusy: boolean;
  primaryActionLabel: string;
  segmentCount: number;
  status: AudiobookPlaybackStatus;
  onNext: () => void;
  onPrevious: () => void;
  onPrimaryAction: () => void;
  onStop: () => void;
}

export function AudiobookTransport({
  canRead,
  currentSegmentIndex,
  isBusy,
  primaryActionLabel,
  segmentCount,
  status,
  onNext,
  onPrevious,
  onPrimaryAction,
  onStop,
}: AudiobookTransportProps) {
  return (
    <section className="audiobook-transport" aria-label="听书播放控制">
      <button
        className="secondary-control-button"
        disabled={!canRead || isBusy || currentSegmentIndex === 0}
        type="button"
        onClick={onPrevious}
      >
        上一段
      </button>
      <button
        aria-pressed={status === "playing"}
        className="transport-button audiobook-primary-button"
        disabled={!canRead || isBusy}
        type="button"
        onClick={onPrimaryAction}
      >
        <span className="transport-glyph" aria-hidden="true" />
        <span>{primaryActionLabel}</span>
      </button>
      <button
        className="secondary-control-button"
        disabled={!canRead || isBusy || currentSegmentIndex >= segmentCount - 1}
        type="button"
        onClick={onNext}
      >
        下一段
      </button>
      <button
        className="secondary-control-button stop-control-button"
        disabled={status === "idle"}
        type="button"
        onClick={onStop}
      >
        停止
      </button>
    </section>
  );
}

