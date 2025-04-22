import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { 
  MoreHorizontal, 
  Search, 
  UserPlus, 
  Mail, 
  Phone, 
  Calendar, 
  Briefcase,
  Building,
  Clock,
  Loader2
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  TabsTrigger,
} from "@/components/ui/tabs";
import { auth, db } from "@/config/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  Timestamp,
  addDoc
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  clinic: string;
  availability: string;
  patients: number;
  status: "active" | "inactive";
  joinDate: string;
  yearsOfExperience?: number;
  imageUrl?: string;
  fullName?: string;
  uid?: string;
}

// Available specialties for filtering
const specialties = [
  "All Specialties",
  "Cardiology",
  "Pediatrics",
  "Dermatology",
  "Neurology",
  "Orthopedics",
  "Internal Medicine",
  "Gastroenterology",
  "Ophthalmology",
  "Oncology",
  "Radiology",
];

const Doctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState("table");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDoctorDialogOpen, setIsAddDoctorDialogOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    name: "",
    email: "",
    phone: "",
    specialty: "General Practice",
    clinic: "",
    availability: "Mon-Fri",
    status: "active",
    patients: 0
  });
  const { toast } = useToast();
  
  // Fetch doctors from Firebase when component mounts
  useEffect(() => {
    async function fetchDoctors() {
      setIsLoading(true);
      try {
        console.log("Fetching doctors from Firebase...");
        const doctorsData: Doctor[] = [];
        
        // Fetch from users collection with role=doctor
        try {
          const usersRef = collection(db, "users");
          const usersQuery = query(usersRef, where("role", "==", "doctor"));
          const usersSnapshot = await getDocs(usersQuery);
          
          if (!usersSnapshot.empty) {
            console.log(`Found ${usersSnapshot.size} doctors in users collection`);
            
            usersSnapshot.forEach((docSnapshot) => {
              const data = docSnapshot.data();
              doctorsData.push({
                id: docSnapshot.id,
                uid: docSnapshot.id,
                name: data.fullName || data.name || "Unknown Doctor",
                fullName: data.fullName,
                email: data.email || "",
                phone: data.phoneNumber || data.phone || "",
                specialty: data.specialty || "General Practice",
                clinic: data.clinicName || data.clinic || "Not specified",
                availability: data.availability || "Mon-Fri",
                patients: data.patientCount || 0,
                status: data.status || "active",
                joinDate: data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                imageUrl: data.imageUrl,
                yearsOfExperience: data.yearsOfExperience || 0
              });
            });
          } else {
            console.log("No doctors found in users collection");
          }
        } catch (error) {
          console.error("Error fetching from users collection:", error);
        }
        
        // Also fetch from doctors collection (if exists)
        try {
          const doctorsRef = collection(db, "doctors");
          const doctorsSnapshot = await getDocs(doctorsRef);
          
          if (!doctorsSnapshot.empty) {
            console.log(`Found ${doctorsSnapshot.size} doctors in doctors collection`);
            
            // Create a set of existing doctor IDs to avoid duplicates
            const existingIds = new Set(doctorsData.map(doctor => doctor.id));
            
            doctorsSnapshot.forEach((docSnapshot) => {
              const data = docSnapshot.data();
              
              // Only add if not already in the array (avoid duplicates)
              if (!existingIds.has(docSnapshot.id)) {
                doctorsData.push({
                  id: docSnapshot.id,
                  name: data.name || "Unknown Doctor",
                  email: data.email || "",
                  phone: data.phone || "",
                  specialty: data.specialty || "General Practice",
                  clinic: data.clinic || "Not specified",
                  availability: data.availability || "Mon-Fri",
                  patients: data.patients || 0,
                  status: data.status || "active",
                  joinDate: data.joinDate || new Date().toISOString().split('T')[0]
                });
              }
            });
          } else {
            console.log("No doctors found in doctors collection");
          }
        } catch (error) {
          console.error("Error fetching from doctors collection:", error);
        }
        
        // Count patients for each doctor
        for (const doctor of doctorsData) {
          try {
            const appointmentsRef = collection(db, "appointments");
            const appointmentsQuery = query(appointmentsRef, where("doctorId", "==", doctor.id));
            const appointmentsSnapshot = await getDocs(appointmentsQuery);
            
            if (!appointmentsSnapshot.empty) {
              // Create a Set to count unique patients
              const uniquePatientIds = new Set<string>();
              
              appointmentsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.patientId) {
                  uniquePatientIds.add(data.patientId);
                }
              });
              
              doctor.patients = uniquePatientIds.size;
            }
          } catch (error) {
            console.error(`Error counting patients for doctor ${doctor.id}:`, error);
          }
        }
        
        console.log(`Total doctors fetched: ${doctorsData.length}`);
        setDoctors(doctorsData);
      } catch (error) {
        console.error("Error fetching doctors:", error);
        toast({
          title: "Error",
          description: "Failed to fetch doctors data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDoctors();
  }, [toast]);
  
  // Filter doctors based on search query and specialty filter
  const filteredDoctors = doctors.filter(doctor => {
    // Search filter
    const matchesSearch = 
      doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.clinic.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Specialty filter
    if (specialtyFilter === "all") return matchesSearch;
    return matchesSearch && doctor.specialty === specialtyFilter;
  });
  
  const handleEditDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsEditDialogOpen(true);
  };
  
  const handleSaveDoctor = async () => {
    if (!selectedDoctor) return;
    
    setIsLoading(true);
    try {
      // Determine if we are updating a user or a "doctors" collection document
      if (selectedDoctor.uid) {
        // Update in users collection
        const userDocRef = doc(db, "users", selectedDoctor.id);
        await updateDoc(userDocRef, {
          fullName: selectedDoctor.name,
          name: selectedDoctor.name,
          email: selectedDoctor.email,
          phoneNumber: selectedDoctor.phone,
          specialty: selectedDoctor.specialty,
          clinicName: selectedDoctor.clinic,
          clinic: selectedDoctor.clinic,
          availability: selectedDoctor.availability,
          status: selectedDoctor.status,
          updatedAt: new Date()
        });
      } else {
        // Update in doctors collection
        const doctorDocRef = doc(db, "doctors", selectedDoctor.id);
        await updateDoc(doctorDocRef, {
          name: selectedDoctor.name,
          email: selectedDoctor.email,
          phone: selectedDoctor.phone,
          specialty: selectedDoctor.specialty,
          clinic: selectedDoctor.clinic,
          availability: selectedDoctor.availability,
          status: selectedDoctor.status,
          updatedAt: new Date()
        });
      }
      
      // Update local state
      setDoctors(prevDoctors => 
        prevDoctors.map(doctor => 
          doctor.id === selectedDoctor.id ? selectedDoctor : doctor
        )
      );
      
      toast({
        title: "Doctor Updated",
        description: "Doctor information has been updated successfully.",
      });
      
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating doctor:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update doctor information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChangeStatus = async (doctorId: string, newStatus: string) => {
    try {
      // Find the doctor in our local state
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return;
      
      // Determine if we are updating a user or a "doctors" collection document
      if (doctor.uid) {
        // Update in users collection
        const userDocRef = doc(db, "users", doctorId);
        await updateDoc(userDocRef, {
          status: newStatus,
          updatedAt: new Date()
        });
      } else {
        // Update in doctors collection
        const doctorDocRef = doc(db, "doctors", doctorId);
        await updateDoc(doctorDocRef, {
          status: newStatus,
          updatedAt: new Date()
        });
      }
      
      // Update local state
      setDoctors(prevDoctors => 
        prevDoctors.map(d => 
          d.id === doctorId ? {...d, status: newStatus as "active" | "inactive"} : d
        )
      );
      
      toast({
        title: "Status Updated",
        description: `Doctor status has been set to ${newStatus}.`,
      });
    } catch (error) {
      console.error("Error changing doctor status:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update doctor status. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteDoctor = async (doctorId: string) => {
    if (!confirm("Are you sure you want to delete this doctor? This action cannot be undone.")) {
      return;
    }
    
    try {
      // Find the doctor in our local state to determine which collection to delete from
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return;
      
      if (doctor.uid) {
        // Delete from users collection
        await deleteDoc(doc(db, "users", doctorId));
      } else {
        // Delete from doctors collection
        await deleteDoc(doc(db, "doctors", doctorId));
      }
      
      // Update local state
      setDoctors(prevDoctors => prevDoctors.filter(d => d.id !== doctorId));
      
      toast({
        title: "Doctor Removed",
        description: "The doctor has been removed from the system.",
      });
    } catch (error) {
      console.error("Error deleting doctor:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to remove doctor. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleAddDoctor = () => {
    setNewDoctor({
      name: "",
      email: "",
      phone: "",
      specialty: "General Practice",
      clinic: "",
      availability: "Mon-Fri",
      status: "active",
      patients: 0
    });
    setIsAddDoctorDialogOpen(true);
  };
  
  const handleSaveNewDoctor = async () => {
    try {
      if (!newDoctor.name || !newDoctor.email) {
        toast({
          title: "Missing Information",
          description: "Please provide at least a name and email for the new doctor.",
          variant: "destructive"
        });
        return;
      }
      
      // Add to doctors collection
      const docRef = await addDoc(collection(db, "doctors"), {
        name: newDoctor.name,
        email: newDoctor.email,
        phone: newDoctor.phone || "",
        specialty: newDoctor.specialty || "General Practice",
        clinic: newDoctor.clinic || "",
        availability: newDoctor.availability || "Mon-Fri",
        status: newDoctor.status || "active",
        patients: 0,
        joinDate: new Date().toISOString().split('T')[0],
        createdAt: new Date()
      });
      
      // Create new doctor with ID and add to local state
      const newDoctorWithId: Doctor = {
        id: docRef.id,
        name: newDoctor.name || "",
        email: newDoctor.email || "",
        phone: newDoctor.phone || "",
        specialty: newDoctor.specialty || "General Practice",
        clinic: newDoctor.clinic || "",
        availability: newDoctor.availability || "Mon-Fri",
        status: (newDoctor.status as "active" | "inactive") || "active",
        patients: 0,
        joinDate: new Date().toISOString().split('T')[0]
      };
      
      setDoctors(prevDoctors => [...prevDoctors, newDoctorWithId]);
      
      toast({
        title: "Doctor Added",
        description: "New doctor has been added successfully.",
      });
      
      setIsAddDoctorDialogOpen(false);
    } catch (error) {
      console.error("Error adding new doctor:", error);
      toast({
        title: "Add Failed",
        description: "Failed to add new doctor. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout userRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">Doctor Management</h1>
          <p className="text-muted-foreground">
            View and manage doctors registered in the system
          </p>
        </div>
        
        <Tabs defaultValue="table" onValueChange={setView} className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="cards">Card View</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-4 items-center">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search doctors..."
                  className="w-full pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button 
                className="gap-2 bg-health-primary hover:bg-health-secondary"
                onClick={handleAddDoctor}
              >
                <UserPlus className="h-4 w-4" />
                Add Doctor
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap mt-4">
            <Badge 
              className={specialtyFilter === "all" ? "bg-health-primary hover:bg-health-secondary cursor-pointer" : "bg-secondary cursor-pointer"} 
              onClick={() => setSpecialtyFilter("all")}
            >
              All Specialties
            </Badge>
            {specialties.map((specialty) => (
              <Badge 
                key={specialty}
                className={specialtyFilter === specialty ? "bg-health-primary hover:bg-health-secondary cursor-pointer" : "bg-secondary cursor-pointer"} 
                onClick={() => setSpecialtyFilter(specialty)}
              >
                {specialty}
              </Badge>
            ))}
          </div>
          
          <TabsContent value="table" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="hidden md:table-cell">Specialty</TableHead>
                    <TableHead className="hidden lg:table-cell">Clinic</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Patients</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No doctors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDoctors.map((doctor) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-health-light text-health-primary">
                                {doctor.name.split(' ')[1][0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div>{doctor.name}</div>
                              <div className="md:hidden text-xs text-muted-foreground">{doctor.specialty}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{doctor.specialty}</TableCell>
                        <TableCell className="hidden lg:table-cell">{doctor.clinic}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            className={
                              doctor.status === "active" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {doctor.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{doctor.patients}</TableCell>
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
                              <DropdownMenuItem onClick={() => handleEditDoctor(doctor)}>
                                Edit details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleChangeStatus(doctor.id, doctor.status === "active" ? "inactive" : "active")}
                              >
                                {doctor.status === "active" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteDoctor(doctor.id)}
                              >
                                Remove doctor
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
          </TabsContent>
          
          <TabsContent value="cards" className="mt-4">
          {isLoading ? (
            <div className="flex w-full items-center justify-center rounded-md border border-dashed p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex w-full items-center justify-center rounded-md border border-dashed p-8">
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-sm text-muted-foreground">No doctors found</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDoctors.map((doctor) => (
                <Card key={doctor.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-health-light text-health-primary">
                            {doctor.name.split(' ')[1][0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{doctor.name}</CardTitle>
                          <CardDescription>{doctor.specialty}</CardDescription>
                        </div>
                      </div>
                      <Badge
                        className={
                          doctor.status === "active" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {doctor.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div className="flex items-center text-sm">
                      <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{doctor.clinic}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{doctor.email}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{doctor.phone}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Available: {doctor.availability}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{doctor.patients} active patients</span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditDoctor(doctor)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={doctor.status === "active" ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50"}
                      onClick={() => handleChangeStatus(doctor.id, doctor.status === "active" ? "inactive" : "active")}
                    >
                      {doctor.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>
      </div>
      
      {/* Edit Doctor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription>
              Update the doctor's information and preferences.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDoctor && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right text-sm font-medium">
                  Name
                </label>
                <Input
                  id="name"
                  value={selectedDoctor.name}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, name: e.target.value})}
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
                  value={selectedDoctor.email}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, email: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right text-sm font-medium">
                  Phone
                </label>
                <Input
                  id="phone"
                  value={selectedDoctor.phone}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, phone: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="specialty" className="text-right text-sm font-medium">
                  Specialty
                </label>
                <Input
                  id="specialty"
                  value={selectedDoctor.specialty}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, specialty: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="clinic" className="text-right text-sm font-medium">
                  Clinic
                </label>
                <Input
                  id="clinic"
                  value={selectedDoctor.clinic}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, clinic: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="availability" className="text-right text-sm font-medium">
                  Availability
                </label>
                <Input
                  id="availability"
                  value={selectedDoctor.availability}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, availability: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="status" className="text-right text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  value={selectedDoctor.status}
                  onChange={(e) => setSelectedDoctor({...selectedDoctor, status: e.target.value})}
                  className="col-span-3 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-health-primary hover:bg-health-secondary" onClick={handleSaveDoctor}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Doctor Dialog */}
      <Dialog open={isAddDoctorDialogOpen} onOpenChange={setIsAddDoctorDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
            <DialogDescription>
              Provide the doctor's information to add them to the system.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={newDoctor.name}
                onChange={(e) => setNewDoctor({...newDoctor, name: e.target.value})}
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
                value={newDoctor.email}
                onChange={(e) => setNewDoctor({...newDoctor, email: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="phone" className="text-right text-sm font-medium">
                Phone
              </label>
              <Input
                id="phone"
                value={newDoctor.phone}
                onChange={(e) => setNewDoctor({...newDoctor, phone: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="specialty" className="text-right text-sm font-medium">
                Specialty
              </label>
              <Input
                id="specialty"
                value={newDoctor.specialty}
                onChange={(e) => setNewDoctor({...newDoctor, specialty: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="clinic" className="text-right text-sm font-medium">
                Clinic
              </label>
              <Input
                id="clinic"
                value={newDoctor.clinic}
                onChange={(e) => setNewDoctor({...newDoctor, clinic: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="availability" className="text-right text-sm font-medium">
                Availability
              </label>
              <Input
                id="availability"
                value={newDoctor.availability}
                onChange={(e) => setNewDoctor({...newDoctor, availability: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="status" className="text-right text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                value={newDoctor.status}
                onChange={(e) => setNewDoctor({...newDoctor, status: e.target.value})}
                className="col-span-3 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDoctorDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-health-primary hover:bg-health-secondary" onClick={handleSaveNewDoctor}>
              Add Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Doctors;
