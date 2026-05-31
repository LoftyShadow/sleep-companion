use std::{env, net::SocketAddr, path::PathBuf};

use anyhow::{Context, Result};
use config::{Config, Environment, File};
use serde::Deserialize;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub id_generator: IdGeneratorConfig,
    pub auth: AuthConfig,
    pub logging: LoggingConfig,
    pub openapi: OpenApiConfig,
    pub scheduler: SchedulerConfig,
    pub rate_limit: RateLimitConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct DatabaseConfig {
    pub url: Option<String>,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl_mode: String,
    pub max_connections: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct IdGeneratorConfig {
    pub worker_id: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub access_token_ttl_seconds: u64,
    pub refresh_token_ttl_days: u64,
    pub password_min_length: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: LogFormat,
    pub write_to_file: bool,
    pub file_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogFormat {
    Pretty,
    Json,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct OpenApiConfig {
    pub enabled: bool,
    pub swagger_ui_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct SchedulerConfig {
    pub enabled: bool,
    pub jobs: SchedulerJobsConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct SchedulerJobsConfig {
    pub cleanup_expired_tokens: SchedulerJobConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct SchedulerJobConfig {
    pub enabled: bool,
    pub cron: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct RateLimitConfig {
    pub login: LoginRateLimitConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct LoginRateLimitConfig {
    pub window_seconds: u64,
    pub block_seconds: u64,
    pub ip_attempts: u32,
    pub email_attempts: u32,
    pub ip_email_attempts: u32,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        dotenvy::dotenv().ok();

        let app_env = env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
        let config_dir = resolve_config_dir()?;
        let settings = Config::builder()
            .add_source(File::from(config_dir.join("default.toml")))
            .add_source(File::from(config_dir.join(format!("{app_env}.toml"))).required(false))
            .add_source(File::from(config_dir.join("local.toml")).required(false))
            .add_source(Environment::with_prefix("APP").separator("__"))
            .build()
            .context("加载后端配置失败")?;

        settings.try_deserialize().context("解析后端配置失败")
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }

    pub fn socket_addr(&self) -> Result<SocketAddr> {
        self.bind_addr().parse().context("监听地址无效")
    }
}

impl DatabaseConfig {
    pub fn connection_url(&self) -> Result<String> {
        if let Some(url) = self
            .url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Ok(url.to_string());
        }

        let mut url = Url::parse("postgres://localhost").context("初始化数据库连接串失败")?;
        url.set_host(Some(&self.host))
            .map_err(|_| anyhow::anyhow!("数据库 host 配置无效"))?;
        url.set_port(Some(self.port))
            .map_err(|_| anyhow::anyhow!("数据库 port 配置无效"))?;
        url.set_username(&self.username)
            .map_err(|_| anyhow::anyhow!("数据库 username 配置无效"))?;
        url.set_password(Some(&self.password))
            .map_err(|_| anyhow::anyhow!("数据库 password 配置无效"))?;
        url.set_path(&self.database);

        if !self.ssl_mode.trim().is_empty() {
            url.query_pairs_mut()
                .append_pair("sslmode", self.ssl_mode.trim());
        }

        Ok(url.into())
    }
}

fn resolve_config_dir() -> Result<PathBuf> {
    let current_dir = env::current_dir().context("读取当前目录失败")?;
    let backend_config_dir = current_dir.join("backend").join("config");

    if backend_config_dir.is_dir() {
        return Ok(backend_config_dir);
    }

    Ok(current_dir.join("config"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> AppConfig {
        AppConfig {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 3817,
            },
            database: DatabaseConfig {
                url: None,
                host: "localhost".to_string(),
                port: 5432,
                database: "sleep_companion".to_string(),
                username: "postgres".to_string(),
                password: "postgres".to_string(),
                ssl_mode: "disable".to_string(),
                max_connections: 10,
            },
            id_generator: IdGeneratorConfig { worker_id: 1 },
            auth: AuthConfig {
                jwt_secret: "test-secret".to_string(),
                access_token_ttl_seconds: 900,
                refresh_token_ttl_days: 30,
                password_min_length: 6,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: LogFormat::Pretty,
                write_to_file: false,
                file_path: PathBuf::from("backend/logs/backend-dev.log"),
            },
            openapi: OpenApiConfig {
                enabled: true,
                swagger_ui_enabled: true,
            },
            scheduler: SchedulerConfig {
                enabled: false,
                jobs: SchedulerJobsConfig {
                    cleanup_expired_tokens: SchedulerJobConfig {
                        enabled: false,
                        cron: "0 0/30 * * * *".to_string(),
                    },
                },
            },
            rate_limit: RateLimitConfig {
                login: LoginRateLimitConfig {
                    window_seconds: 900,
                    block_seconds: 900,
                    ip_attempts: 30,
                    email_attempts: 10,
                    ip_email_attempts: 5,
                },
            },
        }
    }

    #[test]
    fn bind_addr_uses_host_and_port() {
        let config = test_config();

        assert_eq!(config.bind_addr(), "0.0.0.0:3817");
        assert_eq!(config.socket_addr().unwrap().port(), 3817);
    }

    #[test]
    fn database_connection_url_uses_structured_fields() {
        let config = DatabaseConfig {
            url: None,
            host: "localhost".to_string(),
            port: 5432,
            database: "sleep_companion_dev".to_string(),
            username: "postgres".to_string(),
            password: "p@ss/word".to_string(),
            ssl_mode: "disable".to_string(),
            max_connections: 10,
        };

        assert_eq!(
            config.connection_url().unwrap(),
            "postgres://postgres:p%40ss%2Fword@localhost:5432/sleep_companion_dev?sslmode=disable"
        );
    }

    #[test]
    fn database_connection_url_prefers_explicit_url() {
        let config = DatabaseConfig {
            url: Some("postgres://cloud.example/sleep_companion".to_string()),
            host: "localhost".to_string(),
            port: 5432,
            database: "sleep_companion_dev".to_string(),
            username: "postgres".to_string(),
            password: "postgres".to_string(),
            ssl_mode: "disable".to_string(),
            max_connections: 10,
        };

        assert_eq!(
            config.connection_url().unwrap(),
            "postgres://cloud.example/sleep_companion"
        );
    }
}
