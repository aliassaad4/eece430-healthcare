// DoctorAppointments.tsx
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Search, Filter, Loader2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, db } from "@/config/firebase";
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, getDoc, getDocs, addDoc, deleteDoc } from "firebase/firestore";
import { toast } from "@/hooks/use-toast";
import { getDocuments, queryConstraints, fetchWithoutIndex } from "@/services/firebase/firestore.service";
import { useNavigate } from "react-router-dom";

interface Appointment {
    id: string;
    doctorId: string;
    patientId: string;
    date: string;
    time: string;
    specialty?: string;
    status: "scheduled" | "completed" | "cancelled" | "upcoming" | "emergency" | "pending" | "confirmed";
    notes?: string;
    patientName?: string;
    doctorName?: string;
    type?: string;
}

interface WaitlistItem {
    id: string;
    doctorId: string;
    patientId: string;
    specialty: string;
    patientName?: string;
    requestDate: string;
    urgency: "normal" | "urgent" | "emergency";
}

interface PatientInfo {
    id: string;
    fullName?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    phone?: string;
    doctorId?: string;
}

const DoctorAppointments = () => {
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
    const [filteredUpcomingAppointments, setFilteredUpcomingAppointments] = useState<Appointment[]>([]);
    const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
    const [filteredPastAppointments, setFilteredPastAppointments] = useState<Appointment[]>([]);
    const [waitlistRequests, setWaitlistRequests] = useState<WaitlistItem[]>([]);
    const [filteredWaitlistRequests, setFilteredWaitlistRequests] = useState<WaitlistItem[]>([]);
    const [activeTab, setActiveTab] = useState("upcoming");
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [noteText, setNoteText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [isLoading, setIsLoading] = useState(true);
    const loggedInDoctorId = auth.currentUser?.uid;
    const navigate = useNavigate();

    useEffect(() => {
        if (loggedInDoctorId) {
            setIsLoading(true);
            
            // Fetch appointments using the improved approach (through patients)
            const fetchAppointments = async () => {
                try {
                    console.log('Fetching appointments for doctor:', loggedInDoctorId);
                    
                    // First, get all patients assigned to this doctor
                    const patientsRef = collection(db, "patients");
                    const patientsQuery = query(
                        patientsRef, 
                        where("doctorId", "==", loggedInDoctorId)
                    );
                    
                    const patientsSnapshot = await getDocs(patientsQuery);
                    const patients: PatientInfo[] = [];
                    const patientMap: Record<string, PatientInfo> = {};
                    
                    patientsSnapshot.forEach(doc => {
                        const patientData = doc.data();
                        const patientInfo = {
                            id: doc.id,
                            name: patientData.name || "Unknown",
                            fullName: patientData.fullName || "",
                            email: patientData.email || "",
                            phone: patientData.phone || patientData.phoneNumber || "",
                            doctorId: patientData.doctorId
                        };
                        patients.push(patientInfo);
                        patientMap[doc.id] = patientInfo;
                    });
                    
                    // If no patients found, try getting patients from users collection
                    if (patients.length === 0) {
                        console.log('No patients found in patients collection, checking users collection');
                        
                        // Use fetchWithoutIndex for more flexibility
                        try {
                            const userData = await fetchWithoutIndex(
                                "users", 
                                { field: "role", value: "patient" }
                            );
                            
                            // Filter patients assigned to this doctor
                            const assignedPatients = userData.filter(user => user.doctorId === loggedInDoctorId);
                            
                            assignedPatients.forEach(user => {
                                const patientInfo = {
                                    id: user.id,
                                    name: user.name || "Unknown",
                                    fullName: user.fullName || "",
                                    email: user.email || "",
                                    phone: user.phone || user.phoneNumber || "",
                                    doctorId: user.doctorId
                                };
                                patients.push(patientInfo);
                                patientMap[user.id] = patientInfo;
                            });
                        } catch (error) {
                            console.error("Error fetching patient data from users collection:", error);
                        }
                    }
                    
                    console.log(`Found ${patients.length} patients for doctor ${loggedInDoctorId}`);
                    
                    if (patients.length === 0) {
                        // As a fallback, check direct appointments collection
                        console.log('No patients found, falling back to appointments collection');
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
                        
                        if (appointments.length > 0) {
                            // Process these appointments
                            processAppointments(appointments, patientMap);
                        } else {
                            // Check the nested collection structure as a last resort
                            const nestedAppointmentsRef = collection(db, "appointments", loggedInDoctorId, "appointments");
                            const nestedSnapshot = await getDocs(nestedAppointmentsRef);
                            const nestedAppointments: Appointment[] = [];
                            
                            nestedSnapshot.forEach(doc => {
                                nestedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
                            });
                            
                            if (nestedAppointments.length > 0) {
                                // Process these appointments
                                processAppointments(nestedAppointments, patientMap);
                            } else {
                                console.log('No appointments found for this doctor');
                                setUpcomingAppointments([]);
                                setPastAppointments([]);
                                setIsLoading(false);
                            }
                        }
                        return;
                    }
                    
                    // Now fetch appointments for each patient
                    const patientIds = patients.map(patient => patient.id);
                    const appointmentsRef = collection(db, "appointments");
                    const appointmentsQuery = query(
                        appointmentsRef, 
                        where("patientId", "in", patientIds)
                    );
                    
                    const appointmentsSnapshot = await getDocs(appointmentsQuery);
                    const appointmentsData: Appointment[] = [];
                    
                    appointmentsSnapshot.forEach(doc => {
                        const data = doc.data();
                        // Only include appointments for this doctor
                        if (data.doctorId === loggedInDoctorId) {
                            appointmentsData.push({ id: doc.id, ...data } as Appointment);
                        }
                    });
                    
                    // If we found appointments via the patient route, process them
                    if (appointmentsData.length > 0) {
                        processAppointments(appointmentsData, patientMap);
                    } else {
                        // Try the nested collection as a fallback
                        console.log('No appointments found in main collection, checking nested collection');
                        const nestedAppointmentsRef = collection(db, "appointments", loggedInDoctorId, "appointments");
                        const nestedSnapshot = await getDocs(nestedAppointmentsRef);
                        const nestedAppointments: Appointment[] = [];
                        
                        nestedSnapshot.forEach(doc => {
                            nestedAppointments.push({ id: doc.id, ...doc.data() } as Appointment);
                        });
                        
                        processAppointments(nestedAppointments, patientMap);
                    }
                    
                } catch (error) {
                    console.error("Error fetching appointments:", error);
                    toast({
                        title: "Error",
                        description: "Failed to fetch appointments. Please try again.",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                }
            };
            
            // Helper function to process appointments data
            const processAppointments = (appointmentsData: Appointment[], patientMap: Record<string, PatientInfo>) => {
                console.log('Processing appointments data:', appointmentsData);
                
                if (appointmentsData.length === 0) {
                    console.log('No appointments found for doctor');
                    setUpcomingAppointments([]);
                    setPastAppointments([]);
                    setIsLoading(false);
                    return;
                }

                try {
                    // Add patient names to appointments
                    const updatedAppointments = appointmentsData.map(appt => {
                        const patientInfo = patientMap[appt.patientId];
                        return {
                            ...appt,
                            patientName: patientInfo ? 
                                (patientInfo.fullName || patientInfo.name || "Unknown Patient") : 
                                (appt.patientName || `Patient (${appt.patientId.slice(0, 5)}...)`)
                        };
                    });

                    const todayDate = new Date().setHours(0, 0, 0, 0);

                    // Split into upcoming and past appointments
                    const upcoming = updatedAppointments.filter(
                        appt => new Date(appt.date).getTime() >= todayDate
                    ).sort((a, b) => {
                        if (a.date !== b.date) {
                            return new Date(a.date).getTime() - new Date(b.date).getTime();
                        }
                        return a.time.localeCompare(b.time);
                    });

                    const past = updatedAppointments.filter(
                        appt => new Date(appt.date).getTime() < todayDate
                    ).sort((a, b) => {
                        if (a.date !== b.date) {
                            return new Date(b.date).getTime() - new Date(a.date).getTime();
                        }
                        return b.time.localeCompare(a.time);
                    });

                    console.log(`Loaded ${upcoming.length} upcoming and ${past.length} past appointments for doctor`);
                    setUpcomingAppointments(upcoming);
                    setPastAppointments(past);
                    
                    // Set filtered appointments as well
                    setFilteredUpcomingAppointments(upcoming);
                    setFilteredPastAppointments(past);
                    
                } catch (error) {
                    console.error("Error processing appointment details:", error);
                    toast({
                        title: "Error",
                        description: "Could not process appointment information",
                        variant: "destructive",
                    });
                } finally {
                    setIsLoading(false);
                }

                // Set up a listener for real-time updates
                try {
                    // Listen to the appointments collection for any changes
                    const appointmentsRef = collection(db, "appointments");
                    const unsubscribe = onSnapshot(appointmentsRef, (snapshot) => {
                        console.log("Received real-time appointment update");
                        if (!snapshot.empty) {
                            // Only refetch if it affects this doctor's appointments
                            let affectsCurrentDoctor = false;
                            snapshot.docChanges().forEach(change => {
                                const data = change.doc.data();
                                if (data.doctorId === loggedInDoctorId) {
                                    affectsCurrentDoctor = true;
                                }
                            });
                            
                            if (affectsCurrentDoctor) {
                                fetchAppointments();
                            }
                        }
                    });
                    
                    return unsubscribe;
                } catch (error) {
                    console.error("Error setting up appointments listener:", error);
                }
            };
            
            // Fetch waitlist requests
            const fetchWaitlistRequests = async () => {
                try {
                    const waitlistRef = collection(db, "waitlists");
                    const waitlistQuery = query(
                        waitlistRef,
                        where("doctorId", "==", loggedInDoctorId)
                    );
                    
                    const waitlistSnapshot = await getDocs(waitlistQuery);
                    const waitlistData: WaitlistItem[] = [];
                    
                    waitlistSnapshot.forEach(doc => {
                        waitlistData.push({ id: doc.id, ...doc.data() } as WaitlistItem);
                    });
                    
                    // Get patient names for waitlist items
                    if (waitlistData.length > 0) {
                        const patientIds = [...new Set(waitlistData.map(item => item.patientId))];
                        const patientMap: Record<string, string> = {};
                        
                        try {
                            const usersData = await getDocuments("users", [
                                queryConstraints.whereIn("__name__", patientIds)
                            ]);
                            
                            usersData.forEach(user => {
                                patientMap[user.id] = user?.fullName || user?.name || "Unknown Patient";
                            });
                            
                            const missingPatientIds = patientIds.filter(id => !patientMap[id]);
                            if (missingPatientIds.length > 0) {
                                const patientsData = await getDocuments("patients", [
                                    queryConstraints.whereIn("__name__", missingPatientIds)
                                ]);
                                patientsData.forEach(patient => {
                                    patientMap[patient.id] = patient?.name || "Unknown Patient";
                                });
                            }
                            
                            // Add patient names to waitlist items
                            waitlistData.forEach(item => {
                                item.patientName = patientMap[item.patientId] || `Patient (${item.patientId.slice(0, 5)}...)`;
                            });
                        } catch (error) {
                            console.error("Error fetching patient details for waitlist:", error);
                        }
                    }
                    
                    setWaitlistRequests(waitlistData);
                    setFilteredWaitlistRequests(waitlistData);
                } catch (error) {
                    console.error("Error fetching waitlist requests:", error);
                }
            };
            
            fetchAppointments();
            fetchWaitlistRequests();
        }
    }, [loggedInDoctorId]);

    // Filter appointments based on search and filter type
    useEffect(() => {
        const filterBySearch = (appointments: Appointment[]) => {
            if (!searchQuery) return appointments;
            return appointments.filter(appointment =>
                appointment.patientName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        };

        const filterByType = (appointments: Appointment[]) => {
            if (filterType === 'all') return appointments;
            return appointments.filter(appointment => {
                if (filterType === 'emergency') return appointment.status === 'emergency';
                if (filterType === 'regular') return appointment.type === 'regular' || !appointment.type;
                if (filterType === 'followup') return appointment.type === 'followup';
                return true;
            });
        };

        const filteredUpcoming = filterByType(filterBySearch(upcomingAppointments));
        const filteredPast = filterByType(filterBySearch(pastAppointments));
        
        // Filter waitlist requests
        const filteredWaitlist = searchQuery 
            ? waitlistRequests.filter(req => 
                req.patientName?.toLowerCase().includes(searchQuery.toLowerCase()))
            : waitlistRequests;

        setFilteredUpcomingAppointments(filteredUpcoming);
        setFilteredPastAppointments(filteredPast);
        setFilteredWaitlistRequests(filteredWaitlist);
    }, [upcomingAppointments, pastAppointments, waitlistRequests, searchQuery, filterType]);

    const handleAddNotes = (id: string) => {
        setSelectedAppointmentId(id);
        const appointment = pastAppointments.find(appt => appt.id === id);
        setNoteText(appointment?.notes || "");
    };

    const handleSaveNotes = async () => {
        if (loggedInDoctorId && selectedAppointmentId) {
            try {
                await updateDoc(doc(db, "appointments", loggedInDoctorId, "appointments", selectedAppointmentId), { notes: noteText });

                setPastAppointments(pastAppointments.map(appt =>
                    appt.id === selectedAppointmentId ? { ...appt, notes: noteText } : appt
                ));

                const appointment = pastAppointments.find(appt => appt.id === selectedAppointmentId);
                if (appointment && appointment.patientId) {
                    try {
                        const medicalNotesRef = collection(db, "medicalNotes");
                        const doctorInfo = await getDoc(doc(db, "users", loggedInDoctorId));
                        const doctorData = doctorInfo.data();

                        const doctorSpecialty = doctorData?.specialty || "General Practice";
                        const doctorName = doctorData?.fullName || auth.currentUser?.displayName || "Doctor";

                        const newNote = {
                            patientId: appointment.patientId,
                            doctorId: loggedInDoctorId,
                            doctorName: doctorName,
                            specialty: doctorSpecialty,
                            appointmentId: selectedAppointmentId,
                            title: `Visit Notes - ${new Date(appointment.date).toLocaleDateString()}`,
                            date: new Date(appointment.date).toLocaleDateString(),
                            createdAt: new Date().toISOString(),
                            summary: noteText.length > 100 ? `${noteText.substring(0, 100)}...` : noteText,
                            fullNote: noteText
                        };

                        await addDoc(collection(db, "medicalNotes"), newNote);
                    } catch (error) {
                        console.error("Error creating medical note:", error);
                    }
                }

                setSelectedAppointmentId(null);
                setNoteText("");

                toast({
                    title: "Notes Saved",
                    description: "The notes have been saved successfully.",
                });
            } catch (error) {
                console.error("Error saving notes:", error);
                toast({
                    title: "Error",
                    description: "Failed to save notes. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleCancelAppointment = async (id: string) => {
        if (loggedInDoctorId) {
            try {
                // Delete the appointment from Firestore
                const appointmentRef = doc(db, "appointments", loggedInDoctorId, "appointments", id);
                await deleteDoc(appointmentRef);
                
                // Remove from local state to update UI immediately
                setUpcomingAppointments(upcomingAppointments.filter(appt => appt.id !== id));
                setFilteredUpcomingAppointments(filteredUpcomingAppointments.filter(appt => appt.id !== id));
                
                toast({
                    title: "Appointment Cancelled",
                    description: "The appointment has been cancelled and removed successfully.",
                });
            } catch (error) {
                console.error("Error cancelling appointment:", error);
                toast({
                    title: "Error",
                    description: "Failed to cancel appointment. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleViewNotes = (id: string) => {
        const appointment = [...upcomingAppointments, ...pastAppointments].find(appt => appt.id === id);
        if (appointment?.notes) {
            toast({
                title: "Appointment Notes",
                description: appointment.notes,
            });
        } else {
            toast({
                title: "No Notes",
                description: "No notes are available for this appointment.",
            });
        }
    };

    const handleFilterChange = (value: string) => {
        setFilterType(value);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleAcceptWaitlist = async (waitlistId: string) => {
        try {
            const waitlistItem = waitlistRequests.find(item => item.id === waitlistId);
            if (!waitlistItem || !loggedInDoctorId) return;
            
            // Navigate to book appointment with selected patient
            navigate(`/doctor/book-appointment/${waitlistItem.patientId}`);
        } catch (error) {
            console.error("Error handling waitlist request:", error);
            toast({
                title: "Error",
                description: "Failed to process waitlist request.",
                variant: "destructive" 
            });
        }
    };
    
    const handleDeclineWaitlist = async (waitlistId: string) => {
        try {
            await deleteDoc(doc(db, "waitlists", waitlistId));
            
            setWaitlistRequests(waitlistRequests.filter(item => item.id !== waitlistId));
            setFilteredWaitlistRequests(filteredWaitlistRequests.filter(item => item.id !== waitlistId));
            
            toast({
                title: "Request Declined",
                description: "Waitlist request has been declined."
            });
        } catch (error) {
            console.error("Error declining waitlist request:", error);
            toast({
                title: "Error",
                description: "Failed to decline waitlist request.",
                variant: "destructive"
            });
        }
    };

    const handlePastAppointmentAddNotes = (appointment: Appointment) => {
        return () => {
            setSelectedAppointmentId(appointment.id);
            setNoteText(appointment.notes || "");
        };
    };

    const handleViewPatient = (patientId: string) => {
        navigate(`/doctor/patients/medical-records/${patientId}`);
    };

    const handleApproveAppointment = async (id: string) => {
        if (!loggedInDoctorId) return;
        
        try {
            await updateDoc(doc(db, "appointments", loggedInDoctorId, "appointments", id), {
                status: "confirmed",
                updatedAt: new Date()
            });
            
            // Update local state
            setUpcomingAppointments(upcomingAppointments.map(app => 
                app.id === id ? { ...app, status: "confirmed" } : app
            ));
            
            setFilteredUpcomingAppointments(filteredUpcomingAppointments.map(app => 
                app.id === id ? { ...app, status: "confirmed" } : app
            ));
            
            toast({
                title: "Appointment Approved",
                description: "The appointment has been confirmed."
            });
        } catch (error) {
            console.error("Error approving appointment:", error);
            toast({
                title: "Error",
                description: "Failed to approve appointment. Please try again.",
                variant: "destructive"
            });
        }
    };

    return (
        <Layout userRole="doctor">
            <div className="space-y-6">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">Manage Appointments</h1>
                    <p className="text-muted-foreground">
                        View and manage your scheduled appointments with patients.
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Tabs defaultValue="upcoming" onValueChange={setActiveTab} className="w-full sm:w-auto">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
                            <TabsTrigger value="past">Past</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select defaultValue="all" onValueChange={handleFilterChange}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Appointments</SelectItem>
                                <SelectItem value="regular">Regular Checkups</SelectItem>
                                <SelectItem value="emergency">Emergency</SelectItem>
                                <SelectItem value="followup">Follow-ups</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search patients..."
                                className="pl-8 h-10"
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
                        <span className="ml-3 text-lg">Loading appointments...</span>
                    </div>
                ) : (
                    <Tabs value={activeTab} className="w-full">
                        <TabsContent value="upcoming" className="space-y-4 mt-0">
                            {filteredUpcomingAppointments.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No upcoming appointments scheduled.</p>
                                    <Button 
                                        className="mt-4 bg-health-primary hover:bg-health-secondary"
                                        onClick={() => navigate("/doctor/book-appointment")}
                                    >
                                        <Calendar className="h-4 w-4 mr-2" />
                                        Book New Appointment
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {filteredUpcomingAppointments.map((appointment) => (
                                        <AppointmentCard
                                            key={appointment.id}
                                            appointment={appointment}
                                            userRole="doctor"
                                            onCancelAppointment={() => handleCancelAppointment(appointment.id)}
                                            onViewPatient={() => handleViewPatient(appointment.patientId)}
                                            // Custom actions for pending appointments
                                            customActions={appointment.status === "pending" ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleApproveAppointment(appointment.id);
                                                    }}
                                                >
                                                    Approve
                                                </Button>
                                            ) : null}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                        
                        <TabsContent value="waitlist" className="space-y-4 mt-0">
                            {filteredWaitlistRequests.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No waitlist requests pending.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {filteredWaitlistRequests.map((request) => (
                                        <Card key={request.id} className={
                                            request.urgency === "emergency" ? "border-l-4 border-l-red-500" :
                                            request.urgency === "urgent" ? "border-l-4 border-l-yellow-500" : ""
                                        }>
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <CardTitle className="text-lg">{request.patientName}</CardTitle>
                                                        <p className="text-sm text-muted-foreground">
                                                            Requested on {new Date(request.requestDate).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Badge className={
                                                            request.urgency === "emergency" ? "bg-red-100 text-red-800" :
                                                            request.urgency === "urgent" ? "bg-yellow-100 text-yellow-800" :
                                                            "bg-blue-100 text-blue-800"
                                                        }>
                                                            {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm mb-4">Specialty: {request.specialty}</p>
                                                <div className="flex gap-2 justify-end">
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                                        onClick={() => handleDeclineWaitlist(request.id)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Decline
                                                    </Button>
                                                    <Button 
                                                        size="sm"
                                                        className="gap-1 bg-health-primary hover:bg-health-secondary"
                                                        onClick={() => handleAcceptWaitlist(request.id)}
                                                    >
                                                        <Calendar className="h-4 w-4" />
                                                        Schedule
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="past" className="space-y-4 mt-0">
                            {filteredPastAppointments.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No past appointments found.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {filteredPastAppointments.map((appointment) => (
                                        <AppointmentCard
                                            key={appointment.id}
                                            appointment={appointment}
                                            userRole="doctor"
                                            onViewNotes={appointment.notes ? () => handleViewNotes(appointment.id) : undefined}
                                            onAddNotes={handlePastAppointmentAddNotes(appointment)}
                                            onViewPatient={() => handleViewPatient(appointment.patientId)}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>

            {/* Add Notes Dialog */}
            <Dialog open={selectedAppointmentId !== null} onOpenChange={(open) => !open && setSelectedAppointmentId(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add/Edit Medical Notes</DialogTitle>
                        <DialogDescription>
                            Record or update notes for the patient's medical record.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="Enter detailed notes about the appointment..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="min-h-[150px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAppointmentId(null)}>
                            Cancel
                        </Button>
                        <Button className="bg-health-primary hover:bg-health-secondary" onClick={handleSaveNotes}>
                            Save Notes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
};

export default DoctorAppointments;