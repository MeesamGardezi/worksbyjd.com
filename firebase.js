'use strict';

const admin = require('firebase-admin');

// Initialize with service account — set GOOGLE_APPLICATION_CREDENTIALS env var
// or place your serviceAccountKey.json in the project root
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  serviceAccount = null;
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp();
} else {
  console.warn('⚠ Firebase: No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or add serviceAccountKey.json');
  admin.initializeApp({ projectId: 'worksbyjd-placeholder' });
}

const db = admin.firestore();

module.exports = { admin, db };
