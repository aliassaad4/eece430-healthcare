import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Calendar, Clock, ArrowLeft, FileText, User, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { auth, db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { updateDocument, deleteDocument } from "@/services/firebase/firestore.service";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  reason?: string;
}

interface DoctorInfo {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  specialty?: string;
  phone?: string;
  phoneNumber?: string;
  yearsOfExperience?: number;
  bio?: string;
  clinic?: string;
  availability?: string;
  imageUrl?: string;
  ratings?: number;
}

const AppointmentDetails = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const loggedInPatientId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchAppointmentDetails = async () => {
      if (!appointmentId || !loggedInPatientId) return;

      setIsLoading(true);
      try {
        // Try to get the appointment from the main collection
        const appointmentRef = doc(db, "appointments", appointmentId);
        const appointmentDoc = await getDoc(appointmentRef);
        
        if (appointmentDoc.exists()) {
          const appointmentData = {
            id: appointmentDoc.id,
            ...appointmentDoc.data()
          } as Appointment;
          
          // Verify that this appointment belongs to the logged-in patient
          if (appointmentData.patientId !== loggedInPatientId) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to view this appointment.",
              variant: "destructive",
            });
            navigate("/patient/appointments");
            return;
          }
          
          setAppointment(appointmentData);
          
          // Fetch doctor information
          if (appointmentData.doctorId) {
            try {
              // First check user collection
              const userDocRef = doc(db, 'users', appointmentData.doctorId);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setDoctorInfo({
                  id: appointmentData.doctorId,
                  fullName: userData.fullName || userData.name,
                  email: userData.email,
                  specialty: userData.specialty,
                  phone: userData.phoneNumber || userData.phone,
                  yearsOfExperience: userData.yearsOfExperience,
                  bio: userData.bio,
                  clinic: userData.clinic,
                  ratings: userData.ratings
                });
              } else {
                // If not found in users, check doctors collection
                const doctorDocRef = doc(db, 'doctors', appointmentData.doctorId);
                const doctorDoc = await getDoc(doctorDocRef);
                
                if (doctorDoc.exists()) {
                  const doctorData = doctorDoc.data();
                  setDoctorInfo({
                    id: appointmentData.doctorId,
                    name: doctorData.name || doctorData.fullName,
                    email: doctorData.email,
                    specialty: doctorData.specialty,
                    phone: doctorData.phoneNumber || doctorData.phone,
                    yearsOfExperience: doctorData.yearsOfExperience,
                    bio: doctorData.bio,
                    clinic: doctorData.clinic,
                    ratings: doctorData.ratings
                  });
                }
              }
            } catch (error) {
              console.error("Error fetching doctor information:", error);
            }
          }
        } else {
          toast({
            title: "Appointment Not Found",
            description: "We couldn't find the requested appointment.",
            variant: "destructive",
          });
          navigate("/patient/appointments");
        }
      } catch (error) {
        console.error("Error fetching appointment details:", error);
        toast({
          title: "Error",
          description: "Failed to load appointment details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointmentDetails();
  }, [appointmentId, loggedInPatientId, navigate]);

  const handleRescheduleAppointment = () => {
    if (appointment) {
      navigate(`/patient/book-appointment?reschedule=${appointment.id}`);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment || !loggedInPatientId) return;

    setIsCancelling(true);
    try {
      // Delete the appointment
      await deleteDocument("appointments", appointment.id);
      
      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been successfully cancelled.",
      });
      
      setShowCancelDialog(false);
      
      // Navigate back to appointments page after a brief delay
      setTimeout(() => {
        navigate("/patient/appointments");
      }, 1500);
      
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Error",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      case "emergency":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const handleNavigateBack = () => {
    navigate(-1); // Go back to previous page
  };
  
  const handleViewDoctorProfile = () => {
    if (doctorInfo?.id) {
      navigate(`/patient/doctors/${doctorInfo.id}`);
    }
  };

  if (isLoading) {
    return (
      <Layout userRole="patient">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
          <span className="ml-3 text-lg">Loading appointment details...</span>
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
          Back
        </Button>

        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">Appointment Details</h1>
          <p className="text-muted-foreground">
            View the details of your upcoming appointment
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Appointment Details */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="border-b">
                <div className="flex justify-between items-center">
                  <CardTitle>Appointment Information</CardTitle>
                  <Badge className={getStatusColor(appointment?.status || "scheduled")}>
                    {appointment?.status?.charAt(0).toUpperCase() + appointment?.status?.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-health-primary" />
                      <span className="font-medium">
                        {appointment && format(new Date(appointment.date), "EEEE, MMMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-health-primary" />
                      <span>{appointment?.time}</span>
                    </div>
                  </div>

                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Specialty</p>
                    <p>{appointment?.specialty || doctorInfo?.specialty}</p>
                  </div>
                </div>

                {appointment?.reason && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Reason for Visit</p>
                    <p>{appointment.reason}</p>
                  </div>
                )}

                {appointment?.notes && (
                  <div className="bg-health-light p-4 rounded-md mt-4">
                    <p className="text-sm font-medium text-health-primary mb-2">Doctor's Notes</p>
                    <p className="text-sm">{appointment.notes}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 gap-2 flex-wrap justify-end">
                {(appointment?.status === "scheduled" || appointment?.status === "upcoming") && (
                  <>
                    <Button 
                      variant="outline" 
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Cancel Appointment
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={handleRescheduleAppointment}
                    >
                      Reschedule
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          </div>

          {/* Right Column - Doctor Information */}
          <div>
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Doctor Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-health-light h-12 w-12 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-health-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Dr. {doctorInfo?.fullName || doctorInfo?.name || appointment?.doctorName}</p>
                    <p className="text-sm text-muted-foreground">{doctorInfo?.specialty || appointment?.specialty}</p>
                  </div>
                </div>

                {doctorInfo?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{doctorInfo.email}</span>
                  </div>
                )}

                {(doctorInfo?.phone || doctorInfo?.phoneNumber) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{doctorInfo.phone || doctorInfo.phoneNumber}</span>
                  </div>
                )}

                {doctorInfo?.yearsOfExperience && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Experience</p>
                    <p>{doctorInfo.yearsOfExperience} years</p>
                  </div>
                )}

                {doctorInfo?.clinic && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Clinic</p>
                    <p>{doctorInfo.clinic}</p>
                  </div>
                )}

                {doctorInfo?.bio && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">About</p>
                    <p className="text-sm">{doctorInfo.bio}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button 
                  className="w-full bg-health-primary hover:bg-health-secondary"
                  onClick={handleViewDoctorProfile}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Doctor Profile
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Appointment with {doctorInfo?.fullName || doctorInfo?.name || appointment?.doctorName} on {appointment && format(new Date(appointment.date), "MMMM d, yyyy")} at {appointment?.time}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Appointment
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelAppointment}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : "Cancel Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AppointmentDetails;