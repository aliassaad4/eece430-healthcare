// @/components/appointments/AppointmentCard.tsx
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MessageSquare, User } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";

export interface AppointmentCardProps {
    appointment: {
        id: string;
        doctorId?: string;
        patientId?: string;
        doctorName?: string;
        patientName?: string;
        specialty?: string;
        date: string;
        time: string;
        status: "scheduled" | "upcoming" | "completed" | "cancelled" | "emergency";
        notes?: string;
    };
    userRole: "patient" | "doctor" | "admin";
    onCancelAppointment?: (id: string) => void;
    onRescheduleAppointment?: (id: string, newDateTime: {date: string, time: string}) => void;
    onViewNotes?: (id: string) => void;
    onAddNotes?: (id: string, notes: string) => void;
}

export const AppointmentCard = ({
    appointment,
    userRole,
    onCancelAppointment,
    onRescheduleAppointment,
    onViewNotes,
    onAddNotes
}: AppointmentCardProps) => {
    const navigate = useNavigate();
    const [isAddNotesOpen, setIsAddNotesOpen] = useState(false);
    const [notes, setNotes] = useState(appointment.notes || "");
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [newDate, setNewDate] = useState(appointment.date);
    const [newTime, setNewTime] = useState(appointment.time);

    const statusColors = {
        scheduled: "bg-blue-100 text-blue-800",
        upcoming: "bg-blue-100 text-blue-800",
        completed: "bg-green-100 text-green-800",
        cancelled: "bg-gray-100 text-gray-800",
        emergency: "bg-health-error text-white"
    };

    // Determine which name to display based on user role
    const displayName = userRole === "patient" 
        ? (appointment.doctorName || "Unknown Doctor") 
        : (appointment.patientName || "Unknown Patient");

    // Handle adding notes
    const handleAddNotes = () => {
        if (onAddNotes) {
            onAddNotes(appointment.id, notes);
            setIsAddNotesOpen(false);
        }
    };

    // Handle rescheduling
    const handleReschedule = () => {
        if (onRescheduleAppointment) {
            onRescheduleAppointment(appointment.id, { date: newDate, time: newTime });
            setIsRescheduleOpen(false);
        }
    };

    const handleCardClick = () => {
        navigate(`/patient/appointment-details/${appointment.id}`);
    };

    return (
        <>
            <Card className="overflow-hidden transition-all hover:shadow-md cursor-pointer" onClick={handleCardClick}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">
                            {userRole === "doctor" ? "Patient Appointment" : "Doctor Appointment"}
                        </CardTitle>
                        <Badge className={statusColors[appointment.status]}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pb-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-health-primary" />
                        <span className="font-medium">{displayName}</span>
                        {appointment.specialty && (
                            <span className="text-sm text-gray-500">({appointment.specialty})</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-health-primary" />
                        <span className="flex items-center gap-1">
                            <span>{new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <Badge variant="outline" className="text-xs ml-1">
                                Week {new Date(appointment.date).getWeek()}
                            </Badge>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-health-primary" />
                        <span className="font-medium">{appointment.time}</span>
                        <Badge className="bg-health-primary/20 text-health-primary hover:bg-health-primary/30 text-xs">
                            {new Date(appointment.date).toLocaleDateString('en-US', {weekday: 'short'})}
                        </Badge>
                    </div>

                    {appointment.notes && (
                        <div className="flex items-start gap-2 bg-health-light p-2 rounded-md">
                            <MessageSquare className="h-4 w-4 text-health-primary mt-0.5" />
                            <span className="text-sm">{appointment.notes}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="pt-0 flex gap-2 flex-wrap">
                    {(appointment.status === "upcoming" || appointment.status === "scheduled") && onCancelAppointment && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancelAppointment(appointment.id);
                            }}
                        >
                            Cancel
                        </Button>
                    )}

                    {(appointment.status === "upcoming" || appointment.status === "scheduled") && onRescheduleAppointment && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsRescheduleOpen(true);
                            }}
                        >
                            Reschedule
                        </Button>
                    )}

                    {userRole === "doctor" && (appointment.status === "completed" || appointment.status === "scheduled") && onAddNotes && (
                        <Button
                            className="bg-health-primary hover:bg-health-secondary"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsAddNotesOpen(true);
                            }}
                        >
                            {appointment.notes ? "Edit Notes" : "Add Notes"}
                        </Button>
                    )}

                    {appointment.notes && onViewNotes && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewNotes(appointment.id);
                            }}
                        >
                            View Notes
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Add Notes Dialog */}
            <Dialog open={isAddNotesOpen} onOpenChange={setIsAddNotesOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Medical Notes</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter medical notes here..."
                        className="min-h-[150px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddNotesOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddNotes}>Save Notes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reschedule Dialog */}
            <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reschedule Appointment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="date" className="block text-sm font-medium">Date</label>
                            <input
                                id="date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="time" className="block text-sm font-medium">Time</label>
                            <input
                                id="time"
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>Cancel</Button>
                        <Button onClick={handleReschedule}>Confirm Reschedule</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};