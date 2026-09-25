# AI Conversation Adapter

Senior Language OS keeps provider credentials out of the browser.

## Browser contract

The frontend sends same-origin POST requests to `/api/ai`.

### Conversation

```json
{
  "action": "reply",
  "locale": "en-US",
  "scenario": "Hotel check-in: reservation cannot be found",
  "history": [
    {"role": "user", "text": "Hi, I have a reservation."}
  ]
}
```

Response:

```json
{"reply": "Of course. What name is the reservation under?"}
```

### Evaluation

Use the same payload with `"action": "evaluate"`.

Response:

```json
{
  "evaluation": {
    "summary": "...",
    "topErrors": [
      {"said": "...", "correct": "...", "reason": "..."}
    ],
    "strengths": ["..."]
  }
}
```

## Server configuration

`api/ai.js` is a small serverless endpoint designed for a Node/Vercel-style runtime. It forwards to a Chat-Completions-compatible upstream configured only through environment variables:

- `AI_API_URL` — complete upstream chat-completions endpoint
- `AI_API_KEY` — server-side credential
- `AI_MODEL` — model identifier

No secret belongs in `app.js`, a language pack, or localStorage.

If the endpoint is missing or returns `AI_NOT_CONFIGURED`, the frontend keeps the speaking workflow usable through its local simulator. That fallback is for product flow testing; it is not presented as AI evaluation.


## Speech evaluation contract

The browser records audio locally with MediaRecorder. When the learner taps **Ses analizi**, the frontend sends the recording to `/api/speech`.

Request:

```json
{
  "audioBase64": "...",
  "mimeType": "audio/webm",
  "locale": "en-US",
  "scenario": "Hotel check-in"
}
```

Expected response:

```json
{
  "transcript": "Hi, I have a reservation...",
  "pronunciation": {
    "score": 82,
    "notes": "..."
  },
  "fluency": {
    "score": 76,
    "notes": "..."
  }
}
```

`api/speech.js` is a provider-agnostic gateway. Configure the real speech service on the server:

- `SPEECH_API_URL`
- `SPEECH_API_KEY`

The upstream must accept the request contract above and return the response contract above. The frontend never fabricates pronunciation or fluency scores: when no speech service is configured it explicitly reports that evaluation is unavailable.

## Browser speech-to-text

The role-play composer also supports browser-native `SpeechRecognition` / `webkitSpeechRecognition` where the browser provides it. This fills the learner input field and does not require a server credential. Unsupported browsers can always use typed input and MediaRecorder.
