// Highlights the side index link for the section on screen,
// and fills in the last-updated date from GitHub.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('nav.side a[href^="#"]'));
  var items = links.map(function (a) {
    return { link: a, target: document.getElementById(a.getAttribute('href').slice(1)) };
  }).filter(function (it) { return it.target; });
  var current = null;

  function update() {
    var line = window.innerHeight * 0.3;
    var pick = items[0];
    items.forEach(function (it) {
      if (it.target.getBoundingClientRect().top <= line) pick = it;
    });
    // Sub-sections nested inside a section (the TOC block, a command card) come after
    // their section in the list, so the last one past the line is the most specific.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) pick = items[items.length - 1];
    if (pick === current) return;
    current = pick;
    links.forEach(function (a) { a.classList.remove('active', 'in-group'); });
    pick.link.classList.add('active');
    var group = pick.link.closest('li.group');
    var groupLink = group && group.querySelector(':scope > a');
    if (groupLink && groupLink !== pick.link) groupLink.classList.add('in-group');
  }

  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// Last updated: the date of the latest commit on GitHub. The date written in
// the page stays if the request fails (offline, rate limit, local preview).
(function () {
  var el = document.getElementById('updated');
  if (!el || !window.fetch) return;
  fetch('https://api.github.com/repos/fayezaff/lsp-suite/commits?per_page=1')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (list) {
      var d = new Date(list[0].commit.committer.date);
      el.dateTime = d.toISOString().slice(0, 10);
      el.textContent = d.toLocaleDateString(document.documentElement.lang,
        { day: 'numeric', month: 'short', year: 'numeric' });
    })
    .catch(function () {});
})();
