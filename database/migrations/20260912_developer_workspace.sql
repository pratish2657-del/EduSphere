CREATE TABLE IF NOT EXISTS developer_code_files (
 id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, filename VARCHAR(128) NOT NULL,
 language VARCHAR(32) NOT NULL, content LONGTEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_developer_code_file(user_id,filename), KEY idx_developer_code_files_user(user_id),
 CONSTRAINT fk_developer_code_files_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS developer_code_submissions (
 id INT AUTO_INCREMENT PRIMARY KEY, file_id INT NOT NULL, developer_id INT NOT NULL,
 filename VARCHAR(128) NOT NULL, language VARCHAR(32) NOT NULL, description TEXT NOT NULL,
 content LONGTEXT NOT NULL, storage_path TEXT NULL,
 status ENUM('PENDING','REVIEWED','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING', remarks TEXT NULL,
 reviewed_by INT NULL, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL,
 KEY idx_developer_submission_status(status), KEY idx_developer_submission_developer(developer_id),
 CONSTRAINT fk_developer_submission_file FOREIGN KEY(file_id) REFERENCES developer_code_files(id) ON DELETE CASCADE,
 CONSTRAINT fk_developer_submission_developer FOREIGN KEY(developer_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_developer_submission_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
