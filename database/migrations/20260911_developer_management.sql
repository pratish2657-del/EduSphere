-- ============================================================
-- EDUSPHERE — COMPLETE DEVELOPER MANAGEMENT
-- Profile + Super Admin verification + Library + Audit log
-- Idempotent migration. Never drops production data.
-- ============================================================
USE edu_sphere;

INSERT IGNORE INTO roles (name) VALUES ('DEVELOPER');

CREATE TABLE IF NOT EXISTS developer_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    developer_id VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    department VARCHAR(150) NOT NULL,
    experience VARCHAR(100) NULL,
    primary_role VARCHAR(150) NOT NULL,
    skills TEXT NOT NULL,
    github VARCHAR(500) NULL,
    linkedin VARCHAR(500) NULL,
    portfolio VARCHAR(500) NULL,
    bio TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_developer_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS developer_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    developer_profile_id INT NOT NULL UNIQUE,
    user_id INT NOT NULL UNIQUE,
    status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
    remarks TEXT NULL,
    verified_by INT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    CONSTRAINT fk_dev_verification_profile FOREIGN KEY (developer_profile_id) REFERENCES developer_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dev_verification_admin FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_dev_verification_status ON developer_verifications(status);

CREATE TABLE IF NOT EXISTS developer_library_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    resource_type ENUM('BOOK','MATERIAL','EBOOK','NOTE','PDF','OTHER') NOT NULL,
    author VARCHAR(255) NULL,
    isbn VARCHAR(100) NULL,
    category VARCHAR(150) NULL,
    subject VARCHAR(150) NULL,
    description TEXT NULL,
    language VARCHAR(100) NULL,
    publication_year INT NULL,
    tags TEXT NULL,
    cover_file_path VARCHAR(1000) NULL,
    resource_file_path VARCHAR(1000) NULL,
    original_file_name VARCHAR(500) NULL,
    mime_type VARCHAR(150) NULL,
    file_size BIGINT NULL,
    status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT NOT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_library_creator FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_dev_library_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_dev_library_type ON developer_library_resources(resource_type);
CREATE INDEX idx_dev_library_status ON developer_library_resources(status);
CREATE INDEX idx_dev_library_subject ON developer_library_resources(subject);
CREATE INDEX idx_dev_library_category ON developer_library_resources(category);
CREATE INDEX idx_dev_library_created_by ON developer_library_resources(created_by);

CREATE TABLE IF NOT EXISTS developer_activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NOT NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id INT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dev_activity_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_dev_activity_actor ON developer_activity_logs(actor_user_id);
CREATE INDEX idx_dev_activity_entity ON developer_activity_logs(entity_type, entity_id);
CREATE INDEX idx_dev_activity_created ON developer_activity_logs(created_at);
