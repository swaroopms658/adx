/**
 * Speech Manager
 * Handles Speech-to-Text and Text-to-Speech functionality
 */

class SpeechManager {
    constructor() {
        // Speech Recognition (STT)
        this.recognition = null;
        this.isListening = false;
        this.isStopping = false; // Flag to prevent duplicate sends
        this.transcript = '';
        this.interimTranscript = '';

        // Speech Synthesis (TTS)
        this.synthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.voices = [];
        this.selectedVoice = null;
        this.selectedVoice = null;
        this.autoSpeak = true;
        this.currentUtterance = null; // To prevent GC

        // Audio Queue for Streaming
        this.speechQueue = [];
        this.isQueuePlaying = false;

        // ElevenLabs (optional premium TTS)
        this.elevenLabsKey = null;
        this.elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Default voice (Rachel)

        // Callbacks
        this.onTranscript = null;
        this.onInterimTranscript = null;
        this.onListeningChange = null;
        this.onSpeakingChange = null;
        this.onError = null;

        this.initSpeechRecognition();
        this.loadVoices();
    }

    /**
     * Initialize Speech Recognition
     */
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported');
            this.onError?.('Speech Recognition is not supported in this browser. Please use Chrome.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isListening = true;
            this.onListeningChange?.(true);
        };

        this.recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            this.isListening = false;
            this.onListeningChange?.(false);

            // Only send if we haven't already fast-sent in stopListening
            if (!this.isStopping) {
                const finalResult = (this.transcript + this.interimTranscript).trim();
                if (finalResult) {
                    console.log('🎤 onend sending transcript:', finalResult);
                    this.onTranscript?.(finalResult);
                }
            }

            // Reset flags
            this.isStopping = false;

            // Clear all buffers
            this.transcript = '';
            this.interimTranscript = '';
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscriptTemp = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscriptTemp += transcript;
                }
            }

            // Update transcripts
            if (finalTranscript) {
                this.transcript += finalTranscript;
            }
            this.interimTranscript = interimTranscriptTemp;

            // Callback with interim results
            this.onInterimTranscript?.(this.transcript + this.interimTranscript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'not-allowed') {
                this.onError?.('Microphone access denied. Please allow microphone access in your browser settings.');
            } else if (event.error === 'no-speech') {
                // Silently handle no-speech error
            } else if (event.error === 'network') {
                this.onError?.('Network error: Internet required for speech recognition. Please check your connection.');
            } else {
                this.onError?.(`Speech recognition error: ${event.error}`);
            }

            this.isListening = false;
            this.onListeningChange?.(false);
        };
    }

    /**
     * Load available voices for TTS
     */
    loadVoices() {
        const loadVoiceList = () => {
            this.voices = this.synthesis.getVoices();

            // Try to find a good default English voice
            const preferredVoices = ['Google US English', 'Microsoft David', 'Microsoft Mark', 'Google UK English Male'];

            for (const preferred of preferredVoices) {
                const voice = this.voices.find(v => v.name.includes(preferred));
                if (voice) {
                    this.selectedVoice = voice;
                    break;
                }
            }

            // Fallback to first English voice
            if (!this.selectedVoice) {
                this.selectedVoice = this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];
            }

            console.log(`Loaded ${this.voices.length} voices. Selected: ${this.selectedVoice?.name}`);
        };

        // Chrome loads voices asynchronously
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = loadVoiceList;
        }

        // Initial load
        loadVoiceList();
    }

    /**
     * Start listening
     */
    startListening() {
        if (!this.recognition) {
            this.onError?.('Speech Recognition not available');
            return;
        }

        // Stop any ongoing speech
        this.stopSpeaking();

        // Reset transcripts
        this.transcript = '';
        this.interimTranscript = '';

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            // May already be listening
            if (error.name === 'InvalidStateError') {
                this.recognition.stop();
                setTimeout(() => this.recognition.start(), 100);
            }
        }
    }

    /**
     * Stop listening and return the transcript immediately
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            // Optimization: Send valuable transcript immediately without waiting for 'onend'
            // This reduces the 1-second delay from browser silence detection
            const currentText = (this.transcript + this.interimTranscript).trim();
            if (currentText) {
                console.log('🚀 Fast-sending transcript:', currentText);
                this.onTranscript?.(currentText);

                // Clear buffers
                this.transcript = '';
                this.interimTranscript = '';
            }

            // Flag to ignore subsequent onend/onresult events
            this.isStopping = true;
            this.recognition.stop();
        }
    }

    /**
     * Toggle listening state
     */
    toggleListening() {
        if (this.isListening) {
            return this.stopListening();
        } else {
            this.startListening();
            return null;
        }
    }

    /**
     * Speak text using TTS
     */
    speak(text, useElevenLabs = false, append = false) {
        if (!this.autoSpeak) return;

        if (!append) {
            // Stop current speech and clear queue
            this.stopSpeaking();
            this.speechQueue = [];
        }

        this.speechQueue.push({ text, useElevenLabs });
        this.processSpeechQueue();
    }

    /**
     * Process the speech queue
     */
    async processSpeechQueue() {
        if (this.isQueuePlaying || this.speechQueue.length === 0) return;

        this.isQueuePlaying = true;
        const item = this.speechQueue.shift();

        try {
            if (item.useElevenLabs && this.elevenLabsKey) {
                await this.speakWithElevenLabs(item.text);
            } else {
                await this.speakWithWebSpeech(item.text);
            }
        } catch (error) {
            console.error('Speech error:', error);
        } finally {
            this.isQueuePlaying = false;
            // Process next item
            this.processSpeechQueue();
        }
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        this.synthesis.cancel(); // Stop Web Speech
        this.isSpeaking = false;
        this.isQueuePlaying = false;
        this.speechQueue = []; // Clear queue
        this.onSpeakingChange?.(false);
    }

    /**
     * Speak using Web Speech API (Promisified for queue)
     */
    speakWithWebSpeech(text) {
        return new Promise((resolve) => {
            if (!this.synthesis) {
                console.error('Speech Synthesis not supported');
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = this.selectedVoice;
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Store reference to prevent garbage collection (Chrome bug)
            this.currentUtterance = utterance;

            utterance.onstart = () => {
                this.isSpeaking = true;
                this.onSpeakingChange?.(true);
            };

            utterance.onend = () => {
                // Determine if we are really done or just between queue items
                if (this.speechQueue.length === 0) {
                    this.isSpeaking = false;
                    this.onSpeakingChange?.(false);
                }
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('TTS error:', event);
                this.isSpeaking = false;
                this.onSpeakingChange?.(false);
                resolve();
            };

            this.synthesis.speak(utterance);
        });
    }

    /**
     * Speak using ElevenLabs API
     */
    async speakWithElevenLabs(text) {
        if (!this.elevenLabsKey) {
            console.error('ElevenLabs API key not set');
            this.speakWithWebSpeech(text); // Fallback
            return;
        }

        try {
            this.isSpeaking = true;
            this.onSpeakingChange?.(true);

            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}/stream`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            return new Promise((resolve) => {
                audio.onended = () => {
                    this.isSpeaking = false;
                    this.onSpeakingChange?.(false);
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };

                audio.onerror = () => {
                    this.isSpeaking = false;
                    this.onSpeakingChange?.(false);
                    resolve();
                };

                audio.play().catch(e => {
                    console.error("Audio play failed", e);
                    resolve();
                });
            });

        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            this.isSpeaking = false;
            this.onSpeakingChange?.(false);
            // Fallback to Web Speech
            return this.speakWithWebSpeech(text);
        }
    }

    /**
     * Set the voice by name
     */
    setVoice(voiceName) {
        const voice = this.voices.find(v => v.name === voiceName);
        if (voice) {
            this.selectedVoice = voice;
            console.log(`Voice set to: ${voice.name}`);
        }
    }

    /**
     * Get available voices
     */
    getVoices() {
        return this.voices.map(v => ({
            name: v.name,
            lang: v.lang,
            default: v.default
        }));
    }

    /**
     * Set ElevenLabs API key
     */
    setElevenLabsKey(key) {
        this.elevenLabsKey = key;
    }

    /**
     * Set auto-speak preference
     */
    setAutoSpeak(enabled) {
        this.autoSpeak = enabled;
    }
}

// Export for use in other modules
window.SpeechManager = SpeechManager;
