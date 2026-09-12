-- ============================================================
-- EDUSPHERE — DEVELOPER PROFILE + SUPER ADMIN VERIFICATION
-- Idempotent migration for existing installations.
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
    CONSTRAINT fk_developer_profile_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    CONSTRAINT fk_developer_verification_profile
        FOREIGN KEY (developer_profile_id) REFERENCES developer_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_developer_verification_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_developer_verification_admin
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_developer_verifications_status
    ON developer_verifications(status);
