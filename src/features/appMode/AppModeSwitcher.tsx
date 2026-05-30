import type { AppMode } from "./appModeTypes";
import "./AppModeSwitcher.css";

interface AppModeSwitcherProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function AppModeSwitcher({
  activeMode,
  onModeChange,
}: AppModeSwitcherProps) {
  return (
    <nav className="app-mode-nav" aria-label="应用模式">
      <button
        aria-pressed={activeMode === "mixer"}
        className="app-mode-button"
        type="button"
        onClick={() => {
          onModeChange("mixer");
        }}
      >
        声音
      </button>
      <button
        aria-pressed={activeMode === "audiobook"}
        className="app-mode-button"
        type="button"
        onClick={() => {
          onModeChange("audiobook");
        }}
      >
        听书
      </button>
      <button
        aria-pressed={activeMode === "video"}
        className="app-mode-button"
        type="button"
        onClick={() => {
          onModeChange("video");
        }}
      >
        听视频
      </button>
    </nav>
  );
}
