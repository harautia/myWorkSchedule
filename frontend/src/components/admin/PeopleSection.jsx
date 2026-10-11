import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import adminService, { personExportUrl } from '../../services/admin'
import { errorMessage } from '../../utils/forms'
import { groupLabel } from '../../i18n/labels'

const ROLE_GROUPS = { owner: 'managerGroup', manager: 'managerGroup', employee: 'employeeGroup' }

// Personal data requests (spec DATA-04, GDPR): find a person by email,
// download everything stored about them, or erase them. Erasing deletes the
// account and anonymises their name on schedules; their shifts stay.
const PeopleSection = () => {
  const { t } = useTranslation()
  const [address, setAddress] = useState('')
  const [person, setPerson] = useState(null)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSearch = async (event) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setPerson(null)
    try {
      setPerson(await adminService.findPerson(address.trim()))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const handleErase = async () => {
    if (!window.confirm(t('people.eraseConfirm', { name: person.name, email: person.email }))) return
    setBusy(true)
    setError(null)
    try {
      await adminService.erasePerson(person.id)
      setNotice(t('people.erased', { email: person.email }))
      setPerson(null)
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  return (
    <section className="card" aria-label={t('people.title')}>
      <h3 className="card-title">{t('people.title')}</h3>
      <p className="field-hint">{t('people.hint')}</p>
      <form className="input-with-button" onSubmit={handleSearch}>
        <input type="email" value={address} onChange={(event) => setAddress(event.target.value)} aria-label={t('login.email')} placeholder={t('login.email')} required />
        <button type="submit" className="btn btn-nav">{t('people.find')}</button>
      </form>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {person && (
        <div className="person-result">
          <p>
            <strong>{person.name}</strong> ({person.email})
            {person.bars.length > 0 && ': '}
            {person.bars.map((bar) => `${bar.name} – ${groupLabel(t, ROLE_GROUPS[bar.role])}`).join(', ')}
          </p>
          <div className="form-actions">
            <a className="btn btn-nav" href={personExportUrl(person.id)} download>{t('people.export')}</a>
            {!person.isAdmin && (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={handleErase}>{t('people.erase')}</button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default PeopleSection
