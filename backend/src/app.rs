use std::sync::Arc;

use axum::{
    extract::{Extension, State},
    middleware,
    routing::get,
    Json, Router,
};
use sea_orm::DatabaseConnection;
use serde::Serialize;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use utoipa::OpenApi;
use utoipa::ToSchema;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    config::OpenApiConfig,
    db::ping_database,
    error::ApiError,
    openapi::ApiDoc,
    request_id::{request_id_middleware, RequestId},
    response::{ok_with_request_id, ApiResponse},
};

#[derive(Clone)]
pub struct AppState {
    db: Arc<DatabaseConnection>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    status: &'static str,
}

pub fn build_router(db: DatabaseConnection, openapi: OpenApiConfig) -> Router {
    let mut router = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .with_state(AppState { db: Arc::new(db) })
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
    ping_database(state.db.as_ref()).await?;

    Ok(ok_with_request_id(
        request_id.as_str(),
        HealthResponse { status: "ok" },
    ))
}

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::Request};
    use sea_orm::{DatabaseBackend, MockDatabase};
    use tower::ServiceExt;

    use super::*;

    #[tokio::test]
    async fn healthz_returns_ok_and_request_id_header() {
        let db = MockDatabase::new(DatabaseBackend::Postgres).into_connection();
        let response = build_router(
            db,
            OpenApiConfig {
                enabled: false,
                swagger_ui_enabled: false,
            },
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
}
