import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Calendar, Menu, LogIn } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { logoutUser } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

interface NavbarProps {
  toggleSidebar: () => void;
  isAuthenticated?: boolean;
}

interface UserData {
  fullName: string;
  email: string;
  photoURL?: string;
  role?: string;
}

export const Navbar = ({ toggleSidebar, isAuthenticated = false }: NavbarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get current user and their data from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // First try to get user data directly from document ID
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData({
              fullName: data.fullName || currentUser.displayName || 'User',
              email: data.email || currentUser.email || '',
              photoURL: data.photoURL || currentUser.photoURL || '',
              role: data.role
            });
          } else {
            // If no document found by ID, try to query by UID field
            // This is for backward compatibility with older data
            const usersCollection = collection(db, 'users');
            const q = query(usersCollection, where('uid', '==', currentUser.uid));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const userData = querySnapshot.docs[0].data() as UserData;
              setUserData({
                fullName: userData.fullName || currentUser.displayName || 'User',
                email: userData.email || currentUser.email || '',
                photoURL: userData.photoURL || currentUser.photoURL || '',
                role: userData.role
              });
            } else {
              // Fallback to auth user data if Firestore document doesn't exist
              setUserData({
                fullName: currentUser.displayName || 'User',
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || ''
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);
  
  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const handleLogout = () => {
    logoutUser();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    navigate("/auth");
  };

  return (
    <nav className="border-b bg-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <Link to={userData?.role ? `/${userData.role}` : "/"} className="flex items-center gap-2">
          <span className="font-bold text-xl text-primary">HealthEase Pro</span>
        </Link>
      </div>
      
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                3
              </span>
            </Button>
            
            <Button variant="ghost" size="icon">
              <Calendar className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userData?.photoURL || ""} alt={userData?.fullName || "User"} />
                    <AvatarFallback className="bg-primary text-white">
                      {loading ? '...' : (userData?.fullName ? getInitials(userData.fullName) : 'U')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {loading ? 'Loading...' : (userData?.fullName || 'User')}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {loading ? '...' : (userData?.email || '')}
                    </p>
                    {userData?.role && (
                      <p className="text-xs leading-none text-muted-foreground capitalize">
                        Role: {userData.role}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => navigate(userData?.role ? `/${userData.role}/settings` : "/settings")}
                >
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(userData?.role ? `/${userData.role}/settings` : "/settings")}
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => navigate("/auth")}
            className="flex items-center gap-1"
          >
            <LogIn className="h-4 w-4" />
            Log In
          </Button>
        )}
      </div>
    </nav>
  );
};
