/**
 * @fileOverview This file contains the functions that interact with the menu items
 * collection in Firestore. These are used as tools by the AI agent.
 */

import { collection, getDocs, addDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { AddMenuItemInput, GetMenuItemsInput, UpdateMenuItemInput, DeleteMenuItemInput, GetMenuItemsOutput } from '@/ai/schemas';
import type { MenuItem } from './types';


/**
 * Retrieves menu items from Firestore.
 */
export async function getMenuItems(input: GetMenuItemsInput): Promise<GetMenuItemsOutput> {
    try {
        const menuRef = collection(db, "menuItems");
        let q;
        if (input.category) {
            q = query(menuRef, where("category", "==", input.category));
        } else {
            q = query(menuRef);
        }
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        return items;
    } catch (error) {
        console.error("Error getting menu items:", error);
        return [];
    }
}

/**
 * Adds a new item to the menu in Firestore.
 */
export async function addMenuItem(input: AddMenuItemInput): Promise<string> {
    try {
        await addDoc(collection(db, "menuItems"), {
            name: input.name,
            price: input.price,
            category: input.category,
            stock: input.stock ?? 100, // Default stock
        });
        return `Successfully added "${input.name}" to the menu.`;
    } catch (error) {
        console.error("Error adding menu item:", error);
        return `Failed to add "${input.name}" to the menu.`;
    }
}

/**
 * Updates an existing menu item in Firestore.
 */
export async function updateMenuItem(input: UpdateMenuItemInput): Promise<string> {
    try {
        const q = query(collection(db, "menuItems"), where("name", "==", input.name));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return `Could not find an item named "${input.name}" to update.`;
        }

        const batch = writeBatch(db);
        const updates: Partial<MenuItem> = {};
        if (input.newName) updates.name = input.newName;
        if (input.newPrice) updates.price = input.newPrice;
        if (input.newCategory) updates.category = input.newCategory;
        if (input.newStock !== undefined) updates.stock = input.newStock;

        snapshot.forEach(doc => {
            batch.update(doc.ref, updates);
        });

        await batch.commit();
        return `Successfully updated the item "${input.name}".`;

    } catch (error) {
        console.error("Error updating menu item:", error);
        return `Failed to update the item "${input.name}".`;
    }
}

/**
 * Deletes a menu item from Firestore.
 */
export async function deleteMenuItem(input: DeleteMenuItemInput): Promise<string> {
    try {
        const q = query(collection(db, "menuItems"), where("name", "==", input.name));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return `Could not find an item named "${input.name}" to delete.`;
        }
        
        const batch = writeBatch(db);
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        return `Successfully deleted "${input.name}" from the menu.`;

    } catch (error) {
        console.error("Error deleting menu item:", error);
        return `Failed to delete "${input.name}".`;
    }
}
