import {
  type SoundLibraryFilterId,
  type SoundLibraryFilterOption,
} from "./soundLibraryModes";
import "./MixerHeader.css";
import "./MixerHeader.mobile.css";

interface MixerHeaderProps {
  activeFilterId: SoundLibraryFilterId;
  filters: SoundLibraryFilterOption[];
  onFilterChange: (filterId: SoundLibraryFilterId) => void;
}

export function MixerHeader({
  activeFilterId,
  filters,
  onFilterChange,
}: MixerHeaderProps) {
  const activeFilterLabel = filters.find((filter) => filter.id === activeFilterId)
    ?.label ?? "全部";

  return (
    <header className="mixer-filter-panel" aria-labelledby="sound-filter-heading">
      <div className="mixer-filter-heading">
        <h3 className="mixer-filter-title" id="sound-filter-heading">
          声音标签
        </h3>
        <span className="mixer-filter-active">{activeFilterLabel}</span>
      </div>
      <div aria-label="声音标签" className="sound-filter-list" role="group">
        {filters.map((filter) => (
          <button
            aria-label={filter.label}
            aria-pressed={activeFilterId === filter.id}
            className="sound-filter-button"
            key={filter.id}
            type="button"
            onClick={() => {
              onFilterChange(filter.id);
            }}
          >
            <span>{filter.label}</span>
            <strong aria-hidden="true">{filter.count}</strong>
          </button>
        ))}
      </div>
    </header>
  );
}
