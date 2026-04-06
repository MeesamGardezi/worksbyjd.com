/* WORKS by JD — Site Scripts */

(function () {
  'use strict';

  /* ── Navbar scroll shadow ── */
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    var onScroll = function () {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Hero background slideshow (Ken Burns) ── */
  var slides = Array.from(document.querySelectorAll('.hero-slide'));
  if (slides.length > 1) {
    var current = 0;
    setInterval(function () {
      slides[current].classList.remove('hero-slide-active');
      slides[current].style.animation = 'none';
      current = (current + 1) % slides.length;
      var next = slides[current];
      next.style.animation = 'none';
      // force reflow so animation restarts
      void next.offsetWidth;
      next.style.animation = '';
      next.classList.add('hero-slide-active');
    }, 5500);
  }

  /* ── Mobile menu toggle ── */
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.querySelector('.mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    /* Close on nav link click */
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Navbar dropdown click toggle ── */
  var dropdowns = document.querySelectorAll('.nav-dropdown');
  dropdowns.forEach(function (dd) {
    var btn = dd.querySelector('.nav-link');
    var menu = dd.querySelector('.dropdown-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var wasOpen = menu.classList.contains('open');
      // close all
      document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
        m.classList.remove('open');
      });
      if (!wasOpen) menu.classList.add('open');
    });
  });
  // close on click outside
  document.addEventListener('click', function () {
    document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
      m.classList.remove('open');
    });
  });

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      /* Close all */
      document.querySelectorAll('.faq-item.open').forEach(function (i) {
        i.classList.remove('open');
      });
      /* Open clicked if it was closed */
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ── Active nav link ── */
  var currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link, .footer-col-link').forEach(function (link) {
    if (link.getAttribute('href') === currentPath || link.getAttribute('href') === currentPath + 'index.html') {
      link.classList.add('active');
    }
  });

  /* ── Smooth scroll for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ── Quote carousel ── */
  var quoteSlides = Array.from(document.querySelectorAll('.quote-slide'));
  var quoteDots = Array.from(document.querySelectorAll('.quote-dot'));
  if (quoteSlides.length > 1) {
    var quoteIdx = 0;
    var quoteTimer;

    function showQuote(idx) {
      quoteSlides[quoteIdx].classList.remove('quote-slide-active');
      quoteDots[quoteIdx].classList.remove('quote-dot-active');
      quoteIdx = idx;
      quoteSlides[quoteIdx].classList.add('quote-slide-active');
      quoteDots[quoteIdx].classList.add('quote-dot-active');
    }

    function startQuoteTimer() {
      quoteTimer = setInterval(function () {
        showQuote((quoteIdx + 1) % quoteSlides.length);
      }, 6000);
    }

    quoteDots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        clearInterval(quoteTimer);
        showQuote(i);
        startQuoteTimer();
      });
    });

    startQuoteTimer();
  }

  /* ── Contact form submission → Firebase via API ── */
  document.querySelectorAll('.js-contact-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Sending…';

      var data = {};
      new FormData(form).forEach(function (val, key) { data[key] = val; });

      fetch('/admin/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) {
            btn.textContent = 'Sent! We\'ll be in touch.';
            btn.style.background = '#2D7A3A';
            form.reset();
          } else {
            btn.textContent = 'Error — try again';
            btn.style.background = '#DC2626';
            btn.disabled = false;
          }
        })
        .catch(function () {
          btn.textContent = 'Error — try again';
          btn.style.background = '#DC2626';
          btn.disabled = false;
        });
    });
  });

})();
