import { useCallback, useEffect, useState } from 'react';
import { Brain, RefreshCw, Trash2 } from 'lucide-react';
import { api, errorText, isNative } from '../api/client';
import type { MemorySettings, MemoryStatement, UserProfile } from '../types';
import './ProfileMemoryPanel.css';

const flavorTags = ['citrus', 'tea', 'berry', 'smoky', 'sparkling', 'herbal'];
const allergyOptions = ['dairy', 'nuts', 'caffeine'];
const allergyLabels: Record<string, string> = { dairy: '乳制品', nuts: '坚果', caffeine: '咖啡因' };
const labelValue = (value: string) => allergyLabels[value] ?? value;

function profileValue<T>(value: unknown, fallback: T): T {
  try { return (value ?? fallback) as T; } catch { return fallback; }
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '—';
}

export function ProfileMemoryPanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [statements, setStatements] = useState<MemoryStatement[]>([]);
  const [settings, setSettings] = useState<MemorySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const [style, setStyle] = useState<'fresh' | 'sour' | 'sweet' | 'rich'>('fresh');
  const [strength, setStrength] = useState<'none' | 'light' | 'flexible'>('flexible');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [quizBusy, setQuizBusy] = useState(false);

  const [kind, setKind] = useState<MemoryStatement['kind']>('preference');
  const [content, setContent] = useState('');
  const [constraintAllergies, setConstraintAllergies] = useState('');
  const [constraintAvoid, setConstraintAvoid] = useState('');
  const [noAlcohol, setNoAlcohol] = useState(false);
  const [memoryError, setMemoryError] = useState('');

  const load = useCallback(async () => {
    if (isNative()) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [profileResult, memoryResult, settingsResult] = await Promise.allSettled([
        api.profile(),
        api.memoryStatements(true),
        api.memorySettings(),
      ]);
      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
        setProfileMissing(!profileResult.value);
      } else { throw profileResult.reason; }
      if (memoryResult.status === 'fulfilled') setStatements(memoryResult.value);
      if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
      if (memoryResult.status === 'rejected') throw memoryResult.reason;
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
    } catch (reason) { setError(errorText(reason)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) => setter(
    list.includes(value) ? list.filter(item => item !== value) : [...list, value],
  );

  const submitQuiz = async () => {
    setQuizBusy(true); setError(''); setSaved('');
    const flavor = {
      sweet: style === 'sweet' ? 4 : style === 'rich' ? 3 : style === 'fresh' ? 2 : 1.5,
      sour: style === 'sour' ? 4 : style === 'fresh' ? 3.5 : 2,
      bitter: style === 'rich' ? 3 : 1.5,
      strong: strength === 'none' ? 0 : strength === 'light' ? 2 : 3,
    };
    const tagAffinity = Object.fromEntries(tags.map(tag => [tag, 0.5]));
    try {
      await api.recordProfileEvent({
        eventType: 'quiz_answer',
        idempotencyKey: `cold-start:v1:${Date.now()}`,
        payload: {
          constraints: {
            noAlcohol: strength === 'none',
            allergies,
            avoidIngredients: [],
          },
          preferences: { flavor, tagAffinity },
          confidence: { flavor: { sweet: .3, sour: .3, bitter: .3, strong: .3 } },
        },
      });
      await load();
      setSaved('口味画像已初始化。');
    } catch (reason) { setError(errorText(reason)); }
    finally { setQuizBusy(false); }
  };

  const createMemory = async() => {
    if (!content.trim() || busy) return;
    setBusy(true); setMemoryError(''); setSaved('');
    const trimmedAllergies = constraintAllergies.split(/[,，]/).map(v => v.trim()).filter(Boolean);
    const trimmedAvoid = constraintAvoid.split(/[,，]/).map(v => v.trim()).filter(Boolean);
    try {
      await api.createMemoryStatement({
        kind,
        content: kind === 'constraint'
          ? content.trim()
          : content.trim(),
        source: 'structured_ui',
        retentionPolicy: 'explicit',
        constraintPayload: kind === 'constraint' ? {
          constraints: {
            noAlcohol,
            allergies: trimmedAllergies,
            avoidIngredients: trimmedAvoid,
          },
        } : undefined,
      });
      setContent(''); setConstraintAllergies(''); setConstraintAvoid(''); setNoAlcohol(false);
      await load(); setSaved('记忆已保存。');
    } catch (reason) { setMemoryError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const saveSettings = async () => {
    if (!settings || busy) return;
    setBusy(true); setMemoryError(''); setSaved('');
    try { setSettings(await api.saveMemorySettings(settings)); await load(); setSaved('记忆策略已保存。'); }
    catch (reason) { setMemoryError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const removeMemory = async (item: MemoryStatement) => {
    if (!window.confirm(`删除这条记忆？${item.content}`)) return;
    setMemoryError('');
    try { await api.deleteMemoryStatement(item.id); await load(); }
    catch (reason) { setMemoryError(errorText(reason)); }
  };

  const revokeMemory = async (item: MemoryStatement) => {
    setMemoryError('');
    try { await api.revokeMemoryStatement(item.id); await load(); }
    catch (reason) { setMemoryError(errorText(reason)); }
  };

  if (isNative()) {
    return (
      <section className="profile-memory" aria-labelledby="profile-memory-heading">
        <h2 id="profile-memory-heading">画像与记忆</h2>
        <p className="muted">当前版本的记忆管理支持 Web 登录账号。</p>
      </section>
    );
  }

  const constraints = profileValue<import('../types').ProfileConstraints>(profile?.constraints, { noAlcohol:false, allergies:[], avoidIngredients:[], maxAbvLevel:null });
  const preferences = profileValue<import('../types').ProfilePreferences>(profile?.preferences, { flavor:{sweet:2.5,sour:3,bitter:2,strong:2.5}, baseSpirit:{}, tagAffinity:{} });
  const confidence = profileValue<import('../types').ProfileConfidence>(profile?.confidence, { flavor:{sweet:0,sour:0,bitter:0,strong:0} });

  return (
    <section className="profile-memory" aria-labelledby="profile-memory-heading">
      <div className="section-line">
        <div>
          <h2 id="profile-memory-heading">画像与记忆</h2>
          <p className="muted">约束用于硬过滤；偏好用于排序；记忆始终可见、可删除。</p>
        </div>
        <button className="text-button" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {saved && <p className="success" role="status">{saved}</p>}
      {loading && <p className="muted" role="status">正在读取画像与记忆…</p>}

      <div className="profile-grid">
        <article className="profile-card">
          <h3>口味画像</h3>
          {profileMissing ? <p className="muted">还没有画像。可以先完成冷启动问卷。</p> : (
            <>
              <dl className="profile-stats">
                <div><dt>甜</dt><dd>{preferences.flavor.sweet.toFixed(1)}</dd></div>
                <div><dt>酸</dt><dd>{preferences.flavor.sour.toFixed(1)}</dd></div>
                <div><dt>苦</dt><dd>{preferences.flavor.bitter.toFixed(1)}</dd></div>
                <div><dt>烈</dt><dd>{preferences.flavor.strong.toFixed(1)}</dd></div>
              </dl>
              <p className="muted">置信度 {((confidence.flavor.sweet + confidence.flavor.sour + confidence.flavor.bitter + confidence.flavor.strong) / 4 * 100).toFixed(0)}% · 画像版本 {profile?.profileRevision ?? 0}</p>
              <p className="muted">约束：{constraints.noAlcohol ? '无酒精；' : ''}{constraints.allergies.map(labelValue).join('、') || '未填写过敏'}；{constraints.avoidIngredients.join('、') || '无回避原料'}</p>
            </>
          )}
        </article>

        <article className="profile-card">
          <h3>冷启动问卷</h3>
          <p className="muted">只保存你明确选择的结构化信号，不解析聊天内容。</p>
          <fieldset className="quiz-fieldset">
            <legend>口味方向</legend>
            <div className="option-row">
              {[['fresh','清爽'],['sour','偏酸'],['sweet','偏甜'],['rich','浓郁']].map(([value,label]) => (
                <label key={value} className="check-label"><input type="radio" name="profile-style" checked={style===value} onChange={() => setStyle(value as any)} />{label}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="quiz-fieldset">
            <legend>烈度</legend>
            <div className="option-row">
              {[['none','无酒精'],['light','低烈'],['flexible','随意']].map(([value,label]) => (
                <label key={value} className="check-label"><input type="radio" name="profile-strength" checked={strength===value} onChange={() => setStrength(value as any)} />{label}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="quiz-fieldset">
            <legend>过敏 / 忌口</legend>
            <div className="option-row">
              {allergyOptions.map(value => (
                <label key={value} className="check-label"><input type="checkbox" checked={allergies.includes(value)} onChange={() => toggle(allergies,value,setAllergies)} />{labelValue(value)}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="quiz-fieldset">
            <legend>喜欢的香气</legend>
            <div className="option-row">
              {flavorTags.map(value => (
                <label key={value} className="check-label"><input type="checkbox" checked={tags.includes(value)} onChange={() => toggle(tags,value,setTags)} />{value}</label>
              ))}
            </div>
          </fieldset>
          <button className="button secondary" type="button" onClick={() => void submitQuiz()} disabled={quizBusy}>{quizBusy ? '正在保存…' : '保存问卷'}</button>
        </article>
      </div>

      <article className="profile-card memory-manager">
        <h3>记忆列表</h3>
        <div className="memory-list">
          {statements.map(item => (
            <div className={`memory-item status-${item.status}`} key={item.id}>
              <div>
                <span className="memory-kind">{item.kind}</span>
                <p>{item.content}</p>
                <small>{item.source} · {item.retentionPolicy} · {item.status}{item.expiresAt ? ` · ${formatDate(item.expiresAt)} 过期` : ''}</small>
              </div>
              <div className="memory-actions">
                {item.status === 'active' && item.retentionPolicy !== 'explicit' && <button className="text-button" type="button" onClick={() => void revokeMemory(item)}>撤销</button>}
                <button className="text-button danger" type="button" onClick={() => void removeMemory(item)}><Trash2 size={13} />删除</button>
              </div>
            </div>
          ))}
          {!statements.length && !loading && <p className="empty">还没有显式或自动记忆。</p>}
        </div>

        <form className="memory-form" onSubmit={event => { event.preventDefault(); void createMemory(); }}>
          <h4>添加显式记忆</h4>
          <label>类型
            <select value={kind} onChange={event => setKind(event.target.value as MemoryStatement['kind'])}>
              <option value="preference">偏好</option>
              <option value="constraint">约束</option>
              <option value="context">场景</option>
              <option value="goal">目标</option>
            </select>
          </label>
          <label>内容<textarea rows={2} value={content} onChange={event => setContent(event.target.value)} maxLength={1000} required /></label>
          {kind === 'constraint' && (
            <div className="constraint-fields">
              <label className="check-label"><input type="checkbox" checked={noAlcohol} onChange={event => setNoAlcohol(event.target.checked)} />无酒精</label>
              <label>过敏（逗号分隔）<input value={constraintAllergies} onChange={event => setConstraintAllergies(event.target.value)} placeholder="dairy, nuts" /></label>
              <label>回避原料（逗号分隔）<input value={constraintAvoid} onChange={event => setConstraintAvoid(event.target.value)} placeholder="cilantro" /></label>
            </div>
          )}
          {memoryError && <p className="error" role="alert">{memoryError}</p>}
          <button className="button secondary" type="submit" disabled={busy || !content.trim()}>保存记忆</button>
        </form>
      </article>

      {settings && (
        <article className="profile-card">
          <h3><Brain size={16} />自动记忆策略</h3>
          <p className="muted">两个开关默认关闭。打开后，自动记忆仍受白名单和过期时间限制。</p>
          <label className="check-label"><input type="checkbox" checked={settings.allowAutoLowRisk} onChange={event => setSettings({ ...settings, allowAutoLowRisk:event.target.checked })} />允许自动记住低风险口味偏好</label>
          <label>低风险记忆保留天数<input type="number" min={7} max={365} value={settings.lowRiskTtlDays} onChange={event => setSettings({ ...settings, lowRiskTtlDays:Number(event.target.value) })} /></label>
          <label className="check-label"><input type="checkbox" checked={settings.allowTemporaryContext} onChange={event => setSettings({ ...settings, allowTemporaryContext:event.target.checked })} />允许短期记住当前场景</label>
          <label>短期上下文保留天数<input type="number" min={1} max={30} value={settings.temporaryContextTtlDays} onChange={event => setSettings({ ...settings, temporaryContextTtlDays:Number(event.target.value) })} /></label>
          <div className="memory-settings-actions">
            <button className="button secondary" type="button" onClick={() => void saveSettings()} disabled={busy}>保存策略</button>
            <button className="text-button danger" type="button" onClick={async () => {
              if (!window.confirm('清空全部低风险自动记忆？')) return;
              try { const result=await api.clearAutoMemory(); setSaved(`已清空 ${result.deleted} 条。`); await load(); }
              catch(reason) { setMemoryError(errorText(reason)); }
            }}>清空低风险记忆</button>
          </div>
        </article>
      )}
    </section>
  );
}
