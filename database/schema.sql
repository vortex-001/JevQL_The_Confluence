-- ====================================================================
-- JevQL PostgreSQL Schema Reference: Employee Feedback Dataset
-- ====================================================================

-- 1. Enable standard PostgreSQL Trigram Extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Dataset Metadata Table
CREATE TABLE IF NOT EXISTS datasets_datasetmetadata (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Employee Feedback Table
CREATE TABLE IF NOT EXISTS datasets_employeefeedback (
    id BIGSERIAL PRIMARY KEY,
    dataset_id BIGINT REFERENCES datasets_datasetmetadata(id) ON DELETE CASCADE,
    anonymized_id VARCHAR(32) NOT NULL,
    department VARCHAR(50) NOT NULL,
    role VARCHAR(100) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    sentiment VARCHAR(20) NOT NULL,
    feedback_text TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    submission_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_dept_rating ON datasets_employeefeedback(department, rating);
CREATE INDEX IF NOT EXISTS idx_feedback_dept_sentiment ON datasets_employeefeedback(department, sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_subdate_rating ON datasets_employeefeedback(submission_date, rating);
CREATE INDEX IF NOT EXISTS idx_feedback_trgm_text ON datasets_employeefeedback USING gin (feedback_text gin_trgm_ops);
