import {
  SOUND_LIBRARY_MODES,
  type SoundLibraryMode,
  type SoundLibraryModeConfig,
} from "./soundLibraryModes";
import "./MixerHeader.css";

interface MixerHeaderProps {
  activeSoundMode: SoundLibraryMode;
  modeConfig: SoundLibraryModeConfig;
  onSoundModeChange: (mode: SoundLibraryMode) => void;
}

export function MixerHeader({
  activeSoundMode,
  modeConfig,
  onSoundModeChange,
}: MixerHeaderProps) {
  return (
    <header className="mixer-mode-panel glass-panel" aria-label="声音模式">
      <h1 className="mixer-mode-title">{modeConfig.title}</h1>
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
    </header>
  );
}
