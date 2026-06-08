use crate::bilibili_common::{
    create_bilibili_client, ensure_bilibili_success, fetch_bilibili_json, fetch_bilibili_wbi_keys,
    normalize_image_url, now_unix_seconds, read_non_empty_string, read_number_as_string, read_path,
    read_u64, signed_wbi_query, BilibiliCookieStore,
};
use crate::bilibili_session::{load_active_bilibili_session, StoredBilibiliSession};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Ordering;

const BILIBILI_PREVIEW_MAX_VIDEO_HEIGHT: u64 = 1080;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliDirectAudioReference {
    kind: String,
    value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliDirectAudioSource {
    audio_url: String,
    backup_urls: Vec<String>,
    bvid: String,
    aid: String,
    chapters: Vec<BilibiliDirectAudioChapter>,
    cid: String,
    title: String,
    cover_url: Option<String>,
    duration_seconds: Option<u64>,
    mime_type: Option<String>,
    codecs: Option<String>,
    bandwidth: Option<u64>,
    video_url: Option<String>,
    video_backup_urls: Vec<String>,
    video_mime_type: Option<String>,
    video_codecs: Option<String>,
    video_bandwidth: Option<u64>,
    video_width: Option<u64>,
    video_height: Option<u64>,
    video_tracks: Vec<BilibiliDirectVideoTrack>,
    expires_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliDirectAudioChapter {
    content: String,
    from_seconds: u64,
    image_url: Option<String>,
    to_seconds: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliDirectVideoTrack {
    backup_urls: Vec<String>,
    bandwidth: Option<u64>,
    codecs: Option<String>,
    height: Option<u64>,
    id: String,
    label: String,
    mime_type: Option<String>,
    url: String,
    width: Option<u64>,
}

struct BilibiliVideoIdentity {
    aid: String,
    bvid: String,
    cid: String,
    title: String,
    cover_url: Option<String>,
    duration_seconds: Option<u64>,
}

struct BilibiliDashAudioTrack {
    audio_url: String,
    backup_urls: Vec<String>,
    bandwidth: Option<u64>,
    codecs: Option<String>,
    mime_type: Option<String>,
}

struct BilibiliDashVideoTrack {
    video_url: String,
    backup_urls: Vec<String>,
    bandwidth: Option<u64>,
    codecs: Option<String>,
    mime_type: Option<String>,
    width: Option<u64>,
    height: Option<u64>,
}

fn validate_direct_audio_reference(reference: &BilibiliDirectAudioReference) -> Result<(), String> {
    let value = reference.value.trim();
    if value.is_empty() {
        return Err("B 站视频引用为空".to_string());
    }

    match reference.kind.as_str() {
        "bvid" => {
            if value.starts_with("BV")
                && value
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric())
            {
                Ok(())
            } else {
                Err("B 站 BV 号格式不正确".to_string())
            }
        }
        "aid" => {
            if value.chars().all(|character| character.is_ascii_digit()) {
                Ok(())
            } else {
                Err("B 站 av 号格式不正确".to_string())
            }
        }
        "ep" => Err("当前直连模式暂不支持番剧链接".to_string()),
        "live" => Err("当前直连模式暂不支持直播间".to_string()),
        _ => Err("当前直连模式只支持 BV 和 av 视频".to_string()),
    }
}

fn view_url(reference: &BilibiliDirectAudioReference) -> Result<String, String> {
    validate_direct_audio_reference(reference)?;

    match reference.kind.as_str() {
        "bvid" => Ok(format!(
            "https://api.bilibili.com/x/web-interface/view?bvid={}",
            reference.value.trim()
        )),
        "aid" => Ok(format!(
            "https://api.bilibili.com/x/web-interface/view?aid={}",
            reference.value.trim()
        )),
        _ => Err("当前直连模式只支持 BV 和 av 视频".to_string()),
    }
}

fn parse_video_identity(value: &Value) -> Result<BilibiliVideoIdentity, String> {
    ensure_bilibili_success(value, "B 站视频信息接口返回失败")?;

    let data = value
        .get("data")
        .ok_or_else(|| "B 站视频信息响应缺少内容".to_string())?;
    let bvid = read_non_empty_string(value, &["data", "bvid"])
        .ok_or_else(|| "B 站视频信息缺少 BV 号".to_string())?;
    let aid = read_number_as_string(value, &["data", "aid"])
        .ok_or_else(|| "B 站视频信息缺少 av 号".to_string())?;
    let cid = read_number_as_string(value, &["data", "cid"])
        .or_else(|| {
            data.get("pages")
                .and_then(Value::as_array)
                .and_then(|pages| pages.first())
                .and_then(|page| read_number_as_string(page, &["cid"]))
        })
        .ok_or_else(|| "B 站视频信息缺少 cid".to_string())?;
    let title = read_non_empty_string(value, &["data", "title"])
        .ok_or_else(|| "B 站视频信息缺少标题".to_string())?;
    let cover_url = normalize_image_url(read_non_empty_string(value, &["data", "pic"]));
    let duration_seconds = read_u64(value, &["data", "duration"]);

    Ok(BilibiliVideoIdentity {
        aid,
        bvid: bvid.to_string(),
        cid,
        title: title.to_string(),
        cover_url,
        duration_seconds,
    })
}

fn parse_direct_audio_chapters(value: &Value) -> Result<Vec<BilibiliDirectAudioChapter>, String> {
    ensure_bilibili_success(value, "B 站播放器信息接口返回失败")?;

    let Some(view_points) = read_path(value, &["data", "view_points"]).and_then(Value::as_array)
    else {
        return Ok(Vec::new());
    };

    let mut chapters = view_points
        .iter()
        .filter_map(|view_point| {
            let content = read_non_empty_string(view_point, &["content"])?
                .trim()
                .to_string();
            let from_seconds = read_u64(view_point, &["from"])?;
            let image_url = normalize_image_url(
                read_non_empty_string(view_point, &["imgUrl"])
                    .or_else(|| read_non_empty_string(view_point, &["img_url"]))
                    .or_else(|| read_non_empty_string(view_point, &["imageUrl"])),
            );

            Some(BilibiliDirectAudioChapter {
                content,
                from_seconds,
                image_url,
                to_seconds: read_u64(view_point, &["to"]),
            })
        })
        .collect::<Vec<_>>();
    chapters.sort_by_key(|chapter| chapter.from_seconds);

    Ok(chapters)
}

fn create_cookie_store(session: Option<&StoredBilibiliSession>) -> BilibiliCookieStore {
    let mut cookie_store = BilibiliCookieStore::new();
    if let Some(session) = session {
        session.write_cookies_to(&mut cookie_store);
    }

    cookie_store
}

fn read_dash_audio_url(value: &Value) -> Option<String> {
    read_non_empty_string(value, &["baseUrl"])
        .or_else(|| read_non_empty_string(value, &["base_url"]))
        .map(str::to_string)
}

fn read_dash_backup_urls(value: &Value) -> Vec<String> {
    read_path(value, &["backupUrl"])
        .or_else(|| read_path(value, &["backup_url"]))
        .and_then(Value::as_array)
        .map(|urls| {
            urls.iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|url| !url.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn read_dash_video_url(value: &Value) -> Option<String> {
    read_dash_audio_url(value)
}

fn read_optional_string(value: &Value, path: &[&str]) -> Option<String> {
    read_non_empty_string(value, path).map(str::to_string)
}

fn parse_best_audio_track(value: &Value) -> Result<BilibiliDashAudioTrack, String> {
    ensure_bilibili_success(value, "B 站播放地址接口返回失败")?;

    let audio_tracks = read_path(value, &["data", "dash", "audio"])
        .and_then(Value::as_array)
        .ok_or_else(|| "B 站直连音频响应缺少 DASH 音频轨".to_string())?;
    let best_audio = audio_tracks
        .iter()
        .filter_map(|track| {
            let audio_url = read_dash_audio_url(track)?;

            Some(BilibiliDashAudioTrack {
                audio_url,
                backup_urls: read_dash_backup_urls(track),
                bandwidth: read_u64(track, &["bandwidth"]),
                codecs: read_optional_string(track, &["codecs"]),
                mime_type: read_optional_string(track, &["mime_type"])
                    .or_else(|| read_optional_string(track, &["mimeType"])),
            })
        })
        .max_by_key(|track| track.bandwidth.unwrap_or(0));

    best_audio.ok_or_else(|| "B 站直连音频不可用".to_string())
}

fn is_bilibili_dash_avc_video_track(track: &BilibiliDashVideoTrack) -> bool {
    track
        .codecs
        .as_deref()
        .is_some_and(|codecs| codecs.trim().to_lowercase().starts_with("avc1"))
}

fn is_bilibili_dash_mp4_video_track(track: &BilibiliDashVideoTrack) -> bool {
    track
        .mime_type
        .as_deref()
        .is_some_and(|mime_type| mime_type.trim().eq_ignore_ascii_case("video/mp4"))
}

fn bilibili_dash_video_compatibility_rank(track: &BilibiliDashVideoTrack) -> u8 {
    let is_avc = is_bilibili_dash_avc_video_track(track);
    let is_mp4 = is_bilibili_dash_mp4_video_track(track);

    match (is_avc, is_mp4) {
        (true, true) => 0,
        (true, false) => 1,
        (false, true) => 2,
        (false, false) => 3,
    }
}

fn bilibili_dash_video_height_bucket(track: &BilibiliDashVideoTrack) -> u8 {
    match track.height {
        Some(height) if height <= BILIBILI_PREVIEW_MAX_VIDEO_HEIGHT => 0,
        Some(_) => 1,
        None => 2,
    }
}

fn bilibili_dash_video_height_score(track: &BilibiliDashVideoTrack) -> i64 {
    match track.height {
        Some(height) if height <= BILIBILI_PREVIEW_MAX_VIDEO_HEIGHT => height as i64,
        Some(height) => -(height as i64),
        None => 0,
    }
}

fn compare_bilibili_dash_video_track(
    left: &BilibiliDashVideoTrack,
    right: &BilibiliDashVideoTrack,
) -> Ordering {
    bilibili_dash_video_compatibility_rank(left)
        .cmp(&bilibili_dash_video_compatibility_rank(right))
        .then_with(|| {
            bilibili_dash_video_height_bucket(left).cmp(&bilibili_dash_video_height_bucket(right))
        })
        .then_with(|| {
            bilibili_dash_video_height_score(right).cmp(&bilibili_dash_video_height_score(left))
        })
        .then_with(|| {
            right
                .bandwidth
                .unwrap_or(0)
                .cmp(&left.bandwidth.unwrap_or(0))
        })
}

fn parse_video_tracks(value: &Value) -> Vec<BilibiliDashVideoTrack> {
    let Some(video_tracks) = read_path(value, &["data", "dash", "video"]).and_then(Value::as_array)
    else {
        return Vec::new();
    };

    let mut tracks = video_tracks
        .iter()
        .filter_map(|track| {
            let video_url = read_dash_video_url(track)?;

            Some(BilibiliDashVideoTrack {
                video_url,
                backup_urls: read_dash_backup_urls(track),
                bandwidth: read_u64(track, &["bandwidth"]),
                codecs: read_optional_string(track, &["codecs"]),
                mime_type: read_optional_string(track, &["mime_type"])
                    .or_else(|| read_optional_string(track, &["mimeType"])),
                width: read_u64(track, &["width"]),
                height: read_u64(track, &["height"]),
            })
        })
        .collect::<Vec<_>>();
    tracks.sort_by(compare_bilibili_dash_video_track);

    tracks
}

fn format_bilibili_video_track_codec(track: &BilibiliDashVideoTrack) -> Option<String> {
    let codecs = track.codecs.as_deref()?.trim();
    let normalized_codecs = codecs.to_lowercase();

    if normalized_codecs.starts_with("avc1") {
        return Some("AVC".to_string());
    }

    if normalized_codecs.starts_with("hvc1") || normalized_codecs.starts_with("hev1") {
        return Some("HEVC".to_string());
    }

    if normalized_codecs.starts_with("av01") {
        return Some("AV1".to_string());
    }

    Some(codecs.to_string())
}

fn format_bilibili_video_track_label(track: &BilibiliDashVideoTrack) -> String {
    let mut label_parts = vec![match track.height {
        Some(height) => format!("{height}p"),
        None => "未知画质".to_string(),
    }];

    if let Some(codec) = format_bilibili_video_track_codec(track) {
        label_parts.push(codec);
    }

    if let Some(bandwidth) = track.bandwidth {
        label_parts.push(format!("{} kbps", bandwidth / 1000));
    }

    label_parts.join(" · ")
}

fn create_direct_video_track(
    track: BilibiliDashVideoTrack,
    index: usize,
) -> BilibiliDirectVideoTrack {
    let label = format_bilibili_video_track_label(&track);

    BilibiliDirectVideoTrack {
        backup_urls: track.backup_urls,
        bandwidth: track.bandwidth,
        codecs: track.codecs,
        height: track.height,
        id: format!("track-{}", index + 1),
        label,
        mime_type: track.mime_type,
        url: track.video_url,
        width: track.width,
    }
}

async fn fetch_direct_audio_json(
    client: &reqwest::Client,
    url: String,
    cookie_store: &mut BilibiliCookieStore,
    referer: &str,
) -> Result<Value, String> {
    fetch_bilibili_json(
        client
            .get(url)
            .header("Origin", "https://www.bilibili.com")
            .header("Referer", referer),
        Some(cookie_store),
        "B 站",
        "B 站响应",
    )
    .await
}

fn direct_audio_playurl(
    identity: &BilibiliVideoIdentity,
    img_key: &str,
    sub_key: &str,
    wts: i64,
) -> Result<String, String> {
    let query = signed_wbi_query(
        vec![
            ("bvid".to_string(), identity.bvid.clone()),
            ("cid".to_string(), identity.cid.clone()),
            ("fnval".to_string(), "4048".to_string()),
            ("fnver".to_string(), "0".to_string()),
            ("fourk".to_string(), "1".to_string()),
            ("qn".to_string(), "80".to_string()),
        ],
        img_key,
        sub_key,
        wts,
    )?;

    Ok(format!(
        "https://api.bilibili.com/x/player/wbi/playurl?{query}"
    ))
}

fn direct_audio_player_info_url(
    identity: &BilibiliVideoIdentity,
    img_key: &str,
    sub_key: &str,
    wts: i64,
) -> Result<String, String> {
    let query = signed_wbi_query(
        vec![
            ("bvid".to_string(), identity.bvid.clone()),
            ("cid".to_string(), identity.cid.clone()),
        ],
        img_key,
        sub_key,
        wts,
    )?;

    Ok(format!("https://api.bilibili.com/x/player/wbi/v2?{query}"))
}

async fn resolve_direct_audio_with_session(
    reference: BilibiliDirectAudioReference,
    session: Option<&StoredBilibiliSession>,
) -> Result<BilibiliDirectAudioSource, String> {
    let client = create_bilibili_client(10, "B 站直连音频")?;
    let mut cookie_store = create_cookie_store(session);
    let view_value = fetch_direct_audio_json(
        &client,
        view_url(&reference)?,
        &mut cookie_store,
        "https://www.bilibili.com/",
    )
    .await?;
    let identity = parse_video_identity(&view_value)?;
    let (img_key, sub_key) = fetch_bilibili_wbi_keys(&client, &mut cookie_store).await?;
    let wts = now_unix_seconds()?;
    let playurl = direct_audio_playurl(&identity, &img_key, &sub_key, wts)?;
    let referer = format!("https://www.bilibili.com/video/{}", identity.bvid);
    let playurl_value =
        fetch_direct_audio_json(&client, playurl, &mut cookie_store, &referer).await?;
    let chapters = match direct_audio_player_info_url(&identity, &img_key, &sub_key, wts) {
        Ok(player_info_url) => {
            fetch_direct_audio_json(&client, player_info_url, &mut cookie_store, &referer)
                .await
                .ok()
                .and_then(|value| parse_direct_audio_chapters(&value).ok())
                .unwrap_or_default()
        }
        Err(_) => Vec::new(),
    };
    let audio_track = parse_best_audio_track(&playurl_value)?;
    let video_tracks = parse_video_tracks(&playurl_value)
        .into_iter()
        .enumerate()
        .map(|(index, track)| create_direct_video_track(track, index))
        .collect::<Vec<_>>();
    let video_track = video_tracks.first();

    Ok(BilibiliDirectAudioSource {
        audio_url: audio_track.audio_url,
        backup_urls: audio_track.backup_urls,
        bvid: identity.bvid,
        aid: identity.aid,
        chapters,
        cid: identity.cid,
        title: identity.title,
        cover_url: identity.cover_url,
        duration_seconds: identity.duration_seconds,
        mime_type: audio_track.mime_type,
        codecs: audio_track.codecs,
        bandwidth: audio_track.bandwidth,
        video_url: video_track.as_ref().map(|track| track.url.clone()),
        video_backup_urls: video_track
            .as_ref()
            .map(|track| track.backup_urls.clone())
            .unwrap_or_default(),
        video_mime_type: video_track
            .as_ref()
            .and_then(|track| track.mime_type.clone()),
        video_codecs: video_track.as_ref().and_then(|track| track.codecs.clone()),
        video_bandwidth: video_track.as_ref().and_then(|track| track.bandwidth),
        video_width: video_track.as_ref().and_then(|track| track.width),
        video_height: video_track.as_ref().and_then(|track| track.height),
        video_tracks,
        expires_at: None,
    })
}

#[tauri::command]
pub async fn resolve_bilibili_direct_audio(
    app: tauri::AppHandle,
    reference: BilibiliDirectAudioReference,
) -> Result<BilibiliDirectAudioSource, String> {
    let session = load_active_bilibili_session(&app)?;

    resolve_direct_audio_with_session(reference, session.as_ref()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsupported_references() {
        assert!(
            validate_direct_audio_reference(&BilibiliDirectAudioReference {
                kind: "ep".to_string(),
                value: "12345".to_string(),
            })
            .is_err()
        );
        assert!(
            validate_direct_audio_reference(&BilibiliDirectAudioReference {
                kind: "live".to_string(),
                value: "23058".to_string(),
            })
            .is_err()
        );
    }

    #[test]
    fn parses_video_identity() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "aid": 170001,
                "bvid": "BV1xx411c7mD",
                "cid": 110002,
                "duration": 3661,
                "pic": "//i0.hdslb.com/video.jpg",
                "title": "测试视频"
            }
        });

        let identity = parse_video_identity(&value).unwrap();

        assert_eq!(identity.aid, "170001");
        assert_eq!(identity.bvid, "BV1xx411c7mD");
        assert_eq!(identity.cid, "110002");
        assert_eq!(identity.duration_seconds, Some(3661));
        assert_eq!(identity.title, "测试视频");
        assert_eq!(
            identity.cover_url,
            Some("https://i0.hdslb.com/video.jpg".to_string())
        );
    }

    #[test]
    fn parses_direct_audio_chapters() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "view_points": [
                    {
                        "content": "第二段",
                        "from": 120,
                        "to": 180,
                        "imgUrl": "//i0.hdslb.com/chapter-2.jpg"
                    },
                    {
                        "content": "第一段",
                        "from": 0,
                        "to": 120
                    }
                ]
            }
        });

        let chapters = parse_direct_audio_chapters(&value).unwrap();

        assert_eq!(chapters.len(), 2);
        assert_eq!(chapters[0].content, "第一段");
        assert_eq!(chapters[0].from_seconds, 0);
        assert_eq!(chapters[0].to_seconds, Some(120));
        assert_eq!(chapters[1].content, "第二段");
        assert_eq!(chapters[1].from_seconds, 120);
        assert_eq!(
            chapters[1].image_url,
            Some("https://i0.hdslb.com/chapter-2.jpg".to_string())
        );
    }

    #[test]
    fn parses_best_audio_track() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "dash": {
                    "audio": [
                        {
                            "baseUrl": "https://audio-low.example.com/stream.m4s",
                            "bandwidth": 64000,
                            "codecs": "mp4a.40.2",
                            "mime_type": "audio/mp4"
                        },
                        {
                            "base_url": "https://audio-high.example.com/stream.m4s",
                            "backup_url": ["https://audio-backup.example.com/stream.m4s"],
                            "bandwidth": 128000,
                            "codecs": "mp4a.40.2",
                            "mime_type": "audio/mp4"
                        }
                    ]
                }
            }
        });

        let track = parse_best_audio_track(&value).unwrap();

        assert_eq!(track.audio_url, "https://audio-high.example.com/stream.m4s");
        assert_eq!(track.backup_urls.len(), 1);
        assert_eq!(track.bandwidth, Some(128000));
        assert_eq!(track.mime_type, Some("audio/mp4".to_string()));
    }

    #[test]
    fn parses_best_video_track() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "dash": {
                    "video": [
                        {
                            "baseUrl": "https://video-av01.example.com/stream.m4s",
                            "bandwidth": 900000,
                            "codecs": "av01.0.05M.08",
                            "height": 720,
                            "mime_type": "video/mp4",
                            "width": 1280
                        },
                        {
                            "base_url": "https://video-avc.example.com/stream.m4s",
                            "backup_url": ["https://video-backup.example.com/stream.m4s"],
                            "bandwidth": 800000,
                            "codecs": "avc1.64001F",
                            "height": 720,
                            "mime_type": "video/mp4",
                            "width": 1280
                        }
                    ]
                }
            }
        });

        let tracks = parse_video_tracks(&value);
        let track = tracks.first().unwrap();

        assert_eq!(track.video_url, "https://video-avc.example.com/stream.m4s");
        assert_eq!(track.backup_urls.len(), 1);
        assert_eq!(track.bandwidth, Some(800000));
        assert_eq!(track.mime_type, Some("video/mp4".to_string()));
        assert_eq!(track.width, Some(1280));
        assert_eq!(track.height, Some(720));
    }

    #[test]
    fn parses_preview_sized_video_track_before_4k_track() {
        let value = serde_json::json!({
            "code": 0,
            "data": {
                "dash": {
                    "video": [
                        {
                            "baseUrl": "https://video-4k.example.com/stream.m4s",
                            "bandwidth": 1941800,
                            "codecs": "avc1.640033",
                            "height": 2160,
                            "mime_type": "video/mp4",
                            "width": 3840
                        },
                        {
                            "base_url": "https://video-1080.example.com/stream.m4s",
                            "bandwidth": 1200000,
                            "codecs": "avc1.640028",
                            "height": 1080,
                            "mime_type": "video/mp4",
                            "width": 1920
                        },
                        {
                            "base_url": "https://video-720.example.com/stream.m4s",
                            "bandwidth": 800000,
                            "codecs": "avc1.64001F",
                            "height": 720,
                            "mime_type": "video/mp4",
                            "width": 1280
                        }
                    ]
                }
            }
        });

        let tracks = parse_video_tracks(&value);
        let track = tracks.first().unwrap();

        assert_eq!(track.video_url, "https://video-1080.example.com/stream.m4s");
        assert_eq!(track.bandwidth, Some(1200000));
        assert_eq!(track.width, Some(1920));
        assert_eq!(track.height, Some(1080));

        assert_eq!(tracks.len(), 3);
        assert_eq!(
            tracks[0].video_url,
            "https://video-1080.example.com/stream.m4s"
        );
        assert_eq!(
            tracks[2].video_url,
            "https://video-4k.example.com/stream.m4s"
        );
    }

    #[test]
    fn builds_signed_playurl_query() {
        let identity = BilibiliVideoIdentity {
            aid: "170001".to_string(),
            bvid: "BV1xx411c7mD".to_string(),
            cid: "110002".to_string(),
            title: "测试视频".to_string(),
            cover_url: None,
            duration_seconds: None,
        };
        let url = direct_audio_playurl(
            &identity,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            1710000000,
        )
        .unwrap();

        assert!(url.contains("/x/player/wbi/playurl?"));
        assert!(url.contains("bvid=BV1xx411c7mD"));
        assert!(url.contains("cid=110002"));
        assert!(url.contains("fnval=4048"));
        assert!(url.contains("wts=1710000000"));
        assert!(url.contains("w_rid="));
    }
}
