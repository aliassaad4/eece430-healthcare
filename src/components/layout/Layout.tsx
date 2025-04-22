
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { checkAuthenticated, getUserRole } from "@/hooks/use-session";

interface LayoutProps {
  children: React.ReactNode;
  userRole?: "patient" | "doctor" | "admin";
  isAuthenticated?: boolean;
}

export const Layout = ({ 
  children, 
  userRole = "patient", 
  isAuthenticated = true 
}: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  
  // Check if user is authenticated, redirect to login if not
  useEffect(() => {
    const isUserAuthenticated = checkAuthenticated();
    if (!isUserAuthenticated) {
      navigate('/auth');
    }
  }, [navigate]);
  
  // Get the actual user role from session
  const actualUserRole = getUserRole() || userRole;

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar toggleSidebar={toggleSidebar} isAuthenticated={isAuthenticated} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} userRole={actualUserRole} />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
