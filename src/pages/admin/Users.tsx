import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MoreHorizontal, Search, UserPlus, Mail, Phone, Settings, Loader2 } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
// Import Firebase modules
import { auth, db } from "@/config/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
} from "firebase/firestore";

// Define the User interface to match Firebase data
interface User {
  id: string;
  uid?: string;
  fullName: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  role: "patient" | "doctor" | "admin";
  status?: "active" | "inactive" | "pending";
  joinDate?: string | Timestamp;
  photoURL?: string;
  appointments?: number;
}

// Mock data for fallback if Firebase fetch fails
const mockUsers = [
  {
    id: "1",
    fullName: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    phone: "(555) 123-4567",
    role: "patient",
    status: "active",
    joinDate: "2024-12-10",
    appointments: 8,
  },
  {
    id: "2",
    fullName: "Michael Chen",
    email: "michael.chen@example.com",
    phone: "(555) 987-6543",
    role: "patient",
    status: "active",
    joinDate: "2025-01-15",
    appointments: 3,
  },
  {
    id: "3",
    fullName: "Emily Rodriguez",
    email: "emily.rodriguez@example.com",
    phone: "(555) 456-7890",
    role: "patient",
    status: "inactive",
    joinDate: "2024-10-03",
    appointments: 12,
  },
  {
    id: "4",
    fullName: "Robert Smith",
    email: "robert.smith@example.com",
    phone: "(555) 789-0123",
    role: "patient",
    status: "active",
    joinDate: "2025-03-22",
    appointments: 1,
  },
  {
    id: "5",
    fullName: "Sophia Martinez",
    email: "sophia.martinez@example.com",
    phone: "(555) 234-5678",
    role: "patient",
    status: "active",
    joinDate: "2025-02-18",
    appointments: 5,
  },
  {
    id: "6",
    fullName: "James Wilson",
    email: "james.wilson@example.com",
    phone: "(555) 321-0987",
    role: "patient",
    status: "pending",
    joinDate: "2025-04-08",
    appointments: 0,
  },
];

const Users = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersCollection = collection(db, 'users');
        const querySnapshot = await getDocs(usersCollection);
        
        const fetchedUsers = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            uid: data.uid,
            fullName: data.fullName || 'Unknown',
            email: data.email || '',
            phone: data.phoneNumber || data.phone || '',
            role: data.role || 'patient',
            status: data.status || 'active',
            joinDate: data.joinDate || data.createdAt || new Date().toISOString(),
            photoURL: data.photoURL || '',
            appointments: data.appointments?.length || 0
          };
        });
        
        setUsers(fetchedUsers);
        toast({
          title: "Users Loaded",
          description: `Successfully loaded ${fetchedUsers.length} users`,
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load users. Using mock data instead.",
        });
        setUsers(mockUsers);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [toast]);
  
  // Filter users based on search query and status filter
  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone && user.phone.includes(searchQuery));
    
    // Status filter
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && user.status === statusFilter;
  });
  
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };
  
  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Update the user in Firestore
      await updateDoc(userRef, {
        fullName: selectedUser.fullName,
        email: selectedUser.email,
        phoneNumber: selectedUser.phone, // Use consistent field name
        status: selectedUser.status,
      });
      
      // Update the local state
      setUsers(prevUsers => prevUsers.map(user => 
        user.id === selectedUser.id ? selectedUser : user
      ));
      
      toast({
        title: "User Updated",
        description: `${selectedUser.fullName}'s information has been updated.`,
      });
      
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "There was a problem updating the user information.",
      });
    }
  };
  
  const handleChangeStatus = async (userId: string, newStatus: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Update status in Firestore
      await updateDoc(userRef, {
        status: newStatus,
      });
      
      // Update local state
      setUsers(prevUsers => prevUsers.map(user => 
        user.id === userId ? {...user, status: newStatus as "active" | "inactive" | "pending"} : user
      ));
      
      toast({
        title: "Status Changed",
        description: `User status has been changed to ${newStatus}.`,
      });
    } catch (error) {
      console.error("Error changing user status:", error);
      toast({
        variant: "destructive",
        title: "Status Change Failed",
        description: "There was a problem updating the user status.",
      });
    }
  };
  
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    
    try {
      // Delete user document from Firestore
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      
      // Remove user from local state
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      
      toast({
        title: "User Deleted",
        description: "The user has been deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "There was a problem deleting the user.",
      });
    }
  };

  return (
    <Layout userRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            View and manage patients registered in the system
          </p>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Select defaultValue="all" onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button className="gap-2 bg-health-primary hover:bg-health-secondary">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Join Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {user.photoURL ? (
                            <AvatarImage src={user.photoURL} alt={user.fullName} />
                          ) : (
                            <AvatarFallback className="bg-gray-100 text-gray-800">
                              {user.fullName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <div>{user.fullName}</div>
                          <div className="md:hidden text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                    <TableCell className="hidden lg:table-cell">{user.phone}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge
                        className={
                          user.status === "active" 
                            ? "bg-green-100 text-green-800" 
                            : user.status === "inactive" 
                              ? "bg-gray-100 text-gray-800" 
                              : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.joinDate instanceof Timestamp
                        ? user.joinDate.toDate().toLocaleDateString()
                        : new Date(user.joinDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            Edit details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleChangeStatus(user.id, user.status === "active" ? "inactive" : "active")}
                          >
                            {user.status === "active" ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Delete account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user's information and preferences.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right text-sm font-medium">
                  Name
                </label>
                <Input
                  id="name"
                  value={selectedUser.fullName}
                  onChange={(e) => setSelectedUser({...selectedUser, fullName: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right text-sm font-medium">
                  Phone
                </label>
                <Input
                  id="phone"
                  value={selectedUser.phone}
                  onChange={(e) => setSelectedUser({...selectedUser, phone: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="status" className="text-right text-sm font-medium">
                  Status
                </label>
                <Select 
                  value={selectedUser.status} 
                  onValueChange={(value) => setSelectedUser({...selectedUser, status: value})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-health-primary hover:bg-health-secondary" onClick={handleSaveUser}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Users;
