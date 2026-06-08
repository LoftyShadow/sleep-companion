# 步骤02-最近配置存储与 hook

## 目标

为睡眠入口增加最近声音配置存储，支持读取、保存、去重、删除和损坏数据降级。

## 涉及文件

- `src/features/sleepSession/sleepSessionTypes.ts`
- `src/features/sleepSession/sleepSessionStore.ts`
- `src/features/sleepSession/useRecentSleepConfigs.ts`
- `src/features/sleepSession/sleepSessionStore.test.ts`

## 实现要点

- 存储路径为 `sleep-session/recent-configs.json`。
- 最近配置最多保留 5 条。
- 配置项保存 `soundId`、`name` 和 `volume`。
- 配置保存是否纳入听书和听视频。
- `durationMinutes` 随配置保存。
- 相同声音 ID 顺序、音量和可选模块视为同一配置。
- 损坏 JSON、非法字段和空配置要安全降级。

## 验收标准

- 空存储返回空列表。
- 保存 6 条后只保留最近 5 条。
- 重复保存同一配置不会生成重复项。
- 听书和听视频开关会参与配置去重。
- 删除指定配置后会持久化剩余配置。
- 损坏存储内容不会让页面崩溃。

## 检查清单

- [x] 已补存储单测。
- [x] 已使用 `FileSystemPort`，没有直接使用浏览器存储。
- [x] 已限制保存数量。
- [x] 已校验音量范围。
- [x] 已让听书和听视频开关参与去重。
