#!/usr/bin/env node

const admin = require("firebase-admin");

const [emailArg, roleArg, displayNameArg] = process.argv.slice(2);
const email = (emailArg || "").trim().toLowerCase();
const role = (roleArg || "").trim().toLowerCase();
const displayName = (displayNameArg || "").trim();

if (!email || !["cashier", "kitchen"].includes(role)) {
  console.error(
    "Usage: node scripts/provision-staff-auth.cjs <email> <cashier|kitchen> [display name]"
  );
  process.exit(1);
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
  const user = await auth.getUserByEmail(email);

  if (!user.emailVerified) {
    throw new Error(`Verify ${email} before provisioning a staff role.`);
  }

  const existingClaims = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, {
    ...existingClaims,
    role,
  });

  await db.collection("staffProfiles").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      displayName: displayName || user.displayName || null,
      role,
      status: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Provisioned ${role} role for ${email} (${user.uid}).`);
  console.log("The staff member must sign out and sign in again to receive the new claim.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
