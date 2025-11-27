import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  getDoc,
  DocumentReference,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Order } from "./types";

/**
 * Applies an order's outstanding change as a credit to other unpaid orders for the same customer.
 * @param sourceOrderId The ID of the order providing the credit (where change is due).
 * @param targetOrderIds The IDs of the unpaid orders to apply the credit to.
 */
export async function applyChangeAsCreditToOrders(
  sourceOrderId: string,
  targetOrderIds: string[]
): Promise<{ success: boolean; message: string }> {
  if (!sourceOrderId || !targetOrderIds || targetOrderIds.length === 0) {
    return { success: false, message: "Source or target orders are missing." };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const sourceOrderRef = doc(db, "orders", sourceOrderId);
      const targetOrderRefs = targetOrderIds.map((id) => doc(db, "orders", id));

      const sourceOrderDoc = await transaction.get(sourceOrderRef);
      const targetOrderDocs = await Promise.all(
        targetOrderRefs.map((ref) => transaction.get(ref))
      );

      if (!sourceOrderDoc.exists() || sourceOrderDoc.data().balanceDue >= 0) {
        throw new Error("Source order not found or has no credit to apply.");
      }

      let availableCredit = Math.abs(sourceOrderDoc.data().balanceDue);

      // Mark the source order's balance as settled (now 0)
      // and update changeGiven to reflect the full amount being used as credit
      transaction.update(sourceOrderRef, {
        balanceDue: 0,
        changeGiven: (sourceOrderDoc.data().changeGiven || 0) + availableCredit,
        paymentStatus: "Paid",
        notes: `${
          sourceOrderDoc.data().notes || ""
        } Credit of ${availableCredit.toFixed(
          2
        )} applied to other orders on ${new Date().toLocaleDateString()}.`.trim(),
      });

      for (const targetDoc of targetOrderDocs) {
        if (availableCredit <= 0) break;

        if (!targetDoc.exists()) {
          console.warn(`Target order ${targetDoc.id} not found, skipping.`);
          continue;
        }

        const targetOrderData = targetDoc.data() as Order;
        const balanceToPay = targetOrderData.balanceDue;
        if (balanceToPay <= 0) continue;

        const creditToApply = Math.min(availableCredit, balanceToPay);

        const newAmountPaid = targetOrderData.amountPaid + creditToApply;
        const newBalanceDue = balanceToPay - creditToApply;
        let newPaymentStatus = targetOrderData.paymentStatus;

        if (newBalanceDue <= 0) {
          newPaymentStatus = "Paid";
        } else {
          newPaymentStatus = "Partially Paid";
        }

        transaction.update(targetDoc.ref, {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          paymentStatus: newPaymentStatus,
          lastPaymentTimestamp: serverTimestamp(),
          lastPaymentAmount: creditToApply,
          paymentMethod: "momo", // Treat credit like a digital payment
          notes: `${targetOrderData.notes || ""} Credit from #${
            sourceOrderDoc.data().simplifiedId
          } applied.`.trim(),
        });

        availableCredit -= creditToApply;
      }

      // If there's any credit left over after paying off target orders, update the source order again
      // to give the remaining credit back to the customer.
      if (availableCredit > 0) {
        transaction.update(sourceOrderRef, {
          balanceDue: -availableCredit, // The remaining change is now owed
          changeGiven:
            (sourceOrderDoc.data().changeGiven || 0) +
            (Math.abs(sourceOrderDoc.data().balanceDue) - availableCredit),
          notes: `${
            sourceOrderDoc.data().notes || ""
          } Remaining credit of ${availableCredit.toFixed(
            2
          )} is now due as change.`.trim(),
        });
      }
    });

    return { success: true, message: "Credit applied successfully." };
  } catch (error) {
    console.error("Error in applyChangeAsCreditToOrders transaction:", error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: "An unknown error occurred while applying credit.",
    };
  }
}
