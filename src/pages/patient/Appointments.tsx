import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/config/firebase";
import { toast } from "@/hooks/use-toast";
import { subscribeToAppointments } from "@/services/firebase/query-utils";
import { updateDocument, deleteDocument } from "@/services/firebase/firestore.service";
import { formatDateWithDay, formatTime } from "@/lib/utils";

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
    doctorName?: string;
}

const Appointments = () => {
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
    const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
    const [activeTab, setActiveTab] = useState("upcoming");
    const loggedInPatientId = auth.currentUser?.uid;

    useEffect(() => {
        if (loggedInPatientId) {
            const today = new Date().toLocaleDateString();

            const unsubscribe = subscribeToAppointments<Appointment>(
                loggedInPatientId,
                "patient",
                undefined,
                "asc",
                (appointmentsData) => {
                    if (appointmentsData.length === 0) {
                        setUpcomingAppointments([]);
                        setPastAppointments([]);
                        return;
                    }

                    const upcoming: Appointment[] = [];
                    const past: Appointment[] = [];

                    appointmentsData.forEach((appt) => {
                        const appointment = {
                            ...appt,
                            formattedDate: formatDateWithDay(appt.date),
                            formattedTime: formatTime(appt.time),
                        };

                        if (new Date(appt.date) >= new Date(today)) {
                            upcoming.push(appointment);
                        } else {
                            past.push(appointment);
                        }
                    });

                    upcoming.sort((a, b) => {
                        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                        return dateCompare === 0 ? a.time.localeCompare(b.time) : dateCompare;
                    });

                    past.sort((a, b) => {
                        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
                        return dateCompare === 0 ? b.time.localeCompare(a.time) : dateCompare;
                    });

                    setUpcomingAppointments(upcoming);
                    setPastAppointments(past);
                }
            );

            return () => {
                unsubscribe();
            };
        }
    }, [loggedInPatientId]);

    const handleCancelAppointment = async (id: string) => {
        if (loggedInPatientId) {
            try {
                // Delete the appointment completely instead of just updating status
                await deleteDocument("appointments", id);

                toast({
                    title: "Appointment Cancelled",
                    description: "Your appointment has been successfully cancelled and removed.",
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

    const handleRescheduleAppointment = async (id: string, newDateTime: { date: string; time: string }) => {
        if (loggedInPatientId) {
            try {
                await updateDocument("appointments", id, {
                    date: newDateTime.date,
                    time: newDateTime.time,
                    updatedAt: new Date().toISOString(),
                });

                toast({
                    title: "Appointment Rescheduled",
                    description: `Your appointment has been rescheduled to ${formatDateWithDay(
                        newDateTime.date
                    )} at ${formatTime(newDateTime.time)}.`,
                });
            } catch (error) {
                console.error("Error rescheduling appointment:", error);
                toast({
                    title: "Error",
                    description: "Failed to reschedule appointment. Please try again.",
                    variant: "destructive",
                });
            }
        }
    };

    const handleViewNotes = (id: string) => {
        const appointment = [...upcomingAppointments, ...pastAppointments].find((a) => a.id === id);
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

    return (
        <Layout userRole="patient">
            <div className="space-y-6">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
                    <p className="text-muted-foreground">Manage your upcoming and past appointments.</p>
                </div>

                <Tabs defaultValue="upcoming" onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="past">Past</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="space-y-4">
                        {upcomingAppointments.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">No upcoming appointments scheduled.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {upcomingAppointments.map((appointment) => (
                                    <AppointmentCard
                                        key={appointment.id}
                                        appointment={appointment}
                                        userRole="patient"
                                        onCancelAppointment={() => handleCancelAppointment(appointment.id)}
                                        onRescheduleAppointment={(newDateTime) =>
                                            handleRescheduleAppointment(appointment.id, newDateTime)
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="past" className="space-y-4">
                        {pastAppointments.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">No past appointments found.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pastAppointments.map((appointment) => (
                                    <AppointmentCard
                                        key={appointment.id}
                                        appointment={appointment}
                                        userRole="patient"
                                        onViewNotes={
                                            appointment.notes ? () => handleViewNotes(appointment.id) : undefined
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default Appointments;