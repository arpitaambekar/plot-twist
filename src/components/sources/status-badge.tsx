import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield, Sparkles, Lightbulb, FlaskConical } from "lucide-react";
import type { ClaimStatus, ContactStatus } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";

export function ClaimStatusBadge({ status, className }: { status: ClaimStatus; className?: string }) {
  const map = {
    Verified: { tone: "mint" as const, Icon: ShieldCheck },
    Corroborated: { tone: "blue" as const, Icon: Shield },
    "Needs Verification": { tone: "peach" as const, Icon: ShieldQuestion },
    Unverified: { tone: "danger" as const, Icon: ShieldAlert },
  }[status];
  return (
    <Badge tone={map.tone} className={className}>
      <map.Icon className="h-3 w-3" aria-hidden />
      {status}
    </Badge>
  );
}

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const map = {
    "Officially Verified": { tone: "mint" as const, Icon: ShieldCheck },
    "Cross-Verified": { tone: "blue" as const, Icon: Shield },
    "Needs Verification": { tone: "peach" as const, Icon: ShieldQuestion },
    "Not Found": { tone: "neutral" as const, Icon: ShieldAlert },
  }[status];
  return (
    <Badge tone={map.tone}>
      <map.Icon className="h-3 w-3" aria-hidden />
      {status}
    </Badge>
  );
}

/** The three content types the platform always distinguishes (spec §14). */
export function KindLabel({ kind }: { kind: "fact" | "interpretation" | "hypothesis" }) {
  if (kind === "fact")
    return (
      <Badge tone="mint">
        <ShieldCheck className="h-3 w-3" aria-hidden /> Verified fact
      </Badge>
    );
  if (kind === "interpretation")
    return (
      <Badge tone="blue">
        <Lightbulb className="h-3 w-3" aria-hidden /> Strategic interpretation
      </Badge>
    );
  return (
    <Badge tone="peach">
      <Sparkles className="h-3 w-3" aria-hidden /> Creative hypothesis
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <Badge tone="danger" title="Generated from offline demo fixtures, not real research">
      <FlaskConical className="h-3 w-3" aria-hidden /> Demo data
    </Badge>
  );
}
