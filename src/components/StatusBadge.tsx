import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  offen: "bg-secondary text-secondary-foreground",
  freigegeben: "bg-success text-success-foreground",
  genehmigt: "bg-success text-success-foreground",
  abgelehnt: "bg-destructive text-destructive-foreground",
};

const labels: Record<string, string> = {
  offen: "Në pritje",
  freigegeben: "E miratuar",
  genehmigt: "E miratuar",
  abgelehnt: "E refuzuar",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[status])}>
      {labels[status] ?? status}
    </span>
  );
}
