# Sleep Companion

Sleep Companion 是一个基于 Tauri、React 和 TypeScript 的睡眠声音助手。

第一版目标是提供跨平台内置声音播放能力，覆盖 Web、Linux、Windows 和 Android 前台运行场景。当前内置 17 个声音，并提供场景预设混音。

## 技术栈

- 前端：React、TypeScript、Vite、Tailwind CSS。
- 桌面壳：Tauri 2。
- 移动端：Tauri Android 目标和 Android 原生播放器。
- 测试：Vitest、Testing Library、Rust `cargo test`。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm run check
```

按平台启动开发环境：

```bash
pnpm run dev:web
pnpm run dev:linux
pnpm run dev:windows
pnpm run dev:android
```

按平台构建产物：

```bash
pnpm run build:web
pnpm run build:linux
pnpm run build:windows
pnpm run build:android
```

`dev:android` 和 `build:android` 需要本机配置 Android SDK，并连接 Android 设备或启动模拟器。`dev:linux`、`build:linux`、`dev:windows` 和 `build:windows` 都使用 Tauri CLI，实际能构建的平台取决于当前宿主系统和工具链配置。

在 agent 执行命令时，本仓库要求优先使用 `rtk` 包装，例如：

```bash
rtk pnpm run check
```
