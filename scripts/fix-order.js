#!/usr/bin/env node
/**
 * Script to fix order and mark it as paid.
 *
 * Usage:
 *   1. Ensure you have a Google service account JSON and set:
 *      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
 *   2. Run: node scripts/fix-order.js <orderId>
 *
 *   Example: node scripts/fix-order.js NFZ-1127-1299
 */

const admin = require("firebase-admin");

async function main() {
  const orderId = process.argv[2] || "NFZ-1127-1299";

  // Initialize Admin SDK using Application Default Credentials
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    if (!/already exists/.test(String(err))) {
      console.error("Failed to initialize firebase-admin:", err);
      process.exit(1);
    }
  }

  const db = admin.firestore();

  try {
    console.log("Searching for order:", orderId);

    // First try to get by document ID directly
    const directDoc = await db.collection("orders").doc(orderId).get();
    if (directDoc.exists) {
      console.log("Found order by document ID");
      await updateOrder(directDoc);
      return;
    }

    // Then try by simplifiedId field
    let snapshot = await db
      .collection("orders")
      .where("simplifiedId", "==", orderId)
      .get();

    if (snapshot.empty) {
      // Try partial match - get recent orders and filter
      console.log("Not found by simplifiedId, trying to list recent orders...");
      const recentOrders = await db
        .collection("orders")
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

      console.log("\nRecent orders (last 50):");
      recentOrders.docs.forEach((doc) => {
        const order = doc.data();
        console.log(
          `  ${order.simplifiedId || doc.id} - ${order.tag || "No tag"} - ${
            order.paymentStatus
          } - Total: ${order.total}`
        );
      });

      console.log("\nOrder not found. Please check the order ID above.");
      process.exit(1);
    }

    for (const doc of snapshot.docs) {
      await updateOrder(doc);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

async function updateOrder(doc) {
  const order = doc.data();
  console.log("\n--- Current Order State ---");
  console.log("Document ID:", doc.id);
  console.log("Simplified ID:", order.simplifiedId);
  console.log("Tag:", order.tag);
  console.log("Status:", order.status);
  console.log("Payment Status:", order.paymentStatus);
  console.log("Total:", order.total);
  console.log("Amount Paid:", order.amountPaid);
  console.log("Balance Due:", order.balanceDue);

  // Update the order to mark as paid
  await doc.ref.update({
    paymentStatus: "Paid",
    amountPaid: order.total,
    balanceDue: 0,
    status: "Completed",
  });

  console.log("\n✅ Order updated successfully!");
  console.log("New paymentStatus: Paid");
  console.log("New amountPaid:", order.total);
  console.log("New balanceDue: 0");
  console.log("New status: Completed");
}

main();
