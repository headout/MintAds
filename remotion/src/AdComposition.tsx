import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { EndCard, EndCardProps } from './EndCard';

export interface ClipDef {
  src: string;
  durationSec: number;
  beat: string;
  lipSync?: boolean; // audio already baked in by Seedance — skip separate VO track
  voSrc?: string;   // VO .mp3 path for non-lip-sync content scenes
}

export interface AdProps {
  clips: ClipDef[];
  bgMusicSrc?: string;
  bgMusicVolume?: number; // 0–1, default 0.12
  textOverlays: Array<{ text: string; startSec: number; durationSec: number }>;
  endCard: EndCardProps;
  fps: number;
}

export const AdComposition: React.FC<AdProps> = ({
  clips,
  bgMusicSrc,
  bgMusicVolume = 0.12,
  textOverlays,
  endCard,
  fps,
}) => {
  // Pre-compute frame offsets so we never mutate state inside render
  let acc = 0;
  const clipsWithOffsets = clips.map((clip) => {
    const startFrame = acc;
    const durationFrames = Math.round(clip.durationSec * fps);
    acc += durationFrames;
    return { ...clip, startFrame, durationFrames };
  });
  const endCardStartFrame = acc;
  const endCardDurationFrames = Math.round(4 * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Video clips */}
      {clipsWithOffsets.map((clip, i) => (
        <Sequence
          from={clip.startFrame}
          durationInFrames={clip.durationFrames}
          key={`clip-${i}`}
        >
          <OffthreadVideo
            src={clip.src}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* VO audio for non-lip-sync scenes (lip-sync has audio baked into the video) */}
          {!clip.lipSync && clip.voSrc && (
            <Audio src={clip.voSrc} volume={1} />
          )}
        </Sequence>
      ))}

      {/* End card */}
      <Sequence from={endCardStartFrame} durationInFrames={endCardDurationFrames}>
        <EndCard {...endCard} />
      </Sequence>

      {/* Background music — plays throughout at low volume */}
      {bgMusicSrc && (
        <Audio src={bgMusicSrc} volume={bgMusicVolume} />
      )}

      {/* Text overlays */}
      {textOverlays.filter((o) => o.text).map((overlay, i) => (
        <Sequence
          from={Math.round(overlay.startSec * fps)}
          durationInFrames={Math.round(overlay.durationSec * fps)}
          key={`text-${i}`}
        >
          <TextOverlay text={overlay.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const TextOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 40px 120px 40px' }}>
      <div style={{
        color: 'white',
        fontSize: 52,
        fontWeight: 800,
        textAlign: 'center',
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        opacity,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};
