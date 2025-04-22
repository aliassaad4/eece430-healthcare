import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, Mail, Phone, Bell, Shield, LogOut, Trash2, Check, Loader2, Briefcase, Building, Award, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/config/firebase";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser, signOut } from "firebase/auth";

const DoctorSettings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    address: "",
    specialty: "",
    yearsOfExperience: "",
    clinicName: "",
    workingHours: "",
  });
  
  const [formData, setFormData] = useState({ ...profileData });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailReminders: true,
    smsReminders: true,
    emergencyAlerts: true,
    patientUpdates: true,
    newsletterUpdates: false
  });

  const specialties = [
    "Cardiology",
    "Dermatology",
    "Endocrinology",
    "Gastroenterology", 
    "General Practice",
    "Neurology", 
    "Obstetrics & Gynecology",
    "Ophthalmology",
    "Orthopedics", 
    "Pediatrics", 
    "Psychiatry",
    "Radiology",
    "Urology"
  ];

  // Fetch doctor data from Firestore
  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        setIsLoadingProfile(true);
        const currentUser = auth.currentUser;
        if (!currentUser) {
          toast({
            title: "Authentication Error",
            description: "You need to be logged in to view this page",
            variant: "destructive"
          });
          return;
        }
        
        // Get user document from Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          
          // Set profile data based on Firestore document
          setProfileData({
            fullName: userData.fullName || currentUser.displayName || "",
            email: userData.email || currentUser.email || "",
            phoneNumber: userData.phoneNumber || userData.phone || "",
            address: userData.address || "",
            specialty: userData.specialty || "",
            yearsOfExperience: userData.yearsOfExperience?.toString() || "",
            clinicName: userData.clinicName || userData.clinic || "",
            workingHours: userData.workingHours || userData.availability || "",
          });
          
          // Also update the form data
          setFormData({
            fullName: userData.fullName || currentUser.displayName || "",
            email: userData.email || currentUser.email || "",
            phoneNumber: userData.phoneNumber || userData.phone || "",
            address: userData.address || "",
            specialty: userData.specialty || "",
            yearsOfExperience: userData.yearsOfExperience?.toString() || "",
            clinicName: userData.clinicName || userData.clinic || "",
            workingHours: userData.workingHours || userData.availability || "",
          });
          
          // Set notification settings if available
          if (userData.notificationSettings) {
            setNotificationSettings(userData.notificationSettings);
          }

        } else {
          // Try checking doctors collection as fallback
          const doctorDocRef = doc(db, 'doctors', currentUser.uid);
          const doctorDocSnap = await getDoc(doctorDocRef);
          
          if (doctorDocSnap.exists()) {
            const doctorData = doctorDocSnap.data();
            
            setProfileData({
              fullName: doctorData.name || doctorData.fullName || currentUser.displayName || "",
              email: doctorData.email || currentUser.email || "",
              phoneNumber: doctorData.phone || doctorData.phoneNumber || "",
              address: doctorData.address || "",
              specialty: doctorData.specialty || "",
              yearsOfExperience: doctorData.yearsOfExperience?.toString() || doctorData.experience?.toString() || "",
              clinicName: doctorData.clinic || doctorData.clinicName || "",
              workingHours: doctorData.availability || doctorData.workingHours || "",
            });
            
            setFormData({
              fullName: doctorData.name || doctorData.fullName || currentUser.displayName || "",
              email: doctorData.email || currentUser.email || "",
              phoneNumber: doctorData.phone || doctorData.phoneNumber || "",
              address: doctorData.address || "",
              specialty: doctorData.specialty || "",
              yearsOfExperience: doctorData.yearsOfExperience?.toString() || doctorData.experience?.toString() || "",
              clinicName: doctorData.clinic || doctorData.clinicName || "",
              workingHours: doctorData.availability || doctorData.workingHours || "",
            });
            
            if (doctorData.notificationSettings) {
              setNotificationSettings(doctorData.notificationSettings);
            }
          } else {
            // Handle case where doctor document doesn't exist in either collection
            setProfileData({
              fullName: currentUser.displayName || "",
              email: currentUser.email || "",
              phoneNumber: "",
              address: "",
              specialty: "",
              yearsOfExperience: "",
              clinicName: "",
              workingHours: "",
            });
            setFormData({
              fullName: currentUser.displayName || "",
              email: currentUser.email || "",
              phoneNumber: "",
              address: "",
              specialty: "",
              yearsOfExperience: "",
              clinicName: "",
              workingHours: "",
            });
            
            toast({
              title: "Profile Incomplete",
              description: "Your professional profile information is incomplete. Please update your details.",
              duration: 5000
            });
          }
        }
      } catch (error) {
        console.error("Error fetching doctor data:", error);
        toast({
          title: "Error",
          description: "Failed to load your profile information",
          variant: "destructive"
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchDoctorData();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSpecialtyChange = (value: string) => {
    setFormData(prev => ({ ...prev, specialty: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Authentication Error",
          description: "You need to be logged in to update your profile",
          variant: "destructive"
        });
        return;
      }
      
      // Data to update
      const updateData = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        specialty: formData.specialty,
        yearsOfExperience: formData.yearsOfExperience ? Number(formData.yearsOfExperience) : null,
        clinicName: formData.clinicName,
        workingHours: formData.workingHours,
        updatedAt: new Date().toISOString(),
      };
      
      // Update the user document in Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, updateData);
      
      // Also try to update in doctors collection if it exists
      try {
        const doctorDocRef = doc(db, 'doctors', currentUser.uid);
        const doctorDocSnap = await getDoc(doctorDocRef);
        if (doctorDocSnap.exists()) {
          await updateDoc(doctorDocRef, {
            name: formData.fullName,
            email: formData.email,
            phone: formData.phoneNumber,
            specialty: formData.specialty,
            experience: formData.yearsOfExperience ? Number(formData.yearsOfExperience) : null,
            clinic: formData.clinicName,
            availability: formData.workingHours,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error updating doctor document:", error);
        // Continue execution, as the main user document was updated
      }
      
      // Update local state with the saved data
      setProfileData({ ...formData });
      setIsEditing(false);
      
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved successfully.",
        duration: 3000
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update failed",
        description: "There was a problem saving your profile information.",
        variant: "destructive"
      });
    }
  };

  const handleToggleNotification = async (key: keyof typeof notificationSettings) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Authentication Error",
          description: "You need to be logged in to update your settings",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      const updatedSettings = {
        ...notificationSettings,
        [key]: !notificationSettings[key]
      };
      setNotificationSettings(updatedSettings);
      
      // Save to Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        notificationSettings: updatedSettings
      });
      
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been saved.",
        duration: 2000
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      toast({
        title: "Update failed",
        description: "Failed to save notification preferences.",
        variant: "destructive"
      });
      // Revert the local state change if the update to Firestore failed
      setNotificationSettings(notificationSettings);
    }
  };

  const handleChangePassword = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Authentication Error",
          description: "You need to be logged in to change your password",
          variant: "destructive"
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "New password and confirm password do not match",
          variant: "destructive"
        });
        return;
      }

      setIsChangingPassword(true);

      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordData.newPassword);

      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated",
        duration: 3000
      });

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Change Failed",
        description: "Failed to update your password",
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
        duration: 3000
      });
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Logout Failed",
        description: "Failed to log out",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Authentication Error",
          description: "You need to be logged in to delete your account",
          variant: "destructive"
        });
        return;
      }

      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Delete from users collection
      const userDocRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userDocRef);
      
      // Also try to delete from doctors collection
      try {
        const doctorDocRef = doc(db, 'doctors', currentUser.uid);
        const doctorDocSnap = await getDoc(doctorDocRef);
        if (doctorDocSnap.exists()) {
          await deleteDoc(doctorDocRef);
        }
      } catch (error) {
        console.error("Error deleting doctor document:", error);
        // Continue with account deletion
      }
      
      // Delete the authentication account
      await deleteUser(currentUser);

      toast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted",
        duration: 3000
      });

      navigate("/signup");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete your account",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout userRole="doctor">
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">Doctor Settings</h1>
          <p className="text-muted-foreground">
            Manage your professional profile, account settings, and preferences.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-health-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      name="fullName"
                      value={isEditing ? formData.fullName : profileData.fullName}
                      onChange={handleInputChange}
                      className="pl-8"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={isEditing ? formData.email : profileData.email}
                      onChange={handleInputChange}
                      className="pl-8"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      value={isEditing ? formData.phoneNumber : profileData.phoneNumber}
                      onChange={handleInputChange}
                      className="pl-8"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={isEditing ? formData.address : profileData.address}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button 
                    className="bg-health-primary hover:bg-health-secondary"
                    onClick={handleSaveProfile}
                  >
                    <Check className="mr-1 h-4 w-4" /> Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setFormData({ ...profileData });
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Professional Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-health-primary" />
                Professional Details
              </CardTitle>
              <CardDescription>
                Update your medical specialty and professional information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="specialty">Medical Specialty</Label>
                  {isEditing ? (
                    <Select
                      value={formData.specialty}
                      onValueChange={handleSpecialtyChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty} value={specialty}>
                            {specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={profileData.specialty}
                      disabled
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                  <div className="relative">
                    <Award className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="yearsOfExperience"
                      name="yearsOfExperience"
                      type="number"
                      value={isEditing ? formData.yearsOfExperience : profileData.yearsOfExperience}
                      onChange={handleInputChange}
                      className="pl-8"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Clinic/Hospital</Label>
                  <div className="relative">
                    <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="clinicName"
                      name="clinicName"
                      value={isEditing ? formData.clinicName : profileData.clinicName}
                      onChange={handleInputChange}
                      className="pl-8"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workingHours">Working Hours</Label>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="workingHours"
                      name="workingHours"
                      value={isEditing ? formData.workingHours : profileData.workingHours}
                      onChange={handleInputChange}
                      placeholder="e.g. Mon-Fri, 9AM-5PM"
                      className="pl-8"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-health-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Control how you receive notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-reminders">Appointment Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive upcoming appointment notifications via email
                    </p>
                  </div>
                  <Switch
                    id="email-reminders"
                    checked={notificationSettings.emailReminders}
                    onCheckedChange={() => handleToggleNotification('emailReminders')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms-reminders">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive appointment reminders via text message
                    </p>
                  </div>
                  <Switch
                    id="sms-reminders"
                    checked={notificationSettings.smsReminders}
                    onCheckedChange={() => handleToggleNotification('smsReminders')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emergency-alerts">Emergency Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about emergency patient requests immediately
                    </p>
                  </div>
                  <Switch
                    id="emergency-alerts"
                    checked={notificationSettings.emergencyAlerts}
                    onCheckedChange={() => handleToggleNotification('emergencyAlerts')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="patient-updates">Patient Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications about patient status changes
                    </p>
                  </div>
                  <Switch
                    id="patient-updates"
                    checked={notificationSettings.patientUpdates}
                    onCheckedChange={() => handleToggleNotification('patientUpdates')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="newsletter-updates">Medical Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive professional medical news and platform updates
                    </p>
                  </div>
                  <Switch
                    id="newsletter-updates"
                    checked={notificationSettings.newsletterUpdates}
                    onCheckedChange={() => handleToggleNotification('newsletterUpdates')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-health-primary" />
                Account Security
              </CardTitle>
              <CardDescription>
                Manage your account security and password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter your current password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    placeholder="Enter a new password"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="bg-health-primary hover:bg-health-secondary"
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                Change Password
              </Button>
            </CardFooter>
          </Card>

          {/* Account Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="text-destructive border-destructive hover:bg-destructive/10 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={handleDeleteAccount}
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DoctorSettings;