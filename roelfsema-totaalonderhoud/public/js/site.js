(function () {
  var knop = document.querySelector('.hamburger');
  var menu = document.getElementById('mobiel-menu');
  if (knop && menu) {
    knop.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      knop.classList.toggle('is-open', open);
      knop.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('is-open');
        knop.classList.remove('is-open');
        knop.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();

// Scroll-reveal: elementen schuiven zacht in beeld zodra ze zichtbaar worden.
(function () {
  var elementen = document.querySelectorAll('.reveal');
  if (!elementen.length) return;

  if (!('IntersectionObserver' in window)) {
    elementen.forEach(function (el) { el.classList.add('is-zichtbaar'); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-zichtbaar');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );

  elementen.forEach(function (el) { observer.observe(el); });
})();

// Zacht meebewegend lichtpunt in de hero, volgt de muis.
(function () {
  var hero = document.querySelector('.hero');
  if (!hero || window.matchMedia('(pointer: coarse)').matches) return;

  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    var x = ((e.clientX - rect.left) / rect.width) * 100;
    var y = ((e.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty('--mx', x + '%');
    hero.style.setProperty('--my', y + '%');
  });
})();

// Lichte 3D-kanteling op de dienstenkaarten, volgt de muis.
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  var kaarten = document.querySelectorAll('.dienst-kaart');
  kaarten.forEach(function (kaart) {
    kaart.addEventListener('mousemove', function (e) {
      var rect = kaart.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      kaart.style.setProperty('--rx', (x * 6).toFixed(2) + 'deg');
      kaart.style.setProperty('--ry', (-y * 6).toFixed(2) + 'deg');
    });
    kaart.addEventListener('mouseleave', function () {
      kaart.style.setProperty('--rx', '0deg');
      kaart.style.setProperty('--ry', '0deg');
    });
  });
})();

// "Terug naar boven"-knop.
(function () {
  var knop = document.getElementById('naar-boven');
  if (!knop) return;

  window.addEventListener(
    'scroll',
    function () {
      knop.classList.toggle('is-zichtbaar', window.scrollY > 640);
    },
    { passive: true }
  );

  knop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// Geanimeerde tellers in de metrics-strip. Ondersteunt waarden als
// "24u", "50+", "100%" door het getal te animeren en het voor-/achtervoegsel
// te behouden.
(function () {
  var tellers = document.querySelectorAll('.js-teller');
  if (!tellers.length) return;

  function animeer(teller) {
    var waarde = teller.getAttribute('data-waarde') || teller.textContent || '';
    var match = waarde.match(/^(\D*)(\d+)(.*)$/);
    if (!match) return; // geen getal: laat staan zoals het is
    var voor = match[1];
    var doel = parseInt(match[2], 10);
    var na = match[3];
    var duur = 1300;
    var start = null;

    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      teller.textContent = voor + Math.round(doel * eased) + na;
      if (p < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  if (!('IntersectionObserver' in window)) {
    tellers.forEach(animeer);
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animeer(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.65 });

  tellers.forEach(function (t) { observer.observe(t); });
})();

// Voor/na-vergelijker: sleep de balk om het verschil te zien.
(function () {
  var sliders = document.querySelectorAll('[data-ba]');
  if (!sliders.length) return;

  sliders.forEach(function (ba) {
    var range = ba.querySelector('[data-ba-range]');
    if (!range) return;
    function update() {
      ba.style.setProperty('--pos', range.value);
    }
    range.addEventListener('input', update);
    update();
  });
})();

// Subtiele parallax op het grote watermerk in de over-ons sectie.
(function () {
  var watermerk = document.querySelector('.over-ons-snippet__watermerk');
  if (!watermerk || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.addEventListener('scroll', function () {
    var y = window.scrollY * -0.04;
    watermerk.style.transform = 'translate(-50%, calc(-50% + ' + y.toFixed(2) + 'px))';
  }, { passive: true });
})();

// Zwevende contactknop: uitklappen van bel/WhatsApp/mail-opties.
(function () {
  var fab = document.getElementById('contact-fab');
  var knop = document.getElementById('contact-fab-knop');
  if (!fab || !knop) return;

  function sluit() {
    fab.classList.remove('is-open');
    knop.setAttribute('aria-expanded', 'false');
    knop.setAttribute('aria-label', 'Contactopties openen');
  }
  function open() {
    fab.classList.add('is-open');
    knop.setAttribute('aria-expanded', 'true');
    knop.setAttribute('aria-label', 'Contactopties sluiten');
  }

  knop.addEventListener('click', function (e) {
    e.stopPropagation();
    if (fab.classList.contains('is-open')) sluit();
    else open();
  });

  document.addEventListener('click', function (e) {
    if (fab.classList.contains('is-open') && !fab.contains(e.target)) sluit();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') sluit();
  });
})();

// Magnetisch gevoel op premium knoppen (desktop).
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  var knoppen = document.querySelectorAll('.btn--accent');
  knoppen.forEach(function (knop) {
    knop.addEventListener('mousemove', function (e) {
      var r = knop.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      knop.style.transform = 'translate(' + (x * 5).toFixed(2) + 'px,' + (y * 4).toFixed(2) + 'px)';
    });
    knop.addEventListener('mouseleave', function () {
      knop.style.transform = '';
    });
  });
})();
