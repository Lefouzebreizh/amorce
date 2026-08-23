import { useEffect } from 'react'
import { useStore } from './state/store'
import { TopBar } from './components/TopBar'
import { IconRail } from './components/IconRail'
import { LibraryPanel } from './components/LibraryPanel'
import { HooksPanel } from './components/HooksPanel'
import { AudioPanel } from './components/AudioPanel'
import { ExportPanel } from './components/ExportPanel'
import { PreviewStage } from './components/PreviewStage'
import { HookScorePanel } from './components/HookScorePanel'
import { Timeline } from './components/Timeline'
import { Toast } from './components/Toast'

export default function App() {
  const hydrate = useStore((s) => s.hydrate)
  const hydrated = useStore((s) => s.hydrated)
  const panel = useStore((s) => s.panel)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="app" data-ready={hydrated}>
      <TopBar />

      <div className="app__body">
        <IconRail />

        <div className="app__side">
          {panel === 'library' ? <LibraryPanel /> : null}
          {panel === 'hooks' ? <HooksPanel /> : null}
          {panel === 'audio' ? <AudioPanel /> : null}
          {panel === 'export' ? <ExportPanel /> : null}
        </div>

        <PreviewStage />
        <HookScorePanel />
      </div>

      <Timeline />
      <Toast />
    </div>
  )
}
