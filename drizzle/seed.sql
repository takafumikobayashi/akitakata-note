-- クローズド語彙の初期投入（ADR-0006 で確定した固定slug）。
-- 冪等: INSERT OR IGNORE。適用: wrangler d1 execute akitakata-note --file drizzle/seed.sql [--local|--remote]

-- Season（12/06 §6, 季節）
INSERT OR IGNORE INTO seasons (slug, name, sort_order) VALUES
  ('spring',   '春',   1),
  ('summer',   '夏',   2),
  ('autumn',   '秋',   3),
  ('winter',   '冬',   4),
  ('all-year', '通年', 5);

-- Theme（06 §6, テーマ）
INSERT OR IGNORE INTO themes (slug, name, sort_order) VALUES
  ('nature',   '自然',       1),
  ('culture',  '文化',       2),
  ('daily',    '日常',       3),
  ('event',    'イベント',   4),
  ('food',     '食',         5),
  ('mobility', '移動・行き方', 6);
