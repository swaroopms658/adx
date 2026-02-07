# Architecture Documentation

## AI Avatar & Reality Interaction System

This document provides visual diagrams of the system architecture.

---

## System Overview

```mermaid
flowchart TB
    subgraph Client["🌐 Browser Client"]
        direction TB
        subgraph Input["Input Layer"]
            MIC["🎤 Microphone"]
            CAM["📹 Webcam"]
        end
        
        subgraph Processing["Processing Layer"]
            STT["Speech-to-Text<br/>(Web Speech API)"]
            TTS["Text-to-Speech<br/>(Web Speech / ElevenLabs)"]
        end
        
        subgraph Display["Display Layer"]
            AVATAR["3D Avatar<br/>(Three.js)"]
            CHAT["Chat Interface"]
            VIDEO["Video Feed"]
        end
        
        subgraph Managers["Manager Layer"]
            WSM["WebSocket<br/>Manager"]
            SM["Speech<br/>Manager"]
            AM["Avatar<br/>Manager"]
            APP["App<br/>Controller"]
        end
    end
    
    subgraph Server["⚙️ Backend Server"]
        FAST["FastAPI<br/>Application"]
        WS["WebSocket<br/>Handler"]
        LLM["LLM Router<br/>(Groq / Gemini)"]
    end
    
    subgraph External["☁️ External APIs"]
        GROQ["Groq API<br/>(Llama 3.3 70B)"]
        GEMINI["Google Gemini<br/>2.0 Flash"]
        ELEVEN["ElevenLabs<br/>(Optional)"]
    end
    
    MIC --> STT
    CAM --> VIDEO
    STT --> SM
    SM --> APP
    APP --> WSM
    WSM <-->|WebSocket| WS
    WS --> LLM
    LLM <-->|Streaming| GROQ
    LLM <-->|Fallback| GEMINI
    WS -->|Tokens| WSM
    WSM --> APP
    APP --> TTS
    APP --> AM
    TTS --> AVATAR
    TTS -.->|Optional| ELEVEN
    AM --> AVATAR
    APP --> CHAT
    
    style Client fill:#1a1a2e,color:#fff
    style Server fill:#16213e,color:#fff
    style External fill:#0f3460,color:#fff
```

---

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant B as 🌐 Browser
    participant S as ⚙️ Server
    participant L as ☁️ Groq / Gemini
    
    Note over U,G: Initialization
    B->>S: Connect WebSocket
    S-->>B: Connection Accepted
    
    Note over U,G: Conversation Flow
    U->>B: Speaks into microphone
    B->>B: Web Speech API → Text
    B->>S: {"type": "message", "content": "..."}
    S-->>B: {"type": "thinking"}
    
    S->>G: Stream request with context
    
    loop Token Streaming
        G-->>S: Token chunk
        S-->>B: {"type": "token", "content": "..."}
        B->>B: Update chat + animate avatar
    end
    
    S-->>B: {"type": "complete", "content": "..."}
    B->>B: TTS speaks response
    B->>U: Audio output + avatar animation
```

---

## Component Architecture

```mermaid
classDiagram
    class AIAvatarApp {
        -WebSocketManager wsManager
        -SpeechManager speechManager
        -AvatarManager avatarManager
        -boolean isProcessing
        +init()
        +handleMicClick()
        +sendMessage(content)
        +resetConversation()
    }
    
    class WebSocketManager {
        -WebSocket socket
        -boolean isConnected
        -Array messageQueue
        +connect()
        +send(type, content)
        +sendMessage(content)
        +resetConversation()
        +disconnect()
    }
    
    class SpeechManager {
        -SpeechRecognition recognition
        -SpeechSynthesis synthesis
        -boolean isListening
        -boolean isSpeaking
        +startListening()
        +stopListening()
        +speak(text)
        +stopSpeaking()
    }
    
    class AvatarManager {
        -THREE.Scene scene
        -THREE.Camera camera
        -THREE.Renderer renderer
        -Object3D avatar
        -boolean isSpeaking
        +init()
        +animate()
        +setSpeaking(state)
        +setEmotion(emotion)
    }
    
    AIAvatarApp --> WebSocketManager
    AIAvatarApp --> SpeechManager
    AIAvatarApp --> AvatarManager
```

---

## State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: App Initialized
    
    Idle --> Listening: Mic Button Click
    Listening --> Processing: Stop Recording
    Processing --> Receiving: Server Response
    Receiving --> Speaking: Response Complete
    Speaking --> Idle: TTS Complete
    
    Listening --> Idle: Cancel
    Processing --> Idle: Error
    Receiving --> Idle: Error
    Speaking --> Idle: Skip
    
    state Processing {
        [*] --> WaitingForResponse
        WaitingForResponse --> ThinkingIndicator
        ThinkingIndicator --> [*]
    }
    
    state Receiving {
        [*] --> StreamingTokens
        StreamingTokens --> AppendingText
        AppendingText --> StreamingTokens
        StreamingTokens --> [*]: Complete
    }
    
    state Speaking {
        [*] --> AvatarAnimating
        AvatarAnimating --> AudioPlaying
        AudioPlaying --> AvatarAnimating
        AudioPlaying --> [*]: TTS End
    }
```

---

## Avatar Animation System

```mermaid
flowchart LR
    subgraph Input["Animation Triggers"]
        SPEAK["Speaking State"]
        EMOTION["Emotion Change"]
        IDLE["Idle Animation"]
    end
    
    subgraph Processing["Animation Processing"]
        LERP["Smooth Interpolation"]
        NOISE["Procedural Noise"]
        TIMING["Delta Time"]
    end
    
    subgraph Output["Visual Updates"]
        MOUTH["Mouth Scale"]
        COLOR["Head Color"]
        POSITION["Hover Animation"]
        RING["Ring Rotation"]
    end
    
    SPEAK --> LERP
    EMOTION --> COLOR
    IDLE --> TIMING
    
    LERP --> MOUTH
    LERP --> NOISE
    NOISE --> MOUTH
    TIMING --> POSITION
    TIMING --> RING
```

---

## Network Protocol

### WebSocket Message Types

```mermaid
flowchart TD
    subgraph ClientToServer["Client → Server"]
        MSG["message<br/>{type, content}"]
        RST["reset<br/>{type}"]
        PNG["ping<br/>{type}"]
    end
    
    subgraph ServerToClient["Server → Client"]
        THK["thinking<br/>{type, content}"]
        TKN["token<br/>{type, content}"]
        CMP["complete<br/>{type, content}"]
        ERR["error<br/>{type, content}"]
        PON["pong<br/>{type, timestamp}"]
        RSC["reset_complete<br/>{type, content}"]
    end
    
    MSG --> THK
    MSG --> TKN
    TKN --> CMP
    MSG --> ERR
    RST --> RSC
    PNG --> PON
```

---

## File Structure

```
ai-avatar/
├── backend/
│   ├── main.py                 # FastAPI server
│   │   ├── /                   # Root endpoint (health)
│   │   ├── /api/health         # Detailed health check
│   │   ├── /api/configure      # Runtime API config
│   │   ├── /api/conversation   # Get/clear history
│   │   └── /ws/chat            # WebSocket endpoint
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Environment variables
│
├── frontend/
│   ├── index.html              # Main HTML
│   ├── css/
│   │   └── styles.css          # Glassmorphism design
│   └── js/
│       ├── app.js              # Main controller
│       ├── websocket.js        # WebSocket handling
│       ├── speech.js           # STT/TTS
│       └── avatar.js           # Three.js avatar
│
├── README.md                   # User documentation
├── TECHNICAL.md                # Technical documentation
└── architecture.md             # This file
```

---

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Production["Production Deployment"]
        subgraph CDN["CDN / Static Host"]
            STATIC["Frontend Files<br/>(HTML/CSS/JS)"]
        end
        
        subgraph Backend["Backend Server"]
            LB["Load Balancer"]
            API1["API Instance 1"]
            API2["API Instance 2"]
            REDIS["Redis<br/>(Session Store)"]
        end
        
        subgraph External["External Services"]
            GEM["Gemini API"]
            ELV["ElevenLabs API"]
        end
    end
    
    USER["Users"] --> CDN
    USER --> LB
    LB --> API1
    LB --> API2
    API1 <--> REDIS
    API2 <--> REDIS
    API1 --> GEM
    API2 --> GEM
    API1 -.-> ELV
    API2 -.-> ELV
```

---

*This architecture is designed for scalability and can handle thousands of concurrent users with appropriate infrastructure.*
