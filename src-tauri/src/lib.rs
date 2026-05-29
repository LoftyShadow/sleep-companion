mod native_audio;
mod native_tts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(native_audio::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            native_tts::native_tts_cancel,
            native_tts::native_tts_list_voices,
            native_tts::native_tts_speak,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
