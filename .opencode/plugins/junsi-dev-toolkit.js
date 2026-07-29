/**
 * junsi-dev-toolkit plugin for OpenCode.ai
 *
 * Injects bootstrap routing context via message transform.
 * Auto-registers skills directory via config hook.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };
  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};
  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }
  return { frontmatter, content: body };
};

let _bootstrapCache = undefined;

export const JunsiDevToolkitPlugin = async ({ client, directory }) => {
  const skillsDir = path.resolve(__dirname, '../../.agents/skills/junsi-dev-toolkit');
  const rootSkillPath = path.join(skillsDir, 'SKILL.md');

  const getBootstrapContent = () => {
    if (_bootstrapCache !== undefined) return _bootstrapCache;
    if (!fs.existsSync(rootSkillPath)) {
      _bootstrapCache = null;
      return null;
    }
    const fullContent = fs.readFileSync(rootSkillPath, 'utf8');
    const { content } = extractAndStripFrontmatter(fullContent);
    _bootstrapCache = content;
    return _bootstrapCache;
  };

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find(m => m.info.role === 'user');
      if (!firstUser || !firstUser.parts.length) return;
      if (firstUser.parts.some(p => p.type === 'text' && p.text.includes('junsi-dev-toolkit Plugin'))) return;
      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: 'text', text: bootstrap });
    }
  };
};
