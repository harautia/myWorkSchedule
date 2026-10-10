import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NewPasswordFields from './NewPasswordFields'
import TimezoneSelect from './TimezoneSelect'
import TurnstileWidget from './TurnstileWidget'
import signupService from '../services/signup'
import { setLanguage } from '../i18n'
import { LANGUAGES, browserCountry, browserTimezone, countryOptions, errorMessage } from '../utils/forms'

// Self-service sign-up (spec SIGN-01-02): the owner's account and their bar.
// turnstileSiteKey: the bot check to show, or null when the server has none.
const SignupPage = ({ turnstileSiteKey, onSignup, onCancel }) => {
  const { t, i18n } = useTranslation()
  const [owner, setOwner] = useState({ name: '', email: '' })
  const [passwords, setPasswords] = useState({ password: '', repeat: '' })
  const [bar, setBar] = useState(() => ({
    barName: '',
    country: browserCountry(),
    timezone: browserTimezone(),
    opensAt: '10:00',
    closesAt: '02:00',
    locale: i18n.language
  }))
  const [captchaToken, setCaptchaToken] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const countries = useMemo(() => countryOptions(i18n.language), [i18n.language])

  const setOwnerField = (field) => (event) => setOwner({ ...owner, [field]: event.target.value })
  const setBarField = (field) => (event) => setBar({ ...bar, [field]: event.target.value })

  // The form follows the language chosen for the bar.
  const handleLanguage = (event) => {
    setBar({ ...bar, locale: event.target.value })
    setLanguage(event.target.value)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (passwords.password !== passwords.repeat) return setError(t('links.passwordsDiffer'))
    if (turnstileSiteKey && !captchaToken) return setError(t('signup.botCheck'))
    setSaving(true)
    setError(null)
    try {
      onSignup(await signupService.signup({ ...owner, password: passwords.password, ...bar, captchaToken }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card signup-card" onSubmit={handleSubmit} aria-label={t('signup.title')}>
        <img src="/App-logo.png" alt="" width="48" height="48" />
        <h1>{t('signup.title')}</h1>
        <p className="field-hint">{t('signup.intro')}</p>

        <fieldset className="form-section">
          <legend>{t('signup.you')}</legend>
          <label className="form-field">
            {t('signup.name')}
            <input value={owner.name} onChange={setOwnerField('name')} maxLength={100} autoComplete="name" autoFocus required />
          </label>
          <label className="form-field">
            {t('login.email')}
            <input type="email" value={owner.email} onChange={setOwnerField('email')} autoComplete="email" required />
          </label>
          <NewPasswordFields value={passwords} onChange={setPasswords} autoFocus={false} />
        </fieldset>

        <fieldset className="form-section">
          <legend>{t('signup.yourBar')}</legend>
          <label className="form-field">
            {t('signup.barName')}
            <input value={bar.barName} onChange={setBarField('barName')} maxLength={100} autoComplete="organization" required />
          </label>
          <label className="form-field">
            {t('signup.country')}
            <select value={bar.country} onChange={setBarField('country')} autoComplete="country" required>
              <option value="">{t('signup.chooseCountry')}</option>
              {countries.map(({ code, name }) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </label>
          <TimezoneSelect value={bar.timezone} onChange={(timezone) => setBar({ ...bar, timezone })} />
          <div className="form-grid">
            <label className="form-field">
              {t('barSettings.opens')}
              <input type="time" value={bar.opensAt} onChange={setBarField('opensAt')} required />
            </label>
            <label className="form-field">
              {t('barSettings.closes')}
              <input type="time" value={bar.closesAt} onChange={setBarField('closesAt')} required />
            </label>
          </div>
          <label className="form-field">
            {t('barSettings.language')}
            <select value={bar.locale} onChange={handleLanguage}>
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </label>
          <p className="field-hint">{t('signup.changeLater')}</p>
        </fieldset>

        {turnstileSiteKey && (
          <TurnstileWidget siteKey={turnstileSiteKey} language={bar.locale} onToken={setCaptchaToken} />
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('signup.creating') : t('signup.submit')}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          {t('signup.haveAccount')}
        </button>
      </form>
    </main>
  )
}

export default SignupPage
