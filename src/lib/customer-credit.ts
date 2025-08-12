
import { collection, query, where, getDocs, doc, writeBatch, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Order } from './types';

/**
 * Applies an order's outstanding change as a credit to other unpaid orders for the same customer.
 * @param sourceOrderId The ID of the order providing the credit (where change is due).
 * @param targetOrderIds The IDs of the unpaid orders to apply the credit to.
 */
export async function applyChangeAsCreditToOrders(sourceOrderId: string, targetOrderIds: string[]): Promise<{success: boolean, message: string}> {
    if (!sourceOrderId || !targetOrderIds || targetOrderIds.length === 0) {
        return { success: false, message: "Source or target orders are missing." };
    }

    const sourceOrderRef = doc(db, "orders", sourceOrderId);

    try {
        await runTransaction(db, async (transaction) => {
            const sourceOrderDoc = await transaction.get(sourceOrderRef);
            if (!sourceOrderDoc.exists() || sourceOrderDoc.data().balanceDue <= 0) {
                throw new Error("Source order not found or has no credit to apply.");
            }

            let availableCredit = sourceOrderDoc.data().balanceDue;

            // Mark the source order's change as settled
            transaction.update(sourceOrderRef, {
                balanceDue: 0,
                changeGiven: sourceOrderDoc.data().balanceDue, // Reflect that the 'change' was handled
                creditSource: [`Applied to other orders on ${new Date().toLocaleDateString()}`]
            });

            for (const targetId of targetOrderIds) {
                if (availableCredit <= 0) break;

                const targetOrderRef = doc(db, "orders", targetId);
                const targetOrderDoc = await transaction.get(targetOrderRef);

                if (!targetOrderDoc.exists()) {
                    console.warn(`Target order ${targetId} not found, skipping.`);
                    continue;
                }

                const targetOrderData = targetOrderDoc.data() as Order;
                const balanceToPay = targetOrderData.balanceDue;
                const creditToApply = Math.min(availableCredit, balanceToPay);

                const newAmountPaid = targetOrderData.amountPaid + creditToApply;
                const newBalanceDue = balanceToPay - creditToApply;
                const newPaymentStatus = newBalanceDue <= 0 ? 'Paid' : 'Partially Paid';
                const newStatus = newBalanceDue <= 0 ? 'Completed' : targetOrderData.status;


                transaction.update(targetOrderRef, {
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                    paymentStatus: newPaymentStatus,
                    status: newStatus,
                    lastPaymentTimestamp: serverTimestamp(),
                    lastPaymentAmount: creditToApply,
                    creditSource: [...(targetOrderData.creditSource || []), `Credit from #${sourceOrderDoc.data().simplifiedId}`]
                });

                availableCredit -= creditToApply;
            }
        });

        return { success: true, message: "Credit applied successfully." };
    } catch (error) {
        console.error("Error in applyChangeAsCreditToOrders transaction:", error);
        if (error instanceof Error) {
            return { success: false, message: error.message };
        }
        return { success: false, message: "An unknown error occurred while applying credit." };
    }
}
