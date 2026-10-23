import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Offline-Radha: nëse s'ka internet, regjistrimi ruhet në telefon
 * dhe dërgohet automatikisht sapo të kthehet lidhja.
 */

export type QueuedAction =
  | { kind: "clock_in"; user_id: string; site_id: string; description: string | null; clock_in: string; lat: number | null; lng: number | null }
  | { kind: "clock_out"; entry_id: string; clock_out: string; site_id: string | null; description: string | null; lat: number | null; lng: number | null };

const KEY = "alb-offline-queue";

export function readQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedAction[];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedAction[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueue(a: QueuedAction) {
  writeQueue([...readQueue(), a]);
}

export function queueCount(): number {
  return readQueue().length;
}

/** Dërgon të gjitha regjistrimet e pritjes; kthen numrin e dërguar. */
export async function syncQueue(): Promise<number> {
  const q = readQueue();
  if (!q.length) return 0;
  const remaining: QueuedAction[] = [];
  let sent = 0;
  for (const a of q) {
    try {
      if (a.kind === "clock_in") {
        const { error } = await supabase.from("time_entries").insert({
          user_id: a.user_id,
          site_id: a.site_id,
          description: a.description,
          clock_in: a.clock_in,
          clock_in_lat: a.lat,
          clock_in_lng: a.lng,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("time_entries")
          .update({
            clock_out: a.clock_out,
            site_id: a.site_id,
            description: a.description,
            clock_out_lat: a.lat,
            clock_out_lng: a.lng,
          })
          .eq("id", a.entry_id);
        if (error) throw error;
      }
      sent++;
    } catch {
      remaining.push(a);
    }
  }
  writeQueue(remaining);
  return sent;
}

/** Regjistrohet një herë: dërgon radhën kur kthehet interneti. */
export function initOfflineSync(onSynced: () => void) {
  const handler = async () => {
    const sent = await syncQueue();
    if (sent > 0) {
      toast.success(`${sent} regjistrime offline u dërguan.`);
      onSynced();
    }
  };
  window.addEventListener("online", handler);
  // provo edhe menjëherë (nëse ka mbetur diçka nga hera e kaluar)
  void handler();
  return () => window.removeEventListener("online", handler);
}
