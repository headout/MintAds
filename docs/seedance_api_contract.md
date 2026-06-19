Here's the complete API contract for the Seedance 2.0 Fast Reference-to-Video endpoint on fal.ai.

---

## `bytedance/seedance-2.0/fast/reference-to-video` — Complete API Contract

### What it is

The most flexible Seedance 2.0 endpoint. Takes a text prompt alongside up to 12 reference files (images, videos, audio) and generates a single cinematic video that incorporates all of them. You control which reference does what via `@Image1`, `@Video1`, `@Audio1` tags in the prompt text.

This is the endpoint you'd use for **cross-scene character consistency** — upload a creator reference image as `@Image1` and venue photos as `@Image2`, `@Image3`, and the model maintains the creator's appearance while placing them in the venue.

### Why it matters for MintAds

The image-to-video endpoint takes ONE source image. The reference-to-video endpoint takes up to NINE. For a UGC ad where you want the same creator appearing at the Colosseum exterior (hook) and then on the arena floor (body), you can pass the creator reference + both venue photos in a single call and get a coherent video with one consistent person across location changes. That's the character-consistency problem solved without Higgsfield's SoulId.

### Access restriction

The endpoint page shows an early-access gate requiring:
- Business customers only (not individual consumers)
- Geographic restriction (outside US)
- Must pass `end_user_id` in every request
- Must be able to identify and restrict end customers on request

Since you're Headout (India-based business), this should be fine. But confirm access by trying one test call tonight. If blocked, fall back to the image-to-video endpoint.

### SDK Setup

```typescript
// npm install @fal-ai/client
// IMPORTANT: @fal-ai/serverless-client is deprecated — do NOT use it

import { fal } from "@fal-ai/client";

// Auth via env var (auto-detected):
// export FAL_KEY="your-api-key"

// Or manual config:
fal.config({ credentials: "YOUR_FAL_KEY" });
```

### Input Schema

```typescript
interface ReferenceToVideoInput {
  // REQUIRED
  prompt: string;
  // Text describing the video. Use @Image1, @Image2, @Video1, @Audio1 etc.
  // to reference uploaded files. Positional: first image_urls entry = @Image1, second = @Image2.

  // OPTIONAL — at least one image or video is recommended
  image_urls?: string[];
  // Up to 9 images. JPEG, PNG, WebP. Max 30 MB each.
  // Referenced in prompt as @Image1, @Image2, ... @Image9

  video_urls?: string[];
  // Up to 3 videos. MP4, MOV. Combined duration 2–15s, total < 50 MB.
  // Each video must be ~480p to ~720p resolution.
  // Referenced as @Video1, @Video2, @Video3

  audio_urls?: string[];
  // Up to 3 audio files. MP3, WAV. Combined duration ≤ 15s, max 15 MB each.
  // Referenced as @Audio1, @Audio2, @Audio3
  // REQUIRES at least one image or video if audio is provided.

  // Total files across all modalities: max 12

  resolution?: "480p" | "720p";            // Default: "720p"
  duration?: "auto" | "4" | "5" | ... | "15";  // Default: "auto" — string, not number
  aspect_ratio?: "auto" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";  // Default: "auto"
  generate_audio?: boolean;                 // Default: true — same cost either way
  bitrate_mode?: "standard" | "high";       // Default: "standard"
  seed?: number;                            // For reproducibility (minor variation still possible)
  end_user_id?: string;                     // Required for this endpoint's access terms
}
```

### Output Schema

```typescript
interface ReferenceToVideoOutput {
  video: {
    url: string;          // Direct CDN URL to the MP4 file
    content_type: string; // "video/mp4"
    file_name: string;    // "video.mp4"
    file_size: number;    // Bytes
  };
  seed: number;           // The seed used (for reproducibility)
}
```

### Full TypeScript Call — MintAds Integration

```typescript
import { fal } from "@fal-ai/client";

async function generateSceneWithReferences(
  scene: SceneFromScript,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  adId: string
): Promise<VideoClipResult> {

  // Build image_urls array from scene's photo references
  const imageUrls = scene.photo_reference_indices.map(
    idx => facts.photos[idx].url
  );

  // Build prompt with @Image references
  const photoContext = scene.photo_reference_indices
    .map((idx, i) => `@Image${i + 1} shows: ${facts.photos[idx].keyword}`)
    .join(". ");

  const fullPrompt = [
    globalStyle.aesthetic,
    `Creator: ${globalStyle.creator_description}.`,
    `Location: ${facts.city} — ${facts.title}.`,
    photoContext,
    `Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.`,
    `No speech or lip-sync audio. Silent video only.`,
    `Creator shows only natural authentic human reactions.`,
    `No winking, no exaggerated gestures, no theatrical expressions.`,
    `All scenes share the same visual theme and color grade.`,
    `---`,
    scene.visual_direction,
  ].join("\n");

  const result = await fal.subscribe(
    "bytedance/seedance-2.0/fast/reference-to-video",
    {
      input: {
        prompt: fullPrompt,
        image_urls: imageUrls,
        resolution: "720p",
        duration: String(scene.duration_sec),
        aspect_ratio: "9:16",
        generate_audio: false,
        bitrate_mode: "standard",
        end_user_id: "mintads-headout",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`Scene ${scene.scene_id}: generating...`);
        }
      },
    }
  );

  // Download to local filesystem
  const videoUrl = result.data.video.url;
  const localPath = `/data/runs/${adId}/clips/clip_${String(scene.scene_id).padStart(3, "0")}.mp4`;
  await downloadFile(videoUrl, localPath);

  return {
    scene_id: scene.scene_id,
    beat: scene.beat,
    shot_type: scene.shot_type,
    file_path: localPath,
    remote_url: videoUrl,
    duration_sec: scene.duration_sec,
  };
}
```

### Pricing

| Condition | Rate per second |
|---|---|
| Images only (our case) | $0.2419/sec |
| With video inputs provided | $0.1452/sec (0.6× multiplier) |

Token formula: `(height × width × (input_video_duration + output_video_duration) × 24) / 1024`

For our typical scene (720p, 9:16 = 720×1280, 6 seconds, images only):
```
Cost = 6 × $0.2419 = $1.45 per scene
```

### How `@Image` References Actually Work

The number-to-input mapping is positional. The first image you upload is @Image1, the second is @Image2, and so on.

You could provide a product photo as @Image1, a mood board image as @Image2, and an audio clip of a voiceover as @Audio1, then prompt: "@Image1 is the hero product. Place it center frame on a wooden surface styled like @Image2."

For MintAds, the practical mapping per scene type:

**ugc_creator scenes (2+ images):**
```
image_urls: [creator_reference_photo, venue_photo_1, venue_photo_2]

Prompt: "@Image1 is the creator — maintain their exact appearance (face, hair, outfit, body type).
@Image2 shows the location exterior. @Image3 shows the location interior.
The creator from @Image1 walks through the location from @Image2, handheld UGC style..."
```

**b_roll / experience_detail scenes (1–2 images):**
```
image_urls: [venue_photo_1, venue_photo_2]

Prompt: "@Image1 shows the main location. @Image2 shows a detail view.
Cinematic b-roll sweeping from @Image1's wide angle into @Image2's detail..."
```

**pov scenes (1 image):**
```
image_urls: [venue_photo]

Prompt: "@Image1 is the POV destination. First-person walking toward @Image1,
handheld iPhone footage, slightly shaky, authentic tourist moment..."
```

### Key Prompt Tips from Research

The key is not to upload as many files as possible. The key is to assign every file a clear role.

Use scene cuts and timestamps to control pacing (e.g. "Cut scene to...", "At 5 seconds...").

For MintAds prompts:
- Explicitly label what each @Image is ("@Image1 is the creator", "@Image2 is the venue exterior")
- Don't upload images without referencing them — unused references confuse the model
- Use "Cut scene to..." for body scenes that need a visual transition
- Keep the creator description identical across all scene prompts for consistency

### Comparison: Reference-to-Video vs Image-to-Video

| Capability | Reference-to-Video | Image-to-Video |
|---|---|---|
| Model ID | `bytedance/seedance-2.0/fast/reference-to-video` | `bytedance/seedance-2.0/fast/image-to-video` |
| Input images | Up to 9 via `image_urls[]` | Exactly 1 via `image_url` (string) |
| End frame | Not supported | `end_image_url` supported |
| Video inputs | Up to 3 | Not supported |
| Audio inputs | Up to 3 | Not supported |
| Character consistency | Via multiple reference images | Via prompt only |
| Access | Early access required | Generally available |
| Pricing | $0.2419/sec (same) | $0.2419/sec (same) |
| Best for | Creator-in-scene shots (ugc_creator) | Single-photo b-roll, POV, detail shots |

### Recommended Strategy for MintAds

Use **both endpoints** in the same pipeline, selected per scene based on `shot_type`:

| shot_type | Endpoint | Why |
|---|---|---|
| `ugc_creator` | reference-to-video | Multiple images → character + venue consistency |
| `b_roll` | image-to-video | Single venue photo → motion; simpler, fewer inputs |
| `pov` | image-to-video | Single venue photo → POV motion |
| `experience_detail` | image-to-video | Single detail photo → slow reveal |

If reference-to-video access is blocked, fall back to image-to-video for everything — character consistency via prompt only, no code changes needed (just the model ID swaps).

### Queue / Async Usage (for long-running jobs)

```typescript
// Submit without waiting
const { request_id } = await fal.queue.submit(
  "bytedance/seedance-2.0/fast/reference-to-video",
  {
    input: { prompt, image_urls, resolution: "720p", duration: "6", ... },
    webhookUrl: "https://your-server.com/webhook/fal-complete"  // optional
  }
);

// Check status
const status = await fal.queue.status(
  "bytedance/seedance-2.0/fast/reference-to-video",
  { requestId: request_id, logs: true }
);
// status.status = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"

// Fetch result when done
const result = await fal.queue.result(
  "bytedance/seedance-2.0/fast/reference-to-video",
  { requestId: request_id }
);
```

For the hackathon, `fal.subscribe()` is simpler (handles polling internally). Use queue + webhook only if you need to decouple the HTTP request from the generation (e.g., for a progress UI that doesn't hold an open connection).