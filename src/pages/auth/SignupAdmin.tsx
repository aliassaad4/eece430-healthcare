import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase"; // Import auth and db
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"; // Added updateProfile
import { doc, setDoc } from "firebase/firestore"; // Changed to doc and setDoc

// **Important Security Note:** Storing the admin key directly in the frontend is NOT recommended for production.
// This is for demonstration purposes only. In a real application, you should verify the admin key on a secure backend.
const VALID_ADMIN_KEY = "yourSecureAdminKey123";

// Form schema for Admin signup
const adminSignupSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  adminKey: z.string().min(8, { message: "Admin key must be at least 8 characters" }),
});

type AdminSignupFormValues = z.infer<typeof adminSignupSchema>;

const SignupAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AdminSignupFormValues>({
    resolver: zodResolver(adminSignupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      adminKey: "",
    },
  });

  const handleSignup = async (values: AdminSignupFormValues) => {
    setIsLoading(true);

    if (values.adminKey !== VALID_ADMIN_KEY) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: "Invalid administrator key.",
      });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Create user with email and password using Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      console.log("Successfully signed up admin:", user);
      
      // Set display name
      await updateProfile(user, {
        displayName: values.fullName
      });

      // 2. Store additional admin information in Firestore, including the role
      // Use setDoc with user.uid as the document ID instead of addDoc
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        fullName: values.fullName,
        email: values.email,
        role: 'admin', // Save the role here
        createdAt: new Date(),
        status: 'active'
      });
      
      console.log("Admin data stored in Firestore with role using UID as document ID");

      setIsLoading(false);
      toast({
        title: "Account Created",
        description: "Your administrator account has been created successfully.",
      });

      // Navigate to the admin dashboard
      navigate("/admin");

    } catch (error: any) {
      console.error("Error signing up admin:", error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message,
      });
    }
  };

  const handleBackToLogin = () => {
    navigate("/auth/login/admin");
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
          <CardTitle className="text-2xl font-bold">Sign Up as Admin</CardTitle>
          <CardDescription>Create your administrator account</CardDescription>
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
                      <Input placeholder="Admin Name" {...field} />
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
                      <Input placeholder="admin@example.com" {...field} />
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
                name="adminKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center">
                        Admin Key
                        <Shield className="h-4 w-4 ml-1 text-primary" />
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter administrator key" {...field} />
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
              to="/auth/login/admin"
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

export default SignupAdmin;