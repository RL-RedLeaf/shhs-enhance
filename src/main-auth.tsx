import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import { antdTheme, zhCN } from './theme'
import './styles.css'
import { AppAuth } from './App-auth'

createRoot(document.getElementById('auth-root')!).render(
  <ConfigProvider theme={antdTheme} locale={zhCN} button={{ autoInsertSpace: false }}>
    <AntApp>
      <AppAuth />
    </AntApp>
  </ConfigProvider>,
)
