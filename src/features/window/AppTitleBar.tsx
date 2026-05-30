import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import "./AppTitleBar.css";

type DesktopPlatform = "linux" | "macos" | "windows";

interface WindowControls {
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  minimize: () => Promise<void>;
  startDragging: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
}

interface DesktopRuntime {
  controls: WindowControls;
}

function isDesktopPlatform(platform: string): platform is DesktopPlatform {
  return platform === "linux" || platform === "macos" || platform === "windows";
}

function runWindowCommand(command: () => Promise<void>) {
  void command().catch(() => undefined);
}

async function loadDesktopRuntime(): Promise<DesktopRuntime | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  const [{ platform }, { getCurrentWindow }] = await Promise.all([
    import("@tauri-apps/plugin-os"),
    import("@tauri-apps/api/window"),
  ]);
  const currentPlatform = platform();

  if (!isDesktopPlatform(currentPlatform)) {
    return null;
  }

  return {
    controls: getCurrentWindow(),
  };
}

export function AppTitleBar() {
  const [runtime, setRuntime] = useState<DesktopRuntime | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadDesktopRuntime()
      .then(async (nextRuntime) => {
        if (!isMounted) {
          return;
        }
        setRuntime(nextRuntime);
        if (nextRuntime) {
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
      runtime !== null,
    );

    return () => {
      document.documentElement.classList.remove("has-desktop-title-bar");
    };
  }, [runtime]);

  const handleDragStart = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 0 || event.detail > 1) {
        return;
      }

      if (runtime) {
        runWindowCommand(() => runtime.controls.startDragging());
      }
    },
    [runtime],
  );

  const handleMinimize = useCallback(() => {
    if (runtime) {
      runWindowCommand(() => runtime.controls.minimize());
    }
  }, [runtime]);

  const handleToggleMaximize = useCallback(() => {
    if (!runtime) {
      return;
    }

    runWindowCommand(async () => {
      await runtime.controls.toggleMaximize();
      setIsMaximized(await runtime.controls.isMaximized());
    });
  }, [runtime]);

  const handleClose = useCallback(() => {
    if (runtime) {
      runWindowCommand(() => runtime.controls.close());
    }
  }, [runtime]);

  if (!runtime) {
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
