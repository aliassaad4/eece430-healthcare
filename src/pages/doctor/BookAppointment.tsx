import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isPast, startOfDay } from "date-fns";
import { CalendarIcon, Clock, ArrowLeft, Loader2, Search, X, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
} from "firebase/firestore";
import { fetchWithoutIndex } from "@/services/firebase/query-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Patient {
    id: string;
    fullName?: string;
    name?: string;
    email: string;
    phone?: string;
    phoneNumber?: string;
    medicalConditions?: string[];
    lastVisit?: string;
}

interface AvailableSlot {
    time: string;
    available: boolean;
}

const BookAppointment = () => {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const loggedInDoctorId = auth.currentUser?.uid;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [doctorName, setDoctorName] = useState("");
    const [doctorSpecialty, setDoctorSpecialty] = useState("");
    const [date, setDate] = useState<Date>(addDays(startOfDay(new Date()), 1));
    const [timeSlots, setTimeSlots] = useState<AvailableSlot[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [appointmentType, setAppointmentType] = useState("regular");
    const [notes, setNotes] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [allPatients, setAllPatients] = useState<Patient[]>([]);
    const [isLoadingPatients, setIsLoadingPatients] = useState(true);
    const [activeTab, setActiveTab] = useState("search");
    const [localSearchResults, setLocalSearchResults] = useState<Patient[]>([]);

    // Default time slots
    const defaultTimeSlots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
        "04:00 PM", "04:30 PM", "05:00 PM"
    ];

    // Fetch doctor info and patient data if patientId is provided
    useEffect(() => {
        const fetchData = async () => {
            if (!loggedInDoctorId) {
                setIsLoading(false);
                toast({
                    title: "Authentication Error",
                    description: "Please log in again to continue.",
                    variant: "destructive",
                });
                return;
            }

            try {
                // Get the doctor's details - first try users collection
                const doctorDoc = await getDoc(doc(db, "users", loggedInDoctorId));
                if (doctorDoc.exists()) {
                    const doctorData = doctorDoc.data();
                    setDoctorName(doctorData.fullName || doctorData.name || "Dr. Unknown");
                    setDoctorSpecialty(doctorData.specialty || "General Practice");
                } else {
                    // Try doctors collection as fallback
                    const fallbackDoctorDoc = await getDoc(doc(db, "doctors", loggedInDoctorId));
                    if (fallbackDoctorDoc.exists()) {
                        const fallbackData = fallbackDoctorDoc.data();
                        setDoctorName(fallbackData.fullName || fallbackData.name || "Dr. Unknown");
                        setDoctorSpecialty(fallbackData.specialty || "General Practice");
                    } else {
                        console.log("Doctor profile not found in any collection");
                    }
                }

                // If a patientId was provided, get the patient's details
                if (patientId) {
                    await fetchPatientById(patientId);
                }
                
                // Fetch all patients for this doctor
                fetchAllPatients();
            } catch (error) {
                console.error("Error fetching initial data:", error);
                toast({
                    title: "Error",
                    description: "Failed to load data. Please try again.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [loggedInDoctorId, patientId]);
    
    // Fetch all patients associated with this doctor
    const fetchAllPatients = async () => {
        if (!loggedInDoctorId) return;
        
        setIsLoadingPatients(true);
        try {
            // First fetch all appointments to identify patients who have had appointments with this doctor
            const appointmentsData = await fetchWithoutIndex(
                "appointments",
                { field: "doctorId", value: loggedInDoctorId }
            );
            
            // Extract unique patient IDs from appointments
            const patientIds = [...new Set(appointmentsData.map(appt => appt.patientId))];
            
            const patientMap: Record<string, Patient> = {};
            
            // If we have patient IDs from appointments, get their details
            if (patientIds.length > 0) {
                // Get patient details from users collection - batch in groups of 10 (Firestore limit)
                for (let i = 0; i < patientIds.length; i += 10) {
                    const batch = patientIds.slice(i, i + 10);
                    try {
                        const usersQuery = query(
                            collection(db, "users"),
                            where("__name__", "in", batch)
                        );
                        const usersSnapshot = await getDocs(usersQuery);
                        
                        usersSnapshot.forEach(doc => {
                            const userData = doc.data();
                            if (userData.role === "patient" || !userData.role) {
                                patientMap[doc.id] = {
                                    id: doc.id,
                                    fullName: userData.fullName || userData.name || "Unknown",
                                    email: userData.email || "",
                                    phone: userData.phoneNumber || userData.phone || "",
                                    medicalConditions: userData.medicalConditions || []
                                };
                            }
                        });
                    } catch (error) {
                        console.error("Error fetching patient batch from users:", error);
                    }
                }
                
                // Check patients collection for any missing patients
                const missingPatientIds = patientIds.filter(id => !patientMap[id]);
                if (missingPatientIds.length > 0) {
                    for (let i = 0; i < missingPatientIds.length; i += 10) {
                        const batch = missingPatientIds.slice(i, i + 10);
                        try {
                            const patientsQuery = query(
                                collection(db, "patients"),
                                where("__name__", "in", batch)
                            );
                            const patientsSnapshot = await getDocs(patientsQuery);
                            
                            patientsSnapshot.forEach(doc => {
                                const patientData = doc.data();
                                patientMap[doc.id] = {
                                    id: doc.id,
                                    name: patientData.name || "Unknown",
                                    email: patientData.email || "",
                                    phone: patientData.phone || patientData.phoneNumber || "",
                                    medicalConditions: patientData.medicalConditions || []
                                };
                            });
                        } catch (error) {
                            console.error("Error fetching patient batch from patients:", error);
                        }
                    }
                }
            }
            
            // Also get any patients directly assigned to this doctor in the users collection
            try {
                const assignedPatientsQuery = query(
                    collection(db, "users"),
                    where("doctorId", "==", loggedInDoctorId),
                    where("role", "==", "patient")
                );
                const assignedPatientsSnapshot = await getDocs(assignedPatientsQuery);
                
                assignedPatientsSnapshot.forEach(doc => {
                    const userData = doc.data();
                    if (!patientMap[doc.id]) {
                        patientMap[doc.id] = {
                            id: doc.id,
                            fullName: userData.fullName || userData.name || "Unknown",
                            email: userData.email || "",
                            phone: userData.phoneNumber || userData.phone || "",
                            medicalConditions: userData.medicalConditions || []
                        };
                    }
                });
            } catch (error) {
                console.error("Error fetching assigned patients:", error);
            }
            
            // Add last visit information to patients based on appointments
            const patientsWithLastVisit = Object.values(patientMap).map(patient => {
                const patientAppointments = appointmentsData.filter(
                    appt => appt.patientId === patient.id && appt.status === "completed"
                );
                
                if (patientAppointments.length > 0) {
                    // Sort by date and get the most recent one
                    const sortedAppointments = [...patientAppointments].sort(
                        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    
                    return {
                        ...patient,
                        lastVisit: sortedAppointments[0].date
                    };
                }
                
                return patient;
            });
            
            // Sort patients alphabetically by name
            const sortedPatients = patientsWithLastVisit.sort((a, b) => {
                const nameA = (a.fullName || a.name || "").toLowerCase();
                const nameB = (b.fullName || b.name || "").toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            setAllPatients(sortedPatients);
        } catch (error) {
            console.error("Error fetching all patients:", error);
            toast({
                title: "Error",
                description: "Failed to load patient list. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoadingPatients(false);
        }
    };

    // Separate function to fetch patient by ID for better error handling and reuse
    const fetchPatientById = async (id: string) => {
        try {
            // Check users collection first
            const patientDoc = await getDoc(doc(db, "users", id));
            if (patientDoc.exists()) {
                const patientData = patientDoc.data();
                setPatient({
                    id: id,
                    fullName: patientData.fullName || patientData.name || "Unknown",
                    email: patientData.email || "No email provided",
                    phone: patientData.phoneNumber || patientData.phone || "No phone number",
                    medicalConditions: patientData.medicalConditions || [],
                });
                return;
            }
            
            // Try patients collection as fallback
            const fallbackDoc = await getDoc(doc(db, "patients", id));
            if (fallbackDoc.exists()) {
                const fallbackData = fallbackDoc.data();
                setPatient({
                    id: id,
                    name: fallbackData.name || "Unknown",
                    email: fallbackData.email || "No email provided",
                    phone: fallbackData.phone || "No phone number",
                    medicalConditions: fallbackData.medicalConditions || [],
                });
                return;
            }
            
            // If we get here, the patient wasn't found
            toast({
                title: "Patient Not Found",
                description: "The selected patient could not be found in our records.",
                variant: "destructive",
            });
        } catch (error) {
            console.error(`Error fetching patient ${id}:`, error);
            toast({
                title: "Error",
                description: "Failed to load patient data. Please try again.",
                variant: "destructive",
            });
        }
    };

    // Update available time slots when date changes
    useEffect(() => {
        const fetchAvailableSlots = async () => {
            if (!loggedInDoctorId || !date) return;

            try {
                const formattedDate = format(date, "yyyy-MM-dd");
                
                // Use fetchWithoutIndex for better querying without requiring custom indexes
                // Check for blocked slots in scheduleSlots collection
                const blockedSlots = await fetchWithoutIndex(
                    "scheduleSlots",
                    { field: "doctorId", value: loggedInDoctorId },
                    [
                        { field: "day", operator: "==", value: formattedDate },
                        { field: "isBlocked", operator: "==", value: true }
                    ]
                );
                
                const blockedTimes = new Set<string>();
                blockedSlots.forEach(slot => {
                    blockedTimes.add(slot.time);
                });

                // Check for existing appointments on this date
                const existingAppointments = await fetchWithoutIndex(
                    "appointments",
                    { field: "doctorId", value: loggedInDoctorId },
                    [{ field: "date", operator: "==", value: formattedDate }]
                );
                
                const bookedTimes = new Set<string>();
                existingAppointments.forEach(appt => {
                    bookedTimes.add(appt.time);
                });

                // Create available time slots array
                const slots = defaultTimeSlots.map(time => ({
                    time,
                    available: !blockedTimes.has(time) && !bookedTimes.has(time)
                }));

                setTimeSlots(slots);
                setSelectedTime(null); // Reset selected time when date changes
            } catch (error) {
                console.error("Error fetching available slots:", error);
                toast({
                    title: "Error",
                    description: "Failed to load available time slots. Using default availability.",
                    variant: "destructive",
                });
                
                // Default to showing all slots as available if there's an error
                setTimeSlots(defaultTimeSlots.map(time => ({ time, available: true })));
            }
        };

        fetchAvailableSlots();
    }, [loggedInDoctorId, date]);

    // Updated handleSearch function to use local patient data first
    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) {
            toast({
                title: "Search Query Too Short",
                description: "Please enter at least 2 characters to search.",
                variant: "destructive",
            });
            return;
        }

        setIsSearching(true);
        
        // First search through the already loaded patient data
        const query = searchQuery.toLowerCase();
        const localMatches = allPatients.filter(patient => 
            (patient.fullName?.toLowerCase().includes(query) || 
             patient.name?.toLowerCase().includes(query) ||
             patient.email?.toLowerCase().includes(query))
        );
        
        setLocalSearchResults(localMatches);
        
        // Only if we don't have enough local matches, search in Firestore
        if (localMatches.length < 5) {
            try {
                // Search by name first using fetchWithoutIndex for better performance
                const nameResults = await fetchWithoutIndex(
                    "users",
                    { field: "role", value: "patient" }
                );
                
                // Filter locally by name
                const matchingByName = nameResults.filter(user => 
                    (user.fullName?.toLowerCase().includes(query) || 
                     user.name?.toLowerCase().includes(query)) &&
                    user.role === "patient" &&
                    // Filter out patients we already have locally
                    !localMatches.some(p => p.id === user.id)
                );
                
                const patients: Patient[] = matchingByName.map(userData => ({
                    id: userData.id,
                    fullName: userData.fullName || userData.name,
                    email: userData.email || "",
                    phone: userData.phoneNumber || userData.phone || "",
                    medicalConditions: userData.medicalConditions || [],
                }));
                
                // If not many results and query looks like email, try email search
                if (patients.length < 5 && searchQuery.includes('@')) {
                    try {
                        const emailQuery = query(
                            collection(db, "users"),
                            where("role", "==", "patient"),
                            where("email", "==", searchQuery)
                        );
                        
                        const emailSnapshot = await getDocs(emailQuery);
                        emailSnapshot.forEach(doc => {
                            if (!patients.some(p => p.id === doc.id) && 
                                !localMatches.some(p => p.id === doc.id)) {
                                const userData = doc.data();
                                patients.push({
                                    id: doc.id,
                                    fullName: userData.fullName || userData.name,
                                    email: userData.email || "",
                                    phone: userData.phoneNumber || userData.phone || "",
                                    medicalConditions: userData.medicalConditions || [],
                                });
                            }
                        });
                    } catch (emailError) {
                        console.error("Email search failed:", emailError);
                    }
                }
                
                // As a last resort, check patients collection
                if (patients.length === 0 && localMatches.length === 0) {
                    const patientsResults = await fetchWithoutIndex("patients", {});
                    
                    // Filter locally
                    const matchingPatients = patientsResults.filter(patient => 
                        (patient.name?.toLowerCase().includes(query) ||
                        patient.email?.toLowerCase().includes(query)) &&
                        !localMatches.some(p => p.id === patient.id)
                    );
                    
                    matchingPatients.forEach(patientData => {
                        patients.push({
                            id: patientData.id,
                            name: patientData.name,
                            email: patientData.email || "",
                            phone: patientData.phone || "",
                            medicalConditions: patientData.medicalConditions || [],
                        });
                    });
                }

                // Combine local matches with Firestore results
                const combined = [...localMatches, ...patients];
                setSearchResults(combined);
            } catch (error) {
                console.error("Error searching patients:", error);
                // If there's an error with Firestore, at least show local matches
                setSearchResults(localMatches);
                toast({
                    title: "Search Warning",
                    description: "Only showing patients from your local data. External search failed.",
                    variant: "destructive",
                });
            }
        } else {
            // If we have enough local matches, just use those
            setSearchResults(localMatches);
        }
        
        setIsSearching(false);
    };

    // Function to handle real-time searching as the user types
    const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        
        if (value.length >= 2) {
            // Search through local patient data immediately
            const query = value.toLowerCase();
            const matches = allPatients.filter(patient => 
                (patient.fullName?.toLowerCase().includes(query) || 
                 patient.name?.toLowerCase().includes(query) ||
                 patient.email?.toLowerCase().includes(query))
            );
            setLocalSearchResults(matches.slice(0, 10)); // Limit to 10 results for performance
        } else {
            setLocalSearchResults([]);
        }
    };

    const selectPatient = (patient: Patient) => {
        setPatient(patient);
        setSearchResults([]);
        setSearchQuery("");
    };

    const handleBookAppointment = async () => {
        if (!loggedInDoctorId || !patient || !selectedTime || !date) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const formattedDate = format(date, "yyyy-MM-dd");
            
            // Create the appointment in Firestore
            const appointmentData = {
                doctorId: loggedInDoctorId,
                patientId: patient.id,
                date: formattedDate,
                time: selectedTime,
                status: "scheduled",
                type: appointmentType,
                specialty: doctorSpecialty,
                notes: notes,
                doctorName: doctorName,
                patientName: patient?.fullName || patient?.name || "Patient",
                createdAt: serverTimestamp(),
            };
            
            const appointmentRef = await addDoc(collection(db, "appointments"), appointmentData);

            toast({
                title: "Appointment Booked",
                description: `Appointment successfully booked for ${format(date, "MMMM d, yyyy")} at ${selectedTime}.`,
            });

            // Navigate back to the patients page
            navigate("/doctor/patients");
        } catch (error) {
            console.error("Error creating appointment:", error);
            toast({
                title: "Booking Failed",
                description: "Failed to book the appointment. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNavigateBack = () => {
        navigate("/doctor/patients");
    };

    if (isLoading) {
        return (
            <Layout userRole="doctor">
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
                    <span className="ml-3 text-lg">Loading patient details...</span>
                </div>
            </Layout>
        );
    }

    return (
        <Layout userRole="doctor">
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    className="gap-2 mb-4"
                    onClick={handleNavigateBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Patients
                </Button>

                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">Book Appointment</h1>
                    <p className="text-muted-foreground">
                        {patient 
                            ? `Schedule a new appointment for ${patient.fullName || patient.name || "patient"}`
                            : "Select a patient and schedule an appointment"
                        }
                    </p>
                </div>

                {/* Patient Selection Section (shown when no patient is selected) */}
                {!patient && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Select Patient</CardTitle>
                            <CardDescription>Find a patient to book an appointment</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs 
                                value={activeTab} 
                                onValueChange={setActiveTab} 
                                className="w-full"
                            >
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="search">
                                        <Search className="h-4 w-4 mr-2" />
                                        Search
                                    </TabsTrigger>
                                    <TabsTrigger value="all">
                                        <Users className="h-4 w-4 mr-2" />
                                        My Patients
                                    </TabsTrigger>
                                </TabsList>
                                
                                {/* Search Tab */}
                                <TabsContent value="search" className="space-y-4">
                                    <div className="flex gap-2 mb-4">
                                        <div className="relative flex-grow">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="search"
                                                placeholder="Search patients by name or email..."
                                                className="pl-8"
                                                value={searchQuery}
                                                onChange={handleSearchQueryChange}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            />
                                        </div>
                                        <Button onClick={handleSearch} disabled={isSearching}>
                                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                                        </Button>
                                    </div>

                                    {/* Instant Search Results */}
                                    {localSearchResults.length > 0 && !isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                                        <div className="border rounded-md">
                                            <div className="py-2 px-4 border-b bg-muted/50 font-medium">
                                                Quick Results
                                            </div>
                                            <div className="divide-y">
                                                {localSearchResults.map((result) => (
                                                    <div 
                                                        key={result.id} 
                                                        className="py-2 px-4 hover:bg-muted/50 cursor-pointer flex justify-between items-center"
                                                        onClick={() => selectPatient(result)}
                                                    >
                                                        <div>
                                                            <div className="font-medium">{result.fullName || result.name || "Unknown"}</div>
                                                            <div className="text-sm text-muted-foreground">{result.email}</div>
                                                        </div>
                                                        <Button variant="outline" size="sm">Select</Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Search Results (after clicking search) */}
                                    {searchResults.length > 0 ? (
                                        <div className="border rounded-md">
                                            <div className="py-2 px-4 border-b bg-muted/50 font-medium">
                                                {searchResults.length} {searchResults.length === 1 ? "Patient" : "Patients"} Found
                                            </div>
                                            <div className="divide-y max-h-80 overflow-y-auto">
                                                {searchResults.map((result) => (
                                                    <div 
                                                        key={result.id} 
                                                        className="py-2 px-4 hover:bg-muted/50 cursor-pointer flex justify-between items-center"
                                                        onClick={() => selectPatient(result)}
                                                    >
                                                        <div>
                                                            <div className="font-medium">{result.fullName || result.name || "Unknown"}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {result.email}
                                                                {result.lastVisit && (
                                                                    <span className="ml-2 text-xs text-gray-500">
                                                                        Last visit: {new Date(result.lastVisit).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" size="sm">Select</Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : searchQuery && searchQuery.length >= 2 && !isSearching ? (
                                        <div className="text-center py-4 text-muted-foreground">
                                            No patients found with that name or email.
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 border rounded-md">
                                            <div className="space-y-2">
                                                <div className="text-muted-foreground">
                                                    Search for a patient by name or email to book an appointment
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    Start typing to see matching patients from your list
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                                
                                {/* All Patients Tab */}
                                <TabsContent value="all" className="space-y-4">
                                    {isLoadingPatients ? (
                                        <div className="flex justify-center items-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin text-health-primary" />
                                            <span className="ml-2">Loading your patients...</span>
                                        </div>
                                    ) : allPatients.length === 0 ? (
                                        <div className="text-center py-10 border rounded-md">
                                            <div className="space-y-2">
                                                <div className="text-muted-foreground">
                                                    No patients found
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    You don't have any patients assigned yet or no appointment history
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border rounded-md">
                                            <div className="py-2 px-4 border-b bg-muted/50 font-medium">
                                                Your Patients ({allPatients.length})
                                            </div>
                                            <div className="divide-y max-h-80 overflow-y-auto">
                                                {allPatients.map((patient) => (
                                                    <div 
                                                        key={patient.id} 
                                                        className="py-2 px-4 hover:bg-muted/50 cursor-pointer flex justify-between items-center"
                                                        onClick={() => selectPatient(patient)}
                                                    >
                                                        <div>
                                                            <div className="font-medium">
                                                                {patient.fullName || patient.name || "Unknown"}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {patient.email}
                                                                {patient.lastVisit && (
                                                                    <span className="ml-2 text-xs text-gray-500">
                                                                        Last visit: {new Date(patient.lastVisit).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" size="sm">Select</Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                )}

                {patient && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Patient Information Card */}
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div>
                                    <CardTitle>Patient Information</CardTitle>
                                </div>
                                {!patientId && (
                                    <Button 
                                        variant="ghost" 
                                        className="h-8 w-8 p-0" 
                                        onClick={() => setPatient(null)}
                                    >
                                        <span className="sr-only">Change patient</span>
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <Label>Name</Label>
                                    <p className="text-sm font-medium">{patient.fullName || patient.name || "Unknown"}</p>
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <p className="text-sm">{patient.email}</p>
                                </div>
                                <div>
                                    <Label>Phone</Label>
                                    <p className="text-sm">{patient.phone || patient.phoneNumber || "No phone number"}</p>
                                </div>
                                {patient.medicalConditions && patient.medicalConditions.length > 0 && (
                                    <div>
                                        <Label>Medical Conditions</Label>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {patient.medicalConditions.map((condition, index) => (
                                                <div key={index} className="bg-gray-100 text-xs px-2 py-1 rounded-full">
                                                    {condition}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {patient.lastVisit && (
                                    <div>
                                        <Label>Last Visit</Label>
                                        <p className="text-sm">{new Date(patient.lastVisit).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Appointment Form Card */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Appointment Details</CardTitle>
                                <CardDescription>Fill in the appointment information</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Date Picker */}
                                <div className="space-y-2">
                                    <Label htmlFor="date">Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start text-left"
                                                id="date"
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={date}
                                                onSelect={(date) => date && setDate(date)}
                                                disabled={(date) => isPast(date) || date < startOfDay(new Date())}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Time Slots */}
                                <div className="space-y-2">
                                    <Label>Time Slot</Label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {timeSlots.map((slot) => (
                                            <Button
                                                key={slot.time}
                                                type="button"
                                                variant={selectedTime === slot.time ? "default" : "outline"}
                                                onClick={() => slot.available && setSelectedTime(slot.time)}
                                                disabled={!slot.available}
                                                className={cn(
                                                    "h-10",
                                                    selectedTime === slot.time ? "bg-health-primary" : "",
                                                    !slot.available && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <Clock className="h-3.5 w-3.5 mr-2" />
                                                {slot.time}
                                            </Button>
                                        ))}
                                    </div>
                                    {timeSlots.every(slot => !slot.available) && (
                                        <p className="text-sm text-yellow-600 mt-2">
                                            All time slots are booked for this date. Please select another date.
                                        </p>
                                    )}
                                </div>

                                {/* Appointment Type */}
                                <div className="space-y-2">
                                    <Label htmlFor="type">Appointment Type</Label>
                                    <Select value={appointmentType} onValueChange={setAppointmentType}>
                                        <SelectTrigger id="type">
                                            <SelectValue placeholder="Select appointment type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="regular">Regular Checkup</SelectItem>
                                            <SelectItem value="followup">Follow-up Appointment</SelectItem>
                                            <SelectItem value="emergency">Urgent Care</SelectItem>
                                            <SelectItem value="consultation">Consultation</SelectItem>
                                            <SelectItem value="procedure">Procedure</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Add any additional notes about this appointment"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end">
                                <Button
                                    className="bg-health-primary hover:bg-health-secondary"
                                    onClick={handleBookAppointment}
                                    disabled={isSubmitting || !selectedTime}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Booking...
                                        </>
                                    ) : (
                                        "Book Appointment"
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default BookAppointment;