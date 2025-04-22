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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Calendar, Clock, ArrowLeft, FileText, User, Phone, Mail, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { auth, db } from "@/config/firebase";
import { doc, getDoc, updateDoc, addDoc, collection } from "firebase/firestore";
import { updateDocument } from "@/services/firebase/firestore.service";

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
  type?: string;
}

interface PatientInfo {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  dateOfBirth?: string;
  dob?: string;
  medicalConditions?: string[];
  allergies?: string[];
  bloodType?: string;
}

const AppointmentDetails = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const loggedInDoctorId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchAppointmentDetails = async () => {
      if (!appointmentId || !loggedInDoctorId) return;

      setIsLoading(true);
      try {
        // First try the nested collection structure
        const appointmentRef = doc(db, "appointments", loggedInDoctorId, "appointments", appointmentId);
        let appointmentDoc = await getDoc(appointmentRef);
        
        // If not found, try the main appointments collection
        if (!appointmentDoc.exists()) {
          const mainAppointmentRef = doc(db, "appointments", appointmentId);
          appointmentDoc = await getDoc(mainAppointmentRef);
        }
        
        if (appointmentDoc.exists()) {
          const appointmentData = {
            id: appointmentDoc.id,
            ...appointmentDoc.data()
          } as Appointment;
          
          setAppointment(appointmentData);
          setNotes(appointmentData.notes || "");
          
          // Fetch patient information
          if (appointmentData.patientId) {
            try {
              // First check user collection
              const userDocRef = doc(db, 'users', appointmentData.patientId);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setPatientInfo({
                  id: appointmentData.patientId,
                  fullName: userData.fullName || userData.name,
                  email: userData.email,
                  phone: userData.phoneNumber || userData.phone,
                  dateOfBirth: userData.dateOfBirth || userData.dob,
                  medicalConditions: userData.medicalConditions || [],
                  allergies: userData.allergies || [],
                  bloodType: userData.bloodType
                });
              } else {
                // If not found in users, check patients collection
                const patientDocRef = doc(db, 'patients', appointmentData.patientId);
                const patientDoc = await getDoc(patientDocRef);
                
                if (patientDoc.exists()) {
                  const patientData = patientDoc.data();
                  setPatientInfo({
                    id: appointmentData.patientId,
                    name: patientData.name,
                    email: patientData.email,
                    phone: patientData.phoneNumber || patientData.phone,
                    dateOfBirth: patientData.dateOfBirth || patientData.dob,
                    medicalConditions: patientData.medicalConditions || [],
                    allergies: patientData.allergies || [],
                    bloodType: patientData.bloodType
                  });
                }
              }
            } catch (error) {
              console.error("Error fetching patient information:", error);
            }
          }
        } else {
          toast({
            title: "Appointment Not Found",
            description: "We couldn't find the requested appointment.",
            variant: "destructive",
          });
          navigate("/doctor/appointments");
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
  }, [appointmentId, loggedInDoctorId, navigate]);

  const handleSaveNotes = async () => {
    if (!appointment || !loggedInDoctorId) return;

    setIsSaving(true);
    try {
      // Try updating in the nested structure first
      try {
        await updateDoc(doc(db, "appointments", loggedInDoctorId, "appointments", appointment.id), { 
          notes: notes
        });
      } catch (error) {
        // If fails, try main collection
        await updateDocument("appointments", appointment.id, { notes });
      }

      // Create a medical note record for easy access
      if (appointment.patientId) {
        try {
          // Fetch doctor information for the note
          const doctorInfo = await getDoc(doc(db, "users", loggedInDoctorId));
          const doctorData = doctorInfo.data();

          // Create the medical note
          const newNote = {
            patientId: appointment.patientId,
            doctorId: loggedInDoctorId,
            doctorName: doctorData?.fullName || doctorData?.name || appointment.doctorName,
            specialty: doctorData?.specialty || "General Practice",
            appointmentId: appointment.id,
            title: `Visit Notes - ${format(new Date(appointment.date), "PP")}`,
            date: format(new Date(appointment.date), "PP"),
            createdAt: new Date().toISOString(),
            summary: notes.length > 100 ? `${notes.substring(0, 100)}...` : notes,
            fullNote: notes
          };
          
          await addDoc(collection(db, "medicalNotes"), newNote);
        } catch (error) {
          console.error("Error creating medical note:", error);
        }
      }

      toast({
        title: "Notes Saved",
        description: "Medical notes have been saved successfully.",
      });
      
      // Update local state
      setAppointment({
        ...appointment,
        notes: notes
      });
      
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error",
        description: "Failed to save notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!appointment || !loggedInDoctorId) return;

    try {
      // Try updating in the nested structure first
      try {
        await updateDoc(doc(db, "appointments", loggedInDoctorId, "appointments", appointment.id), { 
          status: "completed" 
        });
      } catch (error) {
        // If fails, try main collection
        await updateDocument("appointments", appointment.id, { status: "completed" });
      }

      toast({
        title: "Appointment Completed",
        description: "Appointment has been marked as completed.",
      });
      
      // Update local state
      setAppointment({
        ...appointment,
        status: "completed"
      });
      
    } catch (error) {
      console.error("Error marking appointment as completed:", error);
      toast({
        title: "Error",
        description: "Failed to update appointment status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment || !loggedInDoctorId) return;

    try {
      // Try updating in the nested structure first
      try {
        await updateDoc(doc(db, "appointments", loggedInDoctorId, "appointments", appointment.id), { 
          status: "cancelled" 
        });
      } catch (error) {
        // If fails, try main collection
        await updateDocument("appointments", appointment.id, { status: "cancelled" });
      }

      toast({
        title: "Appointment Cancelled",
        description: "Appointment has been cancelled.",
      });
      
      // Update local state
      setAppointment({
        ...appointment,
        status: "cancelled"
      });
      
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Error",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
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
  
  const handleViewPatientProfile = () => {
    if (patientInfo?.id) {
      navigate(`/doctor/patients/medical-records/${patientInfo.id}`);
    }
  };

  if (isLoading) {
    return (
      <Layout userRole="doctor">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-health-primary" />
          <span className="ml-3 text-lg">Loading appointment details...</span>
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
          Back to Dashboard
        </Button>

        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">Appointment Details</h1>
          <p className="text-muted-foreground">
            View and manage details for this appointment
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
                    {appointment?.status.charAt(0).toUpperCase() + appointment?.status.slice(1)}
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
                    <p>{appointment?.specialty}</p>
                  </div>
                </div>

                {appointment?.reason && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Reason for Visit</p>
                    <p>{appointment.reason}</p>
                  </div>
                )}

                <div className="pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Medical Notes</p>
                  <Textarea
                    placeholder="Add notes about the appointment, diagnosis, treatment, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 gap-2 flex-wrap justify-between">
                <div>
                  {appointment?.status !== "cancelled" && appointment?.status !== "completed" && (
                    <Button 
                      variant="outline" 
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={handleCancelAppointment}
                    >
                      Cancel Appointment
                    </Button>
                  )}
                </div>
                <div className="space-x-2">
                  {appointment?.status !== "completed" && appointment?.status !== "cancelled" && (
                    <Button 
                      variant="outline" 
                      className="border-green-200 text-green-600 hover:bg-green-50"
                      onClick={handleMarkCompleted}
                    >
                      Mark as Completed
                    </Button>
                  )}
                  <Button 
                    className="bg-health-primary hover:bg-health-secondary" 
                    onClick={handleSaveNotes}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : "Save Notes"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Right Column - Patient Information */}
          <div>
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Patient Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-health-light h-12 w-12 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-health-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{patientInfo?.fullName || patientInfo?.name || appointment?.patientName}</p>
                    <p className="text-sm text-muted-foreground">Patient</p>
                  </div>
                </div>

                {patientInfo?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{patientInfo.email}</span>
                  </div>
                )}

                {(patientInfo?.phone || patientInfo?.phoneNumber) && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{patientInfo.phone || patientInfo.phoneNumber}</span>
                  </div>
                )}

                {(patientInfo?.dateOfBirth || patientInfo?.dob) && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                    <p>{patientInfo.dateOfBirth || patientInfo.dob}</p>
                  </div>
                )}

                {patientInfo?.medicalConditions && patientInfo.medicalConditions.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Medical Conditions</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patientInfo.medicalConditions.map((condition, index) => (
                        <Badge key={index} variant="outline" className="bg-red-50 text-red-600 border-red-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {patientInfo?.allergies && patientInfo.allergies.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Allergies</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patientInfo.allergies.map((allergy, index) => (
                        <Badge key={index} variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {patientInfo?.bloodType && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Blood Type</p>
                    <Badge variant="outline">{patientInfo.bloodType}</Badge>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button 
                  className="w-full bg-health-primary hover:bg-health-secondary"
                  onClick={handleViewPatientProfile}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Full Medical Records
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AppointmentDetails;