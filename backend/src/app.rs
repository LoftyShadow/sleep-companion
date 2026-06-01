use std::sync::Arc;

use axum::{
    extract::{Extension, State},
    middleware,
    routing::{get, post},
    Json, Router,
};
use sea_orm::DatabaseConnection;
use serde::Serialize;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use utoipa::OpenApi;
use utoipa::ToSchema;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    auth,
    config::{AuthConfig, LoginRateLimitConfig, OpenApiConfig},
    db::ping_database,
    error::ApiError,
    id::IdGenerator,
    openapi::ApiDoc,
    request_id::{request_id_middleware, RequestId},
    response::{ok_with_request_id, ApiResponse},
};

#[derive(Clone)]
pub struct AppState {
    pub(crate) db: Arc<DatabaseConnection>,
    pub(crate) auth: AuthConfig,
    pub(crate) login_rate_limit: LoginRateLimitConfig,
    pub(crate) id_generator: Arc<dyn IdGenerator>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    status: &'static str,
}

pub fn build_router(
    db: DatabaseConnection,
    openapi: OpenApiConfig,
    auth: AuthConfig,
    login_rate_limit: LoginRateLimitConfig,
    id_generator: Arc<dyn IdGenerator>,
) -> Router {
    let mut router = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/register", post(auth::register))
        .with_state(AppState {
            db: Arc::new(db),
            auth,
            login_rate_limit,
            id_generator,
        })
        .layer(middleware::from_fn(request_id_middleware))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    if openapi.enabled && openapi.swagger_ui_enabled {
        router = router
            .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()));
    }

    router
}

#[utoipa::path(
    get,
    path = "/healthz",
    tag = "health",
    responses(
        (status = 200, description = "进程存活", body = ApiResponse<HealthResponse>)
    )
)]
pub async fn healthz(
    Extension(request_id): Extension<RequestId>,
) -> Json<ApiResponse<HealthResponse>> {
    ok_with_request_id(request_id.as_str(), HealthResponse { status: "ok" })
}

#[utoipa::path(
    get,
    path = "/readyz",
    tag = "health",
    responses(
        (status = 200, description = "数据库连接可用", body = ApiResponse<HealthResponse>),
        (status = 503, description = "数据库连接不可用")
    )
)]
pub async fn readyz(
    State(state): State<AppState>,
    Extension(request_id): Extension<RequestId>,
) -> Result<Json<ApiResponse<HealthResponse>>, ApiError> {
    ping_database(state.db.as_ref()).await.map_err(|_| {
        ApiError::service_unavailable(
            "database_unavailable",
            "服务暂时不可用",
            request_id.as_str(),
        )
    })?;

    Ok(ok_with_request_id(
        request_id.as_str(),
        HealthResponse { status: "ok" },
    ))
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicI64, Ordering};

    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };
    use axum::{body::Body, http::Request};
    use chrono::Utc;
    use sea_orm::{DatabaseBackend, MockDatabase};
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use super::*;
    use crate::{
        config::{AuthConfig, LoginRateLimitConfig},
        entity::{app_users, login_rate_limits, password_credentials, refresh_sessions},
    };

    struct FixedIdGenerator;

    impl IdGenerator for FixedIdGenerator {
        fn next_id(&self) -> i64 {
            739_182_738_912_312_321
        }
    }

    struct SequentialIdGenerator {
        next_id: AtomicI64,
    }

    impl SequentialIdGenerator {
        fn new(next_id: i64) -> Self {
            Self {
                next_id: AtomicI64::new(next_id),
            }
        }
    }

    impl IdGenerator for SequentialIdGenerator {
        fn next_id(&self) -> i64 {
            self.next_id.fetch_add(1, Ordering::SeqCst)
        }
    }

    fn test_auth_config() -> AuthConfig {
        AuthConfig {
            jwt_secret: "test-secret".to_string(),
            access_token_ttl_seconds: 900,
            refresh_token_ttl_days: 30,
            password_min_length: 6,
        }
    }

    fn test_login_rate_limit_config() -> LoginRateLimitConfig {
        LoginRateLimitConfig {
            window_seconds: 900,
            block_seconds: 900,
            ip_attempts: 30,
            email_attempts: 10,
            ip_email_attempts: 5,
        }
    }

    fn test_id_generator() -> Arc<dyn IdGenerator> {
        Arc::new(FixedIdGenerator)
    }

    fn sequential_id_generator(next_id: i64) -> Arc<dyn IdGenerator> {
        Arc::new(SequentialIdGenerator::new(next_id))
    }

    fn test_user(
        id: i64,
        email: &str,
        display_name: Option<&str>,
        now: chrono::DateTime<Utc>,
    ) -> app_users::Model {
        app_users::Model {
            id,
            email: email.to_string(),
            email_verified_at: None,
            display_name: display_name.map(ToOwned::to_owned),
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: None,
            updated_by: None,
            metadata: json!({}),
        }
    }

    fn mock_login_user(
        user: app_users::Model,
        credentials: password_credentials::Model,
    ) -> MockDatabase {
        MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<login_rate_limits::Model>::new()])
            .append_query_results([Vec::<login_rate_limits::Model>::new()])
            .append_query_results([Vec::<login_rate_limits::Model>::new()])
            .append_query_results([vec![user]])
            .append_query_results([vec![credentials]])
    }

    #[tokio::test]
    async fn healthz_returns_ok_and_request_id_header() {
        let db = MockDatabase::new(DatabaseBackend::Postgres).into_connection();
        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::OK);
        assert!(response.headers().contains_key("x-request-id"));
    }

    #[tokio::test]
    async fn login_rejects_invalid_request_with_envelope_request_id() {
        let db = MockDatabase::new(DatabaseBackend::Postgres).into_connection();
        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .header("x-request-id", "req_test_invalid_login")
                .body(Body::from(r#"{"email":"","password":"123"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
        assert_eq!(
            response.headers().get("x-request-id").unwrap(),
            "req_test_invalid_login"
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "auth.invalid_credentials");
        assert_eq!(body["requestId"], "req_test_invalid_login");
    }

    #[tokio::test]
    async fn login_rejects_invalid_credentials_with_expected_error_code() {
        let now = Utc::now();
        let password_hash = Argon2::default()
            .hash_password("secret123".as_bytes(), &SaltString::generate(&mut OsRng))
            .unwrap()
            .to_string();
        let user = test_user(
            739_182_738_912_312_320,
            "user@example.com",
            Some("梦伴用户"),
            now,
        );
        let credentials = password_credentials::Model {
            app_user_id: user.id,
            password_hash,
            password_changed_at: now,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: None,
            updated_by: None,
            metadata: json!({}),
        };
        let rate_limit_insert_result = login_rate_limits::Model {
            id: 739_182_738_912_312_322,
            key_kind: "ip".to_string(),
            key_hash: vec![1, 2, 3, 4],
            window_started_at: now,
            attempts: 1,
            blocked_until: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: None,
            updated_by: None,
            metadata: json!({}),
        };
        let db = mock_login_user(user, credentials)
            .append_query_results([Vec::<login_rate_limits::Model>::new()])
            .append_query_results([vec![rate_limit_insert_result.clone()]])
            .append_query_results([Vec::<login_rate_limits::Model>::new()])
            .append_query_results([vec![rate_limit_insert_result.clone()]])
            .append_query_results([Vec::<login_rate_limits::Model>::new()])
            .append_query_results([vec![rate_limit_insert_result]])
            .into_connection();

        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"email":"user@example.com","password":"wrong-password"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::UNAUTHORIZED);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "auth.invalid_credentials");
        assert_eq!(body["message"], "邮箱或密码错误");
    }

    #[tokio::test]
    async fn login_rejects_rate_limited_requests() {
        let now = Utc::now();
        let blocked_until = now + chrono::Duration::minutes(5);
        let rate_limited_record = login_rate_limits::Model {
            id: 739_182_738_912_312_320,
            key_kind: "ip".to_string(),
            key_hash: vec![1, 2, 3, 4],
            window_started_at: now,
            attempts: 30,
            blocked_until: Some(blocked_until),
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: None,
            updated_by: None,
            metadata: json!({}),
        };
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![rate_limited_record]])
            .into_connection();

        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .header("x-forwarded-for", "203.0.113.10")
                .body(Body::from(
                    r#"{"email":"user@example.com","password":"secret123"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::TOO_MANY_REQUESTS);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "auth.rate_limited");
        assert_eq!(body["message"], "登录尝试过多，请稍后再试");
    }

    #[tokio::test]
    async fn login_returns_access_and_refresh_tokens() {
        let now = Utc::now();
        let password_hash = Argon2::default()
            .hash_password("secret123".as_bytes(), &SaltString::generate(&mut OsRng))
            .unwrap()
            .to_string();
        let user = test_user(
            739_182_738_912_312_320,
            "user@example.com",
            Some("梦伴用户"),
            now,
        );
        let credentials = password_credentials::Model {
            app_user_id: user.id,
            password_hash: password_hash.to_string(),
            password_changed_at: now,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: None,
            updated_by: None,
            metadata: json!({}),
        };
        let refresh_session = refresh_sessions::Model {
            id: 739_182_738_912_312_321,
            app_user_id: user.id,
            token_hash: vec![1, 2, 3, 4],
            expires_at: now,
            revoked_at: None,
            user_agent: Some("Rust test agent".to_string()),
            ip_hash: Some(vec![4, 3, 2, 1]),
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: Some(user.id),
            updated_by: Some(user.id),
            metadata: json!({}),
            last_used_at: Some(now),
        };
        let db = mock_login_user(user, credentials)
            .append_query_results([vec![refresh_session]])
            .into_connection();

        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"email":"USER@example.com","password":"secret123"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "ok");
        assert_eq!(body["data"]["user"]["id"], "739182738912312320");
        assert_eq!(body["data"]["user"]["email"], "user@example.com");
        assert_eq!(body["data"]["user"]["displayName"], "梦伴用户");
        assert!(body["data"]["accessToken"].as_str().unwrap().contains('.'));
        assert!(!body["data"]["refreshToken"].as_str().unwrap().is_empty());
        assert_eq!(body["data"]["accessTokenExpiresInSeconds"], 900);
    }

    #[tokio::test]
    async fn register_returns_access_and_refresh_tokens() {
        let now = Utc::now();
        let mut user = test_user(
            739_182_738_912_312_330,
            "new@example.com",
            Some("新用户"),
            now,
        );
        user.created_by = Some(user.id);
        user.updated_by = Some(user.id);
        let credentials = password_credentials::Model {
            app_user_id: user.id,
            password_hash: "argon2-hash".to_string(),
            password_changed_at: now,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: Some(user.id),
            updated_by: Some(user.id),
            metadata: json!({}),
        };
        let refresh_session = refresh_sessions::Model {
            id: 739_182_738_912_312_331,
            app_user_id: user.id,
            token_hash: vec![1, 2, 3, 4],
            expires_at: now,
            revoked_at: None,
            user_agent: None,
            ip_hash: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            created_by: Some(user.id),
            updated_by: Some(user.id),
            metadata: json!({}),
            last_used_at: Some(now),
        };
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([Vec::<app_users::Model>::new()])
            .append_query_results([vec![user]])
            .append_query_results([vec![credentials]])
            .append_query_results([vec![refresh_session]])
            .into_connection();

        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            sequential_id_generator(739_182_738_912_312_330),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"email":" NEW@example.com ","password":"secret123","displayName":" 新用户 "}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "ok");
        assert_eq!(body["data"]["user"]["id"], "739182738912312330");
        assert_eq!(body["data"]["user"]["email"], "new@example.com");
        assert_eq!(body["data"]["user"]["displayName"], "新用户");
        assert!(body["data"]["accessToken"].as_str().unwrap().contains('.'));
        assert!(!body["data"]["refreshToken"].as_str().unwrap().is_empty());
    }

    #[tokio::test]
    async fn register_rejects_existing_active_email() {
        let now = Utc::now();
        let user = test_user(739_182_738_912_312_320, "user@example.com", None, now);
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results([vec![user]])
            .into_connection();

        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"email":"user@example.com","password":"secret123"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::CONFLICT);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "auth.email_already_registered");
    }

    #[tokio::test]
    async fn register_rejects_invalid_request() {
        let db = MockDatabase::new(DatabaseBackend::Postgres).into_connection();
        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"email":"","password":"123"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(body["code"], "auth.invalid_register_request");
    }

    #[tokio::test]
    async fn register_preflight_returns_cors_headers() {
        let db = MockDatabase::new(DatabaseBackend::Postgres).into_connection();
        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
            test_auth_config(),
            test_login_rate_limit_config(),
            test_id_generator(),
        )
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/api/auth/register")
                .header("origin", "http://localhost:1420")
                .header("access-control-request-method", "POST")
                .header("access-control-request-headers", "content-type")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

        assert_eq!(response.status(), axum::http::StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .unwrap(),
            "*"
        );
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-methods")
                .unwrap(),
            "*"
        );
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-headers")
                .unwrap(),
            "*"
        );
    }
}
