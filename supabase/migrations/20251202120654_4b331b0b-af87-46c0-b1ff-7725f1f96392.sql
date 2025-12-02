-- Añadir campos de tareas implícitas a la tabla additionals
ALTER TABLE additionals 
ADD COLUMN has_implicit_task boolean NOT NULL DEFAULT false,
ADD COLUMN task_name text,
ADD COLUMN task_phase_id uuid REFERENCES production_phases(id),
ADD COLUMN task_exclude_values text[] DEFAULT '{}';

-- Añadir índice para mejorar el rendimiento
CREATE INDEX idx_additionals_task_phase ON additionals(task_phase_id) WHERE has_implicit_task = true;

COMMENT ON COLUMN additionals.has_implicit_task IS 'Indica si este ajuste genera automáticamente una tarea de producción';
COMMENT ON COLUMN additionals.task_name IS 'Nombre de la tarea que se creará automáticamente';
COMMENT ON COLUMN additionals.task_phase_id IS 'Fase de producción asociada a la tarea';
COMMENT ON COLUMN additionals.task_exclude_values IS 'Valores del ajuste que excluyen la creación de la tarea';