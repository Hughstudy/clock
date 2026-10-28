import { PHASE_LABELS } from '../components/format'
import type { SettingsForm } from '../hooks/useSettingsForm'

interface Props {
  form: SettingsForm
  /** False while saved data is shown read-only. */
  canEdit: boolean
}

export function SettingsScreen({ form, canEdit }: Props) {
  return (
    <section className="screen settings" aria-labelledby="settings-title">
      <h2 id="settings-title" className="screen-title">
        Settings
      </h2>
      <form className="card settings-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset disabled={!canEdit}>
          <legend className="card-title">Durations (minutes)</legend>
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
                    aria-label={`Decrease ${PHASE_LABELS[field.phase].toLowerCase()} minutes`}
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
                    aria-label={`Increase ${PHASE_LABELS[field.phase].toLowerCase()} minutes`}
                    disabled={field.value >= field.max}
                    onClick={() => field.step(1)}
                  >
                    +
                  </button>
                </div>
                {field.error && (
                  <p id={errorId} className="field-error">
                    {field.error}
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>

        <label className="switch-row">
          <span>Completion sound</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            disabled={!canEdit}
            checked={form.soundEnabled}
            onChange={(e) => form.setSoundEnabled(e.target.checked)}
          />
        </label>

        <p className="hint">Changes apply to the next session you start.</p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canEdit || form.isDefault}
          onClick={form.restoreDefaults}
        >
          Restore default durations
        </button>
      </form>

      <div className="card info">
        <h3 className="card-title">Your data</h3>
        <p>
          Sessions are saved only in this browser on this device. Clearing site data or private browsing can erase
          them, and an app added to the home screen may keep its own separate copy.
        </p>
      </div>

      <div className="card info">
        <h3 className="card-title">Add to your home screen</h3>
        <p>
          <strong>iPhone:</strong> open this page in Safari, tap Share, choose Add to Home Screen, then tap Add.
        </p>
        <p>
          <strong>Android:</strong> in Chrome, open the ⋮ menu and choose Add to Home screen or Install app.
        </p>
      </div>

      <div className="card info">
        <h3 className="card-title">About Whale-chan</h3>
        <p>
          Whale-chan is a fan-made, non-commercial character inspired by the community’s DeepSeek Whale-chan, whose
          designs come from ZipZipPipe and 上善无形. She is drawn in code for this app; no fan art is included.
          Whale Focus is not affiliated with or endorsed by DeepSeek.
        </p>
      </div>
    </section>
  )
}
