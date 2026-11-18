/**
 * Procedural Spider Web Crawler Overlay
 * Realistic 3-bone/2-bone Inverse Kinematics (IK), DOM Foothold Snapping,
 * Trailing Silk Web Physics, Scroll Synchronization & Autonomous Roaming.
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
     2. Configuration & Theme Variables
     --------------------------------------------------------- */
  const CONFIG = {
    scale: 1.3, // Size scaling factor (+30%)
    legCount: 8,
    // Leg segment lengths in pixels
    get femurLen() { return 24 * this.scale; },
    get tibiaLen() { return 28 * this.scale; },
    get tarsusLen() { return 18 * this.scale; },
    // Max reach
    get maxReach() { return this.femurLen + this.tibiaLen + this.tarsusLen - 2; },
    // Step triggering
    get stepDistanceThreshold() { return 34 * this.scale; },
    stepSpeed: 0.16, // Progress per tick
    maxVelocity: 5.5,
    dartVelocity: 14.0,
    turnSpeed: 0.14,
    idleTimeoutMs: 3000,
    scanIntervalMs: 1200,
    colors: {
      primary: '#5eead4',
      secondary: '#7ce0c3',
      accent: '#38bdf8',
      glow: 'rgba(94, 234, 212, 0.4)',
      glowSoft: 'rgba(94, 234, 212, 0.15)',
      bodyDark: 'rgba(7, 12, 24, 0.92)',
      reticle: '#5eead4'
    }
  };

  // Read site CSS variables if available
  function updateThemeColors() {
    const computed = getComputedStyle(document.documentElement);
    const p = computed.getPropertyValue('--primary-mint').trim() || computed.getPropertyValue('--spider-primary').trim();
    const s = computed.getPropertyValue('--mint-accent').trim() || computed.getPropertyValue('--spider-secondary').trim();
    if (p) CONFIG.colors.primary = p;
    if (s) CONFIG.colors.secondary = s;
  }

  /* ---------------------------------------------------------
     3. DOM Scanner & Spatial Foothold Snapping
     --------------------------------------------------------- */
  class DOMSpatialScanner {
    constructor() {
      this.elements = [];
      this.footholds = []; // Array of { x, y, el, tag, type } in page coordinates
      this.anchoredElements = new Map(); // el => { count, pullX, pullY }
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
      if (now - this.lastScanTime < 600) return; // Prevent layout thrashing
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

    findClosestFoothold(targetX, targetY, maxRadius = 60) {
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

      return closest; // May be null if no DOM element close enough
    }

    getRandomInterestingElement() {
      if (!this.elements.length) return null;
      // Filter for interactive or heading elements first
      const preferred = this.elements.filter(e => 
        ['h1', 'h2', 'h3', 'a', 'button'].includes(e.tag) || e.el.classList.contains('card') || e.el.classList.contains('skill-card')
      );
      const pool = preferred.length > 0 ? preferred : this.elements;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    applyAnchor(el, spiderX, spiderY) {
      if (!el || !el.getBoundingClientRect) return;
      let entry = this.anchoredElements.get(el);
      if (!entry) {
        entry = { count: 0, origTransform: el.style.transform || '' };
        this.anchoredElements.set(el, entry);
        el.classList.add('spider-anchored');
      }
      entry.count++;

      // Subtle reactive displacement towards spider
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + window.scrollX + rect.width * 0.5;
      const centerY = rect.top + window.scrollY + rect.height * 0.5;
      const dx = clamp((spiderX - centerX) * 0.02, -3.5, 3.5);
      const dy = clamp((spiderY - centerY) * 0.02, -3.5, 3.5);

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
        this.anchoredElements.delete(el);
      }
    }

    clearAllAnchors() {
      for (const [el, entry] of this.anchoredElements.entries()) {
        el.classList.remove('spider-anchored');
        el.style.transform = entry.origTransform;
      }
      this.anchoredElements.clear();
    }
  }

  /* ---------------------------------------------------------
     4. Silk Web Rope Simulator (Verlet Tension & Sag)
     --------------------------------------------------------- */
  class SilkWebTrail {
    constructor() {
      this.points = []; // Array of { x, y, oldX, oldY, pinned } in page coords
      this.maxNodes = 24;
      this.segmentLength = 22;
      this.activeRappelling = false;
      this.grappleLine = null; // { startX, startY, endX, endY, progress, active }
    }

    addAnchor(x, y) {
      if (this.points.length === 0) {
        this.points.push({ x, y, oldX: x, oldY: y, pinned: true, alpha: 1.0 });
        return;
      }

      const last = this.points[this.points.length - 1];
      const d = dist(last.x, last.y, x, y);
      if (d > 28) {
        this.points.push({ x, y, oldX: x, oldY: y, pinned: false, alpha: 1.0 });
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
        // Connect head of silk to current spinneret
        const head = this.points[this.points.length - 1];
        head.x = spinneretX;
        head.y = spinneretY;
      } else {
        this.points.push({ x: spinneretX, y: spinneretY, oldX: spinneretX, oldY: spinneretY, pinned: true, alpha: 1 });
      }

      // Verlet physics for silk sagging & tension
      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        if (pt.pinned) continue;

        const vx = (pt.x - pt.oldX) * 0.92;
        const vy = (pt.y - pt.oldY) * 0.92 + 0.12; // Slight gravity sag

        pt.oldX = pt.x;
        pt.oldY = pt.y;
        pt.x += vx;
        pt.y += vy;
      }

      // Distance constraints relaxation
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

      // Update active grapple line
      if (this.grappleLine && this.grappleLine.active) {
        this.grappleLine.progress += 0.15;
        if (this.grappleLine.progress >= 1.0) {
          this.grappleLine.progress = 1.0;
        }
      }
    }

    render(ctx, scrollX, scrollY) {
      if (this.points.length < 2) return;

      // Draw trailing silk web
      ctx.save();
      ctx.lineWidth = 1.0;
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

      const grad = ctx.createLinearGradient(
        firstX, firstY,
        this.points[this.points.length - 1].x - scrollX,
        this.points[this.points.length - 1].y - scrollY
      );
      grad.addColorStop(0, 'rgba(94, 234, 212, 0.05)');
      grad.addColorStop(0.7, 'rgba(94, 234, 212, 0.45)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.85)');

      ctx.strokeStyle = grad;
      ctx.shadowColor = CONFIG.colors.glow;
      ctx.shadowBlur = 4;
      ctx.stroke();

      // Render grapple zip beam if active
      if (this.grappleLine && this.grappleLine.active) {
        const g = this.grappleLine;
        const curX = lerp(g.fromX, g.toX, g.progress) - scrollX;
        const curY = lerp(g.fromY, g.toY, g.progress) - scrollY;

        ctx.beginPath();
        ctx.moveTo(g.fromX - scrollX, g.fromY - scrollY);
        ctx.lineTo(curX, curY);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = CONFIG.colors.primary;
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Tip dart projectile
        ctx.beginPath();
        ctx.arc(curX, curY, 3, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.colors.primary;
        ctx.fill();

        // Expanding grapple reticle
        if (g.progress >= 0.8) {
          const destX = g.toX - scrollX;
          const destY = g.toY - scrollY;
          ctx.beginPath();
          ctx.arc(destX, destY, 8 + (1.0 - g.progress) * 20, 0, Math.PI * 2);
          ctx.strokeStyle = CONFIG.colors.primary;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     5. Spider Leg & 3-Joint Inverse Kinematics
     --------------------------------------------------------- */
  class SpiderLeg {
    constructor(index, side, angleOffset, reachDistance) {
      this.index = index;
      this.side = side; // -1 for Left, 1 for Right
      this.angleOffset = angleOffset; // Resting angle relative to body spine
      this.reachDistance = reachDistance;

      // Group A (0, 2, 5, 7) or Group B (1, 3, 4, 6)
      this.group = [0, 2, 5, 7].includes(index) ? 0 : 1;

      // Current foot position in page coords
      this.footX = 0;
      this.footY = 0;
      this.footZ = 0; // Elevation when lifting

      // Previous and Target positions for stepping
      this.stepStartX = 0;
      this.stepStartY = 0;
      this.stepTargetX = 0;
      this.stepTargetY = 0;
      this.isStepping = false;
      this.stepProgress = 1.0;

      // Associated anchored DOM element
      this.anchoredEl = null;
      this.anchorType = 'ground';
      this.anchorTag = '';

      // Joint positions for rendering (computed by IK)
      this.jointCoxa = { x: 0, y: 0 };
      this.jointKnee = { x: 0, y: 0 };
      this.jointAnkle = { x: 0, y: 0 };
      this.jointTip = { x: 0, y: 0 };
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
      // Velocity lead anticipation
      const leadFactor = 4.5;
      const targetX = bodyX + Math.cos(theta) * this.reachDistance + vx * leadFactor;
      const targetY = bodyY + Math.sin(theta) * this.reachDistance + vy * leadFactor;
      return { x: targetX, y: targetY };
    }

    triggerStep(targetX, targetY, snappedFoothold, scanner, spiderX, spiderY) {
      if (this.isStepping) return;

      // Release old anchor
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
        scanner.applyAnchor(this.anchoredEl, spiderX, spiderY);
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
        // Smooth easing interpolation
        const t = this.stepProgress;
        // Cubic ease-out
        const ease = 1 - Math.pow(1 - t, 3);
        this.footX = lerp(this.stepStartX, this.stepTargetX, ease);
        this.footY = lerp(this.stepStartY, this.stepTargetY, ease);
        // Parabolic step elevation
        this.footZ = Math.sin(t * Math.PI) * 18 * CONFIG.scale;
      }
    }

    /**
     * Solves 3-joint Inverse Kinematics: Coxa Base -> Knee -> Ankle -> Foot Tip
     */
    solveIK(baseX, baseY, bodyAngle) {
      this.jointCoxa.x = baseX;
      this.jointCoxa.y = baseY;

      // 3D elevation adjustment: lifting foot shifts visual position upward
      const renderFootX = this.footX;
      const renderFootY = this.footY - this.footZ * 0.7;

      this.jointTip.x = renderFootX;
      this.jointTip.y = renderFootY;

      // Distance from coxa base to foot
      const dx = renderFootX - baseX;
      const dy = renderFootY - baseY;
      let distTotal = Math.hypot(dx, dy) || 0.001;

      // Clamp distance within reach
      const maxReach = CONFIG.femurLen + CONFIG.tibiaLen + CONFIG.tarsusLen - 1;
      if (distTotal > maxReach) {
        distTotal = maxReach;
      }

      // Unit vector from coxa base to foot
      const dirX = dx / distTotal;
      const dirY = dy / distTotal;

      // Outward normal vector for knee bending flare
      // For left legs (side = -1), bend counter-clockwise; for right legs (side = 1), bend clockwise
      const normX = -dirY * this.side;
      const normY = dirX * this.side;

      // Place Ankle: tarsus segment reaches from ankle down to foot tip
      const tarsusAngle = Math.atan2(dy, dx) - (0.45 * this.side);
      const ankleX = renderFootX - Math.cos(tarsusAngle) * CONFIG.tarsusLen;
      const ankleY = renderFootY - Math.sin(tarsusAngle) * CONFIG.tarsusLen;
      this.jointAnkle.x = ankleX;
      this.jointAnkle.y = ankleY;

      // Solve 2-bone IK between Coxa Base and Ankle with lengths L1 (femur) and L2 (tibia)
      const L1 = CONFIG.femurLen;
      const L2 = CONFIG.tibiaLen;
      const dBA = Math.hypot(ankleX - baseX, ankleY - baseY) || 0.001;
      const clampedD = clamp(dBA, Math.abs(L1 - L2) + 0.1, L1 + L2 - 0.1);

      // Law of Cosines for knee angle
      const cosAlpha = clamp((L1 * L1 + clampedD * clampedD - L2 * L2) / (2 * L1 * clampedD), -1, 1);
      const alpha = Math.acos(cosAlpha);

      // Base to ankle angle
      const baseToAnkleAngle = Math.atan2(ankleY - baseY, ankleX - baseX);
      // Bend outward depending on side
      const kneeAngle = baseToAnkleAngle + (alpha * -this.side);

      this.jointKnee.x = baseX + Math.cos(kneeAngle) * L1;
      this.jointKnee.y = baseY + Math.sin(kneeAngle) * L1;
    }

    render(ctx, scrollX, scrollY, activeReticle = false) {
      const coxa = { x: this.jointCoxa.x - scrollX, y: this.jointCoxa.y - scrollY };
      const knee = { x: this.jointKnee.x - scrollX, y: this.jointKnee.y - scrollY };
      const ankle = { x: this.jointAnkle.x - scrollX, y: this.jointAnkle.y - scrollY };
      const tip = { x: this.jointTip.x - scrollX, y: this.jointTip.y - scrollY };
      const groundTip = { x: this.footX - scrollX, y: this.footY - scrollY };

      ctx.save();

      // Foot ground contact shadow when stepped
      if (this.footZ > 1) {
        ctx.beginPath();
        ctx.ellipse(groundTip.x, groundTip.y, 4 * CONFIG.scale, 2 * CONFIG.scale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();

        // Lift guide wire
        ctx.beginPath();
        ctx.moveTo(groundTip.x, groundTip.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.2)';
        ctx.lineWidth = 0.8 * CONFIG.scale;
        ctx.stroke();
      }

      // Leg Segments Wireframe
      ctx.lineWidth = 1.35 * CONFIG.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. Femur (Coxa -> Knee)
      ctx.beginPath();
      ctx.moveTo(coxa.x, coxa.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.strokeStyle = CONFIG.colors.primary;
      ctx.stroke();

      // 2. Tibia (Knee -> Ankle)
      ctx.beginPath();
      ctx.moveTo(knee.x, knee.y);
      ctx.lineTo(ankle.x, ankle.y);
      ctx.strokeStyle = CONFIG.colors.secondary;
      ctx.stroke();

      // 3. Tarsus / Claw (Ankle -> Foot Tip)
      ctx.beginPath();
      ctx.moveTo(ankle.x, ankle.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Joint Nodes
      const joints = [
        { pt: coxa, r: 2.2 * CONFIG.scale, fill: CONFIG.colors.primary },
        { pt: knee, r: 2.5 * CONFIG.scale, fill: CONFIG.colors.secondary },
        { pt: ankle, r: 2.0 * CONFIG.scale, fill: '#ffffff' },
        { pt: tip, r: 1.8 * CONFIG.scale, fill: CONFIG.colors.primary }
      ];

      for (const j of joints) {
        ctx.beginPath();
        ctx.arc(j.pt.x, j.pt.y, j.r, 0, Math.PI * 2);
        ctx.fillStyle = j.fill;
        ctx.shadowColor = CONFIG.colors.glow;
        ctx.shadowBlur = 4;
        ctx.fill();
      }

      // Cyber Target Reticle & Coordinate Label if foot is anchored
      if (this.anchoredEl && !this.isStepping) {
        this.renderFootReticle(ctx, groundTip.x, groundTip.y);
      }

      ctx.restore();
    }

    renderFootReticle(ctx, x, y) {
      const s = 6 * CONFIG.scale;
      ctx.strokeStyle = CONFIG.colors.primary;
      ctx.lineWidth = 1.0;
      ctx.shadowColor = CONFIG.colors.glow;
      ctx.shadowBlur = 5;

      // Small 4-corner brackets
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x - s, y - s + 3);
      ctx.lineTo(x - s, y - s);
      ctx.lineTo(x - s + 3, y - s);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + s - 3, y - s);
      ctx.lineTo(x + s, y - s);
      ctx.lineTo(x + s, y - s + 3);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x - s, y + s - 3);
      ctx.lineTo(x - s, y + s);
      ctx.lineTo(x - s + 3, y + s);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + s - 3, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s, y + s - 3);
      ctx.stroke();

      // Debug telemetry label near 2 forward feet
      if (this.index === 0 || this.index === 4) {
        ctx.font = '8px monospace';
        ctx.fillStyle = CONFIG.colors.primary;
        ctx.fillText(`[${Math.round(this.footX)},${Math.round(this.footY)}] <${this.anchorTag}>`, x + 9, y + 3);
      }
    }
  }

  /* ---------------------------------------------------------
     6. Procedural Spider Entity & Gait Engine
     --------------------------------------------------------- */
  class SpiderCrawler {
    constructor() {
      // Page coordinates
      this.x = window.scrollX + window.innerWidth * 0.5;
      this.y = window.scrollY + window.innerHeight * 0.4;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.targetAngle = 0;

      // Control & Target
      this.targetX = this.x;
      this.targetY = this.y;
      this.mode = 'cursor'; // 'cursor' | 'autonomous' | 'dart' | 'rappel'
      this.lastMouseActivity = performance.now();
      this.isPaused = false;
      this.isVisible = true;

      // Micro-pause arachnid behavior
      this.pauseTimer = 0;
      this.isMicroPaused = false;

      // Fast scroll / rappel state
      this.lastScrollY = window.scrollY;
      this.scrollVelocity = 0;

      // Gait Engine: Tetrapod alternating phases
      this.gaitGroup = 0; // 0 or 1
      this.gaitTimer = 0;
      this.isWalking = false;

      // Secondary abdomen physics
      this.abdomenAngle = 0;
      this.abdomenOffsetX = 0;
      this.abdomenOffsetY = 0;

      // Subsystems
      this.scanner = new DOMSpatialScanner();
      this.silk = new SilkWebTrail();
      this.autonomousTarget = null;
      this.autonomousTimer = 0;

      // Setup 8 Legs
      // L1, L2, L3, L4 (angles: -38°, -70°, -110°, -145°)
      // R1, R2, R3, R4 (angles: +38°, +70°, +110°, +145°)
      const s = CONFIG.scale;
      this.legs = [
        new SpiderLeg(0, -1, -Math.PI * 0.22, 64 * s),
        new SpiderLeg(1, -1, -Math.PI * 0.40, 72 * s),
        new SpiderLeg(2, -1, -Math.PI * 0.62, 70 * s),
        new SpiderLeg(3, -1, -Math.PI * 0.82, 62 * s),
        new SpiderLeg(4,  1,  Math.PI * 0.22, 64 * s),
        new SpiderLeg(5,  1,  Math.PI * 0.40, 72 * s),
        new SpiderLeg(6,  1,  Math.PI * 0.62, 70 * s),
        new SpiderLeg(7,  1,  Math.PI * 0.82, 62 * s)
      ];

      // Coxa mounting offsets relative to body center
      this.coxaMounts = [
        { angle: -Math.PI * 0.25, dist: 14 * s },
        { angle: -Math.PI * 0.45, dist: 16 * s },
        { angle: -Math.PI * 0.65, dist: 16 * s },
        { angle: -Math.PI * 0.85, dist: 14 * s },
        { angle:  Math.PI * 0.25, dist: 14 * s },
        { angle:  Math.PI * 0.45, dist: 16 * s },
        { angle:  Math.PI * 0.65, dist: 16 * s },
        { angle:  Math.PI * 0.85, dist: 14 * s }
      ];

      // Initialize leg positions
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

      // 1. Check Idle for Autonomous Roaming
      if (this.mode === 'cursor' && now - this.lastMouseActivity > CONFIG.idleTimeoutMs) {
        this.mode = 'autonomous';
        this.autonomousTimer = 0;
        this.pickAutonomousTarget();
      }

      // 2. Autonomous Navigation Behavior
      if (this.mode === 'autonomous') {
        this.updateAutonomous(dt);
      }

      // 3. Scroll Synchronization & Rappel Check
      const curScrollY = window.scrollY;
      this.scrollVelocity = curScrollY - this.lastScrollY;
      this.lastScrollY = curScrollY;

      // If extreme scroll velocity detected, spider rappels on silk
      if (Math.abs(this.scrollVelocity) > 35) {
        this.mode = 'rappel';
        // Drag body with viewport
        this.targetY += this.scrollVelocity * 0.8;
      } else if (this.mode === 'rappel' && Math.abs(this.scrollVelocity) < 5) {
        this.mode = 'cursor';
      }

      // 4. Locomotion & Steering Physics
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distToTarget = Math.hypot(dx, dy);

      // Micro-pause simulation (sporadic arachnid freeze-and-look)
      if (this.mode === 'cursor' && distToTarget > 40 && !this.isMicroPaused) {
        this.pauseTimer += dt;
        if (this.pauseTimer > 2800) {
          if (Math.random() < 0.35) {
            this.isMicroPaused = true;
            setTimeout(() => { this.isMicroPaused = false; }, 220);
          }
          this.pauseTimer = 0;
        }
      }

      let speedMax = (this.mode === 'dart') ? CONFIG.dartVelocity : CONFIG.maxVelocity;

      if (distToTarget > 12 && !this.isMicroPaused) {
        this.isWalking = true;
        this.targetAngle = Math.atan2(dy, dx);

        // Smooth acceleration towards target
        const accel = (this.mode === 'dart') ? 0.35 : 0.18;
        const targetVx = (dx / distToTarget) * Math.min(distToTarget * 0.12, speedMax);
        const targetVy = (dy / distToTarget) * Math.min(distToTarget * 0.12, speedMax);

        this.vx = lerp(this.vx, targetVx, accel);
        this.vy = lerp(this.vy, targetVy, accel);
      } else {
        this.isWalking = false;
        this.vx *= 0.82;
        this.vy *= 0.82;
        if (this.mode === 'dart' && distToTarget <= 15) {
          this.mode = 'cursor';
        }
      }

      this.x += this.vx;
      this.y += this.vy;

      // Smooth heading rotation
      const diffA = angleDiff(this.angle, this.targetAngle);
      this.angle += diffA * CONFIG.turnSpeed;

      // Abdomen secondary lag physics
      const targetAbdomenA = -this.angle;
      this.abdomenAngle = lerp(this.abdomenAngle, targetAbdomenA, 0.15);

      // 5. Update Gait & Leg Steps
      this.updateLegs(dt);

      // 6. Update Trailing Silk Web
      const spinneret = this.getSpinneretPosition();
      this.silk.update(spinneret.x, spinneret.y);

      // Add anchor point periodically if moving
      if (this.isWalking && Math.random() < 0.08) {
        this.silk.addAnchor(spinneret.x, spinneret.y);
      }
    }

    pickAutonomousTarget() {
      const elData = this.scanner.getRandomInterestingElement();
      if (elData) {
        this.autonomousTarget = elData;
        // Target an edge or center of the element
        const offsetPctX = 0.2 + Math.random() * 0.6;
        const offsetPctY = 0.2 + Math.random() * 0.6;
        this.targetX = elData.pageX + elData.rect.width * offsetPctX;
        this.targetY = elData.pageY + elData.rect.height * offsetPctY;
      } else {
        // Roam within visible screen
        this.targetX = window.scrollX + window.innerWidth * (0.2 + Math.random() * 0.6);
        this.targetY = window.scrollY + window.innerHeight * (0.2 + Math.random() * 0.6);
      }
    }

    updateAutonomous(dt) {
      this.autonomousTimer += dt;
      const d = dist(this.x, this.y, this.targetX, this.targetY);

      if (d < 25 || this.autonomousTimer > 4500) {
        this.autonomousTimer = 0;
        this.pickAutonomousTarget();
      }
    }

    updateLegs(dt) {
      // 1. Advance stepping legs
      const stepSpeedMult = (this.mode === 'dart') ? 2.2 : 1.0;
      let anyLegStepping = false;

      for (const leg of this.legs) {
        if (leg.isStepping) {
          leg.updateStep(stepSpeedMult);
          anyLegStepping = true;
        }
      }

      // 2. Evaluate if current group should step
      const currentGroupLegs = this.legs.filter(l => l.group === this.gaitGroup);
      const otherGroupLegs = this.legs.filter(l => l.group !== this.gaitGroup);

      // Check if any leg in current group is overstretched or displaced
      let needsStep = false;
      for (const leg of currentGroupLegs) {
        const ideal = leg.getIdealTarget(this.x, this.y, this.angle, this.vx, this.vy);
        const d = dist(leg.footX, leg.footY, ideal.x, ideal.y);
        if (d > CONFIG.stepDistanceThreshold || (this.isWalking && d > 20 * CONFIG.scale)) {
          needsStep = true;
          break;
        }
      }

      // Step legs of active group if other group is stable/planted
      const otherGroupPlanted = otherGroupLegs.every(l => !l.isStepping);

      if (needsStep && otherGroupPlanted) {
        for (const leg of currentGroupLegs) {
          if (!leg.isStepping) {
            const ideal = leg.getIdealTarget(this.x, this.y, this.angle, this.vx, this.vy);
            // Snap to closest DOM foothold
            const snapped = this.scanner.findClosestFoothold(ideal.x, ideal.y, 50 * CONFIG.scale);
            leg.triggerStep(ideal.x, ideal.y, snapped, this.scanner, this.x, this.y);
          }
        }
        // Alternate tetrapod group
        this.gaitGroup = 1 - this.gaitGroup;
      }

      // 3. Solve IK for all legs from coxa base
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
      // Abdomen extends backwards along -angle
      const abdomenDist = 26 * CONFIG.scale;
      return {
        x: this.x - Math.cos(this.angle) * abdomenDist,
        y: this.y - Math.sin(this.angle) * abdomenDist
      };
    }

    render(ctx, scrollX, scrollY) {
      if (!this.isVisible) return;

      const screenX = this.x - scrollX;
      const screenY = this.y - scrollY;

      // 1. Render Trailing Silk Web
      this.silk.render(ctx, scrollX, scrollY);

      // 2. Render 8 Multi-Segment IK Legs
      for (const leg of this.legs) {
        leg.render(ctx, scrollX, scrollY);
      }

      // 3. Render Central Body (Abdomen & Cephalothorax)
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.angle);
      ctx.scale(CONFIG.scale, CONFIG.scale);

      // Render Abdomen (Rear Body)
      this.renderAbdomen(ctx);

      // Render Cephalothorax (Front Body & Optics)
      this.renderCephalothorax(ctx);

      ctx.restore();

      // 4. Render Scanning Laser Sensor Beam if in Autonomous Mode
      if (this.mode === 'autonomous' && this.autonomousTarget) {
        this.renderScanningBeam(ctx, screenX, screenY, scrollX, scrollY);
      }
    }

    renderAbdomen(ctx) {
      ctx.save();
      ctx.translate(-16, 0);

      // Outer hull
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.colors.bodyDark;
      ctx.fill();
      ctx.strokeStyle = CONFIG.colors.primary;
      ctx.lineWidth = 1.3;
      ctx.shadowColor = CONFIG.colors.glow;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Cyber internal telemetry ribs
      ctx.beginPath();
      ctx.arc(-4, 0, 8, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.arc(-8, 0, 5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.strokeStyle = CONFIG.colors.secondary;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Spinneret node at rear
      ctx.beginPath();
      ctx.arc(-16, 0, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = CONFIG.colors.primary;
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.restore();
    }

    renderCephalothorax(ctx) {
      // Pedicel (waist connector)
      ctx.beginPath();
      ctx.rect(-6, -3, 6, 6);
      ctx.fillStyle = CONFIG.colors.primary;
      ctx.fill();

      // Cephalothorax Faceted Cyber Shell
      ctx.beginPath();
      ctx.moveTo(14, 0);      // Front rostrum
      ctx.lineTo(8, -8);      // Front-left shoulder
      ctx.lineTo(-4, -9);     // Mid-left flank
      ctx.lineTo(-8, -4);     // Rear-left waist
      ctx.lineTo(-8, 4);      // Rear-right waist
      ctx.lineTo(-4, 9);      // Mid-right flank
      ctx.lineTo(8, 8);       // Front-right shoulder
      ctx.closePath();

      ctx.fillStyle = CONFIG.colors.bodyDark;
      ctx.fill();
      ctx.strokeStyle = CONFIG.colors.primary;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = CONFIG.colors.glow;
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Center Cyber Core Glyph
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.colors.secondary;
      ctx.fill();

      // Chelicerae / Pedipalps (Front feelers)
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = CONFIG.colors.secondary;

      // Left palp
      ctx.beginPath();
      ctx.moveTo(12, -4);
      ctx.lineTo(19, -6);
      ctx.lineTo(22, -3);
      ctx.stroke();

      // Right palp
      ctx.beginPath();
      ctx.moveTo(12, 4);
      ctx.lineTo(19, 6);
      ctx.lineTo(22, 3);
      ctx.stroke();

      // Optical Sensor Cluster (Glowing Eyes)
      const eyes = [
        { x: 13, y: -2, r: 1.5, c: '#ffffff' },
        { x: 13, y: 2,  r: 1.5, c: '#ffffff' },
        { x: 10, y: -5, r: 1.2, c: CONFIG.colors.primary },
        { x: 10, y: 5,  r: 1.2, c: CONFIG.colors.primary },
        { x: 7,  y: -6, r: 1.0, c: CONFIG.colors.secondary },
        { x: 7,  y: 6,  r: 1.0, c: CONFIG.colors.secondary }
      ];

      for (const eye of eyes) {
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
        ctx.fillStyle = eye.c;
        ctx.shadowColor = CONFIG.colors.primary;
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
      grad.addColorStop(0, 'rgba(94, 234, 212, 0.45)');
      grad.addColorStop(0.7, 'rgba(94, 234, 212, 0.15)');
      grad.addColorStop(1, 'rgba(94, 234, 212, 0)');

      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(targetCenterX - 20, targetCenterY - 10);
      ctx.lineTo(targetCenterX + 20, targetCenterY + 10);
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
      this.toggleBtn = null;
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
            <span>CRAWLER // IK.v2</span>
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
            <span class="spider-hud-value" id="spider-hud-target">&lt;CURSOR&gt;</span>
          </div>
          <div class="spider-hud-row">
            <span class="spider-hud-label">COORDS</span>
            <span class="spider-hud-value" id="spider-hud-coords">0, 0</span>
          </div>
          <div class="spider-hud-row">
            <span class="spider-hud-label">ENGINE</span>
            <span class="spider-hud-value" id="spider-hud-fps">60 FPS // IK 3-JNT</span>
          </div>
          <div class="spider-hud-actions">
            <button type="button" class="spider-btn" id="spider-btn-mode">AUTO HUNT</button>
            <button type="button" class="spider-btn" id="spider-btn-power">PAUSE</button>
          </div>
          <div class="spider-hud-hint">
            Press <kbd>C</kbd> to toggle • Click to shoot silk
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

      // Bind events
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
          this.fpsEl.textContent = `${this.currentFps} FPS // IK OK`;

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
      updateThemeColors();

      // Create transparent fixed overlay canvas
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'spider-crawler-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d', { alpha: true });

      this.resizeCanvas();

      // Initialize Spider entity & HUD
      this.spider = new SpiderCrawler();
      this.hud = new SpiderHUD(this.spider);

      // Initial DOM scan
      this.spider.scanner.scan();

      // Bind interaction listeners
      this.bindEvents();

      // Start 60fps+ Animation Loop
      requestAnimationFrame((t) => this.loop(t));

      console.info('[SpiderCrawler] Procedural Web Crawler initialized.');
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
      // Mouse move tracking
      window.addEventListener('mousemove', (e) => {
        if (!this.spider || this.spider.isPaused) return;
        const pageX = e.clientX + window.scrollX;
        const pageY = e.clientY + window.scrollY;
        this.spider.setTarget(pageX, pageY, 'cursor');
      }, { passive: true });

      // Click to shoot silk web grapple & dart
      window.addEventListener('click', (e) => {
        if (!this.spider || this.spider.isPaused) return;
        // Don't intercept clicks inside the HUD widget
        if (e.target.closest('.spider-hud-widget')) return;

        const pageX = e.clientX + window.scrollX;
        const pageY = e.clientY + window.scrollY;
        this.spider.shootWeb(pageX, pageY);
      }, { passive: true });

      // Keyboard shortcut 'C' to toggle crawler visibility/active state
      window.addEventListener('keydown', (e) => {
        if (e.key === 'c' || e.key === 'C') {
          // If not typing in an input/textarea
          if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
          this.toggleCrawler();
        }
      });

      // Window resize
      window.addEventListener('resize', () => {
        this.resizeCanvas();
        this.spider.scanner.scan();
      }, { passive: true });

      // Window scroll: rescan DOM footholds periodically
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

      // Clear canvas
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
