// ── Visitor counter ──────────────────────────────────
(async () => {
  try {
    const res  = await fetch('https://api.countapi.xyz/hit/lukaplayground.github.io/visits');
    const data = await res.json();
    const el   = document.getElementById('visitor-count');
    if (el && data.value) {
      el.textContent = 'VISITORS ' + data.value.toLocaleString();
    }
  } catch (_) { /* silently ignore — default "VISITORS 0" stays */ }
})();

(() => {
  const snapContainer   = document.querySelector('.snap-container');
  const dotNav          = document.querySelector('.dot-nav');
  const dots            = Array.from(document.querySelectorAll('.dot'));
  const sectionHome     = document.getElementById('home');
  const sectionAbout    = document.getElementById('about');
  const sectionProjects = document.getElementById('projects');
  const sectionContact  = document.getElementById('contact');

  // ── Helpers ──────────────────────────────────────────

  function setActiveDot(index) {
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  // ── Observers ────────────────────────────────────────

  const sections = [
    { id: 'home', el: sectionHome, index: 0 },
    { id: 'about', el: sectionAbout, index: 1 },
    { id: 'projects', el: sectionProjects, index: 2 },
    { id: 'contact', el: sectionContact, index: 3 }
  ];

  const observerOptions = {
    root: snapContainer,
    threshold: 0.3
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const matched = sections.find(s => s.el === entry.target);
        if (matched) {
          setActiveDot(matched.index);
          if (matched.id === 'contact') {
            dotNav.classList.add('dot-nav--dark');
          } else {
            dotNav.classList.remove('dot-nav--dark');
          }
        }
      }
    });
  }, observerOptions);

  sections.forEach(s => {
    if (s.el) observer.observe(s.el);
  });

  // ── Dot click navigation ──────────────────────────────

  const sectionMap = {
    home:     sectionHome,
    about:    sectionAbout,
    projects: sectionProjects,
    contact:  sectionContact,
  };

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = sectionMap[dot.dataset.section];
      if (target) {
        snapContainer.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }
    });
  });

})();
