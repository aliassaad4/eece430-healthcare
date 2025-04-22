import { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, parseISO, isToday, isSameDay, startOfWeek, addDays, startOfMonth, endOfMonth, getDay, getDate, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowDown } from "lucide-react";

export interface CalendarAppointment {
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

interface AppointmentCalendarProps {
  appointments: CalendarAppointment[];
  userRole: "doctor" | "patient" | "admin";
  onViewAppointment?: (appointmentId: string) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  onAddNotes?: (appointmentId: string, notes: string) => void;
}

const AppointmentCalendar = ({
  appointments,
  userRole,
  onViewAppointment,
  onCancelAppointment,
  onAddNotes,
}: AppointmentCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [appointmentsMap, setAppointmentsMap] = useState<Record<string, CalendarAppointment[]>>({});
  const [appointmentsForSelectedDate, setAppointmentsForSelectedDate] = useState<CalendarAppointment[]>([]);
  const [notes, setNotes] = useState('');
  const detailsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  // Group appointments by date for efficient lookup
  useEffect(() => {
    const appointmentsByDate: Record<string, CalendarAppointment[]> = {};
    
    appointments.forEach(appointment => {
      const dateKey = new Date(appointment.date).toISOString().split('T')[0];
      if (!appointmentsByDate[dateKey]) {
        appointmentsByDate[dateKey] = [];
      }
      appointmentsByDate[dateKey].push(appointment);
    });
    
    setAppointmentsMap(appointmentsByDate);
  }, [appointments]);

  // Filter appointments for the selected date
  useEffect(() => {
    if (!selectedDate) return;
    
    const dateKey = selectedDate.toISOString().split('T')[0];
    const filteredAppointments = appointmentsMap[dateKey] || [];
    
    // Sort by time
    filteredAppointments.sort((a, b) => {
      return a.time.localeCompare(b.time);
    });
    
    setAppointmentsForSelectedDate(filteredAppointments);
    
    // Scroll to details section with a slight delay for visual feedback
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [selectedDate, appointmentsMap]);

  const handleDateSelect = (date: Date | undefined) => {
    console.log("Date selected:", date);
    setSelectedDate(date);
  };

  const handleAppointmentClick = (appointmentId: string) => {
    if (onViewAppointment) {
      onViewAppointment(appointmentId);
    } else {
      // If no callback is provided, use default navigation
      navigate(`/${userRole}/appointment-details/${appointmentId}`);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAppointment(null);
  };

  const handleSaveNotes = () => {
    if (selectedAppointment && onAddNotes) {
      onAddNotes(selectedAppointment.id, notes);
    }
    setIsDialogOpen(false);
  };

  const handleCancelAppointment = () => {
    if (selectedAppointment && onCancelAppointment) {
      onCancelAppointment(selectedAppointment.id);
    }
    setIsDialogOpen(false);
  };

  // Navigate to previous month
  const prevMonth = () => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(date);
  };

  // Navigate to next month
  const nextMonth = () => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(date);
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // Get the status badge color
  const getStatusColor = (status: CalendarAppointment['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-gray-500';
      case 'emergency':
        return 'bg-red-500';
      case 'upcoming':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Generate month days
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    
    const weeks = [];
    let days = [];
    let day = startDate;
    
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    // Add weekday headers
    const weekdayHeader = (
      <div className="grid grid-cols-7 gap-px bg-gray-100" key="weekdays">
        {weekdays.map((weekday) => (
          <div key={weekday} className="p-2 text-center font-medium text-sm text-gray-700">
            {weekday}
          </div>
        ))}
      </div>
    );
    
    // Generate calendar days
    while (day <= monthEnd) {
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(day); // Create a new date object to avoid reference issues
        const dateKey = currentDay.toISOString().split('T')[0];
        const dayAppointments = appointmentsMap[dateKey] || [];
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isSelectedDate = selectedDate && isSameDay(currentDay, selectedDate);
        const isTodays = isToday(currentDay);
        const hasAppointments = dayAppointments.length > 0;
        
        days.push(
          <div 
            key={currentDay.toString()} 
            className={cn(
              "h-28 p-1 border border-gray-200 relative transition-all cursor-pointer",
              isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400",
              isSelectedDate ? "border-2 border-health-primary ring-2 ring-health-primary/20" : "",
              isTodays ? "bg-health-light" : "",
              hasAppointments && !isSelectedDate ? "hover:bg-blue-50" : "",
              "hover:shadow-md"
            )}
            onClick={() => handleDateSelect(new Date(currentDay))}
          >
            <div className={cn(
              "absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full text-xs",
              isTodays ? "bg-health-primary text-white" : "",
              hasAppointments && !isTodays ? "font-semibold" : ""
            )}>
              {getDate(currentDay)}
            </div>
            
            {hasAppointments && (
              <div className="absolute top-2 left-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isSelectedDate ? "bg-health-primary" : "bg-blue-500"
                )}></div>
              </div>
            )}
            
            <div className="mt-6 space-y-1 overflow-y-auto max-h-20 scrollbar-thin">
              {dayAppointments.slice(0, 3).map((appointment, index) => (
                <div
                  key={appointment.id}
                  className={cn(
                    "text-xs p-1 rounded-sm truncate cursor-pointer transform transition-transform",
                    getStatusColor(appointment.status),
                    "hover:scale-[1.02] active:scale-[0.98]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAppointmentClick(appointment.id);
                  }}
                >
                  <span className="text-white">
                    {appointment.time} - {userRole === "doctor" ? appointment.patientName?.split(' ')[0] : appointment.doctorName?.split(' ')[0]}
                  </span>
                </div>
              ))}
              {dayAppointments.length > 3 && (
                <div 
                  className="text-xs font-medium text-blue-600 pl-1 hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDateSelect(new Date(currentDay));
                  }}
                >
                  +{dayAppointments.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        
        day = addDays(day, 1);
      }
      
      weeks.push(
        <div className="grid grid-cols-7 gap-px" key={day.toString()}>
          {days}
        </div>
      );
      
      days = [];
    }
    
    return (
      <div className="space-y-1">
        {weekdayHeader}
        {weeks}
      </div>
    );
  };

  const hasAppointmentsOnSelectedDate = appointmentsForSelectedDate.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Full-Page Calendar */}
          <div className="p-2">
            {renderCalendar()}
          </div>
          
          {/* Visual indicator to show there are details below */}
          {hasAppointmentsOnSelectedDate && (
            <div className="flex justify-center pb-2 animate-bounce">
              <ArrowDown className="h-5 w-5 text-health-primary" />
            </div>
          )}
        </div>
        
        {/* Selected Day Appointments */}
        <div ref={detailsRef}>
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center">
                {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
                {isToday(selectedDate || new Date()) && (
                  <Badge className="ml-2 bg-health-primary">Today</Badge>
                )}
                {hasAppointmentsOnSelectedDate && (
                  <Badge className="ml-2 bg-blue-500">{appointmentsForSelectedDate.length} Appointment{appointmentsForSelectedDate.length !== 1 ? 's' : ''}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsForSelectedDate.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {appointmentsForSelectedDate.map((appointment) => (
                    <div 
                      key={appointment.id}
                      className="p-3 cursor-pointer hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => handleAppointmentClick(appointment.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium flex items-center gap-1">
                            <span className="text-health-primary">{appointment.time}</span>
                            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
                              {format(new Date(appointment.date), 'EEE')}
                            </span>
                          </p>
                          {userRole === "doctor" ? (
                            <p className="text-sm text-gray-600">
                              Patient: {appointment.patientName || 'Unknown'}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-600">
                              Doctor: {appointment.doctorName || 'Unknown'}
                            </p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">
                            {appointment.specialty}
                          </p>
                        </div>
                        <Badge className={cn(getStatusColor(appointment.status), "text-white")}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 text-gray-500">
                  No appointments scheduled for this day.
                  {userRole === "patient" && (
                    <p className="mt-2">
                      <Button variant="link" className="text-health-primary p-0">
                        Book an appointment
                      </Button>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointment Detail Dialog */}
      {selectedAppointment && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Appointment Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-health-light rounded-lg p-3">
                <h3 className="font-medium text-health-primary">Date & Time</h3>
                <p className="text-lg">
                  {format(new Date(selectedAppointment.date), 'EEEE, MMMM d, yyyy')} 
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium">{selectedAppointment.time}</span>
                  <Badge className="bg-health-primary/20 text-health-primary hover:bg-health-primary/30">
                    {format(new Date(selectedAppointment.date), 'E')}
                  </Badge>
                  <Badge variant="outline" className="ml-auto">
                    Week {format(new Date(selectedAppointment.date), 'w')}
                  </Badge>
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">Status</h3>
                <Badge className={cn(getStatusColor(selectedAppointment.status), "text-white")}>
                  {selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}
                </Badge>
              </div>
              
              {userRole === "doctor" ? (
                <div>
                  <h3 className="font-medium">Patient</h3>
                  <p>{selectedAppointment.patientName || 'Unknown Patient'}</p>
                </div>
              ) : (
                <div>
                  <h3 className="font-medium">Doctor</h3>
                  <p>{selectedAppointment.doctorName || 'Unknown Doctor'}</p>
                </div>
              )}
              
              <div>
                <h3 className="font-medium">Specialty</h3>
                <p>{selectedAppointment.specialty}</p>
              </div>
              
              {userRole === "doctor" && (
                <div>
                  <h3 className="font-medium">Notes</h3>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes about this appointment..."
                  />
                </div>
              )}
              
              {userRole === "patient" && selectedAppointment.notes && (
                <div>
                  <h3 className="font-medium">Doctor's Notes</h3>
                  <p className="p-2 bg-gray-50 border rounded-md">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex justify-between">
              {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                <Button variant="destructive" onClick={handleCancelAppointment}>
                  Cancel Appointment
                </Button>
              )}
              
              {userRole === "doctor" ? (
                <Button className="bg-health-primary hover:bg-health-secondary" onClick={handleSaveNotes}>
                  Save Notes
                </Button>
              ) : (
                <Button className="bg-health-primary hover:bg-health-secondary" onClick={handleCloseDialog}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AppointmentCalendar;