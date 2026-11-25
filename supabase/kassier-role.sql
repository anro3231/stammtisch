-- FantastiX: Kassier-Rolle
-- Einmalig im Supabase SQL Editor des FantastiX-Projekts ausführen.
-- Die Kassiererrechte werden ausschließlich über serverseitige RPCs vergeben.

ALTER TABLE public.fantastix_reader_profiles
  ADD COLUMN IF NOT EXISTS is_cashier boolean NOT NULL DEFAULT false;

-- Admin-Benutzerliste um das Kassierer-Flag erweitern.
DROP FUNCTION IF EXISTS public.fantastix_admin_list_users();
CREATE FUNCTION public.fantastix_admin_list_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  username text,
  member_id text,
  is_admin boolean,
  is_cashier boolean,
  registered_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT private.is_fantastix_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.email, p.username, p.member_id,
         (a.user_id IS NOT NULL), p.is_cashier, p.registered_at
  FROM public.fantastix_reader_profiles p
  LEFT JOIN public.fantastix_admin_users a ON a.user_id = p.user_id
  ORDER BY p.registered_at, coalesce(p.username, p.email);
END
$function$;

REVOKE ALL ON FUNCTION public.fantastix_admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fantastix_admin_list_users() TO authenticated;

-- Bestehende Zuordnungs-RPC: Rollen werden zusammen mit den Mitgliedszuordnungen
-- atomar gespeichert. Admin-Konten erhalten keine zusätzliche Kassiererrolle.
CREATE OR REPLACE FUNCTION public.fantastix_admin_set_links(p_links jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item jsonb;
  v_id uuid;
  v_member text;
  v_doc jsonb;
  v_total integer;
  v_cashier boolean;
BEGIN
  IF NOT private.is_fantastix_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren.' USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.jsonb_typeof(p_links) <> 'array'
     OR pg_catalog.jsonb_array_length(p_links) > 2500 THEN
    RAISE EXCEPTION 'Ungültige Benutzerliste.';
  END IF;

  PERFORM 1 FROM public.fantastix_reader_profiles FOR UPDATE;
  SELECT count(*) INTO v_total FROM public.fantastix_reader_profiles;

  IF pg_catalog.jsonb_array_length(p_links) <> v_total THEN
    RAISE EXCEPTION 'Die Benutzerliste hat sich geändert. Bitte neu laden.';
  END IF;

  IF (SELECT count(DISTINCT x->>'user_id')
      FROM pg_catalog.jsonb_array_elements(p_links) x) <> v_total THEN
    RAISE EXCEPTION 'Benutzer mehrfach oder ungültig.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_links) e
    WHERE nullif(e->>'member_id', '') IS NOT NULL
    GROUP BY e->>'member_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ein Mitglied kann nur einem Konto zugeordnet werden.';
  END IF;

  SELECT content INTO v_doc
  FROM public.fantastix_private
  WHERE id = 'main';

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_links) LOOP
    v_id := (v_item->>'user_id')::uuid;
    v_member := nullif(v_item->>'member_id', '');
    v_cashier := coalesce((v_item->>'is_cashier')::boolean, false);

    IF NOT EXISTS (
      SELECT 1 FROM public.fantastix_reader_profiles WHERE user_id = v_id
    ) THEN
      RAISE EXCEPTION 'Unbekanntes Konto.';
    END IF;

    IF v_member IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'members', '[]'::jsonb)) m
      WHERE m->>'id' = v_member
    ) THEN
      RAISE EXCEPTION 'Unbekanntes Mitglied: %', v_member;
    END IF;

    IF v_cashier AND v_member IS NULL THEN
      RAISE EXCEPTION 'Ein Kassier muss einem Mitglied zugeordnet sein.';
    END IF;

    IF v_cashier AND EXISTS (
      SELECT 1 FROM public.fantastix_admin_users WHERE user_id = v_id
    ) THEN
      RAISE EXCEPTION 'Administratoren benötigen keine zusätzliche Kassiererrolle.';
    END IF;
  END LOOP;

  UPDATE public.fantastix_reader_profiles
  SET member_id = NULL, is_cashier = false
  WHERE member_id IS NOT NULL OR is_cashier = true;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_links) LOOP
    UPDATE public.fantastix_reader_profiles
    SET member_id = nullif(v_item->>'member_id', ''),
        is_cashier = coalesce((v_item->>'is_cashier')::boolean, false)
      AND NOT EXISTS (
        SELECT 1 FROM public.fantastix_admin_users a
        WHERE a.user_id = public.fantastix_reader_profiles.user_id
      )
    WHERE user_id = (v_item->>'user_id')::uuid;
  END LOOP;
END
$function$;

REVOKE ALL ON FUNCTION public.fantastix_admin_set_links(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fantastix_admin_set_links(jsonb) TO authenticated;

-- Rollenprüfung und Kassenfunktionen liegen im nicht exponierten Schema private.
CREATE OR REPLACE FUNCTION private.is_fantastix_cashier()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       private.is_fantastix_admin()
       OR EXISTS (
         SELECT 1
         FROM public.fantastix_reader_profiles p
         WHERE p.user_id = (SELECT auth.uid())
           AND p.member_id IS NOT NULL
           AND p.is_cashier = true
       )
     );
$function$;

CREATE OR REPLACE FUNCTION private.fantastix_cash_balance(p_doc jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT
    coalesce((p_doc->'cashbook'->>'openingBalanceCents')::bigint, 0)
    + coalesce((
        SELECT sum((pay.value->>'amountCents')::bigint)
        FROM pg_catalog.jsonb_array_elements(coalesce(p_doc->'payments', '[]'::jsonb)) pay(value)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements_text(
            coalesce(p_doc->'cashbook'->'excludedPaymentIds', '[]'::jsonb)
          ) excluded(value)
          WHERE excluded.value = pay.value->>'id'
        )
      ), 0)
    + coalesce((
        SELECT sum((tx.value->>'amountCents')::bigint)
        FROM pg_catalog.jsonb_array_elements(
          coalesce(p_doc->'cashbook'->'transactions', '[]'::jsonb)
        ) tx(value)
      ), 0);
$function$;

CREATE OR REPLACE FUNCTION private.fantastix_cashier_read_impl()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_doc jsonb;
  v_cash jsonb;
  v_members jsonb;
  v_payment_transactions jsonb;
  v_balance bigint;
BEGIN
  IF NOT private.is_fantastix_cashier() THEN
    RAISE EXCEPTION 'Keine Kassiererberechtigung.' USING ERRCODE = '42501';
  END IF;

  SELECT content INTO v_doc
  FROM public.fantastix_private
  WHERE id = 'main';

  IF v_doc IS NULL THEN
    RAISE EXCEPTION 'Kassendaten nicht verfügbar.';
  END IF;

  v_cash := coalesce(v_doc->'cashbook', '{}'::jsonb);
  v_balance := private.fantastix_cash_balance(v_doc);

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'id', m.value->>'id',
      'name', m.value->>'name',
      'memberNumber', m.value->'memberNumber',
      'active', coalesce(m.value->'active', 'true'::jsonb)
    )),
    '[]'::jsonb
  )
  INTO v_members
  FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'members', '[]'::jsonb)) m(value);

  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'id', pay.value->>'id',
      'date', coalesce(pay.value->>'date', ''),
      'type', 'payment',
      'amountCents', coalesce((pay.value->>'amountCents')::bigint, 0),
      'note', coalesce(person.name, 'Strafzahlung') || ' · Strafe'
    )),
    '[]'::jsonb
  )
  INTO v_payment_transactions
  FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'payments', '[]'::jsonb)) pay(value)
  LEFT JOIN LATERAL (
    SELECT m.value->>'name' AS name
    FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'members', '[]'::jsonb)) m(value)
    JOIN pg_catalog.jsonb_array_elements(coalesce(v_doc->'fines', '[]'::jsonb)) f(value)
      ON f.value->>'memberId' = m.value->>'id'
    WHERE f.value->>'id' = pay.value->>'fineId'
    LIMIT 1
  ) person ON true
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements_text(
      coalesce(v_cash->'excludedPaymentIds', '[]'::jsonb)
    ) excluded(value)
    WHERE excluded.value = pay.value->>'id'
  );

  RETURN jsonb_build_object(
    'members', v_members,
    'fines', coalesce(v_doc->'fines', '[]'::jsonb),
    'payments', coalesce(v_doc->'payments', '[]'::jsonb),
    'cashbook', jsonb_build_object(
      'balanceCents', v_balance,
      'monthlyAmountCents', v_cash->'monthlyAmountCents',
      'monthlyDay', v_cash->'monthlyDay',
      'monthlyStartMonth', v_cash->'monthlyStartMonth',
      'transactions', coalesce(v_cash->'transactions', '[]'::jsonb) || v_payment_transactions
    )
  );
END
$function$;

CREATE OR REPLACE FUNCTION private.fantastix_cashier_update_impl(
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_doc jsonb;
  v_public jsonb;
  v_cash jsonb;
  v_fines jsonb;
  v_payments jsonb;
  v_transactions jsonb;
  v_id text;
  v_member text;
  v_fine_id text;
  v_reason text;
  v_note text;
  v_method text;
  v_amount bigint;
  v_target bigint;
  v_delta bigint;
  v_fine_total bigint;
  v_paid bigint;
  v_balance bigint;
  v_revision bigint;
  v_today text := (now() AT TIME ZONE 'Europe/Vienna')::date::text;
BEGIN
  IF NOT private.is_fantastix_cashier() THEN
    RAISE EXCEPTION 'Keine Kassiererberechtigung.' USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Ungültige Kassendaten.';
  END IF;

  SELECT content, revision
  INTO v_doc, v_revision
  FROM public.fantastix_private
  WHERE id = 'main'
  FOR UPDATE;

  IF v_doc IS NULL THEN
    RAISE EXCEPTION 'Kassendaten nicht verfügbar.';
  END IF;

  v_cash := coalesce(v_doc->'cashbook', '{}'::jsonb);

  IF p_action = 'fine_create' THEN
    v_member := nullif(p_payload->>'memberId', '');
    v_amount := (p_payload->>'amountCents')::bigint;
    v_reason := pg_catalog.btrim(coalesce(p_payload->>'reason', ''));

    IF v_member IS NULL OR v_amount <= 0 OR v_amount > 100000000000
       OR v_reason = '' OR pg_catalog.char_length(v_reason) > 300 THEN
      RAISE EXCEPTION 'Bitte Mitglied, Grund und gültigen Betrag angeben.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'members', '[]'::jsonb)) m(value)
      WHERE m.value->>'id' = v_member
    ) THEN
      RAISE EXCEPTION 'Unbekanntes Mitglied.';
    END IF;

    v_id := gen_random_uuid()::text;
    v_fines := coalesce(v_doc->'fines', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'id', v_id,
        'memberId', v_member,
        'date', v_today,
        'reason', v_reason,
        'amountCents', v_amount,
        'meetingId', null,
        'source', 'manual'
      ));
    v_doc := jsonb_set(v_doc, '{fines}', v_fines, true);

  ELSIF p_action = 'fine_payment' THEN
    v_fine_id := nullif(p_payload->>'fineId', '');
    v_amount := (p_payload->>'amountCents')::bigint;
    v_method := coalesce(nullif(p_payload->>'method', ''), 'Bar');
    v_note := pg_catalog.btrim(coalesce(p_payload->>'note', ''));

    IF v_fine_id IS NULL OR v_amount <= 0 OR v_amount > 100000000000
       OR v_method NOT IN ('Bar', 'Überweisung', 'Sonstiges')
       OR pg_catalog.char_length(v_note) > 200 THEN
      RAISE EXCEPTION 'Ungültige Zahlungsdaten.';
    END IF;

    SELECT (f.value->>'amountCents')::bigint
    INTO v_fine_total
    FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'fines', '[]'::jsonb)) f(value)
    WHERE f.value->>'id' = v_fine_id;

    IF v_fine_total IS NULL THEN
      RAISE EXCEPTION 'Strafe nicht gefunden.';
    END IF;

    SELECT coalesce(sum((p.value->>'amountCents')::bigint), 0)
    INTO v_paid
    FROM pg_catalog.jsonb_array_elements(coalesce(v_doc->'payments', '[]'::jsonb)) p(value)
    WHERE p.value->>'fineId' = v_fine_id;

    IF v_amount > greatest(0, v_fine_total - v_paid) THEN
      RAISE EXCEPTION 'Zahlung übersteigt den noch offenen Betrag.';
    END IF;

    v_id := gen_random_uuid()::text;
    v_payments := coalesce(v_doc->'payments', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'id', v_id,
        'fineId', v_fine_id,
        'date', v_today,
        'amountCents', v_amount,
        'method', v_method,
        'note', v_note
      ));
    v_doc := jsonb_set(v_doc, '{payments}', v_payments, true);

  ELSIF p_action = 'cash_expense' THEN
    v_amount := (p_payload->>'amountCents')::bigint;
    v_note := pg_catalog.btrim(coalesce(p_payload->>'note', ''));

    IF v_amount <= 0 OR v_amount > 100000000000
       OR v_note = '' OR pg_catalog.char_length(v_note) > 180 THEN
      RAISE EXCEPTION 'Bitte positiven Betrag und Verwendungszweck angeben.';
    END IF;

    v_transactions := coalesce(v_cash->'transactions', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'expense',
        'date', v_today,
        'amountCents', -v_amount,
        'note', v_note
      ));
    v_cash := jsonb_set(v_cash, '{transactions}', v_transactions, true);
    v_doc := jsonb_set(v_doc, '{cashbook}', v_cash, true);

  ELSIF p_action = 'cash_balance' THEN
    v_target := (p_payload->>'balanceCents')::bigint;
    v_note := pg_catalog.btrim(coalesce(p_payload->>'note', ''));

    IF v_target < -100000000000 OR v_target > 100000000000
       OR pg_catalog.char_length(v_note) > 180 THEN
      RAISE EXCEPTION 'Ungültiger Kontostand.';
    END IF;

    v_balance := private.fantastix_cash_balance(v_doc);
    v_delta := v_target - v_balance;

    IF v_delta <> 0 THEN
      v_transactions := coalesce(v_cash->'transactions', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text,
          'type', 'adjustment',
          'date', v_today,
          'amountCents', v_delta,
          'note', coalesce(nullif(v_note, ''), 'Manuelle Kontostandkorrektur')
        ));
      v_cash := jsonb_set(v_cash, '{transactions}', v_transactions, true);
      v_doc := jsonb_set(v_doc, '{cashbook}', v_cash, true);
    END IF;

  ELSE
    RAISE EXCEPTION 'Unbekannte Kassenaktion.';
  END IF;

  UPDATE public.fantastix_private
  SET content = v_doc,
      revision = revision + 1,
      updated_at = now()
  WHERE id = 'main'
  RETURNING revision INTO v_revision;

  -- Freigegebene Leseransicht nach einer Kassenänderung aktuell halten.
  SELECT content INTO v_public
  FROM public.fantastix_public
  WHERE id = 'main' AND is_published = true
  FOR UPDATE;

  IF v_public IS NOT NULL THEN
    IF coalesce(v_public->'sections'->>'fines', 'false') = 'true' THEN
      v_public := jsonb_set(v_public, '{fines}', coalesce(v_doc->'fines', '[]'::jsonb), true);
      v_public := jsonb_set(v_public, '{payments}', coalesce(v_doc->'payments', '[]'::jsonb), true);
    END IF;

    IF coalesce(v_public->'sections'->>'cash', 'false') = 'true' THEN
      v_cash := private.fantastix_cashier_read_impl()->'cashbook';
      IF coalesce(v_public->'sections'->>'fines', 'false') <> 'true' THEN
        SELECT coalesce(jsonb_agg(tx.value), '[]'::jsonb)
        INTO v_transactions
        FROM pg_catalog.jsonb_array_elements(coalesce(v_cash->'transactions', '[]'::jsonb)) tx(value)
        WHERE tx.value->>'type' <> 'payment';
        v_cash := jsonb_set(v_cash, '{transactions}', v_transactions, true);
      END IF;
      v_public := jsonb_set(v_public, '{cashbook}', v_cash, true);
    END IF;

    UPDATE public.fantastix_public
    SET content = v_public, published_at = now()
    WHERE id = 'main';
  END IF;

  RETURN jsonb_build_object('ok', true, 'revision', v_revision);
END
$function$;

-- Öffentliche RPC-Einstiegspunkte sind INVOKER-Funktionen. Die geprüften,
-- nicht exponierten Implementierungen liegen im Schema private.
CREATE OR REPLACE FUNCTION public.fantastix_cashier_read()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.fantastix_cashier_read_impl();
$function$;

CREATE OR REPLACE FUNCTION public.fantastix_cashier_update(
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.fantastix_cashier_update_impl(p_action, p_payload);
$function$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_fantastix_cashier() TO authenticated;
GRANT EXECUTE ON FUNCTION private.fantastix_cash_balance(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.fantastix_cashier_read_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION private.fantastix_cashier_update_impl(text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.fantastix_cashier_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fantastix_cashier_update(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fantastix_cashier_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fantastix_cashier_update(text, jsonb) TO authenticated;
