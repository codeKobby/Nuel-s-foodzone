#!/usr/bin/env node

const admin = require("firebase-admin");

const managerEmail = (
  process.env.MANAGER_EMAIL ||
  process.env.NEXT_PUBLIC_MANAGER_EMAIL ||
  "nuelgee54@gmail.com"
).trim().toLowerCase();

if (!managerEmail) {
  throw new Error("MANAGER_EMAIL must be configured.");
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      undefined,
  });
}

async function main() {
  const auth = admin.auth();
  const db = admin.firestore();
  const user = await auth.getUserByEmail(managerEmail);

  if (!user.emailVerified) {
    throw new Error(
      `The manager account ${managerEmail} is not email-verified. Verify it in Firebase Auth before provisioning claims.`
    );
  }

  const existingClaims = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, {
    ...existingClaims,
    role: "manager",
  });

  await db.collection("staffProfiles").doc(user.uid).set(
    {
      uid: user.uid,
      email: managerEmail,
      role: "manager",
      status: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Provisioned manager role for ${managerEmail} (${user.uid}).`);
  console.log("The manager must sign out and sign in again, or refresh the ID token, to receive the new claim.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
