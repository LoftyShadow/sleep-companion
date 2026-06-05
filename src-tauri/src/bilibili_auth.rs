use crate::bilibili_common::{non_empty, now_unix_seconds_or_zero, BILIBILI_BROWSER_USER_AGENT};
use crate::bilibili_session::{
    clear_bilibili_session, load_bilibili_session, save_bilibili_session, BilibiliAuthAccount,
    BilibiliAuthStatus, StoredBilibiliSession,
};
use qrcode::{render::svg, QrCode};
use reqwest::header::{COOKIE, SET_COOKIE};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const BILIBILI_WEB_LOGIN_WINDOW_LABEL: &str = "bilibili-web-login";
const BILIBILI_WEB_LOGIN_URL: &str = "https://passport.bilibili.com/login";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliLoginQr {
    expires_in_seconds: u16,
    qr_svg: String,
    qrcode_key: String,
    url: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BilibiliLoginPollState {
    Error,
    Expired,
    Pending,
    Scanned,
    Success,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliLoginPollResult {
    account: Option<BilibiliAuthAccount>,
    message: Option<String>,
    state: BilibiliLoginPollState,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliCookieLoginResult {
    account: Option<BilibiliAuthAccount>,
    message: String,
}

#[derive(Debug, Deserialize)]
struct QrCodeResponse {
    code: i64,
    data: Option<QrCodeData>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QrCodeData {
    qrcode_key: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PollResponse {
    code: i64,
    data: Option<PollData>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PollData {
    code: i64,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NavResponse {
    code: i64,
    data: Option<NavData>,
}

#[derive(Debug, Deserialize)]
struct NavData {
    face: Option<String>,
    #[serde(default, rename = "isLogin")]
    is_login: bool,
    mid: Option<u64>,
    uname: Option<String>,
}

#[derive(Debug, Default, PartialEq, Eq)]
struct ParsedBilibiliCookies {
    cookies: BTreeMap<String, String>,
    sess_data_expires_at: Option<i64>,
}

fn create_bilibili_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(BILIBILI_BROWSER_USER_AGENT)
        .build()
        .map_err(|error| format!("创建 B 站登录请求失败：{error}"))
}

fn create_login_qr_svg(url: &str) -> Result<String, String> {
    let code =
        QrCode::new(url.as_bytes()).map_err(|error| format!("生成 B 站登录二维码失败：{error}"))?;

    Ok(code
        .render::<svg::Color<'_>>()
        .min_dimensions(168, 168)
        .dark_color(svg::Color("#14211c"))
        .light_color(svg::Color("#ffffff"))
        .build())
}

fn cookie_value(cookies: &BTreeMap<String, String>, name: &str) -> Option<String> {
    cookies
        .get(name)
        .map(String::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn parse_max_age(attr: &str) -> Option<i64> {
    let (key, value) = attr.trim().split_once('=')?;
    if !key.eq_ignore_ascii_case("max-age") {
        return None;
    }

    value.trim().parse::<i64>().ok()
}

fn parse_set_cookie_lines<'a>(
    lines: impl IntoIterator<Item = &'a str>,
    now: i64,
) -> ParsedBilibiliCookies {
    let mut parsed = ParsedBilibiliCookies::default();

    for set_cookie in lines {
        let mut parts = set_cookie.split(';');
        let Some(cookie_pair) = parts.next() else {
            continue;
        };
        let Some((raw_name, raw_value)) = cookie_pair.split_once('=') else {
            continue;
        };
        let name = raw_name.trim();
        let value = raw_value.trim();
        if name.is_empty() || value.is_empty() {
            continue;
        }

        parsed.cookies.insert(name.to_string(), value.to_string());
        if name == "SESSDATA" {
            parsed.sess_data_expires_at = parts
                .filter_map(parse_max_age)
                .find(|max_age| *max_age > 0)
                .map(|max_age| now.saturating_add(max_age));
        }
    }

    parsed
}

fn parse_cookie_pair(cookie_pair: &str) -> Option<(String, String)> {
    let (raw_name, raw_value) = cookie_pair.split_once('=')?;
    let name = raw_name.trim();
    let value = raw_value.trim();
    if name.is_empty() || value.is_empty() {
        return None;
    }

    Some((name.to_string(), value.to_string()))
}

fn parse_cookie_header_text(text: &str) -> ParsedBilibiliCookies {
    let mut parsed = ParsedBilibiliCookies::default();

    for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let cookie_text = line
            .strip_prefix("Cookie:")
            .or_else(|| line.strip_prefix("cookie:"))
            .unwrap_or(line)
            .trim();

        for cookie_pair in cookie_text.split(';') {
            if let Some((name, value)) = parse_cookie_pair(cookie_pair) {
                parsed.cookies.insert(name, value);
            }
        }
    }

    parsed
}

fn parse_cookie_text(text: &str, now: i64) -> ParsedBilibiliCookies {
    let trimmed_text = text.trim();
    if trimmed_text.is_empty() {
        return ParsedBilibiliCookies::default();
    }

    let set_cookie_lines = trimmed_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            line.strip_prefix("Set-Cookie:")
                .or_else(|| line.strip_prefix("set-cookie:"))
                .map(str::trim)
        })
        .collect::<Vec<_>>();
    if !set_cookie_lines.is_empty() {
        return parse_set_cookie_lines(set_cookie_lines, now);
    }

    let has_cookie_attributes = trimmed_text
        .split(';')
        .any(|attr| parse_max_age(attr).is_some())
        || trimmed_text
            .split(';')
            .any(|attr| attr.trim().eq_ignore_ascii_case("httponly"));
    if has_cookie_attributes {
        return parse_set_cookie_lines(trimmed_text.lines().map(str::trim), now);
    }

    parse_cookie_header_text(trimmed_text)
}

fn parse_webview_cookies(
    cookies: Vec<tauri::webview::Cookie<'static>>,
    now: i64,
) -> ParsedBilibiliCookies {
    let mut parsed = ParsedBilibiliCookies::default();

    for cookie in cookies {
        let name = cookie.name().trim();
        let value = cookie.value().trim();
        if name.is_empty() || value.is_empty() {
            continue;
        }

        if name == "SESSDATA" {
            parsed.sess_data_expires_at = cookie.expires_datetime().map(|expires_at| {
                let unix_timestamp = expires_at.unix_timestamp();
                if unix_timestamp > 0 {
                    unix_timestamp
                } else {
                    now
                }
            });
        }

        parsed.cookies.insert(name.to_string(), value.to_string());
    }

    parsed
}

fn response_set_cookie_lines(response: &reqwest::Response) -> Vec<String> {
    response
        .headers()
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .map(str::to_string)
        .collect()
}

fn create_cookie_header(session: &StoredBilibiliSession) -> String {
    let mut cookies = BTreeMap::new();
    session.write_cookies_to(&mut cookies);

    cookies
        .into_iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("; ")
}

fn login_poll_state_from_code(code: i64) -> BilibiliLoginPollState {
    match code {
        0 => BilibiliLoginPollState::Success,
        86038 => BilibiliLoginPollState::Expired,
        86090 => BilibiliLoginPollState::Scanned,
        86101 => BilibiliLoginPollState::Pending,
        _ => BilibiliLoginPollState::Error,
    }
}

fn create_session_from_cookies(
    parsed_cookies: ParsedBilibiliCookies,
    now: i64,
) -> Result<StoredBilibiliSession, String> {
    let sess_data = cookie_value(&parsed_cookies.cookies, "SESSDATA")
        .ok_or_else(|| "B 站登录成功但没有返回 SESSDATA".to_string())?;
    let mut session = StoredBilibiliSession::new(sess_data, now);

    session.bili_jct = cookie_value(&parsed_cookies.cookies, "bili_jct");
    session.buvid3 = cookie_value(&parsed_cookies.cookies, "buvid3");
    session.dede_user_id = cookie_value(&parsed_cookies.cookies, "DedeUserID");
    session.dede_user_id_ck_md5 = cookie_value(&parsed_cookies.cookies, "DedeUserID__ckMd5");
    session.expires_at = parsed_cookies.sess_data_expires_at;
    session.mid = session.dede_user_id.clone();
    session.sid = cookie_value(&parsed_cookies.cookies, "sid");

    Ok(session)
}

async fn save_validated_session_from_cookies(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    parsed_cookies: ParsedBilibiliCookies,
    now: i64,
) -> Result<StoredBilibiliSession, String> {
    let mut session = create_session_from_cookies(parsed_cookies, now)?;
    let account = fetch_nav_account(client, &session)
        .await
        .ok_or_else(|| "B 站登录态验证失败，请确认已登录或 Cookie 未过期".to_string())?;

    session.apply_account(account);
    save_bilibili_session(app, &session)?;

    Ok(session)
}

async fn fetch_nav_account(
    client: &reqwest::Client,
    session: &StoredBilibiliSession,
) -> Option<BilibiliAuthAccount> {
    let cookie_header = create_cookie_header(session);
    if cookie_header.is_empty() {
        return None;
    }

    let response = client
        .get("https://api.bilibili.com/x/web-interface/nav")
        .header(COOKIE, cookie_header)
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .ok()?;
    let value = response.json::<NavResponse>().await.ok()?;
    if value.code != 0 {
        return None;
    }

    let data = value.data?;
    if !data.is_login {
        return None;
    }

    let mid = data.mid.filter(|mid| *mid > 0)?.to_string();
    let name = non_empty(data.uname).unwrap_or_else(|| "B 站账号".to_string());

    Some(BilibiliAuthAccount {
        avatar_url: non_empty(data.face),
        mid,
        name,
    })
}

#[tauri::command]
pub async fn create_bilibili_login_qr() -> Result<BilibiliLoginQr, String> {
    let client = create_bilibili_client()?;
    let response = client
        .get("https://passport.bilibili.com/x/passport-login/web/qrcode/generate")
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("请求 B 站登录二维码失败：{error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("请求 B 站登录二维码失败：HTTP {status}"));
    }

    let value = response
        .json::<QrCodeResponse>()
        .await
        .map_err(|error| format!("解析 B 站登录二维码失败：{error}"))?;
    if value.code != 0 {
        return Err(value
            .message
            .unwrap_or_else(|| "B 站登录二维码接口返回失败".to_string()));
    }

    let data = value
        .data
        .ok_or_else(|| "B 站登录二维码响应缺少内容".to_string())?;
    let url = non_empty(data.url).ok_or_else(|| "B 站登录二维码响应缺少 URL".to_string())?;
    let qr_svg = create_login_qr_svg(&url)?;
    let qrcode_key =
        non_empty(data.qrcode_key).ok_or_else(|| "B 站登录二维码响应缺少 key".to_string())?;

    Ok(BilibiliLoginQr {
        expires_in_seconds: 180,
        qr_svg,
        qrcode_key,
        url,
    })
}

#[tauri::command]
pub async fn poll_bilibili_login_qr(
    app: tauri::AppHandle,
    qrcode_key: String,
) -> Result<BilibiliLoginPollResult, String> {
    let normalized_key = qrcode_key.trim();
    if normalized_key.is_empty() {
        return Err("B 站登录二维码 key 不能为空".to_string());
    }

    let client = create_bilibili_client()?;
    let response = client
        .get("https://passport.bilibili.com/x/passport-login/web/qrcode/poll")
        .query(&[("qrcode_key", normalized_key)])
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("轮询 B 站登录状态失败：{error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("轮询 B 站登录状态失败：HTTP {status}"));
    }

    let set_cookie_lines = response_set_cookie_lines(&response);
    let value = response
        .json::<PollResponse>()
        .await
        .map_err(|error| format!("解析 B 站登录状态失败：{error}"))?;
    if value.code != 0 {
        return Ok(BilibiliLoginPollResult {
            account: None,
            message: value.message,
            state: BilibiliLoginPollState::Error,
        });
    }

    let data = value
        .data
        .ok_or_else(|| "B 站登录状态响应缺少内容".to_string())?;
    let state = login_poll_state_from_code(data.code);
    if state != BilibiliLoginPollState::Success {
        return Ok(BilibiliLoginPollResult {
            account: None,
            message: data.message,
            state,
        });
    }

    let now = now_unix_seconds_or_zero();
    let parsed_cookies = parse_set_cookie_lines(set_cookie_lines.iter().map(String::as_str), now);
    let session = save_validated_session_from_cookies(&app, &client, parsed_cookies, now).await?;

    Ok(BilibiliLoginPollResult {
        account: session.account(),
        message: Some("登录成功".to_string()),
        state,
    })
}

fn is_allowed_bilibili_login_host(host: &str) -> bool {
    host == "bilibili.com"
        || host.ends_with(".bilibili.com")
        || host == "biligame.com"
        || host.ends_with(".biligame.com")
        || host == "geetest.com"
        || host.ends_with(".geetest.com")
        || host == "geevisit.com"
        || host.ends_with(".geevisit.com")
        || host == "gtimg.com"
        || host.ends_with(".gtimg.com")
        || host == "qq.com"
        || host.ends_with(".qq.com")
}

#[tauri::command]
pub async fn open_bilibili_web_login(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(BILIBILI_WEB_LOGIN_WINDOW_LABEL) {
        window
            .show()
            .map_err(|error| format!("显示 B 站网页登录窗口失败：{error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦 B 站网页登录窗口失败：{error}"))?;
        return Ok(());
    }

    let login_url = BILIBILI_WEB_LOGIN_URL
        .parse()
        .map_err(|error| format!("解析 B 站网页登录地址失败：{error}"))?;

    WebviewWindowBuilder::new(
        &app,
        BILIBILI_WEB_LOGIN_WINDOW_LABEL,
        WebviewUrl::External(login_url),
    )
    .title("B 站网页登录")
    .inner_size(520.0, 720.0)
    .min_inner_size(420.0, 560.0)
    .resizable(true)
    .center()
    .focused(true)
    .on_navigation(|url| {
        url.scheme() == "https"
            && url
                .host_str()
                .map(is_allowed_bilibili_login_host)
                .unwrap_or(false)
    })
    .build()
    .map_err(|error| format!("打开 B 站网页登录窗口失败：{error}"))?;

    Ok(())
}

#[tauri::command]
pub async fn sync_bilibili_web_login_cookies(
    app: tauri::AppHandle,
) -> Result<BilibiliCookieLoginResult, String> {
    let window = app
        .get_webview_window(BILIBILI_WEB_LOGIN_WINDOW_LABEL)
        .ok_or_else(|| "请先打开 B 站网页登录窗口并完成登录".to_string())?;
    let cookie_url = "https://www.bilibili.com/"
        .parse()
        .map_err(|error| format!("解析 B 站 Cookie 地址失败：{error}"))?;
    let cookies = window
        .cookies_for_url(cookie_url)
        .map_err(|error| format!("读取 B 站网页登录 Cookie 失败：{error}"))?;

    let now = now_unix_seconds_or_zero();
    let parsed_cookies = parse_webview_cookies(cookies, now);
    let client = create_bilibili_client()?;
    let session = save_validated_session_from_cookies(&app, &client, parsed_cookies, now).await?;

    Ok(BilibiliCookieLoginResult {
        account: session.account(),
        message: "网页登录已同步".to_string(),
    })
}

#[tauri::command]
pub async fn import_bilibili_login_cookies(
    app: tauri::AppHandle,
    cookie_text: String,
) -> Result<BilibiliCookieLoginResult, String> {
    let normalized_cookie_text = cookie_text.trim();
    if normalized_cookie_text.is_empty() {
        return Err("B 站 Cookie 不能为空".to_string());
    }

    let now = now_unix_seconds_or_zero();
    let parsed_cookies = parse_cookie_text(normalized_cookie_text, now);
    let client = create_bilibili_client()?;
    let session = save_validated_session_from_cookies(&app, &client, parsed_cookies, now).await?;

    Ok(BilibiliCookieLoginResult {
        account: session.account(),
        message: "Cookie 导入成功".to_string(),
    })
}

#[tauri::command]
pub fn get_bilibili_auth_status(app: tauri::AppHandle) -> Result<BilibiliAuthStatus, String> {
    let session = load_bilibili_session(&app)?;

    Ok(BilibiliAuthStatus::from_session(session.as_ref()))
}

#[tauri::command]
pub fn logout_bilibili(app: tauri::AppHandle) -> Result<(), String> {
    clear_bilibili_session(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_set_cookie_headers_without_exposing_raw_header() {
        let parsed = parse_set_cookie_lines(
            [
                "SESSDATA=sess-secret; Path=/; Max-Age=100",
                "bili_jct=csrf-secret; Path=/",
                "DedeUserID=123456; Path=/",
                "DedeUserID__ckMd5=ck-secret; Path=/",
                "sid=sid-secret; Path=/",
            ],
            1_000,
        );

        assert_eq!(
            parsed.cookies.get("SESSDATA").map(String::as_str),
            Some("sess-secret")
        );
        assert_eq!(
            parsed.cookies.get("bili_jct").map(String::as_str),
            Some("csrf-secret")
        );
        assert_eq!(
            parsed.cookies.get("DedeUserID").map(String::as_str),
            Some("123456")
        );
        assert_eq!(parsed.sess_data_expires_at, Some(1_100));
    }

    #[test]
    fn creates_session_from_login_cookies() {
        let parsed = parse_set_cookie_lines(
            [
                "SESSDATA=sess-secret; Path=/",
                "bili_jct=csrf-secret; Path=/",
                "DedeUserID=123456; Path=/",
            ],
            1_000,
        );

        let session = create_session_from_cookies(parsed, 1_000).unwrap();

        assert_eq!(session.sess_data, "sess-secret");
        assert_eq!(session.bili_jct.as_deref(), Some("csrf-secret"));
        assert_eq!(session.mid.as_deref(), Some("123456"));
        assert_eq!(session.dede_user_id.as_deref(), Some("123456"));
    }

    #[test]
    fn parses_cookie_header_text() {
        let parsed = parse_cookie_text(
            "Cookie: SESSDATA=sess-secret; bili_jct=csrf-secret; DedeUserID=123456",
            1_000,
        );

        assert_eq!(
            parsed.cookies.get("SESSDATA").map(String::as_str),
            Some("sess-secret")
        );
        assert_eq!(
            parsed.cookies.get("bili_jct").map(String::as_str),
            Some("csrf-secret")
        );
        assert_eq!(
            parsed.cookies.get("DedeUserID").map(String::as_str),
            Some("123456")
        );
    }

    #[test]
    fn parses_prefixed_set_cookie_text() {
        let parsed = parse_cookie_text(
            "Set-Cookie: SESSDATA=sess-secret; Path=/; Max-Age=100\nSet-Cookie: bili_jct=csrf-secret; Path=/",
            1_000,
        );

        assert_eq!(
            parsed.cookies.get("SESSDATA").map(String::as_str),
            Some("sess-secret")
        );
        assert_eq!(
            parsed.cookies.get("bili_jct").map(String::as_str),
            Some("csrf-secret")
        );
        assert_eq!(parsed.sess_data_expires_at, Some(1_100));
    }

    #[test]
    fn rejects_login_without_sessdata() {
        let parsed = parse_set_cookie_lines(["bili_jct=csrf-secret; Path=/"], 1_000);

        let error = create_session_from_cookies(parsed, 1_000).unwrap_err();

        assert_eq!(error, "B 站登录成功但没有返回 SESSDATA");
    }

    #[test]
    fn maps_login_poll_codes_to_ui_states() {
        assert_eq!(
            login_poll_state_from_code(0),
            BilibiliLoginPollState::Success
        );
        assert_eq!(
            login_poll_state_from_code(86101),
            BilibiliLoginPollState::Pending
        );
        assert_eq!(
            login_poll_state_from_code(86090),
            BilibiliLoginPollState::Scanned
        );
        assert_eq!(
            login_poll_state_from_code(86038),
            BilibiliLoginPollState::Expired
        );
        assert_eq!(
            login_poll_state_from_code(-1),
            BilibiliLoginPollState::Error
        );
    }
}
