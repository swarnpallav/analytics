import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// AI endpoints (voice intent, insights, chat). Only registered when ENABLE_AI=true.
export function registerAiRoutes(app, { livePath, datasetsDir }) {
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const resolveSampleDataPath = () => livePath;

function loadTaxonomy() {
  try {
    const raw = fs.existsSync(livePath) ? fs.readFileSync(livePath, 'utf-8') : '';
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

let knownCategories = [];
let knownActions = [];
let knownHookNames = [];

function refreshTaxonomy() {
  const t = loadTaxonomy();
  knownCategories = t.categories;
  knownActions = t.actions;
  knownHookNames = t.hookNames;
}

refreshTaxonomy();

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
  refreshTaxonomy();

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

// AI Insights endpoint: accepts an array of events and returns a markdown analysis
app.post('/api/insights', async (req, res) => {
  try {
    const { data, timestampField = 'timestamp', maxTransitions = 50 } = req.body || {};
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Body must include an array field "data"' });
    }
    // Prepare a compact snapshot of the data for the model
    const trimmed = data.slice(0, 5000).map(e => ({
      screenName: e?.screenName || null,
      action: e?.action || null,
      category: e?.category || null,
      ts: e?.[timestampField] ?? null
    }));

    // Lightweight descriptive stats for grounding and fallback
    const screenCounts = new Map();
    const actionCounts = new Map();
    const categoryCounts = new Map();
    const transitions = new Map();
    function parseTs(v) {
      if (v == null) return NaN; if (typeof v === 'number') return v; const n = Number(v); if (!Number.isNaN(n) && String(v).trim() !== '') return n; const d = Date.parse(v); return Number.isNaN(d) ? NaN : d;
    }
    const withTs = trimmed.map((e, i) => ({ idx: i, e, ts: parseTs(e.ts) }));
    const sorted = withTs.slice().sort((a, b) => (a.ts - b.ts || a.idx - b.idx));
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i].e; const next = sorted[i + 1]?.e;
      const s = cur.screenName || 'UNKNOWN'; const a = cur.action || 'UNKNOWN'; const c = cur.category || 'UNKNOWN';
      screenCounts.set(s, (screenCounts.get(s) || 0) + 1);
      actionCounts.set(a, (actionCounts.get(a) || 0) + 1);
      categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
      if (next) {
        const key = `${s} → ${next.screenName || 'UNKNOWN'}`;
        transitions.set(key, (transitions.get(key) || 0) + 1);
      }
    }
    const top = (m, n=10) => Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((x,y)=>y.value-x.value).slice(0, n);
    const topScreens = top(screenCounts, 8);
    const topActions = top(actionCounts, 8);
    const topCategories = top(categoryCounts, 8);
    const topTransitions = top(transitions, maxTransitions);

    const grounding = {
      counts: {
        totalEvents: trimmed.length,
        topScreens,
        topActions,
        topCategories,
        topTransitions
      }
    };

    if (openai) {
      try {
        const sys = `You are a product analyst. Analyze user event sequences and write concise, high-signal insights in markdown.
Goals: identify repetitive behaviours, potential causes of drop-off, confusing flows, and actionable recommendations.
Return markdown with these headings (use only if you have content):\n\n## Key patterns\n## Repetitive behaviours\n## Possible drop-off causes\n## Recommendations\n## Notable metrics\n\nKeep it specific to the provided data. Avoid generic advice. Max ~250-300 words.`;
        const userMsg = `Here is a compact snapshot of events (up to 5k rows) and summary stats. Field semantics: screenName, action, category, ts.
JSON:
${JSON.stringify({ sample: trimmed.slice(0, 200), summary: grounding }, null, 2)}`;
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.2
        });
        const content = response?.choices?.[0]?.message?.content?.trim();
        if (content) return res.json({ markdown: content, grounding });
      } catch (e) {
        // fall through to heuristic
      }
    }

    // Heuristic fallback: simple markdown from stats
    const md = [
      `## Key patterns`,
      `- Top screens: ${topScreens.map(x=>`${x.name} (${x.value})`).join(', ') || 'n/a'}`,
      `- Top actions: ${topActions.map(x=>`${x.name} (${x.value})`).join(', ') || 'n/a'}`,
      `- Top categories: ${topCategories.map(x=>`${x.name} (${x.value})`).join(', ') || 'n/a'}`,
      `- Frequent transitions: ${topTransitions.slice(0,5).map(x=>`${x.name} (${x.value})`).join(', ') || 'n/a'}`,
      `\n## Repetitive behaviours`,
      `- Repeated screens/actions are likely loops or retries: ${topActions.slice(0,3).map(x=>x.name).join(', ') || 'n/a'}`,
      `\n## Possible drop-off causes`,
      `- Look for transitions with high frequency into end screens or error actions (not computed without conversion steps).`,
      `\n## Recommendations`,
      `- Instrument explicit success/failure flags and key CTAs on top screens to confirm hypotheses.`,
      `- Add timestamps for all events to compute time-in-step and abandonment windows.`,
      `\n## Notable metrics`,
      `- Total events analyzed: ${trimmed.length}`
    ].join('\n');
    return res.json({ markdown: md, grounding });
  } catch (e) {
    return res.status(500).json({ error: 'Insights generation failed' });
  }
});

// Chat over dataset: accepts { question, datasetId? } and answers grounded on a dataset snapshot or live data
app.post('/api/chat', async (req, res) => {
  try {
    const { question, datasetId, history } = req.body || {};
    // Internal knobs (auto selection)
    const maxRows = 2000;           // sampling cap when dataset is huge
    const fullCharBudget = 180_000; // rough safe budget for full-context JSON
    const chunkSizeRows = 900;      // target rows per chunk for map step
    const maxChunks = 24;           // cap number of chunks
    if (!question || typeof question !== 'string') return res.status(400).json({ error: 'Missing question' });
    // Load data
    let data = [];
    if (datasetId === 'all') {
      // Merge all snapshot datasets plus Live
      try {
        const dir = datasetsDir();
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isFile() && (ent.name.endsWith('.json') || ent.name.endsWith('.txt'))) {
            try {
              const p = path.join(dir, ent.name);
              const raw = fs.readFileSync(p, 'utf-8');
              const json = JSON.parse(raw);
              const arr = Array.isArray(json) ? json : (json.data || []);
              if (Array.isArray(arr)) data.push(...arr);
            } catch (_) { /* skip bad file */ }
          }
        }
        // Append Live data at the end
        const lp = resolveSampleDataPath();
        if (fs.existsSync(lp)) {
          try {
            const raw = fs.readFileSync(lp, 'utf-8');
            const json = JSON.parse(raw);
            const arr = Array.isArray(json) ? json : (json.data || []);
            if (Array.isArray(arr)) data.push(...arr);
          } catch (_) {}
        }
      } catch (_) {}
    } else if (datasetId && datasetId !== 'live') {
      const safe = path.basename(datasetId);
      const p = path.join(datasetsDir(), safe);
      if (!fs.existsSync(p)) return res.status(404).json({ error: 'Dataset not found' });
      const raw = fs.readFileSync(p, 'utf-8');
      const json = JSON.parse(raw);
      data = Array.isArray(json) ? json : (json.data || []);
    } else {
      const p = resolveSampleDataPath();
      const raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '[]';
      const json = JSON.parse(raw);
      data = Array.isArray(json) ? json : (json.data || []);
    }
    // Build the compact dataset for the model automatically.
    const mapRow = (e) => ({ screenName: e?.screenName || null, action: e?.action || null, category: e?.category || null, label: e?.label || null, ts: e?.timestamp ?? e?.ts ?? null });
    const projected = data.map(mapRow);
    const projectedStrLen = JSON.stringify(projected).length;
    const fitsFull = projectedStrLen <= fullCharBudget;
    const compact = fitsFull ? projected : data.slice(0, maxRows).map(mapRow);

    // Helper: compact prior conversation into a short context string
    function convoContext(maxChars = 2000) {
      try {
        if (!Array.isArray(history) || history.length === 0) return '';
        const recent = history.slice(-6).map(m => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(m?.content || '').slice(0, 800) }));
        const joined = recent.map(m => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`)).join('\n');
        return joined.slice(-maxChars);
      } catch { return ''; }
    }

    // If it doesn't fit in full context, automatically switch to map-reduce
    if (openai && !fitsFull) {
      try {
        // Map step: process chunks independently and collect partial insights
        const totalRows = compact.length;
        const chunkSize = Math.max(100, Math.min(chunkSizeRows, 2000));
        const numChunks = Math.min(Math.ceil(totalRows / chunkSize), Math.max(1, maxChunks));
        const mapSummaries = [];
        for (let ci = 0; ci < numChunks; ci++) {
          const start = ci * chunkSize;
          const end = Math.min(start + chunkSize, totalRows);
          const chunk = compact.slice(start, end);
          const sys = `You analyze a subset of analytics events for a PM. Focus strictly on this chunk.`;
          const user = `Conversation context (recent turns, optional):\n${convoContext()}\n\nQuestion: ${question}\nChunk index: ${ci + 1}/${numChunks}. Rows ${start}..${end - 1}.\nData: ${JSON.stringify(chunk, null, 2)}\n\nWrite a short bullet list of observations and counts relevant to the question. 6 bullets max.`;
          const r = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user }
            ],
            temperature: 0.2
          });
          const content = r?.choices?.[0]?.message?.content?.trim();
          mapSummaries.push({ chunk: ci + 1, start, end, content: content || '(no content)' });
        }

        // Reduce step: synthesize final answer
        const reduceSys = `You are a product analyst. Merge partial observations across chunks to answer the question precisely.`;
        const reduceUser = `Conversation context (recent turns, optional):\n${convoContext()}\n\nQuestion: ${question}\n\nHere are observations from multiple subsets of data. Combine and deduplicate them into one cohesive answer without referencing chunks or subsets explicitly.\n\n${mapSummaries.map(s => `- ${s.content}`).join('\n')}\n\nReturn a concise answer (<= 200 words), noting uncertainties if any.`;
        const rr = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: reduceSys },
            { role: 'user', content: reduceUser }
          ],
          temperature: 0.2
        });
        const answer = rr?.choices?.[0]?.message?.content?.trim();
        return res.json({ answer: answer || 'No answer produced.', meta: { mode: 'map-reduce', totalRows, chunkSize, numChunks } });
      } catch (e) {
        // fall back to non-map-reduce path below
      }
    }

    if (openai) {
      try {
        const sys = `You are a helpful assistant answering questions about analytics events for PMs. Use only the provided JSON.
Be specific and concise. When comparing counts or sequences, explain in 1-2 lines. If unsure, say what additional data would help.`;
        const sample = compact.length > 400 ? compact.slice(0, 400) : compact;
        const user = `Conversation context (recent turns, optional):\n${convoContext()}\n\nQuestion: ${question}\n\nData (${compact.length} rows):\n${JSON.stringify(sample, null, 2)}${compact.length>sample.length?`\n\n(Only first ${sample.length} rows shown due to size)`:''}`;
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user }
          ],
          temperature: 0.2
        });
        const content = response?.choices?.[0]?.message?.content?.trim();
        return res.json({ answer: content || 'No answer produced.', meta: { mode: fitsFull ? 'full' : 'sample' } });
      } catch (e) {
        // fall through
      }
    }
    // Fallback simple search
    const text = question.toLowerCase();
    const matches = compact.filter(e => JSON.stringify(e).toLowerCase().includes(text)).slice(0, 20);
    return res.json({ answer: `Found ${matches.length} matching events (showing up to 20).`, matches });
  } catch (e) {
    return res.status(500).json({ error: 'Chat failed' });
  }
});


}
