import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schema for system settings
const systemSettingsSchema = z.object({
  siteName: z.string().min(2, "Site name must be at least 2 characters"),
  contactEmail: z.string().email("Invalid email address"),
  emergencyEnabled: z.boolean(),
  maxDailyAppointments: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Must be a positive number",
  }),
  maxPatientsPerDoctor: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Must be a positive number",
  }),
});

// Form schema for email settings
const emailSettingsSchema = z.object({
  smtpServer: z.string().min(1, "SMTP server is required"),
  smtpPort: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Must be a valid port number",
  }),
  smtpUsername: z.string().min(1, "Username is required"),
  smtpPassword: z.string().min(1, "Password is required"),
  fromEmail: z.string().email("Invalid email address"),
  enableNotifications: z.boolean(),
});

// Mock initial data
const mockSystemSettings = {
  siteName: "HealthEase Pro Connect",
  contactEmail: "admin@healthease.com",
  emergencyEnabled: true,
  maxDailyAppointments: "20",
  maxPatientsPerDoctor: "200",
};

const mockEmailSettings = {
  smtpServer: "smtp.healthease.com",
  smtpPort: "587",
  smtpUsername: "notifications@healthease.com",
  smtpPassword: "********",
  fromEmail: "no-reply@healthease.com",
  enableNotifications: true,
};

const AdminSettings = () => {
  const [isSystemLoading, setIsSystemLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const { toast } = useToast();

  // System Settings form
  const systemForm = useForm({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: mockSystemSettings,
  });

  // Email Settings form
  const emailForm = useForm({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: mockEmailSettings,
  });

  const handleSystemSubmit = async (values: z.infer<typeof systemSettingsSchema>) => {
    setIsSystemLoading(true);
    try {
      // In a real application, you would save these settings to your backend
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast({
        title: "System Settings Saved",
        description: "Your system settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save system settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSystemLoading(false);
    }
  };

  const handleEmailSubmit = async (values: z.infer<typeof emailSettingsSchema>) => {
    setIsEmailLoading(true);
    try {
      // In a real application, you would save these settings to your backend
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast({
        title: "Email Settings Saved",
        description: "Your email settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save email settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <Layout userRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Settings</h1>
          <p className="text-gray-500">Manage system configuration and preferences</p>
        </div>

        <Tabs defaultValue="system">
          <TabsList className="grid w-full grid-cols-2 md:w-auto">
            <TabsTrigger value="system">System Settings</TabsTrigger>
            <TabsTrigger value="email">Email & Notifications</TabsTrigger>
          </TabsList>
          
          {/* System Settings Tab */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Manage core system settings and functionality
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...systemForm}>
                  <form onSubmit={systemForm.handleSubmit(handleSystemSubmit)} className="space-y-6">
                    <FormField
                      control={systemForm.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            This is the name displayed throughout the application
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={systemForm.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormDescription>
                            This email will receive system notifications and user inquiries
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Separator className="my-4" />
                    
                    <FormField
                      control={systemForm.control}
                      name="emergencyEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Emergency Appointments</FormLabel>
                            <FormDescription>
                              Allow patients to request emergency appointments
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={systemForm.control}
                        name="maxDailyAppointments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Daily Appointments</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="1" />
                            </FormControl>
                            <FormDescription>
                              Maximum appointments per doctor per day
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={systemForm.control}
                        name="maxPatientsPerDoctor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Patients per Doctor</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="1" />
                            </FormControl>
                            <FormDescription>
                              Maximum patients assigned to each doctor
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="bg-health-primary hover:bg-health-secondary"
                      disabled={isSystemLoading}
                    >
                      {isSystemLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save System Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Email Settings Tab */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Email & Notification Settings</CardTitle>
                <CardDescription>
                  Configure email servers and notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="smtpServer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Server</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailForm.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="smtpUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailForm.control}
                        name="smtpPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={emailForm.control}
                      name="fromEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormDescription>
                            Email address used as the sender for all system emails
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Separator className="my-4" />
                    
                    <FormField
                      control={emailForm.control}
                      name="enableNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Email Notifications</FormLabel>
                            <FormDescription>
                              Send automated email notifications for appointments and system events
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="bg-health-primary hover:bg-health-secondary"
                      disabled={isEmailLoading}
                    >
                      {isEmailLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Email Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminSettings;