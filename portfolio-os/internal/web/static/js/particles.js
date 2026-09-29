
  (function () {
    const canvas = document.getElementById("hero-particles-canvas");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    /*
     * Mouse state
     */
    const mouse = {
      x: -1000,
      y: -1000,
      active: false,
      radius: 300,
    };

    /*
     * Resize canvas to the entire viewport
     */
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener("resize", resize);

    resize();

    /*
     * Mouse tracking
     */
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

    /*
     * Touch devices
     */
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

    /*
     * Particle colors
     */
    const colors = [
      {
        r: 245,
        g: 208,
        b: 97,
      },

      {
        r: 230,
        g: 57,
        b: 70,
      },

      {
        r: 0,
        g: 245,
        b: 212,
      },

      {
        r: 168,
        g: 85,
        b: 247,
      },

      {
        r: 255,
        g: 0,
        b: 110,
      },

      {
        r: 56,
        g: 189,
        b: 248,
      },
    ];

    /*
     * Particle class
     */
    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;

        this.y = Math.random() * height;

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

        /*
         * Organic random movement
         */
        const noiseX = Math.sin(this.life + this.noiseOffset) * 0.035;

        const noiseY = Math.cos(this.life * 0.9 + this.noiseOffset) * 0.035;

        this.vx += noiseX;
        this.vy += noiseY;

        /*
         * Keep normal movement controlled
         */
        this.vx *= 0.985;
        this.vy *= 0.985;

        /*
         * Mouse interaction
         */
        if (mouse.active) {
          const dx = this.x - mouse.x;

          const dy = this.y - mouse.y;

          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < mouse.radius) {
            /*
             * Direction from cursor
             */
            const directionX = dx / (distance || 1);

            const directionY = dy / (distance || 1);

            /*
             * How strongly the cursor
             * affects this particle.
             */
            const influence = 1 - distance / mouse.radius;

            /*
             * Target distance from cursor.
             *
             * Particles closer to the cursor
             * are pushed further away.
             */
            const targetRadius = 80 + influence * 130;

            /*
             * Give every particle a slightly
             * different orbital position.
             */
            this.orbitAngle += this.orbitSpeed;

            /*
             * Circular target position
             */
            const targetX =
              mouse.x +
              Math.cos(this.orbitAngle + this.noiseOffset) * targetRadius;

            const targetY =
              mouse.y +
              Math.sin(this.orbitAngle + this.noiseOffset) * targetRadius;

            /*
             * Pull particles rapidly toward
             * their cursor perimeter.
             */
            const attraction = 0.018 + influence * 0.12;

            this.vx += (targetX - this.x) * attraction;

            this.vy += (targetY - this.y) * attraction;

            /*
             * Add radial repulsion.
             *
             * This prevents particles from
             * collapsing directly onto the
             * cursor.
             */
            const repulsion = Math.max(0, 1 - distance / 120);

            this.vx += directionX * repulsion * 1.5;

            this.vy += directionY * repulsion * 1.5;
          }
        }

        /*
         * Limit particle speed
         */
        const maxSpeed = mouse.active ? 5 : 1.2;

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        if (speed > maxSpeed) {
          this.vx = (this.vx / speed) * maxSpeed;

          this.vy = (this.vy / speed) * maxSpeed;
        }

        /*
         * Move
         */
        this.x += this.vx;
        this.y += this.vy;

        /*
         * Screen wrapping.
         *
         * Instead of bouncing, particles
         * disappear from one side and
         * naturally enter from the other.
         */
        const margin = 50;

        if (this.x < -margin) {
          this.x = width + margin;
        }

        if (this.x > width + margin) {
          this.x = -margin;
        }

        if (this.y < -margin) {
          this.y = height + margin;
        }

        if (this.y > height + margin) {
          this.y = -margin;
        }
      }

      draw() {
        const color = this.color;

        /*
         * Main particle
         */
        ctx.beginPath();

        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

        ctx.fillStyle = `rgba(
          ${color.r},
          ${color.g},
          ${color.b},
          ${this.alpha}
        )`;

        ctx.shadowColor = `rgb(
          ${color.r},
          ${color.g},
          ${color.b}
        )`;

        ctx.shadowBlur = 12;

        ctx.fill();

        ctx.shadowBlur = 0;
      }
    }

    /*
     * Particle count.
     *
     * Automatically scales with screen size.
     */
    function getParticleCount() {
      const area = width * height;

      const count = Math.floor(area / 11000);

      return Math.max(45, Math.min(count, 150));
    }

    let particles = [];

    function createParticles() {
      const count = getParticleCount();

      particles = Array.from(
        {
          length: count,
        },
        function () {
          return new Particle();
        }
      );
    }

    createParticles();

    window.addEventListener("resize", function () {
      createParticles();
    });

    /*
     * Draw subtle connections between
     * nearby particles.
     */
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

            ctx.strokeStyle = `rgba(
              150,
              180,
              220,
              ${opacity}
            )`;

            ctx.lineWidth = 0.6;

            ctx.stroke();
          }
        }
      }
    }

    /*
     * Draw a very subtle cursor field.
     *
     * This makes the perimeter around
     * the mouse easier to perceive.
     */
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

    /*
     * Animation
     */
    let frame;
    function animate() {
      ctx.clearRect(0, 0, width, height);

      drawCursorField();

      drawConnections();

      for (let i = 0; i < particles.length; i++) {
        if (!motion.matches) particles[i].update();
        particles[i].draw();
      }

      if (!motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
    }

    function restart() {
      cancelAnimationFrame(frame);
      if (!document.hidden) animate();
    }
    document.addEventListener("visibilitychange", restart);
    motion.addEventListener("change", restart);
    animate();
  })();
