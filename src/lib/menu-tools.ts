
/**
 * @fileOverview This file contains the functions that interact with the menu items
 * collection in Firestore. These are used as tools by the AI agent.
 */

import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem } from '@/lib/types';
import { 
  type GetMenuItemsInput, 
  type GetMenuItemsOutput,
  type AddMenuItemInput,
  type UpdateMenuItemInput,
  type DeleteMenuItemInput
} from '@/ai/schemas';

/**
 * Retrieves menu items from Firestore, optionally filtered by category.
 */
export async function getMenuItems(input: GetMenuItemsInput): Promise<GetMenuItemsOutput> {
    try {
        const menuRef = collection(db, "menuItems");
        let menuQuery = query(menuRef);
        
        if (input.category) {
            menuQuery = query(menuRef, where('category', '==', input.category));
        }
        
        const querySnapshot = await getDocs(menuQuery);
        const items: MenuItem[] = [];
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            items.push({
                id: doc.id,
                name: data.name,
                price: data.price,
                category: data.category,
                stock: data.stock || 0,
                requiresChoice: data.requiresChoice || false,
            });
        });

        return {
            items,
            totalCount: items.length,
        };
    } catch (error) {
        console.error("Error fetching menu items:", error);
        return {
            items: [],
            totalCount: 0,
        };
    }
}

/**
 * Adds a new menu item to Firestore.
 */
export async function addMenuItem(input: AddMenuItemInput): Promise<string> {
    try {
        const menuRef = collection(db, "menuItems");
        const docRef = await addDoc(menuRef, {
            name: input.name,
            price: input.price,
            category: input.category,
            stock: input.stock,
            requiresChoice: false,
        });
        
        return `Successfully added "${input.name}" to the ${input.category} category with ID: ${docRef.id}`;
    } catch (error) {
        console.error("Error adding menu item:", error);
        return `Failed to add "${input.name}" to the menu. Error: ${error}`;
    }
}

/**
 * Updates an existing menu item in Firestore.
 */
export async function updateMenuItem(input: UpdateMenuItemInput): Promise<string> {
    try {
        const menuRef = doc(db, "menuItems", input.id);
        const updateData: any = {};
        
        if (input.name !== undefined) updateData.name = input.name;
        if (input.price !== undefined) updateData.price = input.price;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.stock !== undefined) updateData.stock = input.stock;
        
        await updateDoc(menuRef, updateData);
        
        const updatedFields = Object.keys(updateData).join(', ');
        return `Successfully updated menu item (ID: ${input.id}). Updated fields: ${updatedFields}`;
    } catch (error) {
        console.error("Error updating menu item:", error);
        return `Failed to update menu item (ID: ${input.id}). Error: ${error}`;
    }
}

/**
 * Deletes a menu item from Firestore.
 */
export async function deleteMenuItem(input: DeleteMenuItemInput): Promise<string> {
    try {
        const menuRef = doc(db, "menuItems", input.id);
        await deleteDoc(menuRef);
        
        return `Successfully deleted menu item with ID: ${input.id}`;
    } catch (error) {
        console.error("Error deleting menu item:", error);
        return `Failed to delete menu item (ID: ${input.id}). Error: ${error}`;
    }
}
