import { useTranslation } from 'react-i18next'

const CalendarToolbar = ({ label, view, views = ['week', 'month'], onViewChange, onPrev, onNext, onToday }) => {
  const { t } = useTranslation()
  return (
    <div className="calendar-toolbar">
      <div className="toolbar-group">
        <button type="button" className="btn btn-nav" onClick={onPrev} aria-label={t('calendar.previous')}>
          ‹
        </button>
        <button type="button" className="btn btn-nav" onClick={onToday}>
          {t('calendar.today')}
        </button>
        <button type="button" className="btn btn-nav" onClick={onNext} aria-label={t('calendar.next')}>
          ›
        </button>
      </div>
      <h2 className="calendar-label">{label}</h2>
      <div className="toolbar-group segmented" role="group" aria-label={t('calendar.viewsLabel')}>
        {views.map((key) => (
          <button
            key={key}
            type="button"
            className={`btn btn-nav${view === key ? ' is-active' : ''}`}
            aria-pressed={view === key}
            onClick={() => onViewChange(key)}
          >
            {t(`calendar.views.${key}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CalendarToolbar
