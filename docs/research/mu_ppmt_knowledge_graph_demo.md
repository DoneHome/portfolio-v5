# MU 和 PPMT 知识图谱 Demo 数据

## 说明
基于现有免费数据源（SEC EDGAR、港交所披露易、OpenCorporates）
不做爬虫，仅展示可通过 API 获取的数据

---

## 一、MU (Micron Technology, Inc.) - 美光科技

### 1. 公司基本信息
```json
{
  "symbol": "MU",
  "name": "Micron Technology, Inc.",
  "market": "NASDAQ",
  "sector": "Semiconductors",
  "industry": "Memory & Storage",
  "cik": "0000723125",
  "headquarters": "Boise, Idaho, USA"
}
```

### 2. 通过 SEC EDGAR 可获取的关系

#### 2.1 子公司（EX-21 附件）
根据 MU 最新 10-K，主要子公司：
```json
{
  "subsidiaries": [
    {"name": "Micron Semiconductor Products, Inc.", "location": "USA"},
    {"name": "Micron Memory Japan, Inc.", "location": "Japan"},
    {"name": "Micron Technology Texas, LLC", "location": "USA"},
    {"name": "IM Flash Technologies, LLC", "location": "USA (JV with Intel, dissolved)"},
    {"name": "Micron Semiconductor (Xi'an) Co., Ltd.", "location": "China"}
  ]
}
```

#### 2.2 关联交易（Related Party Transactions）
从 10-K Item 8 - Financial Statements:
```json
{
  "related_party_transactions": [
    {
      "party": "Intel Corporation",
      "relationship": "Former JV Partner (IM Flash)",
      "transaction_type": "Technology licensing, Supply agreement",
      "amount": "Disclosed in filings"
    }
  ]
}
```

#### 2.3 主要客户（从 10-K Risk Factors 和 MD&A 推断）
```json
{
  "major_customers": [
    {"company": "Apple Inc.", "relationship": "Direct customer", "evidence": "10-K disclosure"},
    {"company": "Dell Technologies", "relationship": "Direct customer"},
    {"company": "HP Inc.", "relationship": "Direct customer"},
    {"company": "Lenovo", "relationship": "Direct customer"},
    {"company": "Cisco Systems", "relationship": "Direct customer"}
  ]
}
```

#### 2.4 竞争对手（从 10-K Competition 章节）
```json
{
  "competitors": [
    {"name": "Samsung Electronics", "market": "Korea", "product": "DRAM, NAND"},
    {"name": "SK Hynix", "market": "Korea", "product": "DRAM, NAND"},
    {"name": "Kioxia (formerly Toshiba)", "market": "Japan", "product": "NAND"},
    {"name": "Western Digital", "market": "USA", "product": "NAND"},
    {"name": "Intel (Optane, discontinued)", "market": "USA", "product": "Storage class memory"}
  ]
}
```

#### 2.5 供应链上游（从 10-K 推断）
```json
{
  "suppliers": [
    {"category": "Silicon Wafers", "companies": ["SUMCO", "Shin-Etsu", "GlobalWafers"]},
    {"category": "Equipment", "companies": ["Applied Materials", "Lam Research", "ASML"]},
    {"category": "Chemicals", "companies": ["Various Japanese suppliers"]},
    {"category": "Assembly/Test", "companies": ["ASE Technology", "Amkor"]},
    {"category": "Raw Materials", "note": "Memory chip manufacturing requires specific rare materials"}
  ]
}
```

### 3. MU 知识图谱结构

```
MU (Micron Technology)
├── 子公司
│   ├── Micron Semiconductor Products, Inc. [USA]
│   ├── Micron Memory Japan, Inc. [Japan]
│   └── Micron Semiconductor (Xi'an) [China]
├── 客户
│   ├── Apple Inc. [下游: 消费电子]
│   ├── Dell Technologies [下游: PC/服务器]
│   ├── HP Inc. [下游: PC/打印机]
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

---

## 二、PPMT (Pop Mart International Group Ltd.) - 泡泡玛特

### 1. 公司基本信息
```json
{
  "symbol": "09992.HK",
  "name": "Pop Mart International Group Limited",
  "market": "Hong Kong Stock Exchange",
  "sector": "Consumer Discretionary",
  "industry": "Toys & Collectibles",
  "headquarters": "Beijing, China",
  "listing_date": "2020-12-11"
}
```

### 2. 通过港交所披露易可获取的数据

#### 2.1 子公司（从年报）
```json
{
  "subsidiaries": [
    {"name": "Beijing Pop Mart Culture Development Co., Ltd.", "location": "China", "type": "Operating entity"},
    {"name": "Pop Mart Korea Co., Ltd.", "location": "Korea", "type": "Overseas subsidiary"},
    {"name": "Pop Mart Japan Co., Ltd.", "location": "Japan", "type": "Overseas subsidiary"},
    {"name": "Pop Mart Singapore Pte. Ltd.", "location": "Singapore", "type": "Overseas subsidiary"},
    {"name": "Pop Mart (HK) Limited", "location": "Hong Kong", "type": "Holding company"}
  ]
}
```

#### 2.2 主要IP/艺术家合作（从年报和公告）
```json
{
  "ip_partnerships": [
    {"artist": "Kenny Wong", "ip": "Molly", "relationship": "Exclusive/Non-exclusive", "type": "Designer collaboration"},
    {"artist": "Pucky", "ip": "Pucky", "relationship": "Designer collaboration"},
    {"artist": "Skullpanda", "ip": "Skullpanda", "relationship": "Designer collaboration"},
    {"artist": "Dimoo", "ip": "Dimoo", "relationship": "Designer collaboration"},
    {"artist": "The Monsters (Kasing Lung)", "ip": "Labubu", "relationship": "Designer collaboration"}
  ]
}
```

#### 2.3 渠道/零售合作
```json
{
  "channel_partners": [
    {"partner": "Tmall (Alibaba)", "type": "E-commerce platform", "relationship": "Third-party platform"},
    {"partner": "JD.com", "type": "E-commerce platform", "relationship": "Third-party platform"},
    {"partner": "Douyin (TikTok)", "type": "Social commerce", "relationship": "Live streaming sales"},
    {"partner": "Various shopping malls", "type": "Offline retail", "relationship": "Lease agreements"}
  ]
}
```

#### 2.4 生产/供应链（从年报推断）
```json
{
  "suppliers": [
    {"category": "OEM Manufacturing", "note": "Third-party manufacturers in China", "relationship": "Contract manufacturing"},
    {"category": "Raw Materials", "note": "PVC, ABS plastics suppliers", "relationship": "Material suppliers"},
    {"category": "Packaging", "note": "Packaging suppliers", "relationship": "Packaging"},
    {"category": "Logistics", "note": "Third-party logistics providers", "relationship": "Distribution"}
  ]
}
```

#### 2.5 竞争对手（从行业分析）
```json
{
  "competitors": [
    {"name": "52TOYS", "market": "China", "product": "Designer toys, Blind boxes"},
    {"name": "ToyCity", "market": "China", "product": "Designer toys"},
    {"name": "Top Toy (名创优品旗下)", "market": "China", "product": "Designer toys, Blind boxes"},
    {"name": "X11", "market": "China", "product": "Designer toy retail"},
    {"name": "Funko (US)", "market": "Global", "product": "Pop culture collectibles"},
    {"name": "Medicom Toy (Japan)", "market": "Japan/Global", "product": "Designer toys, Bearbrick"}
  ]
}
```

### 3. PPMT 知识图谱结构

```
泡泡玛特 (Pop Mart)
├── 子公司
│   ├── Beijing Pop Mart Culture [China - 运营主体]
│   ├── Pop Mart Korea [Korea]
│   ├── Pop Mart Japan [Japan]
│   └── Pop Mart Singapore [Singapore]
├── IP/艺术家合作
│   ├── Kenny Wong [Molly创作者]
│   ├── Pucky [Pucky创作者]
│   ├── Skullpanda [Skullpanda创作者]
│   ├── Dimoo [Dimoo创作者]
│   └── Kasing Lung [Labubu创作者]
├── 销售渠道
│   ├── 自营门店 [直营]
│   ├── 机器人商店 [直营]
│   ├── Tmall [平台合作]
│   ├── JD.com [平台合作]
│   └── Douyin [直播合作]
├── 供应商
│   ├── OEM制造商 [代工生产]
│   ├── 原材料供应商 [PVC/ABS]
│   └── 物流服务商 [配送]
└── 竞争对手
    ├── 52TOYS [国内竞品]
    ├── Top Toy [名创优品旗下]
    └── Funko [国际竞品]
```

---

## 三、数据源验证总结

### MU (美股) - 数据丰富度: ⭐⭐⭐⭐
| 数据类型 | 来源 | 可获取性 | 质量 |
|----------|------|----------|------|
| 子公司 | SEC EX-21 | ✅ 完整 | 高 |
| 关联交易 | SEC 10-K | ✅ 部分 | 中 |
| 主要客户 | 10-K推断 | ⚠️ 间接 | 中 |
| 竞争对手 | 10-K Competition | ✅ 明确 | 高 |
| 供应商 | 10-K推断 | ⚠️ 间接 | 低 |

### PPMT (港股) - 数据丰富度: ⭐⭐⭐
| 数据类型 | 来源 | 可获取性 | 质量 |
|----------|------|----------|------|
| 子公司 | 港交所年报 | ✅ 完整 | 高 |
| IP合作 | 年报/公告 | ✅ 部分 | 中 |
| 销售渠道 | 年报 | ✅ 部分 | 中 |
| 供应商 | 年报推断 | ⚠️ 间接 | 低 |
| 竞争对手 | 行业分析 | ⚠️ 外部 | 中 |

---

## 四、技术实现建议

### 方案：基于 edgartools + 手动补充

```python
# 美股示例 (MU)
from edgar import Company

# 获取公司信息
mu = Company("MU")

# 获取最新 10-K
filing = mu.get_filings(form="10-K")[0]

# 提取文本内容（含 Business, Risk Factors, MD&A）
content = filing.text()

# 用 LLM/NLP 提取关系
# - 客户: 从 "Our customers include..." 提取
# - 竞争对手: 从 "Competition" 章节提取
# - 供应商: 从 "Supply chain" 相关段落提取
```

### 数据补充策略
1. **SEC 数据**: 用 edgartools 自动提取
2. **行业数据**: 手动维护核心公司关系
3. **港股数据**: 从披露易年报手动整理

---

## 五、Demo 验证结论

✅ **MU**: 通过 SEC EDGAR 可以构建较完整的图谱
- 子公司: 完整
- 竞争关系: 明确
- 客户关系: 可从年报推断
- 供应关系: 较弱，需行业知识补充

⚠️ **PPMT**: 港股披露要求不同，数据相对较少
- 子公司: 完整
- IP合作: 可从年报获取
- 竞争/供应: 需外部数据源补充

**建议**: 先做 MU 的自动化 demo，PPMT 用混合方案（官方数据+手动维护）
