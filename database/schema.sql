-- ============================================================
-- EDUSPHERE DATABASE SCHEMA
-- UPDATED / NORMALIZED VERSION
-- MySQL 8.x
--
-- IMPORTANT:
-- - No DROP / TRUNCATE statements.
-- - This is the canonical fresh-install schema.
-- - Existing production data should be migrated with ALTER/UPDATE
--   statements rather than recreating tables.
-- ============================================================

CREATE DATABASE IF NOT EXISTS edu_sphere
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE edu_sphere;

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (name)
VALUES
    ('SUPER_ADMIN'),
    ('ADMIN'),
    ('DEVELOPER'),
    ('PROFESSOR'),
    ('STUDENT');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role_id INT NULL,
    profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status ENUM(
        'NOT_REQUIRED',
        'PENDING',
        'VERIFIED',
        'REJECTED'
    ) NOT NULL DEFAULT 'NOT_REQUIRED',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
);

-- ============================================================
-- INSTITUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS institutions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    university_code VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PROGRAMS
-- Must exist before student_profiles/courses/sections.
-- ============================================================

CREATE TABLE IF NOT EXISTS programs (
    id INT NOT NULL AUTO_INCREMENT,
    institution_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    degree VARCHAR(100) NOT NULL,
    duration_years INT NOT NULL DEFAULT 4,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_program_code_institution (
        institution_id,
        code
    ),

    CONSTRAINT programs_ibfk_1
        FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ============================================================
-- SECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS sections (
    id INT NOT NULL AUTO_INCREMENT,
    program_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(100) NOT NULL,
    batch_start_year INT NOT NULL,
    batch_end_year INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_section_code_program (
        program_id,
        code
    ),

    CONSTRAINT sections_ibfk_1
        FOREIGN KEY (program_id)
        REFERENCES programs(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ============================================================
-- STUDENT PROFILES
--
-- Normalized academic structure:
-- student_profiles.program_id -> programs.id
-- student_profiles.section_id -> sections.id
--
-- Do NOT use legacy program/stream/section text columns.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    phone VARCHAR(20) NOT NULL,

    institution_id INT NOT NULL,

    enrollment_number VARCHAR(100) NOT NULL,

    program_id INT NOT NULL,

    section_id INT NOT NULL,

    academic_year VARCHAR(50) NOT NULL,

    current_year INT NOT NULL,

    semester INT NOT NULL,

    student_id VARCHAR(100) NOT NULL,

    admission_year INT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (program_id)
        REFERENCES programs(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (section_id)
        REFERENCES sections(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_student_enrollment (
        institution_id,
        enrollment_number
    ),

    UNIQUE KEY uq_student_student_id (
        institution_id,
        student_id
    ),

    KEY idx_student_profiles_program (
        program_id
    ),

    KEY idx_student_profiles_section (
        section_id
    ),

    KEY idx_student_profiles_academic (
        academic_year,
        current_year,
        semester
    )
);

-- ============================================================
-- PROFESSOR PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS professor_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    phone VARCHAR(20) NOT NULL,

    institution_id INT NOT NULL,

    employee_id VARCHAR(100) NOT NULL,

    department VARCHAR(150) NOT NULL,

    designation VARCHAR(150) NOT NULL,

    specialization VARCHAR(255) NOT NULL,

    subjects TEXT NOT NULL,

    academic_experience TEXT NOT NULL,

    office_information TEXT NOT NULL,

    verification_details TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_professor_employee_institution (
        institution_id,
        employee_id
    )
);

-- ============================================================
-- PROFESSOR VERIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS professor_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,

    professor_id INT NOT NULL UNIQUE,

    status ENUM(
        'PENDING',
        'VERIFIED',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    remarks TEXT,

    verified_by INT NULL,

    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    verified_at TIMESTAMP NULL,

    FOREIGN KEY (professor_id)
        REFERENCES professor_profiles(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (verified_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    institution_id INT NOT NULL,
    admin_id VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    department VARCHAR(150) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    office_information TEXT,
    responsibilities TEXT,
    profile_photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_profiles_institution
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_verifications (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL UNIQUE,
 admin_profile_id INT NOT NULL,
 status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
 remarks TEXT NULL,
 verified_by INT NULL,
 submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 verified_at TIMESTAMP NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY (admin_profile_id) REFERENCES admin_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
 KEY idx_admin_verifications_status (status),
 KEY idx_admin_verifications_submitted (submitted_at)
);


-- New Admin accounts must complete the Admin Profile before entering the dashboard.
UPDATE users u
INNER JOIN roles r ON u.role_id = r.id
LEFT JOIN admin_profiles ap ON ap.user_id = u.id
SET u.profile_completed = FALSE
WHERE r.name = 'ADMIN'
  AND ap.id IS NULL
  AND u.is_super_admin = FALSE;


-- ============================================================
-- COURSES
--
-- Normalized:
-- courses.program_id -> programs.id
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,

    institution_id INT NULL,

    program_id INT NULL,

    name VARCHAR(255) NOT NULL,

    code VARCHAR(100),

    semester INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (program_id)
        REFERENCES programs(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_course_code_program (
        program_id,
        code
    ),

    KEY idx_courses_institution (
        institution_id
    ),

    KEY idx_courses_program (
        program_id
    ),

    KEY idx_courses_semester (
        semester
    )
);

-- ============================================================
-- COURSE ENROLLMENTS
-- STUDENT <-> COURSE
-- ============================================================

CREATE TABLE IF NOT EXISTS course_enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    course_id INT NOT NULL,

    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT unique_student_course
        UNIQUE (
            student_id,
            course_id
        )
);

-- ============================================================
-- COURSE TEACHERS
-- PROFESSOR <-> COURSE
-- ============================================================

CREATE TABLE IF NOT EXISTS course_teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,

    professor_id INT NOT NULL,

    course_id INT NOT NULL,

    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (professor_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT unique_professor_course
        UNIQUE (
            professor_id,
            course_id
        )
);

-- ============================================================
-- MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,

    course_id INT NULL,

    uploaded_by INT NULL,

    title VARCHAR(255) NOT NULL,

    material_type ENUM(
        'SYLLABUS',
        'NOTES',
        'PDF',
        'ASSIGNMENT',
        'QUESTION_PAPER',
        'LAB_MANUAL',
        'PRESENTATION',
        'REFERENCE',
        'ANNOUNCEMENT'
    ) NOT NULL,

    file_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    course_id INT NOT NULL,

    attendance_date DATE NOT NULL,

    status VARCHAR(20) NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE KEY uq_attendance_student_course_date (
        student_id,
        course_id,
        attendance_date
    )
);

-- ============================================================
-- TIMETABLES
--
-- Normalized academic targeting:
-- institution_id
-- program_id
-- section_id
-- academic_year
-- current_year
--
-- professor_id references professor_profiles.id.
-- ============================================================

CREATE TABLE IF NOT EXISTS timetables (
    id INT AUTO_INCREMENT PRIMARY KEY,

    institution_id INT NOT NULL,

    program_id INT NOT NULL,

    section_id INT NOT NULL,

    course_id INT NOT NULL,

    professor_id INT NULL,

    academic_year VARCHAR(50) NOT NULL,

    current_year INT NOT NULL,

    day VARCHAR(20) NOT NULL,

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    room VARCHAR(100) NOT NULL,

    FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (program_id)
        REFERENCES programs(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (section_id)
        REFERENCES sections(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (professor_id)
        REFERENCES professor_profiles(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    KEY idx_timetable_institution (
        institution_id
    ),

    KEY idx_timetable_program (
        program_id
    ),

    KEY idx_timetable_section (
        section_id
    ),

    KEY idx_timetable_course (
        course_id
    ),

    KEY idx_timetable_professor (
        professor_id
    ),

    KEY idx_timetable_academic_group (
        institution_id,
        program_id,
        section_id,
        academic_year,
        current_year
    ),

    KEY idx_timetable_day_time (
        day,
        start_time
    )
);

-- ============================================================
-- MARKETPLACE
-- ============================================================

-- ------------------------------------------------------------
-- MARKETPLACE PRODUCTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_products (
    id INT AUTO_INCREMENT PRIMARY KEY,

    seller_id INT NOT NULL,

    institution_id INT NOT NULL,

    name VARCHAR(255) NOT NULL,

    description TEXT NULL,

    category VARCHAR(100) NOT NULL,

    product_type ENUM(
        'PHYSICAL',
        'DIGITAL'
    ) NOT NULL DEFAULT 'PHYSICAL',

    condition_type ENUM(
        'NEW',
        'USED',
        'DIGITAL'
    ) NOT NULL DEFAULT 'NEW',

    price DECIMAL(10,2) NOT NULL,

    quantity INT NOT NULL DEFAULT 0,

    reserved_quantity INT NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (seller_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_marketplace_products_seller (
        seller_id
    ),

    INDEX idx_marketplace_products_institution (
        institution_id
    ),

    INDEX idx_marketplace_products_type (
        product_type
    ),

    INDEX idx_marketplace_products_category (
        category
    ),

    INDEX idx_marketplace_products_active (
        is_active
    )
);

-- ------------------------------------------------------------
-- MARKETPLACE ATTACHMENTS
-- PRIVATE DIGITAL PRODUCT FILES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,

    product_id INT NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    file_path VARCHAR(500) NOT NULL,

    file_type VARCHAR(100) NULL,

    file_size BIGINT NULL,

    uploaded_by INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id)
        REFERENCES marketplace_products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_marketplace_attachments_product (
        product_id
    ),

    INDEX idx_marketplace_attachments_uploaded_by (
        uploaded_by
    )
);

-- ------------------------------------------------------------
-- MARKETPLACE CARTS
-- ONE CART PER BUYER
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_carts (
    id INT AUTO_INCREMENT PRIMARY KEY,

    buyer_id INT NOT NULL UNIQUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (buyer_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- MARKETPLACE CART ITEMS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,

    cart_id INT NOT NULL,

    product_id INT NOT NULL,

    quantity INT NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cart_id)
        REFERENCES marketplace_carts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES marketplace_products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_cart_product (
        cart_id,
        product_id
    ),

    INDEX idx_cart_items_product (
        product_id
    )
);

-- ------------------------------------------------------------
-- MARKETPLACE ORDERS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,

    buyer_id INT NOT NULL,

    institution_id INT NOT NULL,

    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,

    platform_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    seller_net_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    shipping_address TEXT NULL,

    expires_at TIMESTAMP NULL,

    status ENUM(
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'COMPLETED',
        'CANCELLED',
        'REFUNDED'
    ) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (buyer_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (institution_id)
        REFERENCES institutions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_marketplace_orders_buyer (
        buyer_id
    ),

    INDEX idx_marketplace_orders_status (
        status
    ),

    INDEX idx_marketplace_orders_institution (
        institution_id
    )
);

-- ------------------------------------------------------------
-- MARKETPLACE ORDER ITEMS
-- SNAPSHOT OF PRODUCT AT PURCHASE TIME
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,

    product_id INT NOT NULL,

    seller_id INT NOT NULL,

    product_name VARCHAR(255) NOT NULL,

    unit_price DECIMAL(10,2) NOT NULL,

    quantity INT NOT NULL,

    subtotal DECIMAL(10,2) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id)
        REFERENCES marketplace_orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES marketplace_products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    FOREIGN KEY (seller_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_marketplace_order_items_order (
        order_id
    ),

    INDEX idx_marketplace_order_items_product (
        product_id
    ),

    INDEX idx_marketplace_order_items_seller (
        seller_id
    )
);

-- ------------------------------------------------------------
-- MARKETPLACE PAYMENTS
-- RAZORPAY
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,

    order_id INT NOT NULL,

    buyer_id INT NOT NULL,

    amount DECIMAL(10,2) NOT NULL,

    currency VARCHAR(10) NOT NULL DEFAULT 'INR',

    payment_method VARCHAR(50) NULL,

    gateway VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY',

    gateway_order_id VARCHAR(255) NULL,

    gateway_payment_id VARCHAR(255) NULL,

    gateway_signature TEXT NULL,

    status ENUM(
        'PENDING',
        'PAID',
        'FAILED',
        'CANCELLED',
        'REFUNDED'
    ) NOT NULL DEFAULT 'PENDING',

    paid_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id)
        REFERENCES marketplace_orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (buyer_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_marketplace_payment_order (
        order_id
    ),

    UNIQUE KEY uq_marketplace_gateway_order (
        gateway_order_id
    ),

    INDEX idx_marketplace_payments_buyer (
        buyer_id
    ),

    INDEX idx_marketplace_payments_status (
        status
    ),

    INDEX idx_marketplace_payments_gateway_payment (
        gateway_payment_id
    )
);


-- ------------------------------------------------------------
-- MARKETPLACE SELLER PAYOUT TRANSACTIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_seller_payout_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    seller_id INT NOT NULL,
    gross_amount DECIMAL(10,2) NOT NULL,
    platform_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    platform_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    seller_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status ENUM('PENDING','READY','TRANSFER_INITIATED','SETTLED','FAILED','ON_HOLD','REVERSED') NOT NULL DEFAULT 'PENDING',
    razorpay_linked_account_id VARCHAR(255) NULL,
    razorpay_transfer_id VARCHAR(255) NULL,
    transfer_status VARCHAR(50) NULL,
    settlement_status VARCHAR(50) NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    settled_at TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES marketplace_orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_marketplace_payout_order_seller (order_id, seller_id),
    INDEX idx_marketplace_payout_seller (seller_id),
    INDEX idx_marketplace_payout_status (status),
    INDEX idx_marketplace_payout_transfer (razorpay_transfer_id)
);

-- ------------------------------------------------------------
-- MARKETPLACE PAYMENT WEBHOOK EVENTS
-- RAZORPAY -> EDUSPHERE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_payment_webhook_events (
    id INT AUTO_INCREMENT PRIMARY KEY,

    event_id VARCHAR(255) NOT NULL UNIQUE,

    event_type VARCHAR(100) NOT NULL,

    payload LONGTEXT NOT NULL,

    signature VARCHAR(500) NULL,

    processed BOOLEAN NOT NULL DEFAULT FALSE,

    processed_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_webhook_event_type (
        event_type
    ),

    INDEX idx_webhook_processed (
        processed
    )
);

-- ============================================================
-- AI CONTEXT
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_context (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NULL,

    course_id INT NULL,

    context_type VARCHAR(100),

    content TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
    id INT NOT NULL AUTO_INCREMENT,

    title VARCHAR(255) NOT NULL,

    description TEXT NOT NULL,

    event_type VARCHAR(100) NOT NULL,

    start_datetime DATETIME NOT NULL,

    end_datetime DATETIME NOT NULL,

    venue VARCHAR(255) NOT NULL,

    organizer VARCHAR(255) NOT NULL,

    registration_deadline DATETIME NULL,

    registration_link VARCHAR(500) NULL,

    target_program VARCHAR(100) NULL,

    target_stream VARCHAR(100) NULL,

    target_year INT NULL,

    target_section VARCHAR(50) NULL,

    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    created_by INT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_events_created_by (
        created_by
    ),

    KEY idx_events_start_datetime (
        start_datetime
    ),

    KEY idx_events_is_published (
        is_published
    ),

    CONSTRAINT events_ibfk_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- EVENT ATTACHMENTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_attachments (
    id INT NOT NULL AUTO_INCREMENT,

    event_id INT NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    file_path VARCHAR(500) NOT NULL,

    file_type VARCHAR(255) NULL,

    file_size BIGINT NULL,

    uploaded_by INT NOT NULL,

    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_event_attachments_event_id (
        event_id
    ),

    KEY idx_event_attachments_uploaded_by (
        uploaded_by
    ),

    CONSTRAINT event_attachments_ibfk_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT event_attachments_ibfk_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- ============================================================
-- EXAMINATION RESULTS
--
-- Supports:
-- - Marks-based examination results
-- - Statement of Grades
-- - Credits
-- - Credit Points
--
-- marks_obtained / maximum_marks are nullable because a
-- Statement of Grades can be grade-only.
-- ============================================================

CREATE TABLE IF NOT EXISTS examination_results (
    id INT NOT NULL AUTO_INCREMENT,

    student_profile_id INT NOT NULL,

    course_id INT NOT NULL,

    exam_type VARCHAR(100) NOT NULL,

    academic_year VARCHAR(50) NOT NULL,

    semester INT NOT NULL,

    marks_obtained DECIMAL(10,2) NULL,

    maximum_marks DECIMAL(10,2) NULL,

    grade VARCHAR(20) DEFAULT NULL,

    grade_point DECIMAL(5,2) DEFAULT NULL,

    credits DECIMAL(5,2) DEFAULT NULL,

    credit_points DECIMAL(10,2) DEFAULT NULL,

    result_status ENUM(
        'PASS',
        'FAIL',
        'ABSENT',
        'WITHHELD'
    ) NOT NULL DEFAULT 'PASS',

    uploaded_by INT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_examination_results_student (
        student_profile_id
    ),

    KEY idx_examination_results_course (
        course_id
    ),

    KEY idx_examination_results_uploaded_by (
        uploaded_by
    ),

    KEY idx_examination_results_academic (
        academic_year,
        semester
    ),

    CONSTRAINT examination_results_fk_student
        FOREIGN KEY (student_profile_id)
        REFERENCES student_profiles(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT examination_results_fk_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT examination_results_fk_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uq_examination_result (
        student_profile_id,
        course_id,
        exam_type,
        academic_year,
        semester
    )
);

-- ============================================================
-- RESULT ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS result_attachments (
    id INT NOT NULL AUTO_INCREMENT,

    result_id INT NOT NULL,

    file_name VARCHAR(255) NOT NULL,

    file_path VARCHAR(500) NOT NULL,

    file_type VARCHAR(255) DEFAULT NULL,

    file_size BIGINT DEFAULT NULL,

    uploaded_by INT NOT NULL,

    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_result_attachments_result_id (
        result_id
    ),

    KEY idx_result_attachments_uploaded_by (
        uploaded_by
    ),

    CONSTRAINT result_attachments_fk_result
        FOREIGN KEY (result_id)
        REFERENCES examination_results(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT result_attachments_fk_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
-- Recommended production migration for institution-scoped Events.
-- The current events table in the supplied schema has no institution_id.
-- Add it so Admin Events can safely manage every event belonging to its institution.

ALTER TABLE events
    ADD COLUMN institution_id INT NULL AFTER id;

ALTER TABLE events
    ADD KEY idx_events_institution (institution_id);

ALTER TABLE events
    ADD CONSTRAINT fk_events_institution
    FOREIGN KEY (institution_id)
    REFERENCES institutions(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- IMPORTANT:
-- Backfill institution_id for existing events before making it NOT NULL.
-- Example for events created by users with student/professor/admin profiles
-- must be adapted to your actual profile data.
--
-- After backfill:
-- ALTER TABLE events MODIFY institution_id INT NOT NULL;
-- ============================================================
-- VERIFICATION
-- ============================================================

SHOW TABLES;

SHOW TABLES LIKE 'marketplace%';

SELECT * FROM roles;

DESCRIBE student_profiles;
DESCRIBE courses;
DESCRIBE timetables;
DESCRIBE examination_results;
DESCRIBE result_attachments;

-- ============================================================
-- FINAL EDUSPHERE LIBRARY
-- ============================================================
-- Library content belongs to exactly one institution.
-- Students/Professors/Admins can view their own institution only.
-- Super Admin manages content across institutions.
CREATE TABLE IF NOT EXISTS developer_library_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institution_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    resource_type ENUM('BOOK','MATERIAL','EBOOK','NOTE','PDF','OTHER') NOT NULL,
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
    status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT NOT NULL,
    updated_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_library_institution (institution_id),
    KEY idx_library_status_institution (institution_id,status),
    CONSTRAINT fk_library_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_library_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_library_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
);
