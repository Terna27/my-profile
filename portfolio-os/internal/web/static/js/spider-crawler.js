/**
 * Procedural Spider Web Crawler Overlay
 * Realistic 3-bone/2-bone Inverse Kinematics (IK), DOM Foothold Snapping,
 * Multi-Chromatic Bright Neon Aesthetics, Trailing Silk Web Physics,
 * Scroll Synchronization & Autonomous Roaming.
 *
 * (c) Terna Peter Portfolio OS
 */

(() => {
  'use strict';

  // Check user preference for reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    console.info('[SpiderCrawler] prefers-reduced-motion is active; crawler paused.');
    return;
  }

  /* ---------------------------------------------------------
     1. Vector & Math Utilities
     --------------------------------------------------------- */
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const angleDiff = (a, b) => {
    let diff = (b - a) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  };

  /* ---------------------------------------------------------
     2. Configuration & Vibrant Multi-Color Neon Palette
     --------------------------------------------------------- */
  // Spider size reduced by 40% (scale = 0.60)
  const SCALE = 0.60;

  const CONFIG = {
    scale: SCALE,
    legCount: 8,
    // Leg segment lengths scaled down by 40%
    femurLen: 24 * SCALE,   // 14.4px
    tibiaLen: 28 * SCALE,   // 16.8px
    tarsusLen: 18 * SCALE,  // 10.8px
    get maxReach() { return this.femurLen + this.tibiaLen + this.tarsusLen - 1.5; },
    // Step triggering
    stepDistanceThreshold: 34 * SCALE, // 20.4px
    stepSpeed: 0.18,
    stepLiftHeight: 18 * SCALE, // 10.8px
    maxVelocity: 5.2,
    dartVelocity: 14.0,
    turnSpeed: 0.15,
    idleTimeoutMs: 3000,
    // Bright Multi-Chromatic Neon Color Palette
    colors: {
      cyan: '#00f5ff',          // Electric Neon Cyan
      magenta: '#ff007f',       // Hot Neon Magenta / Pink
      lime: '#39ff14',          // Electric Neon Lime / Green
      gold: '#ffd600',          // Solar Neon Amber / Gold
      purple: '#bf5af2',        // Electric Violet
      white: '#ffffff',         // Pure Blazing White
      bodyDark: 'rgba(7, 12, 24, 0.92)',
      glowCyan: 'rgba(0, 245, 255, 0.75)',
      glowMagenta: 'rgba(255, 0, 127, 0.85)',
      glowLime: 'rgba(57, 255, 20, 0.85)',
      glowGold: 'rgba(255, 214, 0, 0.75)'
    },
    // Vibrant accent colors assigned across the 8 legs
    legAccents: [
      { primary: '#00f5ff', secondary: '#ff007f', glow: 'rgba(0, 245, 255, 0.7)' },
      { primary: '#ff007f', secondary: '#39ff14', glow: 'rgba(255, 0, 127, 0.7)' },
      { primary: '#39ff14', secondary: '#00f5ff', glow: 'rgba(57, 255, 20, 0.7)' },
      { primary: '#ffd600', secondary: '#ff007f', glow: 'rgba(255, 214, 0, 0.7)' },
      { primary: '#00f5ff', secondary: '#ff007f', glow: 'rgba(0, 245, 255, 0.7)' },
      { primary: '#ff007f', secondary: '#39ff14', glow: 'rgba(255, 0, 127, 0.7)' },
      { primary: '#39ff14', secondary: '#00f5ff', glow: 'rgba(57, 255, 20, 0.7)' },
      { primary: '#ffd600', secondary: '#ff007f', glow: 'rgba(255, 214, 0, 0.7)' }
    ]
  };

  /* ---------------------------------------------------------
     3. DOM Scanner & Spatial Foothold Snapping
     --------------------------------------------------------- */
  class DOMSpatialScanner {
    constructor() {
      this.elements = [];
      this.footholds = []; // Array of { x, y, el, tag, type } in page coordinates
      this.anchoredElements = new Map(); // el => { count, origTransform, origBoxShadow, origBorder, accentColor }
      this.lastScanTime = 0;
      this.selector = [
        'h1', 'h2', 'h3', 'h4', 'a', 'button', 'p', 'span.card-eyebrow',
        'strong', '.card', '.skill-card', '.portrait-frame', '.portrait-card',
        '.project-card', '.badge-card', '.credential-card', '.nav-action-pill',
        '.home-button', '.social-icon', 'code', '.brand-glyph', '.action-pill',
        '.home-intro', '.home-divider', '.workspace-object', 'img'
      ].join(', ');
    }

    scan() {
      const now = performance.now();
      if (now - this.lastScanTime < 500) return; // Prevent layout thrashing
      this.lastScanTime = now;

      const viewportTop = window.scrollY - 300;
      const viewportBottom = window.scrollY + window.innerHeight + 300;
      const viewportLeft = window.scrollX - 100;
      const viewportRight = window.scrollX + window.innerWidth + 100;

      const nodes = document.querySelectorAll(this.selector);
      const newFootholds = [];
      const newElements = [];

      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (el.id === 'spider-crawler-canvas' || el.closest('.spider-hud-widget')) continue;

        // Bounding rect
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const pageX = rect.left + window.scrollX;
        const pageY = rect.top + window.scrollY;

        // Visible within spatial buffer
        if (pageY + rect.height < viewportTop || pageY > viewportBottom) continue;
        if (pageX + rect.width < viewportLeft || pageX > viewportRight) continue;

        newElements.push({ el, rect, pageX, pageY, tag: el.tagName.toLowerCase() });

        // Add edge & corner footholds
        const corners = [
          { x: pageX, y: pageY, type: 'corner-tl' },
          { x: pageX + rect.width, y: pageY, type: 'corner-tr' },
          { x: pageX, y: pageY + rect.height, type: 'corner-bl' },
          { x: pageX + rect.width, y: pageY + rect.height, type: 'corner-br' }
        ];

        // Midpoints on edges
        const edges = [
          { x: pageX + rect.width * 0.5, y: pageY, type: 'edge-top' },
          { x: pageX + rect.width * 0.5, y: pageY + rect.height, type: 'edge-bottom' },
          { x: pageX, y: pageY + rect.height * 0.5, type: 'edge-left' },
          { x: pageX + rect.width, y: pageY + rect.height * 0.5, type: 'edge-right' }
        ];

        for (const pt of [...corners, ...edges]) {
          newFootholds.push({
            x: pt.x,
            y: pt.y,
            el: el,
            tag: el.tagName.toLowerCase(),
            type: pt.type
          });
        }
      }

      this.elements = newElements;
      this.footholds = newFootholds;
    }

    findClosestFoothold(targetX, targetY, maxRadius = 45) {
      let closest = null;
      let minD = maxRadius;

      for (let i = 0; i < this.footholds.length; i++) {
        const fh = this.footholds[i];
        const d = dist(targetX, targetY, fh.x, fh.y);
        if (d < minD) {
          minD = d;
          closest = fh;
        }
      }

      return closest;
    }

    getRandomInterestingElement() {
      if (!this.elements.length) return null;
      const preferred = this.elements.filter(e => 
        ['h1', 'h2', 'h3', 'a', 'button'].includes(e.tag) || e.el.classList.contains('card') || e.el.classList.contains('skill-card')
      );
      const pool = preferred.length > 0 ? preferred : this.elements;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    applyAnchor(el, spiderX, spiderY, legIndex = 0) {
      if (!el || !el.getBoundingClientRect) return;
      let entry = this.anchoredElements.get(el);
      if (!entry) {
        entry = {
          count: 0,
          origTransform: el.style.transform || '',
          origBoxShadow: el.style.boxShadow || '',
          origBorderColor: el.style.borderColor || '',
          accentColor: CONFIG.legAccents[legIndex % CONFIG.legAccents.length].primary
        };
        this.anchoredElements.set(el, entry);
        el.classList.add('spider-anchored');
      }
      entry.count++;

      // Vibrant bright neon colors when legs touch down on elements
      const brightGlow = entry.accentColor === '#ff007f'
        ? '0 0 20px rgba(255, 0, 127, 0.85), 0 0 35px rgba(0, 245, 255, 0.6)'
        : entry.accentColor === '#39ff14'
        ? '0 0 20px rgba(57, 255, 20, 0.85), 0 0 35px rgba(255, 0, 127, 0.5)'
        : '0 0 20px rgba(0, 245, 255, 0.85), 0 0 35px rgba(255, 0, 127, 0.6)';

      el.style.borderColor = entry.accentColor;
      el.style.boxShadow = brightGlow;

      // Subtle reactive displacement towards spider
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + window.scrollX + rect.width * 0.5;
      const centerY = rect.top + window.scrollY + rect.height * 0.5;
      const dx = clamp((spiderX - centerX) * 0.025, -3, 3);
      const dy = clamp((spiderY - centerY) * 0.025, -3, 3);

      el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(0.995)`;
    }

    releaseAnchor(el) {
      if (!el) return;
      const entry = this.anchoredElements.get(el);
      if (!entry) return;
      entry.count--;
      if (entry.count <= 0) {
        el.classList.remove('spider-anchored');
        el.style.transform = entry.origTransform;
        el.style.boxShadow = entry.origBoxShadow;
        el.style.borderColor = entry.origBorderColor;
        this.anchoredElements.delete(el);
      }
    }

    clearAllAnchors() {
      for (const [el, entry] of this.anchoredElements.entries()) {
        el.classList.remove('spider-anchored');
        el.style.transform = entry.origTransform;
        el.style.boxShadow = entry.origBoxShadow;
        el.style.borderColor = entry.origBorderColor;
      }
      this.anchoredElements.clear();
    }
  }

  /* ---------------------------------------------------------
     4. Multi-Color Silk Web Rope Simulator (Verlet Physics)
     --------------------------------------------------------- */
  class SilkWebTrail {
    constructor() {
      this.points = [];
      this.maxNodes = 20;
      this.segmentLength = 16 * SCALE;
      this.activeRappelling = false;
      this.grappleLine = null;
    }

    addAnchor(x, y) {
      if (this.points.length === 0) {
        this.points.push({ x, y, oldX: x, oldY: y, pinned: true });
        return;
      }

      const last = this.points[this.points.length - 1];
      const d = dist(last.x, last.y, x, y);
      if (d > 20 * SCALE) {
        this.points.push({ x, y, oldX: x, oldY: y, pinned: false });
        if (this.points.length > this.maxNodes) {
          this.points.shift();
        }
      }
    }

    shootGrapple(fromX, fromY, toX, toY) {
      this.grappleLine = {
        fromX,
        fromY,
        toX,
        toY,
        progress: 0,
        active: true
      };
    }

    update(spinneretX, spinneretY) {
      if (this.points.length > 0) {
        const head = this.points[this.points.length - 1];
        head.x = spinneretX;
        head.y = spinneretY;
      } else {
        this.points.push({ x: spinneretX, y: spinneretY, oldX: spinneretX, oldY: spinneretY, pinned: true });
      }

      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        if (pt.pinned) continue;

        const vx = (pt.x - pt.oldX) * 0.92;
        const vy = (pt.y - pt.oldY) * 0.92 + 0.10;

        pt.oldX = pt.x;
        pt.oldY = pt.y;
        pt.x += vx;
        pt.y += vy;
      }

      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < this.points.length - 1; i++) {
          const p1 = this.points[i];
          const p2 = this.points[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const diff = (d - this.segmentLength) / d;

          if (!p1.pinned && !p2.pinned) {
            p1.x += dx * 0.5 * diff;
            p1.y += dy * 0.5 * diff;
            p2.x -= dx * 0.5 * diff;
            p2.y -= dy * 0.5 * diff;
          } else if (!p1.pinned) {
            p1.x += dx * diff;
            p1.y += dy * diff;
          } else if (!p2.pinned) {
            p2.x -= dx * diff;
            p2.y -= dy * diff;
          }
        }
      }

      if (this.grappleLine && this.grappleLine.active) {
        this.grappleLine.progress += 0.16;
        if (this.grappleLine.progress >= 1.0) {
          this.grappleLine.progress = 1.0;
        }
      }
    }

    render(ctx, scrollX, scrollY) {
      if (this.points.length < 2) return;

      ctx.save();
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const firstX = this.points[0].x - scrollX;
      const firstY = this.points[0].y - scrollY;
      ctx.moveTo(firstX, firstY);

      for (let i = 1; i < this.points.length; i++) {
        const px = this.points[i].x - scrollX;
        const py = this.points[i].y - scrollY;
        ctx.lineTo(px, py);
      }

      // Bright multi-color gradient silk
      const grad = ctx.createLinearGradient(
        firstX, firstY,
        this.points[this.points.length - 1].x - scrollX,
        this.points[this.points.length - 1].y - scrollY
      );
      grad.addColorStop(0, 'rgba(255, 0, 127, 0.08)');
      grad.addColorStop(0.4, 'rgba(0, 245, 255, 0.55)');
      grad.addColorStop(0.8, 'rgba(57, 255, 20, 0.75)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');

      ctx.strokeStyle = grad;
      ctx.shadowColor = CONFIG.colors.glowCyan;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Grapple zip line
      if (this.grappleLine && this.grappleLine.active) {
        const g = this.grappleLine;
        const curX = lerp(g.fromX, g.toX, g.progress) - scrollX;
        const curY = lerp(g.fromY, g.toY, g.progress) - scrollY;

        ctx.beginPath();
        ctx.moveTo(g.fromX - scrollX, g.fromY - scrollY);
        ctx.lineTo(curX, curY);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = CONFIG.colors.magenta;
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(curX, curY, 3, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.colors.magenta;
        ctx.shadowColor = CONFIG.colors.glowMagenta;
        ctx.shadowBlur = 8;
        ctx.fill();

        if (g.progress >= 0.7) {
          const destX = g.toX - scrollX;
          const destY = g.toY - scrollY;
          ctx.beginPath();
          ctx.arc(destX, destY, 7 + (1.0 - g.progress) * 16, 0, Math.PI * 2);
          ctx.strokeStyle = CONFIG.colors.cyan;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     5. Multi-Color Spider Leg & 3-Joint Inverse Kinematics
     --------------------------------------------------------- */
  class SpiderLeg {
    constructor(index, side, angleOffset, reachDistance) {
      this.index = index;
      this.side = side; // -1 for Left, 1 for Right
      this.angleOffset = angleOffset;
      this.reachDistance = reachDistance;

      // Group A (0, 2, 5, 7) or Group B (1, 3, 4, 6)
      this.group = [0, 2, 5, 7].includes(index) ? 0 : 1;

      // Current foot position in page coords
      this.footX = 0;
      this.footY = 0;
      this.footZ = 0;

      this.stepStartX = 0;
      this.stepStartY = 0;
      this.stepTargetX = 0;
      this.stepTargetY = 0;
      this.isStepping = false;
      this.stepProgress = 1.0;

      this.anchoredEl = null;
      this.anchorType = 'ground';
      this.anchorTag = '';

      // Joint positions for rendering (computed by IK)
      this.jointCoxa = { x: 0, y: 0 };
      this.jointKnee = { x: 0, y: 0 };
      this.jointAnkle = { x: 0, y: 0 };
      this.jointTip = { x: 0, y: 0 };

      // Vibrant Colors per leg
      const accent = CONFIG.legAccents[index % CONFIG.legAccents.length];
      this.femurColor = CONFIG.colors.cyan;
      this.tibiaColor = CONFIG.colors.magenta;
      this.tarsusColor = CONFIG.colors.lime;
      this.kneeColor = CONFIG.colors.magenta;
      this.ankleColor = CONFIG.colors.gold;
      this.tipColor = CONFIG.colors.lime;
    }

    initPosition(baseX, baseY, bodyAngle) {
      const rest = this.getIdealTarget(baseX, baseY, bodyAngle, 0, 0);
      this.footX = rest.x;
      this.footY = rest.y;
      this.stepStartX = rest.x;
      this.stepStartY = rest.y;
      this.stepTargetX = rest.x;
      this.stepTargetY = rest.y;
    }

    getIdealTarget(bodyX, bodyY, bodyAngle, vx, vy) {
      const theta = bodyAngle + this.angleOffset;
      const leadFactor = 3.6;
      const targetX = bodyX + Math.cos(theta) * this.reachDistance + vx * leadFactor;
      const targetY = bodyY + Math.sin(theta) * this.reachDistance + vy * leadFactor;
      return { x: targetX, y: targetY };
    }

    triggerStep(targetX, targetY, snappedFoothold, scanner, spiderX, spiderY) {
      if (this.isStepping) return;

      if (this.anchoredEl) {
        scanner.releaseAnchor(this.anchoredEl);
        this.anchoredEl = null;
      }

      this.stepStartX = this.footX;
      this.stepStartY = this.footY;

      if (snappedFoothold) {
        this.stepTargetX = snappedFoothold.x;
        this.stepTargetY = snappedFoothold.y;
        this.anchoredEl = snappedFoothold.el;
        this.anchorType = snappedFoothold.type;
        this.anchorTag = snappedFoothold.tag.toUpperCase();
        scanner.applyAnchor(this.anchoredEl, spiderX, spiderY, this.index);
      } else {
        this.stepTargetX = targetX;
        this.stepTargetY = targetY;
        this.anchorType = 'ground';
        this.anchorTag = 'SURFACE';
      }

      this.isStepping = true;
      this.stepProgress = 0.0;
    }

    updateStep(stepSpeedMultiplier = 1.0) {
      if (!this.isStepping) return;

      this.stepProgress += CONFIG.stepSpeed * stepSpeedMultiplier;
      if (this.stepProgress >= 1.0) {
        this.stepProgress = 1.0;
        this.isStepping = false;
        this.footX = this.stepTargetX;
        this.footY = this.stepTargetY;
        this.footZ = 0;
      } else {
        const t = this.stepProgress;
        const ease = 1 - Math.pow(1 - t, 3);
        this.footX = lerp(this.stepStartX, this.stepTargetX, ease);
        this.footY = lerp(this.stepStartY, this.stepTargetY, ease);
        this.footZ = Math.sin(t * Math.PI) * CONFIG.stepLiftHeight;
      }
    }

    /**
     * Solves 3-joint Inverse Kinematics: Coxa Base -> Knee -> Ankle -> Foot Tip
     */
    solveIK(baseX, baseY, bodyAngle) {
      this.jointCoxa.x = baseX;
      this.jointCoxa.y = baseY;

      const renderFootX = this.footX;
      const renderFootY = this.footY - this.footZ * 0.7;

      this.jointTip.x = renderFootX;
      this.jointTip.y = renderFootY;

      const dx = renderFootX - baseX;
      const dy = renderFootY - baseY;
      let distTotal = Math.hypot(dx, dy) || 0.001;

      const maxReach = CONFIG.femurLen + CONFIG.tibiaLen + CONFIG.tarsusLen - 1;
      if (distTotal > maxReach) {
        distTotal = maxReach;
      }

      // Unit vector
      const dirX = dx / distTotal;
      const dirY = dy / distTotal;

      // Place Ankle
      const tarsusAngle = Math.atan2(dy, dx) - (0.45 * this.side);
      const ankleX = renderFootX - Math.cos(tarsusAngle) * CONFIG.tarsusLen;
      const ankleY = renderFootY - Math.sin(tarsusAngle) * CONFIG.tarsusLen;
      this.jointAnkle.x = ankleX;
      this.jointAnkle.y = ankleY;

      // Solve 2-bone IK between Coxa Base and Ankle
      const L1 = CONFIG.femurLen;
      const L2 = CONFIG.tibiaLen;
      const dBA = Math.hypot(ankleX - baseX, ankleY - baseY) || 0.001;
      const clampedD = clamp(dBA, Math.abs(L1 - L2) + 0.1, L1 + L2 - 0.1);

      const cosAlpha = clamp((L1 * L1 + clampedD * clampedD - L2 * L2) / (2 * L1 * clampedD), -1, 1);
      const alpha = Math.acos(cosAlpha);

      const baseToAnkleAngle = Math.atan2(ankleY - baseY, ankleX - baseX);
      const kneeAngle = baseToAnkleAngle + (alpha * -this.side);

      this.jointKnee.x = baseX + Math.cos(kneeAngle) * L1;
      this.jointKnee.y = baseY + Math.sin(kneeAngle) * L1;
    }

    render(ctx, scrollX, scrollY) {
      const coxa = { x: this.jointCoxa.x - scrollX, y: this.jointCoxa.y - scrollY };
      const knee = { x: this.jointKnee.x - scrollX, y: this.jointKnee.y - scrollY };
      const ankle = { x: this.jointAnkle.x - scrollX, y: this.jointAnkle.y - scrollY };
      const tip = { x: this.jointTip.x - scrollX, y: this.jointTip.y - scrollY };
      const groundTip = { x: this.footX - scrollX, y: this.footY - scrollY };

      ctx.save();

      // Foot ground contact shadow when stepped
      if (this.footZ > 1) {
        ctx.beginPath();
        ctx.ellipse(groundTip.x, groundTip.y, 3 * SCALE, 1.5 * SCALE, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(groundTip.x, groundTip.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. Femur (Coxa -> Knee): Electric Cyan
      ctx.beginPath();
      ctx.moveTo(coxa.x, coxa.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.strokeStyle = this.femurColor;
      ctx.stroke();

      // 2. Tibia (Knee -> Ankle): Hot Neon Magenta
      ctx.beginPath();
      ctx.moveTo(knee.x, knee.y);
      ctx.lineTo(ankle.x, ankle.y);
      ctx.strokeStyle = this.tibiaColor;
      ctx.stroke();

      // 3. Tarsus / Claw (Ankle -> Tip): Bright Electric Lime
      ctx.beginPath();
      ctx.moveTo(ankle.x, ankle.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.strokeStyle = this.tarsusColor;
      ctx.stroke();

      // Bright glowing multi-color joint nodes
      const joints = [
        { pt: coxa, r: 1.8, fill: CONFIG.colors.cyan, glow: CONFIG.colors.glowCyan },
        { pt: knee, r: 2.0, fill: this.kneeColor, glow: CONFIG.colors.glowMagenta },
        { pt: ankle, r: 1.7, fill: this.ankleColor, glow: CONFIG.colors.glowGold },
        { pt: tip, r: 1.6, fill: this.tipColor, glow: CONFIG.colors.glowLime }
      ];

      for (const j of joints) {
        ctx.beginPath();
        ctx.arc(j.pt.x, j.pt.y, j.r, 0, Math.PI * 2);
        ctx.fillStyle = j.fill;
        ctx.shadowColor = j.glow;
        ctx.shadowBlur = 5;
        ctx.fill();
      }

      // Bright Cyber Target Reticle & Telemetry Label if foot is anchored
      if (this.anchoredEl && !this.isStepping) {
        this.renderFootReticle(ctx, groundTip.x, groundTip.y);
      }

      ctx.restore();
    }

    renderFootReticle(ctx, x, y) {
      const s = 5;
      const bracketColor = this.index % 2 === 0 ? CONFIG.colors.magenta : CONFIG.colors.cyan;
      ctx.strokeStyle = bracketColor;
      ctx.lineWidth = 1.1;
      ctx.shadowColor = bracketColor === CONFIG.colors.magenta ? CONFIG.colors.glowMagenta : CONFIG.colors.glowCyan;
      ctx.shadowBlur = 6;

      // Small 4-corner brackets
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x - s, y - s + 2.5);
      ctx.lineTo(x - s, y - s);
      ctx.lineTo(x - s + 2.5, y - s);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + s - 2.5, y - s);
      ctx.lineTo(x + s, y - s);
      ctx.lineTo(x + s, y - s + 2.5);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x - s, y + s - 2.5);
      ctx.lineTo(x - s, y + s);
      ctx.lineTo(x - s + 2.5, y + s);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + s - 2.5, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s, y + s - 2.5);
      ctx.stroke();

      // Telemetry label in bright gold
      if (this.index === 0 || this.index === 4) {
        ctx.font = '7.5px monospace';
        ctx.fillStyle = CONFIG.colors.gold;
        ctx.shadowColor = CONFIG.colors.glowGold;
        ctx.shadowBlur = 4;
        ctx.fillText(`[${Math.round(this.footX)},${Math.round(this.footY)}] <${this.anchorTag}>`, x + 7, y + 2.5);
      }
    }
  }

  /* ---------------------------------------------------------
     6. Procedural Spider Entity & Multi-Color Rig
     --------------------------------------------------------- */
  class SpiderCrawler {
    constructor() {
      this.x = window.scrollX + window.innerWidth * 0.5;
      this.y = window.scrollY + window.innerHeight * 0.4;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.targetAngle = 0;

      this.targetX = this.x;
      this.targetY = this.y;
      this.mode = 'cursor';
      this.lastMouseActivity = performance.now();
      this.isPaused = false;
      this.isVisible = true;

      this.pauseTimer = 0;
      this.isMicroPaused = false;

      this.lastScrollY = window.scrollY;
      this.scrollVelocity = 0;

      this.gaitGroup = 0;
      this.isWalking = false;

      this.scanner = new DOMSpatialScanner();
      this.silk = new SilkWebTrail();
      this.autonomousTarget = null;
      this.autonomousTimer = 0;

      // 8 Multi-Segment Legs (scaled by 40% reduction)
      this.legs = [
        new SpiderLeg(0, -1, -Math.PI * 0.22, 64 * SCALE),
        new SpiderLeg(1, -1, -Math.PI * 0.40, 72 * SCALE),
        new SpiderLeg(2, -1, -Math.PI * 0.62, 70 * SCALE),
        new SpiderLeg(3, -1, -Math.PI * 0.82, 62 * SCALE),
        new SpiderLeg(4,  1,  Math.PI * 0.22, 64 * SCALE),
        new SpiderLeg(5,  1,  Math.PI * 0.40, 72 * SCALE),
        new SpiderLeg(6,  1,  Math.PI * 0.62, 70 * SCALE),
        new SpiderLeg(7,  1,  Math.PI * 0.82, 62 * SCALE)
      ];

      // Coxa mounting offsets scaled
      this.coxaMounts = [
        { angle: -Math.PI * 0.25, dist: 14 * SCALE },
        { angle: -Math.PI * 0.45, dist: 16 * SCALE },
        { angle: -Math.PI * 0.65, dist: 16 * SCALE },
        { angle: -Math.PI * 0.85, dist: 14 * SCALE },
        { angle:  Math.PI * 0.25, dist: 14 * SCALE },
        { angle:  Math.PI * 0.45, dist: 16 * SCALE },
        { angle:  Math.PI * 0.65, dist: 16 * SCALE },
        { angle:  Math.PI * 0.85, dist: 14 * SCALE }
      ];

      for (const leg of this.legs) {
        leg.initPosition(this.x, this.y, this.angle);
      }
    }

    setTarget(x, y, mode = 'cursor') {
      this.targetX = x;
      this.targetY = y;
      if (mode !== this.mode) {
        this.mode = mode;
      }
      this.lastMouseActivity = performance.now();
      this.isMicroPaused = false;
    }

    shootWeb(x, y) {
      const spinneret = this.getSpinneretPosition();
      this.silk.shootGrapple(spinneret.x, spinneret.y, x, y);
      this.mode = 'dart';
      this.targetX = x;
      this.targetY = y;
      this.lastMouseActivity = performance.now();
    }

    update(dt) {
      if (this.isPaused || !this.isVisible) return;

      const now = performance.now();

      if (this.mode === 'cursor' && now - this.lastMouseActivity > CONFIG.idleTimeoutMs) {
        this.mode = 'autonomous';
        this.autonomousTimer = 0;
        this.pickAutonomousTarget();
      }

      if (this.mode === 'autonomous') {
        this.updateAutonomous(dt);
      }

      const curScrollY = window.scrollY;
      this.scrollVelocity = curScrollY - this.lastScrollY;
      this.lastScrollY = curScrollY;

      if (Math.abs(this.scrollVelocity) > 35) {
        this.mode = 'rappel';
        this.targetY += this.scrollVelocity * 0.8;
      } else if (this.mode === 'rappel' && Math.abs(this.scrollVelocity) < 5) {
        this.mode = 'cursor';
      }

      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distToTarget = Math.hypot(dx, dy);

      if (this.mode === 'cursor' && distToTarget > 35 && !this.isMicroPaused) {
        this.pauseTimer += dt;
        if (this.pauseTimer > 2800) {
          if (Math.random() < 0.35) {
            this.isMicroPaused = true;
            setTimeout(() => { this.isMicroPaused = false; }, 200);
          }
          this.pauseTimer = 0;
        }
      }

      const speedMax = (this.mode === 'dart') ? CONFIG.dartVelocity : CONFIG.maxVelocity;

      if (distToTarget > 10 && !this.isMicroPaused) {
        this.isWalking = true;
        this.targetAngle = Math.atan2(dy, dx);

        const accel = (this.mode === 'dart') ? 0.35 : 0.18;
        const targetVx = (dx / distToTarget) * Math.min(distToTarget * 0.12, speedMax);
        const targetVy = (dy / distToTarget) * Math.min(distToTarget * 0.12, speedMax);

        this.vx = lerp(this.vx, targetVx, accel);
        this.vy = lerp(this.vy, targetVy, accel);
      } else {
        this.isWalking = false;
        this.vx *= 0.82;
        this.vy *= 0.82;
        if (this.mode === 'dart' && distToTarget <= 12) {
          this.mode = 'cursor';
        }
      }

      this.x += this.vx;
      this.y += this.vy;

      const diffA = angleDiff(this.angle, this.targetAngle);
      this.angle += diffA * CONFIG.turnSpeed;

      this.updateLegs(dt);

      const spinneret = this.getSpinneretPosition();
      this.silk.update(spinneret.x, spinneret.y);

      if (this.isWalking && Math.random() < 0.08) {
        this.silk.addAnchor(spinneret.x, spinneret.y);
      }
    }

    pickAutonomousTarget() {
      const elData = this.scanner.getRandomInterestingElement();
      if (elData) {
        this.autonomousTarget = elData;
        const offsetPctX = 0.2 + Math.random() * 0.6;
        const offsetPctY = 0.2 + Math.random() * 0.6;
        this.targetX = elData.pageX + elData.rect.width * offsetPctX;
        this.targetY = elData.pageY + elData.rect.height * offsetPctY;
      } else {
        this.targetX = window.scrollX + window.innerWidth * (0.2 + Math.random() * 0.6);
        this.targetY = window.scrollY + window.innerHeight * (0.2 + Math.random() * 0.6);
      }
    }

    updateAutonomous(dt) {
      this.autonomousTimer += dt;
      const d = dist(this.x, this.y, this.targetX, this.targetY);

      if (d < 20 || this.autonomousTimer > 4500) {
        this.autonomousTimer = 0;
        this.pickAutonomousTarget();
      }
    }

    updateLegs(dt) {
      const stepSpeedMult = (this.mode === 'dart') ? 2.2 : 1.0;

      for (const leg of this.legs) {
        if (leg.isStepping) {
          leg.updateStep(stepSpeedMult);
        }
      }

      const currentGroupLegs = this.legs.filter(l => l.group === this.gaitGroup);
      const otherGroupLegs = this.legs.filter(l => l.group !== this.gaitGroup);

      let needsStep = false;
      for (const leg of currentGroupLegs) {
        const ideal = leg.getIdealTarget(this.x, this.y, this.angle, this.vx, this.vy);
        const d = dist(leg.footX, leg.footY, ideal.x, ideal.y);
        if (d > CONFIG.stepDistanceThreshold || (this.isWalking && d > 14)) {
          needsStep = true;
          break;
        }
      }

      const otherGroupPlanted = otherGroupLegs.every(l => !l.isStepping);

      if (needsStep && otherGroupPlanted) {
        for (const leg of currentGroupLegs) {
          if (!leg.isStepping) {
            const ideal = leg.getIdealTarget(this.x, this.y, this.angle, this.vx, this.vy);
            const snapped = this.scanner.findClosestFoothold(ideal.x, ideal.y, 40);
            leg.triggerStep(ideal.x, ideal.y, snapped, this.scanner, this.x, this.y);
          }
        }
        this.gaitGroup = 1 - this.gaitGroup;
      }

      for (let i = 0; i < this.legs.length; i++) {
        const leg = this.legs[i];
        const mount = this.coxaMounts[i];
        const mountAngle = this.angle + mount.angle;
        const coxaX = this.x + Math.cos(mountAngle) * mount.dist;
        const coxaY = this.y + Math.sin(mountAngle) * mount.dist;

        leg.solveIK(coxaX, coxaY, this.angle);
      }
    }

    getSpinneretPosition() {
      const abdomenDist = 16 * SCALE;
      return {
        x: this.x - Math.cos(this.angle) * abdomenDist,
        y: this.y - Math.sin(this.angle) * abdomenDist
      };
    }

    render(ctx, scrollX, scrollY) {
      if (!this.isVisible) return;

      const screenX = this.x - scrollX;
      const screenY = this.y - scrollY;

      // 1. Silk Web
      this.silk.render(ctx, scrollX, scrollY);

      // 2. 8 Multi-Segment IK Legs
      for (const leg of this.legs) {
        leg.render(ctx, scrollX, scrollY);
      }

      // 3. Central Body (Abdomen & Cephalothorax)
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.angle);

      // Render Abdomen (Rear Body)
      this.renderAbdomen(ctx);

      // Render Cephalothorax (Front Body & Multi-Color Optics)
      this.renderCephalothorax(ctx);

      ctx.restore();

      // 4. Scanning Laser Beam if Autonomous
      if (this.mode === 'autonomous' && this.autonomousTarget) {
        this.renderScanningBeam(ctx, screenX, screenY, scrollX, scrollY);
      }
    }

    renderAbdomen(ctx) {
      ctx.save();
      const s = SCALE;
      ctx.translate(-10 * s, 0);

      // Outer hull with Electric Violet contour & glow
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.colors.bodyDark;
      ctx.fill();
      ctx.strokeStyle = CONFIG.colors.purple;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = CONFIG.colors.magenta;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Cyber internal telemetry ribs in Hot Neon Magenta
      ctx.beginPath();
      ctx.arc(-2 * s, 0, 5 * s, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.arc(-5 * s, 0, 3 * s, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.strokeStyle = CONFIG.colors.magenta;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Glowing Spinneret in Pure White & Cyan
      ctx.beginPath();
      ctx.arc(-10 * s, 0, 1.8 * s, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.colors.white;
      ctx.shadowColor = CONFIG.colors.cyan;
      ctx.shadowBlur = 7;
      ctx.fill();

      ctx.restore();
    }

    renderCephalothorax(ctx) {
      const s = SCALE;

      // Pedicel (waist connector)
      ctx.beginPath();
      ctx.rect(-4 * s, -2 * s, 4 * s, 4 * s);
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.fill();

      // Cephalothorax Faceted Cyber Shell in Electric Cyan
      ctx.beginPath();
      ctx.moveTo(9 * s, 0);
      ctx.lineTo(5 * s, -5 * s);
      ctx.lineTo(-2.5 * s, -5.5 * s);
      ctx.lineTo(-5 * s, -2.5 * s);
      ctx.lineTo(-5 * s, 2.5 * s);
      ctx.lineTo(-2.5 * s, 5.5 * s);
      ctx.lineTo(5 * s, 5 * s);
      ctx.closePath();

      ctx.fillStyle = CONFIG.colors.bodyDark;
      ctx.fill();
      ctx.strokeStyle = CONFIG.colors.cyan;
      ctx.lineWidth = 1.3;
      ctx.shadowColor = CONFIG.colors.glowCyan;
      ctx.shadowBlur = 7;
      ctx.stroke();

      // Center Cyber Core Glyph in Hot Neon Magenta
      ctx.beginPath();
      ctx.arc(0, 0, 2.0 * s, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.colors.magenta;
      ctx.shadowColor = CONFIG.colors.glowMagenta;
      ctx.shadowBlur = 5;
      ctx.fill();

      // Chelicerae / Feelers in Solar Gold
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = CONFIG.colors.gold;
      ctx.beginPath();
      ctx.moveTo(8 * s, -2.5 * s);
      ctx.lineTo(13 * s, -4 * s);
      ctx.lineTo(15 * s, -2 * s);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8 * s, 2.5 * s);
      ctx.lineTo(13 * s, 4 * s);
      ctx.lineTo(15 * s, 2 * s);
      ctx.stroke();

      // Multi-Colored Optical Sensor Array (Eyes)
      const eyes = [
        // Center main optics: Pure White & Magenta
        { x: 8.5 * s, y: -1.2 * s, r: 1.1 * s, c: CONFIG.colors.white, glow: CONFIG.colors.glowMagenta },
        { x: 8.5 * s, y:  1.2 * s, r: 1.1 * s, c: CONFIG.colors.white, glow: CONFIG.colors.glowMagenta },
        // Outer forward optics: Electric Lime
        { x: 6.5 * s, y: -3.2 * s, r: 0.9 * s, c: CONFIG.colors.lime, glow: CONFIG.colors.glowLime },
        { x: 6.5 * s, y:  3.2 * s, r: 0.9 * s, c: CONFIG.colors.lime, glow: CONFIG.colors.glowLime },
        // Flank optics: Solar Gold
        { x: 4.5 * s, y: -4.0 * s, r: 0.8 * s, c: CONFIG.colors.gold, glow: CONFIG.colors.glowGold },
        { x: 4.5 * s, y:  4.0 * s, r: 0.8 * s, c: CONFIG.colors.gold, glow: CONFIG.colors.glowGold }
      ];

      for (const eye of eyes) {
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
        ctx.fillStyle = eye.c;
        ctx.shadowColor = eye.glow;
        ctx.shadowBlur = 5;
        ctx.fill();
      }
    }

    renderScanningBeam(ctx, screenX, screenY, scrollX, scrollY) {
      if (!this.autonomousTarget) return;

      const targetCenterX = this.autonomousTarget.pageX + this.autonomousTarget.rect.width * 0.5 - scrollX;
      const targetCenterY = this.autonomousTarget.pageY + this.autonomousTarget.rect.height * 0.5 - scrollY;

      ctx.save();
      const grad = ctx.createLinearGradient(screenX, screenY, targetCenterX, targetCenterY);
      grad.addColorStop(0, 'rgba(255, 0, 127, 0.45)');
      grad.addColorStop(0.5, 'rgba(0, 245, 255, 0.25)');
      grad.addColorStop(1, 'rgba(57, 255, 20, 0)');

      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(targetCenterX - 14, targetCenterY - 8);
      ctx.lineTo(targetCenterX + 14, targetCenterY + 8);
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     7. Floating Cyber HUD Controller
     --------------------------------------------------------- */
  class SpiderHUD {
    constructor(spider) {
      this.spider = spider;
      this.container = null;
      this.statusEl = null;
      this.targetEl = null;
      this.coordsEl = null;
      this.fpsEl = null;
      this.frameCount = 0;
      this.lastFpsUpdate = performance.now();
      this.currentFps = 60;
      this.isCollapsed = false;

      this.init();
    }

    init() {
      this.container = document.createElement('div');
      this.container.className = 'spider-hud-widget';
      this.container.innerHTML = `
        <div class="spider-hud-header" title="Click to toggle HUD details">
          <div class="spider-hud-title">
            <span class="spider-hud-badge"></span>
            <span>CRAWLER // MULTI-NEON</span>
          </div>
          <button type="button" class="spider-hud-toggle-btn" aria-label="Collapse HUD">_</button>
        </div>
        <div class="spider-hud-body">
          <div class="spider-hud-row">
            <span class="spider-hud-label">STATUS</span>
            <span class="spider-hud-value" id="spider-hud-status">TRACKING</span>
          </div>
          <div class="spider-hud-row">
            <span class="spider-hud-label">TARGET</span>
            <span class="spider-hud-value highlight-magenta" id="spider-hud-target">&lt;CURSOR&gt;</span>
          </div>
          <div class="spider-hud-row">
            <span class="spider-hud-label">COORDS</span>
            <span class="spider-hud-value highlight-lime" id="spider-hud-coords">0, 0</span>
          </div>
          <div class="spider-hud-row">
            <span class="spider-hud-label">ENGINE</span>
            <span class="spider-hud-value" id="spider-hud-fps">60 FPS // IK 3-JNT</span>
          </div>
          <div class="spider-hud-actions">
            <button type="button" class="spider-btn" id="spider-btn-mode">AUTO HUNT</button>
            <button type="button" class="spider-btn secondary" id="spider-btn-power">PAUSE</button>
          </div>
          <div class="spider-hud-hint">
            Press <kbd>C</kbd> to toggle • Click to grapple
          </div>
        </div>
      `;

      document.body.appendChild(this.container);

      this.statusEl = this.container.querySelector('#spider-hud-status');
      this.targetEl = this.container.querySelector('#spider-hud-target');
      this.coordsEl = this.container.querySelector('#spider-hud-coords');
      this.fpsEl = this.container.querySelector('#spider-hud-fps');
      this.modeBtn = this.container.querySelector('#spider-btn-mode');
      this.powerBtn = this.container.querySelector('#spider-btn-power');
      this.collapseBtn = this.container.querySelector('.spider-hud-toggle-btn');
      this.header = this.container.querySelector('.spider-hud-header');

      this.header.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') this.toggleCollapse();
      });
      this.collapseBtn.addEventListener('click', () => this.toggleCollapse());

      this.modeBtn.addEventListener('click', () => {
        if (this.spider.mode === 'autonomous') {
          this.spider.mode = 'cursor';
          this.modeBtn.textContent = 'AUTO HUNT';
        } else {
          this.spider.mode = 'autonomous';
          this.spider.pickAutonomousTarget();
          this.modeBtn.textContent = 'CURSOR TRK';
        }
      });

      this.powerBtn.addEventListener('click', () => {
        this.spider.isPaused = !this.spider.isPaused;
        this.container.classList.toggle('is-paused', this.spider.isPaused);
        this.powerBtn.textContent = this.spider.isPaused ? 'RESUME' : 'PAUSE';
        if (this.spider.isPaused) {
          this.spider.scanner.clearAllAnchors();
        }
      });
    }

    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
      this.container.classList.toggle('is-collapsed', this.isCollapsed);
      this.collapseBtn.textContent = this.isCollapsed ? '□' : '_';
    }

    update(now) {
      this.frameCount++;
      if (now - this.lastFpsUpdate >= 600) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = now;

        if (!this.isCollapsed) {
          this.statusEl.textContent = this.spider.isPaused ? 'PAUSED' : this.spider.mode.toUpperCase();
          this.coordsEl.textContent = `${Math.round(this.spider.x)}, ${Math.round(this.spider.y)}`;
          this.fpsEl.textContent = `${this.currentFps} FPS // 60% RIG`;

          let targetText = '<CURSOR>';
          if (this.spider.mode === 'autonomous' && this.spider.autonomousTarget) {
            targetText = `<${this.spider.autonomousTarget.tag}>`;
          } else if (this.spider.mode === 'dart') {
            targetText = 'DART [SILK]';
          }
          this.targetEl.textContent = targetText;
        }
      }
    }
  }

  /* ---------------------------------------------------------
     8. Main Overlay Controller & Animation Loop
     --------------------------------------------------------- */
  class SpiderCrawlerOverlay {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.spider = null;
      this.hud = null;
      this.lastFrameTime = performance.now();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    }

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'spider-crawler-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d', { alpha: true });

      this.resizeCanvas();

      this.spider = new SpiderCrawler();
      this.hud = new SpiderHUD(this.spider);

      this.spider.scanner.scan();
      this.bindEvents();

      requestAnimationFrame((t) => this.loop(t));
      console.info('[SpiderCrawler] Multi-Neon 60% Scale Web Crawler initialized.');
    }

    resizeCanvas() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
    }

    bindEvents() {
      window.addEventListener('mousemove', (e) => {
        if (!this.spider || this.spider.isPaused) return;
        const pageX = e.clientX + window.scrollX;
        const pageY = e.clientY + window.scrollY;
        this.spider.setTarget(pageX, pageY, 'cursor');
      }, { passive: true });

      window.addEventListener('click', (e) => {
        if (!this.spider || this.spider.isPaused) return;
        if (e.target.closest('.spider-hud-widget')) return;

        const pageX = e.clientX + window.scrollX;
        const pageY = e.clientY + window.scrollY;
        this.spider.shootWeb(pageX, pageY);
      }, { passive: true });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'c' || e.key === 'C') {
          if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
          this.toggleCrawler();
        }
      });

      window.addEventListener('resize', () => {
        this.resizeCanvas();
        this.spider.scanner.scan();
      }, { passive: true });

      window.addEventListener('scroll', () => {
        this.spider.scanner.scan();
      }, { passive: true });
    }

    toggleCrawler() {
      this.spider.isVisible = !this.spider.isVisible;
      this.canvas.style.display = this.spider.isVisible ? 'block' : 'none';
      if (!this.spider.isVisible) {
        this.spider.scanner.clearAllAnchors();
      }
    }

    loop(currentTime) {
      const dt = Math.min(currentTime - this.lastFrameTime, 100);
      this.lastFrameTime = currentTime;

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (this.spider && this.spider.isVisible) {
        this.spider.update(dt);
        this.spider.render(this.ctx, scrollX, scrollY);
        this.hud.update(currentTime);
      }

      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // Self-bootstrapping once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const overlay = new SpiderCrawlerOverlay();
      overlay.init();
      window.SpiderCrawler = overlay;
    });
  } else {
    const overlay = new SpiderCrawlerOverlay();
    overlay.init();
    window.SpiderCrawler = overlay;
  }

})();
