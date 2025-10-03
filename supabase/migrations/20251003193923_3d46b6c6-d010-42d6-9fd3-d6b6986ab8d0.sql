-- Create enums
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');
CREATE TYPE public.shift AS ENUM ('MORNING', 'AFTERNOON', 'FULL');

-- Create users table (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'VIEWER',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create worksites table
CREATE TABLE public.worksites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.worksites ENABLE ROW LEVEL SECURITY;

-- Create pairs table
CREATE TABLE public.pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

-- Create pair_members table
CREATE TABLE public.pair_members (
  pair_id UUID REFERENCES public.pairs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  PRIMARY KEY (pair_id, employee_id)
);

ALTER TABLE public.pair_members ENABLE ROW LEVEL SECURITY;

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  shift public.shift NOT NULL DEFAULT 'FULL',
  worksite_id UUID REFERENCES public.worksites(id) ON DELETE CASCADE,
  pair_id UUID REFERENCES public.pairs(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (date, worksite_id, shift, pair_id)
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  diff JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_user_id = user_id;
$$;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can create users"
  ON public.users FOR INSERT
  WITH CHECK (public.get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'ADMIN');

-- RLS Policies for employees
CREATE POLICY "All authenticated users can view employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and Managers can create employees"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins and Managers can update employees"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'ADMIN');

-- RLS Policies for worksites
CREATE POLICY "All authenticated users can view worksites"
  ON public.worksites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and Managers can create worksites"
  ON public.worksites FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins and Managers can update worksites"
  ON public.worksites FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins can delete worksites"
  ON public.worksites FOR DELETE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'ADMIN');

-- RLS Policies for pairs
CREATE POLICY "All authenticated users can view pairs"
  ON public.pairs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and Managers can create pairs"
  ON public.pairs FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins and Managers can update pairs"
  ON public.pairs FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins can delete pairs"
  ON public.pairs FOR DELETE
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'ADMIN');

-- RLS Policies for pair_members
CREATE POLICY "All authenticated users can view pair members"
  ON public.pair_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and Managers can manage pair members"
  ON public.pair_members FOR ALL
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

-- RLS Policies for assignments
CREATE POLICY "All authenticated users can view assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and Managers can create assignments"
  ON public.assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins and Managers can update assignments"
  ON public.assignments FOR UPDATE
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Admins and Managers can delete assignments"
  ON public.assignments FOR DELETE
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

-- RLS Policies for audit_log
CREATE POLICY "Admins can view audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'ADMIN');

-- Trigger to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'VIEWER'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();