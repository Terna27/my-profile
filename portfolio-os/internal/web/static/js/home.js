(() => {
  const slides = [...document.querySelectorAll('.portrait-slide')];
  if (!slides.length) return;
  const dots = [...document.querySelectorAll('.portrait-dot')];
  const skills = [...document.querySelectorAll('#carousel-skills [data-name]')];
  const pause = document.getElementById('portrait-pause');
  const region = document.querySelector('.portrait-showcase');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, skillIndex = 0, timer, paused = motion.matches, hovered = false, focused = false;
  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', String(i !== index));
      if (i === index) slide.loading = 'eager';
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
      dot.setAttribute('aria-pressed', String(i === index));
    });
    document.getElementById('portrait-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    if (skills.length) {
      const skill = skills[skillIndex++ % skills.length];
      document.getElementById('spotlight-skill').textContent = skill.dataset.name;
      document.getElementById('spotlight-category').textContent = skill.dataset.category;
    }
    document.querySelectorAll('.portrait-card').forEach(card => {
      card.classList.remove('card-enter');
      void card.offsetWidth;
      card.classList.add('card-enter');
    });
  }
  function schedule() {
    clearInterval(timer);
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', `${paused ? 'Start' : 'Pause'} portrait rotation`);
    pause.setAttribute('aria-pressed', String(paused));
    if (!paused && !hovered && !focused && !document.hidden) timer = setInterval(() => show(index + 1), 5000);
  }
  dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); schedule(); }));
  pause.addEventListener('click', () => { paused = !paused; schedule(); });
  region.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  region.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  region.addEventListener('focusin', () => { focused = true; schedule(); });
  region.addEventListener('focusout', event => { focused = region.contains(event.relatedTarget); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { paused = motion.matches; schedule(); });
  show(0); schedule();
})();
