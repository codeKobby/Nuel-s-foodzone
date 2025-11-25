#!/usr/bin/env node
/**
 * Secure local script to set the manager password in Firestore.
 *
 * Usage:
 *   1. Install deps: npm install firebase-admin
 *   2. Ensure you have a Google service account JSON and set:
 *      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
 *   3. Run: node scripts/reset-manager-password.js Graceland18
 *
 * This writes the SHA-256 hash of the provided password to
 * the document `credentials/manager` in Firestore as { passwordHash }.
 *
 * IMPORTANT: Do NOT commit your service account JSON to source control.
 */

const admin = require("firebase-admin");
const crypto = require("crypto");

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: node scripts/reset-manager-password.js <password>");
    process.exit(1);
  }

  // Initialize Admin SDK using Application Default Credentials
  // Make sure GOOGLE_APPLICATION_CREDENTIALS is set to your service account JSON path.
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    // If already initialized in this process, ignore
    if (!/already exists/.test(String(err))) {
      console.error("Failed to initialize firebase-admin:", err);
      process.exit(1);
    }
  }

  const db = admin.firestore();

  const hash = crypto.createHash("sha256").update(password).digest("hex");

  try {
    await db
      .doc("credentials/manager")
      .set({ passwordHash: hash }, { merge: true });
    console.log("Successfully set manager password hash in Firestore.");
  } catch (err) {
    console.error("Error writing to Firestore:", err);
    process.exit(1);
  }
}

main();
