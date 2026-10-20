import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ALB PROJEKT – Regjistrimi i orëve në kantier" },
      { name: "description", content: "Regjistro hyrjen dhe daljen, zgjidh kantierin, shiko orët dhe pagën." },
      { property: "og:title", content: "ALB PROJEKT" },
      { property: "og:description", content: "Regjistrimi i orëve për firma të vogla ndërtimi – në celular, në kantier." },
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
