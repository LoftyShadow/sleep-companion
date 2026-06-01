import { APP_MODE_OPTIONS, type AppMode } from "./appModeTypes";
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
      {APP_MODE_OPTIONS.map((option) => (
        <button
          aria-pressed={activeMode === option.mode}
          className="app-mode-button"
          key={option.mode}
          type="button"
          onClick={() => {
            onModeChange(option.mode);
          }}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}
