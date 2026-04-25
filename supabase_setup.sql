-- ============================================================
-- ひとり営業用 顧客管理アプリ — Supabase 初期セットアップ
-- Supabase SQL Editor で本ファイルをまるごと貼り付けて実行する
-- ============================================================

-- ------------------------------------------------------------
-- 0. 既存オブジェクトのクリーンアップ（再実行できるように）
--    テーブルを CASCADE で落とせば、付随するトリガ・ポリシー・FK は
--    まとめて消える。トリガを先に DROP しようとするとテーブル未作成時
--    （初回実行）に "relation does not exist" で落ちるため順序が重要。
-- ------------------------------------------------------------
drop table if exists public.deals     cascade;
drop table if exists public.customers cascade;
drop function if exists public.set_updated_at();

-- ------------------------------------------------------------
-- 1. customers テーブル
-- ------------------------------------------------------------
create table public.customers (
  id          uuid        primary key default gen_random_uuid(),
  company     text        not null,
  name        text        not null,
  title       text,
  email       text,
  phone       text,
  memo        text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. deals テーブル（customer_id は customers(id) を参照、削除時カスケード）
-- ------------------------------------------------------------
create table public.deals (
  id           uuid        primary key default gen_random_uuid(),
  customer_id  uuid        not null
               references public.customers(id) on delete cascade,
  title        text        not null,
  amount       bigint,
  status       text        not null
               check (status in ('lead', 'proposal', 'won')),
  memo         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index deals_customer_id_idx on public.deals (customer_id);

-- ------------------------------------------------------------
-- 3. updated_at 自動更新トリガ
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_deals_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. RLS 有効化
-- ------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.deals     enable row level security;

-- ------------------------------------------------------------
-- 5. ポリシー — Publishable key（anon ロール）から全操作を許可
--    customers / deals 各 4 ポリシー（select / insert / update / delete）
-- ------------------------------------------------------------

-- customers
create policy "customers_select_anon" on public.customers
  for select to anon
  using (true);

create policy "customers_insert_anon" on public.customers
  for insert to anon
  with check (true);

create policy "customers_update_anon" on public.customers
  for update to anon
  using (true) with check (true);

create policy "customers_delete_anon" on public.customers
  for delete to anon
  using (true);

-- deals
create policy "deals_select_anon" on public.deals
  for select to anon
  using (true);

create policy "deals_insert_anon" on public.deals
  for insert to anon
  with check (true);

create policy "deals_update_anon" on public.deals
  for update to anon
  using (true) with check (true);

create policy "deals_delete_anon" on public.deals
  for delete to anon
  using (true);

-- ------------------------------------------------------------
-- 6. 初期データ — 顧客 3 件 / 商談 5 件
--    CTE で customers を INSERT しつつ返却された id を deals に紐付ける
-- ------------------------------------------------------------
with ins_customers as (
  insert into public.customers (company, name, title, email, phone, memo) values
    ('株式会社アルファ商事', '田中 太郎', '営業部長',     'tanaka@alpha.example.jp',  '03-1234-5678',
     '4月に初回訪問。意思決定はスピーディー。GW明けに再提案予定。'),
    ('ベータ工業株式会社',   '佐藤 花子', '購買担当',     'sato@beta.example.jp',     '06-2345-6789',
     '価格に敏感。複数社で見積もり比較中。決裁は部長決裁。'),
    ('ガンマソフト合同会社', '鈴木 一郎', '代表取締役',   'suzuki@gamma.example.jp',  '050-9876-5432',
     '先方から提案依頼あり。技術寄りの会話を好む。')
  returning id, company
)
insert into public.deals (customer_id, title, amount, status, memo)
select c.id, d.title, d.amount, d.status, d.memo
from ins_customers c
join (values
  ('株式会社アルファ商事', '基幹システム刷新提案',     5000000, 'proposal',
   '比較対象は2社。技術検証は通過済み。'),
  ('株式会社アルファ商事', '保守契約 年次更新',         1200000, 'won',
   '4月契約更新済。次回更新は来年4月。'),
  ('ベータ工業株式会社',   '在庫管理ツール導入',         800000, 'lead',
   '部長と一度ヒアリングしたのみ。要件はこれから整理。'),
  ('ベータ工業株式会社',   '物流コンサル提案',          2000000, 'proposal',
   '提案書送付済み。先方検討中、回答待ち。'),
  ('ガンマソフト合同会社', 'スマホアプリ受託開発',      3500000, 'lead',
   '初回打ち合わせ完了。要件定義はこれから。')
) as d(company, title, amount, status, memo)
on c.company = d.company;

-- ------------------------------------------------------------
-- 7. 動作確認用クエリ（任意：実行ログで件数が見えるだけ）
-- ------------------------------------------------------------
select 'customers' as table_name, count(*) as rows from public.customers
union all
select 'deals',                  count(*)          from public.deals;
