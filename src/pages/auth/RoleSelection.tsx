
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, Settings, Heart } from "lucide-react";

const RoleSelection = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (selectedRole) {
      navigate(`/auth/login/${selectedRole}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to HealthEase Pro</CardTitle>
          <CardDescription>Please select your role to continue</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card 
              className={`cursor-pointer border-2 ${
                selectedRole === "patient" ? "border-primary" : "border-gray-200"
              } hover:border-primary hover:shadow-md transition-all`}
              onClick={() => handleRoleSelect("patient")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6">
                <Heart className="h-12 w-12 text-primary mb-2" />
                <h3 className="font-medium">Patient</h3>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer border-2 ${
                selectedRole === "doctor" ? "border-primary" : "border-gray-200"
              } hover:border-primary hover:shadow-md transition-all`}
              onClick={() => handleRoleSelect("doctor")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6">
                <Stethoscope className="h-12 w-12 text-primary mb-2" />
                <h3 className="font-medium">Doctor</h3>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer border-2 ${
                selectedRole === "admin" ? "border-primary" : "border-gray-200"
              } hover:border-primary hover:shadow-md transition-all`}
              onClick={() => handleRoleSelect("admin")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6">
                <Settings className="h-12 w-12 text-primary mb-2" />
                <h3 className="font-medium">Admin</h3>
              </CardContent>
            </Card>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleContinue}
            disabled={!selectedRole}
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RoleSelection;
