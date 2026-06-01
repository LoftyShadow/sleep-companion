use std::env;

use sea_orm_migration::prelude::*;
use sleep_companion_backend::config::AppConfig;

const DATABASE_URL_VAR: &str = "DATABASE_URL";

#[async_std::main]
async fn main() {
    load_database_url_from_backend_config();
    cli::run_cli(backend_migration::Migrator).await;
}

fn load_database_url_from_backend_config() {
    if env::var(DATABASE_URL_VAR)
        .ok()
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        return;
    }

    let database_url = AppConfig::load()
        .and_then(|config| config.database.connection_url())
        .unwrap_or_else(|error| {
            panic!("从后端 TOML 配置加载 migration 数据库连接串失败: {error:#}")
        });

    env::set_var(DATABASE_URL_VAR, database_url);
}
