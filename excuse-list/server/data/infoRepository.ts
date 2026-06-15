import fs from 'fs';
import path from 'path';

const dataPath = path.join(__dirname, 'infos.json');

export interface Info {
  id: string;
  title: string;
  content: string;
  date: number;
}

export function getInfos(): Info[] {
  try {
    if (!fs.existsSync(dataPath)) return [];
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveInfos(infos: Info[]) {
  fs.writeFileSync(dataPath, JSON.stringify(infos, null, 2));
}
