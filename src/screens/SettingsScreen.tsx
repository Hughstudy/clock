import { PHASE_LABELS } from '../components/format'
import type { SettingsForm } from '../hooks/useSettingsForm'
import { useMotionPreference } from '../hooks/companion/useMotionPreference'

interface Props {
  form: SettingsForm
  /** False while saved data is shown read-only. */
  canEdit: boolean
}

export function SettingsScreen({ form, canEdit }: Props) {
  const { systemReducedMotion } = useMotionPreference(form.motionEnabled)
  return (
    <section className="screen settings" aria-labelledby="settings-title">
      <h2 id="settings-title" className="screen-title">
        设置
      </h2>
      <form className="card settings-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset disabled={!canEdit}>
          <legend className="card-title">计时时长（分钟）</legend>
          {form.fields.map((field) => {
            const id = `duration-${field.phase}`
            const errorId = `${id}-error`
            return (
              <div className="field" key={field.phase}>
                <label htmlFor={id}>{PHASE_LABELS[field.phase]}</label>
                <div className="stepper">
                  <button
                    type="button"
                    className="step"
                    aria-label={`减少${PHASE_LABELS[field.phase]}分钟数`}
                    disabled={field.value <= field.min}
                    onClick={() => field.step(-1)}
                  >
                    −
                  </button>
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    step={1}
                    value={field.draft}
                    aria-invalid={field.error ? true : undefined}
                    aria-describedby={field.error ? errorId : undefined}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                  />
                  <button
                    type="button"
                    className="step"
                    aria-label={`增加${PHASE_LABELS[field.phase]}分钟数`}
                    disabled={field.value >= field.max}
                    onClick={() => field.step(1)}
                  >
                    +
                  </button>
                </div>
                {field.error && (
                  <p id={errorId} className="field-error">
                    {field.error}仍按 {field.value} 分钟保存。
                    <button type="button" className="link-button" onClick={field.restorePrevious}>
                      恢复为 {field.value} 分钟
                    </button>
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>

        <label className="switch-row">
          <span>到时提示音</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            disabled={!canEdit}
            checked={form.soundEnabled}
            onChange={(e) => form.setSoundEnabled(e.target.checked)}
          />
        </label>

        <label className="switch-row">
          <span>伙伴动画</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            disabled={!canEdit}
            checked={form.motionEnabled}
            aria-describedby="motion-hint"
            onChange={(e) => form.setMotionEnabled(e.target.checked)}
          />
        </label>
        <p id="motion-hint" className="hint">
          {systemReducedMotion
            ? '系统已开启减少动态，伙伴会保持静态，鼓励与功能照常。'
            : '关闭后，伙伴用静态表情陪你，鼓励与功能照常。'}
        </p>

        <label className="switch-row">
          <span>伙伴小场景</span>
          <input type="checkbox" role="switch" className="switch" disabled={!canEdit}
            checked={form.sceneVarietyEnabled} aria-describedby="scene-hint"
            onChange={(e) => form.setSceneVarietyEnabled(e.target.checked)} />
        </label>
        <p id="scene-hint" className="hint">所有小活动都可直接出现，每段随机轮换。关闭后保留伙伴和记录；减少动态时展示静态画面。</p>

        <label className="switch-row">
          <span>节点鼓励</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            disabled={!canEdit}
            checked={form.encouragementEnabled}
            aria-describedby="encouragement-hint"
            onChange={(e) => form.setEncouragementEnabled(e.target.checked)}
          />
        </label>
        <p id="encouragement-hint" className="hint">
          {form.encouragementEnabled
            ? '开始、暂停、结束等时刻会附上一句鼓励。'
            : '开始、暂停、结束时只显示状态；点伙伴仍可要一句鼓励。'}
        </p>

        <p className="hint">时长更改从下一段开始生效。单次选择的时长不会改变这里的默认值。</p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canEdit || form.isDefault}
          onClick={form.restoreDefaults}
        >
          恢复默认时长
        </button>
      </form>

      <div className="card info">
        <h3 className="card-title">你的数据</h3>
        <p>
          记录只保存在当前设备的这个浏览器里。清除网站数据、隐私浏览或浏览器清理可能使记录丢失。
          添加到主屏幕的应用可能单独保存数据，不会自动同步。
        </p>
      </div>

      <div className="card info">
        <h3 className="card-title">添加到主屏幕</h3>
        <p>
          <strong>iPhone：</strong>用 Safari 打开，点分享，选择“添加到主屏幕”，再点“添加”。
        </p>
        <p>
          <strong>Android：</strong>在 Chrome 中打开 ⋮ 菜单，选择“添加到主屏幕”或“安装应用”。
        </p>
      </div>

      <div className="card info">
        <h3 className="card-title">关于伙伴与素材</h3>
        <p>
          现在的蓝色小伙伴是原创造型原型，正式名称与品牌仍在探索。
          安装图标等保留的旧 Whale-chan 素材是代码绘制的非商业同人设计，灵感来自社区的 DeepSeek Whale-chan
          （设计者 ZipZipPipe 和上善无形），未使用第三方同人图片。本应用与 DeepSeek 无隶属或背书关系。
        </p>
      </div>
    </section>
  )
}
