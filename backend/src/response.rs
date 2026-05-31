use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};
use utoipa::ToSchema;

const DEFAULT_REQUEST_ID: &str = "req_unavailable";

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiResponse<T>
where
    T: Serialize,
{
    pub code: &'static str,
    pub message: &'static str,
    pub data: T,
    #[serde(rename = "requestId")]
    pub request_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiErrorResponse {
    pub code: &'static str,
    pub message: &'static str,
    pub data: Option<Value>,
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub details: Value,
}

pub fn ok<T>(data: T) -> Json<ApiResponse<T>>
where
    T: Serialize,
{
    ok_with_request_id(DEFAULT_REQUEST_ID, data)
}

pub fn ok_with_request_id<T>(request_id: impl Into<String>, data: T) -> Json<ApiResponse<T>>
where
    T: Serialize,
{
    Json(ApiResponse {
        code: "ok",
        message: "ok",
        data,
        request_id: request_id.into(),
    })
}

pub fn error_response(status: StatusCode, code: &'static str, message: &'static str) -> Response {
    error_response_with_request_id(status, code, message, DEFAULT_REQUEST_ID)
}

pub fn error_response_with_request_id(
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    request_id: impl Into<String>,
) -> Response {
    (
        status,
        Json(ApiErrorResponse {
            code,
            message,
            data: None,
            request_id: request_id.into(),
            details: json!({}),
        }),
    )
        .into_response()
}
