
CREATE DATABASE IF NOT EXISTS student_record_system;
USE student_record_system;

-- 1. Login accounts and roles
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Student', 'Faculty', 'Administrator') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Student profile information
CREATE TABLE IF NOT EXISTS students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    registration_number VARCHAR(30) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    date_of_birth DATE,
    course VARCHAR(100) NOT NULL,
    admission_year YEAR NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

-- 3. Semester and academic-year information
CREATE TABLE IF NOT EXISTS semesters (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    semester_number TINYINT NOT NULL UNIQUE,
    academic_year VARCHAR(9) NOT NULL,
    start_date DATE,
    end_date DATE,
    CHECK (semester_number BETWEEN 1 AND 12),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- 4. Subject information and credits
CREATE TABLE IF NOT EXISTS subjects (
    subject_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(20) NOT NULL UNIQUE,
    subject_name VARCHAR(150) NOT NULL,
    credits DECIMAL(4,1) NOT NULL,
    semester_id INT NOT NULL,
    CHECK (credits > 0),
    FOREIGN KEY (semester_id) REFERENCES semesters(semester_id)
);

-- 5. Attendance records
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('Present', 'Absent') NOT NULL,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, subject_id, attendance_date),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
    FOREIGN KEY (recorded_by) REFERENCES users(user_id)
);

-- 6. Assessment marks
CREATE TABLE IF NOT EXISTS marks (
    mark_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    assessment_name VARCHAR(100) NOT NULL,
    marks_obtained DECIMAL(6,2) NOT NULL,
    max_marks DECIMAL(6,2) NOT NULL,
    entered_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CHECK (marks_obtained >= 0),
    CHECK (max_marks > 0),
    CHECK (marks_obtained <= max_marks),
    UNIQUE (student_id, subject_id, assessment_name),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
    FOREIGN KEY (entered_by) REFERENCES users(user_id)
);
