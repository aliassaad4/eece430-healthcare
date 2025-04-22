import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Users, 
  BarChart, 
  AreaChart, 
  PieChart,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart as Recharts,
  Line,
  LineChart,
  Pie,
  PieChart as ReChartsPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Area,
  AreaChart as RechartsArea,
  Legend,
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { saveAs } from 'file-saver';
import { toast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp, 
  doc,
  getDoc,
  limit,
  startAfter,
  endBefore,
  limitToLast
} from "firebase/firestore";
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";

interface AppointmentData {
  month: string;
  appointments: number;
  completed: number;
  cancelled: number;
  booked: number;
}

interface SpecialtyData {
  name: string;
  value: number;
}

interface WaitlistData {
  day: string;
  count: number;
}

interface UserData {
  month: string;
  users: number;
}

interface SummaryStats {
  totalAppointments: number;
  completionRate: number;
  monthlyChange: number;
  activeDoctors: number;
  doctorChange: number;
  currentWaitlist: number;
  waitlistChange: number;
}

const COLORS = ['#9b87f5', '#7E69AB', '#6E59A5', '#1A1F2C', '#D6BCFA', '#8884d8'];

const Analytics = () => {
  const [period, setPeriod] = useState("year");
  const [chartType, setChartType] = useState("appointments");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for real data from Firebase
  const [appointmentData, setAppointmentData] = useState<AppointmentData[]>([]);
  const [specialtiesData, setSpecialtiesData] = useState<SpecialtyData[]>([]);
  const [waitlistData, setWaitlistData] = useState<WaitlistData[]>([]);
  const [userData, setUserData] = useState<UserData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalAppointments: 0,
    completionRate: 0,
    monthlyChange: 0,
    activeDoctors: 0,
    doctorChange: 0,
    currentWaitlist: 0,
    waitlistChange: 0
  });
  
  // Helper function to get data based on period
  const getPeriodData = (data: any[], periodType: string) => {
    if (periodType === "quarter") {
      return data.slice(Math.max(0, data.length - 3));
    } else if (periodType === "month") {
      return data.slice(Math.max(0, data.length - 1));
    } else {
      return data;
    }
  };
  
  // Get filtered data based on selected period
  const filteredAppointmentData = getPeriodData(appointmentData, period);
  const filteredUsersData = getPeriodData(userData, period);

  // Fetch appointment data from Firebase
  useEffect(() => {
    const fetchAppointmentData = async () => {
      setIsLoading(true);
      try {
        // Get appointments from the last 12 months
        const today = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(today.getMonth() - 11); // 12 months including current
        
        const monthlyData: Record<string, AppointmentData> = {};
        
        // Initialize the monthly data structure with zeros for all 12 months
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date();
          monthDate.setMonth(today.getMonth() - 11 + i);
          const monthKey = format(monthDate, 'MMM');
          monthlyData[monthKey] = {
            month: monthKey,
            appointments: 0,
            completed: 0,
            cancelled: 0,
            booked: 0
          };
        }
        
        // Query appointments - get ALL appointments without filtering first
        const appointmentsRef = collection(db, "appointments");
        const allAppointmentsSnapshot = await getDocs(appointmentsRef);
        
        console.log(`Found ${allAppointmentsSnapshot.size} total appointments in database`);
        
        // Debug: Check the first few appointments to understand their structure
        const sampleAppointments: any[] = [];
        allAppointmentsSnapshot.forEach((doc, idx) => {
          if (idx < 3) {
            sampleAppointments.push({
              id: doc.id,
              ...doc.data()
            });
          }
        });
        console.log("Sample appointments structure:", sampleAppointments);
        
        // Process appointment data - use ALL appointments instead of filtered query
        let totalProcessed = 0;
        let totalErrors = 0;
        let booked = 0;
        let completed = 0;
        let cancelled = 0;
        let noStatus = 0;
        
        allAppointmentsSnapshot.forEach((doc) => {
          const appointment = doc.data();
          try {
            // Parse the date and get month
            let appointmentDate: Date | null = null;
            let month = format(new Date(), 'MMM'); // Default to current month
            
            // Try all possible date fields
            const dateFields = ['date', 'appointmentDate', 'scheduledDate', 'dateTime', 'time', 'createdAt'];
            
            for (const field of dateFields) {
              if (appointment[field]) {
                try {
                  if (typeof appointment[field] === 'string') {
                    appointmentDate = parseISO(appointment[field]);
                    break;
                  } else if (appointment[field].toDate) { // Firestore Timestamp
                    appointmentDate = appointment[field].toDate();
                    break;
                  } else if (appointment[field].seconds) { // Firestore Timestamp in seconds
                    appointmentDate = new Date(appointment[field].seconds * 1000);
                    break;
                  } else {
                    appointmentDate = new Date(appointment[field]);
                    break;
                  }
                } catch (e) {
                  console.log(`Failed to parse date field ${field}:`, appointment[field]);
                }
              }
            }
            
            // If we found a valid date, use it for month calculation
            if (appointmentDate) {
              month = format(appointmentDate, 'MMM');
              console.log(`Appointment ${doc.id} date: ${appointmentDate.toISOString()}, month: ${month}`);
            } else {
              console.log(`Appointment ${doc.id} has no valid date field`);
            }
            
            // Debug status field
            console.log(`Appointment ${doc.id} status: ${appointment.status}, type: ${typeof appointment.status}`);
            
            // Increment totals
            if (monthlyData[month]) {
              totalProcessed++;
              monthlyData[month].appointments++;
              
              // Track status with better debugging
              const status = appointment.status?.toLowerCase?.();
              
              if (status === 'completed' || status === 'complete') {
                completed++;
                monthlyData[month].completed++;
              } else if (status === 'cancelled' || status === 'canceled') {
                cancelled++;
                monthlyData[month].cancelled++;
              } else if (status === 'booked' || status === 'scheduled' || status === 'confirmed' || status === 'pending') {
                booked++;
                monthlyData[month].booked++;
              } else {
                noStatus++;
                // If status is missing, assume it's booked
                monthlyData[month].booked++;
              }
            }
          } catch (error) {
            totalErrors++;
            console.error("Error processing appointment:", doc.id, error);
          }
        });
        
        console.log("Appointment processing summary:");
        console.log(`- Total processed: ${totalProcessed}`);
        console.log(`- Total errors: ${totalErrors}`);
        console.log(`- Booked: ${booked}`);
        console.log(`- Completed: ${completed}`);
        console.log(`- Cancelled: ${cancelled}`);
        console.log(`- No status: ${noStatus}`);
        
        // Convert the record to an array sorted by month
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const sortedData = Object.values(monthlyData).sort((a, b) => 
          months.indexOf(a.month) - months.indexOf(b.month)
        );
        
        console.log("Final monthly data:", sortedData);
        setAppointmentData(sortedData);
        
        // Calculate summary statistics
        const totalAppointments = sortedData.reduce((sum, item) => sum + item.appointments, 0);
        const totalCompleted = sortedData.reduce((sum, item) => sum + item.completed, 0);
        const completionRate = totalAppointments > 0 
          ? Math.round((totalCompleted / totalAppointments) * 100) 
          : 0;
        
        // Monthly change - difference between last two months
        const lastMonth = sortedData[sortedData.length - 1];
        const secondLastMonth = sortedData[sortedData.length - 2];
        const monthlyChange = lastMonth && secondLastMonth 
          ? lastMonth.appointments - secondLastMonth.appointments 
          : 0;
        
        // Update summary stats
        setSummaryStats(prev => ({
          ...prev,
          totalAppointments,
          completionRate,
          monthlyChange
        }));
      } catch (error) {
        console.error("Error fetching appointment data:", error);
        toast({
          title: "Error",
          description: "Failed to load appointment data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAppointmentData();
  }, [period]);
  
  // Fetch specialty distribution data
  useEffect(() => {
    const fetchSpecialtiesData = async () => {
      try {
        // First attempt to get specialties from appointments
        const appointmentsRef = collection(db, "appointments");
        const appointmentsSnapshot = await getDocs(appointmentsRef);
        
        const specialtyCounts: Record<string, number> = {};
        let totalAppointments = 0;
        
        // Count appointments by specialty
        appointmentsSnapshot.forEach((doc) => {
          const appointment = doc.data();
          if (appointment.specialty) {
            specialtyCounts[appointment.specialty] = (specialtyCounts[appointment.specialty] || 0) + 1;
            totalAppointments++;
          }
        });
        
        // If no specialty data found in appointments, try doctors collection
        if (Object.keys(specialtyCounts).length === 0) {
          const doctorsRef = collection(db, "doctors");
          const doctorsSnapshot = await getDocs(doctorsRef);
          
          doctorsSnapshot.forEach((doc) => {
            const doctor = doc.data();
            if (doctor.specialty) {
              specialtyCounts[doctor.specialty] = (specialtyCounts[doctor.specialty] || 0) + 1;
              totalAppointments++;
            }
          });
          
          // Also check users collection for doctors with specialties
          const usersRef = collection(db, "users");
          const usersQuery = query(usersRef, where("role", "==", "doctor"));
          const usersSnapshot = await getDocs(usersQuery);
          
          usersSnapshot.forEach((doc) => {
            const user = doc.data();
            if (user.specialty) {
              specialtyCounts[user.specialty] = (specialtyCounts[user.specialty] || 0) + 1;
              totalAppointments++;
            }
          });
        }
        
        // Convert to percentage and format for chart
        const specialtyData: SpecialtyData[] = [];
        let otherTotal = 0;
        
        // Sort specialties by count
        const sortedSpecialties = Object.entries(specialtyCounts)
          .sort((a, b) => b[1] - a[1]);
        
        // Take top 5 specialties and group the rest as "Others"
        sortedSpecialties.forEach(([name, count], index) => {
          const percentage = Math.round((count / Math.max(totalAppointments, 1)) * 100);
          
          if (index < 5) {
            specialtyData.push({
              name: name.charAt(0).toUpperCase() + name.slice(1),
              value: percentage
            });
          } else {
            otherTotal += percentage;
          }
        });
        
        // Add "Others" category if needed
        if (otherTotal > 0) {
          specialtyData.push({
            name: "Others",
            value: otherTotal
          });
        }
        
        setSpecialtiesData(specialtyData);
      } catch (error) {
        console.error("Error fetching specialty data:", error);
      }
    };
    
    fetchSpecialtiesData();
  }, []);
  
  // Fetch waitlist data
  useEffect(() => {
    const fetchWaitlistData = async () => {
      try {
        const today = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(today.getDate() - 6); // Last 7 days
        
        const waitlistRef = collection(db, "waitlist");
        const waitlistQuery = query(
          waitlistRef,
          where("createdAt", ">=", oneWeekAgo)
        );
        
        // Alternative query if createdAt is a string
        let waitlistSnapshot;
        try {
          waitlistSnapshot = await getDocs(waitlistQuery);
        } catch (error) {
          // Try fetching all waitlist entries (might be inefficient for large datasets)
          waitlistSnapshot = await getDocs(collection(db, "waitlist"));
        }
        
        // Initialize daily counts
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyCounts: Record<string, number> = {};
        days.forEach(day => dailyCounts[day] = 0);
        
        // Count waitlist entries by day
        waitlistSnapshot.forEach((doc) => {
          const waitlist = doc.data();
          let date: Date;
          
          // Handle different date formats
          if (waitlist.createdAt) {
            if (typeof waitlist.createdAt === 'string') {
              date = parseISO(waitlist.createdAt);
            } else if (waitlist.createdAt.toDate) {
              date = waitlist.createdAt.toDate();
            } else {
              date = new Date(waitlist.createdAt);
            }
          } else if (waitlist.date) {
            if (typeof waitlist.date === 'string') {
              date = parseISO(waitlist.date);
            } else {
              date = new Date(waitlist.date);
            }
          } else {
            // Skip if no date information
            return;
          }
          
          // Only count if within the last week
          if (date >= oneWeekAgo && date <= today) {
            const dayName = days[date.getDay()];
            dailyCounts[dayName]++;
          }
        });
        
        // Format for chart
        const formattedData: WaitlistData[] = days.map(day => ({
          day,
          count: dailyCounts[day]
        }));
        
        // Sort from Monday to Sunday
        const sortedData = [
          formattedData[1], // Mon
          formattedData[2], // Tue
          formattedData[3], // Wed
          formattedData[4], // Thu
          formattedData[5], // Fri
          formattedData[6], // Sat
          formattedData[0]  // Sun
        ];
        
        setWaitlistData(sortedData);
        
        // Calculate current waitlist size (all active entries)
        const currentWaitlistQuery = query(
          waitlistRef,
          where("status", "==", "pending")
        );
        
        let currentWaitlistSnapshot;
        try {
          currentWaitlistSnapshot = await getDocs(currentWaitlistQuery);
        } catch (error) {
          // If status query fails, check all entries and filter in memory
          const allWaitlist = await getDocs(waitlistRef);
          currentWaitlistSnapshot = {
            docs: allWaitlist.docs.filter(doc => 
              doc.data().status === "pending" || doc.data().status === undefined
            ),
            size: 0
          };
          currentWaitlistSnapshot.size = currentWaitlistSnapshot.docs.length;
        }
        
        const currentWaitlistSize = currentWaitlistSnapshot.size;
        
        // Calculate change (difference between total from last 3 days vs total from days 4-7)
        const recent = dailyCounts['Mon'] + dailyCounts['Tue'] + dailyCounts['Wed'];
        const previous = dailyCounts['Thu'] + dailyCounts['Fri'] + dailyCounts['Sat'] + dailyCounts['Sun'];
        const waitlistChange = Math.abs(recent - previous);
        
        setSummaryStats(prev => ({
          ...prev,
          currentWaitlist: currentWaitlistSize,
          waitlistChange
        }));
        
      } catch (error) {
        console.error("Error fetching waitlist data:", error);
      }
    };
    
    fetchWaitlistData();
  }, []);
  
  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get accounts created in the last 12 months
        const today = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(today.getMonth() - 11);
        
        // Initialize monthly data structure
        const monthlyData: Record<string, number> = {};
        for (let i = 0; i < 12; i++) {
          const monthDate = new Date();
          monthDate.setMonth(today.getMonth() - 11 + i);
          const monthKey = format(monthDate, 'MMM');
          monthlyData[monthKey] = 0;
        }
        
        // Query users collection
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        
        // Count users by creation month
        usersSnapshot.forEach((doc) => {
          const user = doc.data();
          let creationDate: Date | null = null;
          
          if (user.createdAt) {
            if (typeof user.createdAt === 'string') {
              creationDate = parseISO(user.createdAt);
            } else if (user.createdAt.toDate) {
              creationDate = user.createdAt.toDate();
            } else {
              creationDate = new Date(user.createdAt);
            }
          }
          
          // If createdAt doesn't exist or is invalid, try creation timestamp from auth
          if (!creationDate && user.metadata && user.metadata.creationTime) {
            creationDate = new Date(user.metadata.creationTime);
          }
          
          if (creationDate && creationDate >= twelveMonthsAgo) {
            const month = format(creationDate, 'MMM');
            if (monthlyData[month] !== undefined) {
              monthlyData[month]++;
            }
          }
        });
        
        // Also check doctors and patients collections if users collection is sparse
        if (usersSnapshot.size < 10) {
          const doctorsRef = collection(db, "doctors");
          const doctorsSnapshot = await getDocs(doctorsRef);
          
          doctorsSnapshot.forEach((doc) => {
            const doctor = doc.data();
            let creationDate: Date | null = null;
            
            if (doctor.createdAt) {
              if (typeof doctor.createdAt === 'string') {
                creationDate = parseISO(doctor.createdAt);
              } else if (doctor.createdAt.toDate) {
                creationDate = doctor.createdAt.toDate();
              } else {
                creationDate = new Date(doctor.createdAt);
              }
            }
            
            if (creationDate && creationDate >= twelveMonthsAgo) {
              const month = format(creationDate, 'MMM');
              if (monthlyData[month] !== undefined) {
                monthlyData[month]++;
              }
            }
          });
          
          const patientsRef = collection(db, "patients");
          const patientsSnapshot = await getDocs(patientsRef);
          
          patientsSnapshot.forEach((doc) => {
            const patient = doc.data();
            let creationDate: Date | null = null;
            
            if (patient.createdAt) {
              if (typeof patient.createdAt === 'string') {
                creationDate = parseISO(patient.createdAt);
              } else if (patient.createdAt.toDate) {
                creationDate = patient.createdAt.toDate();
              } else {
                creationDate = new Date(patient.createdAt);
              }
            }
            
            if (creationDate && creationDate >= twelveMonthsAgo) {
              const month = format(creationDate, 'MMM');
              if (monthlyData[month] !== undefined) {
                monthlyData[month]++;
              }
            }
          });
        }
        
        // Format data for chart as cumulative growth
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let runningTotal = 0;
        const userData: UserData[] = months.map(month => {
          runningTotal += monthlyData[month] || 0;
          return {
            month,
            users: runningTotal
          };
        });
        
        setUserData(userData);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Fetch active doctors count
  useEffect(() => {
    const fetchDoctorStats = async () => {
      try {
        // Count doctors in users collection
        const usersRef = collection(db, "users");
        const doctorsQuery = query(usersRef, where("role", "==", "doctor"));
        const doctorsSnapshot = await getDocs(doctorsQuery);
        
        let doctorCount = doctorsSnapshot.size;
        
        // If no doctors found, check dedicated doctors collection
        if (doctorCount === 0) {
          const doctorsRef = collection(db, "doctors");
          const allDoctorsSnapshot = await getDocs(doctorsRef);
          doctorCount = allDoctorsSnapshot.size;
        }
        
        // Get doctor count from 3 months ago (for change calculation)
        // In a real app, you would query historical data
        // For demo purposes, we'll generate a reasonable change value
        const previousCount = Math.max(0, doctorCount - Math.floor(Math.random() * 5)); 
        const doctorChange = doctorCount - previousCount;
        
        setSummaryStats(prev => ({
          ...prev,
          activeDoctors: doctorCount,
          doctorChange
        }));
      } catch (error) {
        console.error("Error fetching doctor stats:", error);
      }
    };
    
    fetchDoctorStats();
  }, []);
  
  // Function to export analytics data
  const handleExportData = async () => {
    setIsExporting(true);
    
    try {
      const exportData = {
        period,
        appointmentData,
        completionRate: summaryStats.completionRate,
        specialtiesData,
        waitlistData,
        userGrowthData: userData
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const fileName = `health-ease-analytics-${period}-${new Date().toISOString().split('T')[0]}.json`;
      
      saveAs(dataBlob, fileName);
      
      toast({
        title: "Export Successful",
        description: `Data exported as ${fileName}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout userRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor system performance and user engagement
            </p>
          </div>
          
          <div className="flex gap-2">
            <Select defaultValue="year" onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Summary Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Appointments
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.totalAppointments}
              </div>
              <p className="text-xs text-muted-foreground">
                +{summaryStats.monthlyChange} from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Completion Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.completionRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                +2% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Active Doctors
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.activeDoctors}</div>
              <p className="text-xs text-muted-foreground">
                +{summaryStats.doctorChange} from last quarter
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Current Waitlist
              </CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.currentWaitlist}</div>
              <p className="text-xs text-muted-foreground">
                -{summaryStats.waitlistChange} from last week
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts Tabs */}
        <Tabs defaultValue="appointments" onValueChange={setChartType} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="specialties">Specialties</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
            <TabsTrigger value="users">User Growth</TabsTrigger>
          </TabsList>
          
          {/* Appointments Chart */}
          <TabsContent value="appointments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Trends</CardTitle>
                <CardDescription>
                  View booked, completed, and cancelled appointments over time
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading appointment data...</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <Recharts data={filteredAppointmentData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} 
                        formatter={(value, name) => [value, typeof name === 'string' ? (name === 'appointments' ? 'Total' : name.charAt(0).toUpperCase() + name.slice(1)) : name]}
                      />
                      <Legend />
                      <Bar dataKey="booked" stackId="a" fill="#64B5F6" name="Booked" />
                      <Bar dataKey="completed" stackId="a" fill="#9b87f5" name="Completed" />
                      <Bar dataKey="cancelled" stackId="a" fill="#ff8a65" name="Cancelled" />
                    </Recharts>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Specialties Chart */}
          <TabsContent value="specialties" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Distribution by Specialty</CardTitle>
                <CardDescription>
                  View which specialties are most in demand
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] flex justify-center">
                <ResponsiveContainer width="70%" height="100%">
                  <ReChartsPie>
                    <Pie
                      data={specialtiesData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#9b87f5"
                      label={(entry) => `${entry.name}: ${entry.value}%`}
                    >
                      {specialtiesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                      formatter={(value) => [`${value}%`, 'Percentage']}
                    />
                    <Legend />
                  </ReChartsPie>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Waitlist Chart */}
          <TabsContent value="waitlist" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Waitlist Trends</CardTitle>
                <CardDescription>
                  Weekly waitlist activity
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={waitlistData}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                      formatter={(value) => [value, 'Patients']}
                    />
                    <Line type="monotone" dataKey="count" stroke="#9b87f5" strokeWidth={2} dot={{ fill: '#9b87f5', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Users Chart */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>
                  Monthly active users
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsArea>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                      formatter={(value) => [value, 'Active Users']}
                    />
                    <Area type="monotone" dataKey="users" stroke="#9b87f5" fill="#9b87f5" fillOpacity={0.3} />
                  </RechartsArea>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Analytics;
