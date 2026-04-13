export type NavPhase = 'develop' | 'deploy' | 'ops';

export type NavSectionId =
  | 'project-management'
  | 'ai-assistant'
  | 'quality-scan'
  | 'file-manager'
  | 'git'
  | 'server-management'
  | 'docker'
  | 'deploy-templates'
  | 'service-monitor'
  | 'log-center'
  | 'alerts';

export interface NavItem {
  id: NavSectionId;
  label: string;
  icon: string;
  phase: NavPhase;
  requiresProject: boolean;
  implemented: boolean;
}

export interface NavPhaseGroup {
  phase: NavPhase;
  label: string;
  icon: string;
  items: NavItem[];
}
