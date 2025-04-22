import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Calendar, Clock, Check, X, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, query, where, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  getDocuments,
  queryConstraints
} from "@/services/firebase/firestore.service";

interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  time: string;
  date: string;
  status: "scheduled" | "pending" | "confirmed" | "completed" | "cancelled";
  reason?: string;
  isEmergency?: boolean;
}

interface ScheduleSlot {
  id: string;
  doctorId: string;
  day: string;
  time: string;
  isBlocked: boolean;
  isAvailable: boolean;
  reason?: string;
  createdAt: Date;
}

// Generate available dates for the next two weeks
const generateAvailableDates = () => {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(format(date, "yyyy-MM-dd"));
  }
  
  return dates;
};

const Schedule = () => {
  const [activeDate, setActiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [availableDates] = useState(generateAvailableDates());
  const [isBlockTimeDialogOpen, setIsBlockTimeDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<ScheduleSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const loggedInDoctorId = auth.currentUser?.uid;

  const availableTimeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
  ];

  // Fetch appointments and blocked slots
  useEffect(() => {
    const fetchScheduleData = async () => {
      if (!loggedInDoctorId) return;
      
      setIsLoading(true);
      
      try {
        console.log('Fetching schedule data for date:', activeDate);
        // Fix the collection path to use the correct nested structure
        const appointmentsCollectionRef = collection(db, "appointments", loggedInDoctorId, "appointments");
        const appointmentsSnapshot = await getDocs(appointmentsCollectionRef);
        
        const appointmentsData: Appointment[] = [];
        appointmentsSnapshot.forEach(doc => {
          // Only include appointments for the selected date
          const data = doc.data();
          if (data.date === activeDate) {
            appointmentsData.push({ id: doc.id, ...data } as Appointment);
          }
        });
        
        console.log('Raw appointments data for schedule:', appointmentsData);
        
        // Get patients info for appointments
        if (appointmentsData.length > 0) {
          const patientIds = [...new Set(appointmentsData.map(app => app.patientId))];
          
          // First try to get from users collection
          const patientMap: Record<string, string> = {};
          try {
            const usersData = await getDocuments("users", [
              queryConstraints.whereIn("__name__", patientIds)
            ]);
            
            usersData.forEach(user => {
              patientMap[user.id] = user?.fullName || user?.name || "Unknown Patient";
            });
            
            // Check for any missing patients
            const missingPatientIds = patientIds.filter(id => !patientMap[id]);
            if (missingPatientIds.length > 0) {
              const patientsData = await getDocuments("patients", [
                queryConstraints.whereIn("__name__", missingPatientIds)
              ]);
              
              patientsData.forEach(patient => {
                patientMap[patient.id] = patient?.name || "Unknown Patient";
              });
            }
          } catch (error) {
            console.error("Error fetching patient details:", error);
          }
          
          // Add patient names to appointments
          appointmentsData.forEach(appointment => {
            appointment.patientName = patientMap[appointment.patientId] || appointment.patientName || `Patient (${appointment.patientId.slice(0,5)}...)`;
            
            // Check if it's an emergency appointment
            appointment.isEmergency = appointment.status === "emergency";
            
            // Convert status if needed to match the expected values
            if (!["scheduled", "pending", "confirmed", "completed", "cancelled"].includes(appointment.status)) {
              if (appointment.status === "upcoming") {
                appointment.status = "scheduled";
              }
              if (appointment.status === "emergency") {
                appointment.status = "confirmed";
              }
            }
          });
        }
        
        console.log('Processed appointments for schedule:', appointmentsData);
        setAppointments(appointmentsData);
        
        // Fetch blocked slots
        const blockedSlotsQuery = query(
          collection(db, "scheduleSlots"),
          where("doctorId", "==", loggedInDoctorId),
          where("day", "==", activeDate),
          where("isBlocked", "==", true)
        );
        
        const blockedSlotsSnapshot = await getDocs(blockedSlotsQuery);
        const blockedSlotsData: ScheduleSlot[] = [];
        blockedSlotsSnapshot.forEach(doc => {
          blockedSlotsData.push({ id: doc.id, ...doc.data() } as ScheduleSlot);
        });
        
        setBlockedSlots(blockedSlotsData);
        
      } catch (error) {
        console.error("Error fetching schedule data:", error);
        toast({
          title: "Error",
          description: "Failed to load schedule data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchScheduleData();
  }, [loggedInDoctorId, activeDate]);

  // Filter appointments by date
  const filteredAppointments = appointments.filter(app => app.date === activeDate);

  const handleApproveAppointment = async (id: string) => {
    if (!loggedInDoctorId) return;
    
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: "confirmed",
        updatedAt: new Date()
      });
      
      // Update local state
      setAppointments(appointments.map(app => 
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

  const handleRescheduleAppointment = (id: string) => {
    navigate(`/doctor/appointments/reschedule/${id}`);
  };

  const handleCancelAppointment = async (id: string) => {
    if (!loggedInDoctorId) return;
    
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: "cancelled",
        updatedAt: new Date()
      });
      
      // Update local state
      setAppointments(appointments.map(app => 
        app.id === id ? { ...app, status: "cancelled" } : app
      ));
      
      toast({
        title: "Appointment Cancelled",
        description: "The appointment has been cancelled."
      });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Error",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBlockTime = () => {
    setIsBlockTimeDialogOpen(true);
  };

  const handleCreateAppointment = () => {
    navigate("/doctor/book-appointment");
  };

  const handleTimeSlotToggle = (timeSlot: string) => {
    if (selectedTimeSlots.includes(timeSlot)) {
      setSelectedTimeSlots(selectedTimeSlots.filter(slot => slot !== timeSlot));
    } else {
      setSelectedTimeSlots([...selectedTimeSlots, timeSlot]);
    }
  };

  const handleUnblockTime = async (slotId: string) => {
    if (!loggedInDoctorId) return;
    
    try {
      await deleteDoc(doc(db, "scheduleSlots", slotId));
      
      // Update local state
      setBlockedSlots(blockedSlots.filter(slot => slot.id !== slotId));
      
      toast({
        title: "Time Unblocked",
        description: "The time slot has been made available again."
      });
    } catch (error) {
      console.error("Error unblocking time slot:", error);
      toast({
        title: "Error",
        description: "Failed to unblock time slot. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBlockTimeSubmit = async () => {
    if (!selectedDate || selectedTimeSlots.length === 0 || !blockReason) {
      toast({
        title: "Missing Information",
        description: "Please select a date, at least one time slot, and provide a reason.",
        variant: "destructive"
      });
      return;
    }

    if (!loggedInDoctorId) {
      toast({
        title: "Authentication Error",
        description: "You need to be logged in to block time slots.",
        variant: "destructive"
      });
      return;
    }

    setIsBlocking(true);
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");

      // Create blocked slots in Firestore
      for (const timeSlot of selectedTimeSlots) {
        // Check if there's already an appointment at this time
        const existingAppointment = appointments.find(
          app => app.date === formattedDate && app.time === timeSlot
        );
        
        if (existingAppointment) {
          toast({
            title: "Time Conflict",
            description: `There's already an appointment at ${timeSlot} on ${format(selectedDate, "MMMM d, yyyy")}.`,
            variant: "destructive"
          });
          continue;
        }
        
        await addDoc(collection(db, "scheduleSlots"), {
          doctorId: loggedInDoctorId,
          day: formattedDate,
          time: timeSlot,
          isBlocked: true,
          isAvailable: false,
          reason: blockReason,
          createdAt: new Date()
        });
      }

      // Success message
      toast({
        title: "Time Blocked",
        description: `Successfully blocked ${selectedTimeSlots.length} time slots on ${format(selectedDate, "MMMM d, yyyy")}.`
      });

      // If we blocked slots for today, refresh the display
      if (formattedDate === activeDate) {
        const newBlockedSlots = await getDocs(query(
          collection(db, "scheduleSlots"),
          where("doctorId", "==", loggedInDoctorId),
          where("day", "==", activeDate),
          where("isBlocked", "==", true)
        ));
        
        const updatedBlockedSlots: ScheduleSlot[] = [];
        newBlockedSlots.forEach(doc => {
          updatedBlockedSlots.push({ id: doc.id, ...doc.data() } as ScheduleSlot);
        });
        
        setBlockedSlots(updatedBlockedSlots);
      }

      // Reset form
      setSelectedTimeSlots([]);
      setBlockReason("");
      setIsBlockTimeDialogOpen(false);
    } catch (error) {
      console.error("Error blocking time slots:", error);
      toast({
        title: "Error",
        description: "Failed to block time slots. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <Layout userRole="doctor">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Schedule</h1>
            <p className="text-gray-500">Manage your appointments and time slots</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleBlockTime}>
              <Clock className="h-4 w-4" />
              Block Time
            </Button>
            <Button 
              className="gap-2 bg-health-primary hover:bg-health-secondary"
              onClick={handleCreateAppointment}
            >
              <Calendar className="h-4 w-4" />
              Create Appointment
            </Button>
          </div>
        </div>

        {/* Date Selection */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <h2 className="text-lg font-medium">Select Date</h2>
            <Select value={activeDate} onValueChange={setActiveDate}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a date" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(date => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Schedule View */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">
            {new Date(activeDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>

          {isLoading ? (
            <div className="py-8 text-center flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
              <span className="ml-3 text-lg">Loading schedule...</span>
            </div>
          ) : (
            <>
              {/* Appointments */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Appointments</h3>
                {filteredAppointments.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">
                    <p>No appointments scheduled for this date.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAppointments.map((appointment) => (
                      <Card 
                        key={appointment.id} 
                        className={appointment.isEmergency ? "border-l-4 border-l-red-500" : ""}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{appointment.patientName}</CardTitle>
                              <p className="text-sm text-muted-foreground">{appointment.time}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {appointment.isEmergency && (
                                <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Emergency</Badge>
                              )}
                              <Badge 
                                className={
                                  appointment.status === "confirmed" ? "bg-green-100 text-green-800 hover:bg-green-200" : 
                                  appointment.status === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-200" :
                                  appointment.status === "completed" ? "bg-blue-100 text-blue-800 hover:bg-blue-200" :
                                  "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                }
                              >
                                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4">Reason: {appointment.reason || "Not specified"}</p>
                          <div className="flex gap-2 justify-end">
                            {appointment.status === "pending" && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => handleApproveAppointment(appointment.id)}
                              >
                                <Check className="h-4 w-4" />
                                Approve
                              </Button>
                            )}
                            {(appointment.status === "pending" || appointment.status === "confirmed") && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => handleRescheduleAppointment(appointment.id)}
                                >
                                  <Calendar className="h-4 w-4" />
                                  Reschedule
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => handleCancelAppointment(appointment.id)}
                                >
                                  <X className="h-4 w-4" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            {appointment.status === "completed" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="gap-1"
                                onClick={() => navigate(`/doctor/patients/medical-records/${appointment.patientId}`)}
                              >
                                <Users className="h-4 w-4" />
                                View Patient
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
                
              {/* Blocked Time Slots */}
              <div>
                <h3 className="text-lg font-medium mb-3">Blocked Time Slots</h3>
                {blockedSlots.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">
                    <p>No blocked time slots for this date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {blockedSlots.map((slot) => (
                      <Card key={slot.id}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{slot.time}</CardTitle>
                            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                              Blocked
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4">Reason: {slot.reason}</p>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => handleUnblockTime(slot.id)}
                            >
                              Unblock
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Block Time Dialog */}
      <Dialog open={isBlockTimeDialogOpen} onOpenChange={setIsBlockTimeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Block Time Slots</DialogTitle>
            <DialogDescription>
              Select date and time slots you want to mark as unavailable.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Select Date</Label>
              <DatePicker
                selected={selectedDate}
                onSelect={setSelectedDate}
                minDate={new Date()}
                maxDate={addDays(new Date(), 90)}
              />
            </div>

            <div className="space-y-2">
              <Label>Select Time Slots</Label>
              <div className="grid grid-cols-3 gap-2">
                {availableTimeSlots.map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    variant={selectedTimeSlots.includes(slot) ? "default" : "outline"}
                    onClick={() => handleTimeSlotToggle(slot)}
                    className={selectedTimeSlots.includes(slot) ? "bg-health-primary" : ""}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea 
                id="reason"
                placeholder="Why are you blocking these time slots?"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBlockTimeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBlockTimeSubmit} 
              disabled={isBlocking}
              className="bg-health-primary hover:bg-health-secondary"
            >
              {isBlocking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Block Time Slots"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Schedule;
