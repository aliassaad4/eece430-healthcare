import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  ClipboardList, 
  FileText, 
  Home, 
  Settings, 
  User, 
  Users, 
  BarChart3, 
  Search 
} from "lucide-react";
import { auth, db } from "@/config/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

interface SidebarProps {
  isOpen: boolean;
  userRole: "patient" | "doctor" | "admin";
}

interface UserData {
  fullName: string;
  email: string;
  photoURL?: string;
  role?: string;
}

export const Sidebar = ({ isOpen, userRole = "patient" }: SidebarProps) => {
  const location = useLocation();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // First try to get user data from Firestore using document ID as the key
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData({
              fullName: data.fullName || currentUser.displayName || 'User',
              email: data.email || currentUser.email || '',
              photoURL: data.photoURL || currentUser.photoURL || '',
              role: data.role || userRole
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
                role: userData.role || userRole
              });
            } else {
              // Fallback to auth user data if Firestore document doesn't exist
              setUserData({
                fullName: currentUser.displayName || 'User',
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || '',
                role: userRole
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
  }, [userRole]);

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Map of navigation items by user role with role-specific dashboard paths
  const navigationItems = {
    patient: [
      { name: "Dashboard", path: "/patient", icon: Home },
      { name: "Find Doctor", path: "/patient/find-doctor", icon: Search },
      { name: "Appointments", path: "/patient/appointments", icon: Calendar },
      { name: "Medical History", path: "/patient/medical-history", icon: FileText },
      { name: "Settings", path: "/patient/settings", icon: Settings },
    ],
    doctor: [
      { name: "Dashboard", path: "/doctor", icon: Home },
      { name: "Patients", path: "/doctor/patients", icon: Users },
      { name: "Appointments", path: "/doctor/appointments", icon: ClipboardList },
      { name: "Settings", path: "/doctor/settings", icon: Settings },
    ],
    admin: [
      { name: "Dashboard", path: "/admin", icon: BarChart3 },
      { name: "Users", path: "/admin/users", icon: Users },
      { name: "Doctors", path: "/admin/doctors", icon: User },
      { name: "Analytics", path: "/admin/analytics", icon: BarChart3 },
      { name: "Settings", path: "/admin/settings", icon: Settings },
    ]
  };

  // Get navigation items for current role
  const items = navigationItems[userRole];

  return (
    <div 
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r bg-sidebar transition-transform lg:translate-x-0 lg:static",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link to={`/${userRole}`} className="flex items-center gap-2">
          <span className="font-bold text-xl text-health-primary">HealthEase</span>
        </Link>
      </div>
      
      <div className="flex-1 overflow-auto py-6 px-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  isActive 
                    ? "bg-health-primary text-white" 
                    : "text-gray-700 hover:bg-health-light"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-health-primary flex items-center justify-center text-white">
            {loading 
              ? '...' 
              : (userData?.fullName 
                ? getInitials(userData.fullName) 
                : userRole.charAt(0).toUpperCase())}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {loading ? 'Loading...' : (userData?.fullName || 'User')}
            </span>
            <span className="text-xs text-gray-500 capitalize">
              {userData?.role || userRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
