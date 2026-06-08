# 步骤05：Android 资源缓存优化

## 目标

为 Android `NativeAudioPlayer` 增加 raw 资源 ID 缓存，避免同一资源名重复动态查找。

## 涉及文件

- `src-tauri/gen/android/app/src/main/java/com/niemingzhi/sleepcompanion/audio/NativeAudioPlayer.kt`

本步骤仅修改 Kotlin 原生播放器实现；`src/features/player/androidNativePlayer.ts` 和 `src/features/player/androidNativePlayer.test.ts` 作为接口语义对照，未做代码修改。

## 输入输出

- 输入：前端传入的 `resourceName`。
- 输出：原生播放器仍按相同 raw 资源播放，缺失资源仍返回明确错误。

## 验收标准

- 同一个 `resourceName` 第一次解析后复用资源 ID。
- `play`、`pause`、`setVolume`、`stopAll` 命令语义不变。
- Android 真机验证不在本步骤内，最终说明必须明确。

## 检查清单

- [x] 不改变插件命令名。
- [x] 不改变 JS 侧参数结构。
- [x] 缓存不保存无效资源 ID。
- [x] 运行仓库质量门禁，最终已通过 `rtk pnpm run check`。
