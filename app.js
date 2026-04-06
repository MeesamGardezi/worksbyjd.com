'use strict';

require('dotenv').config();

const express       = require('express');
const path          = require('path');
const session       = require('express-session');
const cookieParser  = require('cookie-parser');
const analyticsMiddleware = require('./analytics');
const adminRouter   = require('./admin');
const { db }        = require('./firebase');

const app  = express();
const PORT = 3004;

// ── Engine & views ────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Sessions (for admin auth) ─────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'worksbyjd-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
}));

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Analytics middleware (tracks page views to Firestore) ─────────────────────
app.use(analyticsMiddleware);

// ── Admin panel ───────────────────────────────────────────────────────────────
app.use('/admin', adminRouter);

// ── Route table ───────────────────────────────────────────────────────────────
const routes = [
  // Top-level
  { path: '/',                                                view: 'index',                                            activePage: 'home'      },
  { path: '/contact',                                         view: 'contact',                                          activePage: 'contact'   },
  { path: '/services',                                        view: 'services',                                         activePage: 'services'  },
  { path: '/painting-services',                               view: 'painting-services',                                activePage: 'services'  },
  { path: '/home-remodeling',                                 view: 'home-remodeling',                                  activePage: 'services'  },
  { path: '/portfolio',                                       view: 'portfolio',                                        activePage: 'portfolio' },
  { path: '/about',                                           view: 'about',                                            activePage: 'about'     },
  { path: '/faq',                                             view: 'faq',                                              activePage: 'faq'       },
  { path: '/warranty',                                        view: 'warranty',                                         activePage: 'warranty'  },
  { path: '/better-together',                                 view: 'better-together',                                  activePage: 'community' },
  { path: '/manchester-by-the-sea-home-remodeling-services',  view: 'manchester-by-the-sea-home-remodeling-services',   activePage: 'manchester'},

  // Services sub-pages
  { path: '/services/kitchens',           view: 'services/kitchens',            activePage: 'services' },
  { path: '/services/bathrooms',          view: 'services/bathrooms',           activePage: 'services' },
  { path: '/services/outdoor-living',     view: 'services/outdoor-living',      activePage: 'services' },
  { path: '/services/decking',            view: 'services/decking',             activePage: 'services' },
  { path: '/services/windows-and-doors',  view: 'services/windows-and-doors',   activePage: 'services' },
  { path: '/services/basement-and-attics',view: 'services/basement-and-attics', activePage: 'services' },
  { path: '/services/full-house-remodel', view: 'services/full-house-remodel',  activePage: 'services' },
  { path: '/services/restoration',        view: 'services/restoration',         activePage: 'services' },
  { path: '/services/custom-cabinetry',   view: 'services/custom-cabinetry',    activePage: 'services' },
  { path: '/services/custom-carpentry',   view: 'services/custom-carpentry',    activePage: 'services' },

  // About sub-pages
  { path: '/about/our-story',    view: 'about/our-story',    activePage: 'about' },
  { path: '/about/meet-the-team',view: 'about/meet-the-team',activePage: 'about' },
];

// Register all routes
routes.forEach(({ path: routePath, view, activePage }) => {
  app.get(routePath, (req, res) => {
    res.render(view, { activePage });
  });
});

// ── Careers (dynamic from Firestore) ──────────────────────────────────────────
app.get('/career-opportunities', async (req, res) => {
  try {
    const snap = await db.collection('careers')
      .where('active', '==', true)
      .orderBy('order', 'asc')
      .get();
    const careers = [];
    snap.forEach(doc => careers.push({ id: doc.id, ...doc.data() }));
    res.render('career-opportunities', { activePage: 'careers', careers });
  } catch (err) {
    console.error('Careers page error:', err);
    res.render('career-opportunities', { activePage: 'careers', careers: [] });
  }
});

// Legacy .html redirect — strip extensions for any missed links
app.get('/*.html', (req, res) => {
  res.redirect(301, req.path.replace(/\.html$/, ''));
});

// 404
app.use((req, res) => {
  res.status(404).send('<h1>404 — Page not found</h1><p><a href="/">Return home</a></p>');
});

app.listen(PORT, () => {
  console.log(`WORKS by JD running at http://localhost:${PORT}`);
});
