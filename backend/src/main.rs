use sleep_companion_backend::{
    app::build_router, config::AppConfig, db::connect_database, id::SnowflakeIdGenerator,
    scheduler::start_scheduler, telemetry::init_tracing,
};
use std::sync::Arc;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::load()?;
    let _log_guard = init_tracing(&config.logging)?;

    let database_url = config.database.connection_url()?;
    let db = connect_database(&database_url, config.database.max_connections).await?;
    let id_generator = Arc::new(SnowflakeIdGenerator::new(config.id_generator.worker_id)?);
    let _scheduler = start_scheduler(&config.scheduler).await?;

    let listener = TcpListener::bind(config.socket_addr()?).await?;
    tracing::info!("后端服务监听地址: {}", listener.local_addr()?);

    axum::serve(
        listener,
        build_router(
            db,
            config.openapi,
            config.cors,
            config.auth,
            config.rate_limit.login,
            id_generator,
        ),
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
