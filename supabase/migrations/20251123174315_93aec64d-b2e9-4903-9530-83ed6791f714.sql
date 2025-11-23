-- Paso 1: Añadir 'gestor' al enum de roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gestor';