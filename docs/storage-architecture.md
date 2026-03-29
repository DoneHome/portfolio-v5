# Portfolio-V5 技术架构文档

> 版本：v5.0  
> 更新日期：2026-03-28  
> 架构：纯前端 IndexedDB + TradingDataHub API + GitHub 自动备份

---

## 一、整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              浏览器 (前端)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   页面展示    │  │  IndexedDB   │  │ GitHub备份   │  │  定时任务    │ │
│  │  (index.html)│  │  (本地存储)   │  │  (自动同步)   │  │ (24:00快照) │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │         │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                                    │                                    │
│                              前端业务逻辑                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  main.js │ │db.js     │ │indexeddb │ │github-   │ │snapshot. │     │
│  │(主程序)  │ │(API封装) │ │.js      │ │backup.js│ │js        │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │            │            │            │            │            │
└───────┼────────────┼────────────┼────────────┼────────────┼────────────┘
        │            │            │            │            │
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           外部服务层                                     │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│  │   TradingDataHub        │      │          GitHub                  │  │
│  │   (端口: 8005)          │      │   (数据备份仓库)                  │  │
│  │  - 股票实时价格          │      │   - data/positions.json          │  │
│  │  - 汇率查询              │      │   - data/transactions.json       │  │
│  │  - 批量查询              │      │   - snapshots/2026/03/28.json    │  │
│  └─────────────────────────┘      │   - snapshots/2026/03/week-13    │  │
│                                    │   - snapshots/2026/03/month-03   │  │
│                                    └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、前端存储架构 (IndexedDB)

### 2.1 数据库配置

```javascript
数据库名称: PortfolioDB
数据库版本: 1
存储引擎: IndexedDB (浏览器原生)
```

### 2.2 Object Store (表结构)

#### 表 1: transactions (交易记录表)

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `id` | INTEGER | 主键，自增 | 1 |
| `symbol` | TEXT | 股票代码 | "AAPL" |
| `name` | TEXT | 股票名称 | "苹果公司" |
| `market` | TEXT | 市场 (美股/港股) | "美股" |
| `type` | TEXT | 标的类型 (equity/etf/option) | "equity" |
| `direction` | TEXT | 交易方向 (buy/sell) | "buy" |
| `shares` | REAL | 交易数量 | 100 |
| `price` | REAL | 成交价格 | 150.5 |
| `currency` | TEXT | 货币 (USD/HKD) | "USD" |
| `trade_date` | DATE | 交易日期 | "2026-03-28" |
| `strategy` | TEXT | 策略标签 | "左侧加仓" |
| `emotion` | TEXT | 情绪标签 | "理性" |
| `take_profit` | REAL | 止盈价 | 200.0 |
| `stop_loss` | REAL | 止损价 | 120.0 |
| `reason` | TEXT | 交易理由 | "估值合理" |
| `notes` | TEXT | 备注 | "长期持有" |
| `created_at` | TIMESTAMP | 创建时间 | "2026-03-28 10:00:00" |

**索引:**
- `symbol` - 用于按标的查询
- `trade_date` - 用于按日期查询
- `type` - 用于按类型筛选

**用途:** 记录每一笔买入/卖出交易，用于复盘分析

---

#### 表 2: positions (持仓汇总表)

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `symbol` | TEXT | 股票代码 (主键) | "AAPL" |
| `name` | TEXT | 股票名称 | "苹果公司" |
| `market` | TEXT | 市场 | "美股" |
| `type` | TEXT | 标的类型 | "equity" |
| `shares` | REAL | 总持仓数量 | 250 |
| `avg_cost_price` | REAL | 加权平均成本 | 152.33 |
| `currency` | TEXT | 货币 | "USD" |
| `sector` | TEXT | 行业分类 | "tech" |
| `updated_at` | TIMESTAMP | 更新时间 | "2026-03-28 10:00:00" |

**主键:** `symbol + type` (复合主键)

**唯一约束:** `UNIQUE(symbol, type)`
- 允许同一标的不同类型 (如 AAPL 股票 + AAPL 期权)
- 不允许同一标的同类型重复

**用途:** 展示当前持仓状态，实时计算盈亏

---

#### 表 3: snapshots (快照表)

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `id` | INTEGER | 主键 | 1 |
| `date` | TEXT | 快照日期 | "2026-03-28" |
| `type` | TEXT | 快照类型 (daily/weekly/monthly/yearly) | "daily" |
| `data` | JSON | 完整持仓数据 | {...} |
| `summary` | JSON | 汇总统计 | {...} |
| `created_at` | TIMESTAMP | 创建时间 | "2026-03-28 23:00:00" |

**索引:**
- `date` - 按日期查询
- `type` - 按类型查询

**用途:** 复盘备份，支持日/周/月/年维度

---

#### 表 4: cash_management (现金管理表)

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `id` | INTEGER | 主键 | 1 |
| `usd_balance` | REAL | 美元余额 | 55882 |
| `hkd_balance` | REAL | 港币余额 | 2273 |
| `reserve_amount` | REAL | 预留加仓资金 | 0 |
| `investment_amount` | REAL | 定投资金 | 0 |
| `emergency_amount` | REAL | 应急储备 | 0 |
| `updated_at` | TIMESTAMP | 更新时间 | "2026-03-28 10:00:00" |

**用途:** 记录现金及现金等价物

---

#### 表 5: settings (配置表)

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `key` | TEXT | 配置项名称 (主键) | "github_token" |
| `value` | TEXT | 配置值 | "ghp_xxx" |
| `updated_at` | TIMESTAMP | 更新时间 | "2026-03-28 10:00:00" |

**用途:** 存储 GitHub Token、备份开关等配置

---

## 三、外部接口 (TradingDataHub)

### 3.1 服务信息

```
服务名称: TradingDataHub
服务地址: http://localhost:8005
协议: REST API + HTTP Server-Sent Events
```

### 3.2 接口列表

#### 接口 1: 批量获取股票实时价格

```
POST /api/stock/quotes
Content-Type: application/json
```

**请求参数:**
```json
{
  "symbols": ["AAPL", "TSLA", "09992.HK"],
  "include_forex": true
}
```

**响应数据:**
```json
{
  "stocks": {
    "AAPL": {
      "price": 248.8,
      "currency": "USD",
      "change": -4.09,
      "change_percent": -1.62,
      "timestamp": "1774641602"
    }
  },
  "forex_rates": {
    "USDCNY": { "rate": 6.91, "timestamp": "2026-03-27" },
    "HKDUSD": { "rate": 0.128, "timestamp": "2026-03-28" }
  },
  "errors": {}
}
```

**用途:** 获取持仓股票的实时价格和汇率

---

#### 接口 2: 获取单个股票实时价格

```
GET /api/stock/quote/{symbol}
```

**示例:**
```
GET /api/stock/quote/AAPL
```

**响应:**
```json
{
  "symbol": "AAPL",
  "price": 248.8,
  "currency": "USD",
  "change_percent": -1.62
}
```

---

#### 接口 3: 获取汇率数据

```
POST /api/forex/rates
Content-Type: application/json
```

**请求:**
```json
{
  "pairs": ["USDCNY", "HKDUSD"]
}
```

**响应:**
```json
{
  "USDCNY": { "rate": 6.91 },
  "HKDUSD": { "rate": 0.128 }
}
```

---

#### 接口 4: 健康检查

```
GET /api/health
```

**响应:**
```json
{
  "status": "healthy",
  "service": "TradingDataHub",
  "version": "1.2.0",
  "timestamp": "2026-03-28T17:49:21"
}
```

---

## 四、GitHub 自动备份

### 4.1 备份策略

| 备份类型 | 触发时机 | 备份内容 | 存储路径 |
|---------|---------|---------|---------|
| **实时备份** | 每次交易录入后 5 秒 | 全量数据 | `data/positions.json` |
| **日快照** | 每天 24:00 | 持仓状态 | `snapshots/2026/03/28.json` |
| **周复盘** | 每周日 24:00 | 周度汇总 | `snapshots/2026/03/week-13.json` |
| **月复盘** | 每月最后一天 24:00 | 月度汇总 | `snapshots/2026/03/month-03.json` |
| **年复盘** | 每年 12/31 24:00 | 年度汇总 | `snapshots/2026/year-2026.json` |

### 4.2 备份数据格式

**positions.json:**
```json
{
  "exportTime": "2026-03-28T23:00:00Z",
  "version": "1.0",
  "positions": [
    {
      "symbol": "AAPL",
      "shares": 250,
      "avg_cost_price": 152.33,
      "marketValueCNY": 425000
    }
  ],
  "cash": {
    "usd_balance": 55882,
    "hkd_balance": 2273
  }
}
```

**snapshots/2026/03/28.json:**
```json
{
  "date": "2026-03-28",
  "type": "daily",
  "summary": {
    "totalAssets": 5791357.19,
    "totalPnl": 125000,
    "positionRatio": 66.5
  },
  "holdings": [...],
  "trades": [...]
}
```

---

## 五、数据流向图

### 5.1 交易录入流程

```
用户录入交易
    │
    ▼
┌─────────────┐
│  前端表单校验 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 写入 IndexedDB │
│ transactions  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 自动计算持仓  │
│ 加权平均成本  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 更新 IndexedDB│
│  positions  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 触发 GitHub  │
│ 自动备份     │
└─────────────┘
```

### 5.2 页面加载流程

```
打开页面
    │
    ▼
┌─────────────┐
│ 从 IndexedDB │
│ 读取持仓数据 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 调用 Trading │
│ DataHub API │
│ 获取实时价格 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 计算盈亏/市值│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 渲染页面展示 │
└─────────────┘
```

### 5.3 定时备份流程

```
每天 24:00
    │
    ▼
┌─────────────┐
│ 从 IndexedDB │
│ 读取全量数据 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 生成日快照   │
│ 计算汇总统计 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 写入 GitHub  │
│ 提交 commit  │
└─────────────┘
```

---

## 六、核心计算逻辑

### 6.1 加权平均成本计算

```javascript
// 买入时
newAvgCost = (oldShares * oldAvgCost + newShares * newPrice) / (oldShares + newShares)

// 卖出时
remainingShares = oldShares - sellShares
if (remainingShares > 0) {
    avgCost保持不变
} else {
    删除该持仓
}
```

### 6.2 市值计算

```javascript
// 单只股票市值（人民币）
marketValueCNY = shares * currentPrice * exchangeRate

// 汇率
USDCNY = forexRates.USDCNY.rate
HKDCNY = forexRates.HKDUSD.rate * USDCNY
```

### 6.3 盈亏计算

```javascript
// 单只股票盈亏
pnlAmountCNY = (currentPrice - avgCostPrice) * shares * exchangeRate
pnlPercent = (currentPrice - avgCostPrice) / avgCostPrice * 100

// 总资产盈亏
totalPnlCNY = totalAssetsCNY - initialAssets
```

---

## 七、文件结构

```
portfolio-v5/
├── index.html              # 主页面
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── main.js            # 主程序逻辑
│   ├── indexeddb.js       # IndexedDB 封装
│   ├── github-backup.js   # GitHub 自动备份
│   ├── calculator.js      # 盈亏计算
│   ├── renderer.js        # 页面渲染
│   ├── api.js             # TradingDataHub API
│   └── snapshot.js        # 快照管理
├── data/
│   └── portfolio.db       # 参考的 SQLite 结构（已弃用）
└── docs/
    └── storage-architecture.md  # 本文档
```

---

## 八、配置说明

### 8.1 GitHub Token 配置

1. 访问 GitHub Settings → Developer settings → Personal access tokens
2. 生成 Token，勾选 `repo` 权限
3. 在页面设置中填入 Token
4. 指定备份仓库名（如 `username/portfolio-data`）

### 8.2 定时备份配置

```javascript
// 默认配置
backupConfig = {
  enabled: true,
  autoBackup: true,
  backupTime: "00:00",  // 24:00
  repository: "username/portfolio-data"
}
```

---

## 九、数据安全

1. **本地存储** - IndexedDB，浏览器关闭后数据保留
2. **Git 版本控制** - 每次备份都有 commit hash，可追溯
3. **数据校验** - 导出时计算 checksum
4. **冲突处理** - 多设备以最新时间戳为准

---

## 十、更新日志

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-03-28 | v5.0 | 重构为纯前端架构，IndexedDB + GitHub 备份 |
| 2026-03-28 | v4.0 | 修复接口请求失败、字段名不匹配等问题 |
| 2026-03-27 | v3.0 | 初始版本，SQLite + Flask API |

---

*文档由悟空整理，布尔玛实现*