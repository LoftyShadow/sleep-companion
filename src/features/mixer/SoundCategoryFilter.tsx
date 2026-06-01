import type { XmsleepSoundCategory } from "../sounds/xmsleepSoundCatalog";
import "./SoundCategoryFilter.css";
import "./SoundCategoryFilter.mobile.css";

interface SoundCategoryFilterProps {
  activeCategoryId: string;
  categories: XmsleepSoundCategory[];
  headingId: string;
  label: string;
  soundCountsByCategory: Map<string, number>;
  totalSoundCount: number;
  onCategoryChange: (categoryId: string) => void;
}

export function SoundCategoryFilter({
  activeCategoryId,
  categories,
  headingId,
  label,
  soundCountsByCategory,
  totalSoundCount,
  onCategoryChange,
}: SoundCategoryFilterProps) {
  return (
    <section
      className="sound-category-section glass-panel"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <div>
          <p className="app-kicker">分类浏览</p>
          <h2 id={headingId}>声音分类</h2>
        </div>
        <span className="section-meta">{totalSoundCount} 个声音</span>
      </div>

      <div className="sound-category-list" role="group" aria-label={label}>
        <button
          aria-pressed={activeCategoryId === "all"}
          className="sound-category-button"
          type="button"
          onClick={() => {
            onCategoryChange("all");
          }}
        >
          <span>全部</span>
          <strong>{totalSoundCount}</strong>
        </button>

        {categories.map((category) => (
          <button
            aria-pressed={activeCategoryId === category.id}
            className="sound-category-button"
            key={category.id}
            type="button"
            onClick={() => {
              onCategoryChange(category.id);
            }}
          >
            <span>{category.name}</span>
            <strong>{soundCountsByCategory.get(category.id) ?? 0}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
