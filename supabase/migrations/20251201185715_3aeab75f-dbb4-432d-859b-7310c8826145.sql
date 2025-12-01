-- Add conditional task trigger fields to production_variables
ALTER TABLE production_variables
ADD COLUMN task_trigger_values text[] DEFAULT '{}',
ADD COLUMN task_exclude_values text[] DEFAULT '{}';

COMMENT ON COLUMN production_variables.task_trigger_values IS 'Values that trigger task creation. If not empty, task is only created when mapped prompt/output value matches one of these';
COMMENT ON COLUMN production_variables.task_exclude_values IS 'Values that prevent task creation. Task is NOT created when mapped prompt/output value matches one of these';