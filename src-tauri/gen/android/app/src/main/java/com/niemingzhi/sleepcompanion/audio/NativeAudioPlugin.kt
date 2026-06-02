package com.niemingzhi.sleepcompanion.audio

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import androidx.appcompat.app.AppCompatActivity

@InvokeArg
class NativeAudioPlayArgs {
    lateinit var soundId: String
    lateinit var resourceName: String
    var volume: Double = 0.5
}

@InvokeArg
class NativeAudioSoundArgs {
    lateinit var soundId: String
}

@InvokeArg
class NativeAudioVolumeArgs {
    lateinit var soundId: String
    var volume: Double = 0.5
}

@TauriPlugin
class NativeAudioPlugin(private val activity: Activity) : Plugin(activity) {
    private val player = NativeAudioPlayer(activity)

    override fun onStop() {
        stopAllSafely()
    }

    override fun onDestroy(activity: AppCompatActivity) {
        stopAllSafely()
    }

    @Command
    fun play(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(NativeAudioPlayArgs::class.java)
            player.play(args.soundId, args.resourceName, args.volume)
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "播放失败")
        }
    }

    @Command
    fun pause(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(NativeAudioSoundArgs::class.java)
            player.pause(args.soundId)
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "暂停失败")
        }
    }

    @Command
    fun setVolume(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(NativeAudioVolumeArgs::class.java)
            player.setVolume(args.soundId, args.volume)
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "音量调整失败")
        }
    }

    @Command
    fun stopAll(invoke: Invoke) {
        try {
            player.stopAll()
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "停止播放失败")
        }
    }

    @Command
    fun getState(invoke: Invoke) {
        try {
            val sounds = JSArray()
            for (state in player.getState()) {
                val sound = JSObject()
                sound.put("soundId", state.soundId)
                sound.put("isPlaying", state.isPlaying)
                sound.put("volume", state.volume)
                sounds.put(sound)
            }

            val snapshot = JSObject()
            snapshot.put("sounds", sounds)
            invoke.resolve(snapshot)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "读取播放状态失败")
        }
    }

    private fun stopAllSafely() {
        try {
            player.stopAll()
        } catch (_: Exception) {
        }
    }
}
