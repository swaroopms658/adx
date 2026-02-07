"""
AI Avatar Backend Server
========================
FastAPI server with WebSocket support for real-time AI avatar interaction.
Uses Groq for LLM responses with streaming support.
"""

import os
import json
import asyncio
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from groq import AsyncGroq
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="AI Avatar Backend",
    description="Real-time AI avatar interaction server",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure LLM Providers
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize clients
if GROQ_API_KEY:
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    print("✅ Groq configured (Async)")
else:
    groq_client = None
    print("⚠️  WARNING: GROQ_API_KEY not configured.")

if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.0-flash')
    print("✅ Gemini configured")
else:
    gemini_model = None
    print("⚠️  WARNING: GEMINI_API_KEY not configured.")

# System prompt for the AI avatar
SYSTEM_PROMPT = """You are Sara, a Lead Engineer at AdxReel.
You are interviewing a candidate for an AI Engineer role.

STYLE GUIDELINES:
1. **Conversational Professionalism**: Speak in full, natural sentences. Be friendly but efficient.
2. **Concise**: Keep responses under 3 sentences. Avoid long monologues.
3. **Role**: You are the interviewer. Ask probing questions about their technical experience.
4. **No Meta-Talk**: Do not mention that this is a simulation.

Example:
User: "Tell me about the role."
You: "We're building real-time AI avatars. I need someone strong in Python and Three.js. How is your experience with WebGL?"
"""


# Conversation history for context
conversation_history = []

class ConnectionManager:
    """Manages WebSocket connections"""
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ Client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"❌ Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_message(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

manager = ConnectionManager()

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "AI Avatar Backend Server", "status": "running", "provider": "Groq" if groq_client else "Gemini"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "groq_configured": groq_client is not None,
        "gemini_configured": gemini_model is not None,
        "active_connections": len(manager.active_connections)
    }

@app.post("/api/configure")
async def configure_api(api_key: str, provider: str = "groq"):
    """Configure API key at runtime"""
    global groq_client, gemini_model
    try:
        if provider.lower() == "groq":
            groq_client = Groq(api_key=api_key)
            return {"status": "success", "message": "Groq configured successfully"}
        else:
            genai.configure(api_key=api_key)
            gemini_model = genai.GenerativeModel('gemini-2.0-flash')
            return {"status": "success", "message": "Gemini configured successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def generate_groq_response(websocket: WebSocket, messages: list):
    """Generate and stream response using Groq"""
    try:
        # Build messages for Groq chat completion
        groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        # Filter and add conversation history
        for msg in messages[-10:]:
            role = "user" if msg["role"] == "user" else "assistant"
            content = msg["content"]
            # Map roles for Groq
            groq_messages.append({"role": role, "content": content})
        
        # Create stream
        stream = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Switched to 70B (8B decommissioned)
            messages=groq_messages,
            stream=True,
            temperature=0.7,
            max_tokens=150,  # Relaxed limit for natural speech
        )
        
        full_response = ""
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                full_response += content
                await manager.send_message(websocket, {
                    "type": "token",
                    "content": content
                })
        
        return full_response
    except Exception as e:
        raise e

async def generate_gemini_response(websocket: WebSocket, messages: list):
    """Generate and stream response using Gemini"""
    try:
        # Build conversation context
        context = SYSTEM_PROMPT + "\n\nConversation so far:\n"
        for msg in messages[-10:]:  # Keep last 10 messages for context
            role = "Interviewer" if msg["role"] == "user" else "You"
            context += f"{role}: {msg['content']}\n"
        context += "\nYou:"
        
        # Generate streaming response
        response = gemini_model.generate_content(
            context,
            stream=True,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500,
            )
        )
        
        full_response = ""
        for chunk in response:
            if chunk.text:
                full_response += chunk.text
                await manager.send_message(websocket, {
                    "type": "token",
                    "content": chunk.text
                })
                await asyncio.sleep(0.01)
        
        return full_response
    except Exception as e:
        raise e

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for real-time chat with streaming responses"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type", "message")
            
            if message_type == "message":
                user_message = data.get("content", "")
                print(f"📩 Received message: {user_message}")
                
                if not user_message:
                    await manager.send_message(websocket, {
                        "type": "error",
                        "content": "Empty message received"
                    })
                    continue
                
                # Add to conversation history
                conversation_history.append({
                    "role": "user",
                    "content": user_message
                })
                
                # Check if any provider is configured
                if groq_client is None and gemini_model is None:
                    await manager.send_message(websocket, {
                        "type": "error",
                        "content": "No LLM provider configured. Please set an API key."
                    })
                    continue
                
                # Send acknowledgment
                await manager.send_message(websocket, {
                    "type": "thinking",
                    "content": "Thinking..."
                })
                
                try:
                    full_response = ""
                    # Prioritize Groq as it's typically faster and less likely to hit free-tier quotas
                    if groq_client:
                        print("Using Groq...")
                        full_response = await generate_groq_response(websocket, conversation_history)
                    elif gemini_model:
                        print("Using Gemini...")
                        full_response = await generate_gemini_response(websocket, conversation_history)
                    
                    # Send completion signal
                    await manager.send_message(websocket, {
                        "type": "complete",
                        "content": full_response
                    })
                    
                    # Add to conversation history
                    conversation_history.append({
                        "role": "assistant",
                        "content": full_response
                    })
                    
                except Exception as e:
                    print(f"Error generating response: {e}")
                    # If Groq failed, try Gemini as fallback if available
                    if groq_client and gemini_model:
                        try:
                            print("Groq failed, trying Gemini fallback...")
                            full_response = await generate_gemini_response(websocket, conversation_history)
                            await manager.send_message(websocket, {
                                "type": "complete",
                                "content": full_response
                            })
                            conversation_history.append({
                                "role": "assistant",
                                "content": full_response
                            })
                            continue
                        except Exception as gemini_e:
                            print(f"Gemini fallback also failed: {gemini_e}")
                    
                    await manager.send_message(websocket, {
                        "type": "error",
                        "content": f"Error generating response: {str(e)}"
                    })
            
            elif message_type == "reset":
                # Clear conversation history
                conversation_history.clear()
                await manager.send_message(websocket, {
                    "type": "reset_complete",
                    "content": "Conversation reset"
                })
            
            elif message_type == "ping":
                await manager.send_message(websocket, {
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/api/conversation")
async def get_conversation():
    """Get current conversation history"""
    return {"history": conversation_history}

@app.delete("/api/conversation")
async def clear_conversation():
    """Clear conversation history"""
    conversation_history.clear()
    return {"status": "cleared"}

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting AI Avatar Backend on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
