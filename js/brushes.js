/**
 * ============================================================================
 * NEON AIR STUDIO - Creative Brush & Multi-Hand Geometric Shape Engine
 * Apple-grade smoothing, natural ink pencils, highlighters, 2-finger eraser,
 * and 2-hand dynamic shape generators (Rectangle, Circle, Triangle, Line).
 * ============================================================================
 */

class BrushEngine {
  constructor() {
    this.particles = [];
    this.rainbowHue = 0;
    this.lastPoint = null;
    this.shapeStartPoint = null;
  }

  beginStroke(x, y) {
    this.lastPoint = { x, y, time: performance.now() };
    this.shapeStartPoint = { x, y };
  }

  endStroke() {
    this.lastPoint = null;
    this.shapeStartPoint = null;
  }

  /**
   * Continuous freehand stroke dispatcher with Apple-level line rendering
   */
  drawFreehandSegment(ctx, fxCtx, from, to, style, color, size) {
    if (!from || !to) return;

    let strokeColor = color;
    if (color === 'rainbow') {
      this.rainbowHue = (this.rainbowHue + 2.5) % 360;
      strokeColor = `hsl(${this.rainbowHue}, 95%, 50%)`;
    }

    ctx.save();

    switch (style) {
      case 'pencil':
        this.renderPencilStroke(ctx, from, to, strokeColor, size);
        break;

      case 'highlighter':
        this.renderHighlighterStroke(ctx, from, to, strokeColor, size * 2.2);
        break;

      case 'neon':
        this.renderNeonStroke(ctx, from, to, strokeColor, size);
        break;

      case 'calligraphy':
        this.renderCalligraphyStroke(ctx, from, to, strokeColor, size);
        break;

      case 'sparkle':
        this.renderSparkleStroke(ctx, fxCtx, from, to, strokeColor, size);
        break;

      case 'eraser':
        this.renderEraserStroke(ctx, from, to, size * 2.5);
        break;

      default:
        this.renderPencilStroke(ctx, from, to, strokeColor, size);
        break;
    }

    ctx.restore();
    this.lastPoint = { ...to, time: performance.now() };
  }

  /**
   * Apple-style natural ink pencil (crisp, anti-aliased, rounded caps)
   */
  renderPencilStroke(ctx, p1, p2, color, size) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.globalAlpha = 0.95;

    // Subtle drop blur for premium ink feel
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 2;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  /**
   * Translucent highlighter marker
   */
  renderHighlighterStroke(ctx, p1, p2, color, size) {
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.globalAlpha = 0.32;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  /**
   * Vibrant Neon Glow (multi-pass bloom)
   */
  renderNeonStroke(ctx, p1, p2, color, size) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer glow aura
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 2.2;
    ctx.globalAlpha = 0.28;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2.4;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Medium glow
    ctx.lineWidth = size * 1.2;
    ctx.globalAlpha = 0.65;
    ctx.shadowBlur = size * 1.2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // White core line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.35);
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  /**
   * Dynamic Calligraphy Ribbon
   */
  renderCalligraphyStroke(ctx, p1, p2, color, size) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(1, (p2.time || performance.now()) - (p1.time || performance.now()));
    const speed = dist / dt;

    const angle = Math.atan2(dy, dx);
    const angleMod = Math.abs(Math.sin(angle - Math.PI / 4)) * 0.8 + 0.35;
    const dynamicWidth = Math.max(2, size * (1.6 - Math.min(1.0, speed * 0.7)) * angleMod);

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = color;
    ctx.lineWidth = dynamicWidth;
    ctx.globalAlpha = 0.92;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  /**
   * Stardust Twinkle Sparkle
   */
  renderSparkleStroke(ctx, fxCtx, p1, p2, color, size) {
    this.renderPencilStroke(ctx, p1, p2, color, size);

    if (fxCtx) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const count = Math.max(1, Math.floor(dist / 8));

      for (let i = 0; i < count; i++) {
        const t = Math.random();
        this.particles.push({
          x: p1.x + dx * t + (Math.random() - 0.5) * size * 2,
          y: p1.y + dy * t + (Math.random() - 0.5) * size * 2,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.5,
          color: color,
          size: Math.random() * size + 3,
          alpha: 1.0,
          decay: 0.025,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: 0.1
        });
      }
    }
  }

  /**
   * Eraser: Clean stroke removal
   */
  renderEraserStroke(ctx, p1, p2, size) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Continuous 2-Finger Virtual Eraser
   * Erases all strokes along the sweep path between p1 and p2 with zero gaps
   */
  eraseSegment(ctx, p1, p2, radius) {
    if (!ctx || !p2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (p1 && (p1.x !== p2.x || p1.y !== p2.y)) {
      ctx.lineWidth = radius * 2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(p2.x, p2.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 2-Finger Virtual Eraser Stamp / Sweep
   * Erases all strokes in a circular area at position (x, y)
   */
  eraseAtPoint(ctx, x, y, radius) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Dual-Hand Live Dotted Preview:
   * Tracks and renders both index finger trajectories, top/bottom connections,
   * fingertip badges, and magnetic meeting snap glow
   */
  renderTwoHandPreview(ctx, path1, path2, startP1, startP2, currentP1, currentP2, color, size, isMeetingSnap = false) {
    if (!ctx || !currentP1 || !currentP2) return;

    const strokeColor = color === 'rainbow' ? '#0071e3' : color;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(3, size);
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 12;

    // 1. Draw Left Hand Path (path1)
    if (path1 && path1.length > 1) {
      ctx.beginPath();
      ctx.moveTo(path1[0].x, path1[0].y);
      for (let i = 1; i < path1.length; i++) {
        ctx.lineTo(path1[i].x, path1[i].y);
      }
      ctx.stroke();
    }

    // 2. Draw Right Hand Path (path2)
    if (path2 && path2.length > 1) {
      ctx.beginPath();
      ctx.moveTo(path2[0].x, path2[0].y);
      for (let i = 1; i < path2.length; i++) {
        ctx.lineTo(path2[i].x, path2[i].y);
      }
      ctx.stroke();
    }

    // 3. Connect Start Points (Top Edge)
    if (startP1 && startP2) {
      ctx.beginPath();
      ctx.moveTo(startP1.x, startP1.y);
      ctx.lineTo(startP2.x, startP2.y);
      ctx.stroke();
    }

    // 4. Connect Current Fingertips (Bottom Edge)
    ctx.beginPath();
    ctx.moveTo(currentP1.x, currentP1.y);
    ctx.lineTo(currentP2.x, currentP2.y);
    ctx.stroke();

    // 5. Draw Fingertip Rings
    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;

    // Left Index Ring
    ctx.beginPath();
    ctx.arc(currentP1.x, currentP1.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(0, 243, 255, 0.25)';
    ctx.fill();
    ctx.stroke();

    // Right Index Ring
    ctx.beginPath();
    ctx.arc(currentP2.x, currentP2.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.fill();
    ctx.stroke();

    // 6. Magnetic Meeting Aura if fingers are closing together
    if (isMeetingSnap) {
      const midX = (currentP1.x + currentP2.x) / 2;
      const midY = (currentP1.y + currentP2.y) / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 26, 0, Math.PI * 2);
      ctx.strokeStyle = '#34c759';
      ctx.lineWidth = 3.5;
      ctx.fillStyle = 'rgba(52, 199, 89, 0.35)';
      ctx.shadowColor = '#34c759';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Commits the finalized shape sculpted by both hands onto the drawing canvas
   */
  commitTwoHandShape(ctx, path1, path2, startP1, startP2, endP1, endP2, didMeet, color, size, brushStyle) {
    if (!ctx) return;

    const strokeColor = color === 'rainbow' ? '#0071e3' : color;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(3, size);
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 4;

    ctx.beginPath();

    if (didMeet) {
      // Fingers met at bottom: Closed polygon formed by path1 and reversed path2
      if (path1 && path1.length > 0) {
        ctx.moveTo(path1[0].x, path1[0].y);
        for (let i = 1; i < path1.length; i++) {
          ctx.lineTo(path1[i].x, path1[i].y);
        }
      } else {
        ctx.moveTo(startP1.x, startP1.y);
        ctx.lineTo(endP1.x, endP1.y);
      }

      // Connect to meet point
      ctx.lineTo(endP2.x, endP2.y);

      // Trace back up along path2 in reverse
      if (path2 && path2.length > 0) {
        for (let i = path2.length - 1; i >= 0; i--) {
          ctx.lineTo(path2[i].x, path2[i].y);
        }
      } else {
        ctx.lineTo(startP2.x, startP2.y);
      }

      ctx.closePath();
    } else {
      // Fingers didn't meet: Draw top connecting edge, side paths, and bottom connecting edge
      ctx.moveTo(startP1.x, startP1.y);
      ctx.lineTo(startP2.x, startP2.y);

      if (path2 && path2.length > 0) {
        for (let i = 0; i < path2.length; i++) {
          ctx.lineTo(path2[i].x, path2[i].y);
        }
      } else {
        ctx.lineTo(endP2.x, endP2.y);
      }

      ctx.lineTo(endP1.x, endP1.y);

      if (path1 && path1.length > 0) {
        for (let i = path1.length - 1; i >= 0; i--) {
          ctx.lineTo(path1[i].x, path1[i].y);
        }
      } else {
        ctx.lineTo(startP1.x, startP1.y);
      }

      ctx.closePath();
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Dual-Hand Geometric Shape Renderer:
   * Stretches shapes dynamically between Hand 1 (p1) and Hand 2 (p2)
   */
  renderDualHandShape(ctx, p1, p2, shapeType, color, size, isPreview = false) {
    if (!p1 || !p2) return;

    let strokeColor = color === 'rainbow' ? '#0071e3' : color;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isPreview) {
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(2, size);
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 10;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = size;
      ctx.globalAlpha = 1.0;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 4;
    }

    ctx.beginPath();

    switch (shapeType) {
      case 'rectangle':
      case 'square': {
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        const r = Math.min(16, w / 4, h / 4);
        this.drawRoundedRect(ctx, x, y, w, h, r);
        ctx.stroke();
        break;
      }

      case 'circle': {
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const radius = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
        ctx.arc(cx, cy, Math.max(10, radius), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'triangle': {
        // Base connects Hand 1 and Hand 2, apex extends symmetrically perpendicular
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const baseLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const height = baseLen * 0.866; // Equilateral height
        const apexY = Math.min(p1.y, p2.y) - height * 0.6;

        ctx.moveTo(midX, apexY);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.closePath();
        ctx.stroke();
        break;
      }

      case 'line': {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        break;
      }

      default: {
        // Default to rectangle
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x);
        const h = Math.abs(p2.y - p1.y);
        this.drawRoundedRect(ctx, x, y, w, h, 14);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
  }

  /**
   * Smart Doodle Shape Recognizer (AI Geometric Snapping)
   */
  detectDoodleShape(points) {
    if (!points || points.length < 12) return null;

    const n = points.length;
    const pStart = points[0];
    const pEnd = points[n - 1];

    let pathLength = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < n; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;

      if (i > 0) {
        pathLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const straightDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

    // 1. Straight Line (high path linearity)
    if (pathLength > 60 && straightDist / pathLength > 0.88) {
      return {
        shape: 'line',
        p1: pStart,
        p2: pEnd
      };
    }

    // 2. Closed Loop: Circle or Rectangle
    const isClosed = straightDist < pathLength * 0.28 || straightDist < 65;

    if (isClosed && width > 40 && height > 40) {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const avgR = (width + height) / 4;

      let varianceSum = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(points[i].x - cx, points[i].y - cy);
        varianceSum += Math.abs(d - avgR);
      }
      const avgVarianceRatio = varianceSum / (n * avgR);

      if (avgVarianceRatio < 0.26) {
        return {
          shape: 'circle',
          p1: { x: cx - avgR, y: cy - avgR },
          p2: { x: cx + avgR, y: cy + avgR }
        };
      }

      // 3. Rectangle / Square
      const aspect = Math.min(width, height) / Math.max(width, height);
      if (aspect > 0.5) {
        return {
          shape: 'rectangle',
          p1: { x: minX, y: minY },
          p2: { x: maxX, y: maxY }
        };
      }
    }

    return null;
  }

  /**
   * Particle FX Animation Loop
   */
  updateAndRenderParticles(fxCtx) {
    if (!fxCtx) return;
    fxCtx.clearRect(0, 0, fxCtx.canvas.width, fxCtx.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      fxCtx.save();
      fxCtx.translate(p.x, p.y);
      fxCtx.globalAlpha = p.alpha;
      fxCtx.fillStyle = p.color;
      fxCtx.beginPath();
      fxCtx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.restore();
    }
  }
}

// Global brush engine singleton
window.brushEngine = new BrushEngine();
