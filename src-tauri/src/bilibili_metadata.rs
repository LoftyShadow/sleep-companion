use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

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

fn read_non_empty_string<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut current_value = value;
    for key in path {
        current_value = current_value.get(*key)?;
    }

    current_value
        .as_str()
        .filter(|text| !text.trim().is_empty())
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

#[tauri::command]
pub async fn fetch_bilibili_metadata(
    reference: BilibiliMetadataReference,
) -> Result<BilibiliMetadata, String> {
    let url = metadata_url(&reference)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Sleep Companion")
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
}
