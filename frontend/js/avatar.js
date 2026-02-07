/**
 * Avatar Manager (V3 - Realistic)
 * Handles realistic 3D avatar rendering with Three.js using Ready Player Me models.
 */

class AvatarManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.loadingOverlay = document.getElementById('avatarLoading');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.avatar = null;
        this.mixer = null;
        this.clock = new THREE.Clock();

        // Avatar state
        this.isSpeaking = false;
        this.currentEmotion = 'neutral';
        this.mouthOpenness = 0;
        this.targetMouthOpenness = 0;

        // Animation State
        this.blinkState = 0;
        this.nextBlinkTime = 0;
        this.headRotation = new THREE.Euler();
        this.targetHeadRotation = new THREE.Euler();

        // Viseme State
        this.currentViseme = null;
        this.visemeTarget = 0;
        this.lastVisemeChange = 0;

        // Morph Targets (Visemes)
        this.headMesh = null;
        this.morphTargetMapping = {
            'mouthOpen': 'mouthOpen',
            'viseme_aa': 'viseme_aa',
            'viseme_oh': 'viseme_oh',
            'eyesClosed': 'eyesClosed'
        };

        // Initialize
        this.init();
    }

    init() {
        if (!this.canvas) return;

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent for CSS background

        // Create camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
        this.camera.position.set(0, 0, 1.5); // Close-up for better realism

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true, // Try keeping this, but if it crashes again, we'll disable it
            alpha: true,
            powerPreference: 'default', // Don't force high-performance
            failIfMajorPerformanceCaveat: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Lighting
        this.setupLighting();

        // Load Realistic Avatar
        this.loadRealisticAvatar();

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());

        // Start animation loop
        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(2, 2, 5);
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-2, 0, 2);
        this.scene.add(fillLight);
    }

    async loadRealisticAvatar() {
        // Load the locally downloaded avatar model to bypass CORS/404 issues
        const possibleUrls = [
            './assets/avatar.glb'
        ];

        // Handle different ways GLTFLoader might be exposed across CDNs
        let loader;
        if (typeof THREE.GLTFLoader === 'function') {
            loader = new THREE.GLTFLoader();
        } else if (typeof GLTFLoader === 'function') {
            loader = new GLTFLoader();
        } else {
            console.error('GLTFLoader not found. Please check script include.');
            return;
        }

        for (const url of possibleUrls) {
            try {
                console.log(`🚀 Attempting to load realistic avatar from: ${url}`);
                const gltf = await new Promise((resolve, reject) => {
                    loader.load(url, resolve, null, reject);
                });

                console.log('📦 GLTF Loaded:', gltf);

                // Assign scene with fallback
                this.avatar = gltf.scene || gltf.scenes[0];

                if (!this.avatar) {
                    throw new Error('GLTF file loaded but no scene found.');
                }

                // Center the avatar for a professional interview shot (Head & Shoulders)
                this.avatar.position.y = -1.65; // Move down so eyes are near y=0
                this.scene.add(this.avatar);

                // Find the head mesh for morph targets
                this.avatar.traverse(node => {
                    if (node.isMesh && node.morphTargetDictionary) {
                        if (node.name.includes('Head') || node.name.includes('Wolf3D_Head')) {
                            this.headMesh = node;
                        }
                    }
                });

                // Camera positioning - Head & Shoulders shot
                // The avatar is shifted down by -1.65, so the head is at y=0.
                this.camera.position.set(0, 0, 0.5);

                // Look at the eyes (approx y=0.05 after shift)
                const lookTarget = new THREE.Vector3(0, 0.05, 0);
                this.camera.lookAt(lookTarget);

                // Update controls to orbit around the head
                // this.controls.target = lookTarget; // Omitted as this.controls is not defined in this class

                if (this.loadingOverlay) {
                    this.loadingOverlay.classList.add('hidden');
                }

                console.log('✅ Realistic Avatar Loaded Successfully!');
                return; // Exit loop on success

            } catch (error) {
                console.warn(`⚠️ Failed to load avatar from ${url}. Trying next...`, error);
            }
        }

        // Final fallback if all else fails
        console.error('❌ All realistic avatar fallbacks failed.');
        if (this.loadingOverlay) {
            this.loadingOverlay.innerHTML = '<p style="color:red">Network error loading 3D assets. Please check your connection and refresh.</p>';
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        if (this.avatar) {
            // Subtle breathing
            const breathing = Math.sin(elapsed * 1.5) * 0.003;
            this.avatar.position.y = -1.55 + breathing;

            // Update procedural animations
            this.updateHeadMovement(delta, elapsed);
            this.updateBlinking(delta, elapsed);
            this.updateMouthAnimation(delta);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateHeadMovement(delta, elapsed) {
        if (!this.avatar) return;

        if (this.currentEmotion === 'thinking') {
            this.targetHeadRotation.set(
                Math.sin(elapsed * 0.2) * 0.05,
                Math.cos(elapsed * 0.3) * 0.1,
                0
            );
        } else if (this.isSpeaking) {
            this.targetHeadRotation.set(
                Math.sin(elapsed * 2.5) * 0.03 + 0.02,
                Math.sin(elapsed * 1.5) * 0.05,
                0
            );
        } else {
            this.targetHeadRotation.set(
                Math.sin(elapsed * 0.5) * 0.01,
                Math.sin(elapsed * 0.3) * 0.02,
                0
            );
        }

        // Interpolate head bone if possible, or entire group
        // Ready Player Me has a 'Head' bone, but for simplicity we rotate the scene root
        // or a specific parent node if found.
        const lerpSpeed = 1.5;
        this.avatar.rotation.x += (this.targetHeadRotation.x - this.avatar.rotation.x) * lerpSpeed * delta;
        this.avatar.rotation.y += (this.targetHeadRotation.y - this.avatar.rotation.y) * lerpSpeed * delta;
    }

    updateBlinking(delta, elapsed) {
        if (!this.headMesh) return;

        const dictionary = this.headMesh.morphTargetDictionary;
        const index = dictionary['eyesClosed'];
        if (index === undefined) return;

        if (elapsed > this.nextBlinkTime) {
            this.blinkState = 1;
            if (elapsed > this.nextBlinkTime + 0.12) {
                this.blinkState = 0;
                this.nextBlinkTime = elapsed + 2 + Math.random() * 5;
            }
        }

        const targetInfluence = this.blinkState === 1 ? 1.0 : 0.0;
        this.headMesh.morphTargetInfluences[index] += (targetInfluence - this.headMesh.morphTargetInfluences[index]) * 20 * delta;
    }

    updateMouthAnimation(delta) {
        if (!this.headMesh) return;

        const dictionary = this.headMesh.morphTargetDictionary;
        const mouthOpenIndex = dictionary['mouthOpen'];

        // Standard Oculus Visemes
        const visemes = ['viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_RR', 'viseme_nn', 'viseme_sil'];

        if (this.isSpeaking) {
            const now = Date.now();

            // Randomly switch visemes every 0.1s - 0.2s for natural "babbling"
            if (now - this.lastVisemeChange > 100 + Math.random() * 100) {
                this.lastVisemeChange = now;
                // Pick a random viseme
                const randomViseme = visemes[Math.floor(Math.random() * visemes.length)];
                this.currentViseme = randomViseme;
                // Random intensity
                this.visemeTarget = 0.5 + Math.random() * 0.5;
            }

            // Interpolate to target
            visemes.forEach(v => {
                const index = dictionary[v];
                if (index !== undefined) {
                    if (v === this.currentViseme) {
                        this.headMesh.morphTargetInfluences[index] += (this.visemeTarget - this.headMesh.morphTargetInfluences[index]) * 15 * delta;
                    } else {
                        // Decay others
                        this.headMesh.morphTargetInfluences[index] *= 0.8;
                    }
                }
            });

            // Add some base mouth movement
            if (mouthOpenIndex !== undefined) {
                // Mouth open tracks broadly with intensity but stays somewhat open
                const targetOpen = (this.currentViseme === 'viseme_sil') ? 0 : 0.2 + Math.random() * 0.2;
                this.headMesh.morphTargetInfluences[mouthOpenIndex] += (targetOpen - this.headMesh.morphTargetInfluences[mouthOpenIndex]) * 10 * delta;
            }

        } else {
            // Silence - close everything
            visemes.forEach(v => {
                const index = dictionary[v];
                if (index !== undefined) {
                    this.headMesh.morphTargetInfluences[index] *= 0.8; // Fast decay
                }
            });

            if (mouthOpenIndex !== undefined) {
                this.headMesh.morphTargetInfluences[mouthOpenIndex] *= 0.8;
            }
        }
    }

    setSpeaking(speaking) {
        this.isSpeaking = speaking;
    }

    setEmotion(emotion) {
        this.currentEmotion = emotion;
    }

    handleResize() {
        if (!this.canvas || !this.camera || !this.renderer) return;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    dispose() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.renderer) this.renderer.dispose();
        // Geometry/Material cleanup...
    }
}

window.AvatarManager = AvatarManager;
