-- 004_add_people_metadata.sql
-- Adds a metadata JSONB column to people for unstructured CSV imports

ALTER TABLE people 
ADD COLUMN metadata JSONB DEFAULT '{}';
