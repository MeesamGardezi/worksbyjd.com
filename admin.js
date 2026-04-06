'use strict';

const express = require('express');
const { db } = require('./firebase');
const admin = require('firebase-admin');
const router = express.Router();

// ── Admin password (set via env var or default for dev) ─────────────────────
const ADMIN_PASS = process.env.ADMIN_PASS || 'worksbyjd2025';

// ── Auth middleware ─────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

// ── Login ───────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid password.' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── Dashboard ───────────────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Get last 30 days of stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const dateKey = thirtyDaysAgo.toISOString().split('T')[0];

    const statsSnap = await db.collection('dailyStats')
      .where('date', '>=', dateKey)
      .orderBy('date', 'desc')
      .get();

    const dailyStats = [];
    let totalViews = 0;
    const allVisitorIds = new Set();
    const pageCounts = {};

    statsSnap.forEach(doc => {
      const data = doc.data();
      const dayUniques = Array.isArray(data.uniqueVisitors) ? data.uniqueVisitors.length : 0;
      dailyStats.push({
        date: data.date,
        totalViews: data.totalViews || 0,
        uniqueVisitors: dayUniques,
      });
      totalViews += data.totalViews || 0;
      if (Array.isArray(data.uniqueVisitors)) {
        data.uniqueVisitors.forEach(id => allVisitorIds.add(id));
      }
      if (data.pages) {
        Object.entries(data.pages).forEach(([page, count]) => {
          pageCounts[page] = (pageCounts[page] || 0) + count;
        });
      }
    });

    // Top pages
    const topPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page: page.replace(/_/g, '/'), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Recent contact submissions
    const contactsSnap = await db.collection('contacts')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const contacts = [];
    contactsSnap.forEach(doc => {
      contacts.push({ id: doc.id, ...doc.data() });
    });

    // Total contacts count
    const allContactsSnap = await db.collection('contacts').count().get();
    const totalContacts = allContactsSnap.data().count;

    // Today's views
    const todayKey = now.toISOString().split('T')[0];
    const todayDoc = await db.collection('dailyStats').doc(todayKey).get();
    const todayViews = todayDoc.exists ? (todayDoc.data().totalViews || 0) : 0;

    res.render('admin/dashboard', {
      dailyStats,
      totalViews,
      todayViews,
      topPages,
      contacts,
      totalContacts,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.render('admin/dashboard', {
      dailyStats: [],
      totalViews: 0,
      todayViews: 0,
      topPages: [],
      contacts: [],
      totalContacts: 0,
    });
  }
});

// ── Contacts list ───────────────────────────────────────────────────────────
router.get('/contacts', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('contacts')
      .orderBy('timestamp', 'desc')
      .get();
    const contacts = [];
    snap.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));
    res.render('admin/contacts', { contacts });
  } catch (err) {
    res.render('admin/contacts', { contacts: [] });
  }
});

router.get('/contacts/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('contacts').doc(req.params.id).get();
    if (!doc.exists) return res.redirect('/admin/contacts');
    const contact = { id: doc.id, ...doc.data() };
    res.render('admin/contact-detail', { contact });
  } catch (err) {
    res.redirect('/admin/contacts');
  }
});

router.post('/contacts/:id/delete', requireAdmin, async (req, res) => {
  await db.collection('contacts').doc(req.params.id).delete();
  res.redirect('/admin/contacts');
});

router.post('/contacts/:id/status', requireAdmin, async (req, res) => {
  await db.collection('contacts').doc(req.params.id).update({
    status: req.body.status,
  });
  res.redirect('/admin/contacts/' + req.params.id);
});

// ── Analytics detail ────────────────────────────────────────────────────────
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const now = new Date();
    const since = new Date(now - days * 24 * 60 * 60 * 1000);
    const dateKey = since.toISOString().split('T')[0];

    const statsSnap = await db.collection('dailyStats')
      .where('date', '>=', dateKey)
      .orderBy('date', 'asc')
      .get();

    const dailyStats = [];
    let totalViews = 0;
    let totalUniqueVisitors = 0;
    const allVisitorIds = new Set();
    const pageCounts = {};

    statsSnap.forEach(doc => {
      const data = doc.data();
      const dayUniques = Array.isArray(data.uniqueVisitors) ? data.uniqueVisitors.length : 0;
      dailyStats.push({
        date: data.date,
        totalViews: data.totalViews || 0,
        uniqueVisitors: dayUniques,
      });
      totalViews += data.totalViews || 0;

      // Collect all unique visitor IDs across the period
      if (Array.isArray(data.uniqueVisitors)) {
        data.uniqueVisitors.forEach(id => allVisitorIds.add(id));
      }

      if (data.pages) {
        Object.entries(data.pages).forEach(([page, count]) => {
          pageCounts[page] = (pageCounts[page] || 0) + count;
        });
      }
    });

    totalUniqueVisitors = allVisitorIds.size;

    const topPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page: page.replace(/_/g, '/'), count }))
      .sort((a, b) => b.count - a.count);

    // Categorize pages
    const categories = { Home: 0, Services: 0, Portfolio: 0, About: 0, Contact: 0, Other: 0 };
    topPages.forEach(p => {
      const pg = p.page.toLowerCase();
      if (pg === '/' || pg === '/root') categories.Home += p.count;
      else if (pg.includes('service') || pg.includes('kitchen') || pg.includes('bathroom') || pg.includes('outdoor') || pg.includes('deck') || pg.includes('window') || pg.includes('basement') || pg.includes('remodel') || pg.includes('painting') || pg.includes('cabinet') || pg.includes('carpentry') || pg.includes('restoration')) categories.Services += p.count;
      else if (pg.includes('portfolio') || pg.includes('rockport') || pg.includes('beverly') || pg.includes('gloucester') || pg.includes('tewksbury')) categories.Portfolio += p.count;
      else if (pg.includes('about') || pg.includes('team') || pg.includes('story')) categories.About += p.count;
      else if (pg.includes('contact') || pg.includes('faq') || pg.includes('warranty')) categories.Contact += p.count;
      else categories.Other += p.count;
    });

    // Get per-page unique visitors from pageViews collection
    const sinceDate = since;
    const recentSnap = await db.collection('pageViews')
      .where('timestamp', '>=', sinceDate)
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();

    const recentViews = [];
    const referrerCounts = {};
    const deviceCounts = { Desktop: 0, Mobile: 0, Tablet: 0 };
    const pageUniqueVisitors = {}; // { '/page': Set of visitorIds }

    recentSnap.forEach(doc => {
      const d = doc.data();
      recentViews.push(d);

      // Per-page unique tracking
      const path = d.path || '/';
      if (!pageUniqueVisitors[path]) pageUniqueVisitors[path] = new Set();
      if (d.visitorId) pageUniqueVisitors[path].add(d.visitorId);

      // Referrers — safely parse URL
      let ref = 'Direct';
      if (d.referrer) {
        try { ref = new URL(d.referrer).hostname; } catch (_) { ref = d.referrer.split('/')[2] || 'Direct'; }
      }
      referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;

      // Devices
      const ua = (d.userAgent || '').toLowerCase();
      if (/tablet|ipad/.test(ua)) deviceCounts.Tablet++;
      else if (/mobile|android|iphone/.test(ua)) deviceCounts.Mobile++;
      else deviceCounts.Desktop++;
    });

    // Enrich topPages with unique visitor count
    const topPagesEnriched = topPages.map(p => ({
      page: p.page,
      count: p.count,
      unique: pageUniqueVisitors[p.page] ? pageUniqueVisitors[p.page].size : 0,
    }));

    const topReferrers = Object.entries(referrerCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.render('admin/analytics', {
      dailyStats,
      totalViews,
      totalUniqueVisitors,
      topPages: topPagesEnriched,
      recentViews: recentViews.slice(0, 50),
      days,
      categories,
      topReferrers,
      deviceCounts,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.render('admin/analytics', {
      dailyStats: [],
      totalViews: 0,
      totalUniqueVisitors: 0,
      topPages: [],
      recentViews: [],
      days: 30,
      categories: { Home: 0, Services: 0, Portfolio: 0, About: 0, Contact: 0, Other: 0 },
      topReferrers: [],
      deviceCounts: { Desktop: 0, Mobile: 0, Tablet: 0 },
    });
  }
});

// ── Clear analytics data ────────────────────────────────────────────────────
router.post('/analytics/clear', requireAdmin, async (req, res) => {
  try {
    // Delete all pageViews
    const pvSnap = await db.collection('pageViews').limit(500).get();
    const batch1 = db.batch();
    pvSnap.forEach(doc => batch1.delete(doc.ref));
    await batch1.commit();

    // Delete all dailyStats
    const dsSnap = await db.collection('dailyStats').limit(500).get();
    const batch2 = db.batch();
    dsSnap.forEach(doc => batch2.delete(doc.ref));
    await batch2.commit();

    res.redirect('/admin/analytics');
  } catch (err) {
    console.error('Clear analytics error:', err);
    res.redirect('/admin/analytics');
  }
});

// ── Settings (site-wide content) ────────────────────────────────────────────
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('site').get();
    const settings = doc.exists ? doc.data() : {};
    res.render('admin/settings', { settings, saved: false });
  } catch (err) {
    res.render('admin/settings', { settings: {}, saved: false });
  }
});

router.post('/settings', requireAdmin, async (req, res) => {
  const settings = {
    companyPhone: req.body.companyPhone || '',
    companyEmail: req.body.companyEmail || '',
    companyAddress: req.body.companyAddress || '',
    businessHours: req.body.businessHours || '',
    socialFacebook: req.body.socialFacebook || '',
    socialInstagram: req.body.socialInstagram || '',
    socialLinkedin: req.body.socialLinkedin || '',
    socialGoogle: req.body.socialGoogle || '',
    metaTitle: req.body.metaTitle || '',
    metaDescription: req.body.metaDescription || '',
  };
  await db.collection('settings').doc('site').set(settings, { merge: true });
  res.render('admin/settings', { settings, saved: true });
});

// ── API: Contact form submission (from front-end) ───────────────────────────
router.post('/api/contact', async (req, res) => {
  try {
    const { fname, lname, email, phone, address, service, budget, timeline, message } = req.body;
    if (!fname || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    await db.collection('contacts').add({
      fname,
      lname: lname || '',
      email,
      phone: phone || '',
      address: address || '',
      service: service || '',
      budget: budget || '',
      timeline: timeline || '',
      message: message || '',
      status: 'new',
      timestamp: new Date(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact save error:', err);
    res.status(500).json({ error: 'Failed to save.' });
  }
});

// ── Careers management ──────────────────────────────────────────────────────
router.get('/careers', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('careers')
      .orderBy('order', 'asc')
      .get();
    const careers = [];
    snap.forEach(doc => careers.push({ id: doc.id, ...doc.data() }));
    res.render('admin/careers', { careers });
  } catch (err) {
    console.error('Careers list error:', err);
    res.render('admin/careers', { careers: [] });
  }
});

router.get('/careers/new', requireAdmin, (req, res) => {
  res.render('admin/career-form', { career: null });
});

router.post('/careers', requireAdmin, async (req, res) => {
  try {
    const { title, type, location, salary, salaryNote, description, requirements, active, order } = req.body;
    await db.collection('careers').add({
      title: (title || '').trim(),
      type: (type || 'Full-Time').trim(),
      location: (location || 'Beverly, MA').trim(),
      salary: (salary || '').trim(),
      salaryNote: (salaryNote || '').trim(),
      description: (description || '').trim(),
      requirements: (requirements || '').trim(),
      active: active === 'on',
      order: parseInt(order) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.redirect('/admin/careers');
  } catch (err) {
    console.error('Career create error:', err);
    res.redirect('/admin/careers');
  }
});

router.get('/careers/:id/edit', requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('careers').doc(req.params.id).get();
    if (!doc.exists) return res.redirect('/admin/careers');
    res.render('admin/career-form', { career: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.redirect('/admin/careers');
  }
});

router.post('/careers/:id', requireAdmin, async (req, res) => {
  try {
    const { title, type, location, salary, salaryNote, description, requirements, active, order } = req.body;
    await db.collection('careers').doc(req.params.id).update({
      title: (title || '').trim(),
      type: (type || 'Full-Time').trim(),
      location: (location || 'Beverly, MA').trim(),
      salary: (salary || '').trim(),
      salaryNote: (salaryNote || '').trim(),
      description: (description || '').trim(),
      requirements: (requirements || '').trim(),
      active: active === 'on',
      order: parseInt(order) || 0,
      updatedAt: new Date(),
    });
    res.redirect('/admin/careers');
  } catch (err) {
    console.error('Career update error:', err);
    res.redirect('/admin/careers');
  }
});

router.post('/careers/:id/delete', requireAdmin, async (req, res) => {
  try {
    await db.collection('careers').doc(req.params.id).delete();
  } catch (err) {
    console.error('Career delete error:', err);
  }
  res.redirect('/admin/careers');
});

router.post('/careers/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('careers').doc(req.params.id).get();
    if (doc.exists) {
      await db.collection('careers').doc(req.params.id).update({
        active: !doc.data().active,
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.error('Career toggle error:', err);
  }
  res.redirect('/admin/careers');
});

module.exports = router;
