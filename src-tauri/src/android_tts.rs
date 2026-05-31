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
const PLUGIN_IDENTIFIER: &str = "com.niemingzhi.sleepcompanion.tts";
#[cfg(not(target_os = "android"))]
const UNSUPPORTED_PLATFORM: &str = "native-tts is only available on Android";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AndroidTtsSpeakInput {
    text: String,
    voice_id: Option<String>,
    language: Option<String>,
    rate: f64,
    pitch: Option<f64>,
    volume: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AndroidTtsVoice {
    id: String,
    name: String,
    language: String,
    is_default: bool,
    is_local: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
struct AndroidTtsVoicesPayload {
    voices: Vec<AndroidTtsVoice>,
}

struct AndroidTts<R: Runtime> {
    #[cfg(target_os = "android")]
    handle: PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    _runtime: PhantomData<fn() -> R>,
}

impl<R: Runtime> AndroidTts<R> {
    #[cfg(target_os = "android")]
    fn list_voices(&self) -> Result<Vec<AndroidTtsVoice>, String> {
        let payload = self
            .handle
            .run_mobile_plugin::<AndroidTtsVoicesPayload>("listVoices", ())
            .map_err(|error| error.to_string())?;
        Ok(payload.voices)
    }

    #[cfg(not(target_os = "android"))]
    fn list_voices(&self) -> Result<Vec<AndroidTtsVoice>, String> {
        Ok(Vec::new())
    }

    #[cfg(target_os = "android")]
    fn speak(&self, input: AndroidTtsSpeakInput) -> Result<(), String> {
        self.handle
            .run_mobile_plugin::<()>("speak", input)
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn speak(&self, _input: AndroidTtsSpeakInput) -> Result<(), String> {
        Err(UNSUPPORTED_PLATFORM.to_string())
    }

    #[cfg(target_os = "android")]
    fn cancel(&self) -> Result<(), String> {
        self.handle
            .run_mobile_plugin::<()>("cancel", ())
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    fn cancel(&self) -> Result<(), String> {
        Err(UNSUPPORTED_PLATFORM.to_string())
    }
}

#[tauri::command(rename = "listVoices")]
async fn list_voices<R: Runtime>(app: AppHandle<R>) -> Result<Vec<AndroidTtsVoice>, String> {
    app.state::<AndroidTts<R>>().list_voices()
}

#[tauri::command]
async fn speak<R: Runtime>(app: AppHandle<R>, input: AndroidTtsSpeakInput) -> Result<(), String> {
    app.state::<AndroidTts<R>>().speak(input)
}

#[tauri::command]
async fn cancel<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.state::<AndroidTts<R>>().cancel()
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("native-tts")
        .invoke_handler(tauri::generate_handler![list_voices, speak, cancel])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "NativeTtsPlugin")?;
                app.manage(AndroidTts { handle });
            }

            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
                app.manage(AndroidTts::<R> {
                    _runtime: PhantomData,
                });
            }

            Ok(())
        })
        .build()
}
