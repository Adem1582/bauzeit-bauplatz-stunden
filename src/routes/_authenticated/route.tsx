import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).single();
    if (profile && !profile.active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
