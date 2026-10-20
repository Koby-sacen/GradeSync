// features/auth/logout.ts
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase' // Adjust this import path to match your firebase config location

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth)
    // Optional: Add redirect logic or state updates here if needed, e.g.:
    // window.location.href = '/login'
  } catch (error) {
    console.error('Error logging out:', error)
    throw error
  }
}