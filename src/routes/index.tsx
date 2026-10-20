import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ALB PROJEKT – Zeiterfassung für die Baustelle" },
      { name: "description", content: "Einfach ein- und ausstempeln, Baustelle wählen, Stunden und Lohn im Blick." },
      { property: "og:title", content: "ALB PROJEKT" },
      { property: "og:description", content: "Zeiterfassung für kleine Baufirmen – mobil auf der Baustelle." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    throw redirect({ to: roles?.some((r) => r.role === "admin") ? "/chef" : "/zeit" });
  },
  component: () => null,
});
