-- Add has_implicit_task and task_name to production_variables table
ALTER TABLE production_variables
ADD COLUMN has_implicit_task boolean NOT NULL DEFAULT false,
ADD COLUMN task_name text;

-- Add comment to document the new fields
COMMENT ON COLUMN production_variables.has_implicit_task IS 'Indicates if this variable requires automatic task creation when orders are placed';
COMMENT ON COLUMN production_variables.task_name IS 'Name of the automatic task to create when has_implicit_task is true';