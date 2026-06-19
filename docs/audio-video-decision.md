You've laid this out clearly. Three segment types, lip-sync is mandatory for creator-talking scenes, and you're fine with audio being sequential. Let me cut through the options and give you the one approach that actually works cleanly.

## The approach: Audio-first, per-segment, lip-sync via @Audio1

Here's why none of the other paths are clean:

Generating one continuous VO and stitching later — lip-sync is impossible because Seedance needs the audio *during* generation to move the creator's mouth correctly.

Using Seedance's `generate_audio: true` without feeding it your own VO — you lose control over what words are spoken. Seedance will make up its own dialogue. That breaks claim-tracing (the entire "true" USP).

So the only viable architecture is: **generate the VO first, then feed it into Seedance as a reference for lip-sync scenes.**

## The full pipeline

```
Script Engine → script.json
    │
    │  Contains per-scene: shot_type + lip_sync flag + vo_text
    │
    ▼
┌─────────────────────────────────────────────┐
│  STEP 1: Generate ALL VO segments           │
│  ElevenLabs per-segment (not one file)      │
│                                             │
│  Scene 1 (hook, lip_sync: true)  → vo_1.mp3│
│  Scene 2 (body, lip_sync: false) → vo_2.mp3│
│  Scene 3 (body, lip_sync: false) → vo_3.mp3│
│  Scene 4 (payoff, lip_sync: true)→ vo_4.mp3│
│                                             │
│  ~3-5 seconds total                         │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
    ▼                             ▼
┌──────────────────┐  ┌──────────────────────────┐
│ STEP 2a:         │  │ STEP 2b:                  │
│ NON-LIP-SYNC     │  │ LIP-SYNC scenes           │
│ scenes            │  │                           │
│                   │  │ reference-to-video with:  │
│ Can start         │  │  @Audio1 = vo_segment.mp3 │
│ PARALLEL with     │  │  @Image1 = creator photo  │
│ Step 1            │  │  @Image2 = venue photo    │
│                   │  │  generate_audio: true      │
│ reference-to-video│  │                           │
│ or image-to-video │  │ MUST WAIT for Step 1      │
│ generate_audio:   │  │ (needs the audio file)    │
│ false             │  │                           │
│                   │  │ → lip-synced video WITH   │
│ → silent clips    │  │   audio embedded          │
└────────┬─────────┘  └─────────┬────────────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
┌─────────────────────────────────────────────┐
│  STEP 3: Remotion Assembly                  │
│                                             │
│  ALL video clips: volume = 0 (muted)        │
│  ALL VO segments: layered as <Audio> at     │
│  their correct timestamps                   │
│                                             │
│  Why mute the lip-sync clips' embedded      │
│  audio? Because we want ALL audio to come   │
│  from the same ElevenLabs source for        │
│  consistent voice quality throughout.       │
│  The lip-sync clips have correct mouth      │
│  movements (guided by the audio during      │
│  generation) but we play the original       │
│  ElevenLabs file for the actual sound.      │
└─────────────────────────────────────────────┘
```

## Why this works

The lip-sync clips get correct mouth movements because Seedance received the actual VO as `@Audio1` during generation. But we mute their embedded audio in Remotion and play the original ElevenLabs segments instead. This avoids a nasty problem: Seedance adds its own ambient sounds when `generate_audio: true`, so the embedded audio would be "ElevenLabs VO + Seedance ambient." The non-lip-sync scenes would only have "ElevenLabs VO." The listener would hear inconsistent background texture between scenes. By muting everything and using the raw ElevenLabs files as the single audio source, every scene sounds the same.

The lip movements on the creator are still correct because they were generated from the same audio. The mouth shapes don't change when you swap the audio source — they're baked into the video frames.

## What the script engine needs to produce

Each scene now carries a `lip_sync` flag that drives the pipeline routing:

```json
{
  "video_script": {
    "scenes": [
      {
        "scene_id": 1,
        "beat": "hook",
        "shot_type": "ugc_creator",
        "lip_sync": true,
        "duration_sec": 5,
        "visual_direction": "Creator talks directly to camera outside the Colosseum...",
        "photo_reference_indices": [0, 1],
        "text_overlay": null
      },
      {
        "scene_id": 2,
        "beat": "body",
        "shot_type": "b_roll",
        "lip_sync": false,
        "duration_sec": 8,
        "visual_direction": "Sweeping interior shot of the Colosseum arena floor...",
        "photo_reference_indices": [2],
        "text_overlay": "We walked straight in."
      },
      {
        "scene_id": 3,
        "beat": "body",
        "shot_type": "ugc_creator",
        "lip_sync": false,
        "duration_sec": 7,
        "visual_direction": "Creator walking through the arena, arms wide, looking around in awe...",
        "photo_reference_indices": [2, 3],
        "text_overlay": null
      },
      {
        "scene_id": 4,
        "beat": "payoff",
        "shot_type": "ugc_creator",
        "lip_sync": true,
        "duration_sec": 6,
        "visual_direction": "Creator turns to camera with genuine excitement, arena behind them...",
        "photo_reference_indices": [3],
        "text_overlay": "Free cancellation"
      }
    ]
  },
  "audio_script": {
    "vo_segments": [
      {
        "scene_id": 1,
        "vo_text": "You did NOT fly to Rome to stand in line for three hours.",
        "target_duration_sec": 5,
        "pacing": "fast, punchy",
        "pause_after_sec": 0.3
      },
      {
        "scene_id": 2,
        "vo_text": "Look at this place. I walked straight past all of them.",
        "target_duration_sec": 8,
        "pacing": "energetic, building",
        "pause_after_sec": 0.2
      },
      {
        "scene_id": 3,
        "vo_text": "Headout skip-the-line. Twenty-nine euros. Arena floor in minutes.",
        "target_duration_sec": 7,
        "pacing": "confident",
        "pause_after_sec": 0.3
      },
      {
        "scene_id": 4,
        "vo_text": "And if plans change? Free cancellation. Link's right there.",
        "target_duration_sec": 6,
        "pacing": "slower, closing"
      }
    ]
  }
}
```

Notice: scenes 1 and 4 have `lip_sync: true` (creator talking to camera), scene 3 has the creator present but `lip_sync: false` (creator reacting, VO narrates over), scene 2 has no creator at all. Three types, one pipeline.

## The orchestrator logic

```typescript
async function runVideoAudioPipeline(script: ScriptJson, facts: FactsJson, adId: string) {

  const scenes = script.video_script.scenes.filter(s => s.beat !== "cta");
  const lipSyncScenes = scenes.filter(s => s.lip_sync);
  const nonLipSyncScenes = scenes.filter(s => !s.lip_sync);

  // STEP 1 + STEP 2a run in PARALLEL
  const [voSegments, nonLipSyncClips] = await Promise.all([

    // Step 1: Generate ALL VO segments via ElevenLabs
    Promise.all(
      script.audio_script.vo_segments.map(seg =>
        generateVoSegment(seg, adId)
        // Returns: { scene_id, file_path, duration_sec }
      )
    ),

    // Step 2a: Generate non-lip-sync video clips (don't need audio)
    Promise.all(
      nonLipSyncScenes.map(scene =>
        generateVideoClip({
          scene,
          facts,
          globalStyle: script.global_style,
          audioUrl: undefined,      // no audio reference
          generateAudio: false,     // silent output
        })
      )
    ),
  ]);

  // STEP 2b: Generate lip-sync clips (needs VO segments from Step 1)
  const lipSyncClips = await Promise.all(
    lipSyncScenes.map(scene => {
      const voSegment = voSegments.find(v => v.scene_id === scene.scene_id);
      return generateVideoClip({
        scene,
        facts,
        globalStyle: script.global_style,
        audioUrl: voSegment.file_path,  // passed as @Audio1
        generateAudio: true,             // Seedance uses audio for lip-sync
      });
    })
  );

  // Combine and sort by scene_id
  const allClips = [...nonLipSyncClips, ...lipSyncClips]
    .sort((a, b) => a.scene_id - b.scene_id);

  return { clips: allClips, voSegments };
}
```

## The fal.ai call for lip-sync scenes

```typescript
async function generateVideoClip(input: {
  scene: Scene,
  facts: FactsJson,
  globalStyle: GlobalStyle,
  audioUrl?: string,
  generateAudio: boolean,
}) {
  const { scene, facts, globalStyle, audioUrl, generateAudio } = input;

  const imageUrls = scene.photo_reference_indices.map(
    idx => facts.photos[idx].url
  );

  // Build @Image and @Audio references in prompt
  const photoContext = scene.photo_reference_indices
    .map((idx, i) => `@Image${i + 1} shows: ${facts.photos[idx].keyword}`)
    .join(". ");

  const audioContext = audioUrl
    ? `@Audio1 is the creator's voiceover — lip-sync the creator's mouth to this audio exactly.`
    : "";

  const prompt = [
    globalStyle.aesthetic,
    `Creator: ${globalStyle.creator_description}.`,
    `Location: ${facts.city} — ${facts.title}.`,
    photoContext,
    audioContext,
    `Do NOT embed any text, captions, subtitles, titles, or watermarks.`,
    scene.lip_sync
      ? `Creator speaks directly to camera. Lip movements MUST match @Audio1.`
      : scene.shot_type === "ugc_creator"
        ? `Creator is visible but NOT speaking. Natural reactions only — awe, wonder, walking.`
        : `No person in frame. Cinematic b-roll footage.`,
    `---`,
    scene.visual_direction,
  ].join("\n");

  const falInput: any = {
    prompt,
    image_urls: imageUrls,
    resolution: "720p",
    duration: String(scene.duration_sec),
    aspect_ratio: "9:16",
    generate_audio: generateAudio,
    end_user_id: "mintads-headout",
  };

  // Add audio reference for lip-sync scenes
  if (audioUrl) {
    falInput.audio_urls = [audioUrl];
  }

  const result = await fal.subscribe(
    "bytedance/seedance-2.0/fast/reference-to-video",
    { input: falInput, logs: true }
  );

  return {
    scene_id: scene.scene_id,
    file_path: await downloadFile(result.data.video.url, ...),
    duration_sec: scene.duration_sec,
  };
}
```

## The Remotion assembly

```tsx
export const AdComposition: React.FC<Props> = ({ scenes, voSegments, endCard, fps }) => {
  let currentFrame = 0;

  return (
    <AbsoluteFill>
      {/* ALL video clips — always muted */}
      {scenes.map((scene, i) => {
        const from = currentFrame;
        const frames = Math.round(scene.durationSec * fps);
        currentFrame += frames;
        return (
          <Sequence from={from} durationInFrames={frames} key={i}>
            <OffthreadVideo
              src={scene.clipSrc}
              volume={0}  // ALWAYS muted — even lip-sync clips
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
        );
      })}

      {/* End card */}
      <Sequence from={currentFrame} durationInFrames={4 * fps}>
        <EndCard {...endCard} />
      </Sequence>

      {/* ALL audio comes from ElevenLabs segments — consistent voice */}
      {voSegments.map((seg, i) => {
        const startFrame = scenes
          .slice(0, i)
          .reduce((sum, s) => sum + Math.round(s.durationSec * fps), 0);
        return (
          <Sequence from={startFrame} durationInFrames={Math.round(seg.durationSec * fps)} key={`vo-${i}`}>
            <Audio src={seg.filePath} volume={1} />
          </Sequence>
        );
      })}

      {/* Text overlays */}
      {scenes.map((scene, i) =>
        scene.textOverlay ? (
          <Sequence
            from={scenes.slice(0, i).reduce((sum, s) => sum + Math.round(s.durationSec * fps), 0)}
            durationInFrames={Math.round(scene.durationSec * fps)}
            key={`text-${i}`}
          >
            <TextOverlay text={scene.textOverlay} />
          </Sequence>
        ) : null
      )}
    </AbsoluteFill>
  );
};
```

## Timing reality

```
Audio gen:  4 segments × ~3s each = ~12s (parallel) = ~3-5s wall time
            ↓
Lip-sync video gen: 2 scenes × ~90s each (parallel) = ~90s wall time
Non-lip-sync video gen: 2 scenes × ~90s each (parallel) = ~90s wall time
            ↑ these run parallel with audio gen

Total wall time: ~5s (audio) + ~90s (lip-sync video, sequential after audio)
But non-lip-sync started parallel with audio, so:

Effective total: ~95-120 seconds for all video + audio
vs previous plan: ~90-120 seconds (was already bottlenecked on video gen)
```

You lose maybe 5–10 seconds of parallelism. The pipeline time barely changes because video generation was always the bottleneck. Audio generation is trivially fast.

## One thing to validate tonight

The entire approach depends on: does `audio_urls` in reference-to-video actually produce lip-synced mouth movements? Run one test:

1. Generate a 5-second ElevenLabs VO clip ("You did NOT fly to Rome to stand in line for three hours.")
2. Upload it alongside a creator photo to fal.ai reference-to-video playground
3. Prompt: `@Image1 is a travel creator. @Audio1 is their voiceover. Creator speaks directly to camera, lip-sync to @Audio1.`
4. Check: does the creator's mouth move in sync with the words?

If yes — this approach is confirmed. If no — fall back to Path A (reacting creator, no lip-sync) and mark speech2video as the stretch goal.