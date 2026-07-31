import { Building2, UserRound, HardHat } from 'lucide-react';

export const ROLES = [
  {
    id: 'citizen',
    title: 'Citizen',
    description: 'Report civic issues and track progress.',
    portal: 'Citizen Portal',
    Icon: UserRound,
  },
  {
    id: 'officer',
    title: 'Officer',
    description: 'Manage complaints and coordinate resolutions.',
    portal: 'Officer Portal',
    Icon: Building2,
  },
  {
    id: 'contractor',
    title: 'Contractor',
    description: 'Execute assigned work orders & submit evidence.',
    portal: 'Contractor Portal',
    Icon: HardHat,
  },
];

export const roleConfig = (role) => ROLES.find((r) => r.id === role);
