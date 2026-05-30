import "./PlayerSummary.css";

interface PlayerSummaryProps {
  activeSummary: string;
  isAnySoundPlaying: boolean;
  playingSoundCount: number;
  transportLabel: string;
  visibleSoundCount: number;
  onUnifiedPlayback: () => void;
}

export function PlayerSummary({
  activeSummary,
  isAnySoundPlaying,
  playingSoundCount,
  transportLabel,
  visibleSoundCount,
  onUnifiedPlayback,
}: PlayerSummaryProps) {
  return (
    <aside className="player-card glass-panel" aria-label="播放控制">
      <div>
        <p className="player-label">当前播放</p>
        <p className="player-title">{activeSummary}</p>
      </div>
      <div className="player-actions">
        <span className="transport-status">
          {playingSoundCount} / {visibleSoundCount}
        </span>
        <button
          aria-label={transportLabel}
          aria-pressed={isAnySoundPlaying}
          className="transport-button"
          type="button"
          onClick={onUnifiedPlayback}
        >
          <span className="transport-glyph" aria-hidden="true" />
          <span>{transportLabel}</span>
        </button>
      </div>
    </aside>
  );
}

