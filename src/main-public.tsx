import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import { antdTheme, zhCN } from './theme'
import { MetadataProvider } from './lib/meta'
import './styles.css'
import { AppPublic } from './App-public'

const DEMO = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEMO === '1'

function boot() {
  createRoot(document.getElementById('root')!).render(
    <ConfigProvider theme={antdTheme} locale={zhCN} button={{ autoInsertSpace: false }}>
      <AntApp>
        <MetadataProvider>
          <AppPublic />
        </MetadataProvider>
      </AntApp>
    </ConfigProvider>,
  )
}

if (DEMO) {
  // 演示版：用本地快照数据接管 /api/*，再接载应用
  import('./lib/demo').then(({ installDemo }) => { installDemo(); boot() })
} else {
  boot()
}
