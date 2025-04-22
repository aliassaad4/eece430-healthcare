import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { FileText, Mail, Phone, Search, Loader2, Calendar, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import { 
    collection, 
    onSnapshot, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc,
    orderBy 
} from "firebase/firestore";
import { 
    getDocuments, 
    queryConstraints,
    fetchWithoutIndex
} from "@/services/firebase/firestore.service";
import { useNavigate } from "react-router-dom";

interface Patient {
    id: string;
    fullName?: string;
    name?: string;
    email: string;
    phone?: string;
    phoneNumber?: string;
    dob?: string;
    lastVisit?: string;
    upcomingAppointment?: string | null;
    upcomingAppointmentId?: string | null;
    waitlistRequests?: number;
    emergencyRequests?: number;
    medicalConditions?: string[];
    notesCount?: number;
    role?: string;
    status?: 'active' | 'new' | 'waiting' | 'emergency';
}

interface Appointment {
    id: string;
    doctorId: string;
    patientId: string;
    date: string;
    time: string;
    status: string;
    notes?: string;
}

interface WaitlistItem {
    id: string;
    doctorId: string;
    patientId: string;
    specialty: string;
    requestDate: string;
    urgency: "normal" | "urgent" | "emergency";
}

interface EmergencyRequest {
    id: string;
    doctorId: string;
    patientId: string;
    status: "pending" | "approved" | "rejected";
}

const Patients = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const loggedInDoctorId = auth.currentUser?.uid;
    const navigate = useNavigate();

    useEffect(() => {
        if (loggedInDoctorId) {
            setIsLoading(true);
            
            // First get all appointments for this doctor
            const fetchPatients = async () => {
                try {
                    // Get appointments to find patient IDs
                    const appointmentsRef = collection(db, "appointments");
                    const appointmentsQuery = query(
                        appointmentsRef, 
                        where("doctorId", "==", loggedInDoctorId)
                    );
                    
                    const appointmentsSnapshot = await getDocs(appointmentsQuery);
                    const appointments: Appointment[] = [];
                    appointmentsSnapshot.forEach(doc => {
                        appointments.push({ id: doc.id, ...doc.data() } as Appointment);
                    });
                    
                    // Fetch waitlist requests from this doctor
                    const waitlistRequests = await fetchWithoutIndex(
                        "waitlists",
                        { field: "doctorId", value: loggedInDoctorId }
                    );
                    
                    // Fetch emergency requests from this doctor
                    const emergencyRequests = await fetchWithoutIndex(
                        "emergencyRequests",
                        { field: "doctorId", value: loggedInDoctorId },
                        [{ field: "status", operator: "==", value: "pending" }]
                    );
                    
                    // Extract unique patient IDs from all sources
                    const appointmentPatientIds = appointments.map(appt => appt.patientId);
                    const waitlistPatientIds = waitlistRequests.map(req => req.patientId);
                    const emergencyPatientIds = emergencyRequests.map(req => req.patientId);
                    
                    // Combine all unique patient IDs
                    const allPatientIds = [...new Set([
                        ...appointmentPatientIds,
                        ...waitlistPatientIds,
                        ...emergencyPatientIds
                    ])];
                    
                    if (allPatientIds.length === 0) {
                        setPatients([]);
                        setIsLoading(false);
                        return;
                    }
                    
                    // Get patient details from users collection
                    const usersRef = collection(db, "users");
                    const usersQuery = query(
                        usersRef,
                        where("__name__", "in", allPatientIds)
                    );
                    
                    const patientMap: Record<string, Patient> = {};
                    
                    try {
                        const usersSnapshot = await getDocs(usersQuery);
                        
                        usersSnapshot.forEach(doc => {
                            const userData = doc.data();
                            if (userData.role === "patient" || !userData.role) {
                                patientMap[doc.id] = {
                                    id: doc.id,
                                    fullName: userData.fullName || userData.name || "Unknown",
                                    email: userData.email || "",
                                    phone: userData.phoneNumber || userData.phone || "",
                                    medicalConditions: userData.medicalConditions || [],
                                    role: userData.role || "patient",
                                    status: 'active'
                                };
                            }
                        });
                        
                        // For any patient IDs we couldn't find in users, check patients collection
                        const missingPatientIds = allPatientIds.filter(id => !patientMap[id]);
                        
                        if (missingPatientIds.length > 0) {
                            for (const patientId of missingPatientIds) {
                                try {
                                    const patientDoc = await getDoc(doc(db, "patients", patientId));
                                    if (patientDoc.exists()) {
                                        const data = patientDoc.data();
                                        patientMap[patientId] = {
                                            id: patientId,
                                            name: data.name || "Unknown",
                                            email: data.email || "",
                                            phone: data.phone || data.phoneNumber || "",
                                            medicalConditions: data.medicalConditions || [],
                                            status: 'active'
                                        };
                                    } else {
                                        // Create placeholder for patients we can't find
                                        patientMap[patientId] = {
                                            id: patientId,
                                            name: "Unknown Patient",
                                            email: "No email available",
                                            phone: "No phone available",
                                            medicalConditions: [],
                                            status: 'active'
                                        };
                                    }
                                } catch (error) {
                                    console.error(`Error fetching patient ${patientId}:`, error);
                                }
                            }
                        }
                        
                        // Process appointment data to get last visit and upcoming appointment
                        const today = new Date().setHours(0, 0, 0, 0);
                        
                        for (const patientId of allPatientIds) {
                            if (patientMap[patientId]) {
                                // Find patient's appointments
                                const patientAppointments = appointments.filter(
                                    appt => appt.patientId === patientId
                                );
                                
                                // Find last visit (completed appointment in the past)
                                const completedAppointments = patientAppointments.filter(
                                    appt => appt.status === "completed"
                                );
                                
                                if (completedAppointments.length > 0) {
                                    const sortedCompleted = completedAppointments.sort(
                                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                                    );
                                    
                                    patientMap[patientId].lastVisit = sortedCompleted[0].date;
                                }
                                
                                // Find upcoming appointment (scheduled in the future)
                                const upcomingAppointments = patientAppointments.filter(
                                    appt => (appt.status === "scheduled" || appt.status === "upcoming" || appt.status === "emergency") &&
                                    new Date(appt.date).getTime() >= today
                                );
                                
                                if (upcomingAppointments.length > 0) {
                                    // Sort by date and get the soonest
                                    const sortedUpcoming = upcomingAppointments.sort(
                                        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                                    );
                                    
                                    patientMap[patientId].upcomingAppointment = sortedUpcoming[0].date;
                                    patientMap[patientId].upcomingAppointmentId = sortedUpcoming[0].id;
                                }
                                
                                // Count waitlist requests
                                const patientWaitlists = waitlistRequests.filter(
                                    req => req.patientId === patientId
                                );
                                patientMap[patientId].waitlistRequests = patientWaitlists.length;
                                
                                // Check for emergency requests
                                const patientEmergencies = emergencyRequests.filter(
                                    req => req.patientId === patientId
                                );
                                patientMap[patientId].emergencyRequests = patientEmergencies.length;
                                
                                // Set patient status based on emergency/waitlist/appointment
                                if (patientEmergencies.length > 0) {
                                    patientMap[patientId].status = 'emergency';
                                } else if (patientWaitlists.length > 0) {
                                    patientMap[patientId].status = 'waiting';
                                } else if (!patientMap[patientId].lastVisit) {
                                    patientMap[patientId].status = 'new';
                                }
                                
                                // Count patient notes
                                try {
                                    const notesRef = collection(db, "medicalNotes");
                                    const notesQuery = query(notesRef, 
                                        where("patientId", "==", patientId),
                                        where("doctorId", "==", loggedInDoctorId)
                                    );
                                    const notesSnapshot = await getDocs(notesQuery);
                                    
                                    patientMap[patientId].notesCount = notesSnapshot.size;
                                } catch (error) {
                                    console.error(`Error counting notes for patient ${patientId}:`, error);
                                }
                            }
                        }
                        
                        // Convert map to array
                        const patientList = Object.values(patientMap);
                        setPatients(patientList);
                        
                    } catch (error) {
                        console.error("Error fetching patients data:", error);
                        toast({
                            title: "Error",
                            description: "Failed to load patient data. Please try again.",
                            variant: "destructive",
                        });
                    }
                    
                } catch (error) {
                    console.error("Error in patient data retrieval:", error);
                    toast({
                        title: "Error",
                        description: "Failed to retrieve patient information.",
                        variant: "destructive",
                    });
                } finally {
                    setIsLoading(false);
                }
            };
            
            fetchPatients();
            
            // Set up a refresh interval
            const refreshInterval = setInterval(fetchPatients, 60000); // refresh every minute
            
            return () => clearInterval(refreshInterval);
        }
    }, [loggedInDoctorId]);

    // Filter patients based on search query and tab
    const filteredPatients = patients.filter(patient => {
        const patientName = patient.fullName || patient.name || "";
        const matchesSearch =
            patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (patient.medicalConditions && patient.medicalConditions.some(condition =>
                condition.toLowerCase().includes(searchQuery.toLowerCase())
            ));

        if (activeTab === "all") return matchesSearch;
        if (activeTab === "upcoming") return matchesSearch && patient.upcomingAppointment !== null && patient.upcomingAppointment !== undefined;
        if (activeTab === "waitlist") return matchesSearch && (patient.waitlistRequests || 0) > 0;
        if (activeTab === "emergency") return matchesSearch && (patient.emergencyRequests || 0) > 0;
        if (activeTab === "recent") {
            if (!patient.lastVisit) return false;
            const lastVisitDate = new Date(patient.lastVisit);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return matchesSearch && lastVisitDate >= thirtyDaysAgo;
        }

        return matchesSearch;
    });

    const handleViewProfile = (patientId: string) => {
        navigate(`/doctor/patient-profile/${patientId}`);
    };

    const handleAddNote = (patientId: string) => {
        // If the patient has an upcoming appointment, navigate to that appointment's notes
        const patient = patients.find(p => p.id === patientId);
        if (patient && patient.upcomingAppointmentId) {
            navigate(`/doctor/appointments/notes/${patient.upcomingAppointmentId}`);
        } else {
            // Otherwise create a new medical note
            navigate(`/doctor/medical-notes/new?patientId=${patientId}`);
        }
    };

    const handleBookAppointment = (patientId: string) => {
        navigate(`/doctor/book-appointment/${patientId}`);
    };

    const handleViewWaitlist = (patientId: string) => {
        navigate(`/doctor/waitlist?patientId=${patientId}`);
    };

    const handleEmergencyRequest = (patientId: string) => {
        navigate(`/doctor/emergency-requests?patientId=${patientId}`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'emergency':
                return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Emergency</Badge>;
            case 'waiting':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">On Waitlist</Badge>;
            case 'new':
                return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">New Patient</Badge>;
            default:
                return null;
        }
    };

    return (
        <Layout userRole="doctor">
            <div className="space-y-6">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">My Patients</h1>
                    <p className="text-muted-foreground">
                        View and manage your assigned patients
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Tabs defaultValue="all" onValueChange={setActiveTab} className="w-full sm:w-auto">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
                            <TabsTrigger value="emergency">Emergency</TabsTrigger>
                            <TabsTrigger value="recent">Recent</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search patients..."
                            className="w-full pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
                        <span className="ml-3 text-lg">Loading patients...</span>
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="flex w-full items-center justify-center rounded-md border border-dashed p-8">
                        <div className="flex flex-col items-center gap-1.5">
                            <p className="text-sm text-muted-foreground">No patients found</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPatients.map((patient) => (
                            <Card key={patient.id} className={
                                patient.status === 'emergency' ? "border-l-4 border-l-health-error" :
                                patient.status === 'waiting' ? "border-l-4 border-l-yellow-500" :
                                patient.status === 'new' ? "border-l-4 border-l-blue-500" : ""
                            }>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle>{patient.fullName || patient.name || "Unknown Patient"}</CardTitle>
                                        {patient.status && getStatusBadge(patient.status)}
                                    </div>
                                    {patient.medicalConditions && patient.medicalConditions.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {patient.medicalConditions.slice(0, 2).map((condition, index) => (
                                                <Badge key={index} variant="outline" className="bg-gray-100">
                                                    {condition}
                                                </Badge>
                                            ))}
                                            {patient.medicalConditions.length > 2 && (
                                                <Badge variant="outline" className="bg-gray-100">
                                                    +{patient.medicalConditions.length - 2}
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center text-sm">
                                        <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span>{patient.email}</span>
                                    </div>
                                    <div className="flex items-center text-sm">
                                        <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span>{patient.phone || patient.phoneNumber || "No phone number"}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Last Visit</p>
                                            <p>{patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Next Appointment</p>
                                            <p>{patient.upcomingAppointment ? new Date(patient.upcomingAppointment).toLocaleDateString() : "None"}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                                        {patient.notesCount !== undefined && (
                                            <div className="flex items-center">
                                                <FileText className="mr-1 h-4 w-4 text-muted-foreground" />
                                                <span>{patient.notesCount} notes</span>
                                            </div>
                                        )}
                                        
                                        {(patient.waitlistRequests || 0) > 0 && (
                                            <div className="flex items-center">
                                                <Clock className="mr-1 h-4 w-4 text-yellow-500" />
                                                <span className="text-yellow-700">{patient.waitlistRequests} waitlist</span>
                                            </div>
                                        )}
                                        
                                        {(patient.emergencyRequests || 0) > 0 && (
                                            <div className="flex items-center">
                                                <AlertTriangle className="mr-1 h-4 w-4 text-red-500" />
                                                <span className="text-red-700">Emergency</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAddNote(patient.id)}
                                    >
                                        Add Note
                                    </Button>
                                    
                                    {patient.status === 'emergency' ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEmergencyRequest(patient.id)}
                                            className="border-health-error text-health-error hover:bg-red-50"
                                        >
                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                            View Emergency
                                        </Button>
                                    ) : patient.status === 'waiting' ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewWaitlist(patient.id)}
                                            className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                        >
                                            <Clock className="h-4 w-4 mr-1" />
                                            View Waitlist
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleBookAppointment(patient.id)}
                                            className="gap-1 border-health-primary text-health-primary hover:bg-health-light"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            Book Appointment
                                        </Button>
                                    )}
                                    
                                    <Button
                                        className="bg-health-primary hover:bg-health-secondary"
                                        size="sm"
                                        onClick={() => handleViewProfile(patient.id)}
                                    >
                                        View Profile
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Patients;