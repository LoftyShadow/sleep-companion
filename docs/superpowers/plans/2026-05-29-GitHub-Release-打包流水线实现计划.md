# GitHub Release 打包流水线实现计划

## 目标

新增 GitHub Actions 发布流水线，让 `v*` tag 可以自动打 Linux、Windows 和 Android APK 内测包，并上传到同一个 GitHub Release 草稿。

## 执行步骤

- [x] 新增 release workflow，配置 tag 和手动触发。
- [x] 配置桌面端 matrix，覆盖 Linux 和 Windows。
- [x] 配置 Linux runner 所需 Tauri 打包依赖。
- [x] 配置 Android APK job，第一版只打 `aarch64` APK。
- [x] 配置手动触发时显式输入 Release tag。
- [x] 手动触发和 tag 触发都检出对应 tag。
- [x] 配置 Android SDK 和 NDK 安装步骤。
- [x] 同时设置 `NDK_HOME` 和 `ANDROID_NDK_HOME`。
- [x] 配置同 tag 发布并发控制。
- [x] 桌面端 matrix 串行上传 Release 产物。
- [x] Android job 等桌面端 Release 创建完成后再上传 APK。
- [x] 桌面端使用 `tauri-apps/tauri-action@v0` 上传草稿 Release。
- [x] Android 使用 `softprops/action-gh-release@v2` 上传 APK。
- [x] 运行本地质量门禁和 workflow 静态校验。
- [x] Android Release APK 增加内测签名和 `apksigner verify` 验证。
- [x] 上传 Android APK 前清理草稿 Release 中遗留的 `*-unsigned.apk`。

## 影响文件

- 新增 `.github/workflows/release.yml`。
- 新增 `docs/superpowers/specs/2026-05-29-GitHub-Release-打包流水线设计.md`。
- 新增 `docs/superpowers/plans/2026-05-29-GitHub-Release-打包流水线实现计划.md`。

## 验收命令

```bash
rtk pnpm run check
rtk git diff --check
```

如本机存在可用 YAML 工具，可额外解析 `.github/workflows/release.yml`。

## 风险和约束

- macOS 后续再做。
- Android 第一版 CI 只产出 `aarch64` APK，不产出 AAB。
- 未配置固定 GitHub Secrets 时，CI 会使用临时内测签名；这种包可以安装，但后续版本可能无法覆盖升级，需要先卸载旧包。
- 如需稳定内测升级，需要配置 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`，必要时配置 `ANDROID_KEY_PASSWORD`。
- 首次 tag 触发后需要查看 GitHub Actions 实际输出，必要时收紧 Android APK 的上传路径。
