import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase"; // Import auth and db from your config
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"; // Added updateProfile 
import { doc, setDoc } from "firebase/firestore"; // Changed to doc and setDoc

// Form schema for Doctor signup
const doctorSignupSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid phone number" }),
  specialty: z.string().min(2, { message: "Please enter your specialty" }),
  licenseNumber: z.string().min(4, { message: "Please enter a valid license number" }),
  clinicName: z.string().optional(),
});

type DoctorSignupFormValues = z.infer<typeof doctorSignupSchema>;

const SignupDoctor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<DoctorSignupFormValues>({
    resolver: zodResolver(doctorSignupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phoneNumber: "",
      specialty: "",
      licenseNumber: "",
      clinicName: "",
    },
  });

  const handleSignup = async (values: DoctorSignupFormValues) => {
    setIsLoading(true);
    try {
      // 1. Create user with email and password using Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      console.log("Successfully signed up doctor:", user);
      
      // Set display name
      await updateProfile(user, {
        displayName: values.fullName
      });

      // 2. Store additional doctor information in Firestore, including the role
      // Use setDoc with user.uid as the document ID instead of addDoc
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        specialty: values.specialty,
        licenseNumber: values.licenseNumber,
        clinicName: values.clinicName || "",
        email: values.email,
        role: 'doctor', // Save the role here
        createdAt: new Date(),
        status: 'active'
      });
      console.log("Doctor data stored in Firestore with role using UID as document ID");

      setIsLoading(false);
      toast({
        title: "Account Created",
        description: "Your doctor account has been created successfully.",
      });
      navigate("/doctor"); // Redirect to the doctor dashboard

    } catch (error: any) {
      console.error("Error signing up doctor:", error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message, // Display the Firebase error message
      });
    }
  };

  const handleBackToLogin = () => {
    navigate("/auth/login/doctor");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4"
              onClick={handleBackToLogin}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Login
            </Button>
          </div>
          <CardTitle className="text-2xl font-bold">Sign Up as Doctor</CardTitle>
          <CardDescription>Create your healthcare provider account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Jane Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="(123) 456-7890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Specialty</FormLabel>
                    <FormControl>
                      <Input placeholder="Cardiology" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number</FormLabel>
                    <FormControl>
                      <Input placeholder="MED12345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clinicName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="City Medical Center" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <div className="text-sm text-center w-full">
            Already have an account?{" "}
            <Link
              to="/auth/login/doctor"
              className="text-primary font-medium hover:underline"
            >
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SignupDoctor;