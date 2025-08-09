
import { collection, query, where, getDocs, writeBatch, doc, WriteBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Order } from './types';

/**
 * Finds and optionally applies customer credit from previous orders.
 * @param appId The application ID.
 * @param customerTag The customer tag to search for.
 * @param batch Optional Firestore write batch to add update operations to.
 * @param creditToApply The amount of credit to apply. If not provided, just finds credit.
 * @returns The total credit found and a list of orders that have the credit.
 */
export async function findAndApplyCustomerCredit(appId: string, customerTag: string, batch?: WriteBatch, creditToApply?: number) {
    const ordersRef = collection(db, `/artifacts/${appId}/public/data/orders`);
    // Find orders with the same tag that have change due (balanceDue > 0 and was paid by cash)
    const q = query(ordersRef, 
        where('tag', '==', customerTag),
        where('paymentMethod', '==', 'cash'),
        where('balanceDue', '>', 0)
    );
    const querySnapshot = await getDocs(q);

    let creditFound = 0;
    const creditOrders: Order[] = [];

    querySnapshot.forEach(docSnap => {
        const order = { id: docSnap.id, ...docSnap.data() } as Order;
        // Further check to ensure this balance is indeed change owed, not unpaid balance
        if (order.amountPaid >= order.total) {
            creditFound += order.balanceDue;
            creditOrders.push(order);
        }
    });

    if (batch && creditToApply && creditToApply > 0) {
        let remainingCreditToApply = creditToApply;
        
        // Sort orders to apply credit from oldest first
        creditOrders.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

        for (const order of creditOrders) {
            if (remainingCreditToApply <= 0) break;

            const orderRef = doc(db, `/artifacts/${appId}/public/data/orders`, order.id);
            const amountFromThisOrder = Math.min(order.balanceDue, remainingCreditToApply);

            const newBalanceDue = order.balanceDue - amountFromThisOrder;
            
            batch.update(orderRef, {
                balanceDue: newBalanceDue,
            });

            remainingCreditToApply -= amountFromThisOrder;
        }
    }

    return { creditFound, creditOrders };
}
