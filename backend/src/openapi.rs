use utoipa::OpenApi;

use crate::{
    app::HealthResponse,
    response::{ApiErrorResponse, ApiResponse},
};

#[derive(OpenApi)]
#[openapi(
    paths(crate::app::healthz, crate::app::readyz),
    components(schemas(HealthResponse, ApiResponse<HealthResponse>, ApiErrorResponse)),
    tags(
        (name = "health", description = "后端健康检查接口")
    )
)]
pub struct ApiDoc;
