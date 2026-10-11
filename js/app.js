/**
 * ============================================================================
 * NEON AIR STUDIO - Master Application Controller
 * Apple-grade Whiteboard Studio with Photo Uploads, 1-Finger Draw,
 * 2-Finger Erase, 2-Hand Dynamic Shapes, and Onboarding Tutorial Modal.
 * ============================================================================
 */

class AirStudioApp {
  constructor() {
    // Canvas Elements
    this.canvasContainer = document.getElementById('canvas-container');
    this.drawingCanvas = document.getElementById('drawing-canvas');
    this.drawingCtx = this.drawingCanvas.getContext('2d', { willReadFrequently: true });

    this.imageCanvas = document.getElementById('image-canvas');
    this.imageCtx = this.imageCanvas.getContext('2d');

    this.previewCanvas = document.getElementById('preview-canvas');
    this.previewCtx = this.previewCanvas.getContext('2d');

    this.fxCanvas = document.getElementById('fx-canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');

    this.hudCanvas = document.getElementById('hud-canvas');
    this.hudCtx = this.hudCanvas.getContext('2d');

    this.videoEl = document.getElementById('camera-video');

    // Virtual Pointer Elements
    this.pointerEl = document.getElementById('gesture-pointer');
    this.dwellCircle = document.getElementById('dwell-progress-circle');

    // UI Badges & Overlays
    this.toastEl = document.getElementById('toast-notification');
    this.wipeOverlay = document.getElementById('fist-wipe-overlay');
    this.wipeTimeText = document.getElementById('wipe-time-val');
    this.dualHandPill = document.getElementById('dual-hand-indicator');

    // App State
    this.state = {
      activeColor: '#0071e3',       // Apple Azure Blue default
      activeBrush: 'pencil',        // pencil, highlighter, neon, calligraphy, sparkle
      activeSize: 8,                // 3 (Fine), 8 (Normal), 16 (Thick), 28 (Marker)
      activeShape: 'freehand',      // freehand, rectangle, circle, triangle, line
      dualHandShape: 'rectangle',   // Shape to generate when 2 hands are detected
      canvasTheme: 'whiteboard',    // whiteboard, grid, dots, dark, parchment
      smartSnapEnabled: false,      // Single finger ONLY draws lines - zero shape popups!
      isDrawing: false,
      isErasing: false,
      lastEraserPos: null,
      twoHandSession: {
        active: false,
        startTime: 0,
        startP1: null,
        startP2: null,
        path1: [],
        path2: [],
        maxDistance: 0,
        hasSeparated: false,
        lastMoveTime: 0,
        cooldownUntil: 0
      },
      fistHoldStart: 0,
      fistHoldRequired: 850,        // ms to wipe canvas
      backgroundImage: null,
      imageOpacity: 0.85,
      soundMuted: false
    };

    // History stack for Undo / Redo
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 25;

    // AI smart doodle recording
    this.strokePoints = [];
    this.strokeStartState = null;

    // MediaPipe Hands & Camera
    this.hands = null;
    this.camera = null;

    this.init();
  }

  async init() {
    this.resizeCanvases();
    window.addEventListener('resize', () => this.resizeCanvases());

    this.setupEventListeners();
    this.setupImageUpload();
    this.setupDragAndDrop();
    this.saveStateToHistory();
    this.startParticleLoop();

    // Setup MediaPipe Hands with Dual Hand Detection
    await this.setupMediaPipe();

    // Check first launch to show onboarding guide automatically
    this.checkOnboardingModal();
  }

  resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Cache drawing
    let tempCanvas = null;
    if (this.drawingCanvas.width > 0 && this.drawingCanvas.height > 0) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.drawingCanvas.width;
      tempCanvas.height = this.drawingCanvas.height;
      tempCanvas.getContext('2d').drawImage(this.drawingCanvas, 0, 0);
    }

    [this.drawingCanvas, this.imageCanvas, this.previewCanvas, this.fxCanvas].forEach(c => {
      c.width = width;
      c.height = height;
    });

    if (tempCanvas) {
      this.drawingCtx.drawImage(tempCanvas, 0, 0, width, height);
    }

    if (this.state.backgroundImage) {
      this.renderBackgroundImage();
    }
  }

  checkOnboardingModal() {
    const modal = document.getElementById('guide-modal');
    const hasSeen = localStorage.getItem('apple_air_guide_seen');
    if (!hasSeen) {
      setTimeout(() => {
        modal.classList.add('active');
      }, 350);
    }
  }

  /**
   * Undo / Redo History Stack
   */
  saveStateToHistory() {
    const imgData = this.drawingCtx.getImageData(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(imgData);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.drawingCtx.putImageData(this.history[this.historyIndex], 0, 0);
      window.soundEngine.playUndoSound();
      this.showToast('↩️ Undo');
    } else {
      this.showToast('ℹ️ Nothing to undo');
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.drawingCtx.putImageData(this.history[this.historyIndex], 0, 0);
      window.soundEngine.playUndoSound();
      this.showToast('↪️ Redo');
    } else {
      this.showToast('ℹ️ Nothing to redo');
    }
  }

  clearCanvas() {
    this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.saveStateToHistory();
    window.soundEngine.playClearSound();
    this.showToast('🗑️ Canvas Cleared');
  }

  /**
   * UI Event Listeners
   */
  setupEventListeners() {
    // 1. Color Swatches
    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        this.setColor(color, btn);
      });
    });

    // Custom Color Picker Input
    const customColorInput = document.getElementById('custom-color-picker');
    if (customColorInput) {
      customColorInput.addEventListener('input', (e) => {
        this.setColor(e.target.value, null);
      });
    }

    // 2. Brush Tools (Pencil, Highlighter, Neon, Calligraphy)
    document.querySelectorAll('.brush-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const brush = btn.dataset.brush;
        this.setBrush(brush, btn);
      });
    });

    // 3. Stroke Size Pills
    document.querySelectorAll('.size-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseInt(btn.dataset.size, 10);
        this.setSize(size, btn);
      });
    });

    // 4. Background Theme Switcher
    document.querySelectorAll('.bg-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this.setCanvasTheme(theme, btn);
      });
    });

    // 5. Dual-Hand Shape Selector Pills
    document.querySelectorAll('.dual-shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const shape = btn.dataset.shape;
        this.setDualHandShape(shape, btn);
      });
    });

    // 6. Action Buttons
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.redo());
    document.getElementById('btn-clear').addEventListener('click', () => this.clearCanvas());
    document.getElementById('btn-export').addEventListener('click', () => this.exportArtwork());

    // AI Smart Snap Toggle
    const smartSnapBtn = document.getElementById('btn-smart-snap');
    if (smartSnapBtn) {
      smartSnapBtn.addEventListener('click', () => {
        this.state.smartSnapEnabled = !this.state.smartSnapEnabled;
        smartSnapBtn.classList.toggle('active', this.state.smartSnapEnabled);
        window.soundEngine.playSelectChime();
        this.showToast(this.state.smartSnapEnabled ? '⚡ AI Smart Snap: ON' : '⚡ AI Smart Snap: OFF');
      });
    }

    // Webcam PiP Toggle
    const togglePipBtn = document.getElementById('btn-toggle-pip');
    const pipPanel = document.getElementById('webcam-pip-card');
    if (togglePipBtn && pipPanel) {
      togglePipBtn.addEventListener('click', () => {
        pipPanel.classList.toggle('minimized');
      });
    }

    // Sound Mute Toggle
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const active = window.soundEngine.toggleMute();
        muteBtn.classList.toggle('active', active);
        muteBtn.querySelector('.btn-icon').textContent = active ? '🔊' : '🔇';
        this.showToast(active ? '🔊 Audio ON' : '🔇 Audio Muted');
      });
    }

    // Modal Guide Toggle & Dismiss
    const modal = document.getElementById('guide-modal');
    document.getElementById('btn-help').addEventListener('click', () => {
      modal.classList.add('active');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
      modal.classList.remove('active');
    });
    document.getElementById('btn-modal-got-it').addEventListener('click', () => {
      modal.classList.remove('active');
      localStorage.setItem('apple_air_guide_seen', 'true');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        this.clearCanvas();
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.exportArtwork();
      }
    });
  }

  setColor(color, activeBtn) {
    this.state.activeColor = color;
    document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    const colorHex = color === 'rainbow' ? '#0071e3' : color;
    document.querySelector('#gesture-pointer .cursor-center').style.backgroundColor = colorHex;
    window.soundEngine.playSelectChime();
  }

  setBrush(brush, activeBtn) {
    this.state.activeBrush = brush;
    document.querySelectorAll('.brush-tool-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
    window.soundEngine.playSelectChime();
    this.showToast(`🖌️ Tool: ${brush.toUpperCase()}`);
  }

  setSize(size, activeBtn) {
    this.state.activeSize = size;
    document.querySelectorAll('.size-pill').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
    window.soundEngine.playSelectChime();
  }

  setCanvasTheme(theme, activeBtn) {
    this.state.canvasTheme = theme;
    document.querySelectorAll('.bg-theme-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    this.canvasContainer.className = `canvas-container theme-${theme}`;
    window.soundEngine.playSelectChime();
    this.showToast(`🎨 Canvas: ${theme.toUpperCase()}`);
  }

  setDualHandShape(shape, activeBtn) {
    this.state.dualHandShape = shape;
    document.querySelectorAll('.dual-shape-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
    window.soundEngine.playSelectChime();
    this.showToast(`👐 2-Hand Shape: ${shape.toUpperCase()}`);
  }

  /**
   * Image Upload & Tracing Backdrop Engine
   */
  setupImageUpload() {
    const uploadInput = document.getElementById('image-upload-input');
    const uploadBtn = document.getElementById('btn-upload-image');
    const opacitySlider = document.getElementById('image-opacity-slider');
    const removeImgBtn = document.getElementById('btn-remove-image');

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
    }

    if (uploadInput) {
      uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.loadImageFromFile(file);
      });
    }

    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.state.imageOpacity = parseFloat(e.target.value);
        this.imageCanvas.style.opacity = this.state.imageOpacity;
      });
    }

    if (removeImgBtn) {
      removeImgBtn.addEventListener('click', () => {
        this.clearBackgroundImage();
      });
    }

    // Preset Template Buttons
    document.querySelectorAll('.template-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.template;
        this.loadPresetTemplate(type);
      });
    });
  }

  setupDragAndDrop() {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.loadImageFromFile(e.dataTransfer.files[0]);
      }
    });
  }

  loadImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.state.backgroundImage = img;
        this.renderBackgroundImage();
        document.getElementById('image-control-dock').classList.add('visible');
        this.showToast('🖼️ Photo loaded! You can now air-paint or trace over it.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  renderBackgroundImage() {
    if (!this.state.backgroundImage) return;
    this.imageCtx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);

    const img = this.state.backgroundImage;
    const cw = this.imageCanvas.width;
    const ch = this.imageCanvas.height;

    // Center and scale image to fit canvas comfortably
    const maxW = cw * 0.82;
    const maxH = ch * 0.78;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (cw - w) / 2;
    const y = (ch - h) / 2;

    this.imageCtx.drawImage(img, x, y, w, h);
    this.imageCanvas.style.opacity = this.state.imageOpacity;
  }

  clearBackgroundImage() {
    this.state.backgroundImage = null;
    this.imageCtx.clearRect(0, 0, this.imageCanvas.width, this.imageCanvas.height);
    document.getElementById('image-control-dock').classList.remove('visible');
    this.showToast('🗑️ Photo removed from background');
  }

  /**
   * Generates creative SVG templates for instant coloring & tracing
   */
  loadPresetTemplate(type) {
    const svgTemplates = {
      butterfly: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600"><path d="M200 60 C180 20 100 20 80 80 C60 140 120 200 200 180 C280 200 340 140 320 80 C300 20 220 20 200 60 Z M200 180 C180 200 120 220 110 260 C100 290 140 290 170 270 C190 250 195 220 200 180 C205 220 210 250 230 270 C260 290 300 290 290 260 C280 220 220 200 200 180 Z" fill="none" stroke="#64748b" stroke-width="4"/><circle cx="200" cy="110" r="10" fill="#64748b"/><circle cx="200" cy="140" r="8" fill="#64748b"/><circle cx="200" cy="170" r="6" fill="#64748b"/></svg>`,
      mandala: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="700" height="700"><circle cx="200" cy="200" r="180" fill="none" stroke="#64748b" stroke-width="3"/><circle cx="200" cy="200" r="120" fill="none" stroke="#64748b" stroke-width="2"/><circle cx="200" cy="200" r="60" fill="none" stroke="#64748b" stroke-width="2"/><path d="M200 20 L200 380 M20 200 L380 200 M72 72 L328 328 M72 328 L328 72" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,6"/></svg>`,
      car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 250" width="800" height="400"><path d="M50 170 L90 170 C95 140 135 140 140 170 L340 170 C345 140 385 140 390 170 L450 170 C460 170 470 160 465 140 L440 100 C430 90 400 80 340 80 L230 80 L150 110 L70 120 C50 125 45 150 50 170 Z" fill="none" stroke="#64748b" stroke-width="4"/><circle cx="115" cy="170" r="28" fill="none" stroke="#64748b" stroke-width="4"/><circle cx="365" cy="170" r="28" fill="none" stroke="#64748b" stroke-width="4"/></svg>`
    };

    const svgStr = svgTemplates[type] || svgTemplates.butterfly;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      this.state.backgroundImage = img;
      this.renderBackgroundImage();
      document.getElementById('image-control-dock').classList.add('visible');
      URL.revokeObjectURL(url);
      this.showToast(`✨ ${type.toUpperCase()} Template Ready!`);
    };
    img.src = url;
  }

  showToast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2200);
  }

  /**
   * Setup MediaPipe Hands Tracking (maxNumHands: 2)
   */
  async setupMediaPipe() {
    try {
      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,           // DUAL-HANDS SUPPORT ENABLED
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
      });

      this.hands.onResults((results) => this.onHandResults(results));

      this.camera = new Camera(this.videoEl, {
        onFrame: async () => {
          await this.hands.send({ image: this.videoEl });
        },
        width: 1280,
        height: 720
      });

      await this.camera.start();
      document.getElementById('pip-status-badge').textContent = 'ONLINE';
    } catch (err) {
      console.error('Camera/MediaPipe initialization failed:', err);
      document.getElementById('pip-status-badge').textContent = 'CAMERA ERROR';
      this.showToast('⚠️ Please allow camera access to use Air Painting!');
    }
  }

  /**
   * Realtime Hand Results Processing
   */
  onHandResults(results) {
    // 1. Render mini wireframe in corner PiP
    this.renderHUD(results);

    const landmarks = results.multiHandLandmarks;
    if (!landmarks || landmarks.length === 0) {
      this.pointerEl.style.opacity = '0';
      this.wipeOverlay.classList.remove('visible');
      this.dualHandPill.classList.remove('visible');
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

      if (this.state.isDrawing) {
        this.finalizeStroke();
      }
      this.state.isDrawing = false;
      this.state.isErasing = false;
      this.state.lastEraserPos = null;
      window.brushEngine.endStroke();

      // Cleanly reset any two-hand session
      if (this.state.twoHandSession) {
        this.state.twoHandSession.active = false;
      }
      return;
    }

    // If previously in two-hand session and user dropped to 1 hand, commit or clear
    if (landmarks.length < 2 && this.state.twoHandSession && this.state.twoHandSession.active) {
      const session = this.state.twoHandSession;
      const count1 = session.path1.length;
      const count2 = session.path2.length;
      if (count1 > 5 || count2 > 5) {
        const last1 = session.path1[count1 - 1] || session.startP1;
        const last2 = session.path2[count2 - 1] || session.startP2;
        const pathSpan = Math.max(
          Math.hypot(last1.x - session.startP1.x, last1.y - session.startP1.y),
          Math.hypot(last2.x - session.startP2.x, last2.y - session.startP2.y)
        );
        if (pathSpan > 45) {
          window.brushEngine.commitTwoHandShape(
            this.drawingCtx,
            session.path1,
            session.path2,
            session.startP1,
            session.startP2,
            last1,
            last2,
            false,
            this.state.activeColor,
            this.state.activeSize,
            this.state.activeBrush
          );
          this.saveStateToHistory();
          window.soundEngine.playStampSound();
          this.showToast('✨ Two-Hand Shape Placed!');
        }
      }
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
      session.active = false;
    }

    // Classify using our updated GestureEngine
    const gesture = window.gestureEngine.classifyMultiHands(landmarks);

    // =========================================================================
    // BRANCH A: DUAL HANDS DETECTED (👐 Two-Hand Dual Index Drawing Engine)
    // =========================================================================
    if (gesture.type === 'DUAL_HANDS') {
      this.handleDualHands(gesture);
      return;
    }

    // =========================================================================
    // BRANCH B: SINGLE HAND DETECTED (☝️ 1 Finger Draw, ✌️ 2 Finger Erase, ✊ Fist)
    // =========================================================================
    this.handleSingleHand(gesture);
  }

  /**
   * Dual-Hand Interactive Shape Drawing Engine:
   * Tracks both index pointers simultaneously with live dotted line preview,
   * detects when fingers meet or pause to sculpt and place shapes on the whiteboard!
   */
  handleDualHands(gesture) {
    this.pointerEl.style.opacity = '0';
    this.wipeOverlay.classList.remove('visible');
    this.dualHandPill.classList.add('visible');

    // End single-hand drawing if active
    if (this.state.isDrawing) this.finalizeStroke();
    this.state.isDrawing = false;
    this.state.isErasing = false;
    this.state.lastEraserPos = null;

    const now = performance.now();
    const session = this.state.twoHandSession;

    // Convert normalized coordinates to screen pixels
    const p1 = { x: gesture.p1.x * window.innerWidth, y: gesture.p1.y * window.innerHeight };
    const p2 = { x: gesture.p2.x * window.innerWidth, y: gesture.p2.y * window.innerHeight };
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    // Cooldown check after placing a shape
    if (now < session.cooldownUntil) {
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
      return;
    }

    if (!session.active) {
      session.active = true;
      session.startTime = now;
      session.startP1 = { ...p1 };
      session.startP2 = { ...p2 };
      session.path1 = [ { ...p1 } ];
      session.path2 = [ { ...p2 } ];
      session.maxDistance = dist;
      session.hasSeparated = (dist > 70);
      session.lastMoveTime = now;
    } else {
      const last1 = session.path1[session.path1.length - 1];
      const last2 = session.path2[session.path2.length - 1];
      const moved1 = Math.hypot(p1.x - last1.x, p1.y - last1.y);
      const moved2 = Math.hypot(p2.x - last2.x, p2.y - last2.y);

      if (moved1 > 4) session.path1.push({ ...p1 });
      if (moved2 > 4) session.path2.push({ ...p2 });

      if (moved1 > 4 || moved2 > 4) {
        session.lastMoveTime = now;
      }

      if (dist > session.maxDistance) session.maxDistance = dist;
      if (dist > 75) session.hasSeparated = true;
    }

    // Check if fingers have closed the shape (they meet!)
    const theyMeet = session.hasSeparated && dist < 48 && (session.path1.length > 5 || session.path2.length > 5);

    // Check if user paused moving (doesn't meet, steady hold for 700ms) with a shape drawn
    const steadyDuration = now - session.lastMoveTime;
    const pathSpan = Math.max(
      Math.hypot(p1.x - session.startP1.x, p1.y - session.startP1.y),
      Math.hypot(p2.x - session.startP2.x, p2.y - session.startP2.y),
      dist
    );
    const steadyFinish = (session.path1.length > 6 || session.path2.length > 6) &&
                         pathSpan > 50 &&
                         steadyDuration > 700;

    if (theyMeet || steadyFinish) {
      // Clear live preview and commit shape to permanent drawing canvas
      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
      window.brushEngine.commitTwoHandShape(
        this.drawingCtx,
        session.path1,
        session.path2,
        session.startP1,
        session.startP2,
        p1,
        p2,
        theyMeet,
        this.state.activeColor,
        this.state.activeSize,
        this.state.activeBrush
      );

      this.saveStateToHistory();
      window.soundEngine.playStampSound();
      this.showToast(theyMeet ? '✨ Two-Hand Closed Shape Placed!' : '✨ Two-Hand Shape Placed!');

      session.active = false;
      session.cooldownUntil = now + 800;
      return;
    }

    // Live Dotted Preview on previewCanvas
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    const isMeetingSnap = session.hasSeparated && dist < 65;
    window.brushEngine.renderTwoHandPreview(
      this.previewCtx,
      session.path1,
      session.path2,
      session.startP1,
      session.startP2,
      p1,
      p2,
      this.state.activeColor,
      this.state.activeSize,
      isMeetingSnap
    );
  }

  /**
   * Single Hand Gesture Dispatch:
   * 1 Finger Draw, 2 Finger Erase, Closed Fist Clear, or Menu Pointer
   */
  handleSingleHand(gesture) {
    this.dualHandPill.classList.remove('visible');

    const screenX = gesture.pointer.x * window.innerWidth;
    const screenY = gesture.pointer.y * window.innerHeight;

    this.pointerEl.style.opacity = '1';
    this.pointerEl.style.transform = `translate(${screenX}px, ${screenY}px)`;

    // Check if hand is hovering over the top menu bar
    const topBarRect = document.querySelector('.apple-toolbar').getBoundingClientRect();
    const isOverMenu = screenY < topBarRect.bottom + 12;

    // -------------------------------------------------------------------------
    // 1. CLOSED FIST (✊) -> WIPE / CLEAR CANVAS
    // -------------------------------------------------------------------------
    if (gesture.mode === 'CLOSED_FIST') {
      if (this.state.isDrawing) this.finalizeStroke();
      this.state.isDrawing = false;
      this.state.isErasing = false;
      this.state.lastEraserPos = null;

      const now = performance.now();
      if (this.state.fistHoldStart === 0) {
        this.state.fistHoldStart = now;
      }
      const elapsed = now - this.state.fistHoldStart;
      const remainingSec = Math.max(0, (this.state.fistHoldRequired - elapsed) / 1000).toFixed(1);

      this.wipeOverlay.classList.add('visible');
      this.wipeTimeText.textContent = `${remainingSec}s`;

      if (elapsed >= this.state.fistHoldRequired) {
        this.clearCanvas();
        this.wipeOverlay.classList.remove('visible');
        this.state.fistHoldStart = 0;
      }
      return;
    } else {
      this.wipeOverlay.classList.remove('visible');
      this.state.fistHoldStart = 0;
    }

    // -------------------------------------------------------------------------
    // 2. HOVER OVER TOP MENU BAR -> TOUCHLESS SELECTION
    // -------------------------------------------------------------------------
    if (isOverMenu) {
      if (this.state.isDrawing) this.finalizeStroke();
      this.state.isDrawing = false;
      this.state.isErasing = false;
      this.state.lastEraserPos = null;

      this.pointerEl.className = 'hovering';

      const buttons = Array.from(document.querySelectorAll('.dwell-target'));
      const dwell = window.gestureEngine.processDwell(screenX, screenY, buttons);

      this.updateDwellRing(dwell.progress);
      buttons.forEach(b => b.classList.remove('gesture-hover'));

      if (dwell.target) {
        dwell.target.classList.add('gesture-hover');
      }

      if ((dwell.isTriggered || gesture.isPinching) && dwell.target) {
        dwell.target.click();
        window.soundEngine.playSelectChime();
        this.updateDwellRing(0);
        window.gestureEngine.resetDwell();
      }
      return;
    } else {
      this.updateDwellRing(0);
      window.gestureEngine.resetDwell();
      document.querySelectorAll('.gesture-hover').forEach(b => b.classList.remove('gesture-hover'));
    }

    // -------------------------------------------------------------------------
    // 3. TWO FINGERS (✌️) -> VIRTUAL ERASER MODE (CONTINUOUS & GAPLESS)
    // -------------------------------------------------------------------------
    if (gesture.mode === 'ERASER') {
      if (this.state.isDrawing) this.finalizeStroke();
      this.state.isDrawing = false;
      this.state.isErasing = true;

      this.pointerEl.className = 'eraser-mode';

      // Generous effective eraser radius (adapts to active size)
      const eraserRadius = Math.max(38, this.state.activeSize * 4.0);
      const currEraser = { x: screenX, y: screenY };

      // Erase along the continuous stroke between last point and current point
      window.brushEngine.eraseSegment(
        this.drawingCtx,
        this.state.lastEraserPos,
        currEraser,
        eraserRadius
      );
      this.state.lastEraserPos = currEraser;
      return;
    } else {
      if (this.state.isErasing) {
        this.state.isErasing = false;
        this.state.lastEraserPos = null;
        this.saveStateToHistory();
      }
    }

    // -------------------------------------------------------------------------
    // 4. ONE FINGER (☝️) -> DRAWING MODE (ONLY LINES, ZERO SHAPES)
    // -------------------------------------------------------------------------
    if (gesture.mode === 'DRAWING') {
      this.pointerEl.className = 'drawing-mode';
      this.state.lastEraserPos = null;

      if (!this.state.isDrawing) {
        this.state.isDrawing = true;
        this.strokePoints = [{ x: screenX, y: screenY }];
        window.brushEngine.beginStroke(screenX, screenY);
      } else {
        this.strokePoints.push({ x: screenX, y: screenY });
      }

      const last = window.brushEngine.lastPoint || { x: screenX, y: screenY };
      const current = { x: screenX, y: screenY };

      window.brushEngine.drawFreehandSegment(
        this.drawingCtx,
        this.fxCtx,
        last,
        current,
        this.state.activeBrush,
        this.state.activeColor,
        this.state.activeSize
      );
      return;
    }

    // -------------------------------------------------------------------------
    // 5. HOVER / STANDBY
    // -------------------------------------------------------------------------
    this.pointerEl.className = 'standby-mode';
    this.state.lastEraserPos = null;
    if (this.state.isDrawing) {
      this.finalizeStroke();
      this.state.isDrawing = false;
      window.brushEngine.endStroke();
    }
  }

  /**
   * Finalizes drawn stroke - saves cleanly to history with ZERO shape conversions!
   */
  finalizeStroke() {
    this.saveStateToHistory();
    this.strokePoints = [];
    this.strokeStartState = null;
  }

  updateDwellRing(progress) {
    if (!this.dwellCircle) return;
    const maxOffset = 120;
    this.dwellCircle.style.strokeDashoffset = maxOffset - progress * maxOffset;
  }

  /**
   * Corner PiP HUD with skeletal mesh
   */
  renderHUD(results) {
    this.hudCtx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);

    if (results.image) {
      this.hudCtx.drawImage(results.image, 0, 0, this.hudCanvas.width, this.hudCanvas.height);
    }

    if (!results.multiHandLandmarks) return;

    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]
    ];

    results.multiHandLandmarks.forEach((landmarks, hIdx) => {
      const color = hIdx === 0 ? '#0071e3' : '#34c759';

      this.hudCtx.strokeStyle = color;
      this.hudCtx.lineWidth = 1.5;

      connections.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        this.hudCtx.beginPath();
        this.hudCtx.moveTo(p1.x * this.hudCanvas.width, p1.y * this.hudCanvas.height);
        this.hudCtx.lineTo(p2.x * this.hudCanvas.width, p2.y * this.hudCanvas.height);
        this.hudCtx.stroke();
      });

      landmarks.forEach((p, idx) => {
        this.hudCtx.beginPath();
        const x = p.x * this.hudCanvas.width;
        const y = p.y * this.hudCanvas.height;
        this.hudCtx.arc(x, y, idx === 8 ? 4 : 2, 0, Math.PI * 2);
        this.hudCtx.fillStyle = idx === 8 ? '#ff3b30' : color;
        this.hudCtx.fill();
      });
    });
  }

  /**
   * Export high-res artwork PNG
   */
  exportArtwork() {
    window.soundEngine.playSnapshotSound();

    const exp = document.createElement('canvas');
    exp.width = this.drawingCanvas.width;
    exp.height = this.drawingCanvas.height;
    const ctx = exp.getContext('2d');

    // 1. Draw canvas theme background
    if (this.state.canvasTheme === 'dark') {
      ctx.fillStyle = '#12151e';
    } else if (this.state.canvasTheme === 'parchment') {
      ctx.fillStyle = '#fbf7ee';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(0, 0, exp.width, exp.height);

    // 2. Draw uploaded backdrop image if present
    if (this.state.backgroundImage) {
      ctx.globalAlpha = this.state.imageOpacity;
      ctx.drawImage(this.imageCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    }

    // 3. Draw permanent drawing strokes
    ctx.drawImage(this.drawingCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = `whiteboard_artwork_${Date.now()}.png`;
    link.href = exp.toDataURL('image/png');
    link.click();

    this.showToast('💾 Artwork exported as PNG!');
  }

  startParticleLoop() {
    const loop = () => {
      window.brushEngine.updateAndRenderParticles(this.fxCtx);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.airStudio = new AirStudioApp();
});
