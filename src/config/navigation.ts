import type { NavPhaseGroup, NavPhase } from '@/types/navigation';

export const NAV_PHASES: NavPhaseGroup[] = [
  {
    phase: 'develop',
    label: '开发',
    icon: 'code',
    items: [
      { id: 'project-management', label: '项目管理', icon: 'folder_open', phase: 'develop', requiresProject: true, implemented: true },
      { id: 'ai-assistant', label: 'AI 助手', icon: 'smart_toy', phase: 'develop', requiresProject: true, implemented: true },
      { id: 'quality-scan', label: '质量扫描', icon: 'shield', phase: 'develop', requiresProject: true, implemented: false },
      { id: 'file-manager', label: '文件管理', icon: 'description', phase: 'develop', requiresProject: true, implemented: true },
      { id: 'git', label: 'Git', icon: 'commit', phase: 'develop', requiresProject: true, implemented: true },
    ],
  },
  {
    phase: 'deploy',
    label: '部署',
    icon: 'rocket_launch',
    items: [
      { id: 'server-management', label: '服务器管理', icon: 'dns', phase: 'deploy', requiresProject: false, implemented: false },
      { id: 'docker', label: 'Docker', icon: 'layers', phase: 'deploy', requiresProject: false, implemented: false },
      { id: 'deploy-templates', label: '编排模板', icon: 'view_module', phase: 'deploy', requiresProject: false, implemented: false },
    ],
  },
  {
    phase: 'ops',
    label: '运维',
    icon: 'monitoring',
    items: [
      { id: 'service-monitor', label: '服务监控', icon: 'activity', phase: 'ops', requiresProject: true, implemented: true },
      { id: 'log-center', label: '日志中心', icon: 'receipt_long', phase: 'ops', requiresProject: false, implemented: false },
      { id: 'alerts', label: '告警', icon: 'notifications_active', phase: 'ops', requiresProject: false, implemented: false },
    ],
  },
];

export const PHASE_LABELS: Record<NavPhase, string> = {
  develop: '开发',
  deploy: '部署',
  ops: '运维',
};
