// Service for managing remembered users on the login screen

export interface RememberedUser {
  id: string
  email: string
  fullName: string
  profilePhotoUrl?: string
  lastLoginAt: string
}

const STORAGE_KEY = 'sitter_remembered_users'
const MAX_REMEMBERED_USERS = 5

export const rememberedUsersService = {
  // Get all remembered users
  getUsers(): RememberedUser[] {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  // Add or update a user in the remembered list
  addUser(user: RememberedUser): void {
    if (typeof window === 'undefined') return
    try {
      const users = this.getUsers()

      // Remove existing entry for this user if exists
      const filteredUsers = users.filter(u => u.id !== user.id)

      // Add new user at the beginning (most recent)
      const updatedUsers = [
        { ...user, lastLoginAt: new Date().toISOString() },
        ...filteredUsers
      ].slice(0, MAX_REMEMBERED_USERS) // Keep only the most recent users

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUsers))
    } catch (error) {
      console.error('Error saving remembered user:', error)
    }
  },

  // Remove a user from the remembered list
  removeUser(userId: string): void {
    if (typeof window === 'undefined') return
    try {
      const users = this.getUsers()
      const filteredUsers = users.filter(u => u.id !== userId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredUsers))
    } catch (error) {
      console.error('Error removing remembered user:', error)
    }
  },

  // Clear all remembered users
  clearAll(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing remembered users:', error)
    }
  }
}
