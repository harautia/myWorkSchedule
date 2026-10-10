import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import barService from '../services/bar'

// The steps of getting a new bar going (spec SIGN-05), for managers. Each step
// is ticked from the bar's data. onGo(page) opens the page for a step.
const STEPS = [
  { key: 'invite', page: 'employees' },
  { key: 'plan', page: 'schedule' },
  { key: 'lock', page: 'schedule' }
]

const OnboardingChecklist = ({ onGo }) => {
  const { t } = useTranslation()
  const [steps, setSteps] = useState(null)

  useEffect(() => {
    // Without it (e.g. offline) the checklist is simply not shown.
    barService.getOnboarding().then(setSteps).catch(() => {})
  }, [])

  if (!steps || steps.dismissed) return null

  const handleDismiss = async () => {
    setSteps({ ...steps, dismissed: true })
    await barService.dismissOnboarding().catch(() => {})
  }

  const allDone = STEPS.every(({ key }) => steps[key])
  const next = STEPS.find(({ key }) => !steps[key])?.key

  return (
    <section className="onboarding" aria-label={t('onboarding.title')}>
      <h2>{allDone ? t('onboarding.allDone') : t('onboarding.title')}</h2>
      <ol>
        {STEPS.map(({ key, page }) => (
          <li key={key} className={steps[key] ? 'is-done' : undefined}>
            <span className="onboarding-mark" aria-hidden="true">{steps[key] ? '✓' : ''}</span>
            <span>
              {t(`onboarding.${key}`)}
              {steps[key] && <span className="visually-hidden"> ({t('onboarding.done')})</span>}
            </span>
            {key === next && (
              <button type="button" className="link-button" onClick={() => onGo(page)}>
                {t(`onboarding.go.${key}`)}
              </button>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="link-button" onClick={handleDismiss}>
        {allDone ? t('onboarding.close') : t('onboarding.hide')}
      </button>
    </section>
  )
}

export default OnboardingChecklist
