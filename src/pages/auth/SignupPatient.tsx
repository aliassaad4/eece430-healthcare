import { useState, useEffect } from "react"; // Import useEffect
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
import { auth, db } from "@/config/firebase"; // Import auth and db
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged
import { doc, setDoc } from "firebase/firestore"; // Import doc and setDoc

// Form schema for Patient signup
const patientSignupSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid phone number" }),
  dateOfBirth: z.string().refine((date) => {
    return !isNaN(Date.parse(date));
  }, { message: "Please enter a valid date" }),
});

type PatientSignupFormValues = z.infer<typeof patientSignupSchema>;

const SignupPatient = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null); // State to track current user

  const form = useForm<PatientSignupFormValues>({
    resolver: zodResolver(patientSignupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phoneNumber: "",
      dateOfBirth: "",
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        navigate("/patient"); // Redirect if already logged in
      }
    });
    return () => unsubscribe(); // Cleanup listener on unmount
  }, [navigate]);

  const handleSignup = async (values: PatientSignupFormValues) => {
    setIsLoading(true);
    try {
      // 1. Create user with email and password using Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      console.log("Successfully signed up patient:", user);

      // 2. Store additional patient information in Firestore, including the role
      const userRef = doc(db, 'users', user.uid); // Create a DocumentReference with the user's uid as the ID
      await setDoc(userRef, {
        uid: user.uid,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        dateOfBirth: values.dateOfBirth,
        email: values.email,
        role: 'patient', // Save the role here
        // Add any other relevant information
      });
      console.log("Patient data stored in Firestore with role");

      setIsLoading(false);
      toast({
        title: "Account Created",
        description: "Your patient account has been created successfully. You are now logged in.",
      });

      // Navigation will now happen in the onAuthStateChanged listener
      // navigate("/patient");

    } catch (error: any) {
      console.error("Error signing up patient:", error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message, // Display the Firebase error message
      });
    }
  };

  const handleBackToLogin = () => {
    navigate("/auth/login/patient");
  };

  if (currentUser) {
    return null; // Or a loading indicator if needed, as the user is being redirected
  }

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
          <CardTitle className="text-2xl font-bold">Sign Up as Patient</CardTitle>
          <CardDescription>Create your patient account</CardDescription>
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
                      <Input placeholder="John Doe" {...field} />
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
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
              to="/auth/login/patient"
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

export default SignupPatient;