import requests  # type: ignore
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List

class TokenScannerAgent:
    """
    A standalone Hedera Token Scanner Agent that fetches real blockchain data
    and prepares structured intelligence data for other RugGuard agents.
    """

    def __init__(self):
        """Initialize the TokenScannerAgent with a cache and base URL."""
        self.base_url = "https://mainnet-public.mirrornode.hedera.com/api/v1"
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.session = requests.Session()

    def scan_token(self, token_id: str) -> Dict[str, Any]:
        """
        Scan a token and return structured intelligence data.
        
        Args:
            token_id (str): The Hedera Token ID to scan.
            
        Returns:
            Dict[str, Any]: The structured data or error dictionary.
        """
        if not self._validate_token_id(token_id):
            return {"error": "Invalid token format"}

        if token_id in self.cache:
            return self.cache[token_id]

        token_data = self._fetch_token_data(token_id)
        if not token_data:
            return {"error": "Mirror node unavailable"}

        balances_data = self._fetch_balances(token_id)
        if balances_data is None:
             return {"error": "Mirror node unavailable"}
             
        treasury_account_id = token_data.get("treasury_account_id", "")

        transactions_data = self._fetch_transactions(treasury_account_id) if treasury_account_id else None
        if not transactions_data:
             # Just instantiate an empty dictionary if mirror node limits transaction queries
             transactions_data = {"transactions": []}

        name = token_data.get("name", "")
        symbol = token_data.get("symbol", "")
        token_type = token_data.get("type", "")
        total_supply_str = token_data.get("total_supply", "0")
        total_supply = int(total_supply_str) if total_supply_str else 0
        decimals_str = token_data.get("decimals", "0")
        decimals = int(decimals_str) if decimals_str else 0
        
        created_timestamp_str = token_data.get("created_timestamp", "0")
        try:
            seconds_str = created_timestamp_str.split(".")[0]
            created_seconds = int(seconds_str)
            if created_seconds < 1546300800: # 2019-01-01
                created_datetime = datetime.now(timezone.utc)
            else:
                created_datetime = datetime.fromtimestamp(created_seconds, tz=timezone.utc)
        except (ValueError, TypeError, IndexError):
            created_datetime = datetime.now(timezone.utc)

        # Security flags
        admin_key_exists = bool(token_data.get("admin_key"))
        supply_key_exists = bool(token_data.get("supply_key"))
        freeze_key_exists = bool(token_data.get("freeze_key"))
        wipe_key_exists = bool(token_data.get("wipe_key"))

        # Holder metrics
        holder_metrics = self._calculate_holder_metrics(balances_data, total_supply, treasury_account_id)
        
        # Activity metrics
        activity_metrics = self._calculate_activity_metrics(transactions_data)
        
        # Derived metrics
        now = datetime.now(timezone.utc)
        token_age_days = max(0, (now - created_datetime).days)
        if token_age_days > 4000:
            token_age_days = 0
        
        if token_age_days < 7:
            age_risk_level = "VERY_HIGH"
        elif token_age_days < 30:
            age_risk_level = "HIGH"
        elif token_age_days < 180:
            age_risk_level = "MEDIUM"
        else:
            age_risk_level = "LOW"

        mint_risk = "HIGH" if supply_key_exists else "LOW"

        # Activity Risk
        transaction_count = activity_metrics["transaction_count"]
        recent_transaction_count = activity_metrics["recent_transaction_count"]
        
        if transaction_count < 20 and token_age_days > 90:
            activity_risk = "HIGH"
        elif recent_transaction_count < 5:
            activity_risk = "MEDIUM"
        else:
            activity_risk = "LOW"

        # Scanner Health Score
        scanner_health_score = 100
        if admin_key_exists:
            scanner_health_score -= 15
        if supply_key_exists:
            scanner_health_score -= 20
        if holder_metrics["top_holder_percentage"] > 40:
            scanner_health_score -= 15
        if holder_metrics["top_5_holder_percentage"] > 70:
            scanner_health_score -= 20
        if activity_risk in ["HIGH", "MEDIUM"]:
            scanner_health_score -= 10

        result = {
            "token_id": token_id,
            "name": name,
            "symbol": symbol,
            "type": token_type,
            "total_supply": total_supply,
            "decimals": decimals,
            "treasury_account": treasury_account_id,
            "treasury_balance": holder_metrics["treasury_balance"],
            "admin_key_exists": admin_key_exists,
            "supply_key_exists": supply_key_exists,
            "freeze_key_exists": freeze_key_exists,
            "wipe_key_exists": wipe_key_exists,
            "holder_count": holder_metrics["holder_count"],
            "top_holder_percentage": holder_metrics["top_holder_percentage"],
            "top_5_holder_percentage": holder_metrics["top_5_holder_percentage"],
            "transaction_count": transaction_count,
            "recent_transaction_count": recent_transaction_count,
            "last_transaction_timestamp": activity_metrics["last_transaction_timestamp"],
            "token_age_days": token_age_days,
            "age_risk_level": age_risk_level,
            "mint_risk": mint_risk,
            "activity_risk": activity_risk,
            "scanner_health_score": scanner_health_score,
            "source": "hedera_mirror_node"
        }

        self.cache[token_id] = result
        return result

    def _validate_token_id(self, token_id: str) -> bool:
        """Validate the format of the Hedera Token ID."""
        pattern = r"^0\.0\.\d+$"
        return bool(re.match(pattern, token_id))

    def _make_request(self, url: str) -> Optional[Dict[str, Any]]:
        """Make an API request with retries and timeout."""
        for _ in range(3):
            try:
                response = self.session.get(url, timeout=10)
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None
            except requests.RequestException:
                continue
        return None

    def _fetch_token_data(self, token_id: str) -> Optional[Dict[str, Any]]:
        """Fetch general token data from the Mirror Node."""
        url = f"{self.base_url}/tokens/{token_id}"
        return self._make_request(url)

    def _fetch_balances(self, token_id: str) -> Optional[Dict[str, Any]]:
        """Fetch token balances from the Mirror Node."""
        url = f"{self.base_url}/tokens/{token_id}/balances"
        return self._make_request(url)

    def _fetch_transactions(self, account_id: str) -> Optional[Dict[str, Any]]:
        """Fetch token transactions from the Mirror Node by Treasury Account."""
        url = f"{self.base_url}/transactions?account.id={account_id}"
        return self._make_request(url)

    def _calculate_holder_metrics(self, balances_data: Dict[str, Any], total_supply: int, treasury_account_id: str) -> Dict[str, Any]:
        """Calculate holder-related metrics from balances data."""
        metrics = {
            "holder_count": 0,
            "treasury_balance": 0,
            "top_holder_percentage": 0.0,
            "top_5_holder_percentage": 0.0
        }
        
        if not balances_data or "balances" not in balances_data:
            return metrics
            
        balances_list: List[Dict[str, Any]] = balances_data["balances"]
        if not balances_list:
             return metrics
             
        active_balances: List[Dict[str, Any]] = [b for b in balances_list if int(b.get("balance", 0)) > 0]
        metrics["holder_count"] = len(active_balances)
        
        for b in active_balances:
            if b.get("account") == treasury_account_id:
                metrics["treasury_balance"] = int(b.get("balance", 0))
                break
                
        if total_supply > 0:
            sorted_balances: List[Dict[str, Any]] = sorted(active_balances, key=lambda x: int(x.get("balance", 0)), reverse=True)
            
            if sorted_balances:
                top_balance = int(sorted_balances[0].get("balance", 0))
                val1 = (top_balance / total_supply) * 100
                metrics["top_holder_percentage"] = int(val1 * 100) / 100.0
                
            top_5_balance = 0
            for i in range(min(5, len(sorted_balances))):
                top_5_balance = top_5_balance + int(sorted_balances[i].get("balance", 0))
                
            val2 = (top_5_balance / total_supply) * 100
            metrics["top_5_holder_percentage"] = int(val2 * 100) / 100.0
            
        return metrics

    def _calculate_activity_metrics(self, transactions_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate transaction-related activity metrics."""
        metrics: Dict[str, Any] = {
            "transaction_count": 0,
            "recent_transaction_count": 0,
            "last_transaction_timestamp": ""
        }
        
        if not transactions_data or "transactions" not in transactions_data:
            return metrics
            
        transactions_list = transactions_data["transactions"]
        metrics["transaction_count"] = len(transactions_list)
        
        if not transactions_list:
            metrics["last_transaction_timestamp"] = None
            return metrics
            
        newest_tx = max(transactions_list, key=lambda tx: float(tx.get("consensus_timestamp", "0")))
        consensus_timestamp = newest_tx.get("consensus_timestamp", "0")
        
        try:
            seconds_str = consensus_timestamp.split(".")[0]
            tx_seconds = int(seconds_str)
            if tx_seconds < 1546300800:
                metrics["last_transaction_timestamp"] = None
            else:
                last_tx_time = datetime.fromtimestamp(tx_seconds, tz=timezone.utc)
                metrics["last_transaction_timestamp"] = last_tx_time.isoformat()
        except (ValueError, TypeError, IndexError):
            metrics["last_transaction_timestamp"] = None
            
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_txs: List[Any] = []
        for tx in transactions_list:
            tx_ts = tx.get("consensus_timestamp", "0")
            try:
                sec_str = tx_ts.split(".")[0]
                tx_sec = int(sec_str)
                if tx_sec >= 1546300800:
                    tx_time = datetime.fromtimestamp(tx_sec, tz=timezone.utc)
                    if tx_time >= seven_days_ago:
                        recent_txs.append(tx)
            except (ValueError, TypeError, IndexError):
                continue
                
        metrics["recent_transaction_count"] = len(recent_txs)
        return metrics

if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) > 1:
        token_id = sys.argv[1]
        agent = TokenScannerAgent()
        result = agent.scan_token(token_id)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "No token ID provided"}))
