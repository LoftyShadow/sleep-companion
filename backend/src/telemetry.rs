use std::fs;

use anyhow::{Context, Result};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::{LogFormat, LoggingConfig};

pub fn init_tracing(config: &LoggingConfig) -> Result<Option<WorkerGuard>> {
    let env_filter = EnvFilter::try_new(&config.level).context("日志级别配置无效")?;

    match (&config.format, config.write_to_file) {
        (LogFormat::Pretty, false) => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer())
                .try_init()
                .context("初始化日志失败")?;
            Ok(None)
        }
        (LogFormat::Json, false) => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer().json())
                .try_init()
                .context("初始化日志失败")?;
            Ok(None)
        }
        (LogFormat::Pretty, true) => {
            let (writer, guard) = file_writer(config)?;
            tracing_subscriber::registry()
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer())
                .with(tracing_subscriber::fmt::layer().with_writer(writer))
                .try_init()
                .context("初始化日志失败")?;
            Ok(Some(guard))
        }
        (LogFormat::Json, true) => {
            let (writer, guard) = file_writer(config)?;
            tracing_subscriber::registry()
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer().json())
                .with(tracing_subscriber::fmt::layer().json().with_writer(writer))
                .try_init()
                .context("初始化日志失败")?;
            Ok(Some(guard))
        }
    }
}

fn file_writer(
    config: &LoggingConfig,
) -> Result<(tracing_appender::non_blocking::NonBlocking, WorkerGuard)> {
    let parent = config
        .file_path
        .parent()
        .context("日志文件路径缺少父目录")?;
    fs::create_dir_all(parent).context("创建日志目录失败")?;

    let file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&config.file_path)
        .with_context(|| format!("打开日志文件失败: {}", config.file_path.display()))?;

    Ok(tracing_appender::non_blocking(file))
}
