-- Segnalibro
-- Migration 004: reference data
-- Rating dimensions and predefined thematic tags.

begin;

insert into public.rating_dimensions
  (dimension_key, genre_id, label_it, sort_order, version, is_active)
values
  ('classics.style',              1, 'Stile di scrittura',       1, 1, true),
  ('classics.characters',         1, 'Personaggi',                2, 1, true),
  ('classics.themes',             1, 'Temi',                      3, 1, true),
  ('classics.pacing',             1, 'Ritmo',                     4, 1, true),
  ('classics.impact',             1, 'Impatto',                   5, 1, true),

  ('mythology.reinterpretation',  2, 'Reinterpretazione',         1, 1, true),
  ('mythology.characters',        2, 'Personaggi',                2, 1, true),
  ('mythology.atmosphere',        2, 'Atmosfera',                 3, 1, true),
  ('mythology.pacing',            2, 'Ritmo',                     4, 1, true),
  ('mythology.world',             2, 'Mondo mitologico',          5, 1, true),

  ('scifi.concept',               3, 'Concept',                   1, 1, true),
  ('scifi.worldbuilding',         3, 'Worldbuilding',             2, 1, true),
  ('scifi.coherence',             3, 'Coerenza',                  3, 1, true),
  ('scifi.characters',            3, 'Personaggi',                4, 1, true),
  ('scifi.pacing',                3, 'Ritmo',                     5, 1, true),

  ('thriller.tension',            4, 'Tensione',                  1, 1, true),
  ('thriller.mystery',            4, 'Mistero',                   2, 1, true),
  ('thriller.twists',             4, 'Colpi di scena',            3, 1, true),
  ('thriller.pacing',             4, 'Ritmo',                     4, 1, true),
  ('thriller.ending',             4, 'Finale',                    5, 1, true),

  ('fantasy.worldbuilding',       5, 'Worldbuilding',             1, 1, true),
  ('fantasy.magic',               5, 'Elemento fantastico / Sistema magico', 2, 1, true),
  ('fantasy.characters',          5, 'Personaggi',                3, 1, true),
  ('fantasy.pacing',              5, 'Ritmo',                     4, 1, true),
  ('fantasy.atmosphere',          5, 'Atmosfera',                 5, 1, true),

  ('romance.chemistry',           6, 'Chimica',                   1, 1, true),
  ('romance.characters',          6, 'Personaggi',                2, 1, true),
  ('romance.relationship',        6, 'Relazione',                 3, 1, true),
  ('romance.emotion',             6, 'Emozione',                  4, 1, true),
  ('romance.pacing',              6, 'Ritmo',                     5, 1, true),

  ('contemporary.characters',     7, 'Personaggi',                1, 1, true),
  ('contemporary.style',          7, 'Stile',                     2, 1, true),
  ('contemporary.setting',        7, 'Ambientazione',             3, 1, true),
  ('contemporary.themes',         7, 'Temi',                      4, 1, true),
  ('contemporary.emotional',      7, 'Impatto emotivo',           5, 1, true)
on conflict (dimension_key) do update set
  genre_id = excluded.genre_id,
  label_it = excluded.label_it,
  sort_order = excluded.sort_order,
  version = excluded.version,
  is_active = excluded.is_active;

insert into public.tags (slug, label_it, sort_order, is_active)
values
  ('friendship',      'Amicizia',       1, true),
  ('love',            'Amore',          2, true),
  ('adventure',       'Avventura',      3, true),
  ('growth',          'Crescita',       4, true),
  ('family',          'Famiglia',       5, true),
  ('coming-of-age',   'Formazione',     6, true),
  ('war',             'Guerra',         7, true),
  ('identity',        'Identità',       8, true),
  ('magic',           'Magia',          9, true),
  ('mystery',         'Mistero',       10, true),
  ('music',           'Musica',        11, true),
  ('nature',          'Natura',        12, true),
  ('loss',            'Perdita',       13, true),
  ('politics',        'Politica',      14, true),
  ('power',           'Potere',        15, true),
  ('religion',        'Religione',     16, true),
  ('revenge',         'Vendetta',      17, true),
  ('loneliness',      'Solitudine',    18, true),
  ('survival',        'Sopravvivenza', 19, true),
  ('betrayal',        'Tradimento',    20, true),
  ('trauma',          'Trauma',        21, true),
  ('travel',          'Viaggio',       22, true),
  ('death',           'Morte',         23, true),
  ('memory',          'Memoria',       24, true),
  ('freedom',         'Libertà',       25, true),
  ('society',         'Società',       26, true),
  ('technology',      'Tecnologia',    27, true)
on conflict (slug) do update set
  label_it = excluded.label_it,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

commit;
