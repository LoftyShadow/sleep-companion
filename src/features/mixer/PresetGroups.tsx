import type { SoundPreset, SoundPresetGroup } from "../sounds/soundPresets";
import type { SoundLibraryModeConfig } from "./soundLibraryModes";
import "./PresetGroups.css";
import "./PresetGroups.mobile.css";

interface PresetGroupsProps {
  activePresetId: string | null;
  modeConfig: SoundLibraryModeConfig;
  presetCount: number;
  presetGroups: SoundPresetGroup[];
  onApplyPreset: (preset: SoundPreset) => void;
}

export function PresetGroups({
  activePresetId,
  modeConfig,
  presetCount,
  presetGroups,
  onApplyPreset,
}: PresetGroupsProps) {
  return (
    <section
      className="preset-section glass-panel"
      aria-labelledby="preset-heading"
    >
      <div className="section-heading">
        <div>
          <p className="app-kicker">{modeConfig.presetKicker}</p>
          <h2 id="preset-heading">{modeConfig.presetHeading}</h2>
        </div>
        <span className="section-meta">{presetCount} 个组合</span>
      </div>

      <div className="preset-groups">
        {presetGroups.map((group) => (
          <section
            aria-labelledby={`preset-group-${group.id}`}
            className="preset-group"
            key={group.id}
          >
            <h3 id={`preset-group-${group.id}`}>{group.name}</h3>
            <div className="preset-list">
              {group.presets.map((preset) => {
                const isActive = activePresetId === preset.id;

                return (
                  <button
                    aria-label={`应用预设${preset.name}`}
                    aria-pressed={isActive}
                    className={`preset-button${
                      isActive ? " preset-button-active" : ""
                    }`}
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onApplyPreset(preset);
                    }}
                  >
                    <span className="preset-topline">
                      <span className="preset-name">{preset.name}</span>
                      <span className="preset-count">
                        {preset.items.length} 声音
                      </span>
                    </span>
                    <span className="preset-description">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
