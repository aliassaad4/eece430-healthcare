import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, User, Shield, Mail, Key } from "lucide-react";
import { auth, db, storage } from "@/config/firebase";
import { 
  updateProfile, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updateEmail
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getUserRole } from "@/hooks/use-session";

// Form schema for profile information
const profileFormSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" })
});

// Form schema for changing password
const passwordFormSchema = z.object({
  currentPassword: z.string().min(6, { message: "Current password is required" }),
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string().min(8, { message: "Please confirm your new password" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface UserData {
  fullName: string;
  email: string;
  photoURL?: string;
  role?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  
  const userRole = getUserRole() || "patient";
  
  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
    },
  });
  
  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Fetch user data from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          // Get user data from Firestore if it exists
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userData: UserData;
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            userData = {
              fullName: data.fullName || currentUser.displayName || '',
              email: data.email || currentUser.email || '',
              photoURL: data.photoURL || currentUser.photoURL || '',
              role: data.role
            };
          } else {
            userData = {
              fullName: currentUser.displayName || '',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || ''
            };
          }
          
          setUserData(userData);
          
          // Set form default values
          profileForm.reset({
            fullName: userData.fullName,
            email: userData.email,
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load your profile information.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [toast, profileForm]);
  
  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to upload an image.",
      });
      return;
    }
    
    const file = e.target.files[0];
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Create storage reference
      const storageRef = ref(storage, `profile-images/${currentUser.uid}/${file.name}`);
      
      // Upload file with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed', 
        (snapshot) => {
          // Track progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload your profile image.",
          });
          setUploading(false);
        },
        async () => {
          // Upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Update auth profile
          await updateProfile(currentUser, {
            photoURL: downloadURL
          });
          
          // Update Firestore document if it exists
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            await updateDoc(userDocRef, {
              photoURL: downloadURL
            });
          }
          
          // Update state
          setUserData(prev => prev ? {...prev, photoURL: downloadURL} : null);
          
          toast({
            title: "Success",
            description: "Your profile image has been updated.",
          });
          setUploading(false);
        }
      );
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "An error occurred while uploading your profile image.",
      });
      setUploading(false);
    }
  };
  
  // Handle profile form submission
  const onProfileSubmit = async (values: ProfileFormValues) => {
    setSaving(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          variant: "destructive", 
          title: "Authentication Error", 
          description: "You must be logged in to update your profile."
        });
        return;
      }
      
      // Check if email is being changed
      if (values.email !== currentUser.email) {
        // Email update requires recent authentication
        // In a production app, you should prompt for password and reauthenticate
        // This is a simplified example
        try {
          await updateEmail(currentUser, values.email);
        } catch (error: any) {
          console.error("Email update error:", error);
          if (error.code === 'auth/requires-recent-login') {
            toast({
              variant: "destructive",
              title: "Authentication Required",
              description: "Please log out and log back in to change your email address.",
            });
          } else {
            toast({
              variant: "destructive", 
              title: "Email Update Failed", 
              description: error.message
            });
          }
          setSaving(false);
          return;
        }
      }
      
      // Update display name in auth profile
      if (values.fullName !== currentUser.displayName) {
        await updateProfile(currentUser, {
          displayName: values.fullName
        });
      }
      
      // Update user document in Firestore if it exists
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          fullName: values.fullName,
          email: values.email
        });
      }
      
      // Update local state
      setUserData(prev => prev ? {...prev, fullName: values.fullName, email: values.email} : null);
      
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update your profile information.",
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Handle password form submission
  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setSaving(true);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        toast({
          variant: "destructive", 
          title: "Authentication Error", 
          description: "You must be logged in to change your password."
        });
        return;
      }
      
      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(
        currentUser.email, 
        values.currentPassword
      );
      
      try {
        await reauthenticateWithCredential(currentUser, credential);
      } catch (error) {
        console.error("Reauthentication error:", error);
        toast({
          variant: "destructive", 
          title: "Authentication Failed", 
          description: "Your current password is incorrect."
        });
        setSaving(false);
        return;
      }
      
      // Update password
      await updatePassword(currentUser, values.newPassword);
      
      // Clear form
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
    } catch (error: any) {
      console.error("Password change error:", error);
      toast({
        variant: "destructive", 
        title: "Password Change Failed", 
        description: error.message || "Failed to update your password."
      });
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Layout userRole={userRole}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout userRole={userRole}>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <div className="grid gap-6">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and profile picture
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={userData?.photoURL || ""} />
                      <AvatarFallback className="bg-primary text-white text-xl">
                        {userData?.fullName ? getInitials(userData.fullName) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="picture" className="text-sm font-medium">
                          Profile Picture
                        </Label>
                        {uploading && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(uploadProgress)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => document.getElementById('picture-upload')?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Uploading..." : "Upload"}
                        </Button>
                        <input
                          id="picture-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG or GIF, max 2MB
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Profile Form */}
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Your name" 
                                {...field}
                                icon={<User className="h-4 w-4 text-muted-foreground" />}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="your.email@example.com" 
                                {...field}
                                icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                              />
                            </FormControl>
                            <FormDescription>
                              This is the email address you'll use to log in
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {userData?.role && (
                        <div className="flex items-center gap-2 py-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Role: <span className="font-medium capitalize">{userData.role}</span>
                          </span>
                        </div>
                      )}
                      
                      <Button type="submit" disabled={saving || !profileForm.formState.isDirty}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="security">
            <div className="grid gap-6">
              {/* Password Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                {...field} 
                                icon={<Key className="h-4 w-4 text-muted-foreground" />}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                {...field}
                                icon={<Key className="h-4 w-4 text-muted-foreground" />}
                              />
                            </FormControl>
                            <FormDescription>
                              Password must be at least 8 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="••••••••" 
                                {...field}
                                icon={<Key className="h-4 w-4 text-muted-foreground" />}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button type="submit" disabled={saving || !passwordForm.formState.isDirty}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}