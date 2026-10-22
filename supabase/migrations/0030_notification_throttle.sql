-- 같은 건의 수정 알림을 2분 단위로 묶기 위한 마지막 알림 시각. 생성 시점도 알림으로 친다(default now()).
alter table public.transactions add column if not exists last_notified_at timestamptz default now();
alter table public.events add column if not exists last_notified_at timestamptz default now();
-- 기존 행은 null -> 첫 수정부터 바로 알림.
