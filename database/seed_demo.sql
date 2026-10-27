-- ====================================================================
-- JevQL Synthetic Seed Data (Sample Subset)
-- ====================================================================

INSERT INTO datasets_datasetmetadata (name, slug, description, total_records, is_active, created_at, updated_at)
VALUES (
    'Employee Feedback & Survey Dataset',
    'employee-feedback',
    'Quarterly synthetic employee feedback across Engineering, Product, Sales, Marketing, CS, HR, Finance, and Operations.',
    120,
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO datasets_employeefeedback (dataset_id, anonymized_id, department, role, rating, sentiment, feedback_text, tags, submission_date, created_at, updated_at)
SELECT id, 'EMP-1001', 'Engineering', 'Senior Backend Engineer', 2, 'Negative', 'Our CI/CD pipeline takes over 45 minutes on average, causing massive deployment bottlenecks.', '["tooling", "ci-cd", "deployment"]'::jsonb, CURRENT_DATE - 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM datasets_datasetmetadata WHERE slug = 'employee-feedback'
ON CONFLICT DO NOTHING;

INSERT INTO datasets_employeefeedback (dataset_id, anonymized_id, department, role, rating, sentiment, feedback_text, tags, submission_date, created_at, updated_at)
SELECT id, 'EMP-1002', 'Engineering', 'Full Stack Developer', 5, 'Positive', 'The migration to Kubernetes and modern service architecture has dramatically increased our team velocity.', '["tooling", "infrastructure", "kubernetes"]'::jsonb, CURRENT_DATE - 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM datasets_datasetmetadata WHERE slug = 'employee-feedback'
ON CONFLICT DO NOTHING;

INSERT INTO datasets_employeefeedback (dataset_id, anonymized_id, department, role, rating, sentiment, feedback_text, tags, submission_date, created_at, updated_at)
SELECT id, 'EMP-1003', 'Sales', 'Enterprise Account Executive', 4, 'Positive', 'Our new pricing tiers and sales enablement decks made closing deals significantly easier this quarter.', '["pricing", "sales", "revenue"]'::jsonb, CURRENT_DATE - 45, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM datasets_datasetmetadata WHERE slug = 'employee-feedback'
ON CONFLICT DO NOTHING;
