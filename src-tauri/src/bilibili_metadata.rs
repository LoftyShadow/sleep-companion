use crate::bilibili_common::{
    create_bilibili_client, ensure_bilibili_success, fetch_bilibili_json, fetch_bilibili_wbi_keys,
    normalize_image_url, now_unix_seconds, read_non_empty_string, read_number_as_string, read_path,
    read_u64, send_bilibili_request, signed_wbi_query, BilibiliCookieStore,
};
use crate::bilibili_session::{load_active_bilibili_session, StoredBilibiliSession};
use serde::{Deserialize, Serialize};
use serde_json::Value;
const DEFAULT_DM_IMG_LIST: &str = "[]";
const DEFAULT_DM_IMG_STR: &str = "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ";
const DEFAULT_DM_COVER_IMG_STR: &str = "QU5HTEUgKEFNRCwgQU1EIFJhZGVvbiA3ODBNIEdyYXBoaWNzIChyYWRlb25zaSBwaG9lbml4IEFDTyksIE9wZW5HTCBFUyAzLjIpR29vZ2xlIEluYy4gKEFNRC";
const DEFAULT_DM_IMG_INTER: &str = "{\"ds\":[],\"wh\":[1920,1080,1],\"of\":[0,0,0]}";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliMetadataReference {
    kind: String,
    value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliMetadata {
    title: String,
    image_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliCreatorProfile {
    mid: String,
    name: String,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliCreatorVideo {
    aid: Option<String>,
    bvid: String,
    title: String,
    cover_url: Option<String>,
    published_at: i64,
    duration_seconds: Option<u32>,
    play_count: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliCreatorVideos {
    creator: BilibiliCreatorProfile,
    has_more: bool,
    page: u32,
    page_size: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_pages: Option<u32>,
    videos: Vec<BilibiliCreatorVideo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliBrowserFingerprint {
    dm_img_list: Option<String>,
    dm_img_str: Option<String>,
    dm_cover_img_str: Option<String>,
    dm_img_inter: Option<String>,
}

const DEFAULT_CREATOR_VIDEO_PAGE: u32 = 1;
const DEFAULT_CREATOR_VIDEO_PAGE_SIZE: u32 = 5;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BilibiliCreatorFetchMode {
    Anonymous,
    Authenticated,
}

impl BilibiliCreatorFetchMode {
    fn label(self) -> &'static str {
        match self {
            Self::Anonymous => "匿名刷新",
            Self::Authenticated => "登录态刷新",
        }
    }
}

struct BilibiliCreatorRequestContext {
    cookie_store: BilibiliCookieStore,
    mode: BilibiliCreatorFetchMode,
}

fn read_i64(value: &Value, path: &[&str]) -> Option<i64> {
    let current_value = read_path(value, path)?;

    current_value.as_i64().or_else(|| {
        current_value
            .as_str()
            .and_then(|text| text.trim().parse::<i64>().ok())
    })
}

fn parse_duration_seconds(value: &Value, path: &[&str]) -> Option<u32> {
    let current_value = read_path(value, path)?;

    if let Some(duration) = current_value.as_u64() {
        return u32::try_from(duration).ok();
    }

    let duration_text = current_value.as_str()?.trim();
    if duration_text.is_empty() {
        return None;
    }

    if let Ok(duration) = duration_text.parse::<u32>() {
        return Some(duration);
    }

    let parts = duration_text
        .split(':')
        .map(|part| part.parse::<u32>())
        .collect::<Result<Vec<_>, _>>()
        .ok()?;

    match parts.as_slice() {
        [minutes, seconds] => Some(minutes.saturating_mul(60).saturating_add(*seconds)),
        [hours, minutes, seconds] => Some(
            hours
                .saturating_mul(3600)
                .saturating_add(minutes.saturating_mul(60))
                .saturating_add(*seconds),
        ),
        _ => None,
    }
}

fn ensure_bilibili_creator_success(value: &Value) -> Result<(), String> {
    ensure_bilibili_success(value, "B 站 UP 主视频接口返回失败")
}

fn validate_creator_mid(mid: &str) -> Result<String, String> {
    let normalized_mid = mid.trim();
    if normalized_mid.is_empty() {
        return Err("B 站 UP 主 mid 不能为空".to_string());
    }

    if normalized_mid
        .chars()
        .all(|character| character.is_ascii_digit())
    {
        Ok(normalized_mid.to_string())
    } else {
        Err("B 站 UP 主 mid 必须是数字".to_string())
    }
}

fn validate_creator_video_page(page: Option<u32>) -> Result<u32, String> {
    let normalized_page = page.unwrap_or(DEFAULT_CREATOR_VIDEO_PAGE);
    if normalized_page == 0 {
        return Err("B 站 UP 主视频页码必须大于 0".to_string());
    }

    Ok(normalized_page)
}

fn validate_creator_video_page_size(page_size: Option<u32>) -> Result<u32, String> {
    let normalized_page_size = page_size.unwrap_or(DEFAULT_CREATOR_VIDEO_PAGE_SIZE);
    if normalized_page_size == 0 {
        return Err("B 站 UP 主视频每页数量必须大于 0".to_string());
    }

    Ok(normalized_page_size)
}

fn create_creator_request_context(
    session: Option<&StoredBilibiliSession>,
) -> BilibiliCreatorRequestContext {
    let mut cookie_store = BilibiliCookieStore::new();
    let mode = if let Some(session) = session {
        session.write_cookies_to(&mut cookie_store);
        BilibiliCreatorFetchMode::Authenticated
    } else {
        BilibiliCreatorFetchMode::Anonymous
    };

    BilibiliCreatorRequestContext { cookie_store, mode }
}

fn parse_video_metadata(value: &Value) -> Result<BilibiliMetadata, String> {
    ensure_bilibili_success(value, "B 站元信息接口返回失败")?;

    let title = read_non_empty_string(value, &["data", "title"])
        .ok_or_else(|| "B 站视频元信息缺少标题".to_string())?;
    let image_url = normalize_image_url(read_non_empty_string(value, &["data", "pic"]));

    Ok(BilibiliMetadata {
        title: title.to_string(),
        image_url,
    })
}

fn parse_episode_metadata(value: &Value, episode_id: &str) -> Result<BilibiliMetadata, String> {
    ensure_bilibili_success(value, "B 站元信息接口返回失败")?;

    let result = value
        .get("result")
        .ok_or_else(|| "B 站番剧元信息缺少内容".to_string())?;
    let season_title = read_non_empty_string(value, &["result", "title"]).unwrap_or("B 站番剧");
    let episode = result
        .get("episodes")
        .and_then(Value::as_array)
        .and_then(|episodes| {
            episodes.iter().find(|episode| {
                episode
                    .get("ep_id")
                    .and_then(Value::as_i64)
                    .map(|id| id.to_string() == episode_id)
                    .unwrap_or(false)
            })
        });

    let episode_title = episode
        .and_then(|episode| read_non_empty_string(episode, &["share_copy"]))
        .or_else(|| episode.and_then(|episode| read_non_empty_string(episode, &["long_title"])))
        .or_else(|| episode.and_then(|episode| read_non_empty_string(episode, &["title"])));
    let title = episode_title.unwrap_or(season_title);
    let image_url = normalize_image_url(
        episode
            .and_then(|episode| read_non_empty_string(episode, &["cover"]))
            .or_else(|| read_non_empty_string(value, &["result", "cover"])),
    );

    Ok(BilibiliMetadata {
        title: title.to_string(),
        image_url,
    })
}

fn parse_live_metadata(value: &Value, room_id: &str) -> Result<BilibiliMetadata, String> {
    ensure_bilibili_success(value, "B 站元信息接口返回失败")?;

    let title = read_non_empty_string(value, &["data", "title"])
        .map(str::to_string)
        .unwrap_or_else(|| format!("直播间 {room_id}"));
    let image_url = normalize_image_url(
        read_non_empty_string(value, &["data", "user_cover"])
            .or_else(|| read_non_empty_string(value, &["data", "keyframe"])),
    );

    Ok(BilibiliMetadata { title, image_url })
}

fn parse_creator_video(value: &Value) -> Result<BilibiliCreatorVideo, String> {
    let bvid = read_non_empty_string(value, &["bvid"])
        .ok_or_else(|| "B 站 UP 主视频缺少 BV 号".to_string())?;
    let title = read_non_empty_string(value, &["title"])
        .ok_or_else(|| "B 站 UP 主视频缺少标题".to_string())?;
    let published_at =
        read_i64(value, &["created"]).ok_or_else(|| "B 站 UP 主视频缺少发布时间".to_string())?;
    let aid = read_number_as_string(value, &["aid"]);
    let cover_url = normalize_image_url(read_non_empty_string(value, &["pic"]));
    let duration_seconds = parse_duration_seconds(value, &["duration"])
        .or_else(|| parse_duration_seconds(value, &["length"]));
    let play_count = read_u64(value, &["stat", "view"]).or_else(|| read_u64(value, &["play"]));

    Ok(BilibiliCreatorVideo {
        aid,
        bvid: bvid.to_string(),
        title: title.to_string(),
        cover_url,
        published_at,
        duration_seconds,
        play_count,
    })
}

fn total_pages_from_count(total_count: u64, page_size: u32) -> u32 {
    let page_size = u64::from(page_size.max(1));
    u32::try_from(total_count.div_ceil(page_size))
        .unwrap_or(u32::MAX)
        .max(1)
}

fn parse_creator_videos(
    mid: &str,
    page: u32,
    page_size: u32,
    value: &Value,
) -> Result<BilibiliCreatorVideos, String> {
    ensure_bilibili_creator_success(value)?;

    let data = value
        .get("data")
        .ok_or_else(|| "B 站 UP 主视频响应缺少内容".to_string())?;
    let list = data
        .get("list")
        .ok_or_else(|| "B 站 UP 主视频响应缺少列表".to_string())?;
    let video_values = list
        .get("vlist")
        .and_then(Value::as_array)
        .ok_or_else(|| "B 站 UP 主视频响应缺少投稿列表".to_string())?;
    let videos = video_values
        .iter()
        .map(parse_creator_video)
        .collect::<Result<Vec<_>, _>>()?;
    let total_count = read_u64(list, &["count"])
        .or_else(|| read_u64(data, &["page", "count"]))
        .or_else(|| read_u64(data, &["page", "total"]));
    let total_pages = total_count.map(|count| total_pages_from_count(count, page_size));
    let has_more = total_pages.map(|pages| page < pages).unwrap_or(false);
    let creator_name = video_values
        .first()
        .and_then(|video| read_non_empty_string(video, &["author"]))
        .or_else(|| read_non_empty_string(data, &["card", "name"]))
        .unwrap_or("B 站 UP 主");
    let avatar_url = normalize_image_url(read_non_empty_string(data, &["card", "face"]));

    Ok(BilibiliCreatorVideos {
        creator: BilibiliCreatorProfile {
            mid: mid.to_string(),
            name: creator_name.to_string(),
            avatar_url,
        },
        has_more,
        page,
        page_size,
        total_count,
        total_pages,
        videos,
    })
}

fn validate_reference(reference: &BilibiliMetadataReference) -> Result<(), String> {
    if reference.value.trim().is_empty() {
        return Err("B 站元信息引用为空".to_string());
    }

    match reference.kind.as_str() {
        "bvid" => {
            if reference.value.starts_with("BV")
                && reference
                    .value
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric())
            {
                Ok(())
            } else {
                Err("B 站 BV 号格式不正确".to_string())
            }
        }
        "aid" | "ep" | "live" => {
            if reference
                .value
                .chars()
                .all(|character| character.is_ascii_digit())
            {
                Ok(())
            } else {
                Err("B 站数字标识格式不正确".to_string())
            }
        }
        _ => Err("不支持的 B 站元信息类型".to_string()),
    }
}

fn metadata_url(reference: &BilibiliMetadataReference) -> Result<String, String> {
    validate_reference(reference)?;

    match reference.kind.as_str() {
        "bvid" => Ok(format!(
            "https://api.bilibili.com/x/web-interface/view?bvid={}",
            reference.value
        )),
        "aid" => Ok(format!(
            "https://api.bilibili.com/x/web-interface/view?aid={}",
            reference.value
        )),
        "ep" => Ok(format!(
            "https://api.bilibili.com/pgc/view/web/season?ep_id={}",
            reference.value
        )),
        "live" => Ok(format!(
            "https://api.live.bilibili.com/room/v1/Room/get_info?room_id={}",
            reference.value
        )),
        _ => Err("不支持的 B 站元信息类型".to_string()),
    }
}

fn parse_metadata(
    reference: &BilibiliMetadataReference,
    value: &Value,
) -> Result<BilibiliMetadata, String> {
    match reference.kind.as_str() {
        "bvid" | "aid" => parse_video_metadata(value),
        "ep" => parse_episode_metadata(value, &reference.value),
        "live" => parse_live_metadata(value, &reference.value),
        _ => Err("不支持的 B 站元信息类型".to_string()),
    }
}

fn optional_non_empty(value: Option<String>, fallback: &str) -> String {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn normalize_browser_fingerprint(
    fingerprint: Option<BilibiliBrowserFingerprint>,
) -> BilibiliBrowserFingerprint {
    let fingerprint = fingerprint.unwrap_or(BilibiliBrowserFingerprint {
        dm_img_list: None,
        dm_img_str: None,
        dm_cover_img_str: None,
        dm_img_inter: None,
    });

    BilibiliBrowserFingerprint {
        dm_img_list: Some(optional_non_empty(
            fingerprint.dm_img_list,
            DEFAULT_DM_IMG_LIST,
        )),
        dm_img_str: Some(optional_non_empty(
            fingerprint.dm_img_str,
            DEFAULT_DM_IMG_STR,
        )),
        dm_cover_img_str: Some(optional_non_empty(
            fingerprint.dm_cover_img_str,
            DEFAULT_DM_COVER_IMG_STR,
        )),
        dm_img_inter: Some(optional_non_empty(
            fingerprint.dm_img_inter,
            DEFAULT_DM_IMG_INTER,
        )),
    }
}

fn fingerprint_value(
    fingerprint: &BilibiliBrowserFingerprint,
    read: impl Fn(&BilibiliBrowserFingerprint) -> &Option<String>,
) -> String {
    read(fingerprint).clone().unwrap_or_default()
}

fn creator_videos_url(
    mid: &str,
    page: u32,
    page_size: u32,
    img_key: &str,
    sub_key: &str,
    wts: i64,
    fingerprint: &BilibiliBrowserFingerprint,
) -> Result<String, String> {
    let query = signed_wbi_query(
        vec![
            (
                "dm_cover_img_str".to_string(),
                fingerprint_value(fingerprint, |value| &value.dm_cover_img_str),
            ),
            (
                "dm_img_inter".to_string(),
                fingerprint_value(fingerprint, |value| &value.dm_img_inter),
            ),
            (
                "dm_img_list".to_string(),
                fingerprint_value(fingerprint, |value| &value.dm_img_list),
            ),
            (
                "dm_img_str".to_string(),
                fingerprint_value(fingerprint, |value| &value.dm_img_str),
            ),
            ("index".to_string(), "0".to_string()),
            ("keyword".to_string(), String::new()),
            ("mid".to_string(), mid.to_string()),
            ("order".to_string(), "pubdate".to_string()),
            ("order_avoided".to_string(), "true".to_string()),
            ("platform".to_string(), "web".to_string()),
            ("pn".to_string(), page.to_string()),
            ("ps".to_string(), page_size.to_string()),
            ("special_type".to_string(), String::new()),
            ("tid".to_string(), "0".to_string()),
            ("web_location".to_string(), "333.1387".to_string()),
        ],
        img_key,
        sub_key,
        wts,
    )?;

    Ok(format!(
        "https://api.bilibili.com/x/space/wbi/arc/search?{query}"
    ))
}

async fn prepare_bilibili_creator_session(
    client: &reqwest::Client,
    cookie_store: &mut BilibiliCookieStore,
    mid: &str,
) -> Result<(), String> {
    send_bilibili_request(
        client
            .get(format!("https://space.bilibili.com/{mid}/upload/video"))
            .header("Referer", "https://www.bilibili.com/"),
        Some(cookie_store),
        "B 站匿名访问会话",
    )
    .await
    .map(|_| ())
}

async fn fetch_bilibili_creator_space_videos(
    client: &reqwest::Client,
    mid: &str,
    page: u32,
    page_size: u32,
    fingerprint: &BilibiliBrowserFingerprint,
    context: &mut BilibiliCreatorRequestContext,
) -> Result<BilibiliCreatorVideos, String> {
    prepare_bilibili_creator_session(client, &mut context.cookie_store, mid).await?;
    let (img_key, sub_key) = fetch_bilibili_wbi_keys(client, &mut context.cookie_store).await?;
    let url = creator_videos_url(
        mid,
        page,
        page_size,
        &img_key,
        &sub_key,
        now_unix_seconds()?,
        fingerprint,
    )?;
    let value = fetch_bilibili_json(
        client.get(url).header(
            "Referer",
            format!("https://space.bilibili.com/{mid}/upload/video"),
        ),
        Some(&mut context.cookie_store),
        "B 站 UP 主视频",
        "B 站 UP 主视频",
    )
    .await?;

    parse_creator_videos(mid, page, page_size, &value)
}

async fn fetch_bilibili_creator_videos_with_context(
    client: &reqwest::Client,
    mid: &str,
    page: u32,
    page_size: u32,
    fingerprint: &BilibiliBrowserFingerprint,
    context: &mut BilibiliCreatorRequestContext,
) -> Result<BilibiliCreatorVideos, String> {
    fetch_bilibili_creator_space_videos(client, mid, page, page_size, fingerprint, context)
        .await
        .map_err(|space_error| format!("{}失败：投稿接口：{space_error}", context.mode.label()))
}

async fn fetch_bilibili_creator_videos_with_session(
    mid: String,
    page: Option<u32>,
    page_size: Option<u32>,
    fingerprint: Option<BilibiliBrowserFingerprint>,
    session: Option<&StoredBilibiliSession>,
) -> Result<BilibiliCreatorVideos, String> {
    let normalized_mid = validate_creator_mid(&mid)?;
    let normalized_page = validate_creator_video_page(page)?;
    let normalized_page_size = validate_creator_video_page_size(page_size)?;
    let normalized_fingerprint = normalize_browser_fingerprint(fingerprint);
    let client = create_bilibili_client(10, "B 站 UP 主视频")?;

    if let Some(session) = session {
        let mut authenticated_context = create_creator_request_context(Some(session));
        let authenticated_result = fetch_bilibili_creator_videos_with_context(
            &client,
            &normalized_mid,
            normalized_page,
            normalized_page_size,
            &normalized_fingerprint,
            &mut authenticated_context,
        )
        .await;
        let Err(authenticated_error) = authenticated_result else {
            return authenticated_result;
        };

        let mut anonymous_context = create_creator_request_context(None);

        let anonymous_result = fetch_bilibili_creator_videos_with_context(
            &client,
            &normalized_mid,
            normalized_page,
            normalized_page_size,
            &normalized_fingerprint,
            &mut anonymous_context,
        )
        .await
        .map_err(|anonymous_error| {
            format!(
                "{authenticated_error}；匿名降级也失败：{anonymous_error}。可退出后重新扫码登录，或稍后重试。"
            )
        });

        return anonymous_result;
    }

    let mut anonymous_context = create_creator_request_context(None);
    fetch_bilibili_creator_videos_with_context(
        &client,
        &normalized_mid,
        normalized_page,
        normalized_page_size,
        &normalized_fingerprint,
        &mut anonymous_context,
    )
    .await
    .map_err(|error| format!("{error}。登录 B 站后可能提高刷新成功率。"))
}

#[tauri::command]
pub async fn fetch_bilibili_metadata(
    reference: BilibiliMetadataReference,
) -> Result<BilibiliMetadata, String> {
    let url = metadata_url(&reference)?;
    let client = create_bilibili_client(8, "B 站元信息")?;
    let value = fetch_bilibili_json(client.get(url), None, "B 站元信息", "B 站元信息").await?;

    parse_metadata(&reference, &value)
}

#[tauri::command]
pub async fn fetch_bilibili_creator_videos(
    app: tauri::AppHandle,
    mid: String,
    page: Option<u32>,
    page_size: Option<u32>,
    fingerprint: Option<BilibiliBrowserFingerprint>,
) -> Result<BilibiliCreatorVideos, String> {
    let session = load_active_bilibili_session(&app)?;

    fetch_bilibili_creator_videos_with_session(mid, page, page_size, fingerprint, session.as_ref())
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bilibili_common::parse_wbi_keys;

    #[test]
    fn parses_live_metadata() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "title": "直播标题",
                "user_cover": "//i0.hdslb.com/cover.jpg"
            }
        });

        let metadata = parse_live_metadata(&value, "24678311").unwrap();

        assert_eq!(metadata.title, "直播标题");
        assert_eq!(
            metadata.image_url,
            Some("https://i0.hdslb.com/cover.jpg".to_string())
        );
    }

    #[test]
    fn parses_video_metadata() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "title": "视频标题",
                "pic": "//i0.hdslb.com/video.jpg"
            }
        });

        let metadata = parse_video_metadata(&value).unwrap();

        assert_eq!(metadata.title, "视频标题");
        assert_eq!(
            metadata.image_url,
            Some("https://i0.hdslb.com/video.jpg".to_string())
        );
    }

    #[test]
    fn parses_episode_metadata() {
        let value = serde_json::json!({
            "code": 0,
            "result": {
                "title": "番剧标题",
                "cover": "https://i0.hdslb.com/season.jpg",
                "episodes": [
                    {
                        "ep_id": 12345,
                        "share_copy": "《番剧标题》第1话",
                        "cover": "https://i0.hdslb.com/episode.jpg"
                    }
                ]
            }
        });

        let metadata = parse_episode_metadata(&value, "12345").unwrap();

        assert_eq!(metadata.title, "《番剧标题》第1话");
        assert_eq!(
            metadata.image_url,
            Some("https://i0.hdslb.com/episode.jpg".to_string())
        );
    }

    #[test]
    fn validates_creator_mid_and_page_size() {
        assert_eq!(validate_creator_mid(" 123456 ").unwrap(), "123456");
        assert!(validate_creator_mid("space123").is_err());
        assert_eq!(
            validate_creator_video_page(None).unwrap(),
            DEFAULT_CREATOR_VIDEO_PAGE
        );
        assert!(validate_creator_video_page(Some(0)).is_err());
        assert_eq!(
            validate_creator_video_page_size(None).unwrap(),
            DEFAULT_CREATOR_VIDEO_PAGE_SIZE
        );
        assert!(validate_creator_video_page_size(Some(0)).is_err());
        assert_eq!(validate_creator_video_page_size(Some(120)).unwrap(), 120);
    }

    #[test]
    fn parses_wbi_keys_from_nav_response() {
        let value = serde_json::json!({
            "code": -101,
            "message": "账号未登录",
            "data": {
                "wbi_img": {
                    "img_url": "https://i0.hdslb.com/bfs/wbi/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
                    "sub_url": "https://i0.hdslb.com/bfs/wbi/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png"
                }
            }
        });

        let (img_key, sub_key) = parse_wbi_keys(&value).unwrap();

        assert_eq!(img_key, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert_eq!(sub_key, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    }

    #[test]
    fn builds_signed_wbi_query() {
        let query = signed_wbi_query(
            vec![
                ("mid".to_string(), "123456".to_string()),
                ("order".to_string(), "pubdate".to_string()),
                ("keyword".to_string(), "a!b*c".to_string()),
            ],
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            1710000000,
        )
        .unwrap();

        assert!(query.contains("keyword=abc"));
        assert!(query.contains("mid=123456"));
        assert!(query.contains("order=pubdate"));
        assert!(query.contains("wts=1710000000"));
        assert!(query.contains("w_rid="));
    }

    #[test]
    fn parses_creator_videos() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "list": {
                    "count": 18,
                    "vlist": [
                        {
                            "aid": 170001,
                            "author": "测试UP",
                            "bvid": "BV1xx411c7mD",
                            "created": 1710000000,
                            "duration": "01:02",
                            "pic": "//i0.hdslb.com/video.jpg",
                            "stat": {
                                "view": 1024
                            },
                            "title": "最新视频"
                        }
                    ]
                }
            }
        });

        let videos = parse_creator_videos("123456", 2, 5, &value).unwrap();

        assert_eq!(videos.creator.mid, "123456");
        assert_eq!(videos.creator.name, "测试UP");
        assert_eq!(videos.page, 2);
        assert_eq!(videos.page_size, 5);
        assert_eq!(videos.total_count, Some(18));
        assert_eq!(videos.total_pages, Some(4));
        assert!(videos.has_more);
        assert_eq!(videos.videos.len(), 1);
        assert_eq!(videos.videos[0].aid, Some("170001".to_string()));
        assert_eq!(videos.videos[0].bvid, "BV1xx411c7mD");
        assert_eq!(videos.videos[0].duration_seconds, Some(62));
        assert_eq!(videos.videos[0].play_count, Some(1024));
        assert_eq!(
            videos.videos[0].cover_url,
            Some("https://i0.hdslb.com/video.jpg".to_string())
        );
    }

    #[test]
    #[ignore = "外网验证依赖 B 站当前风控策略和本机网络，只在调试 UP 主刷新时手动运行"]
    fn fetches_creator_videos_from_bilibili_for_uid_15810() {
        let videos = tauri::async_runtime::block_on(fetch_bilibili_creator_videos_with_session(
            "15810".to_string(),
            Some(1),
            Some(5),
            Some(BilibiliBrowserFingerprint {
                dm_img_list: Some(DEFAULT_DM_IMG_LIST.to_string()),
                dm_img_str: Some(DEFAULT_DM_IMG_STR.to_string()),
                dm_cover_img_str: Some(
                    "QU5HTEUgKEdvb2dsZSwgQ2hyb21pdW0pR29vZ2xlIEluYy4=".to_string(),
                ),
                dm_img_inter: Some("{\"ds\":[],\"wh\":[1920,1080,100],\"of\":[0,0,0]}".to_string()),
            }),
            None,
        ))
        .unwrap();

        assert_eq!(videos.creator.mid, "15810");
        assert_eq!(videos.creator.name, "Mr.Quin");
        assert!(!videos.videos.is_empty());
        assert!(videos.videos[0].bvid.starts_with("BV"));
    }
}
