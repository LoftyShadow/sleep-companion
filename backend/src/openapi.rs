use utoipa::OpenApi;

use crate::{
    app::HealthResponse,
    auth::{LoginRequest, LoginResponse, LoginUser, RegisterRequest},
    response::{ApiErrorResponse, ApiResponse},
};

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::app::healthz,
        crate::app::readyz,
        crate::auth::login,
        crate::auth::register
    ),
    components(schemas(
        HealthResponse,
        LoginRequest,
        RegisterRequest,
        LoginResponse,
        LoginUser,
        ApiResponse<HealthResponse>,
        ApiResponse<LoginResponse>,
        ApiErrorResponse
    )),
    tags(
        (name = "auth", description = "账户认证接口"),
        (name = "health", description = "后端健康检查接口")
    )
)]
pub struct ApiDoc;
