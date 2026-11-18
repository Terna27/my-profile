/**
 * Interactive Particle Animations
 * Certificates Particle System (#certificates-particles-canvas)
 */

(function () {
  function start() {
    initCertificatesParticles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* ==========================================================================
     Certificates Particle Background (Confined to Certificates Section)
     ========================================================================== */
  function initCertificatesParticles() {
    const canvas = document.getElementById("certificates-particles-canvas");
    if (!canvas) return;

    const section = document.getElementById("certificates") || canvas.closest(".certificates-section");
    if (!section) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const mouse = {
      x: -1000,
      y: -1000,
      active: false,
      radius: 200,
    };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = section.clientWidth;
      height = section.clientHeight;

      if (width === 0 || height === 0) return;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        resize();
        createParticles();
        if (motion.matches && isCertVisible) drawStatic();
      });
      ro.observe(section);
    } else {
      window.addEventListener("resize", () => {
        resize();
        createParticles();
        if (motion.matches && isCertVisible) drawStatic();
      });
    }

    resize();

    // Mouse tracking confined to section coordinates
    section.addEventListener(
      "mousemove",
      (event) => {
        const rect = section.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
        mouse.active = true;
      },
      { passive: true }
    );

    section.addEventListener("mouseleave", () => {
      mouse.active = false;
    });

    section.addEventListener(
      "touchmove",
      (event) => {
        if (!event.touches.length) return;
        const rect = section.getBoundingClientRect();
        mouse.x = event.touches[0].clientX - rect.left;
        mouse.y = event.touches[0].clientY - rect.top;
        mouse.active = true;
      },
      { passive: true }
    );

    section.addEventListener("touchend", () => {
      mouse.active = false;
    });

    // Mint, Cyan, Orange, and Pink accents with subtle glow against dark navy
    const certColors = [
      { r: 94, g: 234, b: 212 },   // Primary Mint (#5eead4)
      { r: 56, g: 189, b: 248 },   // Vivid Cyan (#38bdf8)
      { r: 255, g: 138, b: 61 },   // Vibrant Orange (#ff8a3d)
      { r: 244, g: 114, b: 182 },  // Hot Pink (#f472b6)
      { r: 45, g: 212, b: 191 },   // Teal (#2dd4bf)
      { r: 0, g: 245, b: 212 },    // Bright Mint (#00f5d4)
      { r: 168, g: 85, b: 247 },   // Violet (#a855f7)
      { r: 127, g: 219, b: 202 },  // Cyan Accent (#7fdbca)
    ];

    class CertParticle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * (width || 800);
        this.y = Math.random() * (height || 500);

        // Calm, smooth drift speeds
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = (Math.random() - 0.5) * 0.45;

        // Clearly visible size
        this.size = Math.random() * 1.8 + 1.4;

        // High alpha for clear visibility against dark navy
        this.alpha = Math.random() * 0.4 + 0.5;

        this.color = certColors[Math.floor(Math.random() * certColors.length)];
        this.noiseOffset = Math.random() * 1000;
        this.life = Math.random() * 1000;
      }

      update() {
        this.life += 0.008;

        // Smooth organic drift
        const noiseX = Math.sin(this.life + this.noiseOffset) * 0.015;
        const noiseY = Math.cos(this.life * 0.9 + this.noiseOffset) * 0.015;
        this.vx += noiseX;
        this.vy += noiseY;

        // Controlled damping for calm movement
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Gentle cursor interaction
        if (mouse.active) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius && dist > 0) {
            const force = (1 - dist / mouse.radius) * 0.6;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
          }
        }

        const maxSpeed = mouse.active ? 1.5 : 0.7;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
          this.vx = (this.vx / speed) * maxSpeed;
          this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Screen wrapping with buffer margin
        const margin = 30;
        if (this.x < -margin) this.x = width + margin;
        if (this.x > width + margin) this.x = -margin;
        if (this.y < -margin) this.y = height + margin;
        if (this.y > height + margin) this.y = -margin;
      }

      draw() {
        const c = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${this.alpha})`;
        ctx.shadowColor = `rgba(${c.r}, ${c.g}, ${c.b}, 0.8)`;
        ctx.shadowBlur = 9;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function getCertParticleCount() {
      const isMobile = width < 768;
      if (isMobile) {
        const count = Math.floor((width * height) / 22000);
        return Math.max(18, Math.min(count, 32));
      }
      const count = Math.floor((width * height) / 18000);
      return Math.max(30, Math.min(count, 65));
    }

    let particles = [];
    function createParticles() {
      if (width === 0 || height === 0) return;
      const count = getCertParticleCount();
      particles = Array.from({ length: count }, () => new CertParticle());
    }
    createParticles();

    function drawCertConnections() {
      const isMobile = width < 768;
      const connectionDistance = isMobile ? 120 : 155;

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const proximity = 1 - distance / connectionDistance;
            // Clearly visible line opacity: 0.12 up to 0.45
            const lineAlpha = (proximity * proximity * 0.38 + proximity * 0.1).toFixed(3);

            // Interpolate colors between connected particles
            const r = Math.round((p1.color.r + p2.color.r) / 2);
            const g = Math.round((p1.color.g + p2.color.g) / 2);
            const b = Math.round((p1.color.b + p2.color.b) / 2);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${lineAlpha})`;
            ctx.lineWidth = 1.0;
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${lineAlpha * 0.7})`;
            ctx.shadowBlur = 4;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    let certFrame = null;
    let isCertVisible = false;

    function shouldAnimateCert() {
      return isCertVisible && !document.hidden && !motion.matches;
    }

    function updateLoop() {
      if (!shouldAnimateCert()) {
        if (certFrame) {
          cancelAnimationFrame(certFrame);
          certFrame = null;
        }
        return;
      }

      ctx.clearRect(0, 0, width, height);
      drawCertConnections();
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      certFrame = requestAnimationFrame(updateLoop);
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      drawCertConnections();
      for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
      }
    }

    function checkCertState() {
      if (shouldAnimateCert()) {
        if (!certFrame) certFrame = requestAnimationFrame(updateLoop);
      } else {
        if (certFrame) {
          cancelAnimationFrame(certFrame);
          certFrame = null;
        }
        if (motion.matches && isCertVisible) {
          drawStatic();
        }
      }
    }

    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          isCertVisible = e.isIntersecting;
          checkCertState();
        });
      }, {
        rootMargin: "80px 0px 80px 0px",
        threshold: 0.01,
      });
      observer.observe(section);
    } else {
      isCertVisible = true;
      checkCertState();
    }

    document.addEventListener("visibilitychange", checkCertState);
    motion.addEventListener("change", checkCertState);

    checkCertState();
  }
})();
