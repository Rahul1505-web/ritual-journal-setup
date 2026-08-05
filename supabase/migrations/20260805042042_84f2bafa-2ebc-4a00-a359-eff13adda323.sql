DROP POLICY IF EXISTS "Signed-in users can read access records" ON public.daily_access;

CREATE POLICY "Users view own daily access"
ON public.daily_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);