import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NavPhase, NavSectionId } from '@/types/navigation';
import { NAV_PHASES } from '@/config/navigation';

export const useNavigationStore = defineStore('navigation', () => {
  const activePhase = ref<NavPhase>('develop');
  const activeSection = ref<NavSectionId | null>('project-management');
  const phaseExpanded = ref<Record<NavPhase, boolean>>({
    develop: true,
    deploy: false,
    ops: false,
  });
  const projectListExpanded = ref(true);

  function togglePhase(phase: NavPhase): void {
    phaseExpanded.value[phase] = !phaseExpanded.value[phase];
  }

  function expandPhase(phase: NavPhase): void {
    phaseExpanded.value[phase] = true;
  }

  function selectSection(sectionId: NavSectionId): void {
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === sectionId);
      if (item) {
        activePhase.value = item.phase;
        phaseExpanded.value[item.phase] = true;
        break;
      }
    }
    activeSection.value = sectionId;
  }

  function toggleProjectList(): void {
    projectListExpanded.value = !projectListExpanded.value;
  }

  const activePhaseLabel = computed(() => {
    const group = NAV_PHASES.find(g => g.phase === activePhase.value);
    return group?.label ?? '';
  });

  const activeSectionLabel = computed(() => {
    if (!activeSection.value) return '';
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === activeSection.value);
      if (item) return item.label;
    }
    return '';
  });

  const activeNavItem = computed(() => {
    if (!activeSection.value) return null;
    for (const group of NAV_PHASES) {
      const item = group.items.find(i => i.id === activeSection.value);
      if (item) return item;
    }
    return null;
  });

  return {
    activePhase,
    activeSection,
    phaseExpanded,
    projectListExpanded,
    activePhaseLabel,
    activeSectionLabel,
    activeNavItem,
    togglePhase,
    expandPhase,
    selectSection,
    toggleProjectList,
  };
});
