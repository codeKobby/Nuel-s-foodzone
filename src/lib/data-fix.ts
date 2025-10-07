
'use server';
/**
 * @fileOverview This file contains one-time use server-side functions to correct
 * specific data errors in the Firestore database.
 */

import { collection, query, where, getDocs, writeBatch, serverTimestamp, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Order } from './types';

/**
 * Corrects the payment distribution for orders #0707 and #0708.
 * This is a one-time function to fix a specific data entry error where a split
 * cash/momo payment was incorrectly recorded as only momo.
 */
export async function fixIncorrectPaymentData(): Promise<{ success: boolean, message: string }> {
    const orderIdsToFix = ['NFZ-1003-0707', 'NFZ-1003-0708'];
    
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where('simplifiedId', 'in', orderIdsToFix));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.docs.length !== 2) {
            throw new Error(`Expected to find 2 orders, but found ${querySnapshot.docs.length}. The fix may have already been applied or the orders were not found.`);
        }

        const batch = writeBatch(db);

        const order707Doc = querySnapshot.docs.find(d => d.data().simplifiedId === 'NFZ-1003-0707');
        const order708Doc = querySnapshot.docs.find(d => d.data().simplifiedId === 'NFZ-1003-0708');

        if (!order707Doc || !order708Doc) {
             throw new Error("Could not find both required order documents.");
        }
        
        const order707Ref = doc(db, "orders", order707Doc.id);
        const order708Ref = doc(db, "orders", order708Doc.id);

        // Reset and correct order #0707 (Total: 550)
        // This order was fully paid by the initial cash payment.
        batch.update(order707Ref, {
            paymentStatus: 'Paid',
            paymentMethod: 'cash',
            amountPaid: 550,
            balanceDue: 0,
            lastPaymentAmount: 550,
            lastPaymentTimestamp: serverTimestamp(), // Approximate time
            notes: 'Data Correction: Payment method set to cash. (Previous error)',
        });
        
        // Reset and correct order #0708 (Total: 290)
        // This order was paid for by the momo payment.
         batch.update(order708Ref, {
            paymentStatus: 'Paid',
            paymentMethod: 'momo',
            amountPaid: 290,
            balanceDue: 0,
            lastPaymentAmount: 290,
            lastPaymentTimestamp: serverTimestamp(),
            notes: 'Data Correction: Payment method set to momo. (Previous error)',
        });
        
        await batch.commit();

        return { success: true, message: "Successfully corrected payment data for orders #0707 and #0708." };

    } catch (error) {
        console.error("Error fixing payment data:", error);
        return { success: false, message: `Failed to fix data: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}
