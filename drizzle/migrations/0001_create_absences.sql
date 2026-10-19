CREATE TYPE public.absence_type AS ENUM ('urlaub', 'krank', 'sonstiges');
CREATE TYPE public.absence_status AS ENUM ('offen', 'genehmigt', 'abgelehnt');

CREATE TABLE public.absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  type public.absence_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  status public.absence_status NOT NULL DEFAULT 'offen',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT absences_date_order CHECK (end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absences TO authenticated;
GRANT ALL ON public.absences TO service_role;

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absences read" ON public.absences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "absences insert own" ON public.absences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'offen');

CREATE POLICY "absences admin update" ON public.absences FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "absences admin delete" ON public.absences FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));