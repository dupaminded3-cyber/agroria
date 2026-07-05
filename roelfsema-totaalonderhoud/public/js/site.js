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
