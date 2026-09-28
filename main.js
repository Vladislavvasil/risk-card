/* Синдром больного здания — общий скрипт.
   Подключается и к index.html, и к checklist.html.
   Логика чек-листа срабатывает только там, где он есть.
   Данные никуда не отправляются и не сохраняются. */

(function () {
  'use strict';
    document.documentElement.classList.add('js');
  /* =========================================================
     ЧЕК-ЛИСТ И ОЦЕНКА РИСКА (только на checklist.html)
     ========================================================= */
  /* =========================================================
     ПОЯВЛЕНИЕ КАРТОЧЕК ПРИ ПРОКРУТКЕ (index.html и checklist.html)
     ========================================================= */

  var cards = document.querySelectorAll('.card');

  if (cards.length > 0) {
    if ('IntersectionObserver' in window) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, {
        /* Сработает, когда карточка видна хотя бы на 12 % */
        threshold: 0.12,
        /* Чуть-чуть раньше нижней границы окна — как у Apple */
        rootMargin: '0px 0px -8% 0px'
      });

      /* Ступенчатая задержка: если карточки стоят рядом, они «приходят» по очереди */
      var step = 0;
      var prevTop = -Infinity;

      cards.forEach(function (card) {
        var top = card.getBoundingClientRect().top;

        if (Math.abs(top - prevTop) < 80) {
          step = Math.min(step + 1, 3);   /* не больше 4 ступеней */
        } else {
          step = 0;
        }
        prevTop = top;

        card.style.setProperty('--reveal-delay', (step * 90) + 'ms');
        revealObserver.observe(card);
      });
    } else {
      /* Фолбэк для очень старых браузеров — просто показать всё сразу */
      Array.prototype.forEach.call(cards, function (card) {
        card.classList.add('is-visible');
      });
    }
  }

  var form = document.getElementById('checklist-form');
  if (!form) { return; }

  var inputs       = Array.prototype.slice.call(form.querySelectorAll('.checklist__input'));
  var progressEl   = document.getElementById('checklist-progress');
  var counterEl    = document.getElementById('checklist-counter');
  var checkAllBtn  = document.getElementById('check-all');
  var resetAllBtn  = document.getElementById('reset-all');
  var showBtn      = document.getElementById('show-result');
  var hintEl       = document.getElementById('checklist-hint');

  var resultEl     = document.getElementById('risk-result');
  var badgeEl      = document.getElementById('risk-badge');
  var scoreEl      = document.getElementById('risk-score');
  var summaryEl    = document.getElementById('risk-summary');
  var listEl       = document.getElementById('risk-list');

  var TEXT_DONE = 'выполнено';
  var TEXT_TODO = 'не выполнено';

  if (inputs.length === 0) { return; }

  /* Пороговые значения: доля выполненных пунктов.
     0.75 и выше — низкий риск; от 0.40 до 0.75 — средний; ниже — высокий. */
  var LEVEL_LOW  = 0.75;
  var LEVEL_MID  = 0.40;

  var LEVELS = {
    low: {
      code: 'low',
      label: 'Низкий риск',
      summary: 'По этому учебному чек-листу вы выполнили большинство ' +
        'рекомендованных мер. Воздушная среда в помещении, скорее всего, ' +
        'поддерживается в хорошем состоянии. Продолжайте придерживаться ' +
        'режима проветривания и ухода за техникой.',
      tips: [
        'Продолжайте проветривать несколько раз в день настежь по 10 минут.',
        'Держите кондиционер в чистоте и планируйте профессиональную чистку раз в три месяца.',
        'Раз в сезон проверяйте температуру и влажность в помещении.'
      ]
    },
    mid: {
      code: 'mid',
      label: 'Средний риск',
      summary: 'Часть мер уже выполнена, но несколько важных пунктов ещё ' +
        'не закрыто. Симптомы, связанные с помещением, могут сохраняться. ' +
        'Стоит вернуться к невыполненным пунктам чек-листа — особенно к тем, ' +
        'что касаются вентиляции, проветривания и ухода за кондиционером.',
      tips: [
        'Проверьте работу приточной вентиляции и вытяжки.',
        'Наладьте регулярное проветривание несколько раз в день.',
        'Осмотрите помещение на плесень и уберите найденные источники.',
        'Запланируйте чистку кондиционера, если она не делалась давно.'
      ]
    },
    high: {
      code: 'high',
      label: 'Высокий риск',
      summary: 'Большинство рекомендованных мер пока не выполнено. ' +
        'Качество воздуха в помещении может быть источником недомогания. ' +
        'Начните с самых простых шагов — проветривания и проверки вентиляции, ' +
        'затем постепенно закрывайте остальные пункты чек-листа.',
      tips: [
        'Проветривайте помещение несколько раз в день настежь по 10 минут.',
        'Проверьте, работает ли вытяжка и приток свежего воздуха.',
        'Уберите или изолируйте источники загрязнения: плесень, свежую химию, табачный дым.',
        'Если симптомы не проходят — обратитесь к специалисту.'
      ]
    }
  };

  /* ----- Вспомогательные функции ----- */

  function getDoneCount() {
    return inputs.filter(function (input) { return input.checked; }).length;
  }

  function computeLevel(done, total) {
    var ratio = total > 0 ? done / total : 0;
    if (ratio >= LEVEL_LOW) { return LEVELS.low; }
    if (ratio >= LEVEL_MID) { return LEVELS.mid; }
    return LEVELS.high;
  }

  function renderItem(input) {
    var item = input.closest('.checklist__item');
    if (!item) { return; }
    var status = item.querySelector('[data-status]');

    if (input.checked) {
      item.classList.add('is-done');
      if (status) { status.textContent = TEXT_DONE; }
    } else {
      item.classList.remove('is-done');
      if (status) { status.textContent = TEXT_TODO; }
    }
  }

  function renderProgress() {
    var total = inputs.length;
    var done  = getDoneCount();

    if (progressEl) {
      progressEl.max = total;
      progressEl.value = done;
      progressEl.textContent = done + ' из ' + total;
      progressEl.setAttribute('aria-valuetext', done + ' из ' + total);
    }
    if (counterEl) {
      counterEl.textContent = 'Выполнено ' + done + ' из ' + total;
    }
  }

  function renderResult() {
    if (!resultEl || resultEl.hidden) { return; }

    var total = inputs.length;
    var done  = getDoneCount();
    var level = computeLevel(done, total);

    /* Классы для цветовой темы карточки */
    resultEl.classList.remove('is-low', 'is-mid', 'is-high');
    resultEl.classList.add('is-' + level.code);

    /* Метка уровня */
    if (badgeEl) { badgeEl.textContent = level.label; }

    /* Счёт */
    if (scoreEl) {
      scoreEl.textContent = 'Выполнено ' + done + ' из ' + total;
    }

    /* Резюме */
    if (summaryEl) { summaryEl.textContent = level.summary; }

    /* Список рекомендаций — пересобираем через textContent */
    if (listEl) {
      while (listEl.firstChild) { listEl.removeChild(listEl.firstChild); }

      level.tips.forEach(function (tip) {
        var li = document.createElement('li');
        li.textContent = tip;
        listEl.appendChild(li);
      });
    }
  }

  function renderAll() {
    inputs.forEach(renderItem);
    renderProgress();
    renderResult();
  }

  function setHint(text) {
    if (hintEl) { hintEl.textContent = text || ''; }
  }

  /* ----- Обработчики ----- */

  inputs.forEach(function (input) {
    input.addEventListener('change', function () {
      renderItem(input);
      renderProgress();
      renderResult();
      setHint('');
    });
  });

  if (checkAllBtn) {
    checkAllBtn.addEventListener('click', function () {
      inputs.forEach(function (input) { input.checked = true; });
      renderAll();
      setHint('Отмечены все пункты. Нажмите «Показать результат».');
    });
  }

  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', function () {
      inputs.forEach(function (input) { input.checked = false; });
      renderAll();
      setHint('Отметки сброшены.');
      if (inputs[0]) { inputs[0].focus(); }
    });
  }

  if (showBtn) {
    showBtn.addEventListener('click', function () {
      if (!resultEl) { return; }

      var done = getDoneCount();
      if (done === 0) {
        setHint('Отметьте хотя бы один пункт — тогда получится оценка.');
        return;
      }

      resultEl.hidden = false;
       resultEl.classList.add('is-visible');
      renderResult();

      /* Плавная прокрутка к результату */
      try {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        resultEl.scrollIntoView();
      }

      /* Фокус — на заголовок карточки, чтобы клавиатура «увидела» переход */
      var title = resultEl.querySelector('h2');
      if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
      }
    });
  }

  /* Защита от случайной отправки формы */
  form.addEventListener('submit', function (event) {
    event.preventDefault();
  });

  /* Первичная отрисовка */
  renderAll();
})();