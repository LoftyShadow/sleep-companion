import {
  SOUND_LIBRARY_MODES,
  type SoundLibraryMode,
  type SoundLibraryModeConfig,
} from "./soundLibraryModes";

interface MixerHeaderProps {
  activeSoundMode: SoundLibraryMode;
  activeSummary: string;
  isAnySoundPlaying: boolean;
  modeConfig: SoundLibraryModeConfig;
  onSoundModeChange: (mode: SoundLibraryMode) => void;
}

export function MixerHeader({
  activeSoundMode,
  activeSummary,
  isAnySoundPlaying,
  modeConfig,
  onSoundModeChange,
}: MixerHeaderProps) {
  return (
    <header className="app-header glass-panel" aria-label="播放总览">
      <div className="brand-block">
        <div aria-label="声音模式" className="mode-switch" role="group">
          {SOUND_LIBRARY_MODES.map((mode) => (
            <button
              aria-pressed={activeSoundMode === mode.id}
              className="mode-switch-button"
              key={mode.id}
              type="button"
              onClick={() => {
                onSoundModeChange(mode.id);
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="app-kicker">{modeConfig.kicker}</p>
        <h1>{modeConfig.title}</h1>
        <p className="mix-summary">
          {isAnySoundPlaying ? activeSummary : modeConfig.emptySummary}
        </p>
      </div>
    </header>
  );
}

