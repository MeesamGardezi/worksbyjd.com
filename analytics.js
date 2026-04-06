'use strict';

const { db } = require('./firebase');
const crypto = require('crypto');
const firebaseAdmin = require('firebase-admin');

/**
 * Server-side middleware: logs every page visit to Firestore.
 * Stored in "pageViews" collection with a daily aggregate in "dailyStats".
 * Tracks unique visitors via hashed IP.
 */
function analyticsMiddleware(req, res, next) {
  // Skip static assets, admin routes, and API calls
  if (
    req.path.startsWith('/admin') ||
    req.path.startsWith('/api/') ||
    req.path.match(/\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|map)$/)
  ) {
    return next();
  }

  // Skip localhost / development traffic
  const ip = req.ip || req.connection.remoteAddress || '';
  if (
    ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' ||
    req.hostname === 'localhost' ||
    (req.headers['referer'] && req.headers['referer'].includes('localhost'))
  ) {
    return next();
  }

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Hash IP for privacy — consistent per visitor per day
  const rawIp = req.ip || req.connection.remoteAddress || 'unknown';
  const visitorId = crypto.createHash('sha256').update(rawIp + dateKey).digest('hex').slice(0, 16);

  const pageView = {
    path: req.path,
    timestamp: now,
    userAgent: req.headers['user-agent'] || '',
    referrer: req.headers['referer'] || '',
    ip: rawIp,
    visitorId,
  };

  // Fire and forget — don't block the response
  db.collection('pageViews').add(pageView).catch(() => {});

  // Increment daily counters + track unique visitor
  const pageKey = req.path.replace(/\//g, '_') || '_root';
  const dailyRef = db.collection('dailyStats').doc(dateKey);
  dailyRef.set(
    {
      date: dateKey,
      totalViews: firebaseAdmin.firestore.FieldValue.increment(1),
      [`pages.${pageKey}`]: firebaseAdmin.firestore.FieldValue.increment(1),
      uniqueVisitors: firebaseAdmin.firestore.FieldValue.arrayUnion(visitorId),
    },
    { merge: true }
  ).catch(() => {});

  next();
}

module.exports = analyticsMiddleware;
