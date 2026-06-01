use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::response::{error_response, error_response_with_request_id};

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("数据库访问失败")]
    Database(#[from] sea_orm::DbErr),
    #[error("{message}")]
    BadRequest {
        code: &'static str,
        message: &'static str,
        request_id: String,
    },
    #[error("{message}")]
    Unauthorized {
        code: &'static str,
        message: &'static str,
        request_id: String,
    },
    #[error("{message}")]
    TooManyRequests {
        code: &'static str,
        message: &'static str,
        request_id: String,
    },
    #[error("{message}")]
    ServiceUnavailable {
        code: &'static str,
        message: &'static str,
        request_id: String,
    },
    #[error("{message}")]
    Internal {
        code: &'static str,
        message: &'static str,
        request_id: String,
    },
}

impl ApiError {
    pub fn bad_request(
        code: &'static str,
        message: &'static str,
        request_id: impl Into<String>,
    ) -> Self {
        Self::BadRequest {
            code,
            message,
            request_id: request_id.into(),
        }
    }

    pub fn unauthorized(
        code: &'static str,
        message: &'static str,
        request_id: impl Into<String>,
    ) -> Self {
        Self::Unauthorized {
            code,
            message,
            request_id: request_id.into(),
        }
    }

    pub fn too_many_requests(
        code: &'static str,
        message: &'static str,
        request_id: impl Into<String>,
    ) -> Self {
        Self::TooManyRequests {
            code,
            message,
            request_id: request_id.into(),
        }
    }

    pub fn service_unavailable(
        code: &'static str,
        message: &'static str,
        request_id: impl Into<String>,
    ) -> Self {
        Self::ServiceUnavailable {
            code,
            message,
            request_id: request_id.into(),
        }
    }

    pub fn internal(
        code: &'static str,
        message: &'static str,
        request_id: impl Into<String>,
    ) -> Self {
        Self::Internal {
            code,
            message,
            request_id: request_id.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            Self::Database(_) => error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                "database_unavailable",
                "服务暂时不可用",
            ),
            Self::BadRequest {
                code,
                message,
                request_id,
            } => error_response_with_request_id(StatusCode::BAD_REQUEST, code, message, request_id),
            Self::Unauthorized {
                code,
                message,
                request_id,
            } => {
                error_response_with_request_id(StatusCode::UNAUTHORIZED, code, message, request_id)
            }
            Self::TooManyRequests {
                code,
                message,
                request_id,
            } => error_response_with_request_id(
                StatusCode::TOO_MANY_REQUESTS,
                code,
                message,
                request_id,
            ),
            Self::ServiceUnavailable {
                code,
                message,
                request_id,
            } => error_response_with_request_id(
                StatusCode::SERVICE_UNAVAILABLE,
                code,
                message,
                request_id,
            ),
            Self::Internal {
                code,
                message,
                request_id,
            } => error_response_with_request_id(
                StatusCode::INTERNAL_SERVER_ERROR,
                code,
                message,
                request_id,
            ),
        }
    }
}
