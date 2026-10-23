import type { ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'

// 设计 token 全部来自原站手写 CSS（_probe/style-BV4c9Wvh.css），逐值映射进 antd。
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#164d3d',
    colorInfo: '#164d3d',
    colorSuccess: '#164d3d',
    colorError: '#86493b',
    colorWarning: '#a48838',
    colorText: '#252d29',
    colorTextSecondary: '#66716b',
    colorTextTertiary: '#727b75',
    colorTextQuaternary: '#b9c1bc',
    colorBorder: '#bfcac3',
    colorBorderSecondary: '#d7ddd9',
    colorBgLayout: '#fff',
    colorBgContainer: '#fff',
    colorBgTextHover: '#eef3ee',
    colorLink: '#164d3d',
    borderRadius: 4,
    fontSize: 15,
    controlHeight: 40,
    fontFamily: "Inter, 'Microsoft YaHei', system-ui, sans-serif",
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    Card: { headerFontSize: 17 },
    Select: { optionSelectedBg: '#eef3ee' },
    Table: { headerBg: '#f4f6f3', rowHoverBg: '#f7f9f6' },
    Form: { labelFontSize: 14 },
  },
}

export { zhCN }
