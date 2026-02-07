# Technical Documentation

## AI Avatar & Reality Interaction System

This document provides an in-depth technical explanation of the system architecture, design decisions, and implementation details.

---

## 1. System Architecture Overview

### High-Level Data Flow

```
User Speech → STT → WebSocket → Gemini API → WebSocket → TTS + Avatar
     ↑                                                          │
     └──────────────── Audio Playback + Visual ─────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **SpeechManager** | Handles mic input and audio output | Web Speech API |
| **WebSocketManager** | Real-time bidirectional communication | Native WebSocket |
| **AvatarManager** | 3D rendering and animation | Three.js |
| **FastAPI Backend** | API endpoints, LLM orchestration | FastAPI, Uvicorn |
| **Groq Integration** | Primary AI response generation | groq SDK |
| **Gemini Integration** | Fallback AI response generation | google-generativeai SDK |

---

## 2. Design Decisions & Rationale

### 2.1 Why Web-Based?

**Decision**: Build as a web application rather than native/Unity.

**Rationale**:
- ✅ **Cross-platform**: Works on any OS with a modern browser
- ✅ **No installation**: Zero friction for the interviewer
- ✅ **Rapid development**: HTML/CSS/JS is fast to iterate
- ✅ **Easy deployment**: Static files + simple backend
- ⚠️ **Trade-off**: Less access to system-level features (offset by WebRTC/WebGL capabilities)

### 2.2 Why Vanilla JavaScript?

**Decision**: No React/Vue/Angular framework.

**Rationale**:
- ✅ **Zero build step**: Open index.html and it works
- ✅ **Smaller payload**: No framework overhead (~50KB savings)
- ✅ **Easier debugging**: Direct DOM manipulation
- ✅ **Portability**: Works anywhere, no npm required
- ⚠️ **Trade-off**: More boilerplate for state management (acceptable for this scope)

### 2.3 Why Groq as Primary?

**Decision**: Use Groq (Llama 3.3 70B) as the primary LLM, with Gemini as fallback.

**Rationale**:
- ✅ **Industry-leading speed**: Ultra-low latency inference (tokens/sec)
- ✅ **Reliable free tier**: Higher rate limits for the demo
- ✅ **Llama 3.3 70B**: Powerful, balanced conversational intelligence
- ✅ **Gemini Fallback**: Robustness if Groq hits limits
- ⚠️ **Trade-off**: Requires two API configurations (managed via .env)

### 2.4 Why WebSocket over HTTP Polling?

**Decision**: Use WebSocket for all real-time communication.

**Rationale**:
- ✅ **Low latency**: No connection overhead per message
- ✅ **Bidirectional**: Server can push tokens immediately
- ✅ **Efficient**: Single persistent connection
- ✅ **Streaming-friendly**: Perfect for token-by-token delivery
- ⚠️ **Trade-off**: Requires WebSocket-capable hosting (most support it now)

### 2.5 Why Custom 3D Avatar over Ready Player Me?

**Decision**: Built a geometric procedural avatar instead of using RPM.

**Rationale**:
- ✅ **No external dependencies**: Works offline after load
- ✅ **Faster load time**: No GLTF model fetch
- ✅ **Full control**: Easy to customize animations
- ✅ **Lightweight**: Simple geometry = 60fps everywhere
- ⚠️ **Trade-off**: Less realistic appearance (could upgrade later)

---

## 3. Latency Analysis

### Latency Breakdown

| Stage | Typical Duration | Notes |
|-------|------------------|-------|
| Speech recognition | 100-300ms | Browser-dependent, includes silence detection |
| WebSocket send | <10ms | Negligible on local network |
| Gemini API latency | 200-400ms | Time to first token |
| Token streaming | 30-50ms/token | ~10 tokens/second for streaming |
| TTS preparation | 50-100ms | Web Speech API buffering |
| Audio playback | Real-time | Synchronized |

### Total Perceived Latency

**Best case**: ~400ms (fast recognition + quick API)
**Typical case**: ~700ms (average conditions)
**Worst case**: ~1500ms (slow network, long silence detection)

### Optimization Techniques Applied

1. **Streaming Responses**
   ```javascript
   // Instead of waiting for full response
   for await (const chunk of response) {
       wsManager.send({ type: 'token', content: chunk.text });
   }
   ```

2. **Parallel Processing**
   - TTS preparation starts while response is still streaming
   - Avatar animation updates independently at 60fps

3. **Connection Persistence**
   - Single WebSocket connection, reused for all messages
   - Auto-reconnect with exponential backoff

4. **Optimistic UI Updates**
   - Show "thinking" indicator immediately
   - Don't wait for server acknowledgment

---

## 4. Cost Analysis

### Current Implementation (Development/Demo)

| Service | Usage | Cost |
|---------|-------|------|
| Gemini API | 15 req/min (free tier) | $0 |
| Web Speech API | Unlimited | $0 |
| Hosting | Local / GitHub Pages | $0 |

**Monthly cost: $0**

### Production Scaling Estimates

| Scale | Gemini Cost | Notes |
|-------|-------------|-------|
| 100 users/day, 10 msgs each | ~$0.50/mo | 1M tokens free + pay-as-go |
| 1000 users/day | ~$15/mo | Still very affordable |
| 10,000 users/day | ~$150/mo | Consider caching common responses |

### Premium Features Cost

| Feature | Service | Cost |
|---------|---------|------|
| Premium TTS | ElevenLabs | ~$5-22/mo based on characters |
| Realistic Avatar | Ready Player Me | Free tier available |
| Voice Cloning | ElevenLabs | ~$22/mo (Professional tier) |

---

## 5. Security Considerations

### Current Implementation

1. **API Key Storage**: Keys stored in localStorage (client-side)
   - Acceptable for demo/personal use
   - For production: Move to backend with user authentication

2. **CORS**: Open CORS for development
   - Production: Restrict to specific origins

3. **WebSocket Security**: No authentication currently
   - Production: Implement token-based authentication

### Recommended Production Changes

```python
# Add to FastAPI backend
from fastapi import Depends
from fastapi.security import HTTPBearer

security = HTTPBearer()

@app.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
    token: str = Query(...)
):
    if not verify_token(token):
        await websocket.close(code=4003)
        return
    # ... rest of handler
```

---

## 6. Scalability Considerations

### Current Architecture Limits

- **Single process**: Python backend handles all connections
- **In-memory state**: Conversation history not persisted
- **No horizontal scaling**: Single server instance

### Scaling Strategies

1. **Horizontal Scaling with Redis**
   ```python
   # Share state across instances
   import redis
   r = redis.Redis()
   r.set(f"conversation:{user_id}", json.dumps(history))
   ```

2. **Load Balancing**
   - Use nginx/traefik for WebSocket load balancing
   - Sticky sessions for WebSocket connections

3. **Response Caching**
   - Cache common greeting responses
   - Semantic caching for similar questions

4. **Rate Limiting**
   ```python
   from slowapi import Limiter
   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   ```

---

## 7. Known Limitations & Improvements

### Current Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Chrome-only STT | Other browsers have limited support | Fallback to text input |
| Rate limits | 15 req/min on free tier | Upgrade to paid tier |
| No conversation persistence | Lost on refresh | Use localStorage/backend DB |
| Basic avatar | Not photorealistic | Upgrade to RPM/custom model |

### Planned Improvements

1. **Short-term** (Weekend project)
   - Add text input fallback
   - Persist conversations to localStorage
   - Add emotion detection from voice

2. **Medium-term** (1-2 weeks)
   - Integrate Ready Player Me avatars
   - Add MediaPipe face tracking
   - Implement voice cloning

3. **Long-term** (1 month+)
   - AR mode with WebXR
   - Multi-language support
   - Mobile PWA version

---

## 8. Testing Strategy

### Manual Testing Checklist

- [ ] Voice input starts on mic button click
- [ ] Voice input stops and sends on second click
- [ ] AI response appears with streaming effect
- [ ] TTS speaks the response
- [ ] Avatar mouth animates during speech
- [ ] Reset clears conversation
- [ ] Settings save and load correctly
- [ ] WebSocket reconnects on disconnect

### Automated Testing (Recommended)

```javascript
// Example with Playwright
test('voice input workflow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Mock Speech Recognition (not available in headless)
    await page.evaluate(() => {
        window.mockTranscript = 'Hello, can you introduce yourself?';
    });
    
    await page.click('#micBtn');
    await page.waitForSelector('.message.user');
    await page.waitForSelector('.message.assistant');
    
    const response = await page.textContent('.message.assistant .message-content');
    expect(response.length).toBeGreaterThan(10);
});
```

---

## 9. Deployment Options

### Option 1: Local Development (Current)

```bash
# Backend
cd backend && python main.py

# Frontend (any static server)
cd frontend && python -m http.server 3000
```

### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
COPY frontend/ /app/static/
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Option 3: Cloud Deployment

| Platform | Backend | Frontend | Cost |
|----------|---------|----------|------|
| Vercel | Python Serverless | Static | Free tier |
| Railway | Docker | Included | ~$5/mo |
| Render | Docker | Static | Free tier |
| AWS | Lambda + API Gateway | S3 + CloudFront | ~$1/mo |

---

## 10. Conclusion

This implementation demonstrates a complete real-time AI avatar interaction system with:

- ✅ Voice-first interaction
- ✅ Intelligent AI responses
- ✅ Visual avatar representation
- ✅ Low-latency streaming
- ✅ Zero-cost operation

The architecture is intentionally modular to allow easy upgrades (e.g., swapping Gemini for GPT-4, or adding a photorealistic avatar).

**Key takeaways**:
1. Web technologies are powerful enough for real-time AI interactions
2. Streaming is essential for perceived responsiveness
3. Free tiers are sufficient for demos and small-scale use
4. The system is ready for production with minor security enhancements

---

*Document version: 1.0*
*Last updated: February 2026*
