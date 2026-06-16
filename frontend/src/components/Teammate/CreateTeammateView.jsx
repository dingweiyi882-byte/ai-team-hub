import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Bot, Upload, FileText, Sparkles, ChevronDown,
  ChevronRight, Check, Eye, EyeOff, BookOpen,
  Zap, Code2, Palette, Brain, Shield, ArrowLeft, Search, Loader,
} from 'lucide-react';
import * as api from '../../services/api';
import { CHINESE_PROVIDERS, OVERSEAS_PROVIDERS, getProviderModels, getProviderModelsSync, getProviderName, clearModelCache } from '../../services/providers';
import { useTranslation } from '../../i18n';

/* ─── Built-in Prompt {t("teammate.templates")} ─── */
const PROMPT_TEMPLATES = [
  {
    id: 'senior-engineer',
    icon: Code2,
    label: 'template.senior_engineer',
    desc: 'template.senior_engineer_desc',
    prompt: `# Role: Senior Software Engineer

You are a **senior software engineer** with 15+ years of experience. You specialize in:

- System architecture & design patterns
- Code review & best practices
- Performance optimization
- Debugging complex issues

## Guidelines

1. Always explain your reasoning before showing code
2. Prefer clarity over cleverness
3. Flag potential issues proactively
4. Suggest tests for critical paths

## Response Format

\`\`\`
## Analysis
[Your reasoning]

## Solution
[Code or explanation]

## Caveats
[Any edge cases or tradeoffs]
\`\`\`
`,
  },
  {
    id: 'product-manager',
    icon: Brain,
    label: 'template.product_manager',
    desc: 'template.product_manager_desc',
    prompt: `# Role: Product Manager

You are an experienced **product manager** who helps define, scope, and prioritize features. You:

- Ask clarifying questions to understand user needs
- Break down features into user stories
- Identify edge cases and risks
- Prioritize ruthlessly by impact

## Guidelines

1. Start every project with "who is this for and what problem does it solve?"
2. Always provide acceptance criteria
3. Flag scope creep explicitly
4. Think in terms of outcomes, not outputs

## Response Format

\`\`\`
## Problem Statement
[One sentence]

## User Stories
- As a [user], I want [goal] so that [reason]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Risks / Open Questions
[What could go wrong / what we don't know yet]
\`\`\`
`,
  },
  {
    id: 'ui-designer',
    icon: Palette,
    label: 'template.ui_designer',
    desc: 'template.ui_designer_desc',
    prompt: `# Role: UI/UX Designer

You are a **design-savvy UI/UX designer** who thinks in terms of user journeys, visual hierarchy, and delight. You:

- Apply design principles from Dieter Rams and modern UI patterns
- Care about typography, spacing, color theory, and motion
- Advocate for accessibility (WCAG AA+)
- Design mobile-first with responsive breakpoints

## Design Principles

1. Clarity over decoration
2. Progressive disclosure
3. Consistent interaction patterns
4. Meaningful motion (200-300ms transitions)

## Response Format

\`\`\`
## Current State
[What the UI looks like now]

## Issues
1. [Problem 1]
2. [Problem 2]

## Recommendations
[Specific changes with rationale]

## Implementation Notes
[Tailwind classes, animation specs, responsive behavior]
\`\`\`
`,
  },
  {
    id: 'security-auditor',
    icon: Shield,
    label: 'template.security_auditor',
    desc: 'template.security_auditor_desc',
    prompt: `# Role: Security Auditor

You are a **security-first code auditor**. You review code, architecture, and configurations for vulnerabilities. You:

- Apply OWASP Top 10 awareness
- Check for injection, XSS, CSRF, auth flaws
- Review dependency chains
- Think like an attacker

## Review Checklist

- [ ] Input validation & sanitization
- [ ] Authentication & authorization
- [ ] Secrets management
- [ ] Dependency vulnerabilities
- [ ] Data exposure risks

## Response Format

\`\`\`
## Severity
🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

## Finding
[Description]

## Impact
[What an attacker could do]

## Fix
[Code change with explanation]
\`\`\`
`,
  },
  {
    id: 'data-analyst',
    icon: Zap,
    label: 'template.data_analyst',
    desc: 'template.data_analyst_desc',
    prompt: `# Role: Data Analyst

You are a **data analyst** who turns raw data into actionable insights. You:

- Prefer Python (pandas, matplotlib) for analysis
- Always ask "so what?" after each finding
- Spot trends, outliers, and correlations
- Communicate findings clearly to non-technical stakeholders

## Guidelines

1. Start with summary statistics
2. Visualize before concluding
3. Always mention data quality issues
4. Separate correlation from causation

## Response Format

\`\`\`
## Data Summary
[Key metrics]

## Findings
1. [Insight 1]
2. [Insight 2]

## Recommendations
[What to do next]
\`\`\`
`,
  },
];

export default function CreateTeammateView({ onDone, onCancel }) {
  const t = useTranslation();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [prompt, setPrompt] = useState('');
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [modelList, setModelList] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const promptRef = useRef(null);
  const modelDropdownRef = useRef(null);

  useEffect(() => {
    api.listAPIKeys().then(setApiKeys).catch(() => {});
    if (step === 2) {
      setTimeout(() => promptRef.current?.focus(), 300);
    }
  }, [step]);

  // 动态加载模型列表
  useEffect(() => {
    let cancelled = false;
    setModelLoading(true);
    setModelList([]);
    setModelSearch('');
    getProviderModels(provider, selectedKey).then(models => {
      if (!cancelled) {
        setModelList(models);
        setModelLoading(false);
        // 自动选第一个
        if (models.length > 0 && !models[0].id.startsWith('输入')) {
          setModel(models[0].id);
        }
      }
    }).catch(() => {
      if (!cancelled) setModelLoading(false);
    });
    return () => { cancelled = true; };
  }, [provider, selectedKey]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── File handling ──
  const readFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['md', 'txt', 'markdown'].includes(ext)) {
      setError(t('teammate.file_format_error'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPrompt(e.target.result);
      setError('');
    };
    reader.onerror = () => setError(t('teammate.file_read_error'));
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
  };

  const loadTemplate = (template) => {
    setPrompt(template.prompt);
    setShowTemplates(false);
    setTimeout(() => promptRef.current?.focus(), 100);
  };

  // ── Emoji picker ──
  const emojis = ['🤖', '🧠', '👨‍💻', '👩‍💻', '🦾', '💡', '🔮', '⚡', '🎯', '🛡️', '📊', '🎨', '🧪', '🔍', '💬', '🦉'];

  // ── Submit ──
  const handleSubmit = async () => {
    if (!name.trim()) { setError(t('teammate.name_required')); return; }
    if (!prompt.trim()) { setError(t('teammate.prompt_required')); return; }
    if (!selectedKey) { setError(t('teammate.key_required')); return; }
    setSaving(true);
    setError('');
    try {
      await api.createTeammate({
        name,
        system_prompt: prompt,
        avatar_emoji: emoji,
        model_provider: provider,
        model_name: model,
        api_key_ref: selectedKey || null,
      });
      onDone();
    } catch (err) {
      setError(err.message || t('teammate.create_failed'));
      setSaving(false);
    }
  };

  const canNext = name.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 overflow-y-auto bg-canvas"
    >
      <div className="max-w-2xl mx-auto px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-4 mb-10"
        >
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-xl hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={20} className="text-ink-mute" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-ink tracking-[-0.02em]">{t('teammate.create_title')}</h1>
            <p className="text-sm text-ink-mute mt-0.5">{t('teammate.create_desc')}</p>
          </div>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                animate={{
                  scale: step === s ? 1 : 0.85,
                  backgroundColor: step >= s ? '#4a154b' : '#e8e4df',
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step >= s ? 'text-white' : 'text-ink-faint'}`}
              >
                {step > s ? <Check size={14} /> : s}
              </motion.div>
              <span className={`text-xs font-semibold ${step >= s ? 'text-ink' : 'text-ink-faint'}`}>
                {s === 1 ? t('teammate.step_identity') : t('teammate.step_prompt')}
              </span>
              {s < 2 && <div className={`w-12 h-0.5 rounded-full ${step > 1 ? 'bg-primary' : 'bg-hairline'}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Identity ── */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Emoji picker */}
              <label className="block text-xs font-semibold text-ink-mute uppercase tracking-wide mb-3">{t('teammate.avatar')}</label>
              <div className="flex flex-wrap gap-2 mb-8">
                {emojis.map(e => (
                  <motion.button
                    key={e}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setEmoji(e)}
                    className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all
                      ${emoji === e
                        ? 'bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                        : 'bg-surface hover:bg-surface-hover border border-hairline'}`}
                  >
                    {e}
                  </motion.button>
                ))}
              </div>

              {/* Name */}
              <label className="block text-xs font-semibold text-ink-mute uppercase tracking-wide mb-2">{t("teammate.name")}</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && canNext && setStep(2)}
                placeholder={t("teammate.name_placeholder")}
                className="w-full px-4 py-3.5 rounded-xl bg-surface border border-hairline text-lg font-semibold
                           focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30
                           transition-all placeholder:text-ink-faint/50 mb-8"
                autoFocus
              />

              {/* Model config */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-mute uppercase tracking-wide mb-2">{t("teammate.provider")}</label>
                  <select
                    value={provider}
                    onChange={e => {
                      const p = e.target.value;
                      setProvider(p);
                      setModel('');
                      setModelList([]);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-hairline text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/10"
                  >
                    <optgroup label={t("teammate.providers_cn")}>
                      {CHINESE_PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label={t("teammate.providers_overseas")}>
                      {OVERSEAS_PROVIDERS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-mute uppercase tracking-wide mb-2">{t("teammate.model")}</label>
                  <div className="relative" ref={modelDropdownRef}>
                    <div
                      className="w-full px-4 py-3 pr-10 rounded-xl bg-surface border border-hairline text-sm
                                 focus-within:ring-2 focus-within:ring-primary/10 cursor-pointer flex items-center gap-2"
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                    >
                      {modelLoading ? (
                        <Loader size={14} className="animate-spin text-ink-faint" />
                      ) : (
                        <span className={model ? 'text-ink' : 'text-ink-faint/50'}>
                          {model || '选择模型...'}
                        </span>
                      )}
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                    </div>

                    {showModelDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-surface rounded-xl shadow-card-lg border border-hairline z-50 overflow-hidden">
                        {/* 搜索框 */}
                        <div className="p-2 border-b border-hairline">
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                            <input
                              autoFocus
                              value={modelSearch}
                              onChange={e => setModelSearch(e.target.value)}
                              placeholder={t("teammate.model_search_placeholder")}
                              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-canvas border border-hairline
                                         focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-ink-faint/50"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 px-1">
                            <button
                              onClick={e => { e.stopPropagation(); setModelSearch(''); }}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${!modelSearch.includes('🆓') ? 'bg-primary/10 border-primary/20 text-primary' : 'border-hairline text-ink-faint hover:bg-surface-hover'}`}
                            >
                              {t("teammate.all")} ({modelList.length})
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setModelSearch('🆓'); }}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${modelSearch === '🆓' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'border-hairline text-ink-faint hover:bg-surface-hover'}`}
                            >
                              {t("teammate.free")} ({modelList.filter(m => m.is_free).length})
                            </button>
                          </div>
                        </div>

                        {/* 模型列表 */}
                        <div className="max-h-72 overflow-y-auto">
                          {modelLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader size={18} className="animate-spin text-ink-faint" />
                              <span className="ml-2 text-xs text-ink-faint">{t("teammate.loading_models")}</span>
                            </div>
                          ) : (
                            (() => {
                              const search = modelSearch.replace(/🆓/g, '').trim().toLowerCase();
                              const showFreeOnly = modelSearch.includes('🆓');
                              const filtered = modelList.filter(m => {
                                if (showFreeOnly && !m.is_free) return false;
                                if (search && !m.id.toLowerCase().includes(search) && !m.name.toLowerCase().includes(search)) return false;
                                return true;
                              });
                              if (filtered.length === 0) {
                                return <p className="text-xs text-ink-faint text-center py-6">{t("teammate.no_models_found")}</p>;
                              }
                              return filtered.map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => { setModel(m.id); setShowModelDropdown(false); setModelSearch(''); }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors flex items-center justify-between gap-2
                                    ${model === m.id ? 'text-primary font-semibold bg-canvas-lavender' : 'text-ink'}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <code className="font-mono text-[11px] block truncate">{m.id}</code>
                                    {m.context_length > 0 && (
                                      <span className="text-[9px] text-ink-faint">{(m.context_length / 1000).toFixed(0)}K ctx</span>
                                    )}
                                  </div>
                                  {m.is_free && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold shrink-0">FREE</span>
                                  )}
                                </button>
                              ));
                            })()
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-faint mt-1">{t("teammate.model_hint")}</p>
                </div>
              </div>

              {/* API Key selector */}
              <div>
                <label className="block text-xs font-semibold text-ink-mute uppercase tracking-wide mb-2">{t("teammate.api_key")}</label>
                {apiKeys.length === 0 ? (
                  <p className="text-xs text-semantic-warning bg-amber-50 rounded-xl px-4 py-3">
                    {t("teammate.no_key")}
                  </p>
                ) : (
                  <select
                    value={selectedKey}
                    onChange={e => {
                      const keyId = e.target.value;
                      setSelectedKey(keyId);
                      clearModelCache();
                      // Auto-detect provider from selected API key
                      const key = apiKeys.find(k => k.id === keyId);
                      if (key && key.provider) {
                        setProvider(key.provider);
                        setModel('');
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-surface border border-hairline text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">{t("teammate.select_key")}</option>
                    {apiKeys.map(k => (
                      <option key={k.id} value={k.id}>{k.label} ({k.provider})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Next button */}
              <div className="mt-10 flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => canNext && setStep(2)}
                  disabled={!canNext}
                  className="px-8 py-3 bg-primary text-white font-semibold text-sm rounded-pill
                             shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed
                             transition-all flex items-center gap-2"
                >
                  {t("teammate.next")} <ChevronRight size={16} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: System Prompt ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-4">
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-pill text-xs font-semibold
                             bg-surface-hover text-ink-mute hover:bg-surface-active hover:text-ink transition-all"
                >
                  <Upload size={14} />
                  {t("teammate.upload_md")}
                </button>
                <input ref={fileInputRef} type="file" accept=".md,.txt,.markdown" onChange={handleFileChange} className="hidden" />

                {/* Templates button */}
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-xs font-semibold transition-all
                    ${showTemplates
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-hover text-ink-mute hover:bg-surface-active hover:text-ink'}`}
                >
                  <BookOpen size={14} />
                  {t("teammate.templates")}
                </button>

                {/* Preview toggle */}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-xs font-semibold transition-all ml-auto
                    ${showPreview
                      ? 'bg-canvas-lavender text-primary'
                      : 'bg-surface-hover text-ink-mute hover:bg-surface-active hover:text-ink'}`}
                >
                  {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPreview ? t("teammate.edit") : t("teammate.preview")}
                </button>
              </div>

              {/* Template library */}
              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {PROMPT_TEMPLATES.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => loadTemplate(tpl)}
                          className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-hairline
                                     hover:border-primary/20 hover:shadow-sm text-left transition-all group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-canvas-lavender flex items-center justify-center flex-shrink-0
                                          group-hover:bg-primary/10 transition-colors">
                            <tpl.icon size={16} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{t(tpl.label)}</p>
                            <p className="text-xs text-ink-mute truncate">{t(tpl.desc)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drag & drop zone OR prompt editor */}
              {!prompt.trim() ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
                    ${dragOver
                      ? 'border-primary/40 bg-primary/[0.03] scale-[1.01]'
                      : 'border-hairline hover:border-primary/20 bg-surface'}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <motion.div
                    animate={{ y: dragOver ? -4 : 0 }}
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-canvas-lavender flex items-center justify-center"
                  >
                    <FileText size={28} className="text-primary/50" />
                  </motion.div>
                  <p className="text-ink font-semibold mb-1">{t("teammate.drop_hint")}</p>
                  <p className="text-sm text-ink-mute mb-3">{t("teammate.drop_or")}</p>
                  <p className="text-xs text-ink-faint">{t("teammate.drop_support")}</p>
                </motion.div>
              ) : showPreview ? (
                /* Preview mode */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-surface border border-hairline p-6 min-h-[300px] max-h-[500px] overflow-y-auto"
                >
                  <div
                    className="prose prose-sm max-w-none message-content"
                    dangerouslySetInnerHTML={{
                      __html: prompt
                        .replace(/^# (.+)$/gm, '<h2 class="text-lg font-extrabold text-ink mt-6 mb-3">$1</h2>')
                        .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold text-ink mt-4 mb-2">$1</h3>')
                        .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-ink mt-3 mb-1">$1</h4>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm">$1</li>')
                        .replace(/```([\s\S]*?)```/g, '<pre class="bg-canvas-cream rounded-xl p-4 text-xs font-mono my-3 overflow-x-auto">$1</pre>')
                        .replace(/\n\n/g, '<br/><br/>')
                    }}
                  />
                </motion.div>
              ) : (
                /* Edit mode */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className="relative"
                >
                  {dragOver && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/[0.03]
                                    z-10 flex items-center justify-center pointer-events-none">
                      <p className="text-primary font-semibold">{t("teammate.drop_to_load")}</p>
                    </div>
                  )}
                  <textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={e => { setPrompt(e.target.value); setError(''); }}
                    placeholder="# Role: [Teammate Name]

You are a **senior engineer** with expertise in...

## Guidelines

1. Always explain your reasoning
2. Prefer clarity over cleverness

## Response Format

```
## Analysis
[Your reasoning]
```
"
                    className="w-full h-80 p-5 rounded-2xl bg-surface border border-hairline
                               font-mono text-sm leading-relaxed resize-none
                               focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30
                               transition-all placeholder:text-ink-faint/40"
                    spellCheck={false}
                  />
                </motion.div>
              )}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-xs text-semantic-error bg-red-50 rounded-xl px-4 py-2.5"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold text-ink-mute
                             hover:text-ink transition-colors"
                >
                  <ArrowLeft size={14} /> {t("teammate.back")}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={saving || !prompt.trim()}
                  className="px-10 py-3 bg-primary text-white font-semibold text-sm rounded-pill
                             shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed
                             transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles size={16} />
                      </motion.div>
                      {t("teammate.creating")}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {t("teammate.create_btn")}
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
