import type { CustomSoundPreset } from "../customSoundPresets/customSoundPresetStore";
import "./CustomPresetPanel.css";
import "./CustomPresetPanel.mobile.css";

interface CustomPresetPanelProps {
  canSaveCurrentPreset: boolean;
  customPresetErrorMessage: string | null;
  customPresetMessage: string | null;
  customPresets: CustomSoundPreset[];
  isLoadingCustomPresets: boolean;
  onApplyPreset: (preset: CustomSoundPreset) => void;
  onRemoveCustomPreset: (presetId: CustomSoundPreset["id"]) => void;
  onSaveCurrentPreset: () => void;
}

export function CustomPresetPanel({
  canSaveCurrentPreset,
  customPresetErrorMessage,
  customPresetMessage,
  customPresets,
  isLoadingCustomPresets,
  onApplyPreset,
  onRemoveCustomPreset,
  onSaveCurrentPreset,
}: CustomPresetPanelProps) {
  return (
    <section
      className="custom-preset-panel glass-panel"
      aria-labelledby="custom-preset-heading"
    >
      <div className="section-heading">
        <div>
          <p className="app-kicker">用户配置</p>
          <h2 id="custom-preset-heading">我的配置</h2>
        </div>
        <span className="section-meta">{customPresets.length} / 12</span>
      </div>

      <button
        className="custom-preset-save-button"
        disabled={!canSaveCurrentPreset}
        type="button"
        onClick={onSaveCurrentPreset}
      >
        保存当前配置
      </button>

      {customPresetErrorMessage ? (
        <p className="error-message" role="alert">
          {customPresetErrorMessage}
        </p>
      ) : null}
      {customPresetMessage ? (
        <p className="custom-audio-status" role="status">
          {customPresetMessage}
        </p>
      ) : null}

      {isLoadingCustomPresets ? (
        <p className="custom-preset-empty" role="status">
          正在读取自定义配置
        </p>
      ) : null}
      {!isLoadingCustomPresets && customPresets.length === 0 ? (
        <p className="custom-preset-empty">还没有自定义配置。</p>
      ) : null}

      <div className="custom-preset-list">
        {customPresets.map((preset) => (
          <article className="custom-preset-item" key={preset.id}>
            <button
              aria-label={`应用配置${preset.name}`}
              className="custom-preset-apply-button"
              type="button"
              onClick={() => {
                onApplyPreset(preset);
              }}
            >
              <span className="custom-preset-topline">
                <span className="custom-preset-name">{preset.name}</span>
                <span className="custom-preset-count">
                  {preset.items.length} 声音
                </span>
              </span>
              <span className="custom-preset-description">
                {preset.description}
              </span>
            </button>
            <button
              className="custom-preset-delete-button"
              type="button"
              onClick={() => {
                onRemoveCustomPreset(preset.id);
              }}
            >
              删除
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
