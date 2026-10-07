-- Segnalibro
-- Migration 203: catalogo canonico dei tag tematici in italiano.
--
-- Gli ID dei tag equivalenti già in uso vengono mantenuti. I tag legacy restano
-- nel catalogo, ma inattivi, così le relazioni esistenti non perdono la FK.

begin;

-- Corrispondenze dirette: conservano l'ID già referenziato dalle recensioni.
update public.tags
set
  slug = case slug
    when 'love' then 'romantico'
    when 'growth' then 'crescita-personale'
    when 'society' then 'critica-sociale'
    else slug
  end,
  label_it = case slug
    when 'love' then 'Romantico'
    when 'growth' then 'Crescita personale'
    when 'society' then 'Critica sociale'
    when 'magic' then 'Magia'
    else label_it
  end
where slug in ('love', 'growth', 'society', 'magic');

insert into public.tags (slug, label_it, sort_order, is_active)
values
  ('romantico',               'Romantico',               1, true),
  ('dark-academia',           'Dark academia',           2, true),
  ('plot-twist',              'Plot twist',              3, true),
  ('inquietante',             'Inquietante',             4, true),
  ('disturbante',             'Disturbante',             5, true),
  ('contorto',                'Contorto',                6, true),
  ('claustrofobico',          'Claustrofobico',          7, true),
  ('cupo',                    'Cupo',                    8, true),
  ('narratore-inaffidabile',  'Narratore inaffidabile',  9, true),
  ('character-development',   'Character development',  10, true),
  ('critica-sociale',         'Critica sociale',        11, true),
  ('slow-burn',               'Slow burn',              12, true),
  ('enemies-to-lovers',       'Enemies to lovers',      13, true),
  ('friends-to-lovers',       'Friends to lovers',      14, true),
  ('multi-pov',               'Multi-POV',              15, true),
  ('doppia-linea-temporale',  'Doppia linea temporale', 16, true),
  ('crescita-personale',      'Crescita personale',     17, true),
  ('magic',                   'Magia',                  18, true)
on conflict (slug) do update set
  label_it = excluded.label_it,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- Conservati per le relazioni storiche in user_book_tags, ma non selezionabili.
update public.tags
set is_active = slug in (
  'romantico',
  'dark-academia',
  'plot-twist',
  'inquietante',
  'disturbante',
  'contorto',
  'claustrofobico',
  'cupo',
  'narratore-inaffidabile',
  'character-development',
  'critica-sociale',
  'slow-burn',
  'enemies-to-lovers',
  'friends-to-lovers',
  'multi-pov',
  'doppia-linea-temporale',
  'crescita-personale',
  'magic'
);

commit;
