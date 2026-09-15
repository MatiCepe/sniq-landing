/*
 * Reproductor de sniq para las maquetas de landing.
 *
 * Dibuja la misma banda que SoundStamp le quema al MP4: la marca en la cabeza,
 * 48 pastillas centradas, blanco al 45 % lo que falta y el rosa lo ya sonado.
 * Las proporciones salen de ahi y de Waveform.barHeight, para que las tres
 * direcciones no se vayan separando entre si - que es justo el error que las
 * notas del repo ya cuentan haber cometido una vez.
 *
 * Marcado esperado:
 *   <div class="sniq" data-sniq
 *        data-src="…/a.mp4" data-poster="…/a.jpg"
 *        data-peaks="[…48…]"
 *        data-mark="…/sniq_mark.png"></div>
 */
(function () {
  var BAR_DUTY = 0.5;          // Waveform.BAR_DUTY
  var BARS = 48;               // SoundStamp.BARS
  var BAND_RATIO = 0.13;       // SoundStamp.HEIGHT_RATIO
  var MAX_RATIO = 0.72;        // alto maximo de barra sobre el alto de la banda

  var PLAY_SVG =
    '<svg viewBox="0 0 19 21" aria-hidden="true" focusable="false">' +
    '<path d="M1.5 1.9v17.2a1 1 0 0 0 1.52.86l14.4-8.6a1 1 0 0 0 0-1.72L3.02 1.04A1 1 0 0 0 1.5 1.9Z"/></svg>';

  /* La ruta de este script. El fallback del mark tiene que resolver igual
     desde / y desde /en/, asi que cuelga de aca y no de la pagina. */
  var BASE = (function () {
    var s = document.currentScript;
    return s ? s.src.replace(/[^/]*$/, '') : '';
  })();

  var players = [];

  // la etiqueta sigue al idioma del documento
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var PLAY_LABEL = EN ? 'Play this sniq' : 'Oir este sniq';

  // Waveform.barHeight: raiz del pico, y nunca mas baja que ancha. En ese piso
  // la pastilla es un circulo, y una fila de circulos es como se ve el silencio.
  function layoutBars(barsEl, bars, peaks) {
    var w = barsEl.clientWidth, h = barsEl.clientHeight;
    if (!w || !h) return;
    var slot = w / BARS;
    var barW = slot * BAR_DUTY;
    var maxBar = h * MAX_RATIO;
    for (var i = 0; i < BARS; i++) {
      bars[i].style.width = barW + 'px';
      bars[i].style.height = Math.max(Math.sqrt(peaks[i]) * maxBar, barW) + 'px';
      bars[i].style.marginRight = (slot - barW) + 'px';
    }
  }

  function fillBars(barsEl) {
    var made = [];
    for (var i = 0; i < BARS; i++) {
      var b = document.createElement('i');
      barsEl.appendChild(b);
      made.push(b);
    }
    return made;
  }

  function watch(barsEl, layout) {
    layout();
    if (window.ResizeObserver) new ResizeObserver(layout).observe(barsEl);
    else window.addEventListener('resize', layout);
  }

  /* Un cuadro sin revelar: la banda con los 48 picos en cero, o sea la fila de
     puntos con la que el dibujo representa el silencio. Nada grabado todavia. */
  function buildSilence(host) {
    host.innerHTML =
      '<span class="stamp"><img class="mk" alt=""><span class="bars"></span></span>';
    host.querySelector('.mk').src = host.getAttribute('data-mark') ||
      BASE + 'img/sniq_mark.png';
    var barsEl = host.querySelector('.bars');
    var bars = fillBars(barsEl);
    var zero = [];
    for (var i = 0; i < BARS; i++) zero.push(0);
    watch(barsEl, function () { layoutBars(barsEl, bars, zero); });
  }

  function build(host) {
    var peaks;
    try { peaks = JSON.parse(host.getAttribute('data-peaks') || '[]'); }
    catch (e) { peaks = []; }
    while (peaks.length < BARS) peaks.push(0);

    // SoundStamp mide la banda sobre el ANCHO del clip, no sobre el alto:
    //   heightFor(width) = ((width * 0.13).roundToInt() / 2) * 2
    // Y hoy la app se la quema a todos los clips, asi que el cuadro es siempre
    // el area de foto: la misma proporcion para todos los sniqs de la pagina.
    var vw = 800, vh = 1072;                       // todos los clips salen asi
    var band = Math.round(vw * BAND_RATIO / 2) * 2;
    var shown = vh - band;

    host.innerHTML =
      '<button class="sniq-btn" type="button" aria-label="' + PLAY_LABEL + '">' +
        '<span class="shot">' +
          // Sin loop: un sniq son dos segundos y termina. El listener de 'ended' de
          // mas abajo devuelve el velo y vacia la onda, o sea que vuelve a quedar
          // como estaba, listo para tocarlo otra vez.
          '<video playsinline preload="metadata"></video>' +
          '<span class="veil"><span class="play">' + PLAY_SVG + '</span></span>' +
        '</span>' +
        '<span class="stamp"><img class="mk" alt=""><span class="bars"></span></span>' +
      '</button>';

    var btn = host.querySelector('.sniq-btn');
    var shot = host.querySelector('.shot');
    var video = host.querySelector('video');
    var mark = host.querySelector('.mk');
    var barsEl = host.querySelector('.bars');

    video.src = host.getAttribute('data-src');
    video.poster = host.getAttribute('data-poster');
    mark.src = host.getAttribute('data-mark') ||
      BASE + 'img/sniq_mark.png';

    // el alto visible es el del cuadro menos la banda
    shot.style.aspectRatio = vw + ' / ' + shown;
    video.style.height = (vh / shown * 100) + '%';

    var bars = fillBars(barsEl);

    function layout() { layoutBars(barsEl, bars, peaks); }

    var raf = 0, lastN = -1;

    function paint(p) {
      var head = p * BARS;
      var n = Math.floor(head);
      if (n === lastN) return;
      lastN = n;
      for (var i = 0; i < BARS; i++) {
        var on = i < head;
        if (on !== bars[i].classList.contains('on')) bars[i].classList.toggle('on', on);
      }
    }

    function tick() {
      paint(Math.min(video.currentTime / (video.duration || 2), 1));
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      host.classList.remove('playing');
      cancelAnimationFrame(raf);
      lastN = -1;
      paint(0);
    }

    function pauseOthers() {
      for (var i = 0; i < players.length; i++) {
        if (players[i] !== video && !players[i].paused) players[i].pause();
      }
    }

    btn.addEventListener('click', function () {
      if (video.paused) {
        pauseOthers();
        video.muted = false;
        video.play().then(function () {
          host.classList.add('playing');
          cancelAnimationFrame(raf);
          tick();
        }).catch(function () {});
      } else {
        video.pause();
      }
    });

    video.addEventListener('pause', stop);
    video.addEventListener('ended', stop);

    players.push(video);
    watch(barsEl, layout);
  }

  function init() {
    var hosts = document.querySelectorAll('[data-sniq]');
    for (var i = 0; i < hosts.length; i++) build(hosts[i]);
    var quiet = document.querySelectorAll('[data-silence]');
    for (var j = 0; j < quiet.length; j++) buildSilence(quiet[j]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
