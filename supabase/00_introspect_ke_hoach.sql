/* =========================================================
 *  00_introspect_ke_hoach.sql
 *  Đọc cấu trúc 2 bảng Kế hoạch trước khi gộp thành "KeHoach".
 *
 *  ⚠️  CHỈ ĐỌC — không tạo, không sửa, không xoá bất cứ thứ gì.
 *
 *  Cách dùng: Supabase → SQL Editor → dán toàn bộ file này → Run
 *             → bấm vào ô kết quả, copy toàn bộ JSON gửi lại.
 * ========================================================= */
select jsonb_pretty(jsonb_build_object(

  'columns', (
    select jsonb_agg(jsonb_build_object(
             'tbl',      table_name,
             'pos',      ordinal_position,
             'col',      column_name,
             'type',     data_type,
             'udt',      udt_name,
             'nullable', is_nullable,
             'default',  column_default)
           order by table_name, ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('ke_hoach_mot_lan','ke_hoach_lap_lai')
  ),

  'constraints', (
    select jsonb_agg(jsonb_build_object(
             'tbl',  rel.relname,
             'name', con.conname,
             'type', con.contype::text,
             'def',  pg_get_constraintdef(con.oid))
           order by rel.relname, con.conname)
    from pg_constraint con
    join pg_class     rel on rel.oid = con.conrelid
    join pg_namespace ns  on ns.oid  = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('ke_hoach_mot_lan','ke_hoach_lap_lai')
  ),

  'indexes', (
    select jsonb_agg(jsonb_build_object(
             'tbl', tablename, 'name', indexname, 'def', indexdef)
           order by tablename, indexname)
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('ke_hoach_mot_lan','ke_hoach_lap_lai')
  ),

  'rls_enabled', (
    select jsonb_object_agg(rel.relname, rel.relrowsecurity)
    from pg_class rel
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('ke_hoach_mot_lan','ke_hoach_lap_lai')
  ),

  'policies', (
    select jsonb_agg(jsonb_build_object(
             'tbl',   tablename,
             'name',  policyname,
             'cmd',   cmd,
             'perm',  permissive,
             'roles', array_to_string(roles, ','),
             'using', qual,
             'check', with_check)
           order by tablename, policyname)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('ke_hoach_mot_lan','ke_hoach_lap_lai')
  ),

  'realtime', (
    select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in ('ke_hoach_mot_lan','ke_hoach_lap_lai')
  ),

  'row_counts', jsonb_build_object(
    'ke_hoach_mot_lan', (select count(*) from public.ke_hoach_mot_lan),
    'ke_hoach_lap_lai', (select count(*) from public.ke_hoach_lap_lai)
  ),

  'ten_KeHoach_da_ton_tai', (select to_regclass('public."KeHoach"')::text)

)) as schema_info;
