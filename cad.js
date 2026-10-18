// AutoCAD view: builds a ribbon, a command panel and a pop-up out of the
// documentation already in the page, over a screenshot of model space.
// Without JavaScript (or after "Read as one page") the plain page shows instead.
(function () {
  var root = document.documentElement;
  var main = document.querySelector('main');
  if (!main) return;

  var lang = root.lang === 'id' ? 'id' : 'en';
  var T = {
    en: {
      home: 'Home', about: 'About', layers: 'Layers', info: 'Info', overview: 'Overview',
      commands: 'Commands', search: 'Search for command', close: 'Close',
      docview: 'Read as one page', cadview: 'Open the AutoCAD view',
      typecmd: 'Type a command', unknown: 'Unknown command', zoomed: 'Zoomed in on',
      prev: 'Previous', next: 'Next', layouts: 'Layouts'
    },
    id: {
      home: 'Beranda', about: 'Tentang', layers: 'Layer', info: 'Info', overview: 'Ringkasan',
      commands: 'Command', search: 'Cari command', close: 'Tutup',
      docview: 'Baca sebagai satu halaman', cadview: 'Buka tampilan AutoCAD',
      typecmd: 'Ketik command', unknown: 'Command tidak dikenal', zoomed: 'Zoom ke',
      prev: 'Sebelumnya', next: 'Berikutnya', layouts: 'Layout'
    }
  }[lang];

  // The screenshot (images/cad-model.webp) and where each command's drawing sits in it, in image pixels.
  var IMG_W = 2557, IMG_H = 1256, PHONE_CROP = 1000;
  var ABC = [1120, 73, 1570, 428], TOC = [1074, 960, 1657, 1101], SLG = [1769, 924, 2232, 1183];
  var SPOTS = {
    ad: ABC, cc: ABC, db: ABC,
    dd: [1815, 93, 2173, 428],
    divv: [1066, 569, 1302, 755],
    ds: [1532, 561, 1726, 768],
    num: [1920, 602, 2235, 704],
    pt: TOC, pf: TOC,
    ct: [1135, 960, 1657, 1101],
    cw: [1074, 960, 1140, 1101],
    sl: SLG, sy: SLG,
    rr: [1821, 942, 1975, 1014],
    ee: [1956, 1080, 2184, 1147],
    cs: [1956, 993, 2087, 1147]
  };
  // Commands that zoom in on a part of the interface instead of the drawing.
  var UI_SPOTS = { q: '.cad-layer', wqb: '.cad-layouts', ws: '.cad-layout-ws' };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- what can be opened ----------
  var cmds = Array.prototype.slice.call(main.querySelectorAll('.cmd')).map(function (c) {
    var names = c.querySelector('h3 .name').textContent;
    return {
      kind: 'cmd', id: c.id, node: c,
      label: names, what: c.querySelector('h3 .what').textContent,
      aliases: names.split('/').map(function (s) { return s.trim().toUpperCase(); }),
      section: c.closest('section')
    };
  });
  var byId = {};
  cmds.forEach(function (c) { byId[c.id] = c; });
  ['about', 'start', 'quick', 'toc', 'spec', 'ref', 'request'].forEach(function (id) {
    var n = document.getElementById(id);
    if (n) byId[id] = { kind: 'text', id: id, node: n, label: (n.querySelector('h2, strong') || n).textContent };
  });
  var alias = {};
  cmds.forEach(function (c) { c.aliases.forEach(function (a) { alias[a] = c; }); });

  function unitFor(id) {
    var target = document.getElementById(id);
    if (!target) return null;
    var c = target.closest('.cmd') || target.closest('section, aside');
    return c && byId[c.id] ? { unit: byId[c.id], target: target } : null;
  }

  // ---------- build the shell ----------
  var cad = el('div', 'cad');
  cad.id = 'cad';

  // title bar
  var title = el('div', 'cad-title');
  var logo = el('span', 'cad-logo', 'L');
  logo.setAttribute('aria-hidden', 'true');
  var name = el('span', 'cad-name');
  name.appendChild(document.createTextNode('LSP Suite '));
  name.appendChild(el('span', 'cad-dim', 'LSP_SUITE.dwg'));
  var right = el('span', 'cad-title-right');
  var toDoc = el('button', 'cad-linkbtn', T.docview);
  toDoc.type = 'button';
  var langLink = document.querySelector('.lang-switch a');
  var langBox = el('span', 'cad-lang');
  langBox.appendChild(el('span', 'on', lang.toUpperCase()));
  if (langLink) {
    var ll = langLink.cloneNode(true);
    langBox.appendChild(ll);
  }
  right.appendChild(toDoc);
  right.appendChild(langBox);
  title.appendChild(logo);
  title.appendChild(name);
  title.appendChild(right);
  cad.appendChild(title);

  // ribbon
  var tabs = el('div', 'cad-tabs');
  tabs.setAttribute('role', 'tablist');
  var ribbon = el('div', 'cad-ribbon');
  cad.appendChild(tabs);
  cad.appendChild(ribbon);

  function panel(label) {
    var p = el('div', 'cad-rpanel');
    var body = el('div', 'cad-rbody');
    p.appendChild(body);
    p.appendChild(el('div', 'cad-rlabel', label));
    return { node: p, body: body };
  }
  // Ribbon icons, drawn like AutoCAD's: thin strokes on a 26px grid.
  var ICONS = {
    about: '<rect x="5" y="3" width="16" height="20"/><path d="M9 9h8M9 13h8M9 17h5"/>',
    start: '<rect x="3" y="5" width="20" height="16"/><path d="M7 10l3 3-3 3M12 16h6"/>',
    request: '<rect x="3" y="6" width="20" height="14" class="hot"/><path d="M3 7l10 7 10-7" class="hot"/>',
    overview: '<path d="M4 6h3M4 12h3M4 18h3M10 6h12M10 12h12M10 18h12"/>',
    ref: '<rect x="3" y="4" width="20" height="18"/><path d="M3 10h20M3 16h20M10 4v18"/>'
  };
  function icon(name) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'cad-icon');
    s.setAttribute('viewBox', '0 0 26 26');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name];
    return s;
  }
  function bigButton(text, sub, open, iconName) {
    var b = el('button', 'cad-big');
    b.type = 'button';
    if (iconName) b.appendChild(icon(iconName));
    b.appendChild(el('span', 'cad-big-name', text));
    if (sub) b.appendChild(el('span', 'cad-big-sub', sub));
    b.addEventListener('click', open);
    return b;
  }
  var tabList = [];
  function addTab(label, build) {
    var t = el('button', 'cad-tab', label);
    t.type = 'button';
    t.setAttribute('role', 'tab');
    var pane = el('div', 'cad-rpane');
    pane.setAttribute('role', 'tabpanel');
    build(pane);
    t.addEventListener('click', function () { selectTab(tabList.indexOf(entry)); });
    var entry = { tab: t, pane: pane };
    tabList.push(entry);
    tabs.appendChild(t);
    ribbon.appendChild(pane);
    return entry;
  }
  function selectTab(i) {
    tabList.forEach(function (e, j) {
      e.tab.setAttribute('aria-selected', String(i === j));
      e.pane.hidden = i !== j;
    });
  }

  addTab(T.home, function (pane) {
    var a = panel(T.about);
    ['about', 'start', 'request'].forEach(function (id) {
      if (byId[id]) a.body.appendChild(bigButton(byId[id].label, null, function () { open(id); }, id));
    });
    pane.appendChild(a.node);

    // Layer dropdown, filled from Q's table. Picking a layer opens Q.
    var l = panel(T.layers);
    var layerRows = Array.prototype.map.call(document.querySelectorAll('#q table tr'), function (tr) {
      var td = tr.querySelectorAll('td');
      return td.length > 1 ? { letter: td[0].textContent.trim(), name: td[1].textContent.trim() } : null;
    }).filter(Boolean);
    var COLORS = ['#ffffff', '#f2c94c', '#e04fd6', '#56d4e8', '#5b7cff', '#4cc46a', '#e0664a', '#9a9a9a'];
    var STATES =
      '<svg viewBox="0 0 12 12"><path class="bulb" d="M6 1.5a3 3 0 0 0-1.8 5.4V8.5h3.6V6.9A3 3 0 0 0 6 1.5zM4.6 10h2.8"/></svg>' +
      '<svg viewBox="0 0 12 12"><circle class="sun" cx="6" cy="6" r="2.2"/><path class="sun" d="M6 1v1.4M6 9.6V11M1 6h1.4M9.6 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1"/></svg>' +
      '<svg viewBox="0 0 12 12"><rect x="2.5" y="5.5" width="7" height="5"/><path d="M4 5.5V4a2 2 0 0 1 4 0"/></svg>';
    function layerLine(r, i) {
      var line = el('span', 'cad-layer-line');
      var states = el('span', 'cad-layer-states');
      states.setAttribute('aria-hidden', 'true');
      states.innerHTML = STATES;
      line.appendChild(states);
      var sw = el('span', 'cad-swatch');
      sw.style.background = COLORS[i % COLORS.length];
      sw.setAttribute('aria-hidden', 'true');
      line.appendChild(sw);
      line.appendChild(el('span', 'cad-layer-letter', r.letter));
      line.appendChild(el('span', 'cad-layer-name', r.name));
      return line;
    }
    var layerWrap = el('div', 'cad-layer-wrap');
    var layer = el('button', 'cad-layer');
    layer.type = 'button';
    layer.setAttribute('aria-haspopup', 'listbox');
    layer.setAttribute('aria-expanded', 'false');
    var layerCurrent = el('span', 'cad-layer-current');
    layer.appendChild(layerCurrent);
    var caret = el('span', 'cad-caret');
    caret.setAttribute('aria-hidden', 'true');
    layer.appendChild(caret);
    var layerList = el('ul', 'cad-layer-list');
    layerList.setAttribute('role', 'listbox');
    layerList.setAttribute('aria-label', T.layers);
    layerList.hidden = true;
    function setLayer(i) {
      layerCurrent.innerHTML = '';
      if (layerRows[i]) layerCurrent.appendChild(layerLine(layerRows[i], i));
      Array.prototype.forEach.call(layerList.children, function (li, j) { li.setAttribute('aria-selected', String(i === j)); });
    }
    function toggleLayers(show) {
      layerList.hidden = !show;
      layer.setAttribute('aria-expanded', String(show));
      if (!show) return;
      // Fixed position so the ribbon's scrolling row doesn't clip it.
      var r = layer.getBoundingClientRect();
      layerList.style.left = r.left + 'px';
      layerList.style.top = r.bottom + 'px';
      layerList.style.minWidth = r.width + 'px';
      var on = layerList.querySelector('[aria-selected="true"]') || layerList.firstChild;
      if (on) on.focus();
    }
    layerRows.forEach(function (r, i) {
      var li = el('li');
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.appendChild(layerLine(r, i));
      li.addEventListener('click', function () { setLayer(i); toggleLayers(false); open('q'); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
        if (e.key === 'ArrowDown' && li.nextSibling) { e.preventDefault(); li.nextSibling.focus(); }
        if (e.key === 'ArrowUp' && li.previousSibling) { e.preventDefault(); li.previousSibling.focus(); }
      });
      layerList.appendChild(li);
    });
    setLayer(0);
    layer.addEventListener('click', function () { toggleLayers(layerList.hidden); });
    layerList.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); toggleLayers(false); layer.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!layerList.hidden && !layerWrap.contains(e.target)) toggleLayers(false);
    });
    window.addEventListener('resize', function () { toggleLayers(false); });
    window.addEventListener('scroll', function () { toggleLayers(false); }, { passive: true });
    layerWrap.appendChild(layer);
    layerWrap.appendChild(layerList);
    l.body.appendChild(layerWrap);
    pane.appendChild(l.node);

    var cells = document.querySelector('.tb-cells');
    if (cells) {
      var inf = panel(T.info);
      var list = el('div', 'cad-info');
      Array.prototype.forEach.call(cells.children, function (cell) {
        var row = el('div');
        var c = cell.cloneNode(true);
        while (c.firstChild) row.appendChild(c.firstChild);
        list.appendChild(row);
      });
      var upd = document.getElementById('updated');
      if (upd) {
        var row = el('div');
        var lab = upd.parentNode.querySelector('span');
        if (lab) row.appendChild(lab.cloneNode(true));
        var t = el('span', 'cad-updated', upd.textContent);
        row.appendChild(t);
        list.appendChild(row);
      }
      inf.body.appendChild(list);
      pane.appendChild(inf.node);
    }
  });

  ['quick', 'toc', 'spec'].forEach(function (sid) {
    var sec = byId[sid];
    if (!sec) return;
    addTab(sec.label, function (pane) {
      var p = panel(sec.label);
      var extra = Array.prototype.filter.call(sec.node.children, function (n) {
        return n.tagName !== 'H2' && !n.classList.contains('cmd');
      });
      if (extra.length > 1) p.body.appendChild(bigButton(T.overview, null, function () { open(sid); }, 'overview'));
      cmds.filter(function (c) { return c.section === sec.node; }).forEach(function (c) {
        var b = bigButton(c.label.replace(/\s/g, ''), null, function () { open(c.id); });
        b.title = c.what;
        p.body.appendChild(b);
      });
      pane.appendChild(p.node);
    });
  });
  if (byId.ref) {
    addTab(byId.ref.label, function (pane) {
      var p = panel(byId.ref.label);
      p.body.appendChild(bigButton(byId.ref.label, null, function () { open('ref'); }, 'ref'));
      pane.appendChild(p.node);
    });
  }
  selectTab(0);

  // file tabs
  var files = el('div', 'cad-files');
  files.setAttribute('aria-hidden', 'true');
  files.appendChild(el('span', null, 'Start'));
  files.appendChild(el('span', 'on', 'LSP_SUITE'));
  cad.appendChild(files);

  // stage: model space, command panel, pop-up, command line
  var stage = el('div', 'cad-stage');
  var model = el('div', 'cad-model');
  var img = el('img');
  img.src = 'images/cad-model.webp';
  img.width = IMG_W;
  img.height = IMG_H;
  img.alt = '';
  model.appendChild(img);
  stage.appendChild(model);
  var vplabel = el('span', 'cad-vplabel', '[-][Top][2D Wireframe]');
  vplabel.setAttribute('aria-hidden', 'true');
  stage.appendChild(vplabel);

  var side = el('div', 'cad-panel');
  var sideHead = el('div', 'cad-panel-head');
  sideHead.appendChild(el('span', 'cad-panel-title', T.commands));
  var search = el('input');
  search.type = 'search';
  search.placeholder = T.search;
  search.setAttribute('aria-label', T.search);
  sideHead.appendChild(search);
  side.appendChild(sideHead);
  var sideList = el('div', 'cad-panel-list');
  var rows = [];
  ['quick', 'toc', 'spec'].forEach(function (sid) {
    if (!byId[sid]) return;
    var group = el('div', 'cad-group');
    group.appendChild(el('div', 'cad-group-name', byId[sid].label));
    cmds.filter(function (c) { return c.section === byId[sid].node; }).forEach(function (c) {
      var r = el('button', 'cad-row');
      r.type = 'button';
      r.appendChild(el('span', 'cad-row-name', c.label.replace(/\s/g, '')));
      r.appendChild(el('span', 'cad-row-what', c.what));
      r.addEventListener('click', function () { open(c.id); });
      group.appendChild(r);
      rows.push({ row: r, cmd: c, group: group });
    });
    sideList.appendChild(group);
  });
  side.appendChild(sideList);
  side.appendChild(el('div', 'cad-panel-strip', 'COMMAND MANAGER')).setAttribute('aria-hidden', 'true');
  stage.appendChild(side);

  search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase();
    rows.forEach(function (r) {
      r.row.hidden = q && (r.cmd.label + ' ' + r.cmd.what).toLowerCase().indexOf(q) < 0;
    });
    Array.prototype.forEach.call(sideList.children, function (g) {
      g.hidden = !g.querySelector('.cad-row:not([hidden])');
    });
  });

  var modal = el('div', 'cad-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'cad-modal-title');
  modal.hidden = true;
  var bar = el('div', 'cad-modal-bar');
  var barText = el('span');
  var closeBtn = el('button', 'cad-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', T.close);
  closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
  bar.appendChild(barText);
  bar.appendChild(closeBtn);
  var mbody = el('div', 'cad-modal-body');
  var mgrid = el('div', 'cad-modal-grid');
  var mdoc = el('div', 'cad-modal-doc');
  var mmedia = el('div', 'cad-modal-media');
  var mtitle = el('h2');
  mtitle.id = 'cad-modal-title';
  mgrid.appendChild(mdoc);
  mgrid.appendChild(mmedia);
  mbody.appendChild(mgrid);
  var foot = el('div', 'cad-modal-foot');
  var prevBtn = el('button', 'cad-step');
  var nextBtn = el('button', 'cad-step');
  prevBtn.type = nextBtn.type = 'button';
  foot.appendChild(prevBtn);
  foot.appendChild(nextBtn);
  modal.appendChild(bar);
  modal.appendChild(mbody);
  modal.appendChild(foot);
  stage.appendChild(modal);

  var cmdline = el('form', 'cad-cmdline');
  var hist = el('div', 'cad-hist');
  hist.setAttribute('aria-live', 'polite');
  var inputRow = el('label', 'cad-input');
  var cmdInput = el('input');
  cmdInput.type = 'text';
  cmdInput.autocomplete = 'off';
  cmdInput.spellcheck = false;
  cmdInput.placeholder = T.typecmd;
  cmdInput.setAttribute('aria-label', T.typecmd);
  inputRow.appendChild(el('span', 'cad-prompt', '>'));
  inputRow.appendChild(cmdInput);
  cmdline.appendChild(hist);
  cmdline.appendChild(inputRow);
  stage.appendChild(cmdline);
  cad.appendChild(stage);

  // status bar with layout tabs
  var status = el('div', 'cad-status');
  var layouts = el('div', 'cad-layouts');
  layouts.setAttribute('aria-label', T.layouts);
  ['Model', 'FURN-00', 'FURN-01', 'FURN-02', 'FURN-03', 'FURN-04'].forEach(function (n, i) {
    var t = el('span', i === 0 ? 'on' : i === 2 ? 'cad-layout-ws' : null, n);
    layouts.appendChild(t);
  });
  status.appendChild(layouts);
  var statusRight = el('span', 'cad-status-right', 'MODEL   1:1');
  statusRight.setAttribute('aria-hidden', 'true');
  status.appendChild(statusRight);
  cad.appendChild(status);

  var cone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cone.setAttribute('class', 'cad-cone');
  cone.setAttribute('aria-hidden', 'true');
  cad.appendChild(cone);

  document.body.insertBefore(cad, document.body.firstChild);

  // ---------- layout ----------
  var current = null, borrowed = [], pan = 0, panY = 0, scale = 1, baseX = 0, lastFocus = null, phoneScroll = null;
  function phone() { return window.innerWidth < 900 || window.innerHeight < 560; }

  function layout() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (phone()) {
      // The left part of the screenshot is empty, so phones skip it.
      scale = w / (IMG_W - PHONE_CROP);
      baseX = -PHONE_CROP * scale;
      pan = 0;
      panY = 0;
      stage.style.setProperty('--model-h', Math.round(IMG_H * scale) + 'px');
      modal.style.cssText = '';
      if (!modal.hidden) {
        var stageTop = stage.getBoundingClientRect().top;
        var top = Math.min(Math.max(48, stageTop + IMG_H * scale), window.innerHeight * 0.5);
        modal.style.top = top + 'px';
        // Slide the drawing up so the highlighted part shows above the sheet.
        var spotP = current && SPOTS[current.id];
        var band = top - stageTop;
        if (spotP && band < IMG_H * scale) {
          panY = band / 2 - (spotP[1] + spotP[3]) / 2 * scale;
          panY = Math.min(0, Math.max(band - IMG_H * scale, panY));
        }
      }
      model.style.transform = 'translate(' + baseX + 'px, ' + panY + 'px) scale(' + scale + ')';
      drawCone();
      return;
    }
    scale = h / IMG_H;
    baseX = w - IMG_W * scale;
    panY = 0;
    var left = side.offsetLeft + side.offsetWidth + 20;
    cmdline.style.left = left + 'px';
    cmdline.style.width = Math.min(820, w - left - 16) + 'px';
    var spot = current && current.kind === 'cmd' && SPOTS[current.id];
    var reserve = spot ? Math.max((spot[2] - spot[0]) * scale + 64, 240) : 0;
    var mw = Math.min(980, w - left - 16 - reserve);
    var mh = h - 16 - (cmdline.offsetHeight + 24);
    modal.style.left = left + 'px';
    modal.style.top = '12px';
    modal.style.width = mw + 'px';
    modal.style.maxHeight = mh + 'px';
    pan = 0;
    if (spot) {
      var target = left + mw + (w - left - mw) / 2;
      pan = target - (baseX + (spot[0] + spot[2]) / 2 * scale);
    }
    model.style.transform = 'translate(' + (baseX + pan) + 'px, 0) scale(' + scale + ')';
    drawCone();
  }

  function rectIn(r, box) {
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  }
  function drawCone() {
    while (cone.firstChild) cone.removeChild(cone.firstChild);
    if (!current || current.kind !== 'cmd' || modal.hidden) return;
    var box = cad.getBoundingClientRect();
    var stageBox = rectIn(stage.getBoundingClientRect(), box);
    var R;
    var spot = SPOTS[current.id];
    if (spot) {
      R = { x: stageBox.x + baseX + pan + spot[0] * scale, y: stageBox.y + panY + spot[1] * scale,
            w: (spot[2] - spot[0]) * scale, h: (spot[3] - spot[1]) * scale };
    } else if (UI_SPOTS[current.id]) {
      var uiEl = cad.querySelector(UI_SPOTS[current.id]);
      if (!uiEl || !uiEl.offsetParent) return;
      R = rectIn(uiEl.getBoundingClientRect(), box);
      R.x -= 3; R.y -= 3; R.w += 6; R.h += 6;
    } else return;
    var ns = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(ns, 'g');
    if (!phone()) {
      var M = rectIn(modal.getBoundingClientRect(), box);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (k) {
        var line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', R.x + R.w * k[0]);
        line.setAttribute('y1', R.y + R.h * k[1]);
        line.setAttribute('x2', M.x + M.w * k[0]);
        line.setAttribute('y2', M.y + M.h * k[1]);
        g.appendChild(line);
      });
    }
    var rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', R.x);
    rect.setAttribute('y', R.y);
    rect.setAttribute('width', R.w);
    rect.setAttribute('height', R.h);
    g.appendChild(rect);
    cone.appendChild(g);
  }

  // ---------- open and close ----------
  function borrow(nodes, into) {
    nodes.forEach(function (n) {
      var ph = document.createComment('');
      n.parentNode.insertBefore(ph, n);
      into.appendChild(n);
      borrowed.push([n, ph]);
    });
  }
  function giveBack() {
    borrowed.forEach(function (b) {
      b[1].parentNode.insertBefore(b[0], b[1]);
      b[1].parentNode.removeChild(b[1]);
    });
    borrowed = [];
    mdoc.innerHTML = '';
    mmedia.innerHTML = '';
  }
  function pauseAll(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('video'), function (v) { v.pause(); });
  }

  function open(id, focusTarget) {
    var found = unitFor(id);
    if (!found) return;
    var u = found.unit;
    if (modal.hidden) lastFocus = document.activeElement;
    pauseAll(modal);
    giveBack();
    current = u;
    mdoc.appendChild(mtitle);
    mtitle.innerHTML = '';
    var kids = Array.prototype.slice.call(u.node.children);
    if (u.kind === 'cmd') {
      mtitle.appendChild(el('span', 'name', u.label));
      mtitle.appendChild(el('span', 'what', u.what));
      barText.textContent = T.zoomed + ' ' + u.label.replace(/\s/g, '');
      kids = kids.filter(function (n) { return n.tagName !== 'H3'; });
      borrow(kids.filter(function (n) { return n.tagName !== 'FIGURE'; }), mdoc);
      borrow(kids.filter(function (n) { return n.tagName === 'FIGURE'; }), mmedia);
    } else {
      mtitle.textContent = u.label;
      barText.textContent = u.label;
      kids = kids.filter(function (n) {
        return n.tagName !== 'H2' && n.tagName !== 'STRONG' && !n.classList.contains('cmd');
      });
      if (u.id === 'about') {
        var lede = document.querySelector('.titleblock .lede');
        if (lede) kids.unshift(lede);
      }
      borrow(kids, mdoc);
    }
    modal.classList.toggle('is-text', u.kind !== 'cmd' || !mmedia.firstChild);
    Array.prototype.forEach.call(mmedia.querySelectorAll('video'), function (v) {
      v.preload = 'auto';
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });

    var i = cmds.indexOf(u);
    stepTo(prevBtn, u.kind === 'cmd' ? cmds[i - 1] : null, '‹ ');
    stepTo(nextBtn, u.kind === 'cmd' ? cmds[i + 1] : null, null, ' ›');
    foot.hidden = u.kind !== 'cmd';

    rows.forEach(function (r) { r.row.classList.toggle('on', r.cmd === u); });
    if (u.kind === 'cmd') {
      log(['Command: ' + u.aliases[0], u.what]);
      if (u.id === 'q') selectTab(0);
    }
    if (history.replaceState) history.replaceState(null, '', '#' + u.id);

    // On a phone, scroll up so the drawing with its highlight shows above the sheet.
    if (phone() && modal.hidden) { phoneScroll = window.scrollY; window.scrollTo(0, 0); }
    modal.hidden = false;
    cad.classList.add('has-modal');
    mbody.scrollTop = 0;
    layout();
    if (found.target !== u.node) found.target.scrollIntoView({ block: 'start' });
    if (focusTarget !== false) closeBtn.focus({ preventScroll: true });
  }
  function stepTo(btn, c, pre, post) {
    btn.hidden = !c;
    if (!c) return;
    var label = c.label.split('/')[0].trim();
    btn.textContent = (pre || '') + label + (post || '');
    btn.setAttribute('aria-label', (pre ? T.prev : T.next) + ': ' + label);
    btn.onclick = function () { open(c.id); };
  }
  function close() {
    if (modal.hidden) return;
    pauseAll(modal);
    giveBack();
    current = null;
    modal.hidden = true;
    cad.classList.remove('has-modal');
    rows.forEach(function (r) { r.row.classList.remove('on'); });
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    layout();
    if (phoneScroll !== null) { window.scrollTo(0, phoneScroll); phoneScroll = null; }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  closeBtn.addEventListener('click', close);

  function log(lines) {
    hist.innerHTML = '';
    lines.forEach(function (t) { hist.appendChild(el('div', null, t)); });
  }
  cmdline.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = cmdInput.value.trim().toUpperCase();
    cmdInput.value = '';
    if (!v) return;
    if (alias[v]) open(alias[v].id, false);
    else log(['Command: ' + v, T.unknown + ' "' + v + '".']);
  });

  // Links to parts of the page open them here instead of scrolling the hidden page.
  cad.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (unitFor(id)) { e.preventDefault(); open(id); }
  });

  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('cad-view')) return;
    if (e.key === 'Escape') { close(); return; }
    // Like AutoCAD: typing anywhere goes to the command line.
    var t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
    if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    if (phone()) return;
    cmdInput.focus();
  });

  // ---------- switching views ----------
  var docVideos = Array.prototype.slice.call(main.querySelectorAll('video'));
  function setView(view) {
    var isCad = view === 'cad';
    root.classList.toggle('cad-view', isCad);
    store('lsp-view', view);
    if (isCad) {
      docVideos.forEach(function (v) { v.pause(); v.removeAttribute('autoplay'); v.preload = 'none'; });
      layout();
    } else {
      var reopen = current && current.id;
      close();
      docVideos.forEach(function (v) {
        v.setAttribute('autoplay', '');
        v.preload = 'auto';
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
      if (reopen) {
        var t = document.getElementById(reopen);
        if (t) t.scrollIntoView();
      }
    }
  }
  toDoc.addEventListener('click', function () { setView('doc'); });

  var toCad = el('button', 'cad-linkbtn cad-open', T.cadview);
  toCad.type = 'button';
  toCad.addEventListener('click', function () { window.scrollTo(0, 0); setView('cad'); });
  var header = main.querySelector('header');
  if (header) header.insertBefore(toCad, header.firstChild);

  // Keep the hash when switching language.
  if (langLink) {
    ll.addEventListener('click', function () {
      if (location.hash) ll.href = langLink.getAttribute('href') + location.hash;
    });
  }

  window.addEventListener('resize', function () { if (root.classList.contains('cad-view')) layout(); });
  mbody.addEventListener('scroll', drawCone, { passive: true });

  var updated = document.getElementById('updated');
  if (updated && window.MutationObserver) {
    new MutationObserver(function () {
      var u = cad.querySelector('.cad-updated');
      if (u) u.textContent = updated.textContent;
    }).observe(updated, { childList: true, characterData: true, subtree: true });
  }

  // ---------- start ----------
  var params = new URLSearchParams(location.search);
  var startView = params.get('view') || store('lsp-view') || 'cad';
  setView(startView === 'doc' ? 'doc' : 'cad');
  if (startView !== 'doc') {
    var hash = location.hash.slice(1);
    open(hash && unitFor(hash) ? hash : 'about', false);
  }
})();
