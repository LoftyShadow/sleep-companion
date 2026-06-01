interface PlaybackGlyphProps {
  isPlaying: boolean;
  className?: string;
}

export function PlaybackGlyph({
  isPlaying,
  className = "transport-glyph",
}: PlaybackGlyphProps) {
  return (
    <span className={className} aria-hidden="true">
      <svg
        className="playback-glyph__icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isPlaying ? (
          <>
            <rect x="7" y="5.5" width="3.8" height="13" rx="1.1" />
            <rect x="13.2" y="5.5" width="3.8" height="13" rx="1.1" />
          </>
        ) : (
          <path d="M8.5 5.8 18 12l-9.5 6.2Z" />
        )}
      </svg>
    </span>
  );
}
