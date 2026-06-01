use serde::{Deserialize, Serialize};

#[cfg(target_os = "linux")]
use std::process::Command;

#[cfg(not(target_os = "linux"))]
const UNSUPPORTED_PLATFORM: &str = "native-tts is only available on Linux";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub(crate) struct NativeTtsSpeakInput {
    text: String,
    voice_id: Option<String>,
    language: Option<String>,
    rate: f64,
    pitch: Option<f64>,
    volume: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeTtsVoice {
    id: String,
    name: String,
    language: String,
    is_default: bool,
    is_local: bool,
}

fn speech_dispatcher_voice_types() -> Vec<NativeTtsVoice> {
    [
        ("speech-dispatcher:female1", "女声 1"),
        ("speech-dispatcher:female2", "女声 2"),
        ("speech-dispatcher:female3", "女声 3"),
        ("speech-dispatcher:male1", "男声 1"),
        ("speech-dispatcher:male2", "男声 2"),
        ("speech-dispatcher:male3", "男声 3"),
        ("speech-dispatcher:child_female", "童声女"),
        ("speech-dispatcher:child_male", "童声男"),
    ]
    .into_iter()
    .map(|(id, name)| NativeTtsVoice {
        id: id.to_string(),
        name: name.to_string(),
        language: "多语言".to_string(),
        is_default: false,
        is_local: true,
    })
    .collect()
}

#[cfg(any(target_os = "linux", test))]
fn normalize_language_for_spd(language: Option<&str>) -> String {
    let normalized = language.unwrap_or("zh-CN").to_lowercase();

    if normalized.starts_with("zh") {
        return "zh".to_string();
    }
    if normalized.starts_with("cmn") {
        return "cmn".to_string();
    }
    if normalized.starts_with("yue") {
        return "yue".to_string();
    }
    if normalized.starts_with("hak") {
        return "hak".to_string();
    }

    normalized
        .split('-')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or("zh")
        .to_string()
}

#[cfg(any(target_os = "linux", test))]
fn normalize_rate_for_spd(rate: f64) -> i32 {
    let clamped_rate = rate.clamp(0.6, 1.8);
    (((clamped_rate - 1.0) / 0.8) * 100.0)
        .round()
        .clamp(-100.0, 100.0) as i32
}

#[cfg(any(target_os = "linux", test))]
fn normalize_pitch_for_spd(pitch: Option<f64>) -> i32 {
    (((pitch.unwrap_or(1.0).clamp(0.0, 2.0) - 1.0) * 100.0).round()).clamp(-100.0, 100.0) as i32
}

#[cfg(any(target_os = "linux", test))]
fn normalize_volume_for_spd(volume: Option<f64>) -> i32 {
    ((volume.unwrap_or(1.0).clamp(0.0, 1.0) * 200.0) - 100.0).round() as i32
}

#[cfg(any(target_os = "linux", test))]
fn voice_type_from_id(voice_id: Option<&str>) -> Option<&'static str> {
    match voice_id {
        Some("speech-dispatcher:female1") => Some("female1"),
        Some("speech-dispatcher:female2") => Some("female2"),
        Some("speech-dispatcher:female3") => Some("female3"),
        Some("speech-dispatcher:male1") => Some("male1"),
        Some("speech-dispatcher:male2") => Some("male2"),
        Some("speech-dispatcher:male3") => Some("male3"),
        Some("speech-dispatcher:child_female") => Some("child_female"),
        Some("speech-dispatcher:child_male") => Some("child_male"),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn command_error(error: std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::NotFound {
        return "Linux 系统 TTS 需要安装 speech-dispatcher 和 spd-say".to_string();
    }

    format!("Linux 系统 TTS 调用失败：{error}")
}

#[cfg(target_os = "linux")]
fn cancel_speech() -> Result<(), String> {
    Command::new("spd-say")
        .arg("-S")
        .status()
        .map_err(command_error)
        .map(|_| ())
}

#[cfg(target_os = "linux")]
fn speak_with_system(input: NativeTtsSpeakInput) -> Result<(), String> {
    if input.text.trim().is_empty() {
        return Ok(());
    }

    let mut command = Command::new("spd-say");
    command
        .arg("-w")
        .arg("-N")
        .arg("梦伴")
        .arg("-l")
        .arg(normalize_language_for_spd(input.language.as_deref()))
        .arg("-r")
        .arg(normalize_rate_for_spd(input.rate).to_string())
        .arg("-p")
        .arg(normalize_pitch_for_spd(input.pitch).to_string())
        .arg("-i")
        .arg(normalize_volume_for_spd(input.volume).to_string());

    if let Some(voice_type) = voice_type_from_id(input.voice_id.as_deref()) {
        command.arg("-t").arg(voice_type);
    }

    let status = command.arg(input.text).status().map_err(command_error)?;
    if status.success() {
        return Ok(());
    }

    Err(format!(
        "Linux 系统 TTS 朗读失败，spd-say 退出码：{}",
        status
            .code()
            .map_or_else(|| "未知".to_string(), |code| code.to_string()),
    ))
}

#[cfg(not(target_os = "linux"))]
fn cancel_speech() -> Result<(), String> {
    Err(UNSUPPORTED_PLATFORM.to_string())
}

#[cfg(not(target_os = "linux"))]
fn speak_with_system(_input: NativeTtsSpeakInput) -> Result<(), String> {
    Err(UNSUPPORTED_PLATFORM.to_string())
}

#[tauri::command]
pub(crate) async fn native_tts_list_voices() -> Result<Vec<NativeTtsVoice>, String> {
    Ok(speech_dispatcher_voice_types())
}

#[tauri::command]
pub(crate) async fn native_tts_speak(input: NativeTtsSpeakInput) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || speak_with_system(input))
        .await
        .map_err(|error| format!("Linux 系统 TTS 任务失败：{error}"))?
}

#[tauri::command]
pub(crate) async fn native_tts_cancel() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(cancel_speech)
        .await
        .map_err(|error| format!("Linux 系统 TTS 停止失败：{error}"))?
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_language_for_spd, normalize_pitch_for_spd, normalize_rate_for_spd,
        normalize_volume_for_spd, voice_type_from_id,
    };

    #[test]
    fn maps_common_languages_for_speech_dispatcher() {
        assert_eq!(normalize_language_for_spd(Some("zh-CN")), "zh");
        assert_eq!(normalize_language_for_spd(Some("en-US")), "en");
        assert_eq!(normalize_language_for_spd(Some("ja-JP")), "ja");
        assert_eq!(normalize_language_for_spd(Some("ko-KR")), "ko");
        assert_eq!(normalize_language_for_spd(Some("cmn-Hans-CN")), "cmn");
        assert_eq!(normalize_language_for_spd(None), "zh");
    }

    #[test]
    fn maps_speech_settings_to_spd_ranges() {
        assert_eq!(normalize_rate_for_spd(1.0), 0);
        assert_eq!(normalize_rate_for_spd(1.8), 100);
        assert_eq!(normalize_rate_for_spd(0.6), -50);
        assert_eq!(normalize_pitch_for_spd(Some(1.0)), 0);
        assert_eq!(normalize_volume_for_spd(Some(1.0)), 100);
        assert_eq!(normalize_volume_for_spd(Some(0.0)), -100);
    }

    #[test]
    fn accepts_known_speech_dispatcher_voice_types() {
        assert_eq!(
            voice_type_from_id(Some("speech-dispatcher:female1")),
            Some("female1"),
        );
        assert_eq!(voice_type_from_id(Some("browser:voice")), None);
    }
}
