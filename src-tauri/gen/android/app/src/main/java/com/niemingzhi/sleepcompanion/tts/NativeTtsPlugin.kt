package com.niemingzhi.sleepcompanion.tts

import android.app.Activity
import android.os.Bundle
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.Locale

@InvokeArg
class NativeTtsSpeakArgs {
    lateinit var text: String
    var voiceId: String? = null
    var language: String? = null
    var rate: Double = 1.0
    var pitch: Double? = null
    var volume: Double? = null
}

@TauriPlugin
class NativeTtsPlugin(private val activity: Activity) : Plugin(activity) {
    private data class PendingSpeech(
        val utteranceId: String,
        val invoke: Invoke,
    )

    private val lock = Any()
    private val waitingForInit = mutableListOf<(TextToSpeech?, String?) -> Unit>()
    private var tts: TextToSpeech? = null
    private var initStarted = false
    private var initError: String? = null
    private var currentSpeech: PendingSpeech? = null
    private var isReleased = false

    override fun onStop() {
        cancelCurrentSpeech()
    }

    override fun onDestroy(activity: AppCompatActivity) {
        releaseTts()
    }

    @Command
    fun listVoices(invoke: Invoke) {
        withInitializedTts(
            onReady = { engine ->
                try {
                    val voices = JSArray()
                    val systemVoices = engine.voices
                        ?.sortedWith(compareBy<Voice> { it.locale.toLanguageTag() }.thenBy { it.name })
                        .orEmpty()

                    if (systemVoices.isEmpty()) {
                        voices.put(voiceToJsObject(engine.defaultVoice, Locale.getDefault(), true))
                    } else {
                        val defaultVoiceName = engine.defaultVoice?.name
                        for (voice in systemVoices) {
                            voices.put(
                                voiceToJsObject(
                                    voice = voice,
                                    fallbackLocale = voice.locale,
                                    isDefault = voice.name == defaultVoiceName,
                                ),
                            )
                        }
                    }

                    val payload = JSObject()
                    payload.put("voices", voices)
                    invoke.resolve(payload)
                } catch (error: Exception) {
                    invoke.reject(error.message ?: "读取 Android 系统 TTS 音色失败")
                }
            },
            onError = { message -> invoke.reject(message) },
        )
    }

    @Command
    fun speak(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(NativeTtsSpeakArgs::class.java)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "解析 Android 系统 TTS 参数失败")
            return
        }

        if (args.text.trim().isEmpty()) {
            invoke.resolve()
            return
        }

        withInitializedTts(
            onReady = { engine ->
                try {
                    startSpeech(engine, args, invoke)
                } catch (error: Exception) {
                    invoke.reject(error.message ?: "Android 系统 TTS 朗读失败")
                }
            },
            onError = { message -> invoke.reject(message) },
        )
    }

    @Command
    fun cancel(invoke: Invoke) {
        try {
            cancelCurrentSpeech()
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "停止 Android 系统 TTS 失败")
        }
    }

    private fun withInitializedTts(
        onReady: (TextToSpeech) -> Unit,
        onError: (String) -> Unit,
    ) {
        val callback = { engine: TextToSpeech?, message: String? ->
            if (engine != null) {
                onReady(engine)
            } else {
                onError(message ?: "Android 系统 TTS 初始化失败")
            }
        }

        val existingEngine: TextToSpeech?
        val existingError: String?
        val released: Boolean
        var shouldStart = false

        synchronized(lock) {
            existingEngine = tts
            existingError = initError
            released = isReleased
            if (!released && existingEngine == null && existingError == null) {
                waitingForInit.add(callback)
                if (!initStarted) {
                    initStarted = true
                    shouldStart = true
                }
            }
        }

        if (released) {
            onError("Android 系统 TTS 已释放")
            return
        }
        if (existingEngine != null) {
            onReady(existingEngine)
            return
        }
        if (existingError != null) {
            onError(existingError)
            return
        }
        if (shouldStart) {
            activity.runOnUiThread { startTtsInitialization() }
        }
    }

    private fun startTtsInitialization() {
        var createdEngine: TextToSpeech? = null
        createdEngine = TextToSpeech(activity.applicationContext) { status ->
            val callbacks: List<(TextToSpeech?, String?) -> Unit>
            val readyEngine = createdEngine.takeIf { status == TextToSpeech.SUCCESS }
            var engineToRelease: TextToSpeech? = null
            val message = if (readyEngine == null) {
                "Android 系统 TTS 初始化失败"
            } else {
                null
            }

            synchronized(lock) {
                if (isReleased) {
                    engineToRelease = readyEngine
                } else if (readyEngine != null) {
                    tts = readyEngine
                } else {
                    initError = message
                }

                callbacks = waitingForInit.toList()
                waitingForInit.clear()
            }

            engineToRelease?.shutdown()
            callbacks.forEach { callback -> callback(readyEngine, message) }
        }
    }

    private fun startSpeech(
        engine: TextToSpeech,
        args: NativeTtsSpeakArgs,
        invoke: Invoke,
    ) {
        cancelCurrentSpeech()

        val selectedVoice = args.voiceId
            ?.takeIf { it.isNotBlank() }
            ?.let { voiceId ->
                engine.voices?.firstOrNull { voice -> voice.name == voiceId }
                    ?: throw IllegalArgumentException("Android 系统 TTS 找不到音色: $voiceId")
            }

        if (selectedVoice != null) {
            engine.voice = selectedVoice
        } else {
            val locale = args.language
                ?.takeIf { it.isNotBlank() }
                ?.let { Locale.forLanguageTag(it) }
            if (locale != null) {
                val languageStatus = engine.setLanguage(locale)
                if (
                    languageStatus == TextToSpeech.LANG_MISSING_DATA ||
                    languageStatus == TextToSpeech.LANG_NOT_SUPPORTED
                ) {
                    engine.setLanguage(Locale.getDefault())
                }
            }
        }

        engine.setSpeechRate(args.rate.toFloat().coerceIn(0.6f, 1.8f))
        engine.setPitch((args.pitch ?: 1.0).toFloat().coerceIn(0.1f, 2.0f))

        val utteranceId = "sleep-companion-${SystemClock.uptimeMillis()}"
        synchronized(lock) {
            currentSpeech = PendingSpeech(utteranceId, invoke)
        }

        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit

            override fun onDone(utteranceId: String?) {
                finishSpeech(utteranceId, null)
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                finishSpeech(utteranceId, "Android 系统 TTS 朗读失败")
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                finishSpeech(utteranceId, "Android 系统 TTS 朗读失败: $errorCode")
            }
        })

        val params = Bundle()
        args.volume?.let { volume ->
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume.toFloat().coerceIn(0f, 1f))
        }

        val result = engine.speak(args.text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
        if (result == TextToSpeech.ERROR) {
            finishSpeech(utteranceId, "Android 系统 TTS 启动朗读失败")
        }
    }

    private fun cancelCurrentSpeech() {
        val pending = synchronized(lock) {
            val speech = currentSpeech
            currentSpeech = null
            speech
        }

        tts?.stop()
        pending?.invoke?.resolve()
    }

    private fun releaseTts() {
        val callbacks: List<(TextToSpeech?, String?) -> Unit>
        val pending: PendingSpeech?
        val engine: TextToSpeech?

        synchronized(lock) {
            isReleased = true
            pending = currentSpeech
            currentSpeech = null
            engine = tts
            tts = null
            initStarted = false
            initError = "Android 系统 TTS 已释放"
            callbacks = waitingForInit.toList()
            waitingForInit.clear()
        }

        try {
            engine?.stop()
        } finally {
            engine?.shutdown()
        }
        pending?.invoke?.resolve()
        callbacks.forEach { callback -> callback(null, "Android 系统 TTS 已释放") }
    }

    private fun finishSpeech(utteranceId: String?, errorMessage: String?) {
        val pending = synchronized(lock) {
            val speech = currentSpeech
            if (speech == null || speech.utteranceId != utteranceId) {
                null
            } else {
                currentSpeech = null
                speech
            }
        } ?: return

        if (errorMessage == null) {
            pending.invoke.resolve()
        } else {
            pending.invoke.reject(errorMessage)
        }
    }

    private fun voiceToJsObject(
        voice: Voice?,
        fallbackLocale: Locale,
        isDefault: Boolean,
    ): JSObject {
        val locale = voice?.locale ?: fallbackLocale
        val item = JSObject()
        item.put("id", voice?.name ?: "android:default")
        item.put("name", voice?.name ?: "Android 默认音色")
        item.put("language", locale.toLanguageTag())
        item.put("isDefault", isDefault)
        item.put("isLocal", voice?.isNetworkConnectionRequired != true)
        return item
    }
}
