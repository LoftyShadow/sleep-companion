import type { SoundPreset, SoundPresetGroup } from "../sounds/soundPresets";
import type { XmsleepSoundCategory } from "../sounds/xmsleepSoundCatalog";
import { PresetGroups } from "./PresetGroups";
import { SoundCategoryFilter } from "./SoundCategoryFilter";
import type { SoundLibraryModeConfig } from "./soundLibraryModes";
import "./SoundLibrarySidebar.css";

interface SoundLibrarySidebarProps {
  activeCategoryId: string;
  activePresetId?: string | null;
  categoryHeadingId: string;
  categoryLabel: string;
  categories: XmsleepSoundCategory[];
  modeConfig: SoundLibraryModeConfig;
  presetCount?: number;
  presetGroups?: SoundPresetGroup[];
  soundCountsByCategory: Map<string, number>;
  totalSoundCount: number;
  onApplyPreset?: (preset: SoundPreset) => void;
  onCategoryChange: (categoryId: string) => void;
}

export function SoundLibrarySidebar({
  activeCategoryId,
  activePresetId,
  categoryHeadingId,
  categoryLabel,
  categories,
  modeConfig,
  presetCount,
  presetGroups,
  soundCountsByCategory,
  totalSoundCount,
  onApplyPreset,
  onCategoryChange,
}: SoundLibrarySidebarProps) {
  const shouldShowPresets =
    presetGroups !== undefined &&
    presetGroups.length > 0 &&
    presetCount !== undefined &&
    onApplyPreset !== undefined;
  const shouldShowCategories = categories.length > 0;

  return (
    <aside className="sound-library-sidebar" aria-label="声音库控制">
      {shouldShowPresets ? (
        <PresetGroups
          activePresetId={activePresetId ?? null}
          modeConfig={modeConfig}
          presetCount={presetCount}
          presetGroups={presetGroups}
          onApplyPreset={onApplyPreset}
        />
      ) : null}

      {shouldShowCategories ? (
        <SoundCategoryFilter
          activeCategoryId={activeCategoryId}
          categories={categories}
          headingId={categoryHeadingId}
          label={categoryLabel}
          soundCountsByCategory={soundCountsByCategory}
          totalSoundCount={totalSoundCount}
          onCategoryChange={onCategoryChange}
        />
      ) : null}
    </aside>
  );
}
