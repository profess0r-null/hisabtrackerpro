-- HisabTracker: server-enforced PIN gate, owned records, and owner-only usage.
-- Run with the Supabase SQL Editor as the database owner BEFORE deploying this frontend.
-- This replaces policies on this app's two financial tables. Back up first.
-- It does not delete financial rows or change existing account amounts.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS ht_private;
REVOKE ALL ON SCHEMA ht_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS ht_private.pin_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 pin_hash text,
 legacy_hash text,
 failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
 blocked_until timestamptz,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ht_private.pin_sessions (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL,
 unlocked_until timestamptz NOT NULL,
 PRIMARY KEY(user_id, session_id)
);
CREATE TABLE IF NOT EXISTS ht_private.owners (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ht_private.usage (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_seen timestamptz NOT NULL DEFAULT now(),
 last_seen timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA ht_private FROM PUBLIC, anon, authenticated;
ALTER TABLE ht_private.pin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ht_private.pin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ht_private.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE ht_private.usage ENABLE ROW LEVEL SECURITY;

-- Pin this permission to the verified account UUID, never a mutable client flag/email claim.
DO $$
DECLARE owner_id uuid;
BEGIN
 SELECT id INTO owner_id FROM auth.users
 WHERE lower(email) = 'sakibulhasantalukder2006@gmail.com' AND email_confirmed_at IS NOT NULL;
 IF owner_id IS NULL THEN
  RAISE EXCEPTION 'The specified owner account must exist and have a verified email before installing this migration.';
 END IF;
 INSERT INTO ht_private.owners(user_id) VALUES(owner_id) ON CONFLICT DO NOTHING;
END $$;

-- Bootstrap legacy PINs without exposing them through an RPC. No shared/default PIN.
-- Existing format-3 JSON is retained until a normal save removes obsolete PIN metadata.
DO $$ BEGIN
 IF to_regclass('public.hisab_users') IS NULL THEN
  RAISE EXCEPTION 'Existing public.hisab_users table is required.';
 END IF;
END $$;
INSERT INTO ht_private.pin_accounts(user_id, legacy_hash)
SELECT h.id, COALESCE(
 CASE WHEN jsonb_typeof(h.data::jsonb -> 'pinHash') = 'string' THEN h.data::jsonb ->> 'pinHash' END,
 (SELECT p.value ->> 'pinHash' FROM jsonb_each(CASE WHEN jsonb_typeof(h.data::jsonb -> 'profilesData')='object' THEN h.data::jsonb -> 'profilesData' ELSE '{}'::jsonb END) p
  WHERE jsonb_typeof(p.value -> 'pinHash') = 'string' LIMIT 1)
)
FROM public.hisab_users h JOIN auth.users u ON u.id=h.id
ON CONFLICT(user_id) DO NOTHING;

-- Exact migration compatibility for the former browser DJB2-style 32-bit hash.
CREATE OR REPLACE FUNCTION ht_private.legacy_pin_hash(p_pin text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE n bigint := 5381; i integer; answer text := ''; alphabet text := '0123456789abcdefghijklmnopqrstuvwxyz';
BEGIN
 FOR i IN 1..length(p_pin) LOOP n := ((n * 33) # ascii(substr(p_pin,i,1))) & 4294967295; END LOOP;
 IF n=0 THEN RETURN '0'; END IF;
 WHILE n>0 LOOP answer := substr(alphabet,(n % 36)::integer+1,1) || answer; n := n / 36; END LOOP;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION ht_private.legacy_pin_hash(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ht_gate_unlocked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM ht_private.pin_sessions s
  WHERE s.user_id=auth.uid() AND s.session_id::text=auth.jwt()->>'session_id'
   AND s.unlocked_until > now()
   AND EXISTS(SELECT 1 FROM auth.sessions a WHERE a.id=s.session_id AND a.user_id=s.user_id)
 );
$$;
CREATE OR REPLACE FUNCTION public.ht_gate_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p ht_private.pin_accounts; until_at timestamptz;
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'session_id' IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM ht_private.pin_accounts WHERE user_id=auth.uid();
 SELECT unlocked_until INTO until_at FROM ht_private.pin_sessions
 WHERE user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id' AND unlocked_until>now() AND public.ht_gate_unlocked();
 RETURN jsonb_build_object('has_pin',p.pin_hash IS NOT NULL OR p.legacy_hash IS NOT NULL,
  'unlocked',until_at IS NOT NULL,'unlocked_until',until_at,'blocked_until',p.blocked_until,
  'is_owner',EXISTS(SELECT 1 FROM ht_private.owners WHERE user_id=auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.ht_pin_unlock(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p ht_private.pin_accounts; accepted boolean; session_uuid uuid; until_at timestamptz;
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'session_id' IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 session_uuid := (auth.jwt()->>'session_id')::uuid;
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN RETURN jsonb_build_object('ok',false,'reason','invalid_pin'); END IF;
 SELECT * INTO p FROM ht_private.pin_accounts WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR (p.pin_hash IS NULL AND p.legacy_hash IS NULL) THEN RETURN jsonb_build_object('ok',false,'reason','setup_required'); END IF;
 IF p.blocked_until > now() THEN RETURN jsonb_build_object('ok',false,'reason','rate_limited','blocked_until',p.blocked_until); END IF;
 accepted := CASE WHEN p.pin_hash IS NOT NULL THEN extensions.crypt(p_pin,p.pin_hash)=p.pin_hash
  ELSE ht_private.legacy_pin_hash(p_pin)=p.legacy_hash END;
 IF NOT accepted THEN
  UPDATE ht_private.pin_accounts SET failures=CASE WHEN failures>=4 THEN 0 ELSE failures+1 END,
   blocked_until=CASE WHEN failures>=4 THEN now()+interval '15 minutes' ELSE NULL END
  WHERE user_id=auth.uid() RETURNING * INTO p;
  -- Return rather than raise, so failed-attempt counters commit.
  RETURN jsonb_build_object('ok',false,'reason',CASE WHEN p.blocked_until>now() THEN 'rate_limited' ELSE 'wrong_pin' END,'blocked_until',p.blocked_until);
 END IF;
 UPDATE ht_private.pin_accounts SET pin_hash=COALESCE(pin_hash,extensions.crypt(p_pin,extensions.gen_salt('bf',12))),
  legacy_hash=NULL,failures=0,blocked_until=NULL WHERE user_id=auth.uid();
 until_at := now()+interval '30 minutes';
 INSERT INTO ht_private.pin_sessions(user_id,session_id,unlocked_until) VALUES(auth.uid(),session_uuid,until_at)
 ON CONFLICT(user_id,session_id) DO UPDATE SET unlocked_until=EXCLUDED.unlocked_until;
 RETURN jsonb_build_object('ok',true,'unlocked_until',until_at);
END $$;

CREATE OR REPLACE FUNCTION public.ht_pin_set(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p ht_private.pin_accounts; until_at timestamptz; session_uuid uuid;
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'session_id' IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Choose a four-digit PIN' USING ERRCODE='22023'; END IF;
 session_uuid := (auth.jwt()->>'session_id')::uuid;
 INSERT INTO ht_private.pin_accounts(user_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 SELECT * INTO p FROM ht_private.pin_accounts WHERE user_id=auth.uid() FOR UPDATE;
 IF (p.pin_hash IS NOT NULL OR p.legacy_hash IS NOT NULL) AND NOT public.ht_gate_unlocked() THEN
  RAISE EXCEPTION 'Unlock with your current PIN first' USING ERRCODE='42501';
 END IF;
 UPDATE ht_private.pin_accounts SET pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),
 legacy_hash=NULL,failures=0,blocked_until=NULL,changed_at=now() WHERE user_id=auth.uid();
 -- Changing a PIN invalidates other device unlocks.
 DELETE FROM ht_private.pin_sessions WHERE user_id=auth.uid();
 until_at := now()+interval '30 minutes';
 INSERT INTO ht_private.pin_sessions(user_id,session_id,unlocked_until) VALUES(auth.uid(),session_uuid,until_at);
 RETURN jsonb_build_object('ok',true,'unlocked_until',until_at);
END $$;

CREATE OR REPLACE FUNCTION public.ht_pin_lock()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 DELETE FROM ht_private.pin_sessions WHERE user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id';
END $$;

-- A restrictive policy prevents accidentally permissive existing policies from bypassing the gate.
ALTER TABLE public.hisab_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hisab_users FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.hisab_users TO authenticated;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hisab_users'
 LOOP EXECUTE format('DROP POLICY %I ON public.hisab_users',r.policyname); END LOOP;
END $$;
CREATE POLICY ht_account_owner ON public.hisab_users TO authenticated
 USING(id=auth.uid() AND public.ht_gate_unlocked())
 WITH CHECK(id=auth.uid() AND public.ht_gate_unlocked());
-- No delete API is needed by this frontend.
REVOKE DELETE ON public.hisab_users FROM authenticated;
DO $$ DECLARE r record; BEGIN
 IF to_regclass('public.hisab_cash') IS NOT NULL THEN
  ALTER TABLE public.hisab_cash ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.hisab_cash FROM anon,authenticated;
  GRANT SELECT ON public.hisab_cash TO authenticated;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='hisab_cash'
  LOOP EXECUTE format('DROP POLICY %I ON public.hisab_cash',r.policyname); END LOOP;
  CREATE POLICY ht_cash_owner_read ON public.hisab_cash FOR SELECT TO authenticated
   USING(id=auth.uid() AND public.ht_gate_unlocked());
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ht_record_usage()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE until_at timestamptz;
BEGIN
 IF NOT public.ht_gate_unlocked() THEN RAISE EXCEPTION 'Unlock required' USING ERRCODE='42501'; END IF;
 INSERT INTO ht_private.usage(user_id) VALUES(auth.uid())
 ON CONFLICT(user_id) DO UPDATE SET last_seen=now()
 WHERE ht_private.usage.last_seen < now()-interval '45 seconds';
 until_at := now()+interval '30 minutes';
 UPDATE ht_private.pin_sessions SET unlocked_until=until_at
 WHERE user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id';
 RETURN jsonb_build_object('unlocked_until',until_at);
END $$;
CREATE OR REPLACE FUNCTION public.ht_usage_report(p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rows_json jsonb; total_count bigint; recent_count bigint; daily_count bigint;
BEGIN
 IF NOT public.ht_gate_unlocked() OR NOT EXISTS(SELECT 1 FROM ht_private.owners WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>1000000 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT count(*),count(*) FILTER(WHERE last_seen>now()-interval '5 minutes'),
  count(*) FILTER(WHERE last_seen>now()-interval '24 hours')
 INTO total_count,recent_count,daily_count FROM ht_private.usage;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.last_seen DESC,x.user_id),'[]'::jsonb)
 INTO rows_json FROM (
  SELECT a.user_id,u.email,a.first_seen,a.last_seen FROM ht_private.usage a JOIN auth.users u ON u.id=a.user_id
  ORDER BY a.last_seen DESC,a.user_id LIMIT 50 OFFSET p_page*50
 ) x;
 RETURN jsonb_build_object('total',total_count,'active_5m',recent_count,'active_24h',daily_count,
 'users',rows_json,'page',p_page,'has_more',(p_page+1)*50<total_count,'generated_at',now());
END $$;

-- Default PostgreSQL function EXECUTE grants must be explicitly removed.
REVOKE ALL ON FUNCTION public.ht_gate_unlocked(), public.ht_gate_status(), public.ht_pin_unlock(text),
 public.ht_pin_set(text), public.ht_pin_lock(), public.ht_record_usage(), public.ht_usage_report(integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ht_gate_unlocked(), public.ht_gate_status(), public.ht_pin_unlock(text),
 public.ht_pin_set(text), public.ht_pin_lock(), public.ht_record_usage(), public.ht_usage_report(integer)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
