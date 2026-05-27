from typing import Optional, Any, Dict

class BrokerMutationRejection:
    def __init__(self, action: str, reason: str):
        self.allowed = False
        self.action = action
        self.reason = reason
        self.blocked = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "allowed": self.allowed,
            "action": self.action,
            "reason": self.reason,
            "blocked": self.blocked,
        }

class BrokerMutationGuard:
    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def check_mutation(self, action: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Check if a broker mutation (place, cancel, modify) is allowed.
        When enabled, all mutations are blocked by default with a structured rejection.
        """
        mutations = {"placeOrder", "modifyOrder", "cancelOrder", "place_order", "modify_order", "cancel_order"}
        if self.enabled and action in mutations:
            return BrokerMutationRejection(
                action=action,
                reason=f"Broker mutation '{action}' blocked by default security guard. {action} is blocked."
            ).to_dict()
        return None

    def protect(self, func_name: str, func, *args, **kwargs):
        """
        Wrap a function call and protect it if it is a mutation.
        """
        rejection = self.check_mutation(func_name, {"args": args, "kwargs": kwargs})
        if rejection and rejection.get("blocked"):
            raise ValueError(rejection["reason"])
        return func(*args, **kwargs)
