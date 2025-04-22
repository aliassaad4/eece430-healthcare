// DoctorDashboard.tsx
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import AppointmentCalendar, { CalendarAppointment } from "@/components/appointments/AppointmentCalendar";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    Calendar,
    Clock,
    Users,
    Loader2,
    User
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { auth } from "@/config/firebase";
import { 
    getDocument, 
    getDocuments, 
    updateDocument, 
    createDocument,
    queryConstraints
} from "@/services/firebase/firestore.service";
import {
    subscribeToAppointments,
    fetchWithoutIndex
} from "@/services/firebase/query-utils";
import { doc, getDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";

interface Appointment {
    id: string;
    doctorId: string;
    patientId: string;
    date: string;
    time: string;
    specialty: string;
    status: "scheduled" | "completed" | "cancelled" | "upcoming" | "emergency";
    notes?: string;
    patientName?: string;
    doctorName: string;
}

interface EmergencyRequest {
    id: string;
    doctorId: string;
    patientId: string;
    patientName: string;
    reason: string;
    requestTime: string;
    status: "pending" | "approved" | "rejected";
}

interface ScheduleSlot {
    id: string;
    doctorId: string;
    day: string;
    startTime?: string;
    endTime?: string;
    time?: string;
    isAvailable: boolean;
    isBlocked: boolean;
}

interface PatientData {
    id: string;
    fullName?: string;
    name?: string;
    email?: string;
    role?: string;
    medicalConditions?: string[];
    dateOfBirth?: string;
    phone?: string;
    phoneNumber?: string;
}

const DoctorDashboard = () => {
    const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
    const [allAppointments, setAllAppointments] = useState<CalendarAppointment[]>([]);
    const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);
    const [doctorName, setDoctorName] = useState<string>("Doctor");
    const [doctorSpecialty, setDoctorSpecialty] = useState<string>("General Practice");
    const [availableSlots, setAvailableSlots] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [selectedEmergencyRequest, setSelectedEmergencyRequest] = useState<EmergencyRequest | null>(null);
    const [noteText, setNoteText] = useState<string>("");
    const [patientInfo, setPatientInfo] = useState<PatientData | null>(null);
    const [showPatientInfo, setShowPatientInfo] = useState<boolean>(false);
    
    const loggedInDoctorId = auth.currentUser?.uid;
    const today = new Date().toLocaleDateString();
    const navigate = useNavigate();

    // Fetch doctor's name and specialty
    useEffect(() => {
        if (loggedInDoctorId) {
            const fetchDoctorInfo = async () => {
                try {
                    const userDocRef = doc(db, 'users', loggedInDoctorId);
                    const userDoc = await getDoc(userDocRef);
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData?.fullName) {
                            setDoctorName(userData.fullName);
                        } else {
                            const currentUser = auth.currentUser;
                            if (currentUser?.displayName) {
                                setDoctorName(currentUser.displayName);
                            }
                        }
                        
                        if (userData?.specialty) {
                            setDoctorSpecialty(userData.specialty);
                        }
                    } else {
                        const doctorDocRef = doc(db, 'doctors', loggedInDoctorId);
                        const doctorDoc = await getDoc(doctorDocRef);
                        if (doctorDoc.exists()) {
                            const doctorData = doctorDoc.data();
                            if (doctorData?.name || doctorData?.fullName) {
                                setDoctorName(doctorData?.fullName || doctorData?.name);
                            }
                            if (doctorData?.specialty) {
                                setDoctorSpecialty(doctorData.specialty);
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error fetching doctor info:", error);
                }
            };
            
            fetchDoctorInfo();
        }
    }, [loggedInDoctorId]);

    // Fetch available slots with index-free query
    useEffect(() => {
        if (loggedInDoctorId) {
            setIsLoading(true);
            const fetchAvailableSlots = async () => {
                try {
                    const slotsData = await fetchWithoutIndex<ScheduleSlot>(
                        "scheduleSlots",
                        { field: "doctorId", value: loggedInDoctorId },
                        [
                            { field: "day", operator: "==", value: today },
                            { field: "isAvailable", operator: "==", value: true },
                            { field: "isBlocked", operator: "==", value: false }
                        ]
                    );
                    setAvailableSlots(slotsData.length);
                    setIsLoading(false);
                } catch (error) {
                    console.error("Error fetching available slots:", error);
                    setAvailableSlots(0);
                    setIsLoading(false);
                }
            };
            
            fetchAvailableSlots();
            
            const intervalId = setInterval(fetchAvailableSlots, 30000);
            
            return () => clearInterval(intervalId);
        }
    }, [loggedInDoctorId, today]);

    // Fetch all appointments for the calendar
    useEffect(() => {
        if (loggedInDoctorId) {
            const fetchAllAppointments = async () => {
                try {
                    console.log('Fetching appointments for doctor:', loggedInDoctorId);
                    setIsLoading(true);
                    
                    // Try multiple collection paths to find appointments
                    let appointmentsRef: any[] = [];
                    
                    // Method 1: Direct appointments collection
                    try {
                        const directAppointments = await getDocuments("appointments", [
                            queryConstraints.where("doctorId", "==", loggedInDoctorId)
                        ]);
                        console.log('Direct appointments query result:', directAppointments.length);
                        appointmentsRef = [...appointmentsRef, ...directAppointments];
                    } catch (error) {
                        console.log('Direct appointments query failed, trying alternative methods');
                    }
                    
                    // Method 2: Nested collection
                    try {
                        const appointmentsCollectionRef = collection(db, "appointments", loggedInDoctorId, "appointments");
                        const appointmentsSnapshot = await getDocs(appointmentsCollectionRef);
                        
                        const nestedAppointments: any[] = [];
                        appointmentsSnapshot.forEach((doc) => {
                            nestedAppointments.push({ id: doc.id, ...doc.data() });
                        });
                        
                        console.log('Nested appointments query result:', nestedAppointments.length);
                        appointmentsRef = [...appointmentsRef, ...nestedAppointments];
                    } catch (error) {
                        console.log('Nested appointments query failed');
                    }
                    
                    // Method 3: Use fetchWithoutIndex utility function
                    try {
                        const indexFreeAppointments = await fetchWithoutIndex(
                            "appointments",
                            { field: "doctorId", value: loggedInDoctorId },
                            [] // No additional filters
                        );
                        console.log('Index-free appointments query result:', indexFreeAppointments.length);
                        appointmentsRef = [...appointmentsRef, ...indexFreeAppointments];
                    } catch (error) {
                        console.log('Index-free appointments query failed');
                    }
                    
                    // Remove any duplicates by ID
                    const uniqueAppointments = Array.from(
                        new Map(appointmentsRef.map(item => [item.id, item])).values()
                    );
                    
                    console.log('Total unique appointments found:', uniqueAppointments.length);
                    
                    if (uniqueAppointments.length === 0) {
                        console.log('No appointments found for doctor');
                        setAllAppointments([]);
                        setIsLoading(false);
                        return;
                    }
                    
                    // Get patient information to display patient names
                    const patientIds = [...new Set(uniqueAppointments.map(appt => appt.patientId))];
                    
                    const patientMap: Record<string, string> = {};
                    try {
                        // Try to get patient information from users collection
                        const usersData = await getDocuments("users", [
                            queryConstraints.whereIn("__name__", patientIds.slice(0, 10))  // Firestore limits to 10 items in whereIn
                        ]);
                        
                        usersData.forEach(user => {
                            patientMap[user.id] = user?.fullName || user?.name || "Unknown Patient";
                        });
                        
                        // Process any remaining patients in batches of 10
                        const remainingIds = patientIds.slice(10);
                        for (let i = 0; i < remainingIds.length; i += 10) {
                            const batchIds = remainingIds.slice(i, i + 10);
                            if (batchIds.length > 0) {
                                const batchUsers = await getDocuments("users", [
                                    queryConstraints.whereIn("__name__", batchIds)
                                ]);
                                batchUsers.forEach(user => {
                                    patientMap[user.id] = user?.fullName || user?.name || "Unknown Patient";
                                });
                            }
                        }
                        
                        // Check for any missing patients in patients collection
                        const missingPatientIds = patientIds.filter(id => !patientMap[id]);
                        
                        // Process missing patients in batches
                        for (let i = 0; i < missingPatientIds.length; i += 10) {
                            const batchIds = missingPatientIds.slice(i, i + 10);
                            if (batchIds.length > 0) {
                                const patientsData = await getDocuments("patients", [
                                    queryConstraints.whereIn("__name__", batchIds)
                                ]);
                                patientsData.forEach(patient => {
                                    patientMap[patient.id] = patient?.name || "Unknown Patient";
                                });
                            }
                        }
                    } catch (error) {
                        console.error("Error fetching patient details:", error);
                    }
                    
                    // Map calendar appointments with patient names
                    const calendarAppointments = uniqueAppointments.map(appt => ({
                        ...appt,
                        patientName: patientMap[appt.patientId] || appt.patientName || `Patient (${appt.patientId?.slice(0,5)}...)`,
                        doctorName: doctorName || appt.doctorName,
                    }));
                    
                    console.log(`Fetched ${calendarAppointments.length} appointments for Dr. ${doctorName}:`, calendarAppointments);
                    setAllAppointments(calendarAppointments);
                    setIsLoading(false);
                    
                } catch (error) {
                    console.error("Error fetching all appointments:", error);
                    toast({
                        title: "Error",
                        description: "Failed to load your appointments. Please try again.",
                        variant: "destructive",
                    });
                    setIsLoading(false);
                }
            };
            
            fetchAllAppointments();
            const refreshInterval = setInterval(fetchAllAppointments, 60000); // Refresh every minute
            
            return () => clearInterval(refreshInterval);
        }
    }, [loggedInDoctorId, doctorName]);

    // Fetch today's appointments and emergency requests
    useEffect(() => {
        let unsubscribeAppointments: (() => void) | undefined;
        
        if (loggedInDoctorId) {
            unsubscribeAppointments = subscribeToAppointments<Omit<Appointment, 'patientName' | 'doctorName'>>(
                loggedInDoctorId,
                'doctor',
                today,
                'asc',
                async (appointmentsData) => {
                    if (appointmentsData.length === 0) {
                        setTodayAppointments([]);
                        return;
                    }

                    const patientIds = [...new Set(appointmentsData.map(appt => appt.patientId))];
                    const doctorIds = [...new Set(appointmentsData.map(appt => appt.doctorId))];

                    const uniquePatientIds = [...new Set(patientIds)];
                    const uniqueDoctorIds = [...new Set(doctorIds)];

                    const patientMap: Record<string, string> = {};
                    const doctorMap: Record<string, string> = {};
                    
                    try {
                        const usersData = await getDocuments("users", [
                            queryConstraints.whereIn("__name__", [...uniquePatientIds, ...uniqueDoctorIds])
                        ]);
                        
                        usersData.forEach(user => {
                            const userId = user.id;
                            
                            if (uniquePatientIds.includes(userId)) {
                                patientMap[userId] = user?.fullName || user?.name || "Unknown Patient";
                            }
                            
                            if (uniqueDoctorIds.includes(userId)) {
                                doctorMap[userId] = user?.fullName || user?.name || "Unknown Doctor";
                            }
                        });
                    } catch (error) {
                        console.error("Error fetching users data:", error);
                    }
                    
                    const missingPatientIds = uniquePatientIds.filter(id => !patientMap[id]);
                    if (missingPatientIds.length > 0) {
                        try {
                            const patientsData = await getDocuments("patients", [
                                queryConstraints.whereIn("__name__", missingPatientIds)
                            ]);
                            patientsData.forEach(patient => {
                                patientMap[patient.id] = patient?.name || "Unknown Patient";
                            });
                        } catch (error) {
                            console.error("Error fetching patients data:", error);
                        }
                    }
                    
                    const missingDoctorIds = uniqueDoctorIds.filter(id => !doctorMap[id]);
                    if (missingDoctorIds.length > 0) {
                        try {
                            const doctorsData = await getDocuments("doctors", [
                                queryConstraints.whereIn("__name__", missingDoctorIds)
                            ]);
                            doctorsData.forEach(doctor => {
                                doctorMap[doctor.id] = doctor?.name || "Unknown Doctor";
                            });
                        } catch (error) {
                            console.error("Error fetching doctors data:", error);
                        }
                    }

                    const updatedAppointmentsData: Appointment[] = appointmentsData.map(appt => ({
                        id: appt.id,
                        doctorId: appt.doctorId,
                        patientId: appt.patientId,
                        date: appt.date,
                        time: appt.time,
                        specialty: appt.specialty,
                        status: appt.status as "scheduled" | "completed" | "cancelled" | "upcoming" | "emergency",
                        notes: appt.notes,
                        patientName: patientMap[appt.patientId] || `Patient (${appt.patientId.slice(0,5)}...)`,
                        doctorName: doctorMap[appt.doctorId] || `Doctor (${appt.doctorId.slice(0,5)}...)`,
                    }));

                    setTodayAppointments(updatedAppointmentsData);
                }
            );
            
            const fetchEmergencyRequests = async () => {
                try {
                    const emergencyData = await fetchWithoutIndex<EmergencyRequest>(
                        "emergencyRequests",
                        { field: "doctorId", value: loggedInDoctorId },
                        [{ field: "status", operator: "==", value: "pending" }]
                    );
                    setEmergencyRequests(emergencyData);
                } catch (error) {
                    console.error("Error fetching emergency requests:", error);
                }
            };
            
            fetchEmergencyRequests();
            const emergencyInterval = setInterval(fetchEmergencyRequests, 15000);
            
            return () => {
                if (unsubscribeAppointments) unsubscribeAppointments();
                clearInterval(emergencyInterval);
            };
        }
        
        return () => {
            if (unsubscribeAppointments) unsubscribeAppointments();
        };
    }, [loggedInDoctorId, today]);

    useEffect(() => {
        if (selectedEmergencyRequest) {
            const fetchPatientInfo = async () => {
                try {
                    const userDocRef = doc(db, 'users', selectedEmergencyRequest.patientId);
                    const userDoc = await getDoc(userDocRef);
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setPatientInfo({
                            id: selectedEmergencyRequest.patientId,
                            fullName: userData.fullName || userData.name || selectedEmergencyRequest.patientName,
                            email: userData.email || "No email provided",
                            role: userData.role || "patient",
                            medicalConditions: userData.medicalConditions || [],
                            dateOfBirth: userData.dateOfBirth || userData.dob || "Not specified",
                            phone: userData.phoneNumber || userData.phone || "Not specified"
                        });
                    } else {
                        const patientDocRef = doc(db, 'patients', selectedEmergencyRequest.patientId);
                        const patientDoc = await getDoc(patientDocRef);
                        
                        if (patientDoc.exists()) {
                            const patientData = patientDoc.data();
                            setPatientInfo({
                                id: selectedEmergencyRequest.patientId,
                                name: patientData.name || selectedEmergencyRequest.patientName,
                                email: patientData.email || "No email provided",
                                medicalConditions: patientData.medicalConditions || [],
                                phone: patientData.phoneNumber || patientData.phone || "Not specified"
                            });
                        } else {
                            setPatientInfo({
                                id: selectedEmergencyRequest.patientId,
                                name: selectedEmergencyRequest.patientName,
                                email: "No email provided",
                                medicalConditions: []
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error fetching patient information:", error);
                    setPatientInfo({
                        id: selectedEmergencyRequest.patientId,
                        name: selectedEmergencyRequest.patientName,
                        email: "No email provided",
                        medicalConditions: []
                    });
                }
            };
            
            fetchPatientInfo();
        }
    }, [selectedEmergencyRequest]);

    const handleAddNotes = async (appointmentId: string, notes: string) => {
        if (loggedInDoctorId) {
            try {
                await updateDocument("appointments", appointmentId, { notes });
                
                const appointment = allAppointments.find(appt => appt.id === appointmentId);
                
                if (appointment && appointment.patientId) {
                    const newNote = {
                        patientId: appointment.patientId,
                        doctorId: loggedInDoctorId,
                        doctorName: doctorName,
                        specialty: doctorSpecialty,
                        appointmentId: appointmentId,
                        title: `Visit Notes - ${new Date(appointment.date).toLocaleDateString()}`,
                        date: new Date(appointment.date).toLocaleDateString(),
                        createdAt: new Date().toISOString(),
                        summary: notes.length > 100 ? `${notes.substring(0, 100)}...` : notes,
                        fullNote: notes
                    };
                    
                    await addDoc(collection(db, "medicalNotes"), newNote);
                    
                    toast({
                        title: "Notes Saved",
                        description: "Medical notes have been saved successfully.",
                    });
                }
            } catch (error) {
                console.error("Error adding notes:", error);
                toast({
                    title: "Error",
                    description: "Failed to save medical notes. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    const openEmergencyDialog = (request: EmergencyRequest) => {
        setSelectedEmergencyRequest(request);
    };

    const handleApproveEmergency = async (requestId: string) => {
        if (loggedInDoctorId) {
            try {
                const emergencyData = await getDocument<EmergencyRequest>("emergencyRequests", requestId);
                if (emergencyData) {
                    await updateDocument("emergencyRequests", requestId, { status: "approved" });
                    
                    const newAppointment: Omit<Appointment, 'id' | 'patientName'> = {
                        doctorId: loggedInDoctorId,
                        patientId: emergencyData.patientId,
                        date: today,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        specialty: emergencyData.reason,
                        status: "emergency",
                        doctorName: doctorName,
                    };
                    
                    await createDocument("appointments", newAppointment);
                    
                    setEmergencyRequests(prevRequests => 
                        prevRequests.filter(req => req.id !== requestId)
                    );
                    
                    setSelectedEmergencyRequest(null);
                    
                    toast({
                        title: "Emergency Approved",
                        description: "Emergency request has been approved and an appointment created.",
                    });
                }
            } catch (error) {
                console.error("Error approving emergency request:", error);
                toast({
                    title: "Error",
                    description: "Failed to approve emergency request. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleRejectEmergency = async (requestId: string) => {
        if (loggedInDoctorId) {
            try {
                await updateDocument("emergencyRequests", requestId, { status: "rejected" });
                
                setEmergencyRequests(prevRequests => 
                    prevRequests.filter(req => req.id !== requestId)
                );
                
                setSelectedEmergencyRequest(null);
                
                toast({
                    title: "Emergency Rejected",
                    description: "Emergency request has been rejected.",
                });
            } catch (error) {
                console.error("Error rejecting emergency request:", error);
                toast({
                    title: "Error",
                    description: "Failed to reject emergency request. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    return (
        <Layout userRole="doctor">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Welcome, Dr. {doctorName}</h1>
                        <p className="text-gray-500">Here's your appointment schedule</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline"
                            className="gap-2"
                            onClick={() => navigate("/doctor/book-appointment")}
                        >
                            <Calendar className="h-4 w-4 mr-2" />
                            Book New Appointment
                        </Button>
                        <Button 
                            className="gap-2 bg-health-primary hover:bg-health-secondary"
                            onClick={() => navigate("/doctor/appointments")}
                        >
                            <Calendar className="h-4 w-4" />
                            Appointments
                        </Button>
                        <Button 
                            variant="outline"
                            className="gap-2"
                            onClick={() => navigate("/doctor/doctors")}
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Doctors
                        </Button>
                        <Button 
                            variant="outline"
                            className="gap-2"
                            onClick={() => navigate("/admin")}
                        >
                            <User className="h-4 w-4 mr-2" />
                            Admin Panel
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
                        <span className="ml-3 text-lg">Loading dashboard data...</span>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <StatsCard
                                title="Today's Appointments"
                                value={todayAppointments.length}
                                icon={<Calendar className="h-4 w-4" />}
                                description="Scheduled for today"
                                trend={{
                                    value: Math.max(0, Math.round((todayAppointments.length / Math.max(availableSlots + todayAppointments.length, 1)) * 100)),
                                    isPositive: true
                                }}
                            />
                            <StatsCard
                                title="Emergency Requests"
                                value={emergencyRequests.length}
                                icon={<AlertTriangle className="h-4 w-4" />}
                                description="Pending urgent cases"
                                className={emergencyRequests.length > 0 ? "border-health-error" : ""}
                                trend={emergencyRequests.length > 0 ? {
                                    value: emergencyRequests.length,
                                    isPositive: false
                                } : undefined}
                            />
                            <StatsCard
                                title="Patients Seen Today"
                                value={todayAppointments.filter(appt => appt.status === 'completed').length}
                                icon={<Users className="h-4 w-4" />}
                                description="Completed consultations"
                                trend={{
                                    value: Math.round((todayAppointments.filter(appt => appt.status === 'completed').length / Math.max(todayAppointments.length, 1)) * 100),
                                    isPositive: true
                                }}
                            />
                            <StatsCard
                                title="Available Slots"
                                value={availableSlots}
                                icon={<Clock className="h-4 w-4" />}
                                description={`${availableSlots === 0 ? 'Fully booked today' : 'Open for bookings'}`}
                                trend={{
                                    value: Math.round((availableSlots / Math.max(availableSlots + todayAppointments.length, 1)) * 100),
                                    isPositive: availableSlots > 0
                                }}
                            />
                        </div>

                        {emergencyRequests.length > 0 && (
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Emergency Requests</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {emergencyRequests.map((request) => (
                                        <Card key={request.id} className="border-l-4 border-l-health-error">
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-lg">{request.patientName}</CardTitle>
                                                    <Badge className="bg-health-error text-white">
                                                        Emergency
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pb-4">
                                                <div className="mb-3">
                                                    <p className="text-sm text-gray-500">Reason:</p>
                                                    <p className="font-medium">{request.reason}</p>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    Requested {request.requestTime}
                                                </div>
                                                <div className="mt-4 flex gap-2">
                                                    <Button
                                                        className="bg-health-primary hover:bg-health-secondary"
                                                        size="sm"
                                                        onClick={() => openEmergencyDialog(request)}
                                                    >
                                                        View Details
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedEmergencyRequest && (
                            <Dialog 
                                open={!!selectedEmergencyRequest} 
                                onOpenChange={(open) => !open && setSelectedEmergencyRequest(null)}
                            >
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Emergency Request</DialogTitle>
                                        <DialogDescription>
                                            Review patient details and respond to this emergency request.
                                        </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="grid gap-4 py-4">
                                        <h3 className="font-bold text-lg">
                                            Patient: {patientInfo?.fullName || patientInfo?.name || selectedEmergencyRequest.patientName}
                                        </h3>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-sm text-gray-500">Email:</p>
                                                <p>{patientInfo?.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Phone:</p>
                                                <p>{patientInfo?.phone || patientInfo?.phoneNumber || "Not available"}</p>
                                            </div>
                                        </div>
                                        
                                        {patientInfo?.medicalConditions && patientInfo.medicalConditions.length > 0 && (
                                            <div>
                                                <p className="text-sm text-gray-500">Medical Conditions:</p>
                                                <ul className="list-disc pl-4">
                                                    {patientInfo.medicalConditions.map((condition, idx) => (
                                                        <li key={idx}>{condition}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        <div>
                                            <p className="text-sm text-gray-500">Emergency Reason:</p>
                                            <p className="font-semibold">{selectedEmergencyRequest.reason}</p>
                                        </div>
                                    </div>
                                    
                                    <DialogFooter className="flex justify-between">
                                        <Button 
                                            variant="outline"
                                            onClick={() => handleRejectEmergency(selectedEmergencyRequest.id)}
                                        >
                                            Reject
                                        </Button>
                                        <Button 
                                            className="bg-health-primary hover:bg-health-secondary"
                                            onClick={() => handleApproveEmergency(selectedEmergencyRequest.id)}
                                        >
                                            Approve Emergency
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        <div>
                            <h2 className="text-xl font-semibold mb-4">Appointment Schedule</h2>
                            <AppointmentCalendar 
                                appointments={allAppointments}
                                userRole="doctor"
                                onAddNotes={handleAddNotes}
                                onViewAppointment={(appointmentId) => navigate(`/doctor/appointment-details/${appointmentId}`)}
                            />
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

export default DoctorDashboard;