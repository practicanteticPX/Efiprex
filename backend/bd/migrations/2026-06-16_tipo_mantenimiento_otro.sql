INSERT INTO public."T_Dim_TipoMantenimiento" (tipo)
SELECT 'Otro'
WHERE NOT EXISTS (
  SELECT 1
  FROM public."T_Dim_TipoMantenimiento"
  WHERE LOWER(TRIM(tipo)) = 'otro'
);
