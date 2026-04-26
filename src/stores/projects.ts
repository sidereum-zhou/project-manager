import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Project } from '@/types/project';
import { electronApi } from '@/api/electron-api';

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([]);
  const activeProjectId = ref<string | null>(null);
  const activeProject = ref<Project | null>(null);
  const loading = ref(false);

  async function fetchProjects(): Promise<void> {
    loading.value = true;
    try {
      projects.value = await electronApi.listProjects();
    } finally {
      loading.value = false;
    }
  }

  async function importProject(): Promise<{
    name: string;
    path: string;
    type: string;
    packageManager?: string;
    installCmd?: string[];
    startCmd?: string[];
  } | null> {
    const dirPath = await electronApi.selectDirectory();
    if (!dirPath) return null;
    const detected = await electronApi.detectProject(dirPath);
    return { ...detected, path: dirPath };
  }

  async function addProject(data: {
    name: string;
    path: string;
    type: string;
    packageManager?: string;
    installCmd?: string[];
    startCmd?: string[];
  }): Promise<Project> {
    const project = await electronApi.addProject(data);
    projects.value.push(project);
    return project;
  }

  async function removeProject(id: string): Promise<void> {
    await electronApi.removeProject(id);
    projects.value = projects.value.filter(p => p.id !== id);
    if (activeProjectId.value === id) {
      activeProjectId.value = null;
      activeProject.value = null;
    }
  }

  async function updateProject(id: string, updates: Record<string, any>): Promise<void> {
    const updated = await electronApi.updateProject(id, updates);
    if (updated) {
      const idx = projects.value.findIndex(p => p.id === id);
      if (idx !== -1) projects.value[idx] = updated;
      if (activeProjectId.value === id) activeProject.value = updated;
    }
  }

  function selectProject(id: string | null): void {
    activeProjectId.value = id;
    activeProject.value = id ? projects.value.find(p => p.id === id) || null : null;
  }

  return {
    projects,
    activeProjectId,
    activeProject,
    loading,
    fetchProjects,
    importProject,
    addProject,
    removeProject,
    updateProject,
    selectProject,
  };
});
