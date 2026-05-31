import {
  SOUND_LIBRARY_MODES,
  type SoundLibraryMode,
  type SoundLibraryModeConfig,
} from "./soundLibraryModes";
import "./MixerHeader.css";

interface MixerHeaderProps {
  activeSoundMode: SoundLibraryMode;
  activeSummary: string;
  isAnySoundPlaying: boolean;
  modeConfig: SoundLibraryModeConfig;
  playingSoundCount: number;
  presetCount: number;
  visibleSoundCount: number;
  onSoundModeChange: (mode: SoundLibraryMode) => void;
}

export function MixerHeader({
  activeSoundMode,
  activeSummary,
  isAnySoundPlaying,
  modeConfig,
  playingSoundCount,
  presetCount,
  visibleSoundCount,
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

      <div className="mixer-flow" aria-label="声音工作流程">
        <div className="mixer-flow-step">
          <span>01</span>
          <strong>选场景</strong>
          <p>白噪音和 ASMR 分开管理</p>
        </div>
        <div className="mixer-flow-step">
          <span>02</span>
          <strong>一键开始</strong>
          <p>{presetCount} 个预设可直接播放</p>
        </div>
        <div className="mixer-flow-step">
          <span>03</span>
          <strong>细调声音</strong>
          <p>{visibleSoundCount} 个声音可单独控制</p>
        </div>
      </div>

      <div className="mixer-status-strip" aria-label="当前声音状态">
        <span>{playingSoundCount} 个播放中</span>
        <span>{visibleSoundCount} 个可用声音</span>
        <span>{presetCount} 个组合</span>
      </div>
    </header>
  );
}

