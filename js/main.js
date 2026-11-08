// PunAcc — navegación e intro del hero
(() => {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('menu');

  // Navbar con fondo al hacer scroll
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Menú móvil
  const setMenu = (open) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Resaltar en la barra la sección que se está viendo
  const navLinks = [...menu.querySelectorAll('a[href^="#"]:not(.btn)')];
  const tracked = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  const setActive = (id) => {
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  };
  if ('IntersectionObserver' in window && tracked.length) {
    // Cuenta como "actual" la sección que cruza la mitad de la pantalla
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    tracked.forEach((sec) => spy.observe(sec));
  }
  setActive('inicio');

  // Contadores (ej. 0 → 100 %) cuando entran en pantalla
  const counters = document.querySelectorAll('[data-count]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (counters.length && 'IntersectionObserver' in window && !reducedMotion) {
    const run = (el) => {
      const target = Number(el.dataset.count);
      const dur = 1600;
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => { el.textContent = '0'; io.observe(el); });
  }

  // Animaciones de entrada con AOS
  if (window.AOS) {
    AOS.init({
      duration: 900,
      easing: 'ease-out-cubic',
      once: true,
      offset: 40,
      disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  } else {
    // Si el CDN no carga, mostramos todo sin animación
    document.querySelectorAll('[data-aos]').forEach((el) => el.removeAttribute('data-aos'));
  }
})();
