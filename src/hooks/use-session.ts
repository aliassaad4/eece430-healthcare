
// Simple session management hook
// This is a simplified version for demo purposes
// In a real app, you would use a more robust solution

// Check if user is authenticated
export const checkAuthenticated = (): boolean => {
  return localStorage.getItem('isAuthenticated') === 'true';
};

// Get user role
export const getUserRole = (): 'patient' | 'doctor' | 'admin' => {
  const role = localStorage.getItem('userRole');
  if (role === 'patient' || role === 'doctor' || role === 'admin') {
    return role;
  }
  return 'patient'; // Default role
};

// Login helper
export const loginUser = (role: 'patient' | 'doctor' | 'admin', email: string): void => {
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('userRole', role);
  localStorage.setItem('userEmail', email);
};

// Logout helper
export const logoutUser = (): void => {
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
};
