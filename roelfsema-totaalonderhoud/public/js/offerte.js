(function () {
  var zone = document.getElementById('upload-zone');
  var input = document.getElementById('upload-input');
  var previews = document.getElementById('foto-previews');
  var teller = document.getElementById('foto-count');
  var foutTekst = document.getElementById('upload-fout');
  if (!zone || !input) return;

  var MAX_FOTOS = parseInt(teller && teller.dataset ? teller.dataset.max : '50', 10) || 50;
  var maxAttr = document.querySelector('.upload-zone__teller');
  if (maxAttr) {
    var match = maxAttr.textContent.match(/\/\s*(\d+)/);
    if (match) MAX_FOTOS = parseInt(match[1], 10);
  }

  var bestanden = [];

  function toonFout(bericht) {
    if (!foutTekst) return;
    if (bericht) {
      foutTekst.textContent = bericht;
      foutTekst.hidden = false;
    } else {
      foutTekst.hidden = true;
      foutTekst.textContent = '';
    }
  }

  function bijwerkenInput() {
    var dt = new DataTransfer();
    bestanden.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
    if (teller) teller.textContent = String(bestanden.length);
  }

  function tekenPreviews() {
    previews.innerHTML = '';
    bestanden.forEach(function (bestand, index) {
      var url = URL.createObjectURL(bestand);
      var item = document.createElement('div');
      item.className = 'foto-preview';
      item.innerHTML = '<img src="' + url + '" alt="" /><button type="button" aria-label="Verwijder foto">&times;</button>';
      item.querySelector('button').addEventListener('click', function () {
        bestanden.splice(index, 1);
        bijwerkenInput();
        tekenPreviews();
      });
      previews.appendChild(item);
    });
  }

  function voegBestandenToe(nieuwe) {
    var lijst = Array.prototype.slice.call(nieuwe).filter(function (f) {
      return f.type.indexOf('image/') === 0;
    });

    var beschikbaar = MAX_FOTOS - bestanden.length;
    if (lijst.length > beschikbaar) {
      toonFout('U kunt maximaal ' + MAX_FOTOS + " foto's toevoegen. Alleen de eerste " + Math.max(beschikbaar, 0) + ' van uw nieuwe selectie zijn toegevoegd.');
      lijst = lijst.slice(0, Math.max(beschikbaar, 0));
    } else {
      toonFout(null);
    }

    bestanden = bestanden.concat(lijst);
    bijwerkenInput();
    tekenPreviews();
  }

  input.addEventListener('change', function (e) {
    voegBestandenToe(e.target.files);
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    zone.addEventListener(evt, function (e) {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(function (evt) {
    zone.addEventListener(evt, function (e) {
      e.preventDefault();
      zone.classList.remove('is-dragover');
    });
  });

  zone.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) {
      voegBestandenToe(e.dataTransfer.files);
    }
  });

  var form = document.getElementById('offerte-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      if (bestanden.length > MAX_FOTOS) {
        e.preventDefault();
        toonFout('U heeft te veel foto\'s geselecteerd (max. ' + MAX_FOTOS + ').');
      }
    });
  }
})();
