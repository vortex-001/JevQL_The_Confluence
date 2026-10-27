# JevQL Database Documentation & Schemas

This directory contains database documentation, schema dumps, and seeding scripts for JevQL.

## 1. Supported Databases
- **Target Engine**: PostgreSQL 14+ (Tested on PostgreSQL 18.6 64-bit on Windows).
- **Core Extensions**:
  - `pg_trgm`: Standard trigram similarity extension for typo-tolerant fuzzy matching and text similarity ranking (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).
  - Standard PostgreSQL Full-Text Search (`tsvector`, `tsquery`).
- **No Paid Dependencies**: Built 100% on standard, open-source PostgreSQL. No paid extensions required.

## 2. Multi-Database Architecture
JevQL operates on two layers:
1. **Default Demo Database (`jevql_db`)**:
   - Stores synthetic employee feedback data across 8 departments.
   - Fully managed via Django ORM and migrations (`backend/apps/datasets/models.py`).
2. **User-Provided PostgreSQL Connections**:
   - Introspected dynamically in strict read-only transactions (`SET TRANSACTION READ ONLY`).
   - Discovers schemas, tables, and column metadata via `information_schema`.
   - Never stores credentials on disk (encrypted in signed session).
   - All identifiers are strictly allowlisted and escaped with PostgreSQL `quote_ident`.

## 3. Schema Reference
See `schema.sql` for table structure and `seed_demo.sql` for sample data.
