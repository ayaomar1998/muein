-- Demo data seeder: customers, employees, service requests in varied states,
-- applications, reviews, and notifications. Idempotent — re-runs are no-ops
-- once the first demo user exists.
--
-- All demo accounts use the password: Demo123!Pass
-- Customer emails:  ahmed@demo.sa  fatima@demo.sa  omar@demo.sa  sara@demo.sa  khalid@demo.sa
-- Employee emails:  plumber@demo.sa  electrician@demo.sa  cleaner@demo.sa  handyman@demo.sa  painter@demo.sa

do $$
declare
  -- Customer ids
  cust_ahmed   uuid := '11111111-1111-1111-1111-111111111101';
  cust_fatima  uuid := '11111111-1111-1111-1111-111111111102';
  cust_omar    uuid := '11111111-1111-1111-1111-111111111103';
  cust_sara    uuid := '11111111-1111-1111-1111-111111111104';
  cust_khalid  uuid := '11111111-1111-1111-1111-111111111105';

  -- Employee user ids (auth.users.id)
  emp_plumber_u     uuid := '22222222-2222-2222-2222-222222222201';
  emp_electrician_u uuid := '22222222-2222-2222-2222-222222222202';
  emp_cleaner_u     uuid := '22222222-2222-2222-2222-222222222203';
  emp_handyman_u    uuid := '22222222-2222-2222-2222-222222222204';
  emp_painter_u     uuid := '22222222-2222-2222-2222-222222222205';

  -- Employee row ids (public.employees.id) — looked up after trigger creates them
  emp_plumber_id     uuid;
  emp_electrician_id uuid;
  emp_cleaner_id     uuid;
  emp_handyman_id    uuid;
  emp_painter_id     uuid;

  -- Category ids
  cat_plumbing    uuid;
  cat_electrical  uuid;
  cat_cleaning    uuid;
  cat_ac          uuid;
  cat_painting    uuid;
  cat_carpentry   uuid;
  cat_furniture   uuid;
  cat_appliance   uuid;

  -- Service request ids
  req_1 uuid := '33333333-3333-3333-3333-333333333301';
  req_2 uuid := '33333333-3333-3333-3333-333333333302';
  req_3 uuid := '33333333-3333-3333-3333-333333333303';
  req_4 uuid := '33333333-3333-3333-3333-333333333304';
  req_5 uuid := '33333333-3333-3333-3333-333333333305';
  req_6 uuid := '33333333-3333-3333-3333-333333333306';
  req_7 uuid := '33333333-3333-3333-3333-333333333307';
  req_8 uuid := '33333333-3333-3333-3333-333333333308';
  req_9 uuid := '33333333-3333-3333-3333-333333333309';

  pwd_hash text := crypt('Demo123!Pass', gen_salt('bf'));
begin
  -- Idempotency guard
  if exists (select 1 from auth.users where email = 'ahmed@demo.sa') then
    raise notice 'Demo seed already applied; skipping.';
    return;
  end if;

  -- Lookup categories (seeded by the initial schema migration)
  select id into cat_plumbing   from public.service_categories where name_en = 'Plumbing';
  select id into cat_electrical from public.service_categories where name_en = 'Electrical';
  select id into cat_cleaning   from public.service_categories where name_en = 'Cleaning';
  select id into cat_ac         from public.service_categories where name_en = 'AC Maintenance';
  select id into cat_painting   from public.service_categories where name_en = 'Painting';
  select id into cat_carpentry  from public.service_categories where name_en = 'Carpentry';
  select id into cat_furniture  from public.service_categories where name_en = 'Furniture Assembly';
  select id into cat_appliance  from public.service_categories where name_en = 'Appliance Repair';

  -- =========================================================================
  -- 1. AUTH USERS (handle_new_user trigger creates profiles + user_roles + employees rows)
  -- =========================================================================
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    -- Customers
    ('00000000-0000-0000-0000-000000000000', cust_ahmed,  'authenticated', 'authenticated',
     'ahmed@demo.sa',  pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"أحمد الصالح","phone":"+966500000001","role":"customer"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', cust_fatima, 'authenticated', 'authenticated',
     'fatima@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"فاطمة الزهراني","phone":"+966500000002","role":"customer"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', cust_omar,   'authenticated', 'authenticated',
     'omar@demo.sa',   pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"عمر المطيري","phone":"+966500000003","role":"customer"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', cust_sara,   'authenticated', 'authenticated',
     'sara@demo.sa',   pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"سارة العتيبي","phone":"+966500000004","role":"customer"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', cust_khalid, 'authenticated', 'authenticated',
     'khalid@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"خالد الحربي","phone":"+966500000005","role":"customer"}'::jsonb,
     now(), now(), '', '', '', ''),
    -- Employees
    ('00000000-0000-0000-0000-000000000000', emp_plumber_u, 'authenticated', 'authenticated',
     'plumber@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"محمد النجار","phone":"+966500000011","role":"employee"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', emp_electrician_u, 'authenticated', 'authenticated',
     'electrician@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"يوسف الكهربائي","phone":"+966500000012","role":"employee"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', emp_cleaner_u, 'authenticated', 'authenticated',
     'cleaner@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"عائشة النظيف","phone":"+966500000013","role":"employee"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', emp_handyman_u, 'authenticated', 'authenticated',
     'handyman@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"إبراهيم الصانع","phone":"+966500000014","role":"employee"}'::jsonb,
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', emp_painter_u, 'authenticated', 'authenticated',
     'painter@demo.sa', pwd_hash, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"علي الدهان","phone":"+966500000015","role":"employee"}'::jsonb,
     now(), now(), '', '', '', '');

  -- Also create matching identities rows (required for password login in newer GoTrue)
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id, u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u
  where u.email in (
    'ahmed@demo.sa','fatima@demo.sa','omar@demo.sa','sara@demo.sa','khalid@demo.sa',
    'plumber@demo.sa','electrician@demo.sa','cleaner@demo.sa','handyman@demo.sa','painter@demo.sa'
  )
  on conflict do nothing;

  -- =========================================================================
  -- 2. ENRICH PROFILES (address/city/language)
  -- =========================================================================
  update public.profiles set address = 'حي النخيل، شارع الملك فهد', city = 'الرياض', preferred_language = 'ar' where id = cust_ahmed;
  update public.profiles set address = 'حي الروضة، شارع الأمير سلطان', city = 'جدة',   preferred_language = 'ar' where id = cust_fatima;
  update public.profiles set address = 'حي الملز، شارع الستين',         city = 'الرياض', preferred_language = 'ar' where id = cust_omar;
  update public.profiles set address = 'حي الشاطئ، شارع الكورنيش',     city = 'الدمام',  preferred_language = 'ar' where id = cust_sara;
  update public.profiles set address = 'حي العزيزية، شارع إبراهيم الخليل', city = 'مكة', preferred_language = 'ar' where id = cust_khalid;

  update public.profiles set city = 'الرياض', preferred_language = 'ar' where id = emp_plumber_u;
  update public.profiles set city = 'جدة',   preferred_language = 'ar' where id = emp_electrician_u;
  update public.profiles set city = 'الرياض', preferred_language = 'ar' where id = emp_cleaner_u;
  update public.profiles set city = 'الدمام',  preferred_language = 'ar' where id = emp_handyman_u;
  update public.profiles set city = 'مكة',   preferred_language = 'ar' where id = emp_painter_u;

  -- =========================================================================
  -- 3. ENRICH EMPLOYEES (bio, experience, availability, verified)
  -- =========================================================================
  update public.employees set
    bio = 'سباك محترف بخبرة 12 سنة في صيانة وتركيب أنظمة المياه والصرف.',
    years_experience = 12, city = 'الرياض', lat = 24.7136, lng = 46.6753,
    is_available = true, is_verified = true
  where user_id = emp_plumber_u
  returning id into emp_plumber_id;

  update public.employees set
    bio = 'فني كهرباء معتمد، متخصص في الأعطال المنزلية ولوحات التوزيع.',
    years_experience = 8, city = 'جدة', lat = 21.4858, lng = 39.1925,
    is_available = true, is_verified = true
  where user_id = emp_electrician_u
  returning id into emp_electrician_id;

  update public.employees set
    bio = 'خدمات تنظيف شاملة للمنازل والمكاتب بأدوات حديثة.',
    years_experience = 5, city = 'الرياض', lat = 24.7500, lng = 46.7000,
    is_available = true, is_verified = false
  where user_id = emp_cleaner_u
  returning id into emp_cleaner_id;

  update public.employees set
    bio = 'صيانة عامة: نجارة، تركيب أثاث، وإصلاح الأجهزة المنزلية.',
    years_experience = 10, city = 'الدمام', lat = 26.4207, lng = 50.0888,
    is_available = false, is_verified = true
  where user_id = emp_handyman_u
  returning id into emp_handyman_id;

  update public.employees set
    bio = 'دهان وديكور بخبرة 7 سنوات، جميع أنواع الدهانات الداخلية والخارجية.',
    years_experience = 7, city = 'مكة', lat = 21.3891, lng = 39.8579,
    is_available = true, is_verified = true
  where user_id = emp_painter_u
  returning id into emp_painter_id;

  -- =========================================================================
  -- 4. EMPLOYEE CATEGORIES
  -- =========================================================================
  insert into public.employee_categories (employee_id, category_id) values
    (emp_plumber_id,     cat_plumbing),
    (emp_plumber_id,     cat_ac),
    (emp_electrician_id, cat_electrical),
    (emp_cleaner_id,     cat_cleaning),
    (emp_handyman_id,    cat_carpentry),
    (emp_handyman_id,    cat_furniture),
    (emp_handyman_id,    cat_appliance),
    (emp_painter_id,     cat_painting);

  -- =========================================================================
  -- 5. SERVICE REQUESTS (varied statuses)
  -- =========================================================================
  insert into public.service_requests
    (id, customer_id, category_id, assigned_employee_id, title, description, address, city, lat, lng, status, created_at, updated_at, completed_at)
  values
    (req_1, cust_ahmed,  cat_plumbing,   null,
     'تسريب في حنفية المطبخ',
     'الحنفية تنقط ماء بشكل مستمر منذ يومين، أحتاج إصلاح عاجل.',
     'حي النخيل، شارع الملك فهد', 'الرياض', 24.7140, 46.6760,
     'pending', now() - interval '2 hours', now() - interval '2 hours', null),

    (req_2, cust_fatima, cat_electrical, null,
     'شرارة من المقبس الكهربائي',
     'لاحظت شرارة صغيرة وصوت طقطقة من مقبس غرفة النوم.',
     'حي الروضة، شارع الأمير سلطان', 'جدة', 21.4860, 39.1930,
     'applications_received', now() - interval '6 hours', now() - interval '1 hour', null),

    (req_3, cust_omar,   cat_ac,         null,  -- will be assigned below
     'المكيف لا يبرد',
     'المكيف الشباك يعمل ولكن لا يخرج هواء بارد، يحتاج فحص الفريون.',
     'حي الملز، شارع الستين', 'الرياض', 24.6800, 46.7200,
     'pending', now() - interval '1 day', now() - interval '1 day', null),

    (req_4, cust_sara,   cat_cleaning,   null,  -- assigned below
     'تنظيف شامل للشقة بعد الانتقال',
     'شقة 4 غرف تحتاج تنظيف شامل بعد الانتقال إليها.',
     'حي الشاطئ، شارع الكورنيش', 'الدمام', 26.4210, 50.0890,
     'pending', now() - interval '2 days', now() - interval '2 days', null),

    (req_5, cust_khalid, cat_painting,   null,  -- assigned below
     'دهان غرفة المعيشة',
     'غرفة المعيشة الدهان متقشر ويحتاج دهان كامل لونه أبيض.',
     'حي العزيزية، شارع إبراهيم الخليل', 'مكة', 21.3895, 39.8580,
     'pending', now() - interval '3 days', now() - interval '3 days', null),

    (req_6, cust_ahmed,  cat_appliance,  null,  -- assigned below
     'غسالة الصحون لا تعمل',
     'الغسالة لا تشتغل إطلاقاً، الشاشة تطفأ بعد الضغط على التشغيل.',
     'حي النخيل، شارع الملك فهد', 'الرياض', 24.7140, 46.6760,
     'pending', now() - interval '4 days', now() - interval '4 days', null),

    (req_7, cust_fatima, cat_plumbing,   null,  -- completed below
     'انسداد في حوض الحمام',
     'الماء لا ينصرف من حوض الحمام بشكل طبيعي.',
     'حي الروضة، شارع الأمير سلطان', 'جدة', 21.4860, 39.1930,
     'pending', now() - interval '10 days', now() - interval '10 days', null),

    (req_8, cust_omar,   cat_cleaning,   null,
     'تنظيف خزان مياه (ملغي)',
     'الطلب ألغي لأن مزود آخر تم الاستعانة به.',
     'حي الملز، شارع الستين', 'الرياض', 24.6800, 46.7200,
     'pending', now() - interval '5 days', now() - interval '5 days', null),

    (req_9, cust_sara,   cat_appliance,  null,  -- quotation provided below
     'إصلاح الغسالة الأمامية',
     'الغسالة تصدر صوتاً عالياً أثناء العصر وتهتز بشدة.',
     'حي الشاطئ، شارع الكورنيش', 'الدمام', 26.4210, 50.0890,
     'pending', now() - interval '1 day', now() - interval '1 day', null);

  -- =========================================================================
  -- 6. APPLICATIONS — note: notify_new_application trigger flips a pending
  --    request to 'applications_received' on insert. We override final
  --    statuses after applications are in.
  -- =========================================================================

  -- req_1 (pending plumbing): one pending application from plumber
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_1, emp_plumber_id, 'أقدر أوصل خلال ساعة، الإصلاح بسيط ومضمون.', 60, 150.00, 'pending');

  -- req_2 (electrical) already has applications_received status; add two competing apps
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values
    (req_2, emp_electrician_id, 'متخصص في هذا النوع من الأعطال، أحضر العدة المناسبة.', 45, 200.00, 'pending'),
    (req_2, emp_handyman_id,    'أستطيع الفحص اليوم، السعر يشمل تغيير المقبس.',         90, 180.00, 'pending');

  -- req_3 (AC): accepted application from plumber (also AC). Mark accepted directly.
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_3, emp_plumber_id, 'سأحضر معدات الفحص وأقدر أعطيك تقرير اليوم.', 120, 300.00, 'accepted');

  -- req_4 (cleaning): accepted application from cleaner
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_4, emp_cleaner_id, 'فريق من 3 أشخاص، التنظيف يستغرق 5 ساعات تقريباً.', 180, 600.00, 'accepted');

  -- req_5 (painting): accepted application from painter + rejected from handyman
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values
    (req_5, emp_painter_id,  'أوفر الدهان والعمالة، الجودة مضمونة.', 240, 800.00, 'accepted'),
    (req_5, emp_handyman_id, 'أقدر أنفذ العمل خلال يومين.',           240, 950.00, 'rejected');

  -- req_6 (appliance): accepted application from handyman
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_6, emp_handyman_id, 'الغالب لوحة التحكم، سأحضر قطع الغيار.', 90, 250.00, 'accepted');

  -- req_7 (completed): accepted application from plumber
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_7, emp_plumber_id, 'عمل سريع، أنهيه خلال ساعة.', 60, 120.00, 'accepted');

  -- req_8 (cancelled): pending application that became irrelevant
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_8, emp_cleaner_id, 'متاحة بكرة الصباح.', 60, 400.00, 'cancelled');

  -- req_9 (quotation provided): accepted handyman
  insert into public.request_applications (request_id, employee_id, message, estimated_arrival_minutes, estimated_price, status)
  values (req_9, emp_handyman_id, 'أعمل لك تقرير مفصل بعد الفحص.', 120, 350.00, 'accepted');

  -- =========================================================================
  -- 7. ADVANCE REQUEST STATUSES + ASSIGN EMPLOYEES
  --    (we set directly because INSERT-accepted apps don't fire the accept trigger)
  -- =========================================================================
  update public.service_requests set assigned_employee_id = emp_plumber_id,  status = 'on_the_way'        where id = req_3;
  update public.service_requests set assigned_employee_id = emp_cleaner_id,  status = 'inspection_started' where id = req_4;
  update public.service_requests set assigned_employee_id = emp_painter_id,  status = 'work_in_progress'  where id = req_5;
  update public.service_requests set assigned_employee_id = emp_handyman_id, status = 'work_in_progress'  where id = req_6;
  update public.service_requests set assigned_employee_id = emp_plumber_id,  status = 'completed'         where id = req_7;
  update public.service_requests set status = 'cancelled' where id = req_8;
  update public.service_requests set assigned_employee_id = emp_handyman_id, status = 'quotation_provided' where id = req_9;

  -- =========================================================================
  -- 8. REQUEST NOTES (visible to customer + assigned employee)
  -- =========================================================================
  insert into public.request_notes (request_id, author_id, body) values
    (req_3, emp_plumber_u,  'في الطريق، الوصول خلال 30 دقيقة.'),
    (req_4, emp_cleaner_u,  'بدأنا الفحص الأولي للشقة.'),
    (req_5, cust_khalid,    'يفضل العمل في الفترة المسائية.'),
    (req_5, emp_painter_u,  'بدأت بطبقة المعجون، الدهان غداً.'),
    (req_6, emp_handyman_u, 'تم تشخيص العطل، أحتاج قطعة غيار وصلت اليوم.'),
    (req_9, emp_handyman_u, 'العرض النهائي بعد الفحص: 350 ريال يشمل قطع الغيار.');

  -- =========================================================================
  -- 9. REVIEW on the completed request
  -- =========================================================================
  insert into public.reviews (request_id, customer_id, employee_id, rating, comment) values
    (req_7, cust_fatima, emp_plumber_id, 5, 'سريع ودقيق، أنصح فيه بشدة.');

  -- =========================================================================
  -- 10. EXTRA NOTIFICATIONS (beyond what triggers already created)
  -- =========================================================================
  insert into public.notifications (user_id, title, body, link) values
    (cust_ahmed,  'مرحباً بك في يمنك',     'استكشف الخدمات وابدأ بطلبك الأول.', '/customer/dashboard'),
    (cust_fatima, 'تم اكتمال طلبك',       'يمكنك الآن تقييم مزود الخدمة.',     '/customer/requests/' || req_7),
    (emp_plumber_u,  'تقييم جديد ⭐⭐⭐⭐⭐', 'حصلت على تقييم 5 نجوم من فاطمة.',    '/employee/dashboard'),
    (emp_painter_u,  'لا تنسَ التحديث',    'يرجى تحديث حالة العمل قيد التنفيذ.', '/employee/requests/' || req_5);

  raise notice 'Demo seed applied: 5 customers, 5 employees, 9 requests.';
end $$;
