fn main() {
    let native_audio = tauri_build::InlinedPlugin::new()
        .commands(&["play", "pause", "setVolume", "stopAll", "getState"])
        .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands);
    let native_tts = tauri_build::InlinedPlugin::new()
        .commands(&["listVoices", "speak", "cancel"])
        .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands);

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .plugin("native-audio", native_audio)
            .plugin("native-tts", native_tts),
    )
    .expect("failed to run tauri build script");
}
