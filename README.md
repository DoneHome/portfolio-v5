# 持仓总览 v5

个人投资组合管理与复盘工具，专注于投资框架的形成与进化。

## 🎯 产品定位

**不是记账工具，而是投资复盘系统**

帮助用户：
- 记录每笔交易的决策理由
- 追踪投资框架的进化轨迹
- 发现隐藏的行为模式
- 形成稳定的投资风格

## ✨ 核心功能

### 1. 持仓总览
- **总资产**：实时计算所有持仓市值（含现金）
- **年化收益**：基于年初资产计算收益率
- **仓位管理**：股票/ETF/现金等价物分布
- **目标进度**：三年投资目标追踪

### 2. 持仓明细
- **权益类**：美股/港股股票持仓
- **ETF**：指数基金持仓
- **现金等价物**：货币基金、现金
- **市场筛选**：全部/美股/港股

### 3. 数据展示
- **成本价**：买入均价
- **现价**：实时市场价格（API获取）
- **盈亏**：浮动盈亏金额与百分比
- **占比**：持仓占比

### 4. 机会与风险
- **加仓机会**：亏损超过5%的持仓
- **集中度风险**：单票占比超过15%预警
- **行业风险**：科技股占比过高提示

### 5. 交易录入
- 买入/卖出交易记录
- 自动更新持仓成本
- 支持美股、港股、ETF

## 🏗️ 技术架构

### 前端技术栈
- **HTML5 + Tailwind CSS**：响应式界面
- **原生 JavaScript**：无框架依赖
- **IndexedDB**：本地数据持久化

### 项目结构
```
portfolio-v5/
├── index.html              # 主页面
├── css/
│   └── style.css          # 自定义样式
├── js/
│   ├── api.js             # TradingDataHub API 封装
│   ├── calculator-v2.js   # 持仓计算逻辑
│   ├── renderer.js        # 页面渲染
│   ├── indexeddb.js       # IndexedDB 数据库操作
│   ├── main.js            # 主程序逻辑
│   ├── snapshot.js        # 快照功能
│   └── github-backup.js   # GitHub 备份
├── api.py                  # 本地 API 服务（可选）
└── api_server.py          # 生产 API 服务
```

### 数据流
```
页面加载
    ↓
IndexedDB 获取持仓数据
    ↓
TradingDataHub API 批量查询股价
    ↓
汇率换算（USD/HKD → CNY）
    ↓
计算指标（盈亏、占比、仓位）
    ↓
渲染页面
    ↓
每5分钟自动刷新
```

### 核心数据模型

#### 持仓 (Position)
```javascript
{
  symbol: string,          // 股票代码
  name: string,            // 股票名称
  market: '美股' | '港股',  // 市场
  type: 'equity' | 'etf' | 'cash_equivalent',
  shares: number,          // 持仓数量
  cost_price: number,      // 成本价
  currency: 'USD' | 'HKD' | 'CNY'
}
```

#### 交易记录 (Transaction)
```javascript
{
  id: number,
  symbol: string,
  direction: 'buy' | 'sell',
  quantity: number,
  price: number,
  trade_date: string,
  created_at: string
}
```

#### 快照 (Snapshot)
```javascript
{
  id: number,
  date: string,            // 快照日期
  snapshot_type: string,   // 快照类型
  total_assets: number,    // 总资产
  total_pnl: number,       // 总盈亏
  holdings: []             // 持仓明细
}
```

## 🔌 API 集成

### TradingDataHub
提供实时股价与汇率数据：

- `POST /api/stock/quotes` - 批量查询股票价格
- `GET /api/stock/quote/{symbol}` - 单只股票查询
- `GET /api/forex/rates/common` - 常用汇率查询
- `GET /api/health` - 健康检查

### 本地 API 服务（可选）
```bash
python api_server.py
# 运行在 http://localhost:8005
```

## 🚀 快速开始

### 1. 启动 TradingDataHub
```bash
cd tradingdatahub
conda activate tradingdatahub
python run.py
```

### 2. 打开前端页面
```bash
cd portfolio-v5
python -m http.server 8080
```
访问：http://localhost:8080

### 3. 初始化数据
首次打开会自动初始化示例持仓数据。

## 💾 数据管理

### 本地存储
使用 IndexedDB 持久化存储：
- 持仓数据
- 交易记录
- 快照历史
- 现金管理

### GitHub 备份
支持自动备份到 GitHub Gist：
1. 配置 GitHub Token
2. 设置仓库信息
3. 自动定时备份

### 数据重置
访问 `reset_db.html` 清空所有数据。

## 🎨 设计原则

### 1. 克制
- 只展示关键信息
- 避免数据过载
- 每个元素都有明确目的

### 2. 清晰
- 成本视角优先
- 盈亏一目了然
- 风险提示醒目

### 3. 实用
- 快速录入交易
- 自动计算指标
- 支持复盘分析

## 🐛 错误处理

### API 失败
- 3次重试机制
- 显示上次成功数据
- 错误提示 Toast

### 数据缺失
- 股价获取失败显示 "--"
- 不影响其他数据展示
- 自动恢复重试

## 📈 未来规划

### 短期
- [ ] 年度盈亏 Top3 统计
- [ ] 投资框架标签系统
- [ ] 决策理由记录

### 中期
- [ ] 快照对比分析
- [ ] 行为模式发现
- [ ] 框架进化追踪

### 长期
- [ ] 多账户支持
- [ ] 高级风险指标
- [ ] 移动端 App

## 🤝 贡献

- **浩哥**：产品需求、投资逻辑
- **布尔玛**：技术实现、架构设计

## 📄 许可证

MIT License

---

**版本**: v1.1.0  
**最后更新**: 2026-04-08  
**状态**: ✅ 持续迭代中