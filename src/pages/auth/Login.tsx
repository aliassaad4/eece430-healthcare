import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { loginUser } from "@/hooks/use-session"; // Import the loginUser helper

// Form schema for login
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const getRoleTitle = (role: string) => {
  switch (role) {
    case "patient":
      return "Patient";
    case "doctor":
      return "Doctor";
    case "admin":
      return "Administrator";
    default:
      return "User";
  }
};

const Login = () => {
  const { role: expectedRole } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLogin = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      // First, authenticate with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      if (user) {
        try {
          // Method 1: Try to get user by document ID (uid)
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          let userData;
          let userRole;
          
          if (userDocSnap.exists()) {
            // Found user document by ID
            userData = userDocSnap.data();
            userRole = userData?.role;
          } else {
            // Method 2: If not found by ID, try to query by uid field
            console.log("User document not found by ID, trying to query by uid field");
            const usersCollection = collection(db, 'users');
            const q = query(usersCollection, where('uid', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              // Found user document by querying uid field
              userData = querySnapshot.docs[0].data();
              userRole = userData?.role;
            } else {
              // Method 3: Fallback - Create a minimal user profile if none exists
              console.log("No user document found, creating fallback user data");
              userRole = expectedRole || "patient"; // Use expected role from URL or default to patient
              
              // This is a fallback - ideally we'd create a proper user document here
              userData = {
                fullName: user.displayName || "User",
                email: user.email,
                role: userRole
              };
            }
          }
          
          // Now we should have userData one way or another
          setIsLoading(false);
          toast({
            title: "Login Successful",
            description: `Welcome back! You've been logged in as a ${getRoleTitle(userRole || "user")}.`,
          });

          // Call the loginUser helper to set session data
          loginUser(userRole, values.email);

          // Navigate based on the fetched userRole
          if (userRole === "patient") {
            navigate("/patient");
          } else if (userRole === "doctor") {
            navigate("/doctor");
          } else if (userRole === "admin") {
            navigate("/admin");
          } else {
            navigate("/dashboard"); // Fallback route
          }
          
        } catch (err) {
          console.error("Error retrieving user data:", err);
          setIsLoading(false);
          toast({
            variant: "destructive",
            title: "Login Error",
            description: "There was a problem retrieving your account information.",
          });
        }
      } else {
        setIsLoading(false);
        toast({
          variant: "destructive",
          title: "Login Error",
          description: "Authentication failed.",
        });
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid email or password", 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToRoleSelection = () => {
    navigate("/auth");
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
              onClick={handleBackToRoleSelection}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <CardTitle className="text-2xl font-bold">Login as {getRoleTitle(expectedRole || "")}</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
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

              <Button
                type="submit"
                className="w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Log in"
                )}
              </Button>

              <div className="text-center mt-2">
                <Link
                  to="/auth/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <div className="text-sm text-center w-full">
            Don't have an account?{" "}
            {expectedRole === "patient" && (
              <Link
                to="/auth/signup/patient"
                className="text-primary font-medium hover:underline"
              >
                Sign up as Patient
              </Link>
            )}
            {expectedRole === "doctor" && (
              <Link
                to="/auth/signup/doctor"
                className="text-primary font-medium hover:underline"
              >
                Sign up as Doctor
              </Link>
            )}
            {expectedRole === "admin" && (
              <Link
                to="/auth/signup/admin"
                className="text-primary font-medium hover:underline"
              >
                Sign up as Admin
              </Link>
            )}
            {expectedRole !== "patient" && expectedRole !== "doctor" && expectedRole !== "admin" && (
              <>
                <Link
                  to="/auth/signup/patient"
                  className="text-primary font-medium hover:underline mr-2"
                >
                  Sign up as Patient
                </Link>
                |
                <Link
                  to="/auth/signup/doctor"
                  className="text-primary font-medium hover:underline ml-2 mr-2"
                >
                  Sign up as Doctor
                </Link>
                |
                <Link
                  to="/auth/signup/admin"
                  className="text-primary font-medium hover:underline ml-2"
                >
                  Sign up as Admin
                </Link>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;