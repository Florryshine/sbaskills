-- Workstream 1: Paystack Subaccount Fee Payments
alter table public.schools add column if not exists paystack_subaccount_code text;
alter table public.schools add column if not exists paystack_bank_code text;
alter table public.schools add column if not exists paystack_account_number text;
alter table public.schools add column if not exists paystack_account_name text;
alter table public.schools add column if not exists paystack_settlement_bank text;
alter table public.schools add column if not exists platform_fee_percent numeric(5,2) default 5.00;
alter table public.schools add column if not exists payment_account_status text check (payment_account_status in ('not_connected', 'pending', 'connected', 'failed')) default 'not_connected';

alter table public.fee_payments add column if not exists paystack_reference text unique;
alter table public.fee_payments add column if not exists paystack_subaccount_code text;
alter table public.fee_payments add column if not exists platform_fee_amount numeric(12,2);
alter table public.fee_payments add column if not exists receipt_number text unique;
alter table public.fee_payments add column if not exists status text check (status in ('pending', 'confirmed', 'failed')) default 'confirmed';
alter table public.fee_payments add column if not exists paid_at timestamptz;

alter table public.fee_payments drop constraint if exists fee_payments_method_check;
alter table public.fee_payments add constraint fee_payments_method_check check (method in ('cash', 'transfer', 'card', 'paystack', 'other'));
alter table public.fee_payments alter column paid_at drop not null;
update public.fee_payments set status = 'confirmed' where status is null;
update public.fee_payments set paid_at = coalesce(paid_at, created_at);

create table if not exists public.school_notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  type text not null check (type in ('fee_payment', 'fee_reminder', 'bulk_import', 'payroll', 'other')),
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.school_notifications enable row level security;
create policy school_notifications_staff_all on public.school_notifications for all using (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (school_id = school_notifications.school_id and role in ('principal', 'teacher'))))
);

-- Workstream 2: Reminders
alter table public.fee_reminders add column if not exists provider text;
alter table public.fee_reminders add column if not exists provider_message_id text;
alter table public.fee_reminders add column if not exists error_message text;
alter table public.fee_reminders add column if not exists sent_at timestamptz;
alter table public.profiles add column if not exists whatsapp_number text;

-- Workstream 3: Bulk Import
create table if not exists public.bulk_import_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  imported_by uuid not null references public.profiles(id),
  role text not null check (role in ('student', 'teacher', 'parent')),
  file_name text,
  total_rows int default 0,
  success_count int default 0,
  error_count int default 0,
  errors jsonb default '[]',
  created_at timestamptz default now()
);
alter table public.bulk_import_jobs enable row level security;
create policy bulk_import_jobs_staff_all on public.bulk_import_jobs for all using (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (school_id = bulk_import_jobs.school_id and role in ('principal', 'teacher'))))
);

-- Workstream 4: Payroll
create table if not exists public.staff_salaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  basic_salary numeric(12,2) not null,
  allowances jsonb default '[]',
  deductions jsonb default '[]',
  effective_from timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_staff_salaries_lookup on public.staff_salaries(school_id, staff_id, effective_from desc);
alter table public.staff_salaries enable row level security;
create policy staff_salaries_staff_all on public.staff_salaries for all using (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (school_id = staff_salaries.school_id and role = 'principal')))
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  month text not null, -- YYYY-MM
  status text not null check (status in ('draft', 'finalized')) default 'draft',
  created_at timestamptz default now(),
  unique(school_id, month)
);
alter table public.payroll_runs enable row level security;
create policy payroll_runs_staff_all on public.payroll_runs for all using (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (school_id = payroll_runs.school_id and role = 'principal')))
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  basic_salary numeric(12,2) not null,
  total_allowances numeric(12,2) not null,
  total_deductions numeric(12,2) not null,
  net_pay numeric(12,2) not null,
  breakdown jsonb not null,
  created_at timestamptz default now()
);
alter table public.payslips enable row level security;
create policy payslips_self_or_principal_read on public.payslips for select using (
  staff_id = auth.uid() or 
  exists (select 1 from public.payroll_runs r join public.profiles p on p.id = auth.uid() where r.id = payslips.payroll_run_id and (p.role = 'admin' or (p.school_id = r.school_id and p.role = 'principal')))
);
create policy payslips_principal_write on public.payslips for all using (
  exists (select 1 from public.payroll_runs r join public.profiles p on p.id = auth.uid() where r.id = payslips.payroll_run_id and (p.role = 'admin' or (p.school_id = r.school_id and p.role = 'principal')))
);

-- Workstream 5: Finance
create table if not exists public.school_expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null,
  description text,
  expense_date date default current_date,
  created_at timestamptz default now()
);
alter table public.school_expenses enable row level security;
create policy school_expenses_staff_all on public.school_expenses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (school_id = school_expenses.school_id and role = 'principal')))
);

create or replace function public.record_payroll_expense()
returns trigger as $$
declare
  total numeric(12,2);
begin
  if new.status = 'finalized' and old.status = 'draft' then
    select coalesce(sum(net_pay), 0) into total from public.payslips where payroll_run_id = new.id;
    insert into public.school_expenses (school_id, category, amount, description, expense_date)
    values (new.school_id, 'Payroll', total, 'Payroll for ' || new.month, current_date);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists payroll_finalized_expense on public.payroll_runs;
create trigger payroll_finalized_expense after update of status on public.payroll_runs
for each row execute function public.record_payroll_expense();

-- Workstream 6: Timetable
create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_level text not null,
  day_of_week int not null check (day_of_week between 1 and 7),
  period_number int not null,
  start_time time not null,
  end_time time not null,
  subject text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  is_published boolean default true,
  created_at timestamptz default now(),
  unique(school_id, class_level, day_of_week, period_number)
);
alter table public.timetable_slots enable row level security;
create policy timetable_slots_read on public.timetable_slots for select using (true);
create policy timetable_slots_staff_write on public.timetable_slots for all using (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (school_id = timetable_slots.school_id and role in ('principal', 'teacher'))))
);
