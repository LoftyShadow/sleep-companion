use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    body::Body,
    extract::Request,
    http::{header::HeaderValue, HeaderName},
    middleware::Next,
    response::Response,
};

pub static X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestId(String);

impl RequestId {
    pub fn new(value: String) -> Self {
        Self(value)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub async fn request_id_middleware(mut request: Request<Body>, next: Next) -> Response {
    let request_id = request
        .headers()
        .get(&X_REQUEST_ID)
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.to_string())
        .unwrap_or_else(generate_request_id);

    request
        .extensions_mut()
        .insert(RequestId::new(request_id.clone()));

    let mut response = next.run(request).await;
    if let Ok(header_value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert(&X_REQUEST_ID, header_value);
    }

    response
}

fn generate_request_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let sequence = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);

    format!("req_{millis}_{sequence}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_request_id_uses_req_prefix() {
        assert!(generate_request_id().starts_with("req_"));
    }
}
