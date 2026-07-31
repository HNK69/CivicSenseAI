import { Building2, UserRound } from "lucide-react";

export type Role = "citizen" | "officer";

export const ROLES = [
  {
    id: "citizen" as const,
    title: "Citizen",
    description: "Report civic issues and track progress.",
    portal: "Citizen Portal",
    Icon: UserRound,
  },
  {
    id: "officer" as const,
    title: "Officer",
    description: "Manage complaints and coordinate resolutions.",
    portal: "Officer Portal",
    Icon: Building2,
  },
];

export const roleConfig = (role: Role) => ROLES.find((r) => r.id === role)!;
