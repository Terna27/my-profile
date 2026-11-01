/**
 * Public Client & Credential Interaction Controller
 * Includes:
 * - Mobile Navigation Menu Toggle
 * - Accessible Credential Detail Modal (Focus Trap, Escape, Scroll Locking, Focus Restoration)
 * - Progressive Scroll-Reveal Observer (prefers-reduced-motion safe)
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Mobile navigation handler for site header
  const toggle = document.querySelector(".mobile-nav-toggle") || document.querySelector(".client-menu-toggle");
  const mobileMenu = document.getElementById("mobile-nav-menu") || document.querySelector(".client-mobile-menu");
  const header = document.querySelector(".site-header") || document.querySelector(".client-nav");

  if (toggle && mobileMenu) {
    const setMenuState = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");

      if (open) {
        mobileMenu.removeAttribute("hidden");
        mobileMenu.classList.add("is-open");
        if (header) header.classList.add("menu-open");
      } else {
        mobileMenu.setAttribute("hidden", "");
        mobileMenu.classList.remove("is-open");
        if (header) header.classList.remove("menu-open");
      }
    };

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setMenuState(!isOpen);
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuState(false));
    });

    document.addEventListener("click", (event) => {
      if (header && !header.contains(event.target) && !mobileMenu.contains(event.target)) {
        setMenuState(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileMenu.classList.contains("is-open")) {
        setMenuState(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) {
        setMenuState(false);
      }
    });
  }

  // 2. Accessible Credential Detail Modal Controller
  initCredentialModal();

  // 3. Progressive Scroll Reveal Animations
  initScrollReveal();
});

function initCredentialModal() {
  const modal = document.getElementById("credential-detail-modal");
  if (!modal) return;

  const modalImg = document.getElementById("modal-cred-img");
  const modalFallback = document.getElementById("modal-cred-fallback");
  const modalGlyph = document.getElementById("modal-cred-glyph");
  const modalType = document.getElementById("modal-cred-type");
  const modalIssuer = document.getElementById("modal-cred-issuer");
  const modalTitle = document.getElementById("modal-cred-title");
  const modalDate = document.getElementById("modal-cred-date");
  const modalDateWrap = document.getElementById("modal-cred-date-wrap");
  const modalId = document.getElementById("modal-cred-id");
  const modalIdWrap = document.getElementById("modal-cred-id-wrap");
  const modalDesc = document.getElementById("modal-cred-desc");
  const modalDescWrap = document.getElementById("modal-cred-desc-wrap");
  const modalVerifyLink = document.getElementById("modal-cred-verify-link");
  const modalCloseBtn = modal.querySelector(".credential-modal-close");

  let previousActiveElement = null;

  function openModal(data, triggerEl) {
    previousActiveElement = triggerEl || document.activeElement;

    // Set Credential Type
    const credType = data.type || "Credential";
    if (modalType) modalType.textContent = credType.toUpperCase();

    // Set Title & Issuer
    if (modalTitle) modalTitle.textContent = data.title || "Verified Credential";
    if (modalIssuer) modalIssuer.textContent = data.issuer || "";

    // Set Date
    if (modalDateWrap) {
      if (data.date && data.date.trim()) {
        if (modalDate) modalDate.textContent = data.date;
        modalDateWrap.style.display = "inline-flex";
      } else {
        modalDateWrap.style.display = "none";
      }
    }

    // Set Credential ID
    if (modalIdWrap) {
      if (data.id && data.id.trim()) {
        if (modalId) modalId.textContent = data.id;
        modalIdWrap.style.display = "inline-flex";
      } else {
        modalIdWrap.style.display = "none";
      }
    }

    // Set Description
    if (modalDescWrap) {
      if (data.desc && data.desc.trim()) {
        if (modalDesc) modalDesc.textContent = data.desc;
        modalDescWrap.style.display = "block";
      } else {
        modalDescWrap.style.display = "none";
      }
    }

    // Set Artwork / Image
    const isBadge = (data.type || "").toLowerCase().includes("badge");
    const fallbackIcon = isBadge ? "🎖️" : "📜";
    if (modalGlyph) modalGlyph.textContent = fallbackIcon;

    if (modalImg && modalFallback) {
      if (data.image && data.image.trim()) {
        modalImg.onerror = () => {
          modalImg.style.display = "none";
          modalFallback.style.display = "flex";
        };
        modalImg.onload = () => {
          modalImg.style.display = "block";
          modalFallback.style.display = "none";
        };
        modalImg.src = data.image;
        modalImg.alt = data.title ? `${data.title} — ${data.issuer}` : "Credential image";
      } else {
        modalImg.style.display = "none";
        modalFallback.style.display = "flex";
      }
    }

    // Set Verification Link
    if (modalVerifyLink) {
      const verifyUrl = (data.verify || "").trim();
      const isValidHttpUrl = /^https?:\/\//i.test(verifyUrl);
      if (isValidHttpUrl) {
        modalVerifyLink.href = verifyUrl;
        modalVerifyLink.style.display = "inline-flex";
      } else {
        modalVerifyLink.style.display = "none";
        modalVerifyLink.removeAttribute("href");
      }
    }

    // Show Dialog
    modal.removeAttribute("hidden");
    requestAnimationFrame(() => {
      modal.classList.add("is-active");
    });

    // Scroll lock background
    document.body.classList.add("modal-scroll-locked");

    // Focus close button or first focusable element
    if (modalCloseBtn) {
      modalCloseBtn.focus();
    }
  }

  function closeModal() {
    if (modal.hasAttribute("hidden")) return;

    modal.classList.remove("is-active");

    const onTransitionEnd = () => {
      modal.setAttribute("hidden", "");
      modal.removeEventListener("transitionend", onTransitionEnd);
    };
    modal.addEventListener("transitionend", onTransitionEnd);
    setTimeout(() => {
      modal.setAttribute("hidden", "");
    }, 250);

    // Remove scroll lock
    document.body.classList.remove("modal-scroll-locked");

    // Restore focus
    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
    previousActiveElement = null;
  }

  // Click delegation for opening credentials
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-open-credential]");
    if (trigger) {
      e.preventDefault();
      const container = trigger.closest("[data-credential-type]") || trigger;
      const data = {
        type: container.getAttribute("data-credential-type") || "Credential",
        title: container.getAttribute("data-title") || "",
        issuer: container.getAttribute("data-issuer") || "",
        date: container.getAttribute("data-date") || "",
        id: container.getAttribute("data-id") || "",
        desc: container.getAttribute("data-desc") || "",
        image: container.getAttribute("data-image") || "",
        verify: container.getAttribute("data-verify") || "",
      };
      openModal(data, trigger);
      return;
    }

    // Close buttons & backdrop click
    if (e.target.closest("[data-close-credential]")) {
      e.preventDefault();
      closeModal();
    }
  });

  // Keyboard navigation & Focus Trapping
  document.addEventListener("keydown", (e) => {
    if (modal.hasAttribute("hidden")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === "Tab") {
      const focusableElements = modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  });
}

function initScrollReveal() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    return;
  }

  document.documentElement.classList.add("has-reveal");

  const revealElements = document.querySelectorAll(".scroll-reveal");
  if (revealElements.length === 0) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  revealElements.forEach((el) => {
    observer.observe(el);
  });
}
