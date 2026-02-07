/**
 * AI Avatar Application
 * Main application controller
 */

class AIAvatarApp {
    constructor() {
        // Managers initialized in init() to handle errors gracefully
        this.wsManager = null;
        this.speechManager = null;
        this.avatarManager = null;

        // State
        this.currentResponse = '';
        this.isProcessing = false;
        this.ttsUnlocked = false; // Track if TTS has been unlocked by user interaction

        // DOM Elements
        this.elements = {
            // Connection
            connectionStatus: document.getElementById('connectionStatus'),
            statusText: document.querySelector('.status-text'),
            statusDot: document.querySelector('.status-dot'),

            // Avatar
            avatarContainer: document.getElementById('avatarContainer'),
            avatarBadge: document.getElementById('avatarBadge'),
            speakingIndicator: document.getElementById('speakingIndicator'),
            videoFeed: document.getElementById('videoFeed'),

            // Chat
            chatMessages: document.getElementById('chatMessages'),
            transcriptDisplay: document.getElementById('transcriptDisplay'),

            // Controls
            micBtn: document.getElementById('micBtn'),
            inputHint: document.getElementById('inputHint'),
            resetBtn: document.getElementById('resetBtn'),
            toggleVideoBtn: document.getElementById('toggleVideoBtn'),
            toggleAvatarBtn: document.getElementById('toggleAvatarBtn'),
            toggleBackgroundBtn: document.getElementById('toggleBackgroundBtn'),

            // Settings
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            closeSettings: document.getElementById('closeSettings'),
            cancelSettings: document.getElementById('cancelSettings'),
            saveSettings: document.getElementById('saveSettings'),
            geminiKey: document.getElementById('geminiKey'),
            elevenLabsKey: document.getElementById('elevenLabsKey'),
            voiceSelect: document.getElementById('voiceSelect'),
            autoSpeak: document.getElementById('autoSpeak'),

            // Latency
            latencyValue: document.getElementById('latencyValue')
        };

        // Bind methods
        this.handleMicClick = this.handleMicClick.bind(this);
        this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);

        // Initialize
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        console.log('🚀 Initializing AI Avatar App');

        try {
            // Initialize managers
            this.wsManager = new WebSocketManager();
            this.speechManager = new SpeechManager();
            this.avatarManager = new AvatarManager('avatarCanvas');

            // Setup WebSocket callbacks
            this.setupWebSocketCallbacks();

            // Setup Speech callbacks
            this.setupSpeechCallbacks();

            // Setup UI event listeners
            this.setupEventListeners();

            // Load settings from localStorage
            this.loadSettings();

            // Populate voice select
            this.populateVoiceSelect();

            // Connect to server
            this.wsManager.connect();

            console.log('✅ App initialized');
        } catch (error) {
            console.error('Initialization error:', error);
            // Delay error display slightly to ensure DOM is ready
            setTimeout(() => {
                this.showError(`Failed to initialize: ${error.message}`);
            }, 500);
        }
    }

    /**
     * Setup WebSocket callbacks
     */
    setupWebSocketCallbacks() {
        this.wsManager.onConnectionChange = (connected) => {
            this.updateConnectionStatus(connected);
        };

        this.wsManager.onThinking = () => {
            this.showThinkingIndicator();
            this.avatarManager.setEmotion('thinking');
            this.updateAvatarBadge('thinking', '🤔 Thinking...');
        };

        this.wsManager.onToken = (token) => {
            this.appendToken(token);
        };

        this.wsManager.onComplete = (fullResponse) => {
            this.completeResponse(fullResponse);
        };

        this.wsManager.onError = (error) => {
            this.showError(error);
        };

        this.wsManager.onLatencyUpdate = (latency) => {
            this.elements.latencyValue.textContent = `${latency}ms`;
        };

        this.wsManager.onMessage = (data) => {
            this.handleWebSocketMessage(data);
        };
    }

    /**
     * Setup Speech callbacks
     */
    setupSpeechCallbacks() {
        this.speechManager.onListeningChange = (listening) => {
            this.updateMicButton(listening);

            if (listening) {
                this.elements.transcriptDisplay.classList.add('active');
                this.elements.inputHint.textContent = 'Listening... Click to stop';
            } else {
                this.elements.transcriptDisplay.classList.remove('active');
                this.elements.inputHint.textContent = 'Click to start speaking';
            }
        };

        this.speechManager.onInterimTranscript = (transcript) => {
            if (transcript) {
                this.elements.transcriptDisplay.innerHTML = transcript;

                // Barge-in: Stop AI speech if user interrupts
                if (this.speechManager.isSpeaking || this.avatarManager.isSpeaking) {
                    console.log('🛑 Barge-in detected! Stopping AI speech.');
                    this.speechManager.stopSpeaking();
                    this.avatarManager.setSpeaking(false);
                }
            } else {
                this.elements.transcriptDisplay.innerHTML = '<span class="placeholder">Your speech will appear here...</span>';
            }
        };

        this.speechManager.onTranscript = (transcript) => {
            console.log('📨 onTranscript callback received:', transcript);
            if (transcript) {
                try {
                    this.sendMessage(transcript);
                } catch (error) {
                    console.error('❌ Error in sendMessage:', error);
                }
            }
        };

        this.speechManager.onSpeakingChange = (speaking) => {
            this.avatarManager.setSpeaking(speaking);

            if (speaking) {
                this.elements.speakingIndicator.classList.add('active');
                this.updateAvatarBadge('speaking', '🗣️ Speaking...');
            } else {
                this.elements.speakingIndicator.classList.remove('active');
                this.updateAvatarBadge('ready', '🤖 AI Ready');
            }
        };

        this.speechManager.onError = (error) => {
            this.showError(error);
        };
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Microphone button
        this.elements.micBtn.addEventListener('click', this.handleMicClick);

        // Reset button
        this.elements.resetBtn.addEventListener('click', () => {
            this.resetConversation();
        });

        // Video toggle
        this.elements.toggleVideoBtn.addEventListener('click', () => {
            this.toggleWebcam();
        });

        // Avatar toggle
        this.elements.toggleAvatarBtn.addEventListener('click', () => {
            this.toggleAvatar();
        });

        // Virtual Background toggle
        this.elements.toggleBackgroundBtn.addEventListener('click', () => {
            this.toggleBackground();
        });

        // Settings
        this.elements.settingsBtn.addEventListener('click', () => {
            this.openSettings();
        });

        this.elements.closeSettings.addEventListener('click', () => {
            this.closeSettings();
        });

        this.elements.cancelSettings.addEventListener('click', () => {
            this.closeSettings();
        });

        this.elements.saveSettings.addEventListener('click', () => {
            this.saveSettings();
        });

        // Settings modal overlay click
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });
    }

    /**
     * Handle microphone button click
     */
    handleMicClick() {
        // Unlock TTS on first user interaction
        if (!this.ttsUnlocked) {
            this.unlockTTS();
        }

        const finalTranscript = this.speechManager.toggleListening();

        // If stopped listening and got transcript, send it
        if (finalTranscript) {
            this.sendMessage(finalTranscript);
        }
    }

    /**
     * Unlock TTS by playing a silent sound (browser autoplay restriction workaround)
     */
    unlockTTS() {
        console.log('🔓 Unlocking TTS...');

        // Create a silent utterance to unlock the speech synthesis
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);

        this.ttsUnlocked = true;
        console.log('✅ TTS unlocked');
    }

    /**
     * Update microphone button state
     */
    updateMicButton(listening) {
        if (listening) {
            this.elements.micBtn.classList.add('active');
        } else {
            this.elements.micBtn.classList.remove('active');
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(connected) {
        const statusDot = this.elements.statusDot;
        const statusText = this.elements.statusText;

        if (connected) {
            this.elements.connectionStatus.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            this.elements.connectionStatus.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    }

    /**
     * Show thinking indicator
     */
    showThinkingIndicator() {
        // Create thinking message
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message assistant thinking';
        thinkingDiv.id = 'thinkingMessage';
        thinkingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.elements.chatMessages.appendChild(thinkingDiv);
        this.scrollToBottom();
    }

    /**
     * Remove thinking indicator
     */
    removeThinkingIndicator() {
        const thinking = document.getElementById('thinkingMessage');
        if (thinking) {
            thinking.remove();
        }
    }

    /**
     * Append token to current response
     */
    appendToken(token) {
        this.currentResponse += token;

        // Update or create the assistant message
        let assistantMsg = document.getElementById('currentAssistantMessage');
        if (!assistantMsg) {
            // Remove thinking indicator
            this.removeThinkingIndicator();

            // Create new assistant message
            assistantMsg = document.createElement('div');
            assistantMsg.className = 'message assistant';
            assistantMsg.id = 'currentAssistantMessage';
            assistantMsg.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content"></div>
            `;
            this.elements.chatMessages.appendChild(assistantMsg);
        }

        const content = assistantMsg.querySelector('.message-content');
        content.textContent = this.currentResponse;
        this.scrollToBottom();
    }

    /**
     * Complete response
     */
    completeResponse(fullResponse) {
        // Finalize the message
        const assistantMsg = document.getElementById('currentAssistantMessage');
        if (assistantMsg) {
            assistantMsg.removeAttribute('id');
            const content = assistantMsg.querySelector('.message-content');
            content.innerHTML = this.formatMessage(fullResponse);
        }

        // Speak the response
        console.log('🔊 Speaking response:', fullResponse);
        this.speechManager.speak(fullResponse);

        // Reset state
        this.currentResponse = '';
        this.isProcessing = false;
        this.avatarManager.setEmotion('neutral');

        this.scrollToBottom();
    }

    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(data) {
        if (data.type === 'reset') {
            // Clear chat messages except welcome
            const messages = this.elements.chatMessages.querySelectorAll('.message');
            messages.forEach(msg => msg.remove());
        }
    }

    /**
     * Format message text
     */
    formatMessage(text) {
        // Simple formatting
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    /**
     * Reset conversation
     */
    resetConversation() {
        // Clear chat
        const messages = this.elements.chatMessages.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());

        // Reset state
        this.currentResponse = '';
        this.isProcessing = false;

        // Reset WebSocket
        this.wsManager.resetConversation();

        // Show confirmation
        this.addMessage('assistant', 'Conversation reset. Ready to start fresh! 🔄');

        this.avatarManager.setEmotion('neutral');
        this.updateAvatarBadge('ready', '🤖 AI Ready');
    }

    /**
     * Add a message to the chat
     */
    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        if (role === 'user') {
            messageDiv.innerHTML = `
                <div class="message-content">${this.formatMessage(content)}</div>
                <div class="message-avatar">👤</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">${this.formatMessage(content)}</div>
            `;
        }

        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    /**
     * Update avatar badge
     */
    updateAvatarBadge(state, text) {
        const badge = this.elements.avatarBadge;
        badge.className = 'avatar-badge';

        switch (state) {
            case 'speaking':
                badge.classList.add('speaking');
                break;
            case 'thinking':
                badge.classList.add('thinking');
                break;
        }

        const badgeIcon = badge.querySelector('.badge-icon');
        const badgeText = badge.querySelector('.badge-text');

        if (badgeText) badgeText.textContent = text.replace(/^[^\s]+\s/, '');
        if (badgeIcon) badgeIcon.textContent = text.split(' ')[0];
    }

    /**
     * Toggle webcam
     */
    async toggleWebcam() {
        const video = this.elements.videoFeed;
        const canvas = document.getElementById('avatarCanvas');

        if (video.style.display === 'block') {
            // Turn off webcam
            const stream = video.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            video.style.display = 'none';
            canvas.style.display = 'block';
            this.elements.toggleVideoBtn.classList.remove('active');
            this.elements.toggleAvatarBtn.classList.add('active');
        } else {
            // Turn on webcam
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                video.style.display = 'block';
                canvas.style.display = 'none';
                this.elements.toggleVideoBtn.classList.add('active');
                this.elements.toggleAvatarBtn.classList.remove('active');
            } catch (error) {
                console.error('Webcam error:', error);
                this.showError('Could not access webcam. Please check permissions.');
            }
        }
    }

    /**
     * Toggle avatar visibility
     */
    toggleAvatar() {
        const video = this.elements.videoFeed;
        const canvas = document.getElementById('avatarCanvas');

        // Turn off video if on
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        video.style.display = 'none';
        canvas.style.display = 'block';

        this.elements.toggleVideoBtn.classList.remove('active');
        this.elements.toggleAvatarBtn.classList.add('active');
    }

    /**
     * Toggle virtual background
     */
    toggleBackground() {
        const container = this.elements.avatarContainer;
        // Cycle through backgrounds
        if (container.classList.contains('bg-office')) {
            container.classList.remove('bg-office');
            container.classList.add('bg-studio');
            this.updateAvatarBadge('bg', 'Studio Mode');
        } else if (container.classList.contains('bg-studio')) {
            container.classList.remove('bg-studio');
            container.classList.add('bg-nature');
            this.updateAvatarBadge('bg', 'Nature Mode');
        } else if (container.classList.contains('bg-nature')) {
            container.classList.remove('bg-nature');
            // Default dark mode
            this.updateAvatarBadge('bg', 'Dark Mode');
        } else {
            // Default -> Office
            container.classList.add('bg-office');
            this.updateAvatarBadge('bg', 'Office Mode');
        }
    }

    /**
     * Send a message (from user input)
     */
    sendMessage(text) {
        if (!text.trim()) return;

        // Add user message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-content">${this.formatMessage(text)}</div>
            <div class="message-avatar">👤</div>
        `;
        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Clear transcript display to prevent duplication
        this.elements.transcriptDisplay.innerHTML = '<span class="placeholder">Your speech will appear here...</span>';
        this.elements.transcriptDisplay.classList.remove('active');

        // Send to WebSocket
        console.log('📤 Sending message via WebSocket:', text);
        this.wsManager.sendMessage(text);

        this.isProcessing = true;
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Error:', message);

        // Add error message to chat
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant';
        errorDiv.innerHTML = `
            <div class="message-avatar">⚠️</div>
            <div class="message-content" style="color: var(--error);">${message}</div>
        `;
        this.elements.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();

        this.isProcessing = false;
    }

    /**
     * Open settings modal
     */
    openSettings() {
        // Populate voice select with current voices
        this.populateVoiceSelect();

        // Load current settings
        this.elements.geminiKey.value = localStorage.getItem('gemini_api_key') || '';
        this.elements.elevenLabsKey.value = localStorage.getItem('elevenlabs_api_key') || '';
        this.elements.autoSpeak.checked = this.speechManager.autoSpeak;

        this.elements.settingsModal.classList.add('active');
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        this.elements.settingsModal.classList.remove('active');
    }

    /**
     * Save settings
     */
    saveSettings() {
        // Save to localStorage
        localStorage.setItem('gemini_api_key', this.elements.geminiKey.value);
        localStorage.setItem('elevenlabs_api_key', this.elements.elevenLabsKey.value);
        localStorage.setItem('auto_speak', this.elements.autoSpeak.checked);
        localStorage.setItem('selected_voice', this.elements.voiceSelect.value);

        // Apply settings
        this.speechManager.setElevenLabsKey(this.elements.elevenLabsKey.value);
        this.speechManager.setAutoSpeak(this.elements.autoSpeak.checked);
        this.speechManager.setVoice(this.elements.voiceSelect.value);

        this.closeSettings();

        // Show confirmation
        this.addMessage('assistant', 'Settings saved successfully! ✅');
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const elevenLabsKey = localStorage.getItem('elevenlabs_api_key');
        const autoSpeak = localStorage.getItem('auto_speak');
        const selectedVoice = localStorage.getItem('selected_voice');

        if (elevenLabsKey) {
            this.speechManager.setElevenLabsKey(elevenLabsKey);
        }

        if (autoSpeak !== null) {
            this.speechManager.setAutoSpeak(autoSpeak === 'true');
        }

        if (selectedVoice) {
            // Wait for voices to load
            setTimeout(() => {
                this.speechManager.setVoice(selectedVoice);
            }, 500);
        }
    }

    /**
     * Populate voice select dropdown
     */
    populateVoiceSelect() {
        const voices = this.speechManager.getVoices();
        const select = this.elements.voiceSelect;
        const currentVoice = this.speechManager.selectedVoice?.name;

        select.innerHTML = '';

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.name === currentVoice) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AIAvatarApp();
});