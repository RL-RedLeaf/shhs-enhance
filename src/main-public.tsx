import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import { antdTheme, zhCN } from './theme'
import { MetadataProvider } from './lib/meta'
import './styles.css'
import { AppPublic } from './App-public'

createRoot(document.getElementById('root')!).render(
  <ConfigProvider theme={antdTheme} locale={zhCN} button={{ autoInsertSpace: false }}>
    <AntApp>
      <MetadataProvider>
        <AppPublic />
      </MetadataProvider>
    </AntApp>
  </ConfigProvider>,
)
