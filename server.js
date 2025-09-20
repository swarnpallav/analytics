import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function loadTaxonomy() {
  try {
    const samplePathPublic = path.join(__dirname, 'public', 'sampleData.txt');
    const samplePathSrc = path.join(__dirname, 'src', 'sampleData.txt');
    let raw = '';
    if (fs.existsSync(samplePathPublic)) {
      raw = fs.readFileSync(samplePathPublic, 'utf-8');
    } else if (fs.existsSync(samplePathSrc)) {
      raw = fs.readFileSync(samplePathSrc, 'utf-8');
    }
    if (!raw) return { categories: [], actions: [], hookNames: [] };
    const data = JSON.parse(raw);
    const catSet = new Set();
    const actSet = new Set();
    const hookSet = new Set();
    (Array.isArray(data) ? data : []).forEach(e => {
      if (e && e.category) catSet.add(e.category);
      if (e && e.action) actSet.add(e.action);
      const hook = e?.label?.hook_name;
      if (hook) hookSet.add(hook);
    });
    return {
      categories: Array.from(catSet).sort(),
      actions: Array.from(actSet).sort(),
      hookNames: Array.from(hookSet).sort()
    };
  } catch (e) {
    return { categories: [], actions: [], hookNames: [] };
  }
}

const { categories: knownCategories, actions: knownActions, hookNames: knownHookNames } = loadTaxonomy();

function localHeuristicIntent(text) {
  const lower = String(text || '').toLowerCase();
  // duplicates
  if (/\bduplicates?\b/.test(lower) || /\bduplicate events?\b/.test(lower) || /\bshow\s+duplicates?\b/.test(lower)) {
    return { type: 'showDuplicates' };
  }
  // ask lists or counts
  if (/(what|which|list|show|how\s+many)\s+(are\s+the\s+)?categories/.test(lower)) return { type: 'askAboutCategories' };
  if (/(what|which|list|show|how\s+many)\s+(are\s+the\s+)?actions/.test(lower)) return { type: 'askAboutActions' };
  if (/(what|which|list|show|how\s+many)\s+(are\s+the\s+)?hook\s*names?/.test(lower) || /hookname/.test(lower)) return { type: 'askAboutHookNames' };
  // filters
  let m;
  m = lower.match(/(?:show|filter|display)(?:\s+me)?\s+(?:the\s+)?category\s+([\w_\-]+)/);
  if (m && m[1]) return { type: 'filterByCategory', category: m[1] };
  m = lower.match(/(?:show|filter|display)(?:\s+me)?\s+(?:the\s+)?action\s+([\w_\-]+)/);
  if (m && m[1]) return { type: 'filterByAction', action: m[1] };
  m = lower.match(/(?:show|filter|display)(?:\s+me)?\s+(?:the\s+)?hook(?:\s*name)?\s+([\w_\-]+)/);
  if (m && m[1]) return { type: 'filterByHookName', hookName: m[1] };
  // direct phrases
  m = lower.match(/category\s+([\w_\-]+)/) || lower.match(/([\w_\-]+)\s+category/);
  if (m && m[1]) return { type: 'filterByCategory', category: m[1] };
  m = lower.match(/action\s+([\w_\-]+)/) || lower.match(/([\w_\-]+)\s+action/);
  if (m && m[1]) return { type: 'filterByAction', action: m[1] };
  m = lower.match(/hook(?:\s*name)?\s+([\w_\-]+)/) || lower.match(/([\w_\-]+)\s+hook(?:\s*name)?/);
  if (m && m[1]) return { type: 'filterByHookName', hookName: m[1] };
  return { type: 'unknown' };
}

app.post('/api/voice-intent', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  // Start with local heuristic
  let intent = localHeuristicIntent(text);

  // If OpenAI is configured, ask for a normalized category intent
  if (openai) {
    try {
      const sys = `You normalize user voice requests about analytics events.
Supported types: filterByCategory, filterByAction, filterByHookName, askAboutCategories, askAboutActions, askAboutHookNames, showDuplicates, unknown.
Known categories: ${knownCategories.join(', ') || 'none'}
Known actions: ${knownActions.join(', ') || 'none'}
Known hookNames: ${knownHookNames.join(', ') || 'none'}
Return strict JSON only. Examples:
{"type":"filterByCategory","category":"signin"}
{"type":"filterByAction","action":"login_with_password"}
{"type":"filterByHookName","hookName":"listing_carousel"}
{"type":"askAboutCategories"}
{"type":"showDuplicates"}`;

      const user = `User said: ${text}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0
      });
      const content = response?.choices?.[0]?.message?.content?.trim();
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && parsed.type) intent = parsed;
        } catch (_) {
          // If the model returned text, do a best-effort extraction
          const m = content.match(/\{[\s\S]*\}/);
          if (m) {
            try { intent = JSON.parse(m[0]); } catch (_) {}
          }
        }
      }
    } catch (err) {
      // Fallback to heuristic
    }
  }

  // Attempt to resolve values to known taxonomy
  if (intent?.type === 'filterByCategory' && intent.category) {
    const lower = intent.category.toLowerCase();
    const exact = knownCategories.find(c => c.toLowerCase() === lower);
    const fuzzy = exact || knownCategories.find(c => c.toLowerCase().includes(lower));
    if (fuzzy) intent.category = fuzzy;
  }
  if (intent?.type === 'filterByAction' && intent.action) {
    const lower = intent.action.toLowerCase();
    const exact = knownActions.find(a => a.toLowerCase() === lower);
    const fuzzy = exact || knownActions.find(a => a.toLowerCase().includes(lower));
    if (fuzzy) intent.action = fuzzy;
  }
  if (intent?.type === 'filterByHookName' && intent.hookName) {
    const lower = intent.hookName.toLowerCase();
    const exact = knownHookNames.find(h => h.toLowerCase() === lower);
    const fuzzy = exact || knownHookNames.find(h => h.toLowerCase().includes(lower));
    if (fuzzy) intent.hookName = fuzzy;
  }

  return res.json({ intent, knownCategories, knownActions, knownHookNames });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


