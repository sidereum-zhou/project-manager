import fs from 'fs';
import path from 'path';

export interface StoreProject {
  id: string;
  name: string;
  path: string;
  type: string;
  packageManager?: string;
  installCmd?: string[];
  startCmd?: string[];
  version?: string;
  subProjects?: string[];
  addedAt: string;
  customStartCmd?: string[] | null;
  customInstallCmd?: string[] | null;
}

export interface StoreData {
  projects: StoreProject[];
  settings: {
    defaultTerminalFont: string;
    defaultTerminalFontSize: number;
  };
}

const DEFAULT_DATA: StoreData = {
  projects: [],
  settings: {
    defaultTerminalFont: 'Consolas',
    defaultTerminalFontSize: 14,
  },
};

export class Store {
  private filePath: string;
  private data: StoreData | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): StoreData {
    if (this.data) return this.data;

    if (!fs.existsSync(this.filePath)) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      return this.data;
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    this.data = JSON.parse(raw);
    return this.data;
  }

  save(data: StoreData): void {
    this.data = data;
    const tmpPath = this.filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  getFilePath(): string {
    return this.filePath;
  }
}
