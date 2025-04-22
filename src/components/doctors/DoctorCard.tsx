import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { getDocuments, queryConstraints } from "@/services/firebase/firestore.service";

interface Doctor {
  id: string;
  fullName?: string;
  displayName?: string;
  name?: string; // Fallback
  specialty?: string;
  imageUrl?: string;
  ratings?: number;
  yearsOfExperience?: number;
  reviewCount?: number;
  availability?: string[];
  bio?: string;
}

interface DoctorCardProps {
  doctor: Doctor;
  onBookAppointment: (doctorId: string) => void;
}

export const DoctorCard = ({ doctor, onBookAppointment }: DoctorCardProps) => {
  const [availableSlots, setAvailableSlots] = useState<number>(0);
  
  // Get the doctor's name using the available properties
  const doctorName = doctor.fullName || doctor.displayName || doctor.name || "Dr. Unknown";
  
  // Format years of experience
  const experience = doctor.yearsOfExperience 
    ? `${doctor.yearsOfExperience} ${doctor.yearsOfExperience === 1 ? 'year' : 'years'}`
    : "Not specified";
  
  // Get rating with default
  const rating = doctor.ratings || 4.0;

  // Fetch available slots for today
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      try {
        const today = new Date().toLocaleDateString();
        const slotsData = await getDocuments("scheduleSlots", [
          queryConstraints.whereEquals("doctorId", doctor.id),
          queryConstraints.whereEquals("day", today),
          queryConstraints.whereEquals("isAvailable", true),
          queryConstraints.whereEquals("isBlocked", false)
        ]);
        setAvailableSlots(slotsData.length);
      } catch (error) {
        console.error("Error fetching available slots:", error);
        setAvailableSlots(0);
      }
    };
    
    fetchAvailableSlots();
  }, [doctor.id]);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <CardTitle className="text-lg">{doctorName}</CardTitle>
            <CardDescription>{doctor.specialty || "General Practice"}</CardDescription>
          </div>
          <Badge variant="outline" className="bg-health-light">
            ⭐ {rating.toFixed(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-16 w-16 bg-health-light rounded-full flex items-center justify-center">
            {doctor.imageUrl ? (
              <img 
                src={doctor.imageUrl} 
                alt={doctorName} 
                className="h-full w-full rounded-full object-cover" 
              />
            ) : (
              <span className="text-xl font-bold text-health-primary">
                {doctorName.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Experience</p>
            <p className="font-medium">{experience}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-health-primary" />
          <span>
            {availableSlots} {availableSlots === 1 ? 'slot' : 'slots'} available today
          </span>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          className="w-full bg-health-primary hover:bg-health-secondary"
          onClick={() => onBookAppointment(doctor.id)}
        >
          Book Appointment
        </Button>
      </CardFooter>
    </Card>
  );
};
