import fs from 'fs';
import { ipcMain } from 'electron';
import os from 'os';
import path from 'path';

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
  totalDiskGB: number;
  freeDiskGB: number;
  usedDiskGB: number;
  diskUsagePercent: number;
  diskLabel: string;
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
  const diskStats = getDiskStats();

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
    totalDiskGB: diskStats.totalDiskGB,
    freeDiskGB: diskStats.freeDiskGB,
    usedDiskGB: diskStats.usedDiskGB,
    diskUsagePercent: diskStats.diskUsagePercent,
    diskLabel: diskStats.diskLabel,
    uptimeSeconds: os.uptime(),
  };
}

export function registerSystemIpc(): void {
  ipcMain.handle('system:info', () => getSystemInfo());
}

function getDiskStats(): {
  totalDiskGB: number;
  freeDiskGB: number;
  usedDiskGB: number;
  diskUsagePercent: number;
  diskLabel: string;
} {
  try {
    const homeDir = os.homedir();
    const stats = fs.statfsSync(homeDir);
    const blockSize = Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * blockSize;
    const freeBytes = Number(stats.bavail) * blockSize;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const diskLabel = path.parse(homeDir).root || homeDir;

    return {
      totalDiskGB: roundGb(totalBytes),
      freeDiskGB: roundGb(freeBytes),
      usedDiskGB: roundGb(usedBytes),
      diskUsagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
      diskLabel,
    };
  } catch {
    return {
      totalDiskGB: 0,
      freeDiskGB: 0,
      usedDiskGB: 0,
      diskUsagePercent: 0,
      diskLabel: '—',
    };
  }
}

function roundGb(value: number): number {
  return Math.round((value / 1073741824) * 10) / 10;
}
