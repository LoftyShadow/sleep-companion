# 梦伴

梦伴是一个基于 Tauri、React 和 TypeScript 的睡眠声音助手。

第一版目标是提供跨平台声音播放能力，覆盖 Web、Linux、Windows 和 Android 前台运行场景。当前内置 17 个声音，提供场景预设混音，并支持添加本地自定义音频。

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

## 后端本地启动

后端代码位于 `backend/`，数据库迁移位于 `backend-migration/`。本地开发需要先准备 PostgreSQL，再执行 migration，最后启动后端服务。

### 1. 准备本地配置

复制本地私有配置文件：

```powershell
Copy-Item backend\config\local.toml.example backend\config\local.toml
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

### 2. 创建本地数据库

如果本机 PostgreSQL 用户是 `postgres/postgres`，可以创建开发库：

```powershell
createdb -U postgres sleep_companion_dev
```

### 3. 执行数据库迁移

`backend-migration` 使用 SeaORM migration CLI，按工具约定通过 `DATABASE_URL` 获取连接串：

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/sleep_companion_dev"
cargo run -p backend-migration -- up
```

常用 migration 命令：

```powershell
cargo run -p backend-migration -- status
cargo run -p backend-migration -- up
```

### 4. 启动后端服务

后端服务读取 `backend/config/default.toml`、`backend/config/{APP_ENV}.toml`、`backend/config/local.toml` 和 `APP_` 环境变量覆盖：

```powershell
$env:APP_ENV="development"
cargo run -p sleep-companion-backend
```

启动后访问：

```text
http://127.0.0.1:3817/healthz
http://127.0.0.1:3817/readyz
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
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sleep_companion_dev
Working directory:
C:\Users\10942\RustroverProjects\sleep-companion-backend-auth
```

```text
Name: backend dev
Command: run
Package: sleep-companion-backend
Environment variables:
APP_ENV=development
Working directory:
C:\Users\10942\RustroverProjects\sleep-companion-backend-auth
```

注意：后端服务使用 `local.toml` 的结构化配置；migration 工具仍然使用 `DATABASE_URL`。
