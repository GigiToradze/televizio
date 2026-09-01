-- Exactly what index.html shows today, so swapping the site over to the
-- published snapshot is invisible to a visitor.
--
-- euronews, cnn, bbc, discovery, natgeo, cartoon, nickelodeon and setanta
-- carry the same string in both languages. That is deliberate: it is how the
-- renderer knows to print one bare name instead of two .ka/.en spans.

insert into public.categories (slug, name_ka, name_en, sort_order) values
  ('ge',    'ქართული',       'Georgian',    1),
  ('news',  'ახალი ამბები',  'News',        2),
  ('sport', 'სპორტი',        'Sport',       3),
  ('doc',   'დოკუმენტური',   'Documentary', 4),
  ('kids',  'საბავშვო',      'Kids',        5)
on conflict (slug) do nothing;

insert into public.channels
  (slug, name_ka, name_en, logo_path, logo_w, logo_h, sort_order, in_slider, slider_order) values
  ('1tv',         'პირველი არხი',        'First Channel',        'channels/1tv.svg',          465,  465,  1, true,  4),
  ('imedi',       'იმედი',               'Imedi',                'channels/imedi.png',        138,  120,  2, true,  1),
  ('rustavi2',    'რუსთავი 2',           'Rustavi 2',            'channels/rustavi2.png',     129,  120,  3, true,  2),
  ('formula',     'ფორმულა',             'Formula',              'channels/formula.png',       65,  120,  4, true,  6),
  ('palitranews', 'პალიტრანიუსი',        'Palitra News',         'channels/palitranews.png',  267,  120,  5, true,  8),
  ('euronews',    'Euronews',            'Euronews',             'channels/euronews.svg',    2106,  250,  6, true, 12),
  ('cnn',         'CNN',                 'CNN',                  'channels/cnn.png',          258,  120,  7, true,  5),
  ('bbc',         'BBC News',            'BBC News',             'channels/bbc.svg',          560,  160,  8, true, 13),
  ('discovery',   'Discovery',           'Discovery',            'channels/discovery.png',    579,  120,  9, true,  3),
  ('natgeo',      'National Geographic', 'National Geographic',  'channels/natgeo.svg',      1000,  294, 10, true,  7),
  ('cartoon',     'Cartoon Network',     'Cartoon Network',      'channels/cartoon.png',      200,  120, 11, true,  9),
  ('nickelodeon', 'Nickelodeon',         'Nickelodeon',          'channels/nickelodeon.png',  830,  120, 12, true, 11),
  ('setanta',     'Setanta Sports',      'Setanta Sports',       'channels/setanta.png',      426,  120, 13, true, 10)
on conflict (slug) do nothing;

-- sort_order 0 is the category printed on the card as .chan__tag
insert into public.channel_categories (channel_id, category_id, sort_order)
select c.id, k.id, v.ord
from (values
  ('1tv','ge',0), ('imedi','ge',0), ('rustavi2','ge',0),
  ('formula','ge',0), ('formula','news',1),
  ('palitranews','ge',0), ('palitranews','news',1),
  ('euronews','news',0), ('cnn','news',0), ('bbc','news',0),
  ('discovery','doc',0), ('natgeo','doc',0),
  ('cartoon','kids',0), ('nickelodeon','kids',0),
  ('setanta','sport',0)
) as v(ch, cat, ord)
join public.channels   c on c.slug = v.ch
join public.categories k on k.slug = v.cat
on conflict do nothing;

insert into public.plans
  (slug, name_ka, name_en, price, badge_ka, badge_en, is_featured, total_label, sort_order) values
  ('basic',    'საბაზისო',      'Basic',    19, null, null, false, '180+',  1),
  ('standard', 'სტანდარტული',   'Standard', 29,
     'ყველაზე პოპულარული', 'Most popular', true, '520+',  2),
  ('premium',  'პრემიუმი',      'Premium',  45, null, null, false, '1 024', 3)
on conflict (slug) do nothing;

insert into public.plan_features (plan_id, text_ka, text_en, sort_order)
select p.id, v.ka, v.en, v.ord
from (values
  ('basic',    '180+ არხი',              '180+ channels',         1),
  ('basic',    'HD ხარისხი',             'HD quality',            2),
  ('basic',    '1 მოწყობილობა',          '1 device',              3),
  ('basic',    '3 დღიანი არქივი',        '3-day archive',         4),
  ('standard', '520+ არხი',              '520+ channels',         1),
  ('standard', 'Full HD ხარისხი',        'Full HD quality',       2),
  ('standard', '3 მოწყობილობა',          '3 devices',             3),
  ('standard', '7 დღიანი არქივი',        '7-day archive',         4),
  ('standard', 'ყუთი უფასოდ 12 თვეზე',   'Free box on 12 months', 5),
  ('premium',  '1024 არხი',              '1,024 channels',        1),
  ('premium',  '4K HDR ხარისხი',         '4K HDR quality',        2),
  ('premium',  '5 მოწყობილობა',          '5 devices',             3),
  ('premium',  '14 დღიანი არქივი',       '14-day archive',        4),
  ('premium',  'სპორტული პაკეტი შედის',  'Sport pack included',   5)
) as v(plan, ka, en, ord)
join public.plans p on p.slug = v.plan
where not exists (select 1 from public.plan_features f where f.plan_id = p.id);

-- basic: the six every plan carries. standard adds five. premium takes all.
insert into public.plan_channels (plan_id, channel_id)
select p.id, c.id from public.plans p, public.channels c
where (p.slug = 'basic'
        and c.slug in ('1tv','imedi','rustavi2','formula','palitranews','euronews'))
   or (p.slug = 'standard'
        and c.slug in ('1tv','imedi','rustavi2','formula','palitranews','euronews',
                       'cnn','bbc','discovery','cartoon','nickelodeon'))
   or (p.slug = 'premium')
on conflict do nothing;

insert into public.site_settings (key, value_text, value_num, description) values
  ('channel_count',       '1 024',  1024, 'the stat counter under the guide'),
  ('hero_channels_label', '1,000+', null, 'the figure in the hero headline'),
  ('rewind_days',         '14',       14, 'how far back the archive goes'),
  ('country_count',       '40',       40, 'countries named in the channels lede')
on conflict (key) do nothing;
