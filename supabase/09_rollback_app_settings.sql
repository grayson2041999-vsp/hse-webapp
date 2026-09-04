/* 09_rollback_app_settings.sql — trả về tên cũ. An toàn mọi lúc. */
begin;
alter table public."TraCuuATVSLD" rename to app_settings;
commit;
notify pgrst, 'reload schema';
