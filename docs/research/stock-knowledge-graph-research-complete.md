# 个股知识图谱可视化 - 完整调研报告

**调研时间**: 2026-04-11  
**调研人**: 悟空  
**需求**: 港美股个股知识图谱，免费数据源  

---

## 目录

1. [需求概述](#一需求概述)
2. [开源项目调研](#二开源项目调研)
3. [数据源分析](#三数据源分析)
4. [Demo验证：MU和PPMT](#四demo验证mu和ppmt)
5. [技术方案建议](#五技术方案建议)
6. [结论与下一步](#六结论与下一步)

---

## 一、需求概述

### 1.1 目标
通过知识图谱可视化方式，展示个股的上下游强关联公司。

### 1.2 需求约束
- **市场范围**: 港股 + 美股
- **数据源**: 免费
- **节点**: 公司
- **边**: 关系（供应/竞争/投资）

### 1.3 示例
```
宁德时代
├── 上游: 天齐锂业、赣锋锂业
├── 下游: 特斯拉、蔚来、小鹏
└── 竞争: 比亚迪、LG新能源
```

---

## 二、开源项目调研

### 2.1 发现的关键项目

| 项目 | GitHub | 用途 | Stars | 评价 |
|------|--------|------|-------|------|
| **edgartools** | dgunning/edgartools | SEC EDGAR数据提取 | 2k | ⭐⭐⭐ 最强大 |
| **data-prep-sec-edgar** | neo4j-product-examples | SEC数据+Neo4j图谱 | 20 | ⭐⭐⭐ 知识图谱示例 |
| **OpenSupplyChains** | supplychainstudies | 供应链可视化 | - | ⭐⭐ 供应链专用 |
| **edgartools** | alions7000/SEC-EDGAR-text | SEC文本提取 | - | ⭐⭐ 文本分析 |

### 2.2 重点推荐：edgartools

**项目地址**: https://github.com/dgunning/edgartools

**核心能力**:
- ✅ 10-K/10-Q 年报提取
- ✅ 关联交易提取（Related Party Transactions）
- ✅ 子公司/投资关系（EX-21 附件）
- ✅ 13F 机构持仓
- ✅ Form 4 内部交易
- ✅ XBRL 财务数据

**使用示例**:
```python
from edgar import Company

# 获取公司信息
mu = Company("MU")

# 获取最新 10-K
filing = mu.get_filings(form="10-K")[0]

# 提取文本内容
content = filing.text()
```

---

## 三、数据源分析

### 3.1 美股数据源（SEC EDGAR）

**什么是 SEC EDGAR？**
- **全称**: Electronic Data Gathering, Analysis, and Retrieval System
- **中文**: 电子数据收集、分析和检索系统
- **主管机构**: 美国证券交易委员会（SEC）
- **覆盖范围**: 所有美国上市公司（包括ADR）

**主要文件类型**:

| 文件 | 内容 | 对知识图谱的价值 |
|------|------|------------------|
| **10-K** | 年报 | ⭐⭐⭐ 最全面：业务、竞争、风险、子公司 |
| **10-Q** | 季报 | 季度财务更新 |
| **8-K** | 重大事项 | 突发事件、并购 |
| **Form 4** | 内部交易 | 高管买卖股票 |
| **13F** | 机构持仓 | 基金持股情况 |
| **EX-21** | 子公司列表 | ⭐⭐⭐ 完整的子公司架构 |

**10-K 年报中的宝藏章节**:

1. **Item 1 - Business**（业务描述）
   - 公司做什么
   - 主要产品和服务
   - 市场分布

2. **Item 1A - Risk Factors**（风险因素）
   - 供应链依赖
   - 客户集中度

3. **Item 7 - MD&A**（管理层讨论）
   - 主要客户提及
   - 供应商关系

4. **EX-21 附件**
   - 完整的子公司列表

**优点**:
- ✅ 免费：官方数据，无需付费
- ✅ 权威：公司必须如实披露
- ✅ 标准化：统一格式，便于解析

**缺点**:
- ⚠️ 英文：需要英文处理能力
- ⚠️ 非结构化：是文本，需 NLP 提取关系
- ⚠️ 延迟：年报一年一次

### 3.2 港股数据源

| 数据源 | 免费程度 | 覆盖范围 | 数据类型 | 评价 |
|--------|----------|----------|----------|------|
| **港交所披露易** | 免费 | 港股 | 公告、年报 | ⭐⭐⭐ 权威 |
| **东方财富网** | 部分免费 | 港股 | 产业链 | ⭐⭐⭐ 需爬虫 |
| **同花顺** | 部分免费 | 港股 | 关联公司 | ⭐⭐⭐ 需爬虫 |

**港股披露要求**:
- 年报（Annual Report）
- 中期报告（Interim Report）
- 公告（Announcements）

**与美股差异**:
- 披露要求不同，供应链数据较少
- 需繁体中文处理

### 3.3 全球公司关系数据源

| 数据源 | 免费程度 | 覆盖范围 | 数据类型 |
|--------|----------|----------|----------|
| **OpenCorporates** | 免费 | 全球 | 股权关系、控制关系 |
| **Wikidata** | 免费 | 全球 | 结构化知识 |

---

## 四、Demo验证：MU和PPMT

### 4.1 MU (Micron Technology, Inc.) - 美光科技

**公司基本信息**:
```json
{
  "symbol": "MU",
  "name": "Micron Technology, Inc.",
  "market": "NASDAQ",
  "sector": "Semiconductors",
  "industry": "Memory & Storage",
  "cik": "0000723125"
}
```

**通过 SEC EDGAR 可获取的关系**:

#### 子公司（EX-21 附件）
```json
{
  "subsidiaries": [
    {"name": "Micron Semiconductor Products, Inc.", "location": "USA"},
    {"name": "Micron Memory Japan, Inc.", "location": "Japan"},
    {"name": "Micron Technology Texas, LLC", "location": "USA"},
    {"name": "Micron Semiconductor (Xi'an) Co., Ltd.", "location": "China"}
  ]
}
```

#### 主要客户（从 10-K 推断）
```json
{
  "major_customers": [
    {"company": "Apple Inc.", "relationship": "Direct customer"},
    {"company": "Dell Technologies", "relationship": "Direct customer"},
    {"company": "HP Inc.", "relationship": "Direct customer"},
    {"company": "Cisco Systems", "relationship": "Direct customer"}
  ]
}
```

#### 竞争对手（从 10-K Competition 章节）
```json
{
  "competitors": [
    {"name": "Samsung Electronics", "market": "Korea", "product": "DRAM, NAND"},
    {"name": "SK Hynix", "market": "Korea", "product": "DRAM, NAND"},
    {"name": "Kioxia", "market": "Japan", "product": "NAND"}
  ]
}
```

#### 供应链上游（从 10-K 推断）
```json
{
  "suppliers": [
    {"category": "Silicon Wafers", "companies": ["SUMCO", "Shin-Etsu"]},
    {"category": "Equipment", "companies": ["Applied Materials", "Lam Research", "ASML"]},
    {"category": "Assembly/Test", "companies": ["ASE Technology", "Amkor"]}
  ]
}
```

**MU 知识图谱结构**:
```
MU (Micron Technology)
├── 子公司
│   ├── Micron Semiconductor Products, Inc. [USA]
│   ├── Micron Memory Japan, Inc. [Japan]
│   └── Micron Semiconductor (Xi'an) [China]
├── 客户
│   ├── Apple Inc. [下游: 消费电子]
│   ├── Dell Technologies [下游: PC/服务器]
│   └── Cisco Systems [下游: 网络设备]
├── 供应商
│   ├── SUMCO [上游: 硅晶圆]
│   ├── Applied Materials [上游: 设备]
│   └── ASE Technology [上游: 封装测试]
├── 竞争对手
│   ├── Samsung Electronics [竞争: DRAM/NAND]
│   ├── SK Hynix [竞争: DRAM/NAND]
│   └── Kioxia [竞争: NAND]
└── 投资/合作
    └── Intel Corporation [历史JV伙伴]
```

**数据丰富度**: ⭐⭐⭐⭐

### 4.2 PPMT (Pop Mart) - 泡泡玛特

**公司基本信息**:
```json
{
  "symbol": "09992.HK",
  "name": "Pop Mart International Group Limited",
  "market": "Hong Kong Stock Exchange",
  "sector": "Consumer Discretionary",
  "industry": "Toys & Collectibles"
}
```

**通过港交所披露易可获取的数据**:

#### 子公司（从年报）
```json
{
  "subsidiaries": [
    {"name": "Beijing Pop Mart Culture Development Co., Ltd.", "location": "China"},
    {"name": "Pop Mart Korea Co., Ltd.", "location": "Korea"},
    {"name": "Pop Mart Japan Co., Ltd.", "location": "Japan"},
    {"name": "Pop Mart Singapore Pte. Ltd.", "location": "Singapore"}
  ]
}
```

#### 主要IP/艺术家合作（从年报）
```json
{
  "ip_partnerships": [
    {"artist": "Kenny Wong", "ip": "Molly", "type": "Designer collaboration"},
    {"artist": "Pucky", "ip": "Pucky", "type": "Designer collaboration"},
    {"artist": "Skullpanda", "ip": "Skullpanda", "type": "Designer collaboration"},
    {"artist": "Dimoo", "ip": "Dimoo", "type": "Designer collaboration"}
  ]
}
```

#### 销售渠道
```json
{
  "channel_partners": [
    {"partner": "Tmall (Alibaba)", "type": "E-commerce platform"},
    {"partner": "JD.com", "type": "E-commerce platform"},
    {"partner": "Douyin (TikTok)", "type": "Social commerce"}
  ]
}
```

#### 竞争对手
```json
{
  "competitors": [
    {"name": "52TOYS", "market": "China", "product": "Designer toys"},
    {"name": "Top Toy", "market": "China", "product": "Designer toys"},
    {"name": "Funko", "market": "Global", "product": "Pop culture collectibles"}
  ]
}
```

**PPMT 知识图谱结构**:
```
泡泡玛特 (Pop Mart)
├── 子公司
│   ├── Beijing Pop Mart Culture [China]
│   ├── Pop Mart Korea [Korea]
│   ├── Pop Mart Japan [Japan]
│   └── Pop Mart Singapore [Singapore]
├── IP/艺术家合作
│   ├── Kenny Wong [Molly创作者]
│   ├── Pucky [Pucky创作者]
│   ├── Skullpanda [Skullpanda创作者]
│   └── Dimoo [Dimoo创作者]
├── 销售渠道
│   ├── 自营门店 [直营]
│   ├── 机器人商店 [直营]
│   ├── Tmall [平台合作]
│   ├── JD.com [平台合作]
│   └── Douyin [直播合作]
└── 竞争对手
    ├── 52TOYS [国内竞品]
    ├── Top Toy [名创优品旗下]
    └── Funko [国际竞品]
```

**数据丰富度**: ⭐⭐⭐

---

## 五、技术方案建议

### 5.1 推荐方案：基于 edgartools + 手动补充

```python
# 美股示例 (MU)
from edgar import Company

# 获取公司信息
mu = Company("MU")

# 获取最新 10-K
filing = mu.get_filings(form="10-K")[0]

# 提取文本内容
content = filing.text()

# 用 LLM/NLP 提取关系
# - 客户: 从 "Our customers include..." 提取
# - 竞争对手: 从 "Competition" 章节提取
# - 供应商: 从 "Supply chain" 相关段落提取
```

### 5.2 数据补充策略

| 市场 | 自动化数据 | 手动补充 |
|------|-----------|----------|
| **美股** | SEC EDGAR (edgartools) | 行业知识 |
| **港股** | 港交所披露易 | 竞争对手、供应链 |

### 5.3 可视化方案

**推荐**: ECharts Graph
- 中文文档完善
- 与现有 portfolio-v5 技术栈一致
- 学习成本低

---

## 六、结论与下一步

### 6.1 Demo验证结论

| 股票 | 数据丰富度 | 可获取关系 | 主要挑战 |
|------|-----------|-----------|----------|
| **MU** | ⭐⭐⭐⭐ | 子公司、竞争、部分客户、部分供应 | 供应关系需推断 |
| **PPMT** | ⭐⭐⭐ | 子公司、IP合作、销售渠道 | 竞争/供应需外部补充 |

### 6.2 可行性结论

✅ **通过免费数据源可以构建知识图谱**

- **美股** (如 MU): 数据较完整，edgartools 可自动化提取
- **港股** (如 PPMT): 基础数据可获取，部分需手动补充

### 6.3 下一步建议

1. **技术预研**
   - 验证 edgartools 提取 MU 数据
   - 测试 NLP 提取关系的效果

2. **MVP开发**
   - 先做 MU 的自动化 demo
   - PPMT 用混合方案（官方数据+手动维护）

3. **数据源扩展**
   - 评估 OpenCorporates 股权数据
   - 探索行业数据补充方案

---

## 附录

### A. 相关链接

- **edgartools**: https://github.com/dgunning/edgartools
- **SEC EDGAR**: https://www.sec.gov/edgar
- **港交所披露易**: https://www.hkexnews.hk
- **OpenCorporates**: https://opencorporates.com

### B. 文档位置

本报告保存位置：`~/.openclaw/workspace-bulma/docs/stock-knowledge-graph-research.md`

Demo数据位置：`~/.openclaw/workspace-bulma/docs/mu_ppmt_knowledge_graph_demo.md`
