DROP DATABASE IF EXISTS job_seeker_app_db;
CREATE DATABASE job_portal_simplified CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE job_seeker_app_db;

-- 1. Roles
CREATE TABLE Roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name ENUM('ADMIN', 'CANDIDATE', 'RECRUITER') UNIQUE
);

-- 2. Companies
CREATE TABLE Companies (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    address VARCHAR(255),
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    city VARCHAR(100),
    avatar_url VARCHAR(500),
    role_id INT NOT NULL,
    company_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES Roles(role_id),
    FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE SET NULL
);

-- 4. User CVs
CREATE TABLE User_CVs (
    cv_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255),
    file_url VARCHAR(500),
    content TEXT, -- chứa text full CV, phục vụ tìm kiếm kỹ năng
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FULLTEXT KEY idx_fulltext_content (content)
);

-- 5. Skills (để quản lý danh mục kỹ năng chuẩn)
CREATE TABLE Skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) UNIQUE NOT NULL
);

-- 6. Jobs
CREATE TABLE Jobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    posted_by INT NOT NULL, -- user đăng tuyển (nhà tuyển dụng)
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    salary_min DECIMAL(12,2),
    salary_max DECIMAL(12,2),
    location VARCHAR(255),
    job_type ENUM('Full-time','Part-time','Internship','Contract','Freelance'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE CASCADE,
    FOREIGN KEY (posted_by) REFERENCES Users(user_id) ON DELETE CASCADE,
    FULLTEXT KEY idx_fulltext_description (description, requirements)
);

-- 7. Job Skills (liên kết kỹ năng yêu cầu với công việc)
CREATE TABLE Job_Skills (
    job_id INT,
    skill_id INT,
    is_required BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (job_id, skill_id),
    FOREIGN KEY (job_id) REFERENCES Jobs(job_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
);

-- 8. Job Applications
CREATE TABLE Job_Applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    user_id INT NOT NULL,
    cv_id INT,
    cover_letter TEXT,
    status ENUM('Applied','Screening','Interview','Offer','Accepted','Rejected') DEFAULT 'Applied',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES Jobs(job_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (cv_id) REFERENCES User_CVs(cv_id) ON DELETE SET NULL,
    UNIQUE(job_id, user_id)
);

-- 9. Saved Jobs
CREATE TABLE Saved_Jobs (
    user_id INT,
    job_id INT,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, job_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES Jobs(job_id) ON DELETE CASCADE
);

-- 10. Messages
CREATE TABLE Messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_messages(sender_id, receiver_id, sent_at)
);

-- 11. Notifications
CREATE TABLE Notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 12. Sample Data
INSERT INTO Roles(role_name) VALUES ('ADMIN'), ('CANDIDATE'), ('RECRUITER');

INSERT INTO Skills(skill_name) VALUES
('Java'), ('Python'), ('SQL'), ('Flutter'), ('React'), ('Project Management');