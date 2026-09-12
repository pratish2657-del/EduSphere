-- ============================================================
-- DEVELOPER ROLE / VERIFICATION FIX
-- Idempotent: safe to run on the existing EduSphere database.
-- ============================================================

USE edu_sphere;

INSERT IGNORE INTO roles (name)
VALUES ('DEVELOPER');

-- No user data is modified here. A user with role_id=NULL will receive
-- the DEVELOPER role atomically when the Developer profile is submitted.
