use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(not(target_os = "android"))]
use std::marker::PhantomData;
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.niemingzhi.sleepcompanion.audio";
#[cfg(not(target_os = "android"))]
const UNSUPPORTED_PLATFORM: &str = "native-audio is only available on Android";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg(target_os = "android")]
struct PlayPayload<'a> {
    sound_id: &'a str,
    resource_name: &'a str,
    volume: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg(target_os = "android")]
struct SoundIdPayload<'a> {
    sound_id: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg(target_os = "android")]
struct VolumePayload<'a> {
    sound_id: &'a str,
    volume: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlayingSoundState {
    sound_id: String,
    is_playing: bool,
    volume: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlayerSnapshot {
    sounds: Vec<PlayingSoundState>,
}

struct NativeAudio<R: Runtime> {
    #[cfg(target_os = "android")]
    handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    _runtime: PhantomData<fn() -> R>,
}

impl<R: Runtime> NativeAudio<R> {
    #[cfg(target_os = "android")]
    fn play(&self, sound_id: String, resource_name: String, volume: f64) -> Result<(), String> {
        self.handle
            .run_mobile_plugin::<()>(
                "play",
                PlayPayload {
                    sound_id: &sound_id,
                    resource_name: &resource_name,
                    volume,
                },
            )
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn play(&self, _sound_id: String, _resource_name: String, _volume: f64) -> Result<(), String> {
        Err(UNSUPPORTED_PLATFORM.to_string())
    }

    #[cfg(target_os = "android")]
    fn pause(&self, sound_id: String) -> Result<(), String> {
        self.handle
            .run_mobile_plugin::<()>(
                "pause",
                SoundIdPayload {
                    sound_id: &sound_id,
                },
            )
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn pause(&self, _sound_id: String) -> Result<(), String> {
        Err(UNSUPPORTED_PLATFORM.to_string())
    }

    #[cfg(target_os = "android")]
    fn set_volume(&self, sound_id: String, volume: f64) -> Result<(), String> {
        self.handle
            .run_mobile_plugin::<()>(
                "setVolume",
                VolumePayload {
                    sound_id: &sound_id,
                    volume,
                },
            )
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn set_volume(&self, _sound_id: String, _volume: f64) -> Result<(), String> {
        Err(UNSUPPORTED_PLATFORM.to_string())
    }

    #[cfg(target_os = "android")]
    fn stop_all(&self) -> Result<(), String> {
        self.handle
            .run_mobile_plugin::<()>("stopAll", ())
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn stop_all(&self) -> Result<(), String> {
        Err(UNSUPPORTED_PLATFORM.to_string())
    }

    #[cfg(target_os = "android")]
    fn get_state(&self) -> Result<PlayerSnapshot, String> {
        self.handle
            .run_mobile_plugin::<PlayerSnapshot>("getState", ())
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn get_state(&self) -> Result<PlayerSnapshot, String> {
        Ok(PlayerSnapshot { sounds: Vec::new() })
    }
}

#[tauri::command]
async fn play<R: Runtime>(
    app: AppHandle<R>,
    sound_id: String,
    resource_name: String,
    volume: f64,
) -> Result<(), String> {
    app.state::<NativeAudio<R>>()
        .play(sound_id, resource_name, volume)
}

#[tauri::command]
async fn pause<R: Runtime>(app: AppHandle<R>, sound_id: String) -> Result<(), String> {
    app.state::<NativeAudio<R>>().pause(sound_id)
}

#[tauri::command(rename = "setVolume")]
async fn set_volume<R: Runtime>(
    app: AppHandle<R>,
    sound_id: String,
    volume: f64,
) -> Result<(), String> {
    app.state::<NativeAudio<R>>().set_volume(sound_id, volume)
}

#[tauri::command(rename = "stopAll")]
async fn stop_all<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.state::<NativeAudio<R>>().stop_all()
}

#[tauri::command(rename = "getState")]
async fn get_state<R: Runtime>(app: AppHandle<R>) -> Result<PlayerSnapshot, String> {
    app.state::<NativeAudio<R>>().get_state()
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("native-audio")
        .invoke_handler(tauri::generate_handler![
            play, pause, set_volume, stop_all, get_state
        ])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "NativeAudioPlugin")?;
                app.manage(NativeAudio { handle });
            }

            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
                app.manage(NativeAudio::<R> {
                    _runtime: PhantomData,
                });
            }

            Ok(())
        })
        .build()
}
