-- Add task_phase_id column to production_variables table
ALTER TABLE production_variables
ADD COLUMN task_phase_id uuid REFERENCES production_phases(id);

-- Add comment explaining the column
COMMENT ON COLUMN production_variables.task_phase_id IS 'Phase assigned to implicit tasks created by this variable';