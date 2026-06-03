use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const BILIBILI_BROWSER_USER_AGENT: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
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
    videos: Vec<BilibiliCreatorVideo>,
}

struct BilibiliCreatorDynamicVideosPage {
    creator: BilibiliCreatorProfile,
    videos: Vec<BilibiliCreatorVideo>,
    has_more: bool,
    next_offset: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliBrowserFingerprint {
    dm_img_list: Option<String>,
    dm_img_str: Option<String>,
    dm_cover_img_str: Option<String>,
    dm_img_inter: Option<String>,
}

const DEFAULT_CREATOR_VIDEO_LIMIT: u8 = 12;
const MAX_CREATOR_VIDEO_LIMIT: u8 = 12;
const MAX_CREATOR_DYNAMIC_PAGE_COUNT: u8 = 5;
type BilibiliCookieStore = BTreeMap<String, String>;
const WBI_MIXIN_KEY_ENC_TAB: [usize; 64] = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
    28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25,
    54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

fn normalize_image_url(value: Option<&str>) -> Option<String> {
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

fn read_number_as_string(value: &Value, path: &[&str]) -> Option<String> {
    let mut current_value = value;
    for key in path {
        current_value = current_value.get(*key)?;
    }

    if let Some(number) = current_value.as_i64() {
        return Some(number.to_string());
    }

    current_value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn read_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current_value = value;
    for key in path {
        current_value = current_value.get(*key)?;
    }

    Some(current_value)
}

fn read_non_empty_string<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    read_path(value, path)?
        .as_str()
        .filter(|text| !text.trim().is_empty())
}

fn read_array<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Vec<Value>> {
    read_path(value, path)?.as_array()
}

fn read_u64(value: &Value, path: &[&str]) -> Option<u64> {
    let current_value = read_path(value, path)?;

    current_value.as_u64().or_else(|| {
        current_value
            .as_str()
            .and_then(|text| text.trim().parse::<u64>().ok())
    })
}

fn parse_bilibili_count_text(text: &str) -> Option<u64> {
    let trimmed_text = text.trim();
    if trimmed_text.is_empty() {
        return None;
    }

    if let Some(count_text) = trimmed_text.strip_suffix('万') {
        let count = count_text.trim().parse::<f64>().ok()?;

        return Some((count * 10_000.0).round() as u64);
    }

    trimmed_text.parse::<u64>().ok()
}

fn read_bilibili_count(value: &Value, path: &[&str]) -> Option<u64> {
    let current_value = read_path(value, path)?;

    current_value
        .as_u64()
        .or_else(|| current_value.as_str().and_then(parse_bilibili_count_text))
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

fn ensure_bilibili_success(value: &Value) -> Result<(), String> {
    let code = value
        .get("code")
        .and_then(Value::as_i64)
        .ok_or_else(|| "B 站元信息响应缺少状态码".to_string())?;

    if code == 0 {
        return Ok(());
    }

    let message = value
        .get("message")
        .or_else(|| value.get("msg"))
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .unwrap_or("B 站元信息接口返回失败");

    Err(message.to_string())
}

fn ensure_bilibili_creator_success(value: &Value) -> Result<(), String> {
    let code = value
        .get("code")
        .and_then(Value::as_i64)
        .ok_or_else(|| "B 站 UP 主视频响应缺少状态码".to_string())?;

    if code == 0 {
        return Ok(());
    }

    let message = value
        .get("message")
        .or_else(|| value.get("msg"))
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .unwrap_or("B 站 UP 主视频接口返回失败");

    Err(message.to_string())
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

fn validate_creator_video_limit(limit: Option<u8>) -> Result<u8, String> {
    let normalized_limit = limit.unwrap_or(DEFAULT_CREATOR_VIDEO_LIMIT);
    if normalized_limit == 0 || normalized_limit > MAX_CREATOR_VIDEO_LIMIT {
        return Err(format!(
            "B 站 UP 主视频刷新数量必须在 1 到 {MAX_CREATOR_VIDEO_LIMIT} 之间"
        ));
    }

    Ok(normalized_limit)
}

fn now_unix_seconds() -> Result<i64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .map_err(|error| format!("读取当前时间失败：{error}"))
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

fn modules_value<'a>(item: &'a Value, key: &str) -> Option<&'a Value> {
    read_array(item, &["modules"])?
        .iter()
        .find_map(|module| module.get(key))
}

fn store_response_cookies(cookie_store: &mut BilibiliCookieStore, response: &reqwest::Response) {
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

fn apply_cookie_header(
    request: reqwest::RequestBuilder,
    cookie_store: &BilibiliCookieStore,
) -> reqwest::RequestBuilder {
    if cookie_store.is_empty() {
        request
    } else {
        request.header(reqwest::header::COOKIE, cookie_header(cookie_store))
    }
}

fn signed_wbi_query(
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

fn parse_video_metadata(value: &Value) -> Result<BilibiliMetadata, String> {
    ensure_bilibili_success(value)?;

    let title = read_non_empty_string(value, &["data", "title"])
        .ok_or_else(|| "B 站视频元信息缺少标题".to_string())?;
    let image_url = normalize_image_url(read_non_empty_string(value, &["data", "pic"]));

    Ok(BilibiliMetadata {
        title: title.to_string(),
        image_url,
    })
}

fn parse_episode_metadata(value: &Value, episode_id: &str) -> Result<BilibiliMetadata, String> {
    ensure_bilibili_success(value)?;

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
    ensure_bilibili_success(value)?;

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

fn parse_creator_videos(mid: &str, value: &Value) -> Result<BilibiliCreatorVideos, String> {
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
        videos,
    })
}

fn parse_dynamic_creator_profile(mid: &str, value: &Value) -> Option<BilibiliCreatorProfile> {
    let user = modules_value(value, "module_author")?.get("user")?;
    let user_mid = read_i64(user, &["mid"]).map(|value| value.to_string())?;
    if user_mid != mid {
        return None;
    }

    let name = read_non_empty_string(user, &["name"])?;
    let avatar_url = normalize_image_url(read_non_empty_string(user, &["face"]));

    Some(BilibiliCreatorProfile {
        mid: user_mid,
        name: name.to_string(),
        avatar_url,
    })
}

fn parse_dynamic_archive_video(value: &Value) -> Option<BilibiliCreatorVideo> {
    let module_dynamic = modules_value(value, "module_dynamic")?;
    let archive = module_dynamic.get("dyn_archive")?;
    let bvid = read_non_empty_string(archive, &["bvid"])?;
    let title = read_non_empty_string(archive, &["title"])?;
    let author = modules_value(value, "module_author")?;
    let published_at = read_i64(author, &["pub_ts"])?;
    let aid = read_number_as_string(archive, &["aid"]);
    let cover_url = normalize_image_url(read_non_empty_string(archive, &["cover"]));
    let duration_seconds = parse_duration_seconds(archive, &["duration_text"]);
    let play_count = read_bilibili_count(archive, &["stat", "play"]);

    Some(BilibiliCreatorVideo {
        aid,
        bvid: bvid.to_string(),
        title: title.to_string(),
        cover_url,
        published_at,
        duration_seconds,
        play_count,
    })
}

fn fallback_creator_profile(mid: &str) -> BilibiliCreatorProfile {
    BilibiliCreatorProfile {
        mid: mid.to_string(),
        name: format!("UP {mid}"),
        avatar_url: None,
    }
}

fn parse_creator_dynamic_videos_page(
    mid: &str,
    limit: u8,
    value: &Value,
) -> Result<BilibiliCreatorDynamicVideosPage, String> {
    ensure_bilibili_creator_success(value)?;

    let items = read_array(value, &["data", "items"])
        .ok_or_else(|| "B 站 UP 主动态响应缺少内容".to_string())?;
    let has_more = read_path(value, &["data", "has_more"])
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let next_offset = read_non_empty_string(value, &["data", "offset"]).map(str::to_string);
    let mut creator = None;
    let mut seen_bvids = BTreeSet::new();
    let mut videos = Vec::new();

    for item in items {
        if creator.is_none() {
            creator = parse_dynamic_creator_profile(mid, item);
        }

        if videos.len() >= usize::from(limit) {
            break;
        }

        let Some(video) = parse_dynamic_archive_video(item) else {
            continue;
        };

        if seen_bvids.insert(video.bvid.clone()) {
            videos.push(video);
        }
    }

    Ok(BilibiliCreatorDynamicVideosPage {
        creator: creator.unwrap_or_else(|| fallback_creator_profile(mid)),
        videos,
        has_more,
        next_offset,
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

fn parse_wbi_keys(value: &Value) -> Result<(String, String), String> {
    let img_url = read_non_empty_string(value, &["data", "wbi_img", "img_url"])
        .ok_or_else(|| "B 站 WBI 响应缺少图片 key".to_string())?;
    let sub_url = read_non_empty_string(value, &["data", "wbi_img", "sub_url"])
        .ok_or_else(|| "B 站 WBI 响应缺少子 key".to_string())?;
    let img_key = extract_wbi_key(img_url).ok_or_else(|| "B 站 WBI 图片 key 无效".to_string())?;
    let sub_key = extract_wbi_key(sub_url).ok_or_else(|| "B 站 WBI 子 key 无效".to_string())?;

    Ok((img_key, sub_key))
}

async fn fetch_wbi_keys(
    client: &reqwest::Client,
    cookie_store: &mut BilibiliCookieStore,
) -> Result<(String, String), String> {
    let response = apply_cookie_header(
        client
            .get("https://api.bilibili.com/x/web-interface/nav")
            .header("Referer", "https://www.bilibili.com/"),
        cookie_store,
    )
    .send()
    .await
    .map_err(|error| format!("请求 B 站 WBI 参数失败：{error}"))?;
    store_response_cookies(cookie_store, &response);
    let status = response.status();
    if !status.is_success() {
        return Err(format!("请求 B 站 WBI 参数失败：HTTP {status}"));
    }
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("解析 B 站 WBI 参数失败：{error}"))?;

    parse_wbi_keys(&value)
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
    limit: u8,
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
            ("pn".to_string(), "1".to_string()),
            ("ps".to_string(), limit.to_string()),
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

fn creator_dynamic_videos_url(
    mid: &str,
    offset: Option<&str>,
    img_key: &str,
    sub_key: &str,
    wts: i64,
) -> Result<String, String> {
    let mut params = vec![
        ("features".to_string(), "itemOpusStyle".to_string()),
        ("host_mid".to_string(), mid.to_string()),
        ("timezone_offset".to_string(), "-480".to_string()),
        ("web_location".to_string(), "333.999".to_string()),
    ];

    if let Some(offset) = offset.filter(|value| !value.trim().is_empty()) {
        params.push(("offset".to_string(), offset.to_string()));
    }

    let query = signed_wbi_query(params, img_key, sub_key, wts)?;

    Ok(format!(
        "https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space?{query}"
    ))
}

async fn prepare_bilibili_creator_session(
    client: &reqwest::Client,
    cookie_store: &mut BilibiliCookieStore,
    mid: &str,
) -> Result<(), String> {
    let response = client
        .get(format!("https://space.bilibili.com/{mid}/upload/video"))
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("建立 B 站匿名访问会话失败：{error}"))?;
    store_response_cookies(cookie_store, &response);
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }

    Err(format!("建立 B 站匿名访问会话失败：HTTP {status}"))
}

async fn fetch_bilibili_creator_dynamic_videos_page(
    client: &reqwest::Client,
    mid: &str,
    limit: u8,
    cookie_store: &mut BilibiliCookieStore,
    img_key: &str,
    sub_key: &str,
    offset: Option<&str>,
) -> Result<BilibiliCreatorDynamicVideosPage, String> {
    let url = creator_dynamic_videos_url(mid, offset, img_key, sub_key, now_unix_seconds()?)?;
    let response = apply_cookie_header(
        client.get(url).header(
            "Referer",
            format!("https://space.bilibili.com/{mid}/dynamic"),
        ),
        cookie_store,
    )
    .send()
    .await
    .map_err(|error| format!("请求 B 站 UP 主动态失败：{error}"))?;
    store_response_cookies(cookie_store, &response);
    let status = response.status();
    if !status.is_success() {
        return Err(format!("请求 B 站 UP 主动态失败：HTTP {status}"));
    }
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("解析 B 站 UP 主动态失败：{error}"))?;

    parse_creator_dynamic_videos_page(mid, limit, &value)
}

async fn fetch_bilibili_creator_dynamic_videos(
    client: &reqwest::Client,
    mid: &str,
    limit: u8,
) -> Result<BilibiliCreatorVideos, String> {
    let mut cookie_store = BilibiliCookieStore::new();
    prepare_bilibili_creator_session(client, &mut cookie_store, mid).await?;
    let (img_key, sub_key) = fetch_wbi_keys(client, &mut cookie_store).await?;
    let mut creator = None;
    let mut videos = Vec::new();
    let mut seen_bvids = BTreeSet::new();
    let mut offset = None;

    for _page_index in 0..MAX_CREATOR_DYNAMIC_PAGE_COUNT {
        let remaining_limit = limit.saturating_sub(videos.len() as u8);
        if remaining_limit == 0 {
            break;
        }

        let page = fetch_bilibili_creator_dynamic_videos_page(
            client,
            mid,
            remaining_limit,
            &mut cookie_store,
            &img_key,
            &sub_key,
            offset.as_deref(),
        )
        .await?;
        if creator.is_none() {
            creator = Some(page.creator);
        }

        for video in page.videos {
            if videos.len() >= usize::from(limit) {
                break;
            }

            if seen_bvids.insert(video.bvid.clone()) {
                videos.push(video);
            }
        }

        let next_offset = page.next_offset.filter(|value| !value.trim().is_empty());
        if !page.has_more || next_offset.as_deref() == offset.as_deref() {
            break;
        }

        offset = next_offset;
        if offset.is_none() {
            break;
        }
    }

    if videos.is_empty() {
        return Err("B 站 UP 主动态暂未返回公开视频".to_string());
    }

    Ok(BilibiliCreatorVideos {
        creator: creator.unwrap_or_else(|| fallback_creator_profile(mid)),
        videos,
    })
}

async fn fetch_bilibili_creator_space_videos(
    client: &reqwest::Client,
    mid: &str,
    limit: u8,
    fingerprint: &BilibiliBrowserFingerprint,
) -> Result<BilibiliCreatorVideos, String> {
    let mut cookie_store = BilibiliCookieStore::new();
    prepare_bilibili_creator_session(client, &mut cookie_store, mid).await?;
    let (img_key, sub_key) = fetch_wbi_keys(client, &mut cookie_store).await?;
    let url = creator_videos_url(
        mid,
        limit,
        &img_key,
        &sub_key,
        now_unix_seconds()?,
        fingerprint,
    )?;
    let response = apply_cookie_header(
        client.get(url).header(
            "Referer",
            format!("https://space.bilibili.com/{mid}/upload/video"),
        ),
        &cookie_store,
    )
    .send()
    .await
    .map_err(|error| format!("请求 B 站 UP 主视频失败：{error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("请求 B 站 UP 主视频失败：HTTP {status}"));
    }

    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("解析 B 站 UP 主视频失败：{error}"))?;

    parse_creator_videos(mid, &value)
}

#[tauri::command]
pub async fn fetch_bilibili_metadata(
    reference: BilibiliMetadataReference,
) -> Result<BilibiliMetadata, String> {
    let url = metadata_url(&reference)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent(BILIBILI_BROWSER_USER_AGENT)
        .build()
        .map_err(|error| format!("创建 B 站元信息请求失败：{error}"))?;
    let value = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("请求 B 站元信息失败：{error}"))?
        .json::<Value>()
        .await
        .map_err(|error| format!("解析 B 站元信息失败：{error}"))?;

    parse_metadata(&reference, &value)
}

#[tauri::command]
pub async fn fetch_bilibili_creator_videos(
    mid: String,
    limit: Option<u8>,
    fingerprint: Option<BilibiliBrowserFingerprint>,
) -> Result<BilibiliCreatorVideos, String> {
    let normalized_mid = validate_creator_mid(&mid)?;
    let normalized_limit = validate_creator_video_limit(limit)?;
    let normalized_fingerprint = normalize_browser_fingerprint(fingerprint);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(BILIBILI_BROWSER_USER_AGENT)
        .build()
        .map_err(|error| format!("创建 B 站 UP 主视频请求失败：{error}"))?;
    match fetch_bilibili_creator_dynamic_videos(&client, &normalized_mid, normalized_limit).await {
        Ok(videos) => Ok(videos),
        Err(dynamic_error) => fetch_bilibili_creator_space_videos(
            &client,
            &normalized_mid,
            normalized_limit,
            &normalized_fingerprint,
        )
        .await
        .map_err(|space_error| {
            format!("刷新 B 站 UP 主视频失败：动态接口：{dynamic_error}；投稿接口：{space_error}")
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn validates_creator_mid_and_limit() {
        assert_eq!(validate_creator_mid(" 123456 ").unwrap(), "123456");
        assert!(validate_creator_mid("space123").is_err());
        assert_eq!(
            validate_creator_video_limit(None).unwrap(),
            DEFAULT_CREATOR_VIDEO_LIMIT
        );
        assert!(validate_creator_video_limit(Some(0)).is_err());
        assert!(validate_creator_video_limit(Some(MAX_CREATOR_VIDEO_LIMIT + 1)).is_err());
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

        let videos = parse_creator_videos("123456", &value).unwrap();

        assert_eq!(videos.creator.mid, "123456");
        assert_eq!(videos.creator.name, "测试UP");
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
    fn parses_creator_dynamic_videos() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "items": [
                    {
                        "type": "DYNAMIC_TYPE_AV",
                        "modules": [
                            {
                                "module_author": {
                                    "pub_ts": 1780425165,
                                    "user": {
                                        "face": "//i0.hdslb.com/avatar.jpg",
                                        "mid": 15810,
                                        "name": "Mr.Quin"
                                    }
                                }
                            },
                            {
                                "module_dynamic": {
                                    "dyn_archive": {
                                        "aid": "116681745697349",
                                        "bvid": "BV1ZzVk6XEfb",
                                        "cover": "http://i0.hdslb.com/video.jpg",
                                        "duration_text": "04:18:55",
                                        "stat": {
                                            "play": "3.3万"
                                        },
                                        "title": "【直播回放】古法修车 2026年06月02日20点场"
                                    },
                                    "type": "MDL_DYN_TYPE_ARCHIVE"
                                }
                            }
                        ]
                    },
                    {
                        "type": "DYNAMIC_TYPE_DRAW",
                        "modules": [
                            {
                                "module_author": {
                                    "pub_ts": 1780420951,
                                    "user": {
                                        "mid": 15810,
                                        "name": "Mr.Quin"
                                    }
                                }
                            },
                            {
                                "module_dynamic": {
                                    "dyn_draw": {},
                                    "type": "MDL_DYN_TYPE_DRAW"
                                }
                            }
                        ]
                    }
                ]
            }
        });

        let videos = parse_creator_dynamic_videos_page("15810", 12, &value).unwrap();

        assert_eq!(videos.creator.mid, "15810");
        assert_eq!(videos.creator.name, "Mr.Quin");
        assert_eq!(
            videos.creator.avatar_url,
            Some("https://i0.hdslb.com/avatar.jpg".to_string())
        );
        assert!(!videos.has_more);
        assert!(videos.next_offset.is_none());
        assert_eq!(videos.videos.len(), 1);
        assert_eq!(videos.videos[0].aid, Some("116681745697349".to_string()));
        assert_eq!(videos.videos[0].bvid, "BV1ZzVk6XEfb");
        assert_eq!(videos.videos[0].published_at, 1780425165);
        assert_eq!(videos.videos[0].duration_seconds, Some(15535));
        assert_eq!(videos.videos[0].play_count, Some(33_000));
        assert_eq!(
            videos.videos[0].cover_url,
            Some("https://i0.hdslb.com/video.jpg".to_string())
        );
    }

    #[test]
    #[ignore = "外网验证依赖 B 站当前风控策略和本机网络，只在调试 UP 主刷新时手动运行"]
    fn fetches_creator_videos_from_bilibili_for_uid_15810() {
        let videos = tauri::async_runtime::block_on(fetch_bilibili_creator_videos(
            "15810".to_string(),
            Some(12),
            Some(BilibiliBrowserFingerprint {
                dm_img_list: Some(DEFAULT_DM_IMG_LIST.to_string()),
                dm_img_str: Some(DEFAULT_DM_IMG_STR.to_string()),
                dm_cover_img_str: Some(
                    "QU5HTEUgKEdvb2dsZSwgQ2hyb21pdW0pR29vZ2xlIEluYy4=".to_string(),
                ),
                dm_img_inter: Some("{\"ds\":[],\"wh\":[1920,1080,100],\"of\":[0,0,0]}".to_string()),
            }),
        ))
        .unwrap();

        assert_eq!(videos.creator.mid, "15810");
        assert_eq!(videos.creator.name, "Mr.Quin");
        assert!(!videos.videos.is_empty());
        assert!(videos.videos[0].bvid.starts_with("BV"));
    }
}
