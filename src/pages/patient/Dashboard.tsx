import { Layout } from "@/components/layout/Layout";
import AppointmentCalendar, { CalendarAppointment } from "@/components/appointments/AppointmentCalendar";
import { DoctorCard } from "@/components/doctors/DoctorCard";
import { WaitlistCard } from "@/components/waitlist/WaitlistCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Search, User } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "@/config/firebase";
import { useToast } from "@/hooks/use-toast";
import {
    getDocuments,
    queryConstraints,
    updateDocument,
    deleteDocument,
    createDocument
} from "@/services/firebase/firestore.service";
import {
    subscribeToAppointments,
    subscribeToWaitlists,
    fetchWithoutIndex
} from "@/services/firebase/query-utils";

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

interface WaitlistItem {
    id: string;
    doctorId: string;
    patientId: string;
    specialty: string;
    requestDate: string;
    urgency: "normal" | "urgent" | "emergency";
    estimatedWait: string;
    notes?: string;
    doctorName: string;
}

interface Doctor {
    id: string;
    fullName: string;
    displayName?: string;
    specialty: string;
    yearsOfExperience?: number;
    ratings?: number;
    reviewCount?: number;
    availability?: string[];
    imageUrl?: string;
    bio?: string;
}

const PatientDashboard = () => {
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
    const [allAppointments, setAllAppointments] = useState<CalendarAppointment[]>([]);
    const [waitlistItems, setWaitlistItems] = useState<WaitlistItem[]>([]);
    const [recommendedDoctors, setRecommendedDoctors] = useState<Doctor[]>([]);
    const [medicalNotesCount, setMedicalNotesCount] = useState<number>(0);
    const loggedInPatientId = auth.currentUser?.uid;
    const navigate = useNavigate();
    const today = new Date().toLocaleDateString();
    const { toast } = useToast();

    // Fetch all appointments for calendar view
    useEffect(() => {
        if (loggedInPatientId) {
            const fetchAllAppointments = async () => {
                try {
                    const appointmentsRef = await getDocuments("appointments", [
                        queryConstraints.whereEquals("patientId", loggedInPatientId),
                    ]);
                    
                    if (appointmentsRef.length === 0) {
                        setAllAppointments([]);
                        return;
                    }
                    
                    const doctorIds = [...new Set(appointmentsRef.map(appt => appt.doctorId))];
                    
                    // Get doctor names
                    const doctorMap: Record<string, string> = {};
                    try {
                        const usersData = await getDocuments("users", [
                            queryConstraints.whereIn("__name__", doctorIds)
                        ]);
                        
                        // Filter by role on the client side
                        const doctorUsers = usersData.filter(user => user.role === "doctor");
                        
                        doctorUsers.forEach(user => {
                            doctorMap[user.id] = user.fullName || user.displayName || "Dr. Unknown";
                        });
                        
                        // Fallback to doctors collection for missing doctors
                        const missingDoctorIds = doctorIds.filter(id => !doctorMap[id]);
                        if (missingDoctorIds.length > 0) {
                            const doctorsData = await getDocuments("doctors", [
                                queryConstraints.whereIn("__name__", missingDoctorIds)
                            ]);
                            doctorsData.forEach(doctor => {
                                doctorMap[doctor.id] = doctor.fullName || doctor.name || "Dr. Unknown";
                            });
                        }
                    } catch (error) {
                        console.error("Error fetching doctor details:", error);
                    }
                    
                    const calendarAppointments = appointmentsRef.map(appt => ({
                        ...appt,
                        doctorName: doctorMap[appt.doctorId] || `Doctor (${appt.doctorId.slice(0,5)}...)`,
                        patientName: auth.currentUser?.displayName || "Patient"
                    }));
                    
                    setAllAppointments(calendarAppointments);
                } catch (error) {
                    console.error("Error fetching all appointments:", error);
                }
            };
            
            fetchAllAppointments();
            // Refresh appointments every 60 seconds
            const refreshInterval = setInterval(fetchAllAppointments, 60000);
            
            return () => clearInterval(refreshInterval);
        }
    }, [loggedInPatientId]);

    // Fetch patient appointments and waitlist items
    useEffect(() => {
        if (loggedInPatientId) {
            // Use new index-free subscription method for upcoming appointments
            const unsubscribeAppointments = subscribeToAppointments<Appointment>(
                loggedInPatientId,
                'patient',
                today,
                'asc',
                async (appointmentsData) => {
                    if (appointmentsData.length === 0) {
                        setUpcomingAppointments([]);
                        return;
                    }

                    // Get doctor names for the appointments
                    const doctorIds = [...new Set(appointmentsData.map(appt => appt.doctorId))];
                    const doctorMap: Record<string, string> = {};
                    
                    try {
                        // Simple query for doctor information
                        const usersData = await getDocuments("users", [
                            queryConstraints.whereIn("__name__", doctorIds)
                        ]);
                        
                        // Filter by role on the client side
                        const doctorUsers = usersData.filter(user => user.role === "doctor");
                        
                        doctorUsers.forEach(user => {
                            doctorMap[user.id] = user.fullName || user.displayName || "Dr. Unknown";
                        });
                        
                        // Check if we need a fallback to doctors collection
                        const missingDoctorIds = doctorIds.filter(id => !doctorMap[id]);
                        if (missingDoctorIds.length > 0) {
                            const doctorsData = await getDocuments("doctors", [
                                queryConstraints.whereIn("__name__", missingDoctorIds)
                            ]);
                            doctorsData.forEach(doctor => {
                                doctorMap[doctor.id] = doctor.fullName || doctor.name || "Dr. Unknown";
                            });
                        }
                    } catch (error) {
                        console.error("Error fetching doctor details:", error);
                    }
                    
                    // Map appointments with doctor names
                    const appointmentsWithNames = appointmentsData.map(appt => ({
                        ...appt,
                        doctorName: doctorMap[appt.doctorId] || `Doctor (${appt.doctorId.slice(0,5)}...)`,
                    }));
                    
                    setUpcomingAppointments(appointmentsWithNames);
                }
            );

            // Use new index-free subscription method for waitlist items
            const unsubscribeWaitlist = subscribeToWaitlists<WaitlistItem>(
                loggedInPatientId,
                'patient',
                async (waitlistData) => {
                    if (waitlistData.length === 0) {
                        setWaitlistItems([]);
                        return;
                    }

                    // Get doctor names for waitlist items
                    const doctorIds = [...new Set(waitlistData.map(item => item.doctorId))];
                    const doctorMap: Record<string, string> = {};
                    
                    try {
                        // Simple query that won't require a complex index
                        const usersData = await getDocuments("users", [
                            queryConstraints.whereIn("__name__", doctorIds)
                        ]);
                        
                        // Filter by role on the client side
                        const doctorUsers = usersData.filter(user => user.role === "doctor");
                        
                        doctorUsers.forEach(user => {
                            doctorMap[user.id] = user.fullName || user.displayName || "Dr. Unknown";
                        });
                        
                        // Check if we need a fallback to doctors collection
                        const missingDoctorIds = doctorIds.filter(id => !doctorMap[id]);
                        if (missingDoctorIds.length > 0) {
                            const doctorsData = await getDocuments("doctors", [
                                queryConstraints.whereIn("__name__", missingDoctorIds)
                            ]);
                            doctorsData.forEach(doctor => {
                                doctorMap[doctor.id] = doctor.fullName || doctor.name || "Dr. Unknown";
                            });
                        }
                    } catch (error) {
                        console.error("Error fetching doctor details:", error);
                    }
                    
                    // Map waitlist items with doctor names
                    const waitlistWithNames = waitlistData.map(item => ({
                        ...item,
                        doctorName: doctorMap[item.doctorId] || `Doctor (${item.doctorId.slice(0,5)}...)`,
                    }));
                    
                    setWaitlistItems(waitlistWithNames);
                }
            );

            // Use simple query for medical notes that won't require an index
            const fetchMedicalNotes = async () => {
                try {
                    const notesData = await fetchWithoutIndex(
                        "medicalNotes",
                        { field: "patientId", value: loggedInPatientId }
                    );
                    setMedicalNotesCount(notesData.length);
                } catch (error) {
                    console.error("Error fetching medical notes:", error);
                    setMedicalNotesCount(0);
                }
            };
            
            fetchMedicalNotes();
            // Set up a periodic refresh for medical notes count
            const notesInterval = setInterval(fetchMedicalNotes, 60000); // Refresh every minute

            return () => {
                unsubscribeAppointments();
                unsubscribeWaitlist();
                clearInterval(notesInterval);
            };
        }
    }, [loggedInPatientId, today]);

    // Fetch recommended doctors with ratings
    useEffect(() => {
        const fetchRecommendedDoctors = async () => {
            try {
                // Simple query that won't require an index
                const doctorsData = await getDocuments<Doctor>("users", [
                    queryConstraints.whereEquals("role", "doctor"),
                    queryConstraints.limitTo(6) // Get more doctors since we'll sort client-side
                ]);
                
                if (doctorsData.length > 0) {
                    // Sort by ratings on the client side instead of in the query
                    const sortedDoctors = doctorsData
                        .sort((a, b) => (b.ratings || 0) - (a.ratings || 0))
                        .slice(0, 3); // Take only top 3 after client-side sorting
                    
                    setRecommendedDoctors(sortedDoctors);
                } else {
                    // Fallback to doctors collection if needed
                    const fallbackDoctors = await getDocuments<Doctor>("doctors", [
                        queryConstraints.limitTo(6)
                    ]);
                    // Sort on client side
                    const sortedFallbackDoctors = fallbackDoctors
                        .sort((a, b) => (b.ratings || 0) - (a.ratings || 0))
                        .slice(0, 3);
                    
                    setRecommendedDoctors(sortedFallbackDoctors);
                }
            } catch (error) {
                console.error("Error fetching recommended doctors:", error);
                // Provide empty array on error to avoid UI issues
                setRecommendedDoctors([]);
            }
        };

        fetchRecommendedDoctors();
    }, []);

    const handleCancelAppointment = async (appointmentId: string) => {
        if (loggedInPatientId) {
            try {
                // Delete the appointment document instead of just updating its status
                await deleteDocument("appointments", appointmentId);
                
                toast({
                    title: "Appointment Cancelled",
                    description: "Your appointment has been successfully removed.",
                });
            } catch (error) {
                console.error("Error cancelling appointment:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to cancel appointment. Please try again.",
                });
            }
        }
    };

    const handleRescheduleAppointment = async (appointmentId: string, newDateTime: {date: string, time: string}) => {
        if (loggedInPatientId) {
            try {
                await updateDocument("appointments", appointmentId, {
                    date: newDateTime.date,
                    time: newDateTime.time,
                    updatedAt: new Date().toISOString()
                });
            } catch (error) {
                console.error("Error rescheduling appointment:", error);
            }
        }
    };

    const handleCancelWaitlist = async (waitlistId: string) => {
        if (loggedInPatientId) {
            try {
                await deleteDocument("waitlists", waitlistId);
            } catch (error) {
                console.error("Error cancelling waitlist:", error);
            }
        }
    };

    const handleUpgradeToEmergency = async (waitlistId: string) => {
        if (loggedInPatientId) {
            try {
                await updateDocument("waitlists", waitlistId, {
                    urgency: "emergency",
                    updatedAt: new Date().toISOString()
                });
                
                // Create an emergency request to notify the doctor
                const waitlistItem = waitlistItems.find(item => item.id === waitlistId);
                if (waitlistItem) {
                    await createDocument("emergencyRequests", {
                        doctorId: waitlistItem.doctorId,
                        patientId: loggedInPatientId,
                        patientName: auth.currentUser?.displayName || "Patient",
                        reason: waitlistItem.specialty,
                        requestTime: new Date().toLocaleString(),
                        status: "pending"
                    });
                }
            } catch (error) {
                console.error("Error upgrading waitlist to emergency:", error);
            }
        }
    };

    const handleViewNotes = (appointmentId: string) => {
        navigate(`/patient/medical-records/${appointmentId}`);
    };

    const navigateToBookAppointment = () => {
        navigate('/patient/book-appointment');
    };

    const navigateToFindDoctor = () => {
        navigate('/patient/find-doctor');
    };

    const navigateToAllDoctors = () => {
        navigate('/patient/doctors');
    };

    const handleBookWithDoctor = (doctorId: string) => {
        navigate(`/patient/book-appointment/${doctorId}`);
    };

    return (
        <Layout userRole="patient">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Welcome back, {auth.currentUser?.displayName || 'Patient'}</h1>
                        <p className="text-gray-500">Here's your appointment schedule</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            className="gap-2 bg-health-primary hover:bg-health-secondary"
                            onClick={navigateToBookAppointment}
                            as={Link}
                            to="/patient/book-appointment"
                        >
                            <Calendar className="h-4 w-4" />
                            Book Appointment
                        </Button>
                    </div>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatsCard
                        title="Upcoming Appointments"
                        value={upcomingAppointments.length}
                        icon={<Calendar className="h-4 w-4" />}
                        description="Your scheduled appointments"
                    />
                    <StatsCard
                        title="Active Waitlists"
                        value={waitlistItems.length}
                        icon={<Clock className="h-4 w-4" />}
                        description="Specialist waitlists you're on"
                    />
                    <StatsCard
                        title="Medical Notes"
                        value={medicalNotesCount}
                        icon={<User className="h-4 w-4" />}
                        description="Your recent medical notes"
                    />
                </div>

                {/* Calendar View */}
                <div>
                    <AppointmentCalendar 
                        appointments={allAppointments}
                        userRole="patient"
                        onCancelAppointment={handleCancelAppointment}
                        onViewAppointment={handleViewNotes}
                    />
                </div>

                {/* Waitlists */}
                {waitlistItems.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Your Waitlists</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {waitlistItems.map((waitlist) => (
                                <WaitlistCard
                                    key={waitlist.id}
                                    waitlistItem={waitlist}
                                    onCancelWaitlist={() => handleCancelWaitlist(waitlist.id)}
                                    onUpgradeToEmergency={() => handleUpgradeToEmergency(waitlist.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommended Doctors */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Recommended Doctors</h2>
                        <Button 
                            variant="link" 
                            className="text-health-primary"
                            onClick={navigateToAllDoctors}
                            as={Link}
                            to="/patient/doctors"
                        >
                            View All
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommendedDoctors.length > 0 ? (
                            recommendedDoctors.map((doctor) => (
                                <DoctorCard
                                    key={doctor.id}
                                    doctor={doctor}
                                    onBookAppointment={() => handleBookWithDoctor(doctor.id)}
                                />
                            ))
                        ) : (
                            <div className="col-span-full text-center p-4">
                                <p>Loading recommended doctors...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default PatientDashboard;