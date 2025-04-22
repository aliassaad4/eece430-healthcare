import { Layout } from "@/components/layout/Layout";
import { DoctorCard } from "@/components/doctors/DoctorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Search } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { db } from "@/config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Doctor {
    id: string;
    name: string;
    email: string;
    specialty: string;
    rating?: number;
    experience?: number;
    availableSlots?: number;
    education?: string;
    hospitalAffiliation?: string;
    profileImage?: string;
    bio?: string;
    role: string;
}

const FindDoctor = () => {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSpecialty, setSelectedSpecialty] = useState("All Specialties");
    const [sortBy, setSortBy] = useState("rating");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const specialties = ["All Specialties", "Cardiologist", "Dermatologist", "Neurologist", "Ophthalmologist", "Orthopedic Surgeon", "Pediatrician"];
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDoctors = async () => {
            setLoading(true);
            setError(null);
            try {
                const doctorsRef = collection(db, "users");
                // First, only filter by role - avoiding combined queries that may require indexes
                let q = query(doctorsRef, where("role", "==", "doctor"));
                
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    setDoctors([]);
                    setLoading(false);
                    return;
                }
                
                // Get all doctors first
                let doctorsData: Doctor[] = [];
                querySnapshot.forEach((doc) => {
                    const docData = doc.data() as Omit<Doctor, "id">;
                    doctorsData.push({ id: doc.id, ...docData });
                });
                
                // Then apply specialty filter in JavaScript instead of in the query
                if (selectedSpecialty !== "All Specialties") {
                    doctorsData = doctorsData.filter(
                        doctor => doctor.specialty === selectedSpecialty
                    );
                }
                
                // Apply sort in JavaScript instead of using orderBy
                // This avoids Firestore index requirements
                doctorsData.sort((a, b) => {
                    if (sortBy === "rating") {
                        return (b.rating || 0) - (a.rating || 0);
                    } else if (sortBy === "availability") {
                        return (b.availableSlots || 0) - (a.availableSlots || 0);
                    } else if (sortBy === "experience") {
                        return (b.experience || 0) - (a.experience || 0);
                    }
                    return 0;
                });
                
                setDoctors(doctorsData);
            } catch (err) {
                console.error("Error fetching doctors:", err);
                setError("Failed to fetch doctors. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchDoctors();
    }, [selectedSpecialty, sortBy]);

    const handleBookAppointment = (doctorId: string) => {
        navigate(`/patient/book-appointment/${doctorId}`);
    };

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    };

    const handleSpecialtyChange = (value: string) => {
        setSelectedSpecialty(value);
    };

    const handleSortByChange = (value: string) => {
        setSortBy(value);
    };

    // Filter doctors based on search query
    const filteredDoctors = doctors.filter((doctor) =>
        doctor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.hospitalAffiliation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.bio?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout userRole="patient">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Find a Doctor</h1>
                    <p className="text-gray-500">Search for specialists and book appointments</p>
                </div>

                {/* Search Filters */}
                <div className="bg-white p-4 rounded-lg border space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by doctor name, specialty, or hospital"
                                className="pl-9"
                                value={searchQuery}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <Select value={selectedSpecialty} onValueChange={handleSpecialtyChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Specialty" />
                                </SelectTrigger>
                                <SelectContent>
                                    {specialties.map((specialty) => (
                                        <SelectItem key={specialty} value={specialty}>
                                            {specialty}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-48">
                            <Select value={sortBy} onValueChange={handleSortByChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sort By" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="rating">Highest Rated</SelectItem>
                                    <SelectItem value="availability">Most Available</SelectItem>
                                    <SelectItem value="experience">Most Experienced</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* Dynamic badges based on doctor availability */}
                        <Badge 
                            variant="outline" 
                            className="bg-health-light cursor-pointer hover:bg-health-light/80"
                            onClick={() => setSortBy("availability")}
                        >
                            Available Now
                        </Badge>
                        <Badge 
                            variant="outline" 
                            className="bg-health-light cursor-pointer hover:bg-health-light/80"
                            onClick={() => setSortBy("rating")}
                        >
                            Top Rated
                        </Badge>
                        <Badge 
                            variant="outline" 
                            className="bg-health-light cursor-pointer hover:bg-health-light/80"
                            onClick={() => setSelectedSpecialty("All Specialties")}
                        >
                            All Specialties
                        </Badge>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="text-center py-8">
                        <p className="text-gray-500">Loading doctors...</p>
                    </div>
                )}

                {/* Search Results */}
                {!loading && !error && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">
                                {filteredDoctors.length} Doctors Available
                            </h2>
                        </div>

                        {filteredDoctors.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500">No doctors found matching your criteria.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredDoctors.map((doctor) => (
                                    <DoctorCard
                                        key={doctor.id}
                                        doctor={doctor}
                                        onBookAppointment={handleBookAppointment}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FindDoctor;