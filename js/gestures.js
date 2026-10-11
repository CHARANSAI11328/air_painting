/**
 * ============================================================================
 * NEON AIR STUDIO - Computer Vision Hand Gesture & Dual-Hand Tracking Engine
 * Supports 1-Hand (1-Finger Draw, 2-Finger Erase, Closed Fist Clear) &
 * 2-Hands (Dual-Hand Dynamic Shape Stretching for Squares, Circles, Triangles)
 * ============================================================================
 */

class GestureEngine {
  constructor() {
    // Landmark Indices
    this.WRIST = 0;
    this.THUMB_CMC = 1;
    this.THUMB_MCP = 2;
    this.THUMB_IP = 3;
    this.THUMB_TIP = 4;

    this.INDEX_MCP = 5;
    this.INDEX_PIP = 6;
    this.INDEX_DIP = 7;
    this.INDEX_TIP = 8;

    this.MIDDLE_MCP = 9;
    this.MIDDLE_PIP = 10;
    this.MIDDLE_DIP = 11;
    this.MIDDLE_TIP = 12;

    this.RING_MCP = 13;
    this.RING_PIP = 14;
    this.RING_DIP = 15;
    this.RING_TIP = 16;

    this.PINKY_MCP = 17;
    this.PINKY_PIP = 18;
    this.PINKY_DIP = 19;
    this.PINKY_TIP = 20;

    // Coordinate smoothing buffers (per hand)
    this.prevHand1Pos = null;
    this.prevHand2Pos = null;
    this.prevEraserPos = null;

    // Hysteresis & thresholds
    this.pinchThreshold = 0.055;

    // Fist hold-to-clear tracker
    this.fistHoldStartTime = 0;
    this.fistHoldRequired = 900; // ms to clear

    // Dwell tracker for menu buttons
    this.currentDwellTarget = null;
    this.dwellStartTime = 0;
    this.dwellTimeRequired = 700; // ms
    this.lastTickProgress = 0;
  }

  /**
   * Distance between two landmarks (3D or 2D)
   */
  getDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Exponential moving average coordinate smoothing with velocity adaptation
   */
  smoothCoordinate(rawX, rawY, prevPos) {
    if (!prevPos) {
      return { x: rawX, y: rawY };
    }
    const dx = rawX - prevPos.x;
    const dy = rawY - prevPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Adaptive alpha: fast movements stay snappy, micro-movements are stabilized
    let alpha = 0.45;
    if (dist > 0.08) alpha = 0.8;
    else if (dist < 0.015) alpha = 0.28;

    return {
      x: alpha * rawX + (1 - alpha) * prevPos.x,
      y: alpha * rawY + (1 - alpha) * prevPos.y
    };
  }

  /**
   * Determines extended state for each finger of a hand (orientation-invariant)
   */
  getFingerStates(landmarks) {
    const wrist = landmarks[this.WRIST];

    // Distance from wrist to tips vs PIP joints
    const indexTipDist = this.getDistance(landmarks[this.INDEX_TIP], wrist);
    const indexPipDist = this.getDistance(landmarks[this.INDEX_PIP], wrist);
    const indexExtended = (landmarks[this.INDEX_TIP].y < landmarks[this.INDEX_PIP].y) ||
                          (indexTipDist > indexPipDist * 1.14);

    const middleTipDist = this.getDistance(landmarks[this.MIDDLE_TIP], wrist);
    const middlePipDist = this.getDistance(landmarks[this.MIDDLE_PIP], wrist);
    const middleExtended = (landmarks[this.MIDDLE_TIP].y < landmarks[this.MIDDLE_PIP].y) ||
                           (middleTipDist > middlePipDist * 1.14);

    const ringTipDist = this.getDistance(landmarks[this.RING_TIP], wrist);
    const ringPipDist = this.getDistance(landmarks[this.RING_PIP], wrist);
    const ringExtended = (landmarks[this.RING_TIP].y < landmarks[this.RING_PIP].y) &&
                         (ringTipDist > ringPipDist * 1.12);

    const pinkyTipDist = this.getDistance(landmarks[this.PINKY_TIP], wrist);
    const pinkyPipDist = this.getDistance(landmarks[this.PINKY_PIP], wrist);
    const pinkyExtended = (landmarks[this.PINKY_TIP].y < landmarks[this.PINKY_PIP].y) &&
                          (pinkyTipDist > pinkyPipDist * 1.12);

    // Thumb: Outstretched compared to pinky base
    const thumbDistPinky = this.getDistance(landmarks[this.THUMB_TIP], landmarks[this.PINKY_MCP]);
    const thumbIpDistPinky = this.getDistance(landmarks[this.THUMB_IP], landmarks[this.PINKY_MCP]);
    const thumbExtended = thumbDistPinky > thumbIpDistPinky * 1.18;

    return {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      pinky: pinkyExtended
    };
  }

  /**
   * Master classification for 1 or 2 hands detected by MediaPipe
   */
  classifyMultiHands(multiLandmarks) {
    if (!multiLandmarks || multiLandmarks.length === 0) {
      this.resetTracking();
      return {
        type: 'NO_HANDS',
        mode: 'NO_HANDS',
        name: 'Show Hand to Camera',
        icon: '👋',
        handsCount: 0
      };
    }

    // =========================================================================
    // CASE A: DUAL HANDS DETECTED (👐 Two-Hand Dual Index Drawing Engine)
    // =========================================================================
    if (multiLandmarks.length >= 2) {
      const hand1 = multiLandmarks[0];
      const hand2 = multiLandmarks[1];

      // Raw index tips for both hands (mirrored X)
      const rawH1 = { x: 1 - hand1[this.INDEX_TIP].x, y: hand1[this.INDEX_TIP].y };
      const rawH2 = { x: 1 - hand2[this.INDEX_TIP].x, y: hand2[this.INDEX_TIP].y };

      // Sort consistently so left pointer is always left-most, right is right-most
      const leftRaw = rawH1.x <= rawH2.x ? rawH1 : rawH2;
      const rightRaw = rawH1.x <= rawH2.x ? rawH2 : rawH1;

      const smoothH1 = this.smoothCoordinate(leftRaw.x, leftRaw.y, this.prevHand1Pos);
      const smoothH2 = this.smoothCoordinate(rightRaw.x, rightRaw.y, this.prevHand2Pos);

      this.prevHand1Pos = smoothH1;
      this.prevHand2Pos = smoothH2;

      // Distance and bounding box between the two hands
      const dx = smoothH2.x - smoothH1.x;
      const dy = smoothH2.y - smoothH1.y;
      const span = Math.hypot(dx, dy);

      const midX = (smoothH1.x + smoothH2.x) / 2;
      const midY = (smoothH1.y + smoothH2.y) / 2;

      return {
        type: 'DUAL_HANDS',
        mode: 'DUAL_HANDS',
        name: '2 Hands: Dual Index Drawing',
        icon: '👐',
        handsCount: 2,
        p1: smoothH1, // Left index pointer
        p2: smoothH2, // Right index pointer
        hand1: smoothH1,
        hand2: smoothH2,
        center: { x: midX, y: midY },
        span: span,
        bbox: {
          x1: Math.min(smoothH1.x, smoothH2.x),
          y1: Math.min(smoothH1.y, smoothH2.y),
          x2: Math.max(smoothH1.x, smoothH2.x),
          y2: Math.max(smoothH1.y, smoothH2.y)
        }
      };
    }

    // =========================================================================
    // CASE B: SINGLE HAND DETECTED (☝️ 1 Finger Draw, ✌️ 2 Finger Erase, ✊ Fist Wipe)
    // =========================================================================
    const landmarks = multiLandmarks[0];
    const fingers = this.getFingerStates(landmarks);
    const indexTip = landmarks[this.INDEX_TIP];
    const middleTip = landmarks[this.MIDDLE_TIP];
    const thumbTip = landmarks[this.THUMB_TIP];

    // Mirrored index coordinate
    const rawIndex = { x: 1 - indexTip.x, y: indexTip.y };
    const smoothedIndex = this.smoothCoordinate(rawIndex.x, rawIndex.y, this.prevHand1Pos);
    this.prevHand1Pos = smoothedIndex;

    const pinchDist = this.getDistance(thumbTip, indexTip);
    const isPinching = pinchDist < this.pinchThreshold;

    const extendedCount = (fingers.thumb ? 1 : 0) +
                          (fingers.index ? 1 : 0) +
                          (fingers.middle ? 1 : 0) +
                          (fingers.ring ? 1 : 0) +
                          (fingers.pinky ? 1 : 0);

    // 1. CLOSED FIST (✊ 0 Extended) -> Hold to Wipe Canvas
    if (extendedCount === 0 || (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky)) {
      return {
        type: 'SINGLE_HAND',
        mode: 'CLOSED_FIST',
        name: 'Closed Fist: Hold to Wipe Canvas',
        icon: '✊',
        pointer: smoothedIndex,
        handsCount: 1,
        fingers
      };
    }

    // 2. TWO FINGERS EXTENDED (✌️ Index + Middle, Ring & Pinky down) -> ERASER MODE
    if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
      // Calculate midpoint between index tip and middle tip for eraser center
      const rawEraserX = 1 - (indexTip.x + middleTip.x) / 2;
      const rawEraserY = (indexTip.y + middleTip.y) / 2;
      const smoothedEraser = this.smoothCoordinate(rawEraserX, rawEraserY, this.prevEraserPos);
      this.prevEraserPos = smoothedEraser;

      // Distance between two fingers can modulate eraser radius
      const fingerSpread = this.getDistance(indexTip, middleTip);

      return {
        type: 'SINGLE_HAND',
        mode: 'ERASER',
        name: '2 Fingers: Virtual Eraser',
        icon: '✌️',
        pointer: smoothedEraser,
        fingerSpread: fingerSpread,
        handsCount: 1,
        fingers
      };
    }

    // 3. SINGLE FINGER EXTENDED (☝️ Index Only) -> DRAWING MODE
    if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
      return {
        type: 'SINGLE_HAND',
        mode: 'DRAWING',
        name: '1 Finger: Drawing Line',
        icon: '☝️',
        pointer: smoothedIndex,
        isPinching: isPinching,
        handsCount: 1,
        fingers
      };
    }

    // 4. OPEN PALM (🖐️ 4 or 5 Fingers) -> HOVER / STANDBY
    if (extendedCount >= 4) {
      return {
        type: 'SINGLE_HAND',
        mode: 'HOVER',
        name: 'Open Palm: Standby',
        icon: '🖐️',
        pointer: smoothedIndex,
        handsCount: 1,
        fingers
      };
    }

    // Default to Pointer / Hover
    return {
      type: 'SINGLE_HAND',
      mode: 'HOVER',
      name: 'Hover Pointer',
      icon: '👆',
      pointer: smoothedIndex,
      handsCount: 1,
      fingers
    };
  }

  /**
   * Tracks dwell progress when fingertip hovers over UI buttons
   */
  processDwell(pointerScreenX, pointerScreenY, interactiveElements) {
    if (!pointerScreenX || !pointerScreenY || !interactiveElements) {
      this.resetDwell();
      return { isTriggered: false, progress: 0, target: null };
    }

    let hoveredElement = null;
    for (const el of interactiveElements) {
      const rect = el.getBoundingClientRect();
      if (
        pointerScreenX >= rect.left &&
        pointerScreenX <= rect.right &&
        pointerScreenY >= rect.top &&
        pointerScreenY <= rect.bottom
      ) {
        hoveredElement = el;
        break;
      }
    }

    const now = performance.now();

    if (hoveredElement) {
      if (this.currentDwellTarget !== hoveredElement) {
        this.currentDwellTarget = hoveredElement;
        this.dwellStartTime = now;
        this.lastTickProgress = 0;
      }

      const elapsed = now - this.dwellStartTime;
      const progress = Math.min(1, elapsed / this.dwellTimeRequired);

      if (progress > this.lastTickProgress + 0.3) {
        this.lastTickProgress = progress;
        if (window.soundEngine) {
          window.soundEngine.playDwellTick(progress);
        }
      }

      if (progress >= 1) {
        this.resetDwell();
        return { isTriggered: true, progress: 1, target: hoveredElement };
      }

      return { isTriggered: false, progress, target: hoveredElement };
    } else {
      this.resetDwell();
      return { isTriggered: false, progress: 0, target: null };
    }
  }

  resetDwell() {
    this.currentDwellTarget = null;
    this.dwellStartTime = 0;
    this.lastTickProgress = 0;
  }

  resetTracking() {
    this.prevHand1Pos = null;
    this.prevHand2Pos = null;
    this.prevEraserPos = null;
    this.resetDwell();
  }
}

// Global gesture engine singleton
window.gestureEngine = new GestureEngine();
