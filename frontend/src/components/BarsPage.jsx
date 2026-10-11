import { useState } from 'react'
import BarDetail from './admin/BarDetail'
import BarList from './admin/BarList'
import NewBarForm from './admin/NewBarForm'
import PeopleSection from './admin/PeopleSection'

// adminGroup: every organization and bar that uses the service, and managing
// each bar. hosted: show subscriptions. onSupport: a bar was opened in support
// mode.
// view = { name: 'list', notice? } | { name: 'new' } | { name: 'bar', barId }
const BarsPage = ({ hosted = false, onSupport }) => {
  const [view, setView] = useState({ name: 'list' })
  const showList = () => setView({ name: 'list' })
  const openBar = (barId) => setView({ name: 'bar', barId })
  const showDeleted = (notice) => setView({ name: 'list', notice })

  if (view.name === 'new') return <NewBarForm onCreated={openBar} onCancel={showList} />
  if (view.name === 'bar') {
    return <BarDetail key={view.barId} barId={view.barId} onBack={showList} onDeleted={showDeleted} onSupport={onSupport} />
  }
  return (
    <>
      <BarList notice={view.notice} onOpen={openBar} onNew={() => setView({ name: 'new' })} hosted={hosted} />
      <PeopleSection />
    </>
  )
}

export default BarsPage
