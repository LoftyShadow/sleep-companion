use serde_json::Value;
use std::collections::BTreeMap;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

pub const BILIBILI_BROWSER_USER_AGENT: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

pub type BilibiliCookieStore = BTreeMap<String, String>;

const WBI_MIXIN_KEY_ENC_TAB: [usize; 64] = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
    28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25,
    54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

pub fn now_unix_seconds() -> Result<i64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .map_err(|error| format!("读取当前时间失败：{error}"))
}

pub fn now_unix_seconds_or_zero() -> i64 {
    now_unix_seconds().unwrap_or(0)
}

pub fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

pub fn normalize_image_url(value: Option<&str>) -> Option<String> {
    let trimmed_value = value?.trim();
    if trimmed_value.is_empty() {
        return None;
    }

    if trimmed_value.starts_with("//") {
        return Some(format!("https:{trimmed_value}"));
    }

    if let Ok(mut url) = reqwest::Url::parse(trimmed_value) {
        if url.scheme() == "http" {
            let _ = url.set_scheme("https");
        }

        return Some(url.to_string());
    }

    Some(trimmed_value.to_string())
}

pub fn read_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current_value = value;
    for key in path {
        current_value = current_value.get(*key)?;
    }

    Some(current_value)
}

pub fn read_non_empty_string<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    read_path(value, path)?
        .as_str()
        .filter(|text| !text.trim().is_empty())
}

pub fn read_number_as_string(value: &Value, path: &[&str]) -> Option<String> {
    let current_value = read_path(value, path)?;

    if let Some(number) = current_value.as_i64() {
        return Some(number.to_string());
    }

    current_value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

pub fn read_u64(value: &Value, path: &[&str]) -> Option<u64> {
    let current_value = read_path(value, path)?;

    current_value.as_u64().or_else(|| {
        current_value
            .as_str()
            .and_then(|text| text.trim().parse::<u64>().ok())
    })
}

fn extract_wbi_key(image_url: &str) -> Option<String> {
    let url = reqwest::Url::parse(image_url).ok()?;
    let file_name = url.path_segments()?.next_back()?;
    let key = file_name.split('.').next()?.trim();

    if key.is_empty() {
        None
    } else {
        Some(key.to_string())
    }
}

pub fn parse_wbi_keys(value: &Value) -> Result<(String, String), String> {
    let img_url = read_non_empty_string(value, &["data", "wbi_img", "img_url"])
        .ok_or_else(|| "B 站 WBI 响应缺少图片 key".to_string())?;
    let sub_url = read_non_empty_string(value, &["data", "wbi_img", "sub_url"])
        .ok_or_else(|| "B 站 WBI 响应缺少子 key".to_string())?;
    let img_key = extract_wbi_key(img_url).ok_or_else(|| "B 站 WBI 图片 key 无效".to_string())?;
    let sub_key = extract_wbi_key(sub_url).ok_or_else(|| "B 站 WBI 子 key 无效".to_string())?;

    Ok((img_key, sub_key))
}

fn create_wbi_mixin_key(img_key: &str, sub_key: &str) -> String {
    let raw_key: Vec<char> = format!("{img_key}{sub_key}").chars().collect();

    WBI_MIXIN_KEY_ENC_TAB
        .iter()
        .filter_map(|index| raw_key.get(*index))
        .take(32)
        .collect()
}

fn sanitize_wbi_value(value: &str) -> String {
    value
        .chars()
        .filter(|character| !matches!(character, '!' | '\'' | '(' | ')' | '*'))
        .collect()
}

fn build_query_string(params: &[(String, String)]) -> Result<String, String> {
    let mut url = reqwest::Url::parse("https://api.bilibili.com/")
        .map_err(|error| format!("创建 B 站请求参数失败：{error}"))?;
    {
        let mut query_pairs = url.query_pairs_mut();
        query_pairs.clear();
        for (key, value) in params {
            query_pairs.append_pair(key, value);
        }
    }

    url.query()
        .map(str::to_string)
        .ok_or_else(|| "创建 B 站请求参数失败".to_string())
}

pub fn signed_wbi_query(
    mut params: Vec<(String, String)>,
    img_key: &str,
    sub_key: &str,
    wts: i64,
) -> Result<String, String> {
    params.push(("wts".to_string(), wts.to_string()));
    params.sort_by(|left, right| left.0.cmp(&right.0));

    let sanitized_params = params
        .into_iter()
        .map(|(key, value)| (key, sanitize_wbi_value(&value)))
        .collect::<Vec<_>>();
    let query = build_query_string(&sanitized_params)?;
    let mixin_key = create_wbi_mixin_key(img_key, sub_key);
    let w_rid = format!("{:x}", md5::compute(format!("{query}{mixin_key}")));
    let mut signed_params = sanitized_params;

    signed_params.push(("w_rid".to_string(), w_rid));
    build_query_string(&signed_params)
}

pub fn store_response_cookies(
    cookie_store: &mut BilibiliCookieStore,
    response: &reqwest::Response,
) {
    response
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|header_value| header_value.to_str().ok())
        .for_each(|set_cookie| {
            let cookie_pair = set_cookie.split(';').next().unwrap_or_default();
            let Some((key, value)) = cookie_pair.split_once('=') else {
                return;
            };
            if key.trim().is_empty() {
                return;
            }

            cookie_store.insert(key.trim().to_string(), value.to_string());
        });
}

fn cookie_header(cookie_store: &BilibiliCookieStore) -> String {
    cookie_store
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("; ")
}

pub fn apply_cookie_header(
    request: reqwest::RequestBuilder,
    cookie_store: &BilibiliCookieStore,
) -> reqwest::RequestBuilder {
    if cookie_store.is_empty() {
        request
    } else {
        request.header(reqwest::header::COOKIE, cookie_header(cookie_store))
    }
}

pub fn create_bilibili_client(
    timeout_seconds: u64,
    context: &str,
) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .user_agent(BILIBILI_BROWSER_USER_AGENT)
        .build()
        .map_err(|error| format!("创建 {context} 请求失败：{error}"))
}

pub fn ensure_bilibili_success(value: &Value, fallback_message: &str) -> Result<(), String> {
    let code = value
        .get("code")
        .and_then(Value::as_i64)
        .ok_or_else(|| "B 站接口响应缺少状态码".to_string())?;

    if code == 0 {
        return Ok(());
    }

    let message = value
        .get("message")
        .or_else(|| value.get("msg"))
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .unwrap_or(fallback_message);

    Err(message.to_string())
}

pub async fn send_bilibili_request(
    request: reqwest::RequestBuilder,
    cookie_store: Option<&mut BilibiliCookieStore>,
    request_context: &str,
) -> Result<reqwest::Response, String> {
    let request = if let Some(cookie_store) = cookie_store.as_deref() {
        apply_cookie_header(request, cookie_store)
    } else {
        request
    };
    let response = request
        .send()
        .await
        .map_err(|error| format!("请求 {request_context} 失败：{error}"))?;
    let status = response.status();

    if let Some(cookie_store) = cookie_store {
        store_response_cookies(cookie_store, &response);
    }

    if !status.is_success() {
        return Err(format!("请求 {request_context} 失败：HTTP {status}"));
    }

    Ok(response)
}

pub async fn fetch_bilibili_json(
    request: reqwest::RequestBuilder,
    cookie_store: Option<&mut BilibiliCookieStore>,
    request_context: &str,
    parse_context: &str,
) -> Result<Value, String> {
    let response = send_bilibili_request(request, cookie_store, request_context).await?;

    response
        .json::<Value>()
        .await
        .map_err(|error| format!("解析 {parse_context} 失败：{error}"))
}

pub async fn fetch_bilibili_wbi_keys(
    client: &reqwest::Client,
    cookie_store: &mut BilibiliCookieStore,
) -> Result<(String, String), String> {
    let value = fetch_bilibili_json(
        client
            .get("https://api.bilibili.com/x/web-interface/nav")
            .header("Referer", "https://www.bilibili.com/"),
        Some(cookie_store),
        "B 站 WBI 参数",
        "B 站 WBI 参数",
    )
    .await?;

    parse_wbi_keys(&value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_successful_bilibili_response() {
        let value = serde_json::json!({
            "code": 0,
        });

        assert!(ensure_bilibili_success(&value, "B 站接口返回失败").is_ok());
    }

    #[test]
    fn uses_bilibili_message_as_error_text() {
        let value = serde_json::json!({
            "code": -400,
            "message": "请求错误",
        });

        assert_eq!(
            ensure_bilibili_success(&value, "B 站接口返回失败").unwrap_err(),
            "请求错误"
        );
    }

    #[test]
    fn uses_bilibili_msg_as_error_text() {
        let value = serde_json::json!({
            "code": -101,
            "msg": "账号未登录",
        });

        assert_eq!(
            ensure_bilibili_success(&value, "B 站接口返回失败").unwrap_err(),
            "账号未登录"
        );
    }

    #[test]
    fn uses_fallback_error_text_when_bilibili_message_is_empty() {
        let value = serde_json::json!({
            "code": -1,
            "message": "",
            "msg": " ",
        });

        assert_eq!(
            ensure_bilibili_success(&value, "B 站接口返回失败").unwrap_err(),
            "B 站接口返回失败"
        );
    }

    #[test]
    fn rejects_response_without_bilibili_status_code() {
        let value = serde_json::json!({
            "message": "请求错误",
        });

        assert_eq!(
            ensure_bilibili_success(&value, "B 站接口返回失败").unwrap_err(),
            "B 站接口响应缺少状态码"
        );
    }
}
