use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, DbErr, Statement};
use std::time::Duration;
use tracing::log::LevelFilter;

pub async fn connect_database(
    database_url: &str,
    max_connections: u32,
) -> Result<DatabaseConnection, DbErr> {
    let mut options = ConnectOptions::new(database_url.to_string());
    options
        .max_connections(max_connections)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .sqlx_logging_level(LevelFilter::Debug);

    Database::connect(options).await
}

pub async fn ping_database(db: &DatabaseConnection) -> Result<(), DbErr> {
    db.execute(Statement::from_string(
        db.get_database_backend(),
        "select 1".to_string(),
    ))
    .await?;

    Ok(())
}
