import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useTheme } from '../components/ThemeContext';
import { themes } from '../theme';
import type { Settings, AgentTrace } from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [traceError, setTraceError] = useState('');
  const [tracesLoading, setTracesLoading] = useState(true);
  const traceSection = useRef<HTMLElement>(null);
  const selectedTrace = useRef<HTMLDetailsElement>(null);
  const locatedTrace = useRef('');
  const [params] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const traceId = params.get('trace');

  useEffect(() => {
    api.settings().then(setSettings).catch(e => setError(errorText(e)));
    void loadTraces();
  }, []);

  const loadTraces = async () => {
    setTraceError(''); setTracesLoading(true);
    try { setTraces(await api.traces()); } catch (e) { setTraceError(errorText(e)); }
    finally { setTracesLoading(false); }
  };

  useEffect(() => {
    if (!traceId || tracesLoading || locatedTrace.current === traceId) return;
    // Wait for settings too: otherwise the form arriving later shifts the target.
    if (!settings && !error) return;
    const target = selectedTrace.current ?? traceSection.current;
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
    locatedTrace.current = traceId;
  }, [traceId, tracesLoading, settings, error]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!settings || busy) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await api.saveSettings({ name: settings.name, preferences: settings.preferences, model: settings.model, baseUrl: settings.baseUrl, apiKey: clearKey ? '' : key.trim() || null });
      setSettings(result); setKey(''); setClearKey(false); setSaved(true);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <section>
      <header className="page-header">
        <span className="eyebrow">A FEW THINGS ABOUT YOU</span>
      </header>
      {error && <div className="error" role="alert">{error}</div>}


      {settings && (
        <form className="form settings-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend className="sr-only">个人偏好和模型设置</legend>
            <h2 className="form-heading">连接聊天模型</h2>
            <p className="notice">{settings.apiKeyConfigured ? '已保存模型配置，可以回到聊天开始对话。' : '未配置模型时可使用本地酒单推荐；填写 API Key 后开启智能陪聊。'}</p>
            <p className="muted helper">使用支持工具调用的兼容 API。聊天和必要的酒单上下文会发送给你选择的模型服务商。</p>
            <label>API 地址<input required type="url" value={settings.baseUrl} onChange={e => { setSaved(false); setSettings({ ...settings, baseUrl: e.target.value }); }} /></label>
            <label>模型名称<input required maxLength={120} value={settings.model} placeholder="例如 qwen-plus" onChange={e => { setSaved(false); setSettings({ ...settings, model: e.target.value }); }} /></label>
            <label>API Key <small>{settings.apiKeyConfigured ? '已保存；留空则保持不变' : '尚未配置'}</small><input type="password" autoComplete="new-password" value={key} disabled={clearKey} placeholder={settings.apiKeyConfigured ? '输入新密钥以替换' : '填写你的 API Key'} onChange={e => { setSaved(false); setKey(e.target.value); }} /></label>
            {settings.apiKeyConfigured && <label className="check-label"><input type="checkbox" checked={clearKey} onChange={e => { setSaved(false); setClearKey(e.target.checked); }} />移除已保存的密钥</label>}
            <h2 className="form-heading">关于你</h2>
            <label>怎么称呼你<input value={settings.name} maxLength={60} placeholder="你的名字或昵称" onChange={e => { setSaved(false); setSettings({ ...settings, name: e.target.value }); }} /></label>
            <label>你喜欢的味道与风格<textarea rows={4} maxLength={2000} value={settings.preferences} placeholder="例如：偏爱柑橘和茶香，少糖，不喜欢奶油。" onChange={e => { setSaved(false); setSettings({ ...settings, preferences: e.target.value }); }} /></label>
            <div className="form-actions">
              <button className="button" disabled={busy}>{busy ? '正在保存…' : '保存设置'}</button>
              {saved && <span className="success" role="status">已保存，下次聊天会使用新设置。</span>}
            </div>
          </fieldset>
          <p className="data-note">菜单、库存、偏好与聊天保存在这台设备。密钥保存在本地独立文件中。<br /><span>{settings.dataDirectory}</span></p>
        </form>
      )}

      <section className="appearance" aria-labelledby="appearance-heading">
        <h2 className="form-heading" id="appearance-heading">外观主题</h2>
        <p className="muted helper">换一套颜色，像换一盏灯。主题即时生效，只保存在这台设备。</p>
        <div className="theme-options" role="radiogroup" aria-label="主题">
          {themes.map((t, index) => {
            const Icon = t.icon;
            return (
              <button key={t.id} id={`theme-${t.id}`} type="button" role="radio" aria-checked={theme === t.id} tabIndex={theme === t.id ? 0 : -1} className="theme-option" onClick={() => setTheme(t.id)} onKeyDown={e => {
                if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? themes.length - 1 : (index + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) + themes.length) % themes.length;
                setTheme(themes[next].id); document.getElementById(`theme-${themes[next].id}`)?.focus();
              }}>
                <span className="theme-swatch" data-theme-preview={t.id} aria-hidden="true" />
                <span className="theme-name"><Icon size={15} strokeWidth={1.6} />{t.name}</span>
                <small>{t.hint}</small>
              </button>
            );
          })}
        </div>
      </section>


      <section className="traces" ref={traceSection} tabIndex={-1} aria-label="对话链路">
        <div className="section-line">
          <div>
            <h2>对话链路</h2>
            <p className="muted">最近 100 轮的调用与耗时；不记录密钥或完整模型请求。</p>
          </div>
          <button className="text-button" disabled={tracesLoading} onClick={() => void loadTraces()}>{tracesLoading ? '加载中…' : '刷新'}</button>
        </div>
        {traceError && <p className="error" role="alert">{traceError}</p>}
        {traceId && !tracesLoading && !traceError && !traces.some(t => t.id === traceId) && <p className="notice" role="status">这轮链路已不在最近 100 条记录中，或已被清理。聊天记录仍可保留。</p>}
        {!traces.length && !traceError && !tracesLoading && !traceId && <p className="empty">开始聊天后，每轮调用会出现在这里。</p>}
        {traces.map(t => (
          <details className={`trace ${traceId === t.id ? 'trace-selected' : ''}`} ref={traceId === t.id ? selectedTrace : undefined} tabIndex={-1} key={t.id} open={traceId === t.id ? true : undefined}>
            <summary>
              <span className={`trace-status ${t.status === 'error' ? 'danger' : 'success'}`}>{t.status === 'local' ? '本地完成' : t.status === 'ok' ? '完成' : '失败'}</span>
              <time>{new Date(t.startedAt * 1000).toLocaleString()}</time>
              <span>{(t.durationMs / 1000).toFixed(2)} s</span>
            </summary>
            <code>{t.id}</code>
            <ol>{t.events.map((event, i) => <li key={i}><span className="trace-time">+{event.elapsedMs} ms</span><strong>{event.phase}</strong><p>{event.detail}</p></li>)}</ol>
            {t.error && <p className="error">{t.error}</p>}
          </details>
        ))}
      </section>
    </section>
  );
}
