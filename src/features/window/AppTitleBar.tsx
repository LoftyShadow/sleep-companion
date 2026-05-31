import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import "./AppTitleBar.css";

type DesktopPlatform = "linux" | "macos" | "windows";
type MobilePlatform = "android" | "ios";

interface WindowControls {
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  minimize: () => Promise<void>;
  startDragging: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
}

interface DesktopRuntime {
  kind: "desktop";
  controls: WindowControls;
}

interface MobileRuntime {
  kind: "mobile";
}

type WindowRuntime = DesktopRuntime | MobileRuntime;

function isDesktopPlatform(platform: string): platform is DesktopPlatform {
  return platform === "linux" || platform === "macos" || platform === "windows";
}

function isMobilePlatform(platform: string): platform is MobilePlatform {
  return platform === "android" || platform === "ios";
}

function runWindowCommand(command: () => Promise<void>) {
  void command().catch(() => undefined);
}

async function loadWindowRuntime(): Promise<WindowRuntime | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  const { platform } = await import("@tauri-apps/plugin-os");
  const currentPlatform = platform();

  if (!isDesktopPlatform(currentPlatform)) {
    if (isMobilePlatform(currentPlatform)) {
      return {
        kind: "mobile",
      };
    }

    return null;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");

  return {
    kind: "desktop",
    controls: getCurrentWindow(),
  };
}

export function AppTitleBar() {
  const [runtime, setRuntime] = useState<WindowRuntime | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadWindowRuntime()
      .then(async (nextRuntime) => {
        if (!isMounted) {
          return;
        }
        setRuntime(nextRuntime);
        if (nextRuntime?.kind === "desktop") {
          setIsMaximized(await nextRuntime.controls.isMaximized());
        }
      })
      .catch(() => {
        if (isMounted) {
          setRuntime(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "has-desktop-title-bar",
      runtime?.kind === "desktop",
    );
    document.documentElement.classList.toggle(
      "has-mobile-safe-area",
      runtime?.kind === "mobile",
    );

    return () => {
      document.documentElement.classList.remove("has-desktop-title-bar");
      document.documentElement.classList.remove("has-mobile-safe-area");
    };
  }, [runtime]);

  const handleDragStart = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 0 || event.detail > 1) {
        return;
      }

      if (runtime?.kind === "desktop") {
        runWindowCommand(() => runtime.controls.startDragging());
      }
    },
    [runtime],
  );

  const handleMinimize = useCallback(() => {
    if (runtime?.kind === "desktop") {
      runWindowCommand(() => runtime.controls.minimize());
    }
  }, [runtime]);

  const handleToggleMaximize = useCallback(() => {
    if (runtime?.kind !== "desktop") {
      return;
    }

    runWindowCommand(async () => {
      await runtime.controls.toggleMaximize();
      setIsMaximized(await runtime.controls.isMaximized());
    });
  }, [runtime]);

  const handleClose = useCallback(() => {
    if (runtime?.kind === "desktop") {
      runWindowCommand(() => runtime.controls.close());
    }
  }, [runtime]);

  if (runtime?.kind !== "desktop") {
    return null;
  }

  return (
    <header
      className="app-title-bar"
      data-tauri-drag-region
      onMouseDown={handleDragStart}
      onDoubleClick={handleToggleMaximize}
      aria-label="桌面窗口栏"
    >
      <div className="app-title-bar__brand" aria-hidden="true">
        <span className="app-title-bar__mark">S</span>
        <span className="app-title-bar__name">Sleep Companion</span>
      </div>

      <div
        className="app-title-bar__controls"
        onDoubleClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="app-title-bar__control"
          type="button"
          aria-label="最小化窗口"
          title="最小化"
          onClick={handleMinimize}
        >
          <span className="app-title-bar__icon app-title-bar__icon--minimize" aria-hidden="true" />
        </button>
        <button
          className="app-title-bar__control"
          type="button"
          aria-label={isMaximized ? "还原窗口" : "最大化窗口"}
          title={isMaximized ? "还原" : "最大化"}
          aria-pressed={isMaximized}
          onClick={handleToggleMaximize}
        >
          <span
            className={
              isMaximized
                ? "app-title-bar__icon app-title-bar__icon--restore"
                : "app-title-bar__icon app-title-bar__icon--maximize"
            }
            aria-hidden="true"
          />
        </button>
        <button
          className="app-title-bar__control app-title-bar__control--close"
          type="button"
          aria-label="关闭窗口"
          title="关闭"
          onClick={handleClose}
        >
          <span className="app-title-bar__icon app-title-bar__icon--close" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
