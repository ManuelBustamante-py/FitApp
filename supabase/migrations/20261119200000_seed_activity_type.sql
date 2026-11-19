-- Catálogo de actividades con valores MET (tarea #9).
--
-- Fuente: Ainsworth BE et al. 2011 Compendium of Physical Activities: a second
-- update of codes and MET values. Med Sci Sports Exerc 2011;43(8):1575-81.
-- Cada fila lleva en un comentario el código del Compendium del que sale su MET.
-- Las velocidades en mph del Compendium se pasan a km/h (1 mph = 1,609 km/h).
--
-- Los MET son brutos (incluyen el reposo, 1 MET); el gasto neto se calcula en la
-- aplicación restando la TMB del tiempo de la sesión (docs/03, sección 4.4).
--
-- Idempotente: se puede volver a ejecutar; si el código ya existe, corrige el
-- nombre, el MET y la categoría sin cambiar el id (las sesiones lo referencian).

insert into public.activity_type (code, name_es, met, category) values
  -- Bicicleta estática
  ('bici_estatica_muy_suave', 'Bicicleta estática, muy suave (30–50 W)', 3.5, 'cardio'),    -- 02011
  ('bici_estatica_suave', 'Bicicleta estática, suave (51–89 W)', 4.8, 'cardio'),            -- 02017
  ('bici_estatica_moderada', 'Bicicleta estática, moderada (90–100 W)', 6.8, 'cardio'),     -- 02012
  ('bici_estatica_intensa', 'Bicicleta estática, intensa (101–160 W)', 8.8, 'cardio'),      -- 02013
  ('bici_estatica_muy_intensa', 'Bicicleta estática, muy intensa (161–200 W)', 11.0, 'cardio'), -- 02014
  ('spinning', 'Spinning (clase de bicicleta estática)', 8.5, 'cardio'),                     -- 02019

  -- Caminata
  ('caminata_lenta', 'Caminata lenta (3,2 km/h)', 2.8, 'cardio'),                            -- 17152
  ('caminata_moderada', 'Caminata moderada (4,5–5,1 km/h)', 3.5, 'cardio'),                 -- 17190
  ('caminata_rapida', 'Caminata rápida (5,6 km/h)', 4.3, 'cardio'),                          -- 17200
  ('caminata_muy_rapida', 'Caminata muy rápida (6,4 km/h)', 5.0, 'cardio'),                 -- 17220
  ('caminata_7_km_h', 'Caminata enérgica (7,2 km/h)', 7.0, 'cardio'),                        -- 17230
  ('senderismo', 'Senderismo o caminata por cerro', 6.0, 'cardio'),                          -- 17080

  -- Trote y carrera
  ('trote', 'Trote, general', 7.0, 'cardio'),                                                -- 12020
  ('carrera_8_km_h', 'Carrera a 8 km/h', 8.3, 'cardio'),                                     -- 12030
  ('carrera_9_7_km_h', 'Carrera a 9,7 km/h', 9.8, 'cardio'),                                 -- 12050
  ('carrera_11_3_km_h', 'Carrera a 11,3 km/h', 11.0, 'cardio'),                              -- 12070

  -- Otras máquinas de cardio
  ('eliptica', 'Elíptica, esfuerzo moderado', 5.0, 'cardio'),                                -- 02048
  ('remo_maquina_moderado', 'Máquina de remo, moderado', 4.8, 'cardio'),                     -- 02071
  ('remo_maquina_intenso', 'Máquina de remo, intenso (150 W)', 8.5, 'cardio'),               -- 02073
  ('escaladora', 'Escaladora (máquina de escalones)', 9.0, 'cardio'),                        -- 02065
  ('subir_escaleras_lento', 'Subir escaleras, ritmo lento', 4.0, 'cardio'),                  -- 17133
  ('subir_escaleras_rapido', 'Subir escaleras, ritmo rápido', 8.8, 'cardio'),                -- 17134

  -- Bicicleta al aire libre
  ('bicicleta_paseo', 'Bicicleta, paseo (16–19 km/h)', 6.8, 'cardio'),                       -- 01020
  ('bicicleta_moderada', 'Bicicleta, moderada (19–22 km/h)', 8.0, 'cardio'),                 -- 01030
  ('bicicleta_rapida', 'Bicicleta, rápida (22–26 km/h)', 10.0, 'cardio'),                    -- 01040

  -- Natación
  ('natacion_recreativa', 'Natación recreativa (sin series)', 6.0, 'cardio'),                -- 18310
  ('natacion_crol_suave', 'Natación crol, suave o moderada', 5.8, 'cardio'),                 -- 18240
  ('natacion_crol_intensa', 'Natación crol, rápida e intensa', 9.8, 'cardio'),               -- 18230

  -- Clases y otros ejercicios aeróbicos
  ('saltar_cuerda', 'Saltar la cuerda, ritmo moderado', 11.8, 'cardio'),                     -- 15552
  ('aerobica', 'Aeróbica, general', 7.3, 'cardio'),                                          -- 03015
  ('baile', 'Baile, general', 7.8, 'cardio'),                                                -- 03031
  ('hiit_circuito', 'HIIT o circuito intenso, con poco descanso', 8.0, 'cardio'),            -- 02040

  -- Fuerza
  ('pesas_ligeras', 'Pesas, esfuerzo ligero o moderado (8–15 repeticiones)', 3.5, 'strength'), -- 02054
  ('pesas_intensas', 'Pesas, esfuerzo intenso', 6.0, 'strength'),                            -- 02050
  ('circuito_moderado', 'Circuito de fuerza, moderado', 4.3, 'strength'),                    -- 02030

  -- Flexibilidad
  ('estiramiento', 'Estiramiento suave', 2.3, 'flexibility'),                                -- 02101
  ('yoga_hatha', 'Yoga (hatha)', 2.5, 'flexibility'),                                        -- 02150
  ('yoga_power', 'Yoga (power)', 4.0, 'flexibility'),                                        -- 02160
  ('pilates', 'Pilates', 3.0, 'flexibility'),                                                -- 02105

  -- Deportes
  ('futbol_recreativo', 'Fútbol recreativo (pichanga)', 7.0, 'sport'),                       -- 15610
  ('futbol_competitivo', 'Fútbol competitivo', 10.0, 'sport'),                               -- 15605
  ('basquetbol', 'Básquetbol, general', 6.5, 'sport'),                                       -- 15055
  ('tenis', 'Tenis, general', 7.3, 'sport'),                                                 -- 15675

  -- Actividades cotidianas
  ('pasear_perro', 'Pasear al perro', 3.0, 'daily'),                                         -- 17165
  ('aspirar', 'Aspirar, esfuerzo moderado', 3.3, 'daily'),                                   -- 05043
  ('limpieza_pesada', 'Limpieza pesada (lavar el auto, ventanas)', 3.5, 'daily'),            -- 05020
  ('jardineria', 'Jardinería, general', 3.8, 'daily')                                        -- 08245
on conflict (code) do update set
  name_es = excluded.name_es,
  met = excluded.met,
  category = excluded.category;
