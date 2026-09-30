import { useState } from 'react'
import BarDetail from './admin/BarDetail'
import BarList from './admin/BarList'
import NewBarForm from './admin/NewBarForm'

// adminGroup: every bar that uses the service, and managing each bar.
// view = { name: 'list', notice? } | { name: 'new' } | { name: 'bar', barId }
const BarsPage = () => {
  const [view, setView] = useState({ name: 'list' })
  const showList = () => setView({ name: 'list' })
  const openBar = (barId) => setView({ name: 'bar', barId })
  const showDeleted = (notice) => setView({ name: 'list', notice })

  if (view.name === 'new') return <NewBarForm onCreated={openBar} onCancel={showList} />
  if (view.name === 'bar') return <BarDetail key={view.barId} barId={view.barId} onBack={showList} onDeleted={showDeleted} />
  return <BarList notice={view.notice} onOpen={openBar} onNew={() => setView({ name: 'new' })} />
}

export default BarsPage
