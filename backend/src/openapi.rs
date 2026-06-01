use utoipa::OpenApi;

use crate::{
    app::HealthResponse,
    auth::{LoginRequest, LoginResponse, LoginUser},
    response::{ApiErrorResponse, ApiResponse},
};

#[derive(OpenApi)]
#[openapi(
    paths(crate::app::healthz, crate::app::readyz, crate::auth::login),
    components(schemas(
        HealthResponse,
        LoginRequest,
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
