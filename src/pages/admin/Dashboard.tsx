import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Calendar,
  Clock,
  MessageSquare,
  PlusCircle,
  User,
  Users,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, auth } from "@/config/firebase";
import { collection, getDocs, query, where, orderBy, limit, Timestamp, doc, setDoc, addDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

// Define system statistics interface
interface SystemStats {
  totalUsers: number;
  totalDoctors: number;
  totalAppointments: number;
  activeWaitlists: number;
  isLoading: boolean;
}

// Define activity interface
interface Activity {
  id: string;
  type: "new_doctor" | "emergency_approved" | "waitlist_update" | "new_patient" | "appointment_completed";
  time: string;
  timestamp: Timestamp;
  doctorName?: string;
  patientName?: string;
  specialty?: string;
  count?: number;
}

// Schema for Add User form
const addUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  role: z.enum(["patient", "doctor", "admin"], {
    required_error: "Please select a user role",
  }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalDoctors: 0,
    totalAppointments: 0,
    activeWaitlists: 0,
    isLoading: true
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  
  // Form for adding a new user
  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "patient",
      password: ""
    },
  });

  // Fetch system statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch total users
        const usersQuery = query(collection(db, "users"), where("role", "!=", "admin"));
        const usersSnapshot = await getDocs(usersQuery);
        const totalUsers = usersSnapshot.size;

        // Fetch doctors
        const doctorsQuery = query(collection(db, "users"), where("role", "==", "doctor"));
        const doctorsSnapshot = await getDocs(doctorsQuery);
        const totalDoctors = doctorsSnapshot.size;

        // Fetch appointments
        const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
        const totalAppointments = appointmentsSnapshot.size;

        // Fetch active waitlists
        const waitlistsQuery = query(collection(db, "waitlists"), where("status", "==", "active"));
        const waitlistsSnapshot = await getDocs(waitlistsQuery);
        const activeWaitlists = waitlistsSnapshot.size;

        setStats({
          totalUsers,
          totalDoctors,
          totalAppointments,
          activeWaitlists,
          isLoading: false
        });

      } catch (error) {
        console.error("Error fetching system stats:", error);
        toast({
          title: "Error",
          description: "Failed to load system statistics",
          variant: "destructive"
        });
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchStats();
  }, [toast]);

  // Fetch recent activities
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        // Query recent activities, ordered by timestamp (most recent first)
        const activitiesQuery = query(
          collection(db, "systemActivities"),
          orderBy("timestamp", "desc"),
          limit(5) // Get only the 5 most recent activities
        );

        const activitiesSnapshot = await getDocs(activitiesQuery);
        const activities: Activity[] = [];

        activitiesSnapshot.forEach(doc => {
          const data = doc.data() as Omit<Activity, "id">;
          const timestamp = data.timestamp as Timestamp;
          
          // Format the timestamp to a relative time string (e.g. "5 minutes ago")
          const timeString = formatRelativeTime(timestamp.toDate());
          
          activities.push({
            id: doc.id,
            ...data,
            time: timeString
          });
        });

        setRecentActivities(activities);
      } catch (error) {
        console.error("Error fetching activities:", error);
        // If no activities yet, show mock data for better UI
        if (recentActivities.length === 0) {
          setRecentActivities([
            {
              id: "sample1",
              type: "new_doctor",
              doctorName: "Dr. Sarah Williams",
              specialty: "Neurologist",
              time: "Just now",
              timestamp: Timestamp.now()
            }
          ]);
        }
      } finally {
        setIsLoadingActivities(false);
      }
    };

    fetchActivities();
  }, []);

  // Format timestamp to relative time string (e.g. "5 minutes ago", "2 hours ago", etc.)
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return "Just now";
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
    
    // For older dates, just return the formatted date
    return date.toLocaleDateString();
  };

  const handleAddUser = () => {
    setIsAddUserDialogOpen(true);
  };
  
  const handleFormSubmit = async (values: AddUserFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Create user with email and password in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        values.email, 
        values.password
      );
      
      const user = userCredential.user;
      
      // 2. Set display name
      await updateProfile(user, {
        displayName: values.name
      });
      
      // 3. Store additional user information in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: values.name,
        email: values.email,
        role: values.role,
        createdAt: new Date(),
        status: 'active'
      });
      
      // 4. Log this activity
      await addDoc(collection(db, "systemActivities"), {
        type: values.role === "doctor" ? "new_doctor" : "new_patient",
        timestamp: Timestamp.now(),
        doctorName: values.role === "doctor" ? `Dr. ${values.name}` : undefined,
        patientName: values.role === "patient" ? values.name : undefined,
      });
      
      // 5. Update statistics
      setStats(prev => ({
        ...prev,
        totalUsers: prev.totalUsers + 1,
        totalDoctors: values.role === "doctor" ? prev.totalDoctors + 1 : prev.totalDoctors
      }));
      
      // 6. Show success message
      toast({
        title: "User Created",
        description: `${values.name} (${values.role}) has been added successfully.`,
      });
      
      // 7. Reset form and close dialog
      form.reset();
      setIsAddUserDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBroadcastMessage = () => {
    toast({
      title: "Broadcast Message",
      description: "This feature will be implemented soon.",
    });
  };

  return (
    <Layout userRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500">System overview and management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleBroadcastMessage}>
              <MessageSquare className="h-4 w-4" />
              Broadcast Message
            </Button>
            <Button className="gap-2 bg-health-primary hover:bg-health-secondary" onClick={handleAddUser}>
              <PlusCircle className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.isLoading ? (
            <div className="col-span-4 flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-health-primary mr-2" />
              <span>Loading statistics...</span>
            </div>
          ) : (
            <>
              <StatsCard 
                title="Total Users" 
                value={stats.totalUsers} 
                icon={<Users className="h-4 w-4" />}
                trend={{ value: Math.round(stats.totalUsers * 0.05), isPositive: true }}
              />
              <StatsCard 
                title="Total Doctors" 
                value={stats.totalDoctors} 
                icon={<User className="h-4 w-4" />}
                trend={{ value: Math.round(stats.totalDoctors * 0.1), isPositive: true }}
              />
              <StatsCard 
                title="Appointments" 
                value={stats.totalAppointments} 
                icon={<Calendar className="h-4 w-4" />}
                trend={{ value: Math.round(stats.totalAppointments * 0.03), isPositive: true }}
              />
              <StatsCard 
                title="Active Waitlists" 
                value={stats.activeWaitlists} 
                icon={<Clock className="h-4 w-4" />}
                trend={{ value: stats.activeWaitlists > 0 ? Math.round(stats.activeWaitlists * 0.15) : 0, isPositive: false }}
              />
            </>
          )}
        </div>

        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>System Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingActivities ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-health-primary mr-2" />
                  <span>Loading activities...</span>
                </div>
              ) : recentActivities.length > 0 ? (
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                      <div className="rounded-full p-2 bg-health-light text-health-primary">
                        {(activity.type === "new_doctor") && <User className="h-4 w-4" />}
                        {(activity.type === "emergency_approved") && <Clock className="h-4 w-4" />}
                        {(activity.type === "waitlist_update") && <Users className="h-4 w-4" />}
                        {(activity.type === "new_patient") && <User className="h-4 w-4" />}
                        {(activity.type === "appointment_completed") && <Calendar className="h-4 w-4" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {activity.type === "new_doctor" && `New doctor joined: ${activity.doctorName}${activity.specialty ? ` (${activity.specialty})` : ''}`}
                          {activity.type === "emergency_approved" && `Emergency appointment approved for ${activity.patientName} by ${activity.doctorName}`}
                          {activity.type === "waitlist_update" && `${activity.count} new patients added to ${activity.specialty} waitlist`}
                          {activity.type === "new_patient" && `New patient registered: ${activity.patientName}`}
                          {activity.type === "appointment_completed" && `Appointment completed: ${activity.patientName} with ${activity.doctorName}`}
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No recent activity found
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="link" className="text-health-primary" onClick={() => navigate('/admin/analytics')}>
                View All Activity
              </Button>
            </CardFooter>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start gap-2" onClick={() => navigate('/admin/doctors')}>
                <User className="h-4 w-4" />
                Manage Doctors
              </Button>
              <Button className="w-full justify-start gap-2" onClick={() => navigate('/admin/users')}>
                <Users className="h-4 w-4" />
                Manage Users
              </Button>
              <Button className="w-full justify-start gap-2" onClick={() => navigate('/admin/analytics')}>
                <PlusCircle className="h-4 w-4" />
                View Analytics
              </Button>
              <Button className="w-full justify-start gap-2" onClick={() => navigate('/admin/settings')}>
                <Clock className="h-4 w-4" />
                System Settings
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Add User Dialog */}
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account in the system
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="example@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="patient">Patient</SelectItem>
                          <SelectItem value="doctor">Doctor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    type="button" 
                    onClick={() => setIsAddUserDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-health-primary hover:bg-health-secondary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
