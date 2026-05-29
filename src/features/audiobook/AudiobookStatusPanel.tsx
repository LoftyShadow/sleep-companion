import type { AudiobookPlaybackStatus } from "./audiobookTypes";

const STATUS_LABELS: Record<AudiobookPlaybackStatus, string> = {
  idle: "待机",
  loading: "准备朗读",
  playing: "朗读中",
  paused: "已暂停",
  ended: "已结束",
  error: "需要处理",
};

interface AudiobookStatusPanelProps {
  currentSegmentIndex: number;
  segmentCount: number;
  status: AudiobookPlaybackStatus;
}

export function AudiobookStatusPanel({
  currentSegmentIndex,
  segmentCount,
  status,
}: AudiobookStatusPanelProps) {
  return (
    <section className="audiobook-status-panel" aria-label="朗读状态">
      <div>
        <p className="player-label">当前状态</p>
        <p className="player-title">{STATUS_LABELS[status]}</p>
      </div>
      <span className="transport-status">
        {segmentCount > 0 ? `${currentSegmentIndex + 1} / ${segmentCount}` : "0 / 0"}
      </span>
    </section>
  );
}

