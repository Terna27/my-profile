document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-item');
  const fileItems = document.querySelectorAll('.file-item');
  const activityButtons = document.querySelectorAll('.activity-btn');
  const panes = document.querySelectorAll('.dynamic-subpanes-wrapper .tab-content');
  const editorViewport = document.querySelector('.editor-viewport');
  const divider = document.querySelector('.ide-section-divider');

  // Staggered Skill Progress Bar Handler
  function triggerSkillBars() {
    const fills = document.querySelectorAll('#pane-skills .meter-fill');
    fills.forEach((fill) => {
      fill.style.width = '0%';
    });

    fills.forEach((fill, index) => {
      const targetWidth = fill.getAttribute('data-fill') || '0';
      setTimeout(() => {
        fill.style.width = `${targetWidth}%`;
      }, index * 120 + 80);
    });
  }

  // Glowing Typewriter Effect
  const activeTypewriterTimeouts = new Map();

  function startTypewriter(element) {
    const fullText = element.getAttribute('data-text') || element.textContent;
    let isDeleting = false;
    let charIndex = fullText.length;

    if (activeTypewriterTimeouts.has(element)) {
      clearTimeout(activeTypewriterTimeouts.get(element));
    }

    function typeLoop() {
      if (!isDeleting) {
        element.innerHTML = `${fullText.substring(0, charIndex)}<span class="typewriter-cursor"></span>`;
        charIndex++;

        if (charIndex > fullText.length) {
          isDeleting = true;
          const timeoutId = setTimeout(typeLoop, 2400);
          activeTypewriterTimeouts.set(element, timeoutId);
          return;
        }
      } else {
        element.innerHTML = `${fullText.substring(0, charIndex)}<span class="typewriter-cursor"></span>`;
        charIndex--;

        if (charIndex < 0) {
          isDeleting = false;
          charIndex = 0;
          const timeoutId = setTimeout(typeLoop, 500);
          activeTypewriterTimeouts.set(element, timeoutId);
          return;
        }
      }

      const speed = isDeleting ? 40 : 85;
      const timeoutId = setTimeout(typeLoop, speed);
      activeTypewriterTimeouts.set(element, timeoutId);
    }

    typeLoop();
  }

  function playTypewritersInPane(pane) {
    const glowComments = pane.querySelectorAll('.glow-typewriter');
    glowComments.forEach((el) => startTypewriter(el));
  }

  // Main Tab / Viewport Navigation Switcher
  function switchTab(tabKey) {
    if (!tabKey) return;

    // 1. Sync Activity Bar icons
    activityButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });

    // 2. Sync Editor Top Tabs
    tabs.forEach((tab) => {
      const selected = tab.getAttribute('data-tab') === tabKey;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });

    // 3. Sync Sidebar File List
    fileItems.forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabKey);
    });

    // 4. Activate Viewport Pane & Smooth Scroll
    panes.forEach((pane) => {
      const isTarget = pane.id === `pane-${tabKey}`;
      pane.classList.toggle('active', isTarget);
      if (isTarget) {
        playTypewritersInPane(pane);
        if (tabKey === 'skills') {
          triggerSkillBars();
        }

        if (tabKey !== 'home' && divider && editorViewport) {
          const targetOffset = divider.offsetTop - 12;
          editorViewport.scrollTo({
            top: targetOffset,
            behavior: 'smooth'
          });
        } else if (tabKey === 'home' && editorViewport) {
          editorViewport.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }
    });
  }

  // Click Listeners
  activityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-tab');
      if (tabKey) switchTab(tabKey);
    });
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabKey = tab.getAttribute('data-tab');
      if (tabKey) switchTab(tabKey);
    });
  });

  fileItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tabKey = item.getAttribute('data-tab');
      if (tabKey) switchTab(tabKey);
    });
  });

  // Initialize Pinned Home Header Animations
  const initialPinned = document.getElementById('pinned-home');
  if (initialPinned) {
    playTypewritersInPane(initialPinned);
  }
});

// Developer Portrait Lightbox Modal Handlers
function openDevModal(imageSrc, name, role) {
  const modal = document.getElementById('dev-portrait-modal');
  const modalImg = document.getElementById('dev-modal-img');
  const modalName = document.getElementById('dev-modal-name');
  const modalRole = document.getElementById('dev-modal-role');

  if (!modal || !modalImg) return;

  modalImg.src = imageSrc;
  modalName.textContent = name || '';
  modalRole.textContent = role || '';

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDevModalDirect() {
  const modal = document.getElementById('dev-portrait-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeDevModal(e) {
  if (e.target.id === 'dev-portrait-modal') {
    closeDevModalDirect();
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeDevModalDirect();
  }
});