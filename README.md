# 🎨 LUMINA WHITEBOARD STUDIO: Apple-Grade Air Painting & Gesture Canvas

An ultra-smooth, premium digital whiteboard studio powered by real-time Computer Vision and MediaPipe Hand Tracking. Paint fluid ink strokes, erase with natural two-finger sweeps, stretch geometric shapes interactively using **both hands in thin air**, trace uploaded photographs with adjustable opacity, and wipe the entire board with a closed fist — zero touch, zero mouse, zero keyboard required.

---

## 🌟 Highlights & Major Features

### 1. 📋 Apple Freeform-Inspired Whiteboard Studio
- **Pure Digital Canvas:** Replaced the full-screen camera background with an Apple-grade, high-DPI digital whiteboard canvas.
- **5 Premium Canvas Themes:**
  - 📄 **Pure Canvas:** Clean, distraction-free white studio.
  - 📐 **Dot Grid:** Subtle engineering dots for precision sketching.
  - 📏 **Architect Grid:** Crisp geometric drafting grid.
  - 🌑 **Dark Slate:** OLED-deep studio backdrop that makes colors pop.
  - 📜 **Warm Parchment:** Soft organic paper texture.
- **Corner FaceTime-Style PiP Webcam:** High-definition miniature camera monitor pinned neatly to the bottom-right corner with live landmark diagnostics, expandable or minimizable with a single tap.

### 2. 🖼️ Image Upload & Tracing Studio
- **Upload Any Reference Photo:** Click or drag-and-drop your own sketches, photos, or diagrams directly onto the board.
- **Preset Masterpieces:** Includes built-in tracing templates (**Monarch Butterfly**, **Sacred Mandala**, and **Sports Car Outline**).
- **Smooth Opacity & Scale Slider:** Adjust the reference image transparency from 0% to 100% so you can effortlessly trace outlines in thin air, sketch over photos, or annotate architectural blueprints.

### 3. 🖐️ Natural Dual-Hand & Finger Gesture Architecture
- **☝️ 1 Finger (Index Tip): Smooth Drawing**
  - Draw natural strokes with Apple Pencil-like fluidity, Gaussian neon glow, translucent highlighter marker, or velocity-sensitive ribbon calligraphy.
- **✌️ 2 Fingers (Index + Middle Spread): Precision Eraser**
  - Raise both fingers to switch instantly to an organic circular eraser. Sweep over any strokes to cleanly scrub them away without leaving gaps.
- **👐 2 Hands (Dual-Hand Detection): Dynamic Shape Stretching**
  - Bring both hands into the camera view.
  - The left hand and right hand index fingertips become dynamic vector anchors!
  - **Square / Rectangle ⬜**: Stretch opposite corners between your hands.
  - **Circle / Ellipse ⭕**: Stretch diameter and radius between your hands.
  - **Equilateral Triangle 🔺**: Forms dynamic base and apex anchored between your two hands.
  - **Laser Line 📏**: Perfectly straight vector line connected between your index fingers.
  - **Placement**: Simply hold both hands steady for 600ms (watch the glowing magnetic lock ring fill) to stamp the shape into place, or pinch to drop instantly.
- **✊ Closed Fist: Instant Screen Wipe**
  - Close your hand into a tight fist.
  - A circular Apple glass countdown HUD appears (`0.8s hold`).
  - Keep the fist closed to clear the entire whiteboard clean with a smooth sparkle dispersal.
- **🧠 AI Smart Shape Recognition (Auto-Snap):**
  - When enabled, freehand rough sketches (e.g., drawing a loose circle, triangle, or quadrilateral with 1 finger) are automatically recognized by the geometry engine and snapped into pristine, perfect mathematical shapes!

### 4. 🎛️ Apple Glass Island Floating Toolbar
- Floating top control bar crafted with macOS glassmorphism, blur effects, and high-contrast iconography.
- Complete feature accessibility: Pen, Highlighter, Neon Glow, Calligraphy, Eraser, 2-Hand Shape Mode, Color Swatches, Stroke Weight, Undo/Redo, Clear, and Image Tracing dock.
- Non-intrusive layout designed specifically so no menu overlays or obscures the drawing workspace.

### 5. 📖 Interactive Onboarding Guidelines Modal
- Automatically welcomes users on their first launch with an Apple-style interactive tutorial showcasing animated cards for every gesture.
- Re-openable at any time by clicking the **"Gestures Guide (?)"** button in the top navigation island.

---

## 🚀 Quick Launch

### 🌐 Web Studio (Recommended)
1. **Via Batch Launcher:**
   Double-click `run_web.bat` inside the `air_painting/` directory.
2. **Via Command Line:**
   ```bash
   # From the workspace root:
   node server.js
   ```
   Open your browser at:
   **`http://localhost:3000/air_painting/index.html`**
3. Grant camera permissions when prompted. The onboarding guide modal will open automatically.

### 🐍 Desktop Python OpenCV Studio
For offline desktop use with OpenCV:
1. Double-click `run_python.bat` or run:
   ```bash
   python air_painter.py
   ```
2. Supports multi-hand tracking (`max_num_hands=2`), 1-finger draw, 2-finger eraser, 2-hand interactive shape stretching, and closed fist canvas wipes.

---

## 🖐️ Master Gesture Reference

| Hand Pose | Mode | Action & Description |
|-----------|------|----------------------|
| **☝️ 1 Finger Up (Index)** | **Pure Line Drawing** | Freehand fluid ink drawing (Pen, Highlighter, Neon, Calligraphy) — strictly lines, zero shape popups! |
| **✌️ 2 Fingers Up (Peace)** | **Continuous Eraser** | Smooth, continuous virtual eraser that scrubs away drawn ink with zero gaps! |
| **👐 2 Hands Up (Dual Index)** | **Dual Index Shape Sculptor** | Both index pointers track live with dotted lines. Bring pointers together to close, or hold steady to place the shape! |
| **✊ Closed Fist** | **Wipe Board** | Hold for 0.8s countdown to wipe all drawings from the whiteboard clean. |
| **🖐️ Open Palm** | **Hover / Reposition** | Move hand across screen without drawing or altering canvas. |
| **🤏 Pinch (Thumb + Index)** | **Touchless Click** | Instant tap on menu buttons or commit items. |

---

## 📁 Project Structure

```
air_painting/
├── index.html            # Apple-inspired Whiteboard HTML5 interface
├── css/
│   └── style.css         # Apple Glass design system, responsive layouts & typography
├── js/
│   ├── app.js            # Coordinator: multi-canvas rendering, camera pipeline & UI
│   ├── gestures.js       # MediaPipe dual-hand gesture engine & state machine
│   └── brushes.js        # Natural ink engine, 2-finger eraser & 2-hand shape generator
├── air_painter.py        # Desktop Python OpenCV edition with 2-hand tracking
├── run_web.bat           # One-click Windows launcher for Web Studio
├── run_python.bat        # One-click Windows launcher for Python Desktop Studio
└── README.md             # Studio documentation and gesture user manual
```

---

## 💡 Lighting & Tracking Optimization

- **Distance:** Sit or stand approximately **40 cm to 80 cm (1.5 - 2.5 feet)** from your webcam.
- **Lighting:** Warm, front-facing ambient light works best. Avoid intense backlight directly behind you.
- **Framing:** Ensure both hands can enter the camera frame comfortably when using 2-Hand Shape mode.
