-- ============================================================
-- EDUSPHERE FINAL LIBRARY PERMISSION MODEL
--
-- Student   -> VIEW published resources in own institution
-- Professor -> VIEW published resources in own institution
-- Admin     -> VIEW published resources in own institution
-- Developer -> NO Library content CRUD
-- Super Admin -> ADD / VIEW / EDIT / DELETE for any institution
--
-- Existing rows are first mapped from their creator's profile when
-- possible. Any unmapped legacy row must be assigned before the final
-- NOT NULL/FK constraint is applied.
-- ============================================================

USE edu_sphere;

SET @has_library_table := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'developer_library_resources'
);

SET @sql := IF(@has_library_table = 0,
    'CREATE TABLE developer_library_resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        institution_id INT NULL,
        title VARCHAR(255) NOT NULL,
        resource_type ENUM(\'BOOK\',\'MATERIAL\',\'EBOOK\',\'NOTE\',\'PDF\',\'OTHER\') NOT NULL,
        author VARCHAR(255) NULL,
        isbn VARCHAR(100) NULL,
        category VARCHAR(255) NULL,
        subject VARCHAR(255) NULL,
        description TEXT NULL,
        language VARCHAR(100) NULL,
        publication_year INT NULL,
        tags TEXT NULL,
        cover_file_path TEXT NULL,
        resource_file_path TEXT NULL,
        original_file_name VARCHAR(255) NULL,
        mime_type VARCHAR(150) NULL,
        file_size BIGINT NULL,
        status ENUM(\'DRAFT\',\'PUBLISHED\',\'ARCHIVED\') NOT NULL DEFAULT \'DRAFT\',
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        created_by INT NOT NULL,
        updated_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_library_institution (institution_id),
        KEY idx_library_status_institution (institution_id,status),
        CONSTRAINT fk_library_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_library_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
    )',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_institution_column := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'developer_library_resources'
      AND column_name = 'institution_id'
);
SET @sql := IF(@has_institution_column = 0,
    'ALTER TABLE developer_library_resources ADD COLUMN institution_id INT NULL FIRST',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Map legacy resources to the creator's institution.
UPDATE developer_library_resources r
JOIN users u ON u.id = r.created_by
JOIN student_profiles sp ON sp.user_id = u.id
SET r.institution_id = sp.institution_id
WHERE r.institution_id IS NULL AND u.role_id = (SELECT id FROM roles WHERE name='STUDENT' LIMIT 1);

UPDATE developer_library_resources r
JOIN users u ON u.id = r.created_by
JOIN professor_profiles pp ON pp.user_id = u.id
SET r.institution_id = pp.institution_id
WHERE r.institution_id IS NULL AND u.role_id = (SELECT id FROM roles WHERE name='PROFESSOR' LIMIT 1);

UPDATE developer_library_resources r
JOIN users u ON u.id = r.created_by
JOIN admin_profiles ap ON ap.user_id = u.id
SET r.institution_id = ap.institution_id
WHERE r.institution_id IS NULL AND u.role_id = (SELECT id FROM roles WHERE name='ADMIN' LIMIT 1);

-- Do not silently guess an institution for unmapped legacy rows.
-- The NOT NULL ALTER below intentionally fails if any legacy row remains
-- unmapped, forcing an explicit institution assignment instead of leaking
-- content into an arbitrary institution.
SELECT COUNT(*) AS unmapped_library_rows
FROM developer_library_resources
WHERE institution_id IS NULL;

ALTER TABLE developer_library_resources
    MODIFY COLUMN institution_id INT NOT NULL;

SET @has_library_fk := (
    SELECT COUNT(*) FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'developer_library_resources'
      AND constraint_name = 'fk_library_institution'
);
SET @sql := IF(@has_library_fk = 0,
    'ALTER TABLE developer_library_resources ADD CONSTRAINT fk_library_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_library_idx := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'developer_library_resources'
      AND index_name = 'idx_library_institution'
);
SET @sql := IF(@has_library_idx = 0,
    'ALTER TABLE developer_library_resources ADD KEY idx_library_institution (institution_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
