import "./PlayerSummary.css";
import "./PlayerSummary.mobile.css";
import { PlaybackGlyph } from "../shared/PlaybackGlyph";

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
      <div className="player-copy">
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
          <PlaybackGlyph isPlaying={isAnySoundPlaying} />
          <span>{transportLabel}</span>
        </button>
      </div>
    </aside>
  );
}
