-- Apply after 20261110_security_and_usage.sql. No financial data is changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.ht_gate_unlocked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM ht_private.pin_sessions s
  WHERE s.user_id=auth.uid() AND s.session_id::text=auth.jwt()->>'session_id'
   -- Manual lock deletes the session row; elapsed time does not lock it.
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
 WHERE user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id' AND public.ht_gate_unlocked();
 RETURN jsonb_build_object('has_pin',p.pin_hash IS NOT NULL OR p.legacy_hash IS NOT NULL,
  'unlocked',until_at IS NOT NULL,'unlocked_until',until_at,'blocked_until',p.blocked_until,
  'is_owner',EXISTS(SELECT 1 FROM ht_private.owners WHERE user_id=auth.uid()));
END $$;

COMMIT;
