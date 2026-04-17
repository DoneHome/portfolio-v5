"""
期权数据服务
使用Y Finance获取期权数据
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import re
import time
import json
from typing import Dict, List, Optional, Tuple
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OptionsService:
    """期权数据服务"""
    
    def __init__(self, cache_ttl: int = 300):  # 5分钟缓存
        self.cache = {}
        self.cache_ttl = cache_ttl
        self.request_delay = 0.1  # 请求延迟，避免被限制
    
    def _get_cache_key(self, symbol: str, expiry: str = None) -> str:
        """生成缓存键"""
        if expiry:
            return f"{symbol}_{expiry}"
        return symbol
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """检查缓存是否有效"""
        if cache_key not in self.cache:
            return False
        
        cached_time, _ = self.cache[cache_key]
        return (datetime.now() - cached_time).seconds < self.cache_ttl
    
    def _set_cache(self, cache_key: str, data: dict):
        """设置缓存"""
        self.cache[cache_key] = (datetime.now(), data)
    
    def _get_cache(self, cache_key: str) -> Optional[dict]:
        """获取缓存"""
        if self._is_cache_valid(cache_key):
            _, data = self.cache[cache_key]
            return data
        return None
    
    def parse_option_symbol(self, option_symbol: str) -> Dict:
        """
        解析期权代码
        支持格式：
        1. Y Finance格式: AAPL260417C00110000 (标的+到期日+看涨/看跌+行权价8位)
        2. 我们的格式: AAPL260418C180 (标的+到期日+看涨/看跌+行权价)
        3. 港股格式: 00700HK260418C350 (标的+到期日+看涨/看跌+行权价)
        """
        symbol = option_symbol.strip().upper()
        
        # 1. 尝试匹配Y Finance格式
        # 格式：标的(1-5字母) + 到期日(6位YYMMDD) + 看涨/看跌(C/P) + 行权价(8位，补零)
        yf_pattern = r'^([A-Z]{1,5})(\d{6})([CP])(\d{8})$'
        yf_match = re.match(yf_pattern, symbol)
        
        if yf_match:
            underlying, expiry, option_type, strike_str = yf_match.groups()
            
            # 解析行权价（去掉前导零）
            strike = float(strike_str) / 1000  # 8位数字，如00110000 = 110.0
            
            # 解析到期日
            year = '20' + expiry[0:2]
            month = expiry[2:4]
            day = expiry[4:6]
            expiry_date = f"{year}-{month}-{day}"
            
            return {
                "underlying_symbol": underlying,
                "expiry_date": expiry_date,
                "option_type": "call" if option_type == "C" else "put",
                "strike_price": strike,
                "format": "yfinance",
                "original_symbol": symbol,
                "yfinance_symbol": symbol  # Y Finance格式直接使用
            }
        
        # 2. 尝试匹配我们的美股期权格式
        us_pattern = r'^([A-Z]{1,5})(\d{6})([CP])(\d+(?:\.\d+)?)$'
        us_match = re.match(us_pattern, symbol)
        
        if us_match:
            underlying, expiry, option_type, strike = us_match.groups()
            
            # 解析到期日
            year = '20' + expiry[0:2]
            month = expiry[2:4]
            day = expiry[4:6]
            expiry_date = f"{year}-{month}-{day}"
            
            # 转换为Y Finance格式
            strike_padded = str(int(float(strike) * 1000)).zfill(8)
            yf_symbol = f"{underlying}{expiry}{option_type}{strike_padded}"
            
            return {
                "underlying_symbol": underlying,
                "expiry_date": expiry_date,
                "option_type": "call" if option_type == "C" else "put",
                "strike_price": float(strike),
                "format": "us",
                "original_symbol": symbol,
                "yfinance_symbol": yf_symbol
            }
        
        # 3. 尝试匹配港股期权格式
        hk_pattern = r'^(\d{5})HK(\d{6})([CP])(\d+(?:\.\d+)?)$'
        hk_match = re.match(hk_pattern, symbol)
        
        if hk_match:
            underlying, expiry, option_type, strike = hk_match.groups()
            
            # 解析到期日
            year = '20' + expiry[0:2]
            month = expiry[2:4]
            day = expiry[4:6]
            expiry_date = f"{year}-{month}-{day}"
            
            # 转换为Y Finance格式
            strike_padded = str(int(float(strike) * 1000)).zfill(8)
            yf_symbol = f"{underlying}{expiry}{option_type}{strike_padded}"
            
            return {
                "underlying_symbol": underlying + ".HK",
                "expiry_date": expiry_date,
                "option_type": "call" if option_type == "C" else "put",
                "strike_price": float(strike),
                "format": "hk",
                "original_symbol": symbol,
                "yfinance_symbol": yf_symbol
            }
        
        # 无法解析
        return {
            "underlying_symbol": "",
            "expiry_date": "",
            "option_type": "",
            "strike_price": 0,
            "format": "unknown",
            "original_symbol": symbol,
            "error": "无法解析期权代码格式"
        }
    

    
    def get_underlying_price(self, symbol: str) -> Optional[float]:
        """获取标的股票价格"""
        cache_key = self._get_cache_key(f"price_{symbol}")
        cached = self._get_cache(cache_key)
        
        if cached:
            return cached
        
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = info.get('currentPrice') or info.get('regularMarketPrice')
            
            if price:
                self._set_cache(cache_key, price)
                return price
            
            # 尝试获取历史数据
            hist = ticker.history(period="1d")
            if not hist.empty:
                price = hist['Close'].iloc[-1]
                self._set_cache(cache_key, price)
                return price
            
            logger.warning(f"无法获取 {symbol} 的价格")
            return None
            
        except Exception as e:
            logger.error(f"获取 {symbol} 价格失败: {e}")
            return None
    
    def get_option_premium(self, option_symbol: str) -> Optional[Dict]:
        """
        获取期权权利金价格
        返回: {"premium": 价格, "last_updated": 时间戳}
        """
        cache_key = self._get_cache_key(f"premium_{option_symbol}")
        cached = self._get_cache(cache_key)
        
        if cached:
            return cached
        
        try:
            # 解析期权代码
            parsed = self.parse_option_symbol(option_symbol)
            if "error" in parsed:
                logger.error(f"期权代码解析失败: {parsed['error']}")
                return None
            
            underlying = parsed["underlying_symbol"]
            expiry = parsed["expiry_date"].replace("-", "")[2:]  # YYMMDD格式
            option_type = "C" if parsed["option_type"] == "call" else "P"
            strike = parsed["strike_price"]
            
            # 获取标的股票数据
            ticker = yf.Ticker(underlying)
            
            # 获取期权到期日列表
            expirations = ticker.options
            if not expirations:
                logger.warning(f"{underlying} 没有期权数据")
                return None
            
            # 查找匹配的到期日
            target_expiry = None
            for exp in expirations:
                if exp.replace("-", "")[2:] == expiry:  # 比较YYMMDD
                    target_expiry = exp
                    break
            
            if not target_expiry:
                logger.warning(f"未找到到期日 {expiry} 的期权")
                return None
            
            # 获取期权链
            time.sleep(self.request_delay)  # 避免请求过快
            chain = ticker.option_chain(target_expiry)
            
            # 根据期权类型选择数据
            if option_type == "C":
                options_df = chain.calls
            else:
                options_df = chain.puts
            
            # 查找匹配行权价的期权
            matched = options_df[options_df['strike'] == strike]
            
            if matched.empty:
                logger.warning(f"未找到行权价 {strike} 的期权")
                return None
            
            option_data = matched.iloc[0]
            premium = option_data.get('lastPrice') or option_data.get('bid') or 0
            
            result = {
                "premium": float(premium),
                "bid": float(option_data.get('bid', 0)),
                "ask": float(option_data.get('ask', 0)),
                "volume": int(option_data.get('volume', 0)),
                "open_interest": int(option_data.get('openInterest', 0)),
                "implied_volatility": float(option_data.get('impliedVolatility', 0)),
                "last_updated": datetime.now().isoformat(),
                "contract_symbol": option_data.get('contractSymbol', '')
            }
            
            self._set_cache(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"获取期权 {option_symbol} 价格失败: {e}")
            return None
    
    def get_batch_option_premiums(self, option_symbols: List[str]) -> Dict[str, Dict]:
        """批量获取期权权利金价格"""
        results = {}
        
        for symbol in option_symbols:
            if not symbol:
                continue
            
            premium_data = self.get_option_premium(symbol)
            if premium_data:
                results[symbol] = premium_data
            else:
                # 返回错误信息
                results[symbol] = {
                    "error": "获取数据失败",
                    "last_updated": datetime.now().isoformat()
                }
        
        return results
    
    def get_option_chain(self, underlying_symbol: str, expiry_date: str = None) -> Dict:
        """获取期权链数据"""
        cache_key = self._get_cache_key(f"chain_{underlying_symbol}_{expiry_date}")
        cached = self._get_cache(cache_key)
        
        if cached:
            return cached
        
        try:
            ticker = yf.Ticker(underlying_symbol)
            
            # 获取到期日列表
            expirations = ticker.options
            if not expirations:
                return {"error": "没有期权数据"}
            
            # 如果没有指定到期日，使用最近的
            if not expiry_date:
                expiry_date = expirations[0]
            
            # 获取期权链
            time.sleep(self.request_delay)
            chain = ticker.option_chain(expiry_date)
            
            # 处理看涨期权
            calls = []
            for _, row in chain.calls.iterrows():
                calls.append({
                    "contract_symbol": row['contractSymbol'],
                    "strike": float(row['strike']),
                    "last_price": float(row.get('lastPrice', 0)),
                    "bid": float(row.get('bid', 0)),
                    "ask": float(row.get('ask', 0)),
                    "volume": int(row.get('volume', 0)),
                    "open_interest": int(row.get('openInterest', 0)),
                    "implied_volatility": float(row.get('impliedVolatility', 0))
                })
            
            # 处理看跌期权
            puts = []
            for _, row in chain.puts.iterrows():
                puts.append({
                    "contract_symbol": row['contractSymbol'],
                    "strike": float(row['strike']),
                    "last_price": float(row.get('lastPrice', 0)),
                    "bid": float(row.get('bid', 0)),
                    "ask": float(row.get('ask', 0)),
                    "volume": int(row.get('volume', 0)),
                    "open_interest": int(row.get('openInterest', 0)),
                    "implied_volatility": float(row.get('impliedVolatility', 0))
                })
            
            result = {
                "underlying_symbol": underlying_symbol,
                "expiry_date": expiry_date,
                "calls": calls[:20],  # 限制数量
                "puts": puts[:20],
                "last_updated": datetime.now().isoformat()
            }
            
            self._set_cache(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"获取 {underlying_symbol} 期权链失败: {e}")
            return {"error": str(e)}


# 全局服务实例
options_service = OptionsService()