-- Drop the restrictive SELECT policy on employees
DROP POLICY IF EXISTS "Only Admins and Managers can view employees" ON public.employees;

-- Create a new policy allowing all authenticated users to view employees
CREATE POLICY "All authenticated users can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (true);