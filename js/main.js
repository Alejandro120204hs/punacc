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
      const from = Number(el.dataset.from || 0);
      const dur = 1600;
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => { el.textContent = el.dataset.from || '0'; io.observe(el); });
  }

  // Línea de tiempo como barra de progreso: el punto avanza, se detiene en cada hito y lo enciende
  const tl = document.querySelector('.mv--timeline .tl');
  if (tl) {
    const track = tl.querySelector('.tl__track');
    const nodes = [...tl.querySelectorAll('.tl__node')];
    const vertical = () => getComputedStyle(track).width === '2px';

    // Posición de cada hito sobre la línea (0 a 1), medida en pantalla
    let stops = [];
    const measure = () => {
      const tr = track.getBoundingClientRect();
      stops = nodes.map((n) => {
        const d = n.querySelector('.tl__dot').getBoundingClientRect();
        const f = vertical()
          ? (d.top + d.height / 2 - tr.top) / tr.height
          : (d.left + d.width / 2 - tr.left) / tr.width;
        return Math.min(1, Math.max(0, f));
      });
    };
    measure();
    window.addEventListener('resize', measure);

    const setP = (p) => {
      tl.style.setProperty('--p', p.toFixed(4));
      nodes.forEach((n, i) => n.classList.toggle('is-on', p >= stops[i] - 0.001));
    };

    if (reducedMotion) {
      setP(1);
    } else {
      const MOVE = 850;    // ms entre un hito y el siguiente
      const PAUSE = 350;   // ms detenido en cada hito
      const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

      // Guion: pausa en cada hito y tramo hasta el siguiente. Se reproduce UNA sola vez.
      const plan = [];
      for (let i = 0; i < stops.length - 1; i++) {
        plan.push({ type: 'pause', d: PAUSE });
        plan.push({ type: 'move', i, d: MOVE });
      }
      const total = plan.reduce((a, s) => a + s.d, 0);

      let t0 = 0;
      const tick = (now) => {
        let t = now - t0;
        if (t >= total) {
          // Terminó: barra llena, todos los hitos encendidos y el punto se apaga
          setP(1);
          tl.style.setProperty('--pulse-o', 0);
          return;
        }
        let p = 0;
        for (const step of plan) {
          if (t <= step.d) {
            if (step.type === 'move') p = stops[step.i] + (stops[step.i + 1] - stops[step.i]) * ease(t / step.d);
            break;
          }
          t -= step.d;
          if (step.type === 'move') p = stops[step.i + 1];
        }
        setP(p);
        requestAnimationFrame(tick);
      };
      setP(0);
      const once = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          once.disconnect();
          measure();
          t0 = performance.now();
          requestAnimationFrame(tick);
        }
      }, { threshold: 0.5 });
      once.observe(tl);
    }
  }

  // Brillo que sigue al mouse dentro de las tarjetas [data-spot]
  document.querySelectorAll('[data-spot]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

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
