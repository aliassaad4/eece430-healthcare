import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isPast, startOfDay } from "date-fns";
import { CalendarIcon, Clock, ArrowLeft, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DoctorCard } from "@/components/doctors/DoctorCard";

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

interface AvailableSlot {
    time: string;
    available: boolean;
}

const BookAppointment = () => {
    const { doctorId } = useParams<{ doctorId: string }>();
    const navigate = useNavigate();
    const loggedInPatientId = auth.currentUser?.uid;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(doctorId || null);
    const [doctor, setDoctor] = useState<Doctor | null>(null);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [specialty, setSpecialty] = useState<string>("all");
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [date, setDate] = useState<Date>(addDays(startOfDay(new Date()), 1));
    const [timeSlots, setTimeSlots] = useState<AvailableSlot[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("doctors");
    const [patientName, setPatientName] = useState("");
    const [reason, setReason] = useState("");

    // Default time slots
    const defaultTimeSlots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
        "04:00 PM", "04:30 PM", "05:00 PM"
    ];

    // Fetch doctors list and user info
    useEffect(() => {
        const fetchData = async () => {
            if (!loggedInPatientId) {
                setIsLoading(false);
                return;
            }

            try {
                // Get the patient's details
                const userDoc = await getDoc(doc(db, "users", loggedInPatientId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setPatientName(userData.fullName || userData.name || "Patient");
                }

                // Get all doctors from users collection
                const doctorsQuery = query(
                    collection(db, "users"),
                    where("role", "==", "doctor")
                );
                
                const doctorsSnapshot = await getDocs(doctorsQuery);
                const doctorsList: Doctor[] = [];
                const specialtiesList = new Set<string>();
                
                doctorsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    const doctorSpecialty = data.specialty || "General Practice";
                    specialtiesList.add(doctorSpecialty);
                    
                    doctorsList.push({
                        id: doc.id,
                        fullName: data.fullName || data.name || "Dr. Unknown",
                        displayName: data.displayName,
                        specialty: doctorSpecialty,
                        yearsOfExperience: data.yearsOfExperience,
                        ratings: data.ratings || 0,
                        reviewCount: data.reviewCount || 0,
                        imageUrl: data.photoURL || data.imageUrl,
                        bio: data.bio || `Specialist in ${doctorSpecialty}`
                    });
                });
                
                setDoctors(doctorsList);
                setSpecialties(Array.from(specialtiesList));

                // If a doctor ID was provided in the URL, select that doctor
                if (doctorId) {
                    const selectedDoctor = doctorsList.find(doc => doc.id === doctorId);
                    if (selectedDoctor) {
                        setDoctor(selectedDoctor);
                        setActiveTab("schedule");
                    } else {
                        // Try to fetch from the doctors collection as fallback
                        try {
                            const doctorDoc = await getDoc(doc(db, "doctors", doctorId));
                            if (doctorDoc.exists()) {
                                const data = doctorDoc.data();
                                setDoctor({
                                    id: doctorId,
                                    fullName: data.fullName || data.name || "Dr. Unknown",
                                    specialty: data.specialty || "General Practice",
                                    ratings: data.ratings || 0,
                                    yearsOfExperience: data.yearsOfExperience,
                                    bio: data.bio || `Specialist in ${data.specialty || "medicine"}`,
                                    imageUrl: data.photoURL || data.imageUrl
                                });
                                setActiveTab("schedule");
                            }
                        } catch (error) {
                            console.error("Error fetching doctor from doctors collection:", error);
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
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
    }, [loggedInPatientId, doctorId]);

    // Update available time slots when date or selected doctor changes
    useEffect(() => {
        const fetchAvailableSlots = async () => {
            if (!selectedDoctorId || !date || !loggedInPatientId) return;

            try {
                // Format date consistently for Firestore queries
                const formattedDate = format(date, "MM/dd/yyyy");
                
                // Check for blocked slots in scheduleSlots collection
                const blockedSlotsRef = collection(db, "scheduleSlots");
                const blockedSlotsQuery = query(
                    blockedSlotsRef,
                    where("doctorId", "==", selectedDoctorId),
                    where("day", "==", formattedDate),
                    where("isBlocked", "==", true)
                );
                
                const blockedSlotsSnapshot = await getDocs(blockedSlotsQuery);
                const blockedTimes = new Set<string>();
                
                blockedSlotsSnapshot.forEach(doc => {
                    const slotData = doc.data();
                    blockedTimes.add(slotData.time);
                });

                // Check for existing appointments for this doctor on this date
                const doctorAppointmentsRef = collection(db, "appointments");
                const doctorAppointmentsQuery = query(
                    doctorAppointmentsRef,
                    where("doctorId", "==", selectedDoctorId),
                    where("date", "==", formattedDate)
                );
                
                const doctorAppointmentsSnapshot = await getDocs(doctorAppointmentsQuery);
                const bookedTimes = new Set<string>();
                
                doctorAppointmentsSnapshot.forEach(doc => {
                    const apptData = doc.data();
                    bookedTimes.add(apptData.time);
                });
                
                // Also check if patient already has appointments at these times
                const patientAppointmentsRef = collection(db, "appointments");
                const patientAppointmentsQuery = query(
                    patientAppointmentsRef,
                    where("patientId", "==", loggedInPatientId),
                    where("date", "==", formattedDate)
                );
                
                const patientAppointmentsSnapshot = await getDocs(patientAppointmentsQuery);
                const patientBookedTimes = new Set<string>();
                
                patientAppointmentsSnapshot.forEach(doc => {
                    const apptData = doc.data();
                    patientBookedTimes.add(apptData.time);
                });

                // Create available time slots array, considering both doctor and patient conflicts
                const slots = defaultTimeSlots.map(time => ({
                    time,
                    available: !blockedTimes.has(time) && !bookedTimes.has(time) && !patientBookedTimes.has(time)
                }));

                setTimeSlots(slots);
                setSelectedTime(null); // Reset selected time when date changes
            } catch (error) {
                console.error("Error fetching available slots:", error);
                // Default to showing all slots as available if there's an error
                setTimeSlots(defaultTimeSlots.map(time => ({ time, available: true })));
            }
        };

        fetchAvailableSlots();
    }, [selectedDoctorId, date, loggedInPatientId]);

    const handleSelectDoctor = (doctorId: string) => {
        const selectedDoctor = doctors.find(doc => doc.id === doctorId);
        if (selectedDoctor) {
            setDoctor(selectedDoctor);
            setSelectedDoctorId(doctorId);
            setActiveTab("schedule");
        }
    };

    const filteredDoctors = doctors.filter(doctor => {
        const matchesSearch = doctor.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSpecialty = specialty === "all" || doctor.specialty === specialty;
        return matchesSearch && matchesSpecialty;
    });

    const handleBookAppointment = async () => {
        if (!loggedInPatientId || !selectedDoctorId || !selectedTime || !date || !doctor) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Format date consistently as MM/dd/yyyy to match the format used elsewhere in the app
            const formattedDate = format(date, "MM/dd/yyyy");
            
            // Double check for conflicts before actually booking (in case someone else booked while form was open)
            const patientConflictQuery = query(
                collection(db, "appointments"),
                where("patientId", "==", loggedInPatientId),
                where("date", "==", formattedDate),
                where("time", "==", selectedTime)
            );
            
            const doctorConflictQuery = query(
                collection(db, "appointments"),
                where("doctorId", "==", selectedDoctorId),
                where("date", "==", formattedDate),
                where("time", "==", selectedTime)
            );
            
            const [patientSnapshot, doctorSnapshot] = await Promise.all([
                getDocs(patientConflictQuery),
                getDocs(doctorConflictQuery)
            ]);
            
            if (!patientSnapshot.empty) {
                toast({
                    title: "Booking Conflict",
                    description: "You already have an appointment scheduled at this time.",
                    variant: "destructive",
                });
                setIsSubmitting(false);
                return;
            }
            
            if (!doctorSnapshot.empty) {
                toast({
                    title: "Booking Conflict",
                    description: "This time slot is no longer available. Please select a different time.",
                    variant: "destructive",
                });
                
                // Refresh available slots
                const appointmentsRef = collection(db, "appointments");
                const appointmentsQuery = query(
                    appointmentsRef,
                    where("doctorId", "==", selectedDoctorId),
                    where("date", "==", formattedDate)
                );
                
                const appointmentsSnapshot = await getDocs(appointmentsQuery);
                const bookedTimes = new Set<string>();
                
                appointmentsSnapshot.forEach(doc => {
                    const apptData = doc.data();
                    bookedTimes.add(apptData.time);
                });
                
                // Create updated available time slots array
                const slots = defaultTimeSlots.map(time => ({
                    time,
                    available: !bookedTimes.has(time)
                }));
                
                setTimeSlots(slots);
                setSelectedTime(null);
                setIsSubmitting(false);
                return;
            }
            
            // Create the appointment in Firestore
            await addDoc(collection(db, "appointments"), {
                doctorId: selectedDoctorId,
                patientId: loggedInPatientId,
                date: formattedDate, // Consistent date format
                time: selectedTime,
                status: "scheduled",
                specialty: doctor.specialty,
                reason: reason || "Regular checkup",
                doctorName: doctor.fullName,
                patientName: patientName,
                createdAt: serverTimestamp(),
            });

            toast({
                title: "Appointment Booked",
                description: `Appointment successfully booked with ${doctor.fullName} for ${format(date, "MMMM d, yyyy")} at ${selectedTime}.`,
            });

            // Navigate back to the dashboard
            navigate("/patient");
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
        if (activeTab === "schedule" && !doctorId) {
            setActiveTab("doctors");
        } else {
            navigate("/patient");
        }
    };

    if (isLoading) {
        return (
            <Layout userRole="patient">
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
                    <span className="ml-3 text-lg">Loading...</span>
                </div>
            </Layout>
        );
    }

    return (
        <Layout userRole="patient">
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    className="gap-2 mb-4"
                    onClick={handleNavigateBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {activeTab === "schedule" && !doctorId ? "Back to Doctors" : "Back to Dashboard"}
                </Button>

                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">Book Appointment</h1>
                    <p className="text-muted-foreground">
                        {activeTab === "doctors" 
                            ? "Select a doctor to schedule your appointment with" 
                            : "Select a date and time for your appointment"}
                    </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList>
                        <TabsTrigger 
                            value="doctors" 
                            disabled={!!doctorId}
                        >
                            Select Doctor
                        </TabsTrigger>
                        <TabsTrigger 
                            value="schedule"
                            disabled={!doctor && !doctorId}
                        >
                            Schedule Appointment
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="doctors" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by doctor name or specialty..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <Select value={specialty} onValueChange={setSpecialty}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by specialty" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Specialties</SelectItem>
                                    {specialties.map(spec => (
                                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {filteredDoctors.length === 0 ? (
                            <div className="text-center py-8 border border-dashed rounded-lg">
                                <p className="text-muted-foreground">No doctors found matching your search criteria.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredDoctors.map((doc) => (
                                    <DoctorCard 
                                        key={doc.id} 
                                        doctor={doc}
                                        onBookAppointment={handleSelectDoctor}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-6">
                        {doctor && (
                            <div className="grid gap-6 md:grid-cols-3">
                                {/* Doctor Information Card */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle>Doctor Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex flex-col items-center">
                                            {doctor.imageUrl ? (
                                                <img 
                                                    src={doctor.imageUrl} 
                                                    alt={doctor.fullName}
                                                    className="rounded-full h-24 w-24 object-cover mb-3"
                                                />
                                            ) : (
                                                <div className="bg-health-light h-24 w-24 rounded-full flex items-center justify-center mb-3">
                                                    <span className="text-2xl text-health-primary font-semibold">
                                                        {doctor.fullName.charAt(0)}
                                                    </span>
                                                </div>
                                            )}
                                            <h3 className="font-semibold text-lg">{doctor.fullName}</h3>
                                            <p className="text-health-primary">{doctor.specialty}</p>
                                        </div>
                                        
                                        {doctor.yearsOfExperience && (
                                            <div className="text-sm">
                                                <Label>Experience</Label>
                                                <p>{doctor.yearsOfExperience} years</p>
                                            </div>
                                        )}
                                        
                                        {doctor.bio && (
                                            <div className="text-sm">
                                                <Label>About</Label>
                                                <p className="text-muted-foreground">{doctor.bio}</p>
                                            </div>
                                        )}

                                        {doctor.ratings !== undefined && (
                                            <div className="text-sm flex gap-1 items-center">
                                                <Label>Rating:</Label>
                                                <div className="text-yellow-500 flex items-center">
                                                    {Array(5).fill(0).map((_, i) => (
                                                        <span key={i} className={i < Math.round(doctor.ratings || 0) ? "text-yellow-500" : "text-gray-300"}>★</span>
                                                    ))}
                                                </div>
                                                <span className="text-muted-foreground">({doctor.reviewCount || 0} reviews)</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Appointment Form Card */}
                                <Card className="md:col-span-2">
                                    <CardHeader>
                                        <CardTitle>Appointment Details</CardTitle>
                                        <CardDescription>Select a date and time for your appointment</CardDescription>
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

                                        {/* Reason */}
                                        <div className="space-y-2">
                                            <Label htmlFor="reason">Reason for Visit (Optional)</Label>
                                            <Input
                                                id="reason"
                                                placeholder="Brief description of your health concern"
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
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
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default BookAppointment;