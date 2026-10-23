import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Kush është sot në punë (regjistrime të hapura të sotme) – e dukshme për të gjithë. */
export function useTeamToday() {
  return useQuery({
    queryKey: ["team-today"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      return (
        (
          await supabase
            .from("time_entries")
            .select("id, clock_in, profiles(full_name), sites(name)")
            .is("clock_out", null)
            .gte("clock_in", dayStart.toISOString())
            .order("clock_in")
        ).data ?? []
      );
    },
  });
}
