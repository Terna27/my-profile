document.addEventListener("DOMContentLoaded", () => {
    // Mobile navigation handler for site header
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

        // Close on link click
        mobileMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                setMenuState(false);
            });
        });

        // Close on outside click
        document.addEventListener("click", (event) => {
            if (header && !header.contains(event.target) && !mobileMenu.contains(event.target)) {
                setMenuState(false);
            }
        });

        // Close on ESC
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setMenuState(false);
            }
        });

        // Reset on desktop resize
        window.addEventListener("resize", () => {
            if (window.innerWidth > 820) {
                setMenuState(false);
            }
        });
    }
});

// Certificate Lightbox Handler
function openCertModal(imageSrc, title, issuer) {
  const modal = document.getElementById('cert-lightbox-modal');
  const modalImg = document.getElementById('cert-modal-img');
  const modalTitle = document.getElementById('cert-modal-title');
  const modalIssuer = document.getElementById('cert-modal-issuer');

  if (!modal || !modalImg) return;

  modalImg.src = imageSrc;
  if (modalTitle) modalTitle.textContent = title || '';
  if (modalIssuer) modalIssuer.textContent = issuer || '';

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCertModalDirect() {
  const modal = document.getElementById('cert-lightbox-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeCertModal(e) {
  if (e.target.id === 'cert-lightbox-modal') {
    closeCertModalDirect();
  }
}

// ESC Key listener to close modals
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeCertModalDirect();
  }
});
