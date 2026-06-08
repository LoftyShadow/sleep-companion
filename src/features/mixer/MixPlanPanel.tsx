import type { CustomSoundPreset } from "../customSoundPresets/customSoundPresetStore";
import type { SoundPreset, SoundPresetGroup } from "../sounds/soundPresets";
import "./MixPlanPanel.css";
import "./MixPlanPanel.mobile.css";

interface MixPlanPanelProps {
  activePresetId: string | null;
  canSaveCurrentPreset: boolean;
  customPresetErrorMessage: string | null;
  customPresetMessage: string | null;
  customPresets: CustomSoundPreset[];
  isLoadingCustomPresets: boolean;
  presetGroups: SoundPresetGroup[];
  onApplyPreset: (preset: SoundPreset) => void;
  onRemoveCustomPreset: (presetId: CustomSoundPreset["id"]) => void;
  onSaveCurrentPreset: () => void;
}

function getPresetCount(presetGroups: readonly SoundPresetGroup[]) {
  return presetGroups.reduce((count, group) => count + group.presets.length, 0);
}

export function MixPlanPanel({
  activePresetId,
  canSaveCurrentPreset,
  customPresetErrorMessage,
  customPresetMessage,
  customPresets,
  isLoadingCustomPresets,
  presetGroups,
  onApplyPreset,
  onRemoveCustomPreset,
  onSaveCurrentPreset,
}: MixPlanPanelProps) {
  const presetCount = getPresetCount(presetGroups);

  return (
    <section className="mix-plan-panel glass-panel" aria-labelledby="mix-plan-heading">
      <div className="section-heading">
        <div>
          <p className="app-kicker">混音方案</p>
          <h2 id="mix-plan-heading">推荐与我的混音</h2>
        </div>
        <span className="section-meta">
          {presetCount + customPresets.length} 个方案
        </span>
      </div>

      <div className="mix-plan-actions">
        <button
          className="mix-plan-save-button"
          disabled={!canSaveCurrentPreset}
          type="button"
          onClick={onSaveCurrentPreset}
        >
          保存当前混音
        </button>
        <span>{customPresets.length} / 12 我的混音</span>
      </div>

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

      <div className="mix-plan-layout">
        <div className="mix-plan-block">
          <div className="mix-plan-block-heading">
            <h3>推荐混音</h3>
            <span>{presetCount} 个</span>
          </div>
          <div className="mix-plan-group-list">
            {presetGroups.map((group) => (
              <section
                aria-labelledby={`mix-plan-group-${group.id}`}
                className="mix-plan-group"
                key={group.id}
              >
                <h4 id={`mix-plan-group-${group.id}`}>{group.name}</h4>
                <div className="mix-plan-list">
                  {group.presets.map((preset) => {
                    const isActive = activePresetId === preset.id;

                    return (
                      <button
                        aria-label={`应用推荐混音${preset.name}`}
                        aria-pressed={isActive}
                        className={`mix-plan-button${
                          isActive ? " mix-plan-button-active" : ""
                        }`}
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onApplyPreset(preset);
                        }}
                      >
                        <span className="mix-plan-topline">
                          <span className="mix-plan-name">{preset.name}</span>
                          <span className="mix-plan-count">
                            {preset.items.length} 声音
                          </span>
                        </span>
                        <span className="mix-plan-description">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mix-plan-block">
          <div className="mix-plan-block-heading">
            <h3>我的混音</h3>
            <span>{customPresets.length} 个</span>
          </div>

          {isLoadingCustomPresets ? (
            <p className="mix-plan-empty" role="status">
              正在读取全局混音
            </p>
          ) : null}
          {!isLoadingCustomPresets && customPresets.length === 0 ? (
            <p className="mix-plan-empty">还没有保存过全局混音。</p>
          ) : null}

          <div className="mix-plan-custom-list">
            {customPresets.map((preset) => (
              <article className="mix-plan-custom-item" key={preset.id}>
                <button
                  aria-label={`应用全局混音${preset.name}`}
                  className="mix-plan-button mix-plan-custom-apply"
                  type="button"
                  onClick={() => {
                    onApplyPreset(preset);
                  }}
                >
                  <span className="mix-plan-topline">
                    <span className="mix-plan-name">{preset.name}</span>
                    <span className="mix-plan-count">
                      {preset.items.length} 声音
                    </span>
                  </span>
                  <span className="mix-plan-description">
                    {preset.description}
                  </span>
                </button>
                <button
                  className="mix-plan-delete-button"
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
        </div>
      </div>
    </section>
  );
}
