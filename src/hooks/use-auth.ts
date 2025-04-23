import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { User } from 'firebase/auth';
import { 
  signInUser, 
  signOutUser, 
  getUserRole,
  subscribeToAuthChanges,
  registerUser
} from '@/services/firebase/auth.service';

export type UserRole = 'patient' | 'doctor' | 'admin';

export interface AuthState {
  currentUser: User | null;
  userRole: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authState, setAuthState] = useState<AuthState>({
    currentUser: null,
    userRole: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      if (user) {
        // User is signed in
        try {
          const role = await getUserRole(user.uid);
          setAuthState({
            currentUser: user,
            userRole: (role as UserRole) || 'patient',
            isLoading: false,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error("Error getting user role:", error);
          setAuthState({
            currentUser: user,
            userRole: 'patient', // Default role if can't determine
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } else {
        // User is signed out
        setAuthState({
          currentUser: null,
          userRole: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const userCredential = await signInUser(email, password);
      const user = userCredential.user;
      
      // Get user role from Firestore
      const role = await getUserRole(user.uid);
      
      toast({
        title: "Logged In",
        description: `Welcome back! You're now logged in.`,
      });
      
      // Redirect to appropriate dashboard
      if (role) {
        navigate(`/${role}`);
      } else {
        navigate('/auth/role-selection');
      }
      
      return { success: true, user };
    } catch (error: any) {
      console.error("Login error:", error);
      
      toast({
        title: "Login Failed",
        description: error.message || "Failed to login. Please check your credentials.",
        variant: "destructive",
      });
      
      return { success: false, error };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [navigate, toast]);

  const logout = useCallback(async () => {
    try {
      await signOutUser();
      
      // Redirect to auth page
      navigate('/auth');
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  }, [navigate, toast]);

  const register = useCallback(async (email: string, password: string, displayName: string, role: UserRole, additionalData = {}) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const userCredential = await registerUser(email, password, displayName, role, additionalData);
      
      toast({
        title: "Registration Successful",
        description: "Your account has been created successfully!",
      });
      
      navigate('/auth/login');
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      console.error("Registration error:", error);
      
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register. Please try again.",
        variant: "destructive",
      });
      
      return { success: false, error };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [navigate, toast]);

  return {
    ...authState,
    login,
    logout,
    register,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    currentUser: authState.currentUser,
    userRole: authState.userRole,
  };
};
