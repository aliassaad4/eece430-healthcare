
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUp, Calendar, Clock, User } from "lucide-react";

interface WaitlistCardProps {
  waitlistItem: {
    id: string;
    doctorName: string;
    specialty: string;
    requestDate: string;
    urgency: "low" | "medium" | "high";
    position: number;
    estimatedWaitTime?: string;
  };
  onCancelWaitlist: (id: string) => void;
  onUpgradeToEmergency?: (id: string) => void;
}

export const WaitlistCard = ({ 
  waitlistItem, 
  onCancelWaitlist,
  onUpgradeToEmergency
}: WaitlistCardProps) => {
  
  const urgencyColors = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-health-error text-white"
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md border-l-4 border-l-health-primary">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">Waitlist Position: {waitlistItem.position}</CardTitle>
          <Badge className={urgencyColors[waitlistItem.urgency]}>
            {waitlistItem.urgency.charAt(0).toUpperCase() + waitlistItem.urgency.slice(1)} Priority
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-health-primary" />
          <span className="font-medium">{waitlistItem.doctorName}</span>
          <span className="text-sm text-gray-500">({waitlistItem.specialty})</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-health-primary" />
          <span>Requested on: {waitlistItem.requestDate}</span>
        </div>
        
        {waitlistItem.estimatedWaitTime && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-health-primary" />
            <span>Est. wait time: {waitlistItem.estimatedWaitTime}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 bg-health-light p-2 rounded-md">
          <AlertTriangle className="h-4 w-4 text-health-primary" />
          <span className="text-sm">You'll be notified when a slot becomes available</span>
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onCancelWaitlist(waitlistItem.id)}
        >
          Leave Waitlist
        </Button>
        
        {waitlistItem.urgency !== "high" && onUpgradeToEmergency && (
          <Button 
            className="bg-health-error hover:bg-red-600 text-white"
            size="sm"
            onClick={() => onUpgradeToEmergency(waitlistItem.id)}
          >
            <ArrowUp className="h-3 w-3 mr-1" />
            Emergency
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
