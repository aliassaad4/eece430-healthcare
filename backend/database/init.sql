-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS healthease_pro;

-- Use the database
USE healthease_pro;

-- Create UserRole enum type
CREATE TABLE IF NOT EXISTS UserRole (
    id VARCHAR(36) PRIMARY KEY,
    name ENUM('PATIENT', 'DOCTOR', 'ADMIN') NOT NULL
);

-- Create AppointmentStatus enum type
CREATE TABLE IF NOT EXISTS AppointmentStatus (
    id VARCHAR(36) PRIMARY KEY,
    name ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'EMERGENCY') NOT NULL
);

-- Create Users table
CREATE TABLE IF NOT EXISTS User (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255) NOT NULL,
    role ENUM('PATIENT', 'DOCTOR', 'ADMIN') NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Appointments table
CREATE TABLE IF NOT EXISTS Appointment (
    id VARCHAR(36) PRIMARY KEY,
    patientId VARCHAR(36) NOT NULL,
    doctorId VARCHAR(36) NOT NULL,
    dateTime DATETIME NOT NULL,
    status ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'EMERGENCY') NOT NULL,
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patientId) REFERENCES User(id),
    FOREIGN KEY (doctorId) REFERENCES User(id)
);

-- Create MedicalNotes table
CREATE TABLE IF NOT EXISTS MedicalNote (
    id VARCHAR(36) PRIMARY KEY,
    appointmentId VARCHAR(36) UNIQUE NOT NULL,
    patientId VARCHAR(36) NOT NULL,
    doctorId VARCHAR(36) NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointmentId) REFERENCES Appointment(id),
    FOREIGN KEY (patientId) REFERENCES User(id),
    FOREIGN KEY (doctorId) REFERENCES User(id)
);

-- Create indexes
CREATE INDEX idx_appointment_patient ON Appointment(patientId);
CREATE INDEX idx_appointment_doctor ON Appointment(doctorId);
CREATE INDEX idx_medicalnote_patient ON MedicalNote(patientId);
CREATE INDEX idx_medicalnote_doctor ON MedicalNote(doctorId); 