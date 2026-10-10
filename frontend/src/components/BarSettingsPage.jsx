import { useState } from 'react'
import BarFields from './admin/BarFields'
import barService from '../services/bar'
import { barSettings, errorMessage } from '../utils/forms'

// managerGroup: the settings of the manager's own bar. onSaved(bar) applies
// the saved settings to the whole app.
const BarSettingsPage = ({ bar, onSaved }) => {
  const [form, setForm] = useState(() => barSettings(bar))
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      onSaved(await barService.updateBar(form))
      setNotice('Settings saved')
    } catch (err) {
      setError(errorMessage(err))
    }
    setSaving(false)
  }

  return (
    <section>
      <h2 className="page-title">Bar settings</h2>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <form className="card" onSubmit={handleSubmit} aria-label="Bar settings">
        <BarFields value={form} onChange={setForm} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default BarSettingsPage
