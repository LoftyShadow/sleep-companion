# 步骤03：B 站 UP 主刷新等待与重试反馈

## 目标

让 UP 主公开视频刷新在慢网络下有明确反馈，并在失败后保留可重试路径。

## 涉及文件

- `src/features/videoListening/useBilibiliCreators.ts`
- `src/features/videoListening/BilibiliCreatorPanel.tsx`
- `src/features/videoListening/VideoListeningView.css`
- 相关测试文件

## 待办拆分

- [ ] 在刷新 hook 中记录慢请求状态。
- [ ] 请求超过阈值后显示“仍在请求 B 站”的状态文案。
- [ ] 成功或失败后清理慢请求状态。
- [ ] 失败后刷新按钮恢复可点击。
- [ ] 测试使用 fake timers 覆盖慢请求状态。
- [ ] 保留分页 `page/pageSize` 行为。

## 实现要点

- 刷新开始后显示当前页请求状态。
- 请求超过慢请求阈值后显示“仍在请求 B 站”的提示。
- 失败后保留刷新按钮可重试，并显示用户可理解的错误。
- 不引入 Abort 取消协议，避免扩大 Tauri/Rust 接口范围。
- 慢请求阈值先使用 5000ms，兼顾真实网络和测试稳定性。

## 验收标准

- 测试可控制慢请求计时并看到慢请求提示。
- 成功后慢请求提示消失。
- 失败后可再次点击刷新。
- 分页请求仍使用 `page` 和 `pageSize`。

## 验证命令

```bash
rtk pnpm exec vitest run src/features/videoListening/BilibiliCreatorPanel.test.tsx src/features/videoListening/useBilibiliCreators.test.tsx
rtk pnpm exec tsc --noEmit
```

如果没有独立 hook 测试文件，只运行当前已有覆盖该 hook 的最近测试，并在最终说明里写明。

## 提交边界

提交 UP 主面板、UP 主 hook、听视频样式和相关测试。不要提交声音页、听书或睡眠页改动。

## 回滚点

如果 fake timer 测试不稳定，保留用户可见状态改动，先把计时逻辑拆小后再提交。

## 检查清单

- [ ] 目标测试覆盖慢请求提示。
- [ ] 不改变 loader 返回结构。
- [ ] 不吞掉原始错误提示。
- [ ] 不新增外部请求能力。
