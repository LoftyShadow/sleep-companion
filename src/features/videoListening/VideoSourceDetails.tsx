import type {
  BilibiliDirectAudioSource,
  BilibiliDirectVideoTrack,
} from "./bilibiliDirectAudio";
import {
  formatBandwidth,
  formatVideoResolution,
} from "./bilibiliVideoPlaybackUtils";

interface VideoSourceDetailsProps {
  audioSource: BilibiliDirectAudioSource | null;
  canExpandVideo: boolean;
  currentVideoTrack: BilibiliDirectVideoTrack | null;
}

export function VideoSourceDetails({
  audioSource,
  canExpandVideo,
  currentVideoTrack,
}: VideoSourceDetailsProps) {
  if (!audioSource) {
    return null;
  }

  return (
    <div className="video-direct-source-shell" aria-label="直连媒体源">
      <dl className="video-direct-source-list">
        <div>
          <dt>BV</dt>
          <dd>{audioSource.bvid}</dd>
        </div>
        <div>
          <dt>av</dt>
          <dd>{audioSource.aid}</dd>
        </div>
        <div>
          <dt>cid</dt>
          <dd>{audioSource.cid}</dd>
        </div>
        <div>
          <dt>音频</dt>
          <dd>{audioSource.mimeType ?? audioSource.codecs ?? "音频轨"}</dd>
        </div>
        <div>
          <dt>音频码率</dt>
          <dd>{formatBandwidth(audioSource.bandwidth)}</dd>
        </div>
        <div>
          <dt>视频</dt>
          <dd>
            {canExpandVideo
              ? currentVideoTrack?.mimeType ??
                currentVideoTrack?.codecs ??
                "视频轨"
              : "无可用视频轨"}
          </dd>
        </div>
        <div>
          <dt>分辨率</dt>
          <dd>
            {canExpandVideo ? formatVideoResolution(currentVideoTrack) : "无"}
          </dd>
        </div>
        <div>
          <dt>视频码率</dt>
          <dd>
            {canExpandVideo
              ? formatBandwidth(currentVideoTrack?.bandwidth)
              : "无"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
