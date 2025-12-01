-- Remove task_trigger_values column as it's not needed
-- Only task_exclude_values will be used to prevent task creation
ALTER TABLE production_variables
DROP COLUMN task_trigger_values;

COMMENT ON COLUMN production_variables.task_exclude_values IS 'Values that prevent task creation. By default, task is always created unless the value matches one of these exclusions';