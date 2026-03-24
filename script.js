(() => {
  const snapContainer   = document.querySelector('.snap-container');
  const dotNav          = document.querySelector('.dot-nav');
  const dots            = Array.from(document.querySelectorAll('.dot'));
  const sectionHome     = document.getElementById('home');
  const sectionProjects = document.getElementById('projects');
  const sectionContact  = document.getElementById('contact');

  // ── Helpers ──────────────────────────────────────────

  function setActiveDot(index) {
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  // ── Observers ────────────────────────────────────────

  // Hero: activate dot[0] when ≥50% visible;
  // on exit pre-activate dot[1] to fill the rootMargin gap window
  // (Projects observer uses rootMargin which creates a detection gap).
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      setActiveDot(0);
      dotNav.classList.remove('dot-nav--dark');
    } else {
      setActiveDot(1); // Hero is exiting — Projects must be approaching
    }
  }, { root: snapContainer, threshold: 0.5 })
    .observe(sectionHome);

  // Projects: activate dot[1] when midpoint enters view.
  // Fixed 100px margins avoid tiny detection band on short mobile viewports.
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      setActiveDot(1);
    }
  }, { root: snapContainer, threshold: 0, rootMargin: '-100px 0px -100px 0px' })
    .observe(sectionProjects);

  // Contact: activate dot[2] + dark mode on entry; restore on exit.
  new IntersectionObserver(entries => {
    const entry = entries[0];
    if (entry.isIntersecting) {
      setActiveDot(2);
      dotNav.classList.add('dot-nav--dark');
    } else {
      dotNav.classList.remove('dot-nav--dark');
      // Pick dot[0] or dot[1] based on scroll position relative to
      // Projects midpoint — runtime computed, handles Projects taller than 100vh.
      const projectsMid = sectionProjects.offsetTop + sectionProjects.offsetHeight / 2;
      setActiveDot(snapContainer.scrollTop < projectsMid ? 0 : 1);
    }
  }, { root: snapContainer, threshold: 0.5 })
    .observe(sectionContact);

  // ── Dot click navigation ──────────────────────────────

  const sectionMap = {
    home:     sectionHome,
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
