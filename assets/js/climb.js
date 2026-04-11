/* ================================================================
   CLIMB Documentation — Theme JS
   Mobile nav · Search · Code copy · TOC tracking
================================================================ */
(function () {
  'use strict';

  /* ── helpers ──────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ── Mobile sidebar ───────────────────────────────────────── */
  var sidebar  = $('sidebar');
  var overlay  = $('sidebar-overlay');
  var menuBtn  = $('menu-btn');
  var closeBtn = $('sidebar-close');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    menuBtn && menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    menuBtn && menuBtn.setAttribute('aria-expanded', 'false');
  }

  on(menuBtn,  'click', openSidebar);
  on(closeBtn, 'click', closeSidebar);
  on(overlay,  'click', closeSidebar);

  /* ── Nav group toggles ────────────────────────────────────── */
  document.querySelectorAll('.nav-section-btn').forEach(function (btn) {
    on(btn, 'click', function () {
      var isOpen   = btn.classList.contains('open');
      var children = btn.nextElementSibling; // .nav-children
      btn.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (children) children.classList.toggle('open', !isOpen);
    });
  });

  /* ── Code copy buttons ────────────────────────────────────── */
  document.querySelectorAll('.md-content .highlight').forEach(function (block) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.textContent = 'Copy';
    block.appendChild(btn);

    on(btn, 'click', function () {
      var pre  = block.querySelector('pre');
      var code = pre ? pre.innerText : '';
      navigator.clipboard.writeText(code).then(function () {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      }, function () {
        btn.textContent = 'Error';
        setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
      });
    });
  });

  /* ── TOC — highlight active section on scroll ─────────────── */
  (function () {
    var tocLinks = document.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;

    var headings = Array.from(
      document.querySelectorAll('.md-content h1[id], .md-content h2[id], .md-content h3[id], .md-content h4[id]')
    );
    if (!headings.length) return;

    var raf;
    function update() {
      var scrollY = window.scrollY + 80;
      var active  = null;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].offsetTop <= scrollY) active = headings[i];
      }
      var activeId = active ? '#' + active.id : null;
      tocLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === activeId);
      });
    }

    on(window, 'scroll', function () {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    update();
  }());

  /* ── Search ───────────────────────────────────────────────── */
  (function () {
    var trigger   = $('search-trigger');
    var overlay   = $('search-overlay');
    var backdrop  = $('search-backdrop');
    var input     = $('search-input');
    var closeBtn  = $('search-close');
    var body      = $('search-body');

    if (!trigger || !overlay) return;

    var index   = null;   // array of {title, location, text}
    var debounce = null;

    /* Load the MkDocs search index lazily */
    function loadIndex() {
      if (index !== null) return;
      var meta = document.querySelector('meta[name="search-index-url"]');
      var url  = meta ? meta.content : 'search/search_index.json';
      fetch(url)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          index = (data && data.docs) ? data.docs : [];
        })
        .catch(function () { index = []; });
    }

    function openSearch() {
      overlay.hidden = false;
      backdrop.classList.add('visible');
      document.body.style.overflow = 'hidden';
      input.focus();
      loadIndex();
    }

    function closeSearch() {
      overlay.hidden = true;
      backdrop.classList.remove('visible');
      document.body.style.overflow = '';
      input.value = '';
      body.innerHTML = '<p class="search-hint">Type to search across all pages\u2026</p>';
    }

    on(trigger,  'click', openSearch);
    on(closeBtn, 'click', closeSearch);
    on(backdrop, 'click', closeSearch);

    on(document, 'keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && !overlay.hidden) closeSearch();
    });

    /* Simple but effective multi-word search */
    function search(q) {
      if (!index || !q.trim()) return [];
      var words = q.toLowerCase().trim().split(/\s+/);
      var results = [];

      for (var i = 0; i < index.length; i++) {
        var doc        = index[i];
        var titleLow   = (doc.title || '').toLowerCase();
        var textLow    = (doc.text  || '').toLowerCase();
        var score      = 0;

        for (var w = 0; w < words.length; w++) {
          var wd = words[w];
          if (!wd) continue;
          if (titleLow.indexOf(wd) !== -1) score += 10;
          if (textLow.indexOf(wd)  !== -1) score += 1;
        }
        if (score > 0) results.push({ doc: doc, score: score });
      }

      results.sort(function (a, b) { return b.score - a.score; });
      return results.slice(0, 9).map(function (r) { return r.doc; });
    }

    /* Escape HTML and highlight query terms */
    function esc(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function mark(str, q) {
      if (!q) return esc(str);
      var escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return esc(str).replace(new RegExp('(' + escaped.split(/\s+/).join('|') + ')', 'gi'),
        '<mark>$1</mark>');
    }

    function excerpt(text, q, max) {
      max = max || 160;
      var lower = text.toLowerCase();
      var qFirst = q.toLowerCase().split(/\s+/)[0] || '';
      var idx = qFirst ? lower.indexOf(qFirst) : -1;
      var start = Math.max(0, idx - 55);
      var end   = Math.min(text.length, start + max);
      return (start > 0 ? '\u2026' : '') + text.slice(start, end) + (end < text.length ? '\u2026' : '');
    }

    function sectionLabel(loc) {
      var parts = (loc || '').replace(/\/$/, '').split('/');
      var seg = parts.length > 1 ? parts[parts.length - 2] : parts[0] || '';
      return seg.replace(/^\d+[._-]?/, '').replace(/[-_]/g, ' ');
    }

    function render(results, q) {
      if (!results.length) {
        body.innerHTML = '<p class="search-no-results">No results found for \u201c' + esc(q) + '\u201d</p>';
        return;
      }
      var html = '';
      for (var i = 0; i < results.length; i++) {
        var doc   = results[i];
        var badge = sectionLabel(doc.location);
        var exc   = excerpt(doc.text || '', q);
        html += '<a class="search-result" href="' + esc(doc.location) + '">'
          + '<div class="search-result-title">'
          + mark(doc.title || 'Untitled', q)
          + (badge ? '<span class="search-result-badge">' + esc(badge) + '</span>' : '')
          + '</div>'
          + '<div class="search-result-excerpt">' + mark(exc, q) + '</div>'
          + '</a>';
      }
      body.innerHTML = html;
    }

    on(input, 'input', function () {
      clearTimeout(debounce);
      var q = input.value;
      if (!q.trim()) {
        body.innerHTML = '<p class="search-hint">Type to search across all pages\u2026</p>';
        return;
      }
      debounce = setTimeout(function () { render(search(q), q); }, 130);
    });

    /* Close search when a result link is followed */
    on(body, 'click', function (e) {
      if (e.target.closest('.search-result')) closeSearch();
    });
  }());

}());
