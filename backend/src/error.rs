use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::response::error_response;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("数据库访问失败")]
    Database(#[from] sea_orm::DbErr),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            Self::Database(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "database_unavailable",
                "服务暂时不可用",
            ),
        };

        error_response(status, code, message)
    }
}
