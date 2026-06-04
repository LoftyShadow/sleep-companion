use crate::bilibili_common::{
    apply_cookie_header, normalize_image_url, now_unix_seconds, parse_wbi_keys,
    read_non_empty_string, read_number_as_string, read_path, read_u64, signed_wbi_query,
    store_response_cookies, BilibiliCookieStore, BILIBILI_BROWSER_USER_AGENT,
};
use crate::bilibili_session::{load_active_bilibili_session, StoredBilibiliSession};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

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
    cid: String,
    title: String,
    cover_url: Option<String>,
    mime_type: Option<String>,
    codecs: Option<String>,
    bandwidth: Option<u64>,
    expires_at: Option<i64>,
}

struct BilibiliVideoIdentity {
    aid: String,
    bvid: String,
    cid: String,
    title: String,
    cover_url: Option<String>,
}

struct BilibiliDashAudioTrack {
    audio_url: String,
    backup_urls: Vec<String>,
    bandwidth: Option<u64>,
    codecs: Option<String>,
    mime_type: Option<String>,
}

fn ensure_bilibili_success(value: &Value, fallback_message: &str) -> Result<(), String> {
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

    Ok(BilibiliVideoIdentity {
        aid,
        bvid: bvid.to_string(),
        cid,
        title: title.to_string(),
        cover_url,
    })
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

fn read_dash_audio_backup_urls(value: &Value) -> Vec<String> {
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
                backup_urls: read_dash_audio_backup_urls(track),
                bandwidth: read_u64(track, &["bandwidth"]),
                codecs: read_optional_string(track, &["codecs"]),
                mime_type: read_optional_string(track, &["mime_type"])
                    .or_else(|| read_optional_string(track, &["mimeType"])),
            })
        })
        .max_by_key(|track| track.bandwidth.unwrap_or(0));

    best_audio.ok_or_else(|| "B 站直连音频不可用".to_string())
}

async fn fetch_json(
    client: &reqwest::Client,
    url: String,
    cookie_store: &mut BilibiliCookieStore,
    referer: &str,
) -> Result<Value, String> {
    let response = apply_cookie_header(
        client
            .get(url)
            .header("Origin", "https://www.bilibili.com")
            .header("Referer", referer),
        cookie_store,
    )
    .send()
    .await
    .map_err(|error| format!("请求 B 站失败：{error}"))?;
    store_response_cookies(cookie_store, &response);
    let status = response.status();
    if !status.is_success() {
        return Err(format!("请求 B 站失败：HTTP {status}"));
    }

    response
        .json::<Value>()
        .await
        .map_err(|error| format!("解析 B 站响应失败：{error}"))
}

async fn fetch_wbi_keys(
    client: &reqwest::Client,
    cookie_store: &mut BilibiliCookieStore,
) -> Result<(String, String), String> {
    let value = fetch_json(
        client,
        "https://api.bilibili.com/x/web-interface/nav".to_string(),
        cookie_store,
        "https://www.bilibili.com/",
    )
    .await?;

    parse_wbi_keys(&value)
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

async fn resolve_direct_audio_with_session(
    reference: BilibiliDirectAudioReference,
    session: Option<&StoredBilibiliSession>,
) -> Result<BilibiliDirectAudioSource, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(BILIBILI_BROWSER_USER_AGENT)
        .build()
        .map_err(|error| format!("创建 B 站直连音频请求失败：{error}"))?;
    let mut cookie_store = create_cookie_store(session);
    let view_value = fetch_json(
        &client,
        view_url(&reference)?,
        &mut cookie_store,
        "https://www.bilibili.com/",
    )
    .await?;
    let identity = parse_video_identity(&view_value)?;
    let (img_key, sub_key) = fetch_wbi_keys(&client, &mut cookie_store).await?;
    let playurl = direct_audio_playurl(&identity, &img_key, &sub_key, now_unix_seconds()?)?;
    let referer = format!("https://www.bilibili.com/video/{}", identity.bvid);
    let playurl_value = fetch_json(&client, playurl, &mut cookie_store, &referer).await?;
    let audio_track = parse_best_audio_track(&playurl_value)?;

    Ok(BilibiliDirectAudioSource {
        audio_url: audio_track.audio_url,
        backup_urls: audio_track.backup_urls,
        bvid: identity.bvid,
        aid: identity.aid,
        cid: identity.cid,
        title: identity.title,
        cover_url: identity.cover_url,
        mime_type: audio_track.mime_type,
        codecs: audio_track.codecs,
        bandwidth: audio_track.bandwidth,
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
                "pic": "//i0.hdslb.com/video.jpg",
                "title": "测试视频"
            }
        });

        let identity = parse_video_identity(&value).unwrap();

        assert_eq!(identity.aid, "170001");
        assert_eq!(identity.bvid, "BV1xx411c7mD");
        assert_eq!(identity.cid, "110002");
        assert_eq!(identity.title, "测试视频");
        assert_eq!(
            identity.cover_url,
            Some("https://i0.hdslb.com/video.jpg".to_string())
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
    fn builds_signed_playurl_query() {
        let identity = BilibiliVideoIdentity {
            aid: "170001".to_string(),
            bvid: "BV1xx411c7mD".to_string(),
            cid: "110002".to_string(),
            title: "测试视频".to_string(),
            cover_url: None,
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
