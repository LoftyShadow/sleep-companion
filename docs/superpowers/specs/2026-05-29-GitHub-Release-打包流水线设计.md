# GitHub Release 打包流水线设计

## 背景

项目需要把同一份源码按版本构建成多个平台安装包，并统一挂到 GitHub Release 中。当前第一阶段目标是内测分发，不处理 macOS、代码签名、Android 正式上架签名和自动更新。

## 目标

- 推送 `v*` tag 时自动构建发布产物。
- 支持手动 `workflow_dispatch` 触发。
- Linux 和 Windows 桌面端使用 Tauri 官方 release action 构建并上传到同一个草稿 Release。
- Android 使用单独 job 构建 APK，并上传到同一个草稿 Release。
- Release 默认保持 draft，避免未经试装的产物直接公开。

## 非目标

- 不构建 macOS 产物，后续有 macOS runner、签名和 notarization 策略后再补。
- 不配置 Windows 代码签名。
- 不配置 Android release keystore、AAB 或 Google Play 发布。
- 不启用 Tauri 自动更新。
- 不改变应用运行逻辑、版本号或 Tauri 配置。

## 流水线结构

新增 `.github/workflows/release.yml`：

- 触发条件：
  - `push` 到 `v*` tag。
  - 手动 `workflow_dispatch`，必须输入要创建或更新的 Release tag。
- 检出策略：
  - 所有 job 都检出 `RELEASE_TAG` 对应的代码。
  - 手动触发前必须先创建并推送该 tag，避免用默认分支代码覆盖某个版本 Release。
- 权限：
  - `contents: write`，用于创建或更新 GitHub Release 并上传产物。
- 并发控制：
  - 同一个 `RELEASE_TAG` 只允许一个发布流水线运行，避免重复上传同一批产物。
- `build-desktop` job：
  - matrix 包含 `ubuntu-22.04` 和 `windows-latest`。
  - matrix 设置为串行执行，避免两个桌面端 job 同时创建或更新同一个草稿 Release。
  - Linux runner 安装 WebKit、AppIndicator、SVG 和 `patchelf` 打包依赖。
  - 安装 pnpm、Node.js 22、Rust stable 和 Rust cache。
  - 先执行 `pnpm run check`。
  - 使用 `tauri-apps/tauri-action@v0` 构建并上传桌面端安装包。
- `build-android` job：
  - 运行在 `ubuntu-22.04`。
  - 等 `build-desktop` 完成后再上传 APK，减少多个 job 同时创建同一草稿 Release 的竞态。
  - 安装 pnpm、Node.js 22、JDK 17、Android SDK、Android NDK、Rust stable 和 `aarch64-linux-android` target。
  - 同时写入 `NDK_HOME` 和 `ANDROID_NDK_HOME`，兼容 Tauri、Gradle 和 Rust Android 构建链的不同读取习惯。
  - 构建命令为 `pnpm tauri android build -- --apk --target aarch64 --ci`。
  - 使用 `softprops/action-gh-release@v2` 把 APK 上传到同一个草稿 Release。

## Android 构建取舍

第一版 CI 只构建 `aarch64` APK。原因：

- 当前优先目标是 Android 前台真机内测，主流真机覆盖 `arm64-v8a`。
- 全 ABI 会增加 Rust target、NDK 构建时间和 CI 失败面。
- AAB 和正式签名属于后续正式分发阶段。

后续如需扩大兼容范围，可以改为：

```bash
pnpm tauri android build -- --apk --ci
```

或增加：

```bash
pnpm tauri android build -- --aab --ci
```

## 发布流程

发版前先确认版本号一致：

- `package.json` 的 `version`。
- `src-tauri/tauri.conf.json` 的 `version`。
- Git tag，例如 `v0.1.0`。

推荐命令：

```bash
rtk pnpm run check
rtk git tag v0.1.0
rtk git push origin v0.1.0
```

如果使用 GitHub 页面手动触发 workflow，`release_tag` 必须填写已经存在的 tag。

流水线完成后进入 GitHub Release 草稿，下载每个平台产物完成试装，再手动发布。

## 验收标准

- workflow YAML 语法可解析。
- 本地 `rtk pnpm run check` 继续通过。
- 本地 `rtk git diff --check` 通过。
- 不引入应用运行时代码改动。
