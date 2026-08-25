-- =========================================================
-- AL-KHWARIZMI SECURE EXAM POLICIES
-- Run this in Supabase SQL Editor.
--
-- IMPORTANT:
-- 1) Take a database backup first.
-- 2) This script assumes:
--    exams.id/questions.id/exam_attempts.id/results.id are UUID.
-- 3) Students must be authenticated.
-- 4) correct_answer stays in questions but is NEVER exposed to
--    students. Students receive questions through RPC only.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0) Helper: admin check
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and lower(coalesce(ur.role, '')) = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------
-- 1) RLS
-- ---------------------------------------------------------
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.results enable row level security;
alter table public.user_roles enable row level security;


-- ---------------------------------------------------------
-- 2) EXAMS
-- Students can read only active exams.
-- Admin can manage exams.
-- ---------------------------------------------------------
drop policy if exists "students_read_active_exams" on public.exams;
create policy "students_read_active_exams"
on public.exams
for select
to authenticated
using (
    is_active = true
);

drop policy if exists "admins_manage_exams" on public.exams;
create policy "admins_manage_exams"
on public.exams
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ---------------------------------------------------------
-- 3) QUESTIONS
--
-- CRITICAL:
-- No direct SELECT policy for authenticated users.
-- Therefore a student cannot do:
--   from('questions').select('*')
--
-- The secure RPC below reads the table server-side.
-- Admin can manage questions.
-- ---------------------------------------------------------
drop policy if exists "admins_manage_questions" on public.questions;
create policy "admins_manage_questions"
on public.questions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ---------------------------------------------------------
-- 4) EXAM ATTEMPTS
--
-- Students can read only their own attempts.
-- Students CANNOT insert/update/delete directly.
-- The secure submit RPC creates the row.
-- ---------------------------------------------------------
drop policy if exists "students_read_own_attempts" on public.exam_attempts;
create policy "students_read_own_attempts"
on public.exam_attempts
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "admins_manage_attempts" on public.exam_attempts;
create policy "admins_manage_attempts"
on public.exam_attempts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ---------------------------------------------------------
-- 5) RESULTS
--
-- Students can read only their own results.
-- They CANNOT insert/update/delete results directly.
-- ---------------------------------------------------------
drop policy if exists "students_read_own_results" on public.results;
create policy "students_read_own_results"
on public.results
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "admins_manage_results" on public.results;
create policy "admins_manage_results"
on public.results
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ---------------------------------------------------------
-- 6) USER ROLES
--
-- A student must not be able to change/read arbitrary roles.
-- Admin check is performed by security-definer function.
-- Admin pages can query their own role only.
-- ---------------------------------------------------------
drop policy if exists "users_read_own_role" on public.user_roles;
create policy "users_read_own_role"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins_manage_roles" on public.user_roles;
create policy "admins_manage_roles"
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ---------------------------------------------------------
-- 7) Secure question loader
--
-- Returns NO correct_answer.
-- ---------------------------------------------------------
drop function if exists public.get_exam_questions_secure(uuid);

create or replace function public.get_exam_questions_secure(
    p_exam_id uuid
)
returns table (
    id uuid,
    question_text text,
    option_a text,
    option_b text,
    option_c text,
    option_d text,
    points numeric,
    question_order integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin

    if auth.uid() is null then
        raise exception 'يجب تسجيل الدخول';
    end if;

    if not exists (
        select 1
        from public.exams e
        where e.id = p_exam_id
          and e.is_active = true
    ) then
        raise exception 'الاختبار غير متاح';
    end if;

    return query
    select
        q.id,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.points,
        q.question_order
    from public.questions q
    where q.exam_id = p_exam_id
    order by q.question_order asc, q.id asc;

end;
$$;

revoke all on function public.get_exam_questions_secure(uuid) from public;
grant execute on function public.get_exam_questions_secure(uuid) to authenticated;


-- ---------------------------------------------------------
-- 8) Secure submit / grading
--
-- Browser sends:
--   exam_id
--   [{question_id, answer}]
--
-- Browser DOES NOT send:
--   score
--   percentage
--   passed
--   total_points
--   student_id
--
-- All of those are calculated here.
-- ---------------------------------------------------------
drop function if exists public.submit_exam_secure(uuid, jsonb, boolean);

create or replace function public.submit_exam_secure(
    p_exam_id uuid,
    p_answers jsonb,
    p_auto_submitted boolean default false
)
returns table (
    result_id uuid,
    attempt_id uuid,
    score numeric,
    total_points numeric,
    percentage numeric,
    passed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_exam public.exams%rowtype;
    v_attempt_id uuid;
    v_result_id uuid;
    v_score numeric := 0;
    v_total numeric := 0;
    v_percentage numeric := 0;
    v_passed boolean := false;
    v_answer jsonb;
    v_question public.questions%rowtype;
    v_student_answer text;
    v_existing_attempt uuid;
begin

    if v_user is null then
        raise exception 'يجب تسجيل الدخول';
    end if;

    if jsonb_typeof(p_answers) <> 'array' then
        raise exception 'بيانات الإجابات غير صحيحة';
    end if;

    select *
    into v_exam
    from public.exams
    where id = p_exam_id
      and is_active = true
    for share;

    if not found then
        raise exception 'الاختبار غير موجود أو غير متاح';
    end if;

    /*
     * One completed attempt per student/exam.
     * If you want retakes, remove this block AND the unique
     * constraint mentioned below.
     */
    select ea.id
    into v_existing_attempt
    from public.exam_attempts ea
    where ea.exam_id = p_exam_id
      and ea.student_id = v_user
      and lower(coalesce(ea.status, '')) = 'completed'
    limit 1;

    if v_existing_attempt is not null then
        raise exception 'لقد أنهيت هذا الاختبار من قبل';
    end if;

    /*
     * Calculate total points from the database, not the browser.
     */
    select coalesce(sum(coalesce(q.points, 1)), 0)
    into v_total
    from public.questions q
    where q.exam_id = p_exam_id;

    if v_total <= 0 then
        raise exception 'الاختبار لا يحتوي على درجات صالحة';
    end if;

    /*
     * Grade every submitted answer against the database answer key.
     * The correct_answer value never leaves this function.
     */
    for v_answer in
        select value from jsonb_array_elements(p_answers)
    loop

        begin
            select *
            into v_question
            from public.questions q
            where q.id = (v_answer->>'question_id')::uuid
              and q.exam_id = p_exam_id;

        exception when invalid_text_representation then
            continue;
        end;

        if not found then
            continue;
        end if;

        v_student_answer :=
            lower(trim(coalesce(v_answer->>'answer', '')));

        if v_student_answer <> ''
           and v_student_answer =
               lower(trim(coalesce(v_question.correct_answer, '')))
        then
            v_score := v_score + coalesce(v_question.points, 1);
        end if;

    end loop;

    v_percentage :=
        round((v_score / v_total) * 100, 2);

    v_passed :=
        v_percentage >= 50;

    /*
     * Create attempt server-side.
     */
    insert into public.exam_attempts (
        exam_id,
        student_id,
        started_at,
        submitted_at,
        score,
        total_points,
        status
    )
    values (
        p_exam_id,
        v_user,
        now(),
        now(),
        v_score,
        v_total,
        'completed'
    )
    returning id into v_attempt_id;

    /*
     * Create result server-side.
     */
    insert into public.results (
        exam_id,
        student_id,
        attempt_id,
        score,
        total_points,
        percentage,
        passed
    )
    values (
        p_exam_id,
        v_user,
        v_attempt_id,
        v_score,
        v_total,
        v_percentage,
        v_passed
    )
    returning id into v_result_id;

    return query
    select
        v_result_id,
        v_attempt_id,
        v_score,
        v_total,
        v_percentage,
        v_passed;

exception
    when unique_violation then
        raise exception 'تم تسجيل محاولة لهذا الاختبار بالفعل';
end;
$$;

revoke all on function public.submit_exam_secure(uuid, jsonb, boolean) from public;
grant execute on function public.submit_exam_secure(uuid, jsonb, boolean) to authenticated;


-- ---------------------------------------------------------
-- 9) Prevent direct client-side result/attempt creation
-- ---------------------------------------------------------
revoke insert, update, delete on public.results from authenticated;
revoke insert, update, delete on public.exam_attempts from authenticated;

-- Students still need SELECT through RLS.
grant select on public.results to authenticated;
grant select on public.exam_attempts to authenticated;


-- ---------------------------------------------------------
-- 10) Prevent direct question reading by authenticated users.
-- RLS has no SELECT policy for students, but this explicit
-- revoke makes the intention clear.
-- ---------------------------------------------------------
revoke select on public.questions from authenticated;


-- ---------------------------------------------------------
-- 11) Optional anti-duplicate protection
--
-- Only add this if you want ONE attempt per exam/student.
-- The function already blocks completed attempts.
-- This constraint also protects against race conditions.
-- ---------------------------------------------------------
create unique index if not exists
    exam_attempts_one_completed_per_student_exam
on public.exam_attempts (exam_id, student_id)
where lower(coalesce(status, '')) = 'completed';


commit;

-- =========================================================
-- AFTER RUNNING:
--
-- Test as a student:
-- 1) get_exam_questions_secure(...) works.
-- 2) direct SELECT from questions must fail.
-- 3) direct INSERT into results must fail.
-- 4) direct INSERT into exam_attempts must fail.
-- 5) submit_exam_secure(...) returns the calculated score.
--
-- IMPORTANT:
-- If your existing schema uses different data types or column
-- names, adjust those specific declarations before running.
-- =========================================================
