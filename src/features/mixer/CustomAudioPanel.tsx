import "./CustomAudioPanel.css";
import "./CustomAudioPanel.mobile.css";

interface CustomAudioPanelProps {
  customSoundCount: number;
  customSoundMessage: string | null;
  isImportingCustomSound: boolean;
  onAddCustomSoundFiles: (files: File[]) => void;
}

export function CustomAudioPanel({
  customSoundCount,
  customSoundMessage,
  isImportingCustomSound,
  onAddCustomSoundFiles,
}: CustomAudioPanelProps) {
  const fileInputId = "custom-audio-file-input";

  return (
    <section className="custom-audio-panel" aria-label="自定义音频导入">
      <div className="custom-audio-copy">
        <p className="app-kicker">本地音频</p>
        <h3>添加自定义音频</h3>
        <p>支持常见音频文件，导入后会保存在本机，并和内置声音一起播放。</p>
        <p className="custom-audio-status" role="status">
          {customSoundMessage ?? `${customSoundCount} 个自定义音频`}
        </p>
      </div>
      <div className="custom-audio-action">
        <span className="custom-audio-upload-note">选文件后自动导入</span>
        <label className="custom-audio-button" htmlFor={fileInputId}>
          <span>{isImportingCustomSound ? "添加中" : "添加音频"}</span>
          <input
            accept="audio/*,.aac,.flac,.m4a,.mp3,.ogg,.wav,.webm"
            aria-label="添加自定义音频"
            className="custom-audio-input"
            disabled={isImportingCustomSound}
            id={fileInputId}
            multiple
            name="customAudioFiles"
            type="file"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              onAddCustomSoundFiles(files);
            }}
          />
        </label>
      </div>
    </section>
  );
}
