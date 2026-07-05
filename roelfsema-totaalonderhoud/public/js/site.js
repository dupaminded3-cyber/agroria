(function () {
  var knop = document.querySelector('.hamburger');
  var menu = document.getElementById('mobiel-menu');
  if (!knop || !menu) return;

  knop.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    knop.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      menu.classList.remove('is-open');
      knop.setAttribute('aria-expanded', 'false');
    });
  });
})();
