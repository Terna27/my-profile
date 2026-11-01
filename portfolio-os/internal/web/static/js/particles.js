/**
 * Interactive Particle Animations
 * 1. Hero Particle System (#hero-particles-canvas)
 * 2. Certificates Particle System (#certificates-particles-canvas)
 */

(function () {
  function start() {
    initHeroParticles();
    initCertificatesParticles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* ==========================================================================
     1. Hero Particle Background
     ========================================================================== */
  function initHeroParticles() {
    const canvas = document.getElementById("hero-particles-canvas");
    if (!canvas) return;

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
      radius: 300,
    };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener("resize", () => {
      resize();
      createParticles();
      if (motion.matches) drawStatic();
    });
    resize();

    window.addEventListener(
      "mousemove",
      function (event) {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
        mouse.active = true;
      },
      { passive: true }
    );

    window.addEventListener("mouseleave", function () {
      mouse.active = false;
    });

    window.addEventListener(
      "touchmove",
      function (event) {
        if (!event.touches.length) return;
        mouse.x = event.touches[0].clientX;
        mouse.y = event.touches[0].clientY;
        mouse.active = true;
      },
      { passive: true }
    );

    window.addEventListener("touchend", function () {
      mouse.active = false;
    });

    const colors = [
      { r: 245, g: 208, b: 97 },
      { r: 230, g: 57, b: 70 },
      { r: 0, g: 245, b: 212 },
      { r: 168, g: 85, b: 247 },
      { r: 255, g: 0, b: 110 },
      { r: 56, g: 189, b: 248 },
    ];

    class HeroParticle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * (width || 800);
        this.y = Math.random() * (height || 600);
        this.baseX = this.x;
        this.baseY = this.y;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.size = Math.random() * 2.4 + 0.8;
        this.alpha = Math.random() * 0.65 + 0.25;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.angle = Math.random() * Math.PI * 2;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitSpeed = (Math.random() - 0.5) * 0.025;
        this.noiseOffset = Math.random() * 1000;
        this.life = Math.random() * 1000;

        if (!initial) {
          this.x = Math.random() * width;
          this.y = Math.random() * height;
        }
      }

      update() {
        this.life += 0.01;
        const noiseX = Math.sin(this.life + this.noiseOffset) * 0.035;
        const noiseY = Math.cos(this.life * 0.9 + this.noiseOffset) * 0.035;
        this.vx += noiseX;
        this.vy += noiseY;
        this.vx *= 0.985;
        this.vy *= 0.985;

        if (mouse.active) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < mouse.radius) {
            const directionX = dx / (distance || 1);
            const directionY = dy / (distance || 1);
            const influence = 1 - distance / mouse.radius;
            const targetRadius = 80 + influence * 130;

            this.orbitAngle += this.orbitSpeed;
            const targetX =
              mouse.x + Math.cos(this.orbitAngle + this.noiseOffset) * targetRadius;
            const targetY =
              mouse.y + Math.sin(this.orbitAngle + this.noiseOffset) * targetRadius;

            const attraction = 0.018 + influence * 0.12;
            this.vx += (targetX - this.x) * attraction;
            this.vy += (targetY - this.y) * attraction;

            const repulsion = Math.max(0, 1 - distance / 120);
            this.vx += directionX * repulsion * 1.5;
            this.vy += directionY * repulsion * 1.5;
          }
        }

        const maxSpeed = mouse.active ? 5 : 1.2;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
          this.vx = (this.vx / speed) * maxSpeed;
          this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        const margin = 50;
        if (this.x < -margin) this.x = width + margin;
        if (this.x > width + margin) this.x = -margin;
        if (this.y < -margin) this.y = height + margin;
        if (this.y > height + margin) this.y = -margin;
      }

      draw() {
        const color = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${this.alpha})`;
        ctx.shadowColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function getParticleCount() {
      const area = width * height;
      const count = Math.floor(area / 11000);
      return Math.max(45, Math.min(count, 150));
    }

    let particles = [];
    function createParticles() {
      const count = getParticleCount();
      particles = Array.from({ length: count }, () => new HeroParticle());
    }
    createParticles();

    function drawConnections() {
      const connectionDistance = 130;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.09;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(150, 180, 220, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
    }

    function drawCursorField() {
      if (!mouse.active) return;
      const gradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        20,
        mouse.x,
        mouse.y,
        mouse.radius
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.025)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.008)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    let frame = null;
    let isHeroVisible = true;

    function shouldAnimateHero() {
      return isHeroVisible && !document.hidden && !motion.matches;
    }

    function animate() {
      if (!shouldAnimateHero()) {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        return;
      }

      ctx.clearRect(0, 0, width, height);
      drawCursorField();
      drawConnections();

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      frame = requestAnimationFrame(animate);
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      drawConnections();
      for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
      }
    }

    function checkHeroState() {
      if (shouldAnimateHero()) {
        if (!frame) frame = requestAnimationFrame(animate);
      } else {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        if (motion.matches && isHeroVisible) drawStatic();
      }
    }

    const heroSection = document.getElementById("hero") || canvas.parentElement;
    if (heroSection && typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          isHeroVisible = e.isIntersecting;
          checkHeroState();
        });
      }, { threshold: 0.05 });
      observer.observe(heroSection);
    }

    document.addEventListener("visibilitychange", checkHeroState);
    motion.addEventListener("change", checkHeroState);

    checkHeroState();
  }

  /* ==========================================================================
     2. Certificates Particle Background (Confined to Certificates Section)
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

    // Mint & Cyan color accents with subtle glow against dark navy
    const certColors = [
      { r: 94, g: 234, b: 212 },   // Primary Mint (#5eead4)
      { r: 56, g: 189, b: 248 },   // Vivid Cyan (#38bdf8)
      { r: 45, g: 212, b: 191 },   // Teal (#2dd4bf)
      { r: 0, g: 245, b: 212 },    // Bright Mint (#00f5d4)
      { r: 124, g: 224, b: 195 },  // Soft Mint (#7ce0c3)
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

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(94, 234, 212, ${lineAlpha})`;
            ctx.lineWidth = 1.0;
            ctx.shadowColor = `rgba(56, 189, 248, ${lineAlpha * 0.7})`;
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
