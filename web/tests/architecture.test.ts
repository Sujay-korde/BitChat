import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Constraints', () => {
  it('UI components should not directly import WebSocket or Cryptography internals', () => {
    const componentsDir = path.join(__dirname, '../src/components');
    const walkSync = (dir: string, filelist: string[] = []) => {
      if (!fs.existsSync(dir)) return filelist;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
          filelist = walkSync(filepath, filelist);
        } else if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
          filelist.push(filepath);
        }
      }
      return filelist;
    };
    
    const files = walkSync(componentsDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/WebSocketTransport/);
      expect(content).not.toMatch(/CryptoProvider/);
    }
  });
});
