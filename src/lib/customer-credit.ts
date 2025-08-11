
import { collection, query, where, getDocs, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { Order } from './types';

/**
 * Moves an order's outstanding change into a customer's persistent credit balance.
 * @param customerTag The customer's identifier (name, table number, etc.).
 * @param creditAmount The amount of credit to add.
 * @param sourceOrderId The ID of the order from which the change is being converted to credit.
 */
export async function addCreditToCustomer(customerTag: string, creditAmount: number, sourceOrderId: string): Promise<void> {
    const customerRef = doc(db, "customers", customerTag);
    const orderRef = doc(db, "orders", sourceOrderId);

    try {
        await runTransaction(db, async (transaction) => {
            const customerDoc = await transaction.get(customerRef);
            
            // Calculate new credit balance
            const currentCredit = customerDoc.exists() ? customerDoc.data().credit || 0 : 0;
            const newCredit = currentCredit + creditAmount;

            // Update customer's credit balance
            transaction.set(customerRef, { id: customerTag, credit: newCredit }, { merge: true });

            // Mark the original order's change as settled by converting to credit
            transaction.update(orderRef, {
                balanceDue: 0,
                changeGiven: 0, // The change was converted to credit, not given as cash
                creditSource: [`Converted to credit for ${customerTag}`] // Note for traceability
            });
        });
        console.log(`Successfully added ${creditAmount} credit to ${customerTag}`);
    } catch (error) {
        console.error("Error in addCreditToCustomer transaction:", error);
        throw error; // Re-throw to be handled by the caller
    }
}
