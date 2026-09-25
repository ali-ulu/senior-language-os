# Senior Language OS Roadmap

## v2 — Core Engine
- [x] Sentence Engine
- [x] Active Recall timing
- [x] Listening / dictation loop
- [x] Mutation drills
- [x] Speaking missions
- [x] 4-3-2 fluency timer
- [x] Personal lexicon
- [x] Error Loop / Top 3 recurring errors
- [x] Browser voice recording
- [x] JSON language-pack architecture

## Next
- [ ] English 30-day language pack
- [ ] German 30-day language pack
- [ ] Turkish / Rhimsa language pack
- [ ] Pack validation and authoring CLI
- [ ] AI conversation simulation
- [ ] Speech-to-text integration
- [ ] Pronunciation feedback
- [ ] Adaptive spaced repetition
- [ ] Day 1 vs Day 30 performance comparison
- [ ] Account sync / cloud persistence

## Architecture rule
The learning engine stays language-agnostic. Language-specific curriculum, examples, audio metadata, missions, and drills belong in `packs/` rather than being hard-coded into the app.
