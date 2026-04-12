import { ipcMain } from 'electron';
import os from 'os';

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsage: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  usedMemoryGB: number;
  memoryUsagePercent: number;
  uptimeSeconds: number;
}

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const start = process.cpuUsage();
    const startLoad = os.loadavg();
    setTimeout(() => {
      const end = process.cpuUsage(start);
      const total = end.user + end.system;
      // Normalize to 0-100 based on elapsed microseconds
      resolve(Math.min((total / 100000) / os.cpus().length, 100));
    }, 200);
  });
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpuUsage = await getCpuUsage();

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    cpuUsage: Math.round(cpuUsage * 10) / 10,
    totalMemoryGB: Math.round((totalMem / 1073741824) * 10) / 10,
    freeMemoryGB: Math.round((freeMem / 1073741824) * 10) / 10,
    usedMemoryGB: Math.round((usedMem / 1073741824) * 10) / 10,
    memoryUsagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
    uptimeSeconds: os.uptime(),
  };
}

export function registerSystemIpc(): void {
  ipcMain.handle('system:info', () => getSystemInfo());
}
