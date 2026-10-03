const VIEW_LABELS = {
  mine: 'My shifts',
  week: 'Week',
  month: 'Month'
}

const CalendarToolbar = ({ label, view, views = ['week', 'month'], onViewChange, onPrev, onNext, onToday }) => (
  <div className="calendar-toolbar">
    <div className="toolbar-group">
      <button type="button" className="btn btn-nav" onClick={onPrev} aria-label="Previous">
        ‹
      </button>
      <button type="button" className="btn btn-nav" onClick={onToday}>
        Today
      </button>
      <button type="button" className="btn btn-nav" onClick={onNext} aria-label="Next">
        ›
      </button>
    </div>
    <h2 className="calendar-label">{label}</h2>
    <div className="toolbar-group segmented" role="group" aria-label="Calendar view">
      {views.map((key) => (
        <button
          key={key}
          type="button"
          className={`btn btn-nav${view === key ? ' is-active' : ''}`}
          aria-pressed={view === key}
          onClick={() => onViewChange(key)}
        >
          {VIEW_LABELS[key]}
        </button>
      ))}
    </div>
  </div>
)

export default CalendarToolbar
