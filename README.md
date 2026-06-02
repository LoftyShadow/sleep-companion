# 梦伴

梦伴是一个基于 Tauri、React 和 TypeScript 的睡眠声音助手。

第一版目标是提供跨平台声音播放能力，覆盖 Web、Linux、Windows 和 Android 前台运行场景。当前声音库包含白噪音、ASMR 和 XMSLEEP 去重补充音源，提供场景预设混音，并支持添加本地自定义音频。后端账号能力已经支持邮箱密码注册和登录。

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

## 后端本地启动

后端代码位于 `backend/`，数据库迁移位于 `backend-migration/`。本地开发需要先准备 PostgreSQL，再执行 migration，最后启动后端服务。

### 1. 选择配置环境

后端默认从 TOML 选择配置环境，当前默认环境是 `local`：

```toml
# backend/config/environment.toml
[app]
env = "local"
```

可选值按现有配置文件命名，例如：

```text
local -> backend/config/local.toml
development -> backend/config/development.toml
test -> backend/config/test.toml
production -> backend/config/production.toml
```

`APP_ENV` 仍可作为临时覆盖，例如：

```bash
APP_ENV=production cargo run -p sleep-companion-backend
```

配置加载规则是：先用 `APP_ENV`、`backend/config/local.toml` 或 `backend/config/environment.toml` 解析当前环境；未设置时默认 `local`。随后读取 `backend/config/default.toml`、所选环境 TOML、`backend/config/local.toml` 和 `APP_` 环境变量覆盖。

### 2. 准备本地配置

复制本地私有配置文件：

```bash
cp backend/config/local.toml.example backend/config/local.toml
```

推荐在 `backend/config/local.toml` 中使用结构化数据库配置：

```toml
[database]
host = "localhost"
port = 5432
database = "sleep_companion_dev"
username = "postgres"
password = "postgres"
ssl_mode = "disable"

[auth]
jwt_secret = "local-dev-secret"
```

如果使用云数据库或部署平台提供的完整连接串，也可以用 `database.url` 覆盖：

```toml
[database]
url = "postgres://postgres:postgres@localhost:5432/sleep_companion_dev"
```

后端服务规则是：`database.url` 存在且非空时优先使用完整连接串；否则使用结构化字段拼接 PostgreSQL 连接串。

### 3. 创建本地数据库

如果本机 PostgreSQL 用户是 `postgres/postgres`，可以创建开发库：

```bash
createdb -U postgres sleep_companion_dev
```

### 4. 执行数据库迁移

`backend-migration` 默认复用后端服务的 TOML 数据库配置，因此本地通常不需要再手写连接串：

```bash
cargo run -p backend-migration -- up
```

常用 migration 命令：

```bash
cargo run -p backend-migration -- status
cargo run -p backend-migration -- up
```

如果部署环境需要显式覆盖数据库连接，也可以继续使用 `DATABASE_URL`：

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5432/sleep_companion_dev" cargo run -p backend-migration -- up
```

### 5. 启动后端服务

本地默认使用 `local` 环境，通常无需再传 `APP_ENV`：

```bash
cargo run -p sleep-companion-backend
```

启动后访问：

```text
http://127.0.0.1:3817/healthz
http://127.0.0.1:3817/readyz
http://127.0.0.1:3817/api/auth/login
http://127.0.0.1:3817/api/auth/register
http://127.0.0.1:3817/swagger-ui
```

开发日志默认写入：

```text
backend/logs/backend-dev.log
```

### RustRover 运行配置

在 RustRover 中可以创建两个 Cargo 运行配置：

```text
Name: backend migration up
Command: run
Package: backend-migration
Arguments: -- up
Environment variables:
可留空；如需临时覆盖数据库连接，可以填写 DATABASE_URL=postgres://postgres:postgres@localhost:5432/sleep_companion_dev
Working directory:
仓库根目录
```

```text
Name: backend dev
Command: run
Package: sleep-companion-backend
Environment variables:
可留空；如需临时覆盖配置环境，可以填写 APP_ENV=production 或 APP_ENV=test
Working directory:
仓库根目录
```

注意：后端服务和 migration 默认都使用同一套 TOML 配置；`DATABASE_URL` 只作为 migration 的显式覆盖入口。
