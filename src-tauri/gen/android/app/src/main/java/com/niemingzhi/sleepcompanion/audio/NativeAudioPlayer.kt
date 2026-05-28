package com.niemingzhi.sleepcompanion.audio

import android.app.Activity
import android.media.MediaPlayer

data class NativeAudioState(
    val soundId: String,
    val isPlaying: Boolean,
    val volume: Double,
)

class NativeAudioPlayer(private val activity: Activity) {
    private data class PlayerEntry(
        val player: MediaPlayer,
        var volume: Double,
    )

    private val players = mutableMapOf<String, PlayerEntry>()

    @Synchronized
    fun play(soundId: String, resourceName: String, volume: Double) {
        val nextVolume = volume.coerceIn(0.0, 1.0)
        val existing = players[soundId]

        if (existing != null) {
            existing.volume = nextVolume
            existing.player.setVolume(nextVolume.toFloat(), nextVolume.toFloat())
            existing.player.isLooping = true
            if (!isPlayingSafely(existing.player)) {
                existing.player.start()
            }
            return
        }

        val resourceId = activity.resources.getIdentifier(
            resourceName,
            "raw",
            activity.packageName,
        )
        require(resourceId != 0) { "Missing raw resource: $resourceName" }

        val mediaPlayer = MediaPlayer.create(activity, resourceId)
            ?: error("Unable to create MediaPlayer for: $resourceName")

        mediaPlayer.isLooping = true
        mediaPlayer.setVolume(nextVolume.toFloat(), nextVolume.toFloat())
        mediaPlayer.setOnErrorListener { player, _, _ ->
            synchronized(this@NativeAudioPlayer) {
                players.remove(soundId)
            }
            player.release()
            true
        }

        players[soundId] = PlayerEntry(mediaPlayer, nextVolume)
        mediaPlayer.start()
    }

    @Synchronized
    fun pause(soundId: String) {
        val entry = players.remove(soundId) ?: return
        release(entry.player)
    }

    @Synchronized
    fun setVolume(soundId: String, volume: Double) {
        val entry = players[soundId] ?: return
        val nextVolume = volume.coerceIn(0.0, 1.0)
        entry.volume = nextVolume
        entry.player.setVolume(nextVolume.toFloat(), nextVolume.toFloat())
    }

    @Synchronized
    fun stopAll() {
        for (entry in players.values) {
            release(entry.player)
        }
        players.clear()
    }

    @Synchronized
    fun getState(): List<NativeAudioState> {
        return players.map { (soundId, entry) ->
            NativeAudioState(
                soundId = soundId,
                isPlaying = isPlayingSafely(entry.player),
                volume = entry.volume,
            )
        }
    }

    private fun release(player: MediaPlayer) {
        try {
            if (isPlayingSafely(player)) {
                player.stop()
            }
        } catch (_: IllegalStateException) {
            // MediaPlayer may already be outside the Started state.
        } finally {
            player.release()
        }
    }

    private fun isPlayingSafely(player: MediaPlayer): Boolean {
        return try {
            player.isPlaying
        } catch (_: IllegalStateException) {
            false
        }
    }
}
