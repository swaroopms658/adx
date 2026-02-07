/**
 * WebSocket Manager
 * Handles real-time communication with the backend server
 */

class WebSocketManager {
    constructor(url = null) {
        // Auto-detect production vs local
        if (!url) {
            const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            if (isProduction) {
                // Production: Use Render backend URL (will be updated after deployment)
                const backendUrl = 'wss://adx-backend.onrender.com/ws/chat';
                this.url = backendUrl;
            } else {
                // Local development
                this.url = 'ws://localhost:8000/ws/chat';
            }
        } else {
            this.url = url;
        }
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageQueue = [];
        this.latencyStart = null;

        // Event callbacks
        this.onMessage = null;
        this.onToken = null;
        this.onComplete = null;
        this.onThinking = null;
        this.onError = null;
        this.onConnectionChange = null;
        this.onLatencyUpdate = null;
    }

    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('Already connected');
            return;
        }

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnectionChange?.(true);

                // Send queued messages
                while (this.messageQueue.length > 0) {
                    const msg = this.messageQueue.shift();
                    this.send(msg.type, msg.content);
                }
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.socket.onclose = (event) => {
                console.log('❌ WebSocket disconnected', event.code, event.reason);
                this.isConnected = false;
                this.onConnectionChange?.(false);

                // Attempt to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                        this.connect();
                    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.onError?.('Connection error. Please check if the server is running.');
            };

        } catch (error) {
            console.error('Failed to connect:', error);
            this.onError?.('Failed to connect to server');
        }
    }

    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        switch (data.type) {
            case 'thinking':
                this.onThinking?.();
                break;

            case 'token':
                this.onToken?.(data.content);
                break;

            case 'complete':
                // Calculate latency
                if (this.latencyStart) {
                    const latency = Date.now() - this.latencyStart;
                    this.onLatencyUpdate?.(latency);
                    this.latencyStart = null;
                }
                this.onComplete?.(data.content);
                break;

            case 'error':
                this.onError?.(data.content);
                break;

            case 'reset_complete':
                this.onMessage?.({ type: 'reset', content: data.content });
                break;

            case 'pong':
                // Latency check response
                if (this.latencyStart) {
                    const latency = Date.now() - this.latencyStart;
                    this.onLatencyUpdate?.(latency);
                }
                break;

            default:
                this.onMessage?.(data);
        }
    }

    /**
     * Send a message to the server
     */
    send(type, content) {
        if (!this.isConnected) {
            console.log('Not connected, queueing message');
            this.messageQueue.push({ type, content });
            this.connect();
            return;
        }

        const message = { type, content };

        if (type === 'message') {
            this.latencyStart = Date.now();
        }

        console.log('🌐 WebSocket dispatching:', message);
        this.socket.send(JSON.stringify(message));
    }

    /**
     * Send a chat message
     */
    sendMessage(content) {
        this.send('message', content);
    }

    /**
     * Reset the conversation
     */
    resetConversation() {
        this.send('reset');
    }

    /**
     * Ping for latency check
     */
    ping() {
        this.latencyStart = Date.now();
        this.send('ping');
    }

    /**
     * Disconnect from the server
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// Export for use in other modules
window.WebSocketManager = WebSocketManager;
