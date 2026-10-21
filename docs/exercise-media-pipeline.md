# Reviewed exercise media intake

Status: **BLOCKED_NO_REVIEWED_ASSETS**. The shipped manifest contains zero assets. No animation coverage or professional approval is claimed. Existing written library instructions are labeled as awaiting technical review.

The initial release accepts at most five exercises. It plays pre-rendered H.264 clips of reviewed realistic muscular GLB models; it does not ship an interactive 3D renderer. No decoder is mounted until the member explicitly opens an approved demonstration. With no approved asset, technique text remains available.

## Intake and approval

1. Obtain a source model and commercial redistribution license. Keep GLB source under private `media-source/` and dated reviewer evidence under `media-source/reviews/`. Do not add private source/review files to public deployments.
2. A qualified exercise professional must inspect the movement, range, joint alignment and cues. Record their identity, dated approval, exercise mapping and bilingual cues. License review and exercise review are separate approvals; schema validity cannot establish professional competence or license authenticity.
3. Render the approved motion to silent H.264 MP4, 3–30 seconds, 24–30 fps, maximum 720px per dimension and 4 MiB. Source GLB must be self-contained and at most 12 MiB / 80,000 vertices. Use an immutable SHA256 filename under `apps/www/exercise-media/`.
4. Add real metadata to `services/api/src/media/exercise-media.json`. Source and review evidence must exist locally; never create placeholder approvals. Set the correct public HTTPS base URL.
5. Install ffprobe and run `npm run build` at the repository root. The build checks schema, review evidence presence, file containment, hashes, GLB structure/budgets and the actual video codec/dimensions/fps/duration/audio. Tests use synthetic metadata and do not constitute approved assets.
6. Deploy the website clip before API metadata. Check its public hash, HTTPS playback, attribution, background/blur pause, failure fallback, offline cached playback and reduced-motion behavior on the target iPhone. A new binary is required for the expo-video native module.

Native video caching requests a 32 MiB LRU budget before constructing a player. This is a platform preference, not a guaranteed hard storage cap or durable offline promise. No workout data depends on this cache. Clips do not autoplay or loop automatically. Decoder startup, memory and frame timing remain device acceptance gates.
