-- ============================================================
-- 栖屿设计 · 演示种子数据（第 4 步冒烟用，幂等可重跑）
-- 仅插入 published 状态内容，供前台 8 视图展示渲染。
-- ============================================================

-- ---------- 案例（3 条，覆盖 3 分类 + 精选） ----------
INSERT INTO cases
  (slug, category, title, cover, gallery, video_url, summary, content,
   style_tags, house_type_tags, area_range, location, area, year,
   designer, studio, material_notes, price_per_sqm, price_note,
   is_featured, view_count, status, created_at, updated_at)
VALUES
  ('sunny-one-bed', 'small', '45㎡ 一居 · 阳光奶油小家', '', '[]', NULL,
   '把 45㎡ 一间老房改造成通透明亮的奶油风小家，独立玄关、岛台厨房与客厅一体化。',
   '原始户型采光不足、收纳杂乱。改造核心：打通厨房与客厅形成 LDK 一体化，全屋以奶油白+原木为主调，定制整墙收纳柜体，主卧增加步入式衣柜。\n\n最终落地：通透感翻倍，储物量是原来的 2.5 倍，整体预算控制在 12.6 万。',
   '["奶油风"]', '["一居室"]', '40-50㎡', '上海 · 徐汇', 45, 2025,
   '林小满', '栖屿设计', '进口桦木多层板柜体 / 微水泥地面 / 隐形门把手', 280, '全案设计约 ¥280/㎡ 起',
   TRUE, 163, 'published', now(), now()),

  ('loft-no9', 'apartment', '公寓改造 · 9㎡ 极小户型逆袭', '', '[]', NULL,
   '9㎡ 的极小小公寓，折叠家具+垂直收纳，一物三用住出完整生活。',
   '这是全上海最小的改造项目之一。9㎡ 要装下睡眠、工作、用餐、储物四种功能。\n\n方案：全屋定制折叠系统（床+桌+柜联动）、垂直墙面收纳、隐藏式玄关，所有家具一物多能。',
   '["原木风"]', '["开间"]', '<30㎡', '上海 · 静安', 9, 2025,
   '陈卓', '栖屿设计', '折叠五金系统 / 松木多层板 / 洞洞板墙面系统', 320, '全案设计约 ¥320/㎡ 起',
   TRUE, 289, 'published', now(), now()),

  ('wabi-2br', 'private', '两居侘寂 · 老宅新生', '', '[]', NULL,
   '82㎡ 两居老宅，侘寂风重塑：微水泥、原木、光影，让时间慢下来。',
   '业主是一对退休夫妇，希望老宅安静、温润、好打理。\n\n设计以侘寂美学为核心：微水泥墙面、橡木地板、隐藏式收纳，客厅改造成茶室与阅读区，光线随一天流动。',
   '["侘寂风"]', '["两居室"]', '60-70㎡', '上海 · 长宁', 82, 2024,
   '林小满', '栖屿设计', '微水泥 / 橡木地板 / 无主灯照明', 300, '全案设计约 ¥300/㎡ 起',
   TRUE, 142, 'published', now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ---------- 套餐（3 条 + 流程步骤） ----------
INSERT INTO packages
  (slug, name, type, cover, summary, description, applicable_house_type,
   price_per_sqm, price_from, area_step_coefficient, price_note,
   status, created_at, updated_at)
VALUES
  ('single-space', '单空间定制', 'single_space', '',
   '只做一个空间（客厅/卧室/厨房任选其一），从布局到软装一站式落地。',
   '适合预算有限、只需要重点改造一个空间的你。\n\n包含：上门量房 + 空间平面方案 + 效果图 + 主材陪购 + 施工跟踪 + 软装搭配。\n\n工期约 2-4 周。',
   '一居室 / 开间 / 小两居', 280, 12000, 1.0, '¥280/㎡ 起 · 最低 1.2万元/套',
   'published', now(), now()),
  ('whole-house', '全屋整装', 'whole_house', '',
   '整屋从毛坯/旧房到拎包入住，全案设计+施工+软装一站式交付。',
   '全程不做甩手掌柜的担忧：一个团队从头跟到尾。\n\n包含：全屋方案 + 拆改施工 + 主材陪购 + 定制柜体 + 软装进场 + 整体摆场。\n\n工期约 6-10 周，全程节点验收。',
   '一居室 / 开间 / 小两居', 280, 35000, 1.0, '¥280/㎡ 起 · 整套约 ¥3.5万',
   'published', now(), now()),
  ('japandi-style', '日式原木风格定制', 'style', '',
   '按喜欢的风格整屋设计 —— 原木风、奶油风、侘寂风任选。',
   '先选风格，再做全屋：风格定制的关键在于「整体性」。\n\n包含：风格调研 + 全屋方案 + 效果图 + 材质样板 + 施工落地 + 软装搭配。',
   '任意户型', 300, 30000, 1.1, '¥300/㎡ 起 · 整套约 ¥3万',
   'published', now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO package_process_steps (package_id, step_no, title, description, created_at)
SELECT p.id, s.step_no, s.title, s.description, now()
FROM packages p
JOIN (VALUES
  ('single-space', 1, '需求问卷', '填写问卷，明确预算与偏好'),
  ('single-space', 2, '上门量房', '免费量房，确认空间条件'),
  ('single-space', 3, '方案确认', '平面布局与效果图确认'),
  ('single-space', 4, '落地交付', '施工跟踪与软装摆场')
) AS s(slug, step_no, title, description) ON s.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM package_process_steps ps WHERE ps.package_id = p.id AND ps.step_no = s.step_no
);

INSERT INTO package_process_steps (package_id, step_no, title, description, created_at)
SELECT p.id, s.step_no, s.title, s.description, now()
FROM packages p
JOIN (VALUES
  ('whole-house', 1, '需求问卷', '填写问卷，明确预算与偏好'),
  ('whole-house', 2, '上门量房', '免费量房，确认空间条件'),
  ('whole-house', 3, '方案设计', '全屋方案与效果图'),
  ('whole-house', 4, '拆改施工', '节点验收，主材陪购'),
  ('whole-house', 5, '软装交付', '家具软装进场，拎包入住')
) AS s(slug, step_no, title, description) ON s.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM package_process_steps ps WHERE ps.package_id = p.id AND ps.step_no = s.step_no
);

INSERT INTO package_process_steps (package_id, step_no, title, description, created_at)
SELECT p.id, s.step_no, s.title, s.description, now()
FROM packages p
JOIN (VALUES
  ('japandi-style', 1, '风格调研', '确认你喜欢的风格倾向'),
  ('japandi-style', 2, '上门量房', '免费量房与材质采样'),
  ('japandi-style', 3, '风格方案', '整体风格方案与样板'),
  ('japandi-style', 4, '落地软装', '施工落地与软装搭配')
) AS s(slug, step_no, title, description) ON s.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM package_process_steps ps WHERE ps.package_id = p.id AND ps.step_no = s.step_no
);

-- ---------- 新闻（2 条） ----------
INSERT INTO news
  (slug, category, title, cover, summary, content, published_at, status, created_at, updated_at)
VALUES
  ('qiyu-2025-year-review', 'company', '栖屿 2025 年度回顾：500+ 小家落地', '',
   '一年时间，500+ 套独居小家从图纸变成现实，感恩每一位选择栖屿的你。',
   '2025 年，栖屿完成了 500+ 套单人居小家的设计落地，覆盖上海 10 个区。\n\n这一年我们升级了全屋整装服务、上线了透明套餐体系，让预算和流程都「一眼看清」。\n\n新的一年，我们继续专注把小户型住成温馨的家。',
   '2026-01-15 10:00:00+08', 'published', now(), now()),
  ('small-space-trends-2026', 'industry', '2026 小户型设计趋势：收纳 + 多功能', '',
   '从隐藏收纳到一物多用，看看今年小户型设计都在流行什么。',
   '2026 年的小户型设计关键词：隐藏式收纳、多功能家具、LDK 一体化、微水泥质感。\n\n小空间不再「将就」，而是通过精心的功能规划住出大房子的体验。',
   '2026-02-01 10:00:00+08', 'published', now(), now())
ON CONFLICT (slug) DO NOTHING;

-- ---------- 团队（4 条，active） ----------
INSERT INTO team_members (name, title, avatar, specialty, bio, staff_id, "order", active, created_at)
VALUES
  ('林小满', '创始人 / 首席设计师', '', '原木风 / 奶油风', '8 年小户型改造经验，服务 300+ 独居青年。', NULL, 1, TRUE, now()),
  ('陈卓', '主案设计师', '', '公寓改造 / 极简', '专注极小户型空间利用，作品登上家居杂志 3 次。', NULL, 2, TRUE, now()),
  ('顾青', '软装设计师', '', '侘寂风 / 软装搭配', '从材质到摆场，让家拥有「人住过」的温度。', NULL, 3, TRUE, now()),
  ('周屿', '项目管家', '', '施工管理', '全程节点验收，主材陪购，让交付不操心。', NULL, 4, TRUE, now())
ON CONFLICT DO NOTHING;

-- ---------- 招聘（2 条） ----------
INSERT INTO careers
  (title, category, location, type, duties, status, created_at, updated_at)
VALUES
  ('室内设计师（2 年以上）', 'social', '上海', '全职',
   '独立完成量房、平面方案与效果图，参与全案落地。\n要求：室内设计相关专业，2 年以上经验，熟练 CAD/SU/渲染软件。',
   'published', now(), now()),
  ('设计实习生（2026 届）', 'campus', '上海', '实习',
   '协助主案完成量房、绘图与素材收集。\n要求：设计相关专业在读，每周可到岗 4 天以上。',
   'published', now(), now())
ON CONFLICT DO NOTHING;

-- ---------- 站点配置（id=1 单例，upsert） ----------
INSERT INTO site_config
  (id, company_intro, brand_intro, process_intro, contact_info, social_links, updated_at)
VALUES
  (1,
   '栖屿设计专注「个人独居温馨小家定制」，为 22–35 岁的独居青年，把一居、开间、小两居住成刚刚好的家。',
   '我们相信，独居不是将就，而是另一种值得认真对待的生活方式。每一次设计，都是从「你的日常」出发。',
   '从需求到入住，四阶段标准化服务，让你安心做「甩手掌柜」。',
   '{"address":"上海市 · 静安区 · 栖屿设计工作室","phone":"021-6100-8800","email":"hello@qiyu.design","hours":"周一至周日 9:00–20:00"}',
   '[{"name":"微信","url":"#"},{"name":"小红书","url":"#"},{"name":"抖音","url":"#"},{"name":"视频号","url":"#"}]',
   now())
ON CONFLICT (id) DO UPDATE SET
  company_intro = EXCLUDED.company_intro,
  brand_intro = EXCLUDED.brand_intro,
  process_intro = EXCLUDED.process_intro,
  contact_info = EXCLUDED.contact_info,
  social_links = EXCLUDED.social_links,
  updated_at = now();

INSERT INTO site_history_items (year, title, description, sort, created_at)
VALUES
  ('2021', '栖屿工作室成立', '从一间旧民居改造开始，服务第一批独居青年。', 1, now()),
  ('2023', '标准化服务流程上线', '4 步标准流程 + 透明套餐，覆盖 500+ 小家方案。', 2, now()),
  ('2025', '全屋整装服务扩展', '从设计到落地一站式交付，让更多人安心入住。', 3, now())
ON CONFLICT DO NOTHING;