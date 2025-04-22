import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Shield, User, Calendar, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { auth, db } from "@/config/firebase";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";

interface MedicalNote {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  appointmentId: string;
  title: string;
  date: string;
  createdAt: string;
  summary: string;
  fullNote: string;
}

const MedicalHistory = () => {
    const [filter, setFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("newest");
    const [searchQuery, setSearchQuery] = useState("");
    const [medicalNotes, setMedicalNotes] = useState<MedicalNote[]>([]);
    const [selectedNote, setSelectedNote] = useState<MedicalNote | null>(null);
    const loggedInPatientId = auth.currentUser?.uid;

    useEffect(() => {
        if (loggedInPatientId) {
            // Fetch medical notes without using orderBy to avoid requiring an index
            const fetchNotes = async () => {
                try {
                    const notesRef = collection(db, "medicalNotes");
                    // Only filter by patientId in the query - no orderBy
                    let q = query(notesRef, where("patientId", "==", loggedInPatientId));
                    
                    const querySnapshot = await getDocs(q);
                    const notesData: MedicalNote[] = [];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    querySnapshot.forEach((doc) => {
                        const noteData = { id: doc.id, ...doc.data() } as MedicalNote;
                        const noteDate = parseNoteDate(noteData.date);

                        // Filter for past appointments client-side
                        if (noteDate < today) {
                            // Only include notes that match the specialty filter if one is selected
                            if (filter === "all" || noteData.specialty === filter) {
                                notesData.push(noteData);
                            }
                        }
                    });
                    
                    // Sort client-side instead of in the query
                    const sortedNotes = [...notesData].sort((a, b) => {
                        const dateA = parseNoteDate(a.date).getTime();
                        const dateB = parseNoteDate(b.date).getTime();
                        
                        return sortOrder === "newest" 
                            ? dateB - dateA  // Newest first
                            : dateA - dateB; // Oldest first
                    });
                    
                    setMedicalNotes(sortedNotes);
                } catch (error) {
                    console.error("Error fetching medical notes:", error);
                }
            };

            fetchNotes();
        }
    }, [loggedInPatientId, filter, sortOrder]);

    const parseNoteDate = (dateStr: string): Date => {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date;
        }

        const parts = dateStr.split(/[/-]/);
        if (parts.length === 3) {
            return new Date(
                Number(parts[2]),
                Number(parts[0]) - 1,
                Number(parts[1])
            );
        }

        return new Date();
    };

    // Filter notes based on search query (client-side filtering)
    const filteredNotes = medicalNotes.filter(note =>
        searchQuery.toLowerCase() === "" ||
        note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.doctorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.fullNote?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout userRole="patient">
            <div className="space-y-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Medical History</h1>
                        <Badge className="bg-health-primary">
                            <Shield className="h-3 w-3 mr-1" /> Secure
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Review your past medical visit history and notes from healthcare providers.
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select value={sortOrder} onValueChange={setSortOrder}>
                            <SelectTrigger className="w-[180px]">
                                <Calendar className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Sort by date" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by specialty" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Specialties</SelectItem>
                                <SelectItem value="Cardiologist">Cardiologist</SelectItem>
                                <SelectItem value="Dermatologist">Dermatologist</SelectItem>
                                <SelectItem value="Orthopedic Surgeon">Orthopedic Surgeon</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="search"
                            placeholder="Search notes..."
                            className="pl-8 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {filteredNotes.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-muted-foreground">No medical records found.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredNotes.map((note) => (
                            <Card key={note.id} className="overflow-hidden transition-all hover:shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">{note.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="pb-3 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-health-primary" />
                                        <span className="font-medium">{note.doctorName}</span>
                                        <span className="text-sm text-gray-500">({note.specialty})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-health-primary" />
                                        <span>{note.date}</span>
                                    </div>
                                    <div className="flex items-start gap-2 bg-health-light p-2 rounded-md">
                                        <FileText className="h-4 w-4 text-health-primary mt-0.5" />
                                        <span className="text-sm line-clamp-2">{note.summary}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-0">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedNote(note)}
                                            >
                                                View Full Note
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[500px]">
                                            <DialogHeader>
                                                <DialogTitle>{selectedNote?.title}</DialogTitle>
                                                <DialogDescription>
                                                    {selectedNote?.doctorName} - {selectedNote?.date}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 my-4">
                                                <div className="bg-health-light p-4 rounded-md">
                                                    <p className="text-sm whitespace-pre-line">{selectedNote?.fullNote}</p>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <DialogClose asChild>
                                                    <Button className="bg-health-primary hover:bg-health-secondary">Close</Button>
                                                </DialogClose>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MedicalHistory;