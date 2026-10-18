CREATE TYPE public.app_role AS ENUM ('admin','employee');
CREATE TYPE public.entry_status AS ENUM ('offen','freigegeben','abgelehnt');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  hourly_wage numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin profile write" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin profile delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_first boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') INTO is_first;
  INSERT INTO public.profiles (id, full_name, email, hourly_wage)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email,
          COALESCE((NEW.raw_user_meta_data->>'hourly_wage')::numeric, 0));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites read" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "sites admin insert" ON public.sites FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sites admin update" ON public.sites FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "sites admin delete" ON public.sites FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  description text,
  status public.entry_status NOT NULL DEFAULT 'offen',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.time_entries (user_id, clock_in);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries read" ON public.time_entries FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "entries insert own" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'offen');
CREATE POLICY "entries update own open" ON public.time_entries FOR UPDATE TO authenticated USING ((user_id = auth.uid() AND status = 'offen') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "entries admin delete" ON public.time_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- employees cannot change status themselves
CREATE OR REPLACE FUNCTION public.guard_entry_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Nur der Chef darf den Status ändern';
  END IF;
  IF NEW.clock_out IS NOT NULL AND NEW.clock_out < NEW.clock_in THEN
    RAISE EXCEPTION 'Ende vor Beginn';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER time_entries_guard BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.guard_entry_status();