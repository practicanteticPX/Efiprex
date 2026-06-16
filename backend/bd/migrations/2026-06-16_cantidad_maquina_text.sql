ALTER TABLE tablas_servicios."T_Hist_Formulario"
  ALTER COLUMN "cantidad_maquina" TYPE text USING COALESCE("cantidad_maquina"::text, 'N/A');
