mod android_tts;
mod bilibili_auth;
mod bilibili_common;
mod bilibili_direct_audio;
mod bilibili_metadata;
mod bilibili_session;
mod native_audio;
mod native_tts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(native_audio::init())
        .plugin(android_tts::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            bilibili_auth::create_bilibili_login_qr,
            bilibili_auth::get_bilibili_auth_status,
            bilibili_auth::import_bilibili_login_cookies,
            bilibili_auth::logout_bilibili,
            bilibili_auth::open_bilibili_web_login,
            bilibili_auth::poll_bilibili_login_qr,
            bilibili_auth::sync_bilibili_web_login_cookies,
            bilibili_direct_audio::resolve_bilibili_direct_audio,
            bilibili_metadata::fetch_bilibili_creator_videos,
            bilibili_metadata::fetch_bilibili_metadata,
            native_tts::native_tts_cancel,
            native_tts::native_tts_list_voices,
            native_tts::native_tts_speak,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
