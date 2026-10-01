/* ==========================================================================
   NOVA WEB — interactions, défilement & animations
   GSAP 3 + ScrollTrigger (animations) · Lenis (défilement fluide)
   ========================================================================== */
(() => {
  'use strict';

  const html = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const media = query => window.matchMedia(query).matches;

  const reduced = media('(prefers-reduced-motion: reduce)');
  const finePointer = media('(hover: hover) and (pointer: fine)');
  const { gsap, ScrollTrigger } = window;
  const hasGsap = !!(gsap && ScrollTrigger);
  const animated = hasGsap && !reduced;
  const Prism = window.Prism || null;

  clearTimeout(window.__loaderFallback);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* Courbe signature (0.52, 0.01, 0, 1) : départ lent, arrêt net,
     comme une mise au point optique. */
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = t => ((ax * t + bx) * t + cx) * t;
    const sampleY = t => ((ay * t + by) * t + cy) * t;
    const slopeX = t => (3 * ax * t + 2 * bx) * t + cx;
    const solve = x => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const err = sampleX(t) - x;
        if (Math.abs(err) < 1e-6) return t;
        const d = slopeX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 30; i++) {
        const v = sampleX(t);
        if (Math.abs(v - x) < 1e-6) break;
        if (x > v) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return t;
    };
    return p => (p <= 0 ? 0 : p >= 1 ? 1 : sampleY(solve(p)));
  };
  const focus = bezier(0.52, 0.01, 0, 1);
  const expo = bezier(0.16, 1, 0.3, 1);

  let lenis = null;
  let menuOpen = false;
  let closeMenu = () => {};

  /* ---------- Découpage du texte ---------- */
  const splitWords = el => {
    const words = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/([ \t\n\r\f]+)/).forEach(part => {
            if (!part) return;
            if (/^[ \t\n\r\f]+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const outer = document.createElement('span');
            outer.className = 'w';
            const inner = document.createElement('span');
            inner.className = 'wi';
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
            words.push(inner);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    return words;
  };

  const splitChars = el => {
    const text = el.textContent;
    el.textContent = '';
    return Array.from(text).map(ch => {
      const span = document.createElement('span');
      span.className = 'c';
      span.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(span);
      return span;
    });
  };

  /* ---------- Modules sans dépendance ---------- */
  function initClock() {
    $$('.js-year').forEach(el => { el.textContent = new Date().getFullYear(); });
    const clocks = $$('.js-clock');
    if (!clocks.length) return;
    let format = null;
    try {
      format = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Paris' });
    } catch (e) {
      format = null;
    }
    const tick = () => {
      const now = new Date();
      const full = format ? format.format(now) : now.toTimeString().slice(0, 8);
      clocks.forEach(el => { el.textContent = el.hasAttribute('data-seconds') ? full : full.slice(0, 5); });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* Lettres qui roulent : chaque caractère est doublé et glisse au survol. */
  function initRoll() {
    $$('[data-roll]').forEach(el => {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (!text) return;
      const host = el.matches('a, button') ? el : (el.closest('a, button') || el);
      if (!host.hasAttribute('aria-label')) host.setAttribute('aria-label', text);
      const roll = document.createElement('span');
      roll.className = 'roll';
      roll.setAttribute('aria-hidden', 'true');
      // Lettres groupées par mot : un libellé long peut ainsi passer à la ligne entre deux mots
      let i = 0;
      text.split(' ').forEach((word, w) => {
        if (w > 0) { roll.appendChild(document.createTextNode(' ')); i++; }
        const group = document.createElement('span');
        group.className = 'roll__w';
        Array.from(word).forEach(ch => {
          const cell = document.createElement('span');
          cell.className = 'roll__c';
          cell.style.setProperty('--i', i++);
          const a = document.createElement('span');
          a.textContent = ch;
          cell.append(a, a.cloneNode(true));
          group.appendChild(cell);
        });
        roll.appendChild(group);
      });
      el.textContent = '';
      el.appendChild(roll);
    });
  }

  function scrollToTarget(target, immediate = false) {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6, easing: focus, immediate, force: true });
      return;
    }
    const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduced || immediate ? 'auto' : 'smooth' });
  }

  function initAnchors() {
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      if (hash === '#') { event.preventDefault(); return; }
      const target = hash === '#top' ? 0 : document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target === null) return;
      event.preventDefault();
      if (menuOpen) closeMenu();
      scrollToTarget(target);
    });
  }

  function initMenu() {
    const button = $('.nav__burger');
    const menu = $('#menu');
    if (!button || !menu) return;
    const label = $('.nav__burger-label', button);
    menu.inert = true;
    const setOpen = open => {
      menuOpen = open;
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      if (label) label.textContent = open ? 'Fermer' : 'Menu';
      menu.classList.toggle('is-open', open);
      menu.inert = !open;
      html.classList.toggle('menu-open', open);
      $('.nav').classList.remove('is-hidden');
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    };
    closeMenu = () => setOpen(false);
    button.addEventListener('click', () => setOpen(!menuOpen));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuOpen) {
        setOpen(false);
        button.focus();
      }
    });
  }

  function initFaq() {
    const buttons = $$('.faq__q');
    const toggle = (button, open) => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      button.setAttribute('aria-expanded', String(open));
      if (hasGsap) {
        gsap.to(panel, {
          height: open ? 'auto' : 0,
          duration: reduced ? 0 : 0.8,
          ease: focus,
          overwrite: true,
          onComplete: () => ScrollTrigger.refresh(),
        });
      } else {
        panel.style.height = open ? 'auto' : '0px';
      }
    };
    buttons.forEach(button => button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      buttons.forEach(other => {
        if (other !== button && other.getAttribute('aria-expanded') === 'true') toggle(other, false);
      });
      toggle(button, open);
    }));
  }

  /* Le brief ouvre la messagerie du visiteur avec un e-mail pré-rempli. */
  function initForm() {
    const form = $('.brief__form');
    if (!form) return;
    const status = $('.brief__status', form);
    const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const value = key => String(data.get(key) || '').trim();
      const name = value('name');
      const email = value('email');
      const invalid = [];
      if (!name) invalid.push(form.elements.namedItem('name'));
      if (!emailOk(email)) invalid.push(form.elements.namedItem('email'));
      $$('.field', form).forEach(field => field.classList.remove('is-invalid'));

      if (invalid.length) {
        invalid.forEach(input => input.closest('.field').classList.add('is-invalid'));
        invalid[0].focus();
        status.textContent = 'Merci d’indiquer votre nom et une adresse e-mail valide.';
        return;
      }

      const body = [
        `Nom : ${name}`,
        `E-mail : ${email}`,
        `Entreprise : ${value('company') || '—'}`,
        `Type de projet : ${data.getAll('type').join(', ') || 'Non précisé'}`,
        `Formule : ${value('formule') || 'Non précisée'}`,
        '',
        value('message'),
      ].join('\n');
      const subject = `Nouveau projet — ${name}`;
      window.location.href = `mailto:${form.dataset.mailto || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Merci ! Votre messagerie s’ouvre avec la demande pré-remplie.';
    });

    form.addEventListener('input', event => {
      const field = event.target.closest('.field');
      if (field) field.classList.remove('is-invalid');
    });
  }

  /* Cliquer une offre pré-coche le type de projet et la formule du brief. */
  function initOffers() {
    const form = $('.brief__form');
    if (!form) return;
    $$('.offer').forEach(offer => offer.addEventListener('click', () => {
      const { type, formule } = offer.dataset;
      $$('input[name="type"]', form).forEach(input => { if (input.value === type) input.checked = true; });
      $$('input[name="formule"]', form).forEach(input => { input.checked = input.value === formule; });
    }));
  }

  /* Aperçus en direct : l'iframe 1440×900 est réduite à la largeur de la carte. */
  function initLivePreviews() {
    $$('.live').forEach(live => {
      const view = live.parentElement;
      const fit = () => live.style.setProperty('--s', String(view.clientWidth / 1440));
      fit();
      if ('ResizeObserver' in window) new ResizeObserver(fit).observe(view);
      else window.addEventListener('resize', fit);
    });
  }

  /* Fenêtre d'aperçu : tout lien [data-viewer] s'ouvre dans le site au lieu d'un nouvel onglet
     (le href reste le lien de secours, et Ctrl/Cmd+clic ouvre toujours un onglet). */
  function initViewer() {
    const viewer = $('#viewer');
    if (!viewer) return;
    const frame = $('.viewer__frame', viewer);
    const stage = $('.viewer__stage', viewer);
    const title = $('.viewer__title', viewer);
    const openLink = $('.viewer__open', viewer);
    const devices = $('.viewer__devices', viewer);
    const closeButton = $('.viewer__close', viewer);
    const outside = $$('body > header, body > main, body > footer');
    let opener = null;
    let hideTimer = 0;

    const setDevice = device => {
      stage.dataset.device = device;
      $$('.viewer__device', viewer).forEach(button => {
        const active = button.dataset.device === device;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };

    const open = link => {
      clearTimeout(hideTimer);
      opener = link;
      title.textContent = link.dataset.viewerTitle || 'Aperçu';
      frame.title = link.dataset.viewerTitle || 'Aperçu';
      openLink.href = link.href;
      devices.hidden = !link.hasAttribute('data-viewer-devices');
      setDevice('desktop');
      frame.src = link.dataset.viewerSrc || link.href;
      viewer.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => viewer.classList.add('is-open')));
      html.classList.add('viewer-open');
      outside.forEach(el => { el.inert = true; });
      if (lenis) lenis.stop();
      closeButton.focus({ preventScroll: true });
    };

    const close = () => {
      if (viewer.hidden) return;
      viewer.classList.remove('is-open');
      html.classList.remove('viewer-open');
      outside.forEach(el => { el.inert = false; });
      if (lenis) lenis.start();
      hideTimer = setTimeout(() => {
        viewer.hidden = true;
        frame.src = 'about:blank';
      }, reduced ? 0 : 700);
      if (opener) opener.focus({ preventScroll: true });
    };

    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-viewer]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (menuOpen) closeMenu();
      open(link);
    });
    viewer.addEventListener('click', event => {
      if (event.target.closest('[data-close]')) close();
      const device = event.target.closest('.viewer__device');
      if (device) setDevice(device.dataset.device);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }

  initClock();
  initRoll();
  initLivePreviews();
  initViewer();
  initAnchors();
  initMenu();
  initFaq();
  initForm();
  initOffers();

  if (!hasGsap) {
    // CDN indisponible : le site reste entièrement lisible, sans animation.
    $$('.rotator__word').slice(1).forEach(word => { word.hidden = true; });
    $$('.step').forEach(step => step.classList.add('is-active'));
    html.classList.add('is-ready', 'no-anim');
    if (Prism) Prism.intro();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Défilement fluide ---------- */
  function initScroll() {
    if (!animated || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Hero ---------- */
  function initRotator() {
    const rotator = $('.rotator');
    if (!rotator) return { first: [], start() {} };
    const words = $$('.rotator__word', rotator);
    const sets = words.map(word => splitChars(word));
    let index = 0;
    let started = false;

    if (!animated) {
      words.slice(1).forEach(word => { word.hidden = true; });
      return { first: sets[0], start() {} };
    }

    gsap.set(sets.slice(1).flat(), { yPercent: 118 });

    const swap = () => {
      const current = sets[index];
      index = (index + 1) % sets.length;
      const next = sets[index];
      words.forEach((word, i) => word.classList.toggle('is-active', i === index));
      gsap.timeline()
        .to(current, { yPercent: -118, duration: 0.9, ease: focus, stagger: 0.02 })
        .fromTo(next, { yPercent: 118 }, { yPercent: 0, duration: 1.1, ease: focus, stagger: 0.026 }, 0.16);
      rotator.classList.remove('is-glitch');
      void rotator.offsetWidth;
      rotator.classList.add('is-glitch');
      if (Prism) Prism.pulse();
    };

    return {
      first: sets[0],
      start() {
        if (started) return;
        started = true;
        const loop = () => { swap(); gsap.delayedCall(3.2, loop); };
        gsap.delayedCall(2.4, loop);
      },
    };
  }

  function prepareHero() {
    const words = $$('.hero [data-split]').flatMap(line => splitWords(line));
    const rotator = initRotator();
    const intro = $$('[data-intro]');
    const navItems = $$('.nav > *');

    if (animated) {
      gsap.set(words, { yPercent: 118 });
      gsap.set(rotator.first, { yPercent: 118 });
      gsap.set(intro, { y: 28, autoAlpha: 0 });
      gsap.set(navItems, { y: -18, autoAlpha: 0 });

      // En quittant le hero, les lignes se séparent comme un faisceau qui se disperse
      gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
        .to('.hero__line--a', { xPercent: -14, ease: 'none' }, 0)
        .to('.hero__line--b', { xPercent: 12, ease: 'none' }, 0)
        .to('.hero__line--c', { xPercent: -7, ease: 'none' }, 0)
        .to('.hero__title', { yPercent: 22, ease: 'none' }, 0)
        .to('.hero__meta, .hero__bottom', { y: -70, autoAlpha: 0, ease: 'none' }, 0);
    }

    return {
      play() {
        if (Prism) Prism.intro();
        if (!animated) return;
        gsap.timeline({ defaults: { ease: expo } })
          .to(words, { yPercent: 0, duration: 1.6, stagger: 0.075 }, 0.05)
          .to(rotator.first, { yPercent: 0, duration: 1.6, stagger: 0.035 }, 0.3)
          .to(navItems, { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.06 }, 0.4)
          .to(intro, { y: 0, autoAlpha: 1, duration: 1.3, stagger: 0.08 }, 0.6)
          .add(() => rotator.start(), 1.4);
      },
    };
  }

  /* ---------- Projets : défilement horizontal épinglé ---------- */
  function initWork() {
    const section = $('.work');
    if (!section) return;
    const pin = $('.work__pin', section);
    const track = $('.work__track', section);
    const cards = $$('.project', track);
    const bar = $('.work__bar span', section);
    const current = $('.work__current', section);
    const total = $('.work__total', section);
    if (total) total.textContent = `/${String(cards.length).padStart(2, '0')}`;

    // Inclinaison 3D qui suit la souris
    if (finePointer && animated) {
      cards.forEach(card => {
        const target = $('.project__media, .cta-card', card);
        if (!target) return;
        gsap.set(target, { transformPerspective: 1100 });
        const rotX = gsap.quickTo(target, 'rotationX', { duration: 0.9, ease: 'power3.out' });
        const rotY = gsap.quickTo(target, 'rotationY', { duration: 0.9, ease: 'power3.out' });
        card.addEventListener('pointermove', event => {
          const r = target.getBoundingClientRect();
          rotY(((event.clientX - r.left) / r.width - 0.5) * 9);
          rotX(-((event.clientY - r.top) / r.height - 0.5) * 7);
        });
        card.addEventListener('pointerleave', () => { rotX(0); rotY(0); });
      });
    }

    if (!animated) return;

    const mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', () => {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const skewSet = gsap.quickSetter(cards, 'skewX', 'deg');
      const clampSkew = gsap.utils.clamp(-6, 6);
      const proxy = { skew: 0 };

      // Épinglage en CSS (position: sticky) plutôt qu'avec pin: true : GSAP déplacerait
      // la section dans le DOM à chaque recalcul, ce qui recharge les iframes d'aperçu.
      // La section est agrandie de la distance horizontale : c'est la course du sticky.
      const pinOffset = () => parseFloat(getComputedStyle(section).paddingTop) || 0;
      const reserve = () => { section.style.height = `${pinOffset() + pin.offsetHeight + distance()}px`; };
      reserve();
      ScrollTrigger.addEventListener('refreshInit', reserve);

      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: () => `top+=${pinOffset()} top`,
          end: () => `+=${distance()}`,
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: self => {
            if (bar) bar.style.transform = `scaleX(${self.progress})`;
            if (current) current.textContent = String(Math.min(cards.length, 1 + Math.floor(self.progress * cards.length))).padStart(2, '0');
            // Les cartes s'inclinent avec la vitesse de défilement
            const skew = clampSkew(self.getVelocity() / -320);
            if (Math.abs(skew) > Math.abs(proxy.skew)) {
              proxy.skew = skew;
              gsap.to(proxy, { skew: 0, duration: 0.9, ease: 'power3', overwrite: true, onUpdate: () => skewSet(proxy.skew) });
            }
          },
        },
      });

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', reserve);
        section.style.height = '';
        gsap.set(cards, { skewX: 0 });
      };
    });

    mm.add('(max-width: 900px)', () => {
      gsap.set(cards, { y: 50, autoAlpha: 0 });
      const triggers = cards.map(card => ScrollTrigger.create({
        trigger: card,
        start: 'top 90%',
        once: true,
        onEnter: () => gsap.to(card, { y: 0, autoAlpha: 1, duration: 1.2, ease: expo }),
      }));
      return () => {
        triggers.forEach(trigger => trigger.kill());
        gsap.set(cards, { clearProps: 'transform,opacity,visibility' });
      };
    });
  }

  /* ---------- Révélations au défilement ---------- */
  function initReveals() {
    $$('[data-reveal="words"]').forEach(el => {
      const words = splitWords(el);
      if (!animated) return;
      gsap.set(words, { yPercent: 118 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.4, ease: expo, stagger: 0.05 }),
      });
    });

    if (!animated) return;

    $$('[data-reveal="fade"]').forEach(el => {
      gsap.set(el, { y: 36, autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: () => gsap.to(el, { y: 0, autoAlpha: 1, duration: 1.3, ease: expo }),
      });
    });

    $$('[data-stagger]').forEach(group => {
      const items = Array.from(group.children);
      gsap.set(items, { y: 48, autoAlpha: 0 });
      ScrollTrigger.batch(items, {
        start: 'top 92%',
        once: true,
        onEnter: batch => gsap.to(batch, {
          y: 0,
          autoAlpha: 1,
          duration: 1.3,
          ease: expo,
          stagger: 0.09,
          // rend la main au CSS (survols qui jouent sur l'opacité)
          onComplete: () => gsap.set(batch, { clearProps: 'transform,opacity,visibility' }),
        }),
      });
    });
  }

  /* Manifeste : les mots s'allument au rythme du défilement. */
  function initScrub() {
    $$('[data-scrub]').forEach(el => {
      const words = splitWords(el);
      if (!animated) return;
      gsap.fromTo(words, { opacity: 0.12 }, {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: 0.5 },
      });
    });
  }

  /* ---------- Bandeau défilant lié à la vitesse de scroll ---------- */
  function initMarquee() {
    const section = $('.marquee');
    if (!section) return;
    const rows = $$('.marquee__row', section).map(row => ({
      track: $('.marquee__track', row),
      group: $('.marquee__group', row),
      dir: row.classList.contains('marquee__row--rev') ? -1 : 1,
      x: 0,
      width: 0,
    }));

    const fill = () => {
      rows.forEach(row => {
        $$('.marquee__group', row.track).slice(1).forEach(clone => clone.remove());
        row.width = row.group.getBoundingClientRect().width;
        const copies = Math.ceil(window.innerWidth / Math.max(1, row.width)) + 1;
        for (let i = 0; i < copies; i++) {
          const clone = row.group.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          row.track.appendChild(clone);
        }
        row.x = row.dir > 0 ? 0 : -row.width;
      });
    };
    fill();
    if (document.fonts) document.fonts.ready.then(fill);
    if (!animated) return;

    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fill, 200); });

    let velocity = 0;
    let direction = 1;
    let speed = 1;
    let skew = 0;
    let visible = true;
    if (lenis) {
      lenis.on('scroll', instance => {
        velocity = instance.velocity;
        if (instance.direction) direction = instance.direction;
      });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(section);
    }

    gsap.ticker.add((time, deltaMs) => {
      if (!visible) return;
      const f = Math.min(deltaMs / 16.67, 3);
      const target = direction * (1 + Math.min(Math.abs(velocity) * 0.18, 7));
      speed += (target - speed) * 0.08 * f;
      skew += (gsap.utils.clamp(-8, 8, velocity * -0.35) - skew) * 0.12 * f;
      velocity *= Math.pow(0.9, f);
      rows.forEach(row => {
        if (!row.width) return;
        row.x = gsap.utils.wrap(-row.width, 0, row.x - row.dir * speed * 0.9 * f);
        row.track.style.transform = `translate3d(${row.x}px, 0, 0) skewX(${skew}deg)`;
      });
    });
  }

  /* ---------- Expertise : carte prismatique qui suit le curseur ---------- */
  function initServices() {
    const list = $('.services');
    const card = $('.hover-card');
    if (!list || !card || !finePointer || !animated) return;
    const icons = $$('.hover-card__icon', card);
    const label = $('.hover-card__label', card);
    const rows = $$('.service', list);
    const xTo = gsap.quickTo(card, 'x', { duration: 0.75, ease: 'power3.out' });
    const yTo = gsap.quickTo(card, 'y', { duration: 0.75, ease: 'power3.out' });
    const rTo = gsap.quickTo(card, 'rotation', { duration: 0.9, ease: 'power3.out' });
    let lastX = null;
    let idle = 0;

    list.addEventListener('pointerenter', event => {
      gsap.set(card, { x: event.clientX, y: event.clientY });
      lastX = event.clientX;
      card.classList.add('is-active');
    });
    list.addEventListener('pointerleave', () => {
      card.classList.remove('is-active');
      rTo(0);
    });
    list.addEventListener('pointermove', event => {
      xTo(event.clientX);
      yTo(event.clientY);
      if (lastX !== null) rTo(gsap.utils.clamp(-14, 14, (event.clientX - lastX) * 0.9));
      lastX = event.clientX;
      clearTimeout(idle);
      idle = setTimeout(() => rTo(0), 90);
    });
    rows.forEach((row, i) => row.addEventListener('pointerenter', () => {
      icons.forEach((icon, j) => icon.classList.toggle('is-active', j === i));
      if (label) label.textContent = row.dataset.label || '';
    }));
  }

  /* ---------- Chiffres : compteur + mise au point chromatique ---------- */
  function initStats() {
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count) || 0;
      if (!animated || !end) return;
      const num = el.closest('.stat__num') || el;
      const counter = { v: 0 };
      el.textContent = '0';
      ScrollTrigger.create({
        trigger: el,
        start: 'top 96%',
        once: true,
        onEnter: () => gsap.to(counter, {
          v: end,
          duration: 2.2,
          ease: focus,
          onUpdate: () => {
            el.textContent = Math.round(counter.v);
            const s = (1 - counter.v / end) * 0.08;
            num.style.textShadow = s > 0.002
              ? `${-s}em 0 0 rgba(255,42,42,.75), ${s}em 0 0 rgba(42,127,255,.75), 0 ${s * 0.6}em 0 rgba(42,255,42,.5)`
              : 'none';
          },
        }),
      });
    });
  }

  /* La page glisse de l'obsidienne vers l'ardoise, puis revient. */
  function initBand() {
    const band = $('.band');
    const content = band && band.closest('.content');
    if (!band || !content) return;
    gsap.timeline({ scrollTrigger: { trigger: band, start: 'top 70%', end: 'bottom 40%', scrub: true } })
      .fromTo(content, { backgroundColor: '#101010' }, { backgroundColor: '#495764', duration: 1, ease: 'none' })
      .to(content, { backgroundColor: '#495764', duration: 7, ease: 'none' })
      .to(content, { backgroundColor: '#101010', duration: 1, ease: 'none' });
  }

  function initProcess() {
    const list = $('.steps');
    if (!list) return;
    const steps = $$('.step', list);
    const index = $('.process__current');
    const fill = document.createElement('span');
    fill.className = 'steps__fill';
    fill.setAttribute('aria-hidden', 'true');
    list.prepend(fill);

    gsap.to(fill, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: list, start: 'top 62%', end: 'bottom 62%', scrub: true },
    });
    steps.forEach((step, i) => ScrollTrigger.create({
      trigger: step,
      start: 'top 62%',
      end: 'bottom 62%',
      onToggle: self => {
        if (!self.isActive) return;
        steps.forEach(s => s.classList.toggle('is-active', s === step));
        if (index) index.textContent = String(i + 1).padStart(2, '0');
      },
    }));
  }

  /* ---------- Pied de page : logo géant + halo prismatique ---------- */
  function initFooter() {
    const word = $('.footer__word');
    if (!word) return;
    const chars = splitChars(word);
    if (animated) {
      gsap.set(chars, { yPercent: 105 });
      ScrollTrigger.create({
        trigger: word,
        start: 'top bottom', // dernier élément de la page : il doit se déclencher dès qu'il apparaît
        once: true,
        onEnter: () => gsap.to(chars, {
          yPercent: 0,
          duration: 1.5,
          ease: expo,
          stagger: 0.07,
          onComplete: () => gsap.set(chars, { clearProps: 'transform' }),
        }),
      });
    }
    if (!finePointer) return;
    word.addEventListener('pointermove', event => {
      chars.forEach(c => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${event.clientX - r.left}px`);
        c.style.setProperty('--my', `${event.clientY - r.top}px`);
      });
    });
    word.addEventListener('pointerleave', () => chars.forEach(c => {
      c.style.setProperty('--mx', '-999px');
      c.style.setProperty('--my', '-999px');
    }));
  }

  /* ---------- Liaison avec l'artefact WebGL ---------- */
  function initPrismBridge() {
    if (!Prism) return;
    const hero = $('.hero');
    const contact = $('.contact');
    let heroIn = true;
    let contactIn = false;
    const sync = () => Prism.setVisible(heroIn || contactIn);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.target === hero) heroIn = entry.isIntersecting;
          if (entry.target === contact) contactIn = entry.isIntersecting;
        });
        sync();
      });
      if (hero) io.observe(hero);
      if (contact) io.observe(contact);
    }

    if (hero) {
      ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: self => Prism.setScroll(self.progress) });
    }
    if (contact) {
      ScrollTrigger.create({
        trigger: contact,
        start: 'top bottom',
        end: 'top top',
        onUpdate: self => Prism.setContact(self.progress),
        onEnter: () => Prism.pulse(),
      });
    }
    if (finePointer) {
      window.addEventListener('pointermove', event => {
        Prism.setPointer(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight * 2 - 1));
      }, { passive: true });
    }
  }

  /* ---------- Navigation & progression ---------- */
  function initNav() {
    const nav = $('.nav');
    if (!nav) return;
    let last = 0;
    const update = y => {
      nav.classList.toggle('is-scrolled', y > 30);
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      nav.classList.toggle('is-hidden', delta > 0 && y > 240 && !menuOpen);
      last = y;
    };
    if (lenis) lenis.on('scroll', instance => update(instance.scroll));
    else window.addEventListener('scroll', () => update(window.scrollY), { passive: true });
  }

  function initProgress() {
    const bar = $('.progress span');
    if (!bar || !animated) return;
    gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  }

  /* ---------- Curseur ---------- */
  function initCursor() {
    const root = $('.cursor');
    if (!root || !finePointer) return;
    const dot = $('.cursor__dot', root);
    const ring = $('.cursor__ring', root);
    const label = $('.cursor__label', root);
    html.classList.add('has-cursor');

    let mx = -100, my = -100, rx = -100, ry = -100;
    let shown = false;

    window.addEventListener('pointermove', event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      mx = event.clientX;
      my = event.clientY;
      if (!shown) {
        rx = mx;
        ry = my;
        shown = true;
        root.classList.add('is-visible');
      }
    }, { passive: true });
    html.addEventListener('mouseleave', () => { shown = false; root.classList.remove('is-visible'); });
    window.addEventListener('pointerdown', () => root.classList.add('is-down'));
    window.addEventListener('pointerup', () => root.classList.remove('is-down'));

    document.addEventListener('pointerover', event => {
      const el = event.target instanceof Element ? event.target : null;
      const text = el && el.closest('input, textarea, select');
      const labelled = el && el.closest('[data-cursor-label]');
      const hover = el && el.closest('a, button, label, [data-cursor]');
      root.classList.toggle('is-text', !!text);
      if (labelled && !text) {
        label.textContent = labelled.dataset.cursorLabel;
        root.classList.add('is-label');
        root.classList.remove('is-hover');
      } else {
        root.classList.remove('is-label');
        root.classList.toggle('is-hover', !!hover && !text);
      }
    });

    gsap.ticker.add((time, deltaMs) => {
      const k = 1 - Math.pow(0.8, Math.min(deltaMs / 16.67, 4));
      rx += (mx - rx) * k;
      ry += (my - ry) * k;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    });
  }

  /* Boutons magnétiques : ils se laissent attirer par le curseur. */
  function initMagnetic() {
    if (!finePointer || !animated) return;
    $$('[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' });
      el.addEventListener('pointermove', event => {
        const r = el.getBoundingClientRect();
        xTo((event.clientX - r.left - r.width / 2) * strength);
        yTo((event.clientY - r.top - r.height / 2) * strength);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- Écran de chargement ---------- */
  function runLoader() {
    const loader = $('.loader');
    if (!loader || !animated) {
      html.classList.add('is-ready');
      return Promise.resolve();
    }
    const num = $('.loader__num', loader);
    const bar = $('.loader__bar span', loader);
    if (lenis) lenis.stop();
    window.scrollTo(0, 0);

    let visited = false;
    try {
      visited = sessionStorage.getItem('novaweb:visited') === '1';
      sessionStorage.setItem('novaweb:visited', '1');
    } catch (e) {
      visited = false;
    }

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const assets = Promise.race([
      Promise.all([document.fonts ? document.fonts.ready : null, Prism ? Prism.ready : null]),
      wait(4500),
    ]);

    const counter = { v: 0 };
    const count = gsap.to(counter, {
      v: 100,
      duration: visited ? 0.8 : 2,
      ease: focus,
      onUpdate: () => {
        num.textContent = Math.round(counter.v);
        bar.style.transform = `scaleX(${counter.v / 100})`;
        // La dispersion se resserre jusqu'à la netteté parfaite à 100
        const s = (1 - counter.v / 100) * 0.06;
        num.style.textShadow = `${-s}em 0 0 rgba(255,42,42,.85), ${s}em 0 0 rgba(42,127,255,.85), 0 ${s * 0.5}em 0 rgba(42,255,42,.6)`;
      },
    });

    return Promise.all([assets, count.then()]).then(() => new Promise(resolve => {
      num.style.textShadow = 'none';
      gsap.timeline({
        onComplete: () => {
          html.classList.add('is-ready');
          if (lenis) lenis.start();
        },
      })
        .to($$('.loader__top > *, .loader__caption, .loader__num', loader), { yPercent: -120, autoAlpha: 0, duration: 0.8, ease: focus, stagger: 0.04 })
        .to(bar, { scaleX: 0, transformOrigin: 'right center', duration: 0.7, ease: focus }, 0)
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: focus }, 0.35)
        .add(resolve, 0.6);
    }));
  }

  /* ---------- Lancement ---------- */
  initScroll();
  const hero = prepareHero();
  initWork(); // l'épinglage doit exister avant les déclencheurs situés plus bas
  initReveals();
  initScrub();
  initMarquee();
  initServices();
  initStats();
  initBand();
  initProcess();
  initFooter();
  initPrismBridge();
  initProgress();
  initNav();
  initCursor();
  initMagnetic();

  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());

  runLoader().then(() => {
    hero.play();
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) setTimeout(() => scrollToTarget(target), 900);
  });
})();
