use std::net::TcpListener;

use sleep_companion_backend::{
    app::build_router, config::AppConfig, db::connect_database, scheduler::start_scheduler,
    telemetry::init_tracing,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::load()?;
    let _log_guard = init_tracing(&config.logging)?;

    let database_url = config.database.connection_url()?;
    let db = connect_database(&database_url, config.database.max_connections).await?;
    let _scheduler = start_scheduler(&config.scheduler).await?;

    let listener = TcpListener::bind(config.bind_addr())?;
    tracing::info!("后端服务监听地址: {}", listener.local_addr()?);

    axum::serve(
        tokio::net::TcpListener::from_std(listener)?,
        build_router(db, config.openapi),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        tracing::warn!(%error, "监听关闭信号失败");
    }
}
