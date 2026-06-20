import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EndCard, EndCardProps } from './EndCard';

const MUSIC_FILES: Record<string, string> = {
  wanderlust_folk:   'wanderlust-justin-lee-main-version-29117-01-40.mp3',
  good_times_upbeat: 'let-good-times-roll-ra-main-version-02-57-13553.mp3',
  blue_sunset_house: 'blue-sunset-matrika-main-version-45592-02-16.mp3',
};

export interface VoSegmentDef {
  sceneId: number;
  filePath: string;    // file:// URL or remote URL
  durationSec: number; // actual ElevenLabs output duration (may differ from script target)
  lipSync?: boolean;   // true = segment's video already carries the audio; skip the VO track
}

export interface ClipDef {
  src: string;         // file:// URL or remote URL
  durationSec: number;
  beat: string;
  sceneId: number;
  lipSync?: boolean;   // true = unmute video (audio baked in by Seedance); false = mute (VO track owns audio)
}

export interface AdProps {
  clips: ClipDef[];
  voSegments: VoSegmentDef[]; // one per content scene (all non-cta scenes)
  bgMusicTheme?: string;
  bgMusicVolume?: number; // 0–1, default 0.12
  textOverlays: Array<{
    text: string;
    keyword: string;
    keywordColor: string;
    position: 'top' | 'center' | 'bottom';
    startSec: number;
    durationSec: number;
  }>;
  endCard: EndCardProps;
  fps: number;
}

export const AdComposition: React.FC<AdProps> = ({
  clips,
  voSegments,
  bgMusicTheme,
  bgMusicVolume = 0.3,
  textOverlays,
  endCard,
  fps,
}) => {
  // Pre-compute clip frame offsets — clips must arrive sorted by sceneId
  let acc = 0;
  const clipsWithOffsets = clips.map((clip) => {
    const startFrame = acc;
    const durationFrames = Math.round(clip.durationSec * fps);
    acc += durationFrames;
    return { ...clip, startFrame, durationFrames };
  });
  const endCardStartFrame = acc;
  const endCardDurationFrames = Math.round(4 * fps);

  // Map sceneId → clip startFrame and durationFrames for VO placement and bounding
  const sceneStartFrame = new Map<number, number>(
    clipsWithOffsets.map(c => [c.sceneId, c.startFrame]),
  );
  const sceneFrameCount = new Map<number, number>(
    clipsWithOffsets.map(c => [c.sceneId, c.durationFrames]),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Video clips.
          Lip-sync clips carry the ElevenLabs audio baked in by Seedance — unmuted (volume=1).
          All other clips are silent — ElevenLabs VO track plays separately below. */}
      {clipsWithOffsets.map((clip, i) => (
        <Sequence
          from={clip.startFrame}
          durationInFrames={clip.durationFrames}
          key={`clip-${i}`}
        >
          <OffthreadVideo
            src={clip.src}
            volume={clip.lipSync ? 1 : 0}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Sequence>
      ))}

      {/* End card (Remotion React component — not a Seedance clip) */}
      <Sequence from={endCardStartFrame} durationInFrames={endCardDurationFrames}>
        <EndCard {...endCard} />
      </Sequence>

      {/* VO audio — ElevenLabs segments for non-lip-sync scenes only.
          Lip-sync scenes use the video's own embedded audio track instead. */}
      {voSegments.map((seg, i) => {
        if (seg.lipSync) return null; // video already has this audio baked in

        const startFrame = sceneStartFrame.get(seg.sceneId);
        const durationFrames = sceneFrameCount.get(seg.sceneId);
        if (startFrame === undefined || durationFrames === undefined) return null;

        return (
          <Sequence from={startFrame} durationInFrames={durationFrames} key={`vo-${i}`}>
            <Audio src={seg.filePath} volume={1} />
          </Sequence>
        );
      })}

      {/* Background music — plays throughout at low volume */}
      {bgMusicTheme && MUSIC_FILES[bgMusicTheme] && (
        <Audio src={staticFile(MUSIC_FILES[bgMusicTheme])} volume={bgMusicVolume} />
      )}

      {/* Text overlays — keyword style, fade in over first 8 frames */}
      {textOverlays.filter((o) => o.keyword).map((overlay, i) => (
        <Sequence
          from={Math.round(overlay.startSec * fps)}
          durationInFrames={Math.round(overlay.durationSec * fps)}
          key={`text-${i}`}
        >
          <TextOverlay
            text={overlay.text}
            keyword={overlay.keyword}
            keywordColor={overlay.keywordColor}
            position={overlay.position}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const POSITION_STYLE: Record<'top' | 'center' | 'bottom', React.CSSProperties> = {
  top:    { justifyContent: 'flex-start', paddingTop: 120 },
  center: { justifyContent: 'center' },
  bottom: { justifyContent: 'flex-end', paddingBottom: 140 },
};

const TextOverlay: React.FC<{
  text: string;
  keyword: string;
  keywordColor: string;
  position: 'top' | 'center' | 'bottom';
}> = ({ text, keyword, keywordColor, position }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  const shadow = '0 2px 12px rgba(0,0,0,0.85)';

  return (
    <AbsoluteFill style={{
      alignItems: 'center',
      padding: '0 48px',
      ...POSITION_STYLE[position],
    }}>
      <div style={{ opacity, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Setup line — white, smaller, regular weight */}
        {text !== '' && (
          <div style={{
            color: 'white',
            fontSize: 46,
            fontWeight: 500,
            lineHeight: 1.15,
            textShadow: shadow,
            marginBottom: 4,
          }}>
            {text}
          </div>
        )}
        {/* Keyword line — colored, large, bold italic */}
        <div style={{
          color: keywordColor,
          fontSize: 72,
          fontWeight: 900,
          fontStyle: 'italic',
          lineHeight: 1.1,
          textShadow: shadow,
        }}>
          {keyword}
        </div>
      </div>
    </AbsoluteFill>
  );
};
