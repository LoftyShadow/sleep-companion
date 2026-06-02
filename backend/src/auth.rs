use argon2::{
    password_hash::{
        rand_core::OsRng as PasswordHashOsRng, PasswordHash, PasswordHasher, PasswordVerifier,
        SaltString,
    },
    Argon2,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{header::USER_AGENT, HeaderMap},
    Extension, Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{DateTime, Duration, TimeZone, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use rand::{rngs::OsRng as TokenOsRng, RngCore};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, DbErr, EntityTrait,
    QueryFilter, Set, SqlErr, Statement, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use utoipa::ToSchema;

use crate::{
    app::AppState,
    config::{AuthConfig, LoginRateLimitConfig},
    entity::{app_users, login_rate_limits, password_credentials, refresh_sessions},
    error::ApiError,
    id::IdGenerator,
    request_id::RequestId,
    response::{ok_with_request_id, ApiResponse},
};

const UNKNOWN_CLIENT_IP: &str = "unknown";
const RATE_LIMIT_HASH_PREFIX: &str = "sleep-companion:login-rate-limit";
const REFRESH_IP_HASH_PREFIX: &str = "sleep-companion:refresh-session-ip";
const REFRESH_TOKEN_BYTES: usize = 32;

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub access_token: String,
    pub access_token_expires_in_seconds: u64,
    pub refresh_token: String,
    pub user: LoginUser,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginUser {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct AccessTokenClaims {
    sub: String,
    email: String,
    iat: usize,
    exp: usize,
}

#[derive(Debug)]
struct LoginRateLimitKey {
    kind: &'static str,
    hash: Vec<u8>,
    max_attempts: i32,
}

#[derive(Debug, thiserror::Error)]
enum AuthError {
    #[error("登录凭证无效")]
    InvalidCredentials,
    #[error("注册请求无效")]
    InvalidRegisterRequest,
    #[error("邮箱已注册")]
    EmailAlreadyRegistered,
    #[error("登录尝试过多")]
    RateLimited,
    #[error("数据库访问失败")]
    Database(#[from] DbErr),
    #[error("密码哈希失败")]
    PasswordHash,
    #[error("签发 token 失败")]
    TokenIssue(#[from] jsonwebtoken::errors::Error),
}

impl AuthError {
    fn into_api_error(self, request_id: &str) -> ApiError {
        match self {
            Self::InvalidCredentials => {
                ApiError::unauthorized("auth.invalid_credentials", "邮箱或密码错误", request_id)
            }
            Self::InvalidRegisterRequest => ApiError::bad_request(
                "auth.invalid_register_request",
                "邮箱或密码不符合要求",
                request_id,
            ),
            Self::EmailAlreadyRegistered => {
                ApiError::conflict("auth.email_already_registered", "该邮箱已注册", request_id)
            }
            Self::RateLimited => ApiError::too_many_requests(
                "auth.rate_limited",
                "登录尝试过多，请稍后再试",
                request_id,
            ),
            Self::Database(_) => {
                ApiError::service_unavailable("database_unavailable", "服务暂时不可用", request_id)
            }
            Self::TokenIssue(_) => {
                ApiError::internal("auth.token_issue", "登录服务暂不可用", request_id)
            }
            Self::PasswordHash => {
                ApiError::internal("auth.password_hash_failed", "注册服务暂不可用", request_id)
            }
        }
    }
}

#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "登录成功", body = ApiResponse<LoginResponse>),
        (status = 400, description = "请求体格式错误"),
        (status = 401, description = "邮箱或密码错误"),
        (status = 429, description = "登录尝试过多"),
        (status = 503, description = "服务暂时不可用")
    )
)]
pub async fn login(
    State(state): State<AppState>,
    Extension(request_id): Extension<RequestId>,
    headers: HeaderMap,
    payload: Result<Json<LoginRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<LoginResponse>>, ApiError> {
    let Json(request) = payload.map_err(|_| {
        ApiError::bad_request(
            "auth.invalid_request",
            "登录请求格式错误",
            request_id.as_str(),
        )
    })?;
    let response = match login_with_password(
        state.db.as_ref(),
        state.id_generator.as_ref(),
        &state.auth,
        &state.login_rate_limit,
        &headers,
        request,
    )
    .await
    {
        Ok(response) => response,
        Err(error) => return Err(error.into_api_error(request_id.as_str())),
    };

    Ok(ok_with_request_id(request_id.as_str(), response))
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    tag = "auth",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "注册成功", body = ApiResponse<LoginResponse>),
        (status = 400, description = "请求体格式错误或注册字段无效"),
        (status = 409, description = "邮箱已注册"),
        (status = 503, description = "服务暂时不可用")
    )
)]
pub async fn register(
    State(state): State<AppState>,
    Extension(request_id): Extension<RequestId>,
    headers: HeaderMap,
    payload: Result<Json<RegisterRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<LoginResponse>>, ApiError> {
    let Json(request) = payload.map_err(|_| {
        ApiError::bad_request(
            "auth.invalid_request",
            "注册请求格式错误",
            request_id.as_str(),
        )
    })?;
    let response = match register_with_password(
        state.db.as_ref(),
        state.id_generator.as_ref(),
        &state.auth,
        &headers,
        request,
    )
    .await
    {
        Ok(response) => response,
        Err(error) => return Err(error.into_api_error(request_id.as_str())),
    };

    Ok(ok_with_request_id(request_id.as_str(), response))
}

async fn login_with_password(
    db: &DatabaseConnection,
    id_generator: &dyn IdGenerator,
    auth_config: &AuthConfig,
    rate_limit_config: &LoginRateLimitConfig,
    headers: &HeaderMap,
    request: LoginRequest,
) -> Result<LoginResponse, AuthError> {
    let email = request.email.trim().to_lowercase();
    if email.is_empty() || request.password.len() < auth_config.password_min_length {
        return Err(AuthError::InvalidCredentials);
    }

    let now = Utc::now();
    let client_ip = extract_client_ip(headers);
    let rate_limit_keys =
        build_login_rate_limit_keys(&email, &client_ip, rate_limit_config, auth_config);
    ensure_not_rate_limited(db, &rate_limit_keys, now).await?;

    let user = find_active_user_by_email(db, &email).await?;

    let credentials = if let Some(user) = &user {
        password_credentials::Entity::find_by_id(user.id)
            .filter(password_credentials::Column::DeletedAt.is_null())
            .one(db)
            .await?
    } else {
        None
    };

    let Some(user) = user else {
        record_failed_login(db, id_generator, &rate_limit_keys, rate_limit_config, now).await?;
        return Err(AuthError::InvalidCredentials);
    };
    let Some(credentials) = credentials else {
        record_failed_login(db, id_generator, &rate_limit_keys, rate_limit_config, now).await?;
        return Err(AuthError::InvalidCredentials);
    };

    if !verify_password(&request.password, &credentials.password_hash) {
        record_failed_login(db, id_generator, &rate_limit_keys, rate_limit_config, now).await?;
        return Err(AuthError::InvalidCredentials);
    }

    create_auth_session(db, id_generator, auth_config, headers, user, now).await
}

async fn register_with_password(
    db: &DatabaseConnection,
    id_generator: &dyn IdGenerator,
    auth_config: &AuthConfig,
    headers: &HeaderMap,
    request: RegisterRequest,
) -> Result<LoginResponse, AuthError> {
    let email = request.email.trim().to_lowercase();
    let display_name = request
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    if email.is_empty() || request.password.len() < auth_config.password_min_length {
        return Err(AuthError::InvalidRegisterRequest);
    }

    let existing_active_user = find_active_user_by_email(db, &email).await?;

    if existing_active_user.is_some() {
        return Err(AuthError::EmailAlreadyRegistered);
    }

    let now = Utc::now();
    let password_hash = hash_password(&request.password).map_err(|_| AuthError::PasswordHash)?;
    let user_id = id_generator.next_id();
    let txn = db.begin().await?;

    let user = app_users::ActiveModel {
        id: Set(user_id),
        email: Set(email),
        email_verified_at: Set(None),
        display_name: Set(display_name),
        created_at: Set(now),
        updated_at: Set(now),
        deleted_at: Set(None),
        created_by: Set(Some(user_id)),
        updated_by: Set(Some(user_id)),
        metadata: Set(json!({})),
    }
    .insert(&txn)
    .await
    .map_err(map_unique_email_conflict)?;

    password_credentials::ActiveModel {
        app_user_id: Set(user.id),
        password_hash: Set(password_hash),
        password_changed_at: Set(now),
        created_at: Set(now),
        updated_at: Set(now),
        deleted_at: Set(None),
        created_by: Set(Some(user.id)),
        updated_by: Set(Some(user.id)),
        metadata: Set(json!({})),
    }
    .insert(&txn)
    .await?;

    let response = create_auth_session(&txn, id_generator, auth_config, headers, user, now).await?;
    txn.commit().await?;

    Ok(response)
}

fn map_unique_email_conflict(error: DbErr) -> AuthError {
    if matches!(error.sql_err(), Some(SqlErr::UniqueConstraintViolation(_))) {
        AuthError::EmailAlreadyRegistered
    } else {
        AuthError::Database(error)
    }
}

async fn find_active_user_by_email(
    db: &DatabaseConnection,
    email: &str,
) -> Result<Option<app_users::Model>, AuthError> {
    Ok(app_users::Entity::find()
        .filter(app_users::Column::Email.eq(email))
        .filter(app_users::Column::DeletedAt.is_null())
        .one(db)
        .await?)
}

async fn create_auth_session<C>(
    db: &C,
    id_generator: &dyn IdGenerator,
    auth_config: &AuthConfig,
    headers: &HeaderMap,
    user: app_users::Model,
    now: DateTime<Utc>,
) -> Result<LoginResponse, AuthError>
where
    C: ConnectionTrait,
{
    let client_ip = extract_client_ip(headers);
    let access_token = sign_access_token(auth_config, &user, now)?;
    let refresh_token = create_refresh_token();
    let refresh_token_hash = hash_token(&refresh_token);
    let refresh_session_expires_at =
        now + Duration::days(auth_config.refresh_token_ttl_days as i64);
    let user_agent = read_user_agent(headers);
    let ip_hash = if client_ip == UNKNOWN_CLIENT_IP {
        None
    } else {
        Some(hash_secret_value(
            REFRESH_IP_HASH_PREFIX,
            &client_ip,
            auth_config,
        ))
    };

    refresh_sessions::ActiveModel {
        id: Set(id_generator.next_id()),
        app_user_id: Set(user.id),
        token_hash: Set(refresh_token_hash),
        expires_at: Set(refresh_session_expires_at),
        revoked_at: Set(None),
        user_agent: Set(user_agent),
        ip_hash: Set(ip_hash),
        created_at: Set(now),
        updated_at: Set(now),
        deleted_at: Set(None),
        created_by: Set(Some(user.id)),
        updated_by: Set(Some(user.id)),
        metadata: Set(json!({})),
        last_used_at: Set(Some(now)),
    }
    .insert(db)
    .await?;

    Ok(LoginResponse {
        access_token,
        access_token_expires_in_seconds: auth_config.access_token_ttl_seconds,
        refresh_token,
        user: LoginUser {
            id: user.id.to_string(),
            email: user.email,
            display_name: user.display_name,
        },
    })
}

fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut PasswordHashOsRng);

    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

fn verify_password(password: &str, password_hash: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(password_hash) else {
        return false;
    };

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

fn sign_access_token(
    auth_config: &AuthConfig,
    user: &app_users::Model,
    now: DateTime<Utc>,
) -> Result<String, jsonwebtoken::errors::Error> {
    let issued_at = now.timestamp().max(0) as usize;
    let expires_at = (now + Duration::seconds(auth_config.access_token_ttl_seconds as i64))
        .timestamp()
        .max(0) as usize;
    let claims = AccessTokenClaims {
        sub: user.id.to_string(),
        email: user.email.clone(),
        iat: issued_at,
        exp: expires_at,
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(auth_config.jwt_secret.as_bytes()),
    )
}

fn create_refresh_token() -> String {
    let mut bytes = [0_u8; REFRESH_TOKEN_BYTES];
    TokenOsRng.fill_bytes(&mut bytes);

    URL_SAFE_NO_PAD.encode(bytes)
}

fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

async fn ensure_not_rate_limited(
    db: &DatabaseConnection,
    keys: &[LoginRateLimitKey],
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    for key in keys {
        let blocked_key = login_rate_limits::Entity::find()
            .filter(login_rate_limits::Column::KeyKind.eq(key.kind))
            .filter(login_rate_limits::Column::KeyHash.eq(key.hash.clone()))
            .filter(login_rate_limits::Column::BlockedUntil.gt(now))
            .filter(login_rate_limits::Column::DeletedAt.is_null())
            .one(db)
            .await?;

        if blocked_key.is_some() {
            return Err(AuthError::RateLimited);
        }
    }

    Ok(())
}

async fn record_failed_login(
    db: &DatabaseConnection,
    id_generator: &dyn IdGenerator,
    keys: &[LoginRateLimitKey],
    config: &LoginRateLimitConfig,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    let window_started_at = current_window_started_at(now, config.window_seconds);
    let blocked_until = now + Duration::seconds(config.block_seconds as i64);

    for key in keys {
        upsert_failed_login_record(
            db,
            id_generator.next_id(),
            key,
            window_started_at,
            blocked_until,
            now,
        )
        .await?;
    }

    Ok(())
}

async fn upsert_failed_login_record(
    db: &DatabaseConnection,
    id: i64,
    key: &LoginRateLimitKey,
    window_started_at: DateTime<Utc>,
    blocked_until: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    db.execute(Statement::from_sql_and_values(
        db.get_database_backend(),
        r#"
insert into login_rate_limits (
    id,
    key_kind,
    key_hash,
    window_started_at,
    attempts,
    blocked_until,
    created_at,
    updated_at,
    deleted_at,
    created_by,
    updated_by,
    metadata
) values (
    $1,
    $2,
    $3,
    $4,
    1,
    case when 1 >= $5 then $6 else null end,
    $7,
    $8,
    null,
    null,
    null,
    '{}'::jsonb
)
on conflict (key_kind, key_hash, window_started_at) where deleted_at is null
do update set
    attempts = login_rate_limits.attempts + 1,
    blocked_until = case
        when login_rate_limits.attempts + 1 >= $5 then $6
        else login_rate_limits.blocked_until
    end,
    updated_at = $8
"#,
        [
            id.into(),
            key.kind.into(),
            key.hash.clone().into(),
            window_started_at.into(),
            key.max_attempts.into(),
            blocked_until.into(),
            now.into(),
            now.into(),
        ],
    ))
    .await?;

    Ok(())
}

fn current_window_started_at(now: DateTime<Utc>, window_seconds: u64) -> DateTime<Utc> {
    let window_seconds = window_seconds.max(1) as i64;
    let timestamp = now.timestamp();
    let window_started_at = timestamp - timestamp.rem_euclid(window_seconds);

    Utc.timestamp_opt(window_started_at, 0)
        .single()
        .unwrap_or(now)
}

fn build_login_rate_limit_keys(
    email: &str,
    client_ip: &str,
    config: &LoginRateLimitConfig,
    auth_config: &AuthConfig,
) -> Vec<LoginRateLimitKey> {
    vec![
        LoginRateLimitKey {
            kind: "ip",
            hash: hash_secret_value(RATE_LIMIT_HASH_PREFIX, client_ip, auth_config),
            max_attempts: config.ip_attempts as i32,
        },
        LoginRateLimitKey {
            kind: "email",
            hash: hash_secret_value(RATE_LIMIT_HASH_PREFIX, email, auth_config),
            max_attempts: config.email_attempts as i32,
        },
        LoginRateLimitKey {
            kind: "ip_email",
            hash: hash_secret_value(
                RATE_LIMIT_HASH_PREFIX,
                &format!("{client_ip}\0{email}"),
                auth_config,
            ),
            max_attempts: config.ip_email_attempts as i32,
        },
    ]
}

fn hash_secret_value(prefix: &str, value: &str, auth_config: &AuthConfig) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(prefix.as_bytes());
    hasher.update([0]);
    hasher.update(auth_config.jwt_secret.as_bytes());
    hasher.update([0]);
    hasher.update(value.as_bytes());
    hasher.finalize().to_vec()
}

fn extract_client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            value
                .split(',')
                .map(str::trim)
                .find(|part| !part.is_empty())
                .map(ToOwned::to_owned)
        })
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| UNKNOWN_CLIENT_IP.to_string())
}

fn read_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(512).collect())
}

#[cfg(test)]
mod tests {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };

    use super::*;

    fn test_auth_config() -> AuthConfig {
        AuthConfig {
            jwt_secret: "test-secret".to_string(),
            access_token_ttl_seconds: 900,
            refresh_token_ttl_days: 30,
            password_min_length: 6,
        }
    }

    #[test]
    fn verifies_argon2_password_hash() {
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password("secret123".as_bytes(), &salt)
            .unwrap()
            .to_string();

        assert!(verify_password("secret123", &password_hash));
        assert!(!verify_password("wrong-password", &password_hash));
    }

    #[test]
    fn refresh_token_hash_does_not_store_token_plaintext() {
        let refresh_token = create_refresh_token();
        let token_hash = hash_token(&refresh_token);

        assert_ne!(refresh_token.as_bytes(), token_hash);
        assert_eq!(token_hash.len(), 32);
    }

    #[test]
    fn floors_login_rate_limit_window_start() {
        let now = Utc.timestamp_opt(1_780_000_123, 0).single().unwrap();

        assert_eq!(
            current_window_started_at(now, 900),
            Utc.timestamp_opt(1_779_999_300, 0).single().unwrap()
        );
    }

    #[test]
    fn extracts_first_forwarded_client_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", " 10.0.0.1, 10.0.0.2".parse().unwrap());

        assert_eq!(extract_client_ip(&headers), "10.0.0.1");
    }

    #[test]
    fn signs_access_token() {
        let user = app_users::Model {
            id: 739_182_738_912_312_320,
            email: "user@example.com".to_string(),
            email_verified_at: None,
            display_name: Some("梦伴用户".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
            created_by: None,
            updated_by: None,
            metadata: json!({}),
        };

        let token = sign_access_token(&test_auth_config(), &user, Utc::now()).unwrap();

        assert!(!token.is_empty());
        assert_eq!(token.split('.').count(), 3);
    }
}
