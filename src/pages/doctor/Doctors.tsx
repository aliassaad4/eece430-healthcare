import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { 
  Search, 
  Filter, 
  Stethoscope, 
  Building, 
  Phone,
  Mail,
  Calendar,
  Star,
  Loader2
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

interface Doctor {
  id: string;
  fullName?: string;
  displayName?: string;
  name?: string;
  email: string;
  specialty?: string;
  phoneNumber?: string;
  phone?: string;
  hospital?: string;
  clinic?: string;
  availability?: string;
  rating?: number;
  yearsOfExperience?: number;
  bio?: string;
  status?: string;
  joinDate?: string;
  imageUrl?: string;
  patientCount?: number;
}

interface ScheduleSlot {
  id: string;
  doctorId: string;
  day: string;
  time: string;
  isBlocked: boolean;
  isAvailable: boolean;
}

// Available specialties for filtering
const specialties = [
  "All Specialties",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "General Practice",
  "Neurology",
  "Obstetrics & Gynecology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Radiology",
  "Urology"
];

const Doctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All Specialties");
  const [sortBy, setSortBy] = useState("rating");
  const [viewMode, setViewMode] = useState("cards");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const loggedInDoctorId = auth.currentUser?.uid;

  // Fetch doctors from Firebase
  useEffect(() => {
    const fetchDoctors = async () => {
      setIsLoading(true);
      try {
        console.log("Starting doctor data fetch...");
        
        // Collection of doctors from different sources
        let doctorsData: Doctor[] = [];

        // 1. First check users collection with doctor role
        try {
          console.log("Fetching doctors from users collection...");
          const usersRef = collection(db, "users");
          const usersQuery = query(usersRef, where("role", "==", "doctor"));
          const usersSnapshot = await getDocs(usersQuery);
          
          if (!usersSnapshot.empty) {
            console.log(`Found ${usersSnapshot.size} doctors in users collection`);
            usersSnapshot.forEach(doc => {
              const userData = doc.data();
              doctorsData.push({
                id: doc.id,
                fullName: userData.fullName || userData.name || "Unknown Doctor",
                email: userData.email || "",
                specialty: userData.specialty || "General Practice",
                phoneNumber: userData.phoneNumber || userData.phone || "",
                clinic: userData.clinicName || userData.clinic || "Not specified",
                availability: userData.availability || "Not specified",
                rating: userData.rating || (3 + Math.random() * 2), // Default random rating between 3-5
                yearsOfExperience: userData.yearsOfExperience || Math.floor(Math.random() * 15) + 1, // Random 1-15 years
                status: userData.status || "active",
                imageUrl: userData.imageUrl || undefined
              });
            });
          } else {
            console.log("No doctors found in users collection");
          }
        } catch (error) {
          console.error("Error fetching doctors from users collection:", error);
        }

        // 2. Then check doctors collection
        try {
          console.log("Fetching doctors from doctors collection...");
          // Use regular collection query since we need all doctors regardless
          const doctorsCollectionRef = collection(db, "doctors");
          const doctorsSnapshot = await getDocs(doctorsCollectionRef);
          
          if (!doctorsSnapshot.empty) {
            console.log(`Found ${doctorsSnapshot.size} doctors in doctors collection`);
            
            // Filter out any duplicates from what we already found in users
            const existingIds = new Set(doctorsData.map(d => d.id));
            
            doctorsSnapshot.forEach(doc => {
              if (!existingIds.has(doc.id)) {
                const docData = doc.data();
                doctorsData.push({
                  id: doc.id,
                  name: docData.name || "Unknown Doctor",
                  email: docData.email || "",
                  specialty: docData.specialty || "General Practice",
                  phone: docData.phone || "",
                  hospital: docData.hospital || "",
                  clinic: docData.clinic || "Not specified",
                  availability: docData.availability || "Not specified",
                  rating: docData.rating || (3 + Math.random() * 2),
                  yearsOfExperience: docData.yearsOfExperience || Math.floor(Math.random() * 15) + 1,
                  status: docData.status || "active"
                });
              }
            });
          } else {
            console.log("No doctors found in doctors collection");
          }
        } catch (error) {
          console.error("Error fetching doctors from doctors collection:", error);
        }

        // If we still don't have doctors, add some mock data for testing
        if (doctorsData.length === 0) {
          console.log("No doctors found in either collection, adding mock doctors");
          doctorsData = generateMockDoctors();
        }

        // 3. Fetch patient counts for each doctor
        try {
          console.log("Fetching patient counts for doctors...");
          for (const doctor of doctorsData) {
            try {
              // Use standard query to find appointments by doctorId
              const appointmentsRef = collection(db, "appointments");
              const apptQuery = query(appointmentsRef, where("doctorId", "==", doctor.id));
              const appointmentsSnapshot = await getDocs(apptQuery);
              
              // If no appointments found in main collection, try nested collection
              if (appointmentsSnapshot.empty) {
                const nestedApptsRef = collection(db, "appointments", doctor.id, "appointments");
                const nestedSnapshot = await getDocs(nestedApptsRef);
                
                // Get unique patient IDs from these appointments
                const uniquePatientIds = new Set<string>();
                nestedSnapshot.forEach(doc => {
                  const apptData = doc.data();
                  if (apptData.patientId) uniquePatientIds.add(apptData.patientId);
                });
                doctor.patientCount = uniquePatientIds.size;
              } else {
                // Get unique patient IDs from these appointments
                const uniquePatientIds = new Set<string>();
                appointmentsSnapshot.forEach(doc => {
                  const apptData = doc.data();
                  if (apptData.patientId) uniquePatientIds.add(apptData.patientId);
                });
                doctor.patientCount = uniquePatientIds.size;
              }
            } catch (err) {
              console.log(`Error fetching patients for doctor ${doctor.id}:`, err);
              doctor.patientCount = 0; // Default to 0 if there's an error
            }
          }
        } catch (error) {
          console.error("Error counting patients for doctors:", error);
        }

        console.log(`Setting ${doctorsData.length} doctors to state`);
        setDoctors(doctorsData);
        setFilteredDoctors(doctorsData);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching doctors:", error);
        toast({
          title: "Error",
          description: "Failed to load doctors. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        
        // Set mock data if fetching fails
        const mockData = generateMockDoctors();
        setDoctors(mockData);
        setFilteredDoctors(mockData);
      }
    };

    fetchDoctors();
  }, [toast]);
  
  // Generate mock doctors for testing or if no real doctors are found
  const generateMockDoctors = (): Doctor[] => {
    console.log("Generating mock doctors");
    return [
      {
        id: "mock1",
        fullName: "Dr. Sarah Wilson",
        email: "sarah.wilson@example.com",
        specialty: "Cardiology",
        phone: "(555) 123-4567",
        clinic: "Central Medical Center",
        availability: "Mon, Wed, Fri",
        rating: 4.8,
        yearsOfExperience: 12,
        patientCount: 45,
        status: "active",
      },
      {
        id: "mock2",
        fullName: "Dr. Michael Chen",
        email: "michael.chen@example.com",
        specialty: "Pediatrics",
        phone: "(555) 987-6543",
        clinic: "Children's Wellness Center",
        availability: "Mon-Fri",
        rating: 4.6,
        yearsOfExperience: 8,
        patientCount: 78,
        status: "active",
      },
      {
        id: "mock3",
        fullName: "Dr. James Patel",
        email: "james.patel@example.com",
        specialty: "Dermatology",
        phone: "(555) 333-9999",
        clinic: "Skin Health Clinic",
        availability: "Tue, Thu, Sat",
        rating: 4.3,
        yearsOfExperience: 5,
        patientCount: 53,
        status: "active",
      },
    ];
  };

  // Apply search and filters
  useEffect(() => {
    if (!doctors.length) return;
    
    let filtered = [...doctors];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(doctor => {
        const doctorName = doctor.fullName || doctor.name || "";
        return (
          doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (doctor.email && doctor.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (doctor.specialty && doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (doctor.clinic && doctor.clinic.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      });
    }
    
    // Apply specialty filter
    if (specialtyFilter !== "All Specialties") {
      filtered = filtered.filter(doctor => 
        doctor.specialty && doctor.specialty === specialtyFilter
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "experience":
          return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
        case "name":
          return (a.fullName || a.name || "").localeCompare(b.fullName || b.name || "");
        default:
          return 0;
      }
    });
    
    setFilteredDoctors(filtered);
  }, [doctors, searchQuery, specialtyFilter, sortBy]);

  const handleViewProfile = (doctorId: string) => {
    navigate(`/doctor/profile/${doctorId}`);
  };

  const handleReferPatient = (doctorId: string) => {
    navigate(`/doctor/refer-patient/${doctorId}`);
  };

  const handleSendMessage = (doctorId: string) => {
    navigate(`/doctor/messages?recipientId=${doctorId}`);
  };

  const getDoctorName = (doctor: Doctor) => {
    return doctor.fullName || doctor.displayName || doctor.name || "Dr. Unknown";
  };

  return (
    <Layout userRole="doctor">
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">Colleague Directory</h1>
          <p className="text-muted-foreground">
            Browse and connect with other doctors in the network
          </p>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cards">Card View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, specialty..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="min-w-[150px]">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="min-w-[120px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="experience">Most Experienced</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap mt-2">
          {specialties.slice(0, 6).map((specialty) => (
            <Badge 
              key={specialty}
              className={specialtyFilter === specialty ? "bg-health-primary hover:bg-health-secondary cursor-pointer" : "bg-secondary cursor-pointer"} 
              onClick={() => setSpecialtyFilter(specialty)}
            >
              {specialty}
            </Badge>
          ))}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
            <span className="ml-3 text-lg">Loading doctors...</span>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="flex w-full items-center justify-center rounded-md border border-dashed p-8">
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm text-muted-foreground">No doctors found</p>
            </div>
          </div>
        ) : (
          <>
            <TabsContent value="cards" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDoctors.map((doctor) => (
                  <Card key={doctor.id} className={doctor.id === loggedInDoctorId ? "border-health-primary" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-health-light">
                            {doctor.imageUrl ? (
                              <img src={doctor.imageUrl} alt={getDoctorName(doctor)} className="object-cover" />
                            ) : (
                              <AvatarFallback className="bg-health-light text-health-primary">
                                {getDoctorName(doctor).charAt(0)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <CardTitle className="flex items-center">
                              {getDoctorName(doctor)}
                              {doctor.id === loggedInDoctorId && <Badge className="ml-2 bg-health-light text-health-primary text-xs">You</Badge>}
                            </CardTitle>
                            <CardDescription>{doctor.specialty || "General Practice"}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-health-light">
                            <Star className="h-3 w-3 mr-1 fill-yellow-400 stroke-yellow-400" />
                            {doctor.rating ? doctor.rating.toFixed(1) : "4.0"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2 space-y-2">
                      <div className="flex items-center text-sm">
                        <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{doctor.clinic || doctor.hospital || "Not specified"}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{doctor.email}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{doctor.phoneNumber || doctor.phone || "Not available"}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Stethoscope className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{doctor.yearsOfExperience || "5"} years experience</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Available: {doctor.availability || "Weekdays"}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 pt-2">
                      {doctor.id !== loggedInDoctorId && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReferPatient(doctor.id)}
                            className="flex-1"
                          >
                            Refer Patient
                          </Button>
                          <Button
                            className="bg-health-primary hover:bg-health-secondary flex-1"
                            size="sm"
                            onClick={() => handleSendMessage(doctor.id)}
                          >
                            Message
                          </Button>
                        </>
                      )}
                      {doctor.id === loggedInDoctorId && (
                        <Button
                          className="bg-health-primary hover:bg-health-secondary w-full"
                          size="sm"
                          onClick={() => handleViewProfile(doctor.id)}
                        >
                          View Profile
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="list" className="mt-0">
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-10 px-4 text-left align-middle font-medium">Name</th>
                      <th className="h-10 px-4 text-left align-middle font-medium hidden md:table-cell">Specialty</th>
                      <th className="h-10 px-4 text-left align-middle font-medium hidden lg:table-cell">Clinic/Hospital</th>
                      <th className="h-10 px-4 text-left align-middle font-medium hidden md:table-cell">Experience</th>
                      <th className="h-10 px-4 text-right align-middle font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((doctor) => (
                      <tr key={doctor.id} className="border-b">
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-health-light text-health-primary">
                                {getDoctorName(doctor).charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{getDoctorName(doctor)}</div>
                              <div className="text-sm text-muted-foreground md:hidden">{doctor.specialty}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-middle hidden md:table-cell">{doctor.specialty || "General Practice"}</td>
                        <td className="p-4 align-middle hidden lg:table-cell">{doctor.clinic || doctor.hospital || "Not specified"}</td>
                        <td className="p-4 align-middle hidden md:table-cell">{doctor.yearsOfExperience || "5"} years</td>
                        <td className="p-4 align-middle text-right">
                          <div className="flex justify-end gap-2">
                            {doctor.id !== loggedInDoctorId && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="hidden sm:inline-flex"
                                  onClick={() => handleReferPatient(doctor.id)}
                                >
                                  Refer Patient
                                </Button>
                                <Button
                                  className="bg-health-primary hover:bg-health-secondary"
                                  size="sm"
                                  onClick={() => handleSendMessage(doctor.id)}
                                >
                                  Message
                                </Button>
                              </>
                            )}
                            {doctor.id === loggedInDoctorId && (
                              <Button
                                className="bg-health-primary hover:bg-health-secondary"
                                size="sm"
                                onClick={() => handleViewProfile(doctor.id)}
                              >
                                View Profile
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Doctors;