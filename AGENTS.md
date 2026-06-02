# AGENTS.md

本文件是本仓库的 AI 协作约束。任何 agent 在本项目内工作时必须优先遵守本文件；如果上层系统、用户消息和本文件冲突，以用户当前明确指令为准。

## 沟通规则

- 默认用中文回复用户。
- 用户使用英文时，如果英文表达有错误，在回复末尾补充英文纠正。
- 用户使用中文时，在回复末尾补充英文翻译。
- 不要在未验证的情况下声称代码已完成、测试已通过或构建成功。
- 如果某项验证因为本机环境缺失无法运行，要明确说明缺失内容和剩余风险。

## 文档语言

- 仓库内所有文档正文必须使用中文，包括 README、设计文档、计划文档、检查清单、交付说明和后续新增的 Markdown 文档。
- 代码标识符、命令、文件路径、包名、API 名称、测试用例名称、错误原文和外部协议名称可以保留英文，以保证工程表达精确。
- 如果引用英文资料，正文必须用中文总结，不要整段复制英文。
- 如果发现已有文档正文使用英文，先改成中文再继续基于该文档实施。

## Shell 命令

运行 shell 命令时使用仓库和工具链的原生命令。需要压缩或过滤输出时，可以选择合适的本地工具，但不能隐藏影响判断的失败信息。

常用命令：

```bash
pnpm run check
pnpm run lint
pnpm run test
pnpm run test:all
pnpm run build
pnpm run check:rust
git status --short --branch
git diff
```

## 项目技术栈

- 前端：React 19、TypeScript、Vite 7、Tailwind CSS v4。
- 桌面壳：Tauri 2。
- Rust 后端：`src-tauri`。
- 包管理器：pnpm 11。
- 测试：Vitest、Testing Library、Rust `cargo test`。
- 检查：ESLint v9 flat config、`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`。

## 必跑验证

涉及代码、测试、依赖、构建、Tauri 配置、Rust、Android 或运行时行为的改动，必须运行：

```bash
pnpm run check
```

这是本仓库主要本地质量门禁，覆盖：

- `eslint .`
- `cargo fmt --check`
- `cargo clippy --all-targets -- -D warnings`
- Vitest
- Rust 测试
- TypeScript 编译
- Vite 构建

如果需要 Android SDK、`adb` 或移动端工具链，但当前环境没有配置，必须明确写出缺失工具或环境变量。除非实际运行过，不得声称 Android 真机验证通过。

纯文档改动至少运行：

```bash
git diff --check
```

交付前还要扫描新增计划文档，确认没有未处理的占位标记。

## 开发流程

新功能、跨平台改动、架构改动或多步骤任务必须按结构化流程推进：

1. 实现前先澄清需求和边界。
2. 在 `docs/plan/` 下写入或更新设计文档。
3. 在 `docs/plan/` 下写入或更新执行计划。
4. 尽量按 TDD 小步实现。
5. 实现必须对齐文档；如果实现中发现文档不合理，先更新文档再继续编码。
6. 完成后运行 `pnpm run check`。

不要静默实现文档没有要求的额外能力。确实需要新增能力时，先说明原因并更新计划。

## 跨平台音频方向

第一版内置播放必须支持：

- Web。
- Linux 桌面端。
- Windows 桌面端。
- Android 前台真机播放。

跨平台用户可见行为必须一致：

- 17 个内置声音。
- 每个声音可播放和暂停。
- 循环播放。
- 多个声音可同时播放。
- 每个声音可单独调音量。
- 可一键停止全部声音。

平台架构：

- Web、Linux、Windows 使用 WebAudio/HTMLAudio 适配器，音频文件放在 `public/audio/`。
- Android 使用 Tauri 移动端桥接和 Kotlin 原生播放，第一版底层使用 `MediaPlayer`。
- Android 后台/锁屏播放不属于第一版，但接口设计不能阻碍未来接入前台服务或 Media3/ExoPlayer。
- UI 代码只能依赖 `PlayerPort` 抽象，不能直接依赖平台播放器实现。

参考项目：

```text
/home/niemingzhi/IdeaProjects/XMSLEEP
```

参考项目用于确认声音选择和 Android 播放行为，不要把它的大型 Android 架构整体复制进本项目。

## Git 和 GitHub

- 未经用户明确要求，不要创建 commit。
- commit 前必须查看 `git status --short --branch` 和相关 diff。
- 只 stage 本次任务相关文件。
- 提交信息使用本仓库既有中文 conventional 格式。
- 未经用户明确要求 push 或同步 GitHub，不要推送。
