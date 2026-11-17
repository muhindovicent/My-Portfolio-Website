(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('nav');
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    menu.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('open', !expanded);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      menu.click();
      menu.focus();
    }
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .05, rootMargin: '0px 0px 30px 0px' });
    document.querySelectorAll('.disciplines>div, .bio>*, .section-title, .feature-project, .experience-strip>*, .row, .case-body').forEach((element, index) => {
      element.classList.add('reveal');
      element.style.setProperty('--delay', (index % 2) * 80 + 'ms');
      element.addEventListener('focusin', () => element.classList.add('visible'));
      observer.observe(element);
    });
    document.documentElement.classList.add('motion-ready');
  }
  const photo = document.querySelector('.hero-art img');
  let pending = false;
  const render = () => {
    pending = false;
    if (photo) photo.style.transform = reduced.matches ? '' : 'translateY(' + Math.min(scrollY * .1, 35) + 'px)';
  };
  const schedule = () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(render);
    }
  };
  addEventListener('scroll', schedule, { passive: true });
  reduced.addEventListener('change', schedule);
  render();
})();
