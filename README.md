# TrueFace — Interview the Real You

> The interview platform where candidates prove their skills are real — and companies can verify it.

Built at **HackDartmouth XI** by Verna, Bharath, Vighanesh, and Sri Ram.

---

## What is TrueFace?

TrueFace is a two-sided AI interview platform:

**For candidates:** Practice with a photorealistic LiveAvatar AI interviewer. Get real-time feedback on filler words, pacing, confidence, and reasoning depth. Review saved recordings to improve.

**For companies:** Get a live fraud detection dashboard during every interview. Catch deepfakes, voice cloning, AI-fed answers, and hidden copilots in real time. Receive a signed authenticity report after each session.

---

## Features

### Candidate Side
- Photorealistic LiveAvatar AI interviewer (HeyGen)
- Adaptive questioning — technical and behavioral modes
- Real-time filler word detection
- Speech pacing and confidence analysis
- Session recordings with transcript review
- Post-session feedback report

### Company Side
- Live monitor dashboard — 5-signal authenticity scoring
- Deepfake detection (ViT + SigLIP ensemble)
- Voice clone detection (librosa + spectral analysis)
- AI assistance likelihood (reasoning continuity + semantic threading)
- Response latency pattern analysis
- Proctoring — tab switches, paste events, window blur detection
- Signed authenticity report after each session

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| AI Interviewer | HeyGen LiveAvatar SDK |
| Interview Brain | LangGraph + Vertex AI (Gemini 2.5 Flash) |
| ML Engine | FastAPI, Python, ViT, SigLIP, Whisper, MediaPipe |
| LLM | Groq / Llama-3.3-70b-versatile |
| Vector DB | Pinecone |
| Database | MongoDB Atlas |
| Auth | Custom session auth |

---

## Running Locally

You need 3 servers running simultaneously:

### 1. Interview Brain (port 8000)
```bash
cd HackDartmouthXI
source .venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS="./backend/newface-493021-1ef8bc846b2c.json"
export GOOGLE_CLOUD_PROJECT="newface-493021"
export GOOGLE_CLOUD_LOCATION="us-central1"
export GEMINI_MODEL="gemini-2.5-flash"
export PINECONE_API_KEY="your_key"
export PINECONE_INDEX_NAME="trueface"
export PINECONE_HOST="your_host"
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. ML Detection Engine (port 8001)
```bash
cd ml-engine
source ~/trueface-ml/bin/activate
export GROQ_API_KEY="your_key"
python3 main.py
```

### 3. Frontend (port 3000)
```bash
cd HackDartmouthXI
npm install
npm run dev
```

Open `http://localhost:3000`

---

## Environment Variables

Create `.env.local` in the root:
HEYGEN_API_KEY=your_key
GROQ_API_KEY=your_key
MONGODB_URI=your_uri
MONGODB_DB_NAME=trueface
GEMINI_API_KEY=your_key

---

## ML Detection Signals

| Signal | Method | Weight |
|--------|--------|--------|
| Deepfake Detection | ViT + SigLIP ensemble, optical flow, lip sync, face boundary | 30% |
| Voice Authenticity | RMS energy, spectral variation, pitch, harmonic richness | 15% |
| Reasoning Continuity | Sentence embeddings, semantic threading, follow-up coherence | 25% |
| Response Latency | Timing patterns, too-fast detection, length-time correlation | 10% |
| Speech Patterns | Whisper transcription, filler words, speech rate | 20% |

---

## Team

- **Verna** — ML Engine, deepfake detection, proctoring, live interview flow
- **Bharath** — Frontend, LiveAvatar integration, dashboard
- **Vighanesh** — Interview brain, LangGraph, voice saving
- **Sri Ram** — RAG pipeline, Pinecone, backend

---

*HackDartmouth XI · April 2026*
