# AI Avatar & Reality Interaction System

A real-time AI-powered avatar interaction system built for the AdxReel DeepTech Assignment. This prototype enables an interviewer to have a natural conversation with an AI avatar that features voice input, intelligent responses, voice output, and animated visual representation.

![AI Avatar Demo](https://via.placeholder.com/800x400?text=AI+Avatar+Demo)

## 🌟 Features

### Core Functionality
- 🎤 **Voice Input** - Real-time speech-to-text using Web Speech API
- 🧠 **AI Responses** - Intelligent conversation using Google Gemini 1.5 Flash
- 🔊 **Voice Output** - Natural text-to-speech with optional ElevenLabs integration
- 🎭 **3D Avatar** - Animated geometric avatar with Three.js
- ⚡ **Real-time Streaming** - Token-by-token response delivery via WebSockets

### Bonus Features
- 👄 **Lip-sync Animation** - Avatar mouth syncs with speech output
- 🙂 **Emotion Expressions** - Avatar color changes based on state (thinking, speaking)
- 🔄 **Streaming Responses** - See AI responses as they're generated
- 📹 **Webcam Support** - Toggle between avatar and real video feed
- 📊 **Latency Tracking** - Monitor response times in real-time

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Client                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │   STT    │   │  Avatar  │   │   TTS    │   │   UI     │     │
│  │ Web API  │   │ Three.js │   │ Web API  │   │ Manager  │     │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘     │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │    WebSocket      │                        │
│                    │    Manager        │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   FastAPI Server    │
                    │  (WebSocket + REST) │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Google Gemini     │
                    │   1.5 Flash API     │
                    └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (for backend)
- **Modern browser** (Chrome recommended for best speech recognition)
- **Google Gemini API Key** (free from [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-avatar.git
   cd ai-avatar
   ```

2. **Set up the backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Configure API keys**
   ```bash
   copy .env.example .env
   # Edit .env and add your Gemini API key
   ```

4. **Start the backend server**
   ```bash
   python main.py
   ```
   Server will start at `http://localhost:8000`

5. **Open the frontend**
   - Open `frontend/index.html` directly in Chrome
   - Or serve it with any HTTP server:
     ```bash
     cd frontend
     python -m http.server 3000
     ```
   - Then open `http://localhost:3000`

### Using the Application

1. **First Run**
   - Click the ⚙️ Settings button
   - Enter your Gemini API key (optional if set in backend .env)
   - Select your preferred TTS voice
   - Click "Save Settings"

2. **Start Conversation**
   - Click the microphone button (or press Space)
   - Speak your message
   - Click again to stop and send
   - Watch the AI avatar respond!

3. **Controls**
   - 🎤 **Microphone** - Start/stop voice input
   - 📹 **Camera** - Toggle webcam feed
   - 🤖 **Avatar** - Show 3D avatar (default)
   - 🔄 **Reset** - Clear conversation

## 📁 Project Structure

```
ai-avatar/
├── backend/
│   ├── main.py              # FastAPI server with WebSocket
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment template
│   └── .env                 # Your API keys (create this)
│
├── frontend/
│   ├── index.html           # Main application page
│   ├── css/
│   │   └── styles.css       # Glassmorphism styling
│   └── js/
│       ├── app.js           # Main controller
│       ├── websocket.js     # Real-time communication
│       ├── speech.js        # STT/TTS handling
│       └── avatar.js        # 3D avatar rendering
│
├── README.md                # This file
├── TECHNICAL.md             # Technical documentation
└── architecture.md          # Detailed architecture diagrams
```

## 🔧 Configuration

### Backend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `ELEVENLABS_API_KEY` | No | Optional premium TTS |
| `HOST` | No | Server host (default: 0.0.0.0) |
| `PORT` | No | Server port (default: 8000) |

### Frontend Settings

Settings are saved in browser localStorage:
- **Gemini API Key** - Can override backend key
- **ElevenLabs API Key** - For premium voice synthesis
- **TTS Voice** - Select from available browser voices
- **Auto-speak** - Automatically speak AI responses

## 🎯 Technology Stack

| Component | Technology | Why |
|-----------|------------|-----|
| **LLM** | Gemini 1.5 Flash | Free tier, fast, streaming |
| **Backend** | FastAPI + WebSockets | Async, real-time, simple |
| **Frontend** | Vanilla JS | No build step, portable |
| **3D Avatar** | Three.js | WebGL performance, flexibility |
| **STT** | Web Speech API | Browser-native, zero cost |
| **TTS** | Web Speech API / ElevenLabs | Free + premium options |
| **Styling** | Custom CSS | Full control, glassmorphism |

## ⚡ Performance

### Latency Breakdown
- **Speech Recognition**: ~100-300ms (browser-dependent)
- **AI Response Start**: ~200-500ms (Gemini streaming)
- **Token Delivery**: ~50ms per chunk
- **TTS Start**: ~100-200ms
- **Total Perceived Latency**: ~500-1000ms

### Optimizations Applied
1. **Streaming responses** - Show tokens as they arrive
2. **Persistent WebSocket** - No connection overhead
3. **Parallel processing** - TTS preparation during response
4. **Lightweight avatar** - 60fps on most hardware

## 💰 Cost Analysis

| Component | Cost | Notes |
|-----------|------|-------|
| Gemini API | **$0** | Free tier: 15 RPM |
| Web Speech | **$0** | Browser-native |
| ElevenLabs | ~$5/mo | Optional, 10k chars free |
| Hosting | **$0** | Local or static hosting |
| **Total** | **$0-5/mo** | Fully functional at $0 |

## 🔮 Future Improvements

1. **Ready Player Me Integration** - Photo-realistic 3D avatars
2. **MediaPipe Face Tracking** - Real-time expression mirroring
3. **Voice Cloning** - Clone candidate's actual voice
4. **Multi-language Support** - Beyond English
5. **Mobile PWA** - Installable mobile app
6. **AR Mode** - Place avatar in real world

## 🐛 Known Limitations

1. **Browser Compatibility** - Speech recognition works best in Chrome
2. **Microphone Required** - No text input fallback (could be added)
3. **Internet Required** - Gemini API needs connectivity
4. **Rate Limits** - Free tier has 15 requests/minute limit

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) for the LLM API
- [Three.js](https://threejs.org/) for 3D rendering
- [ElevenLabs](https://elevenlabs.io/) for premium TTS option

---

Built with ❤️ for the AdxReel DeepTech Assignment
