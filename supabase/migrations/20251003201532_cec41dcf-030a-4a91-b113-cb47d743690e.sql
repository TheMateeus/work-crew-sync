-- Drop the overly permissive policy that allows all authenticated users to view employees
DROP POLICY IF EXISTS "All authenticated users can view employees" ON public.employees;

-- Create a new restrictive policy that only allows ADMIN and MANAGER roles to view employees
CREATE POLICY "Only Admins and Managers can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['ADMIN'::app_role, 'MANAGER'::app_role]));