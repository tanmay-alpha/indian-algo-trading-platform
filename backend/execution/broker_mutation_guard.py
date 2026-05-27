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
            "reason": self.reason,
            "guard_name": "BrokerMutationGuard",
            "live_execution_enabled": False,
            "blocked": self.blocked,
            "action": self.action,
        }

class BrokerMutationGuard:
    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def check_mutation(self, action: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Check if a broker mutation is allowed.
        Blocks: place, cancel, modify, squareoff, live execution
        """
        action_norm = str(action).lower().strip().replace("_", "")
        blocked_actions = {
            "place", "cancel", "modify", "squareoff", "liveexecution",
            "placeorder", "modifyorder", "cancelorder", "square_off"
        }
        if self.enabled and (action_norm in blocked_actions or "live" in action_norm or "execution" in action_norm):
            return {
                "allowed": False,
                "reason": f"Broker mutation '{action}' blocked by default security guard. {action} is blocked.",
                "guard_name": "BrokerMutationGuard",
                "live_execution_enabled": False,
                "blocked": True,
                "action": action
            }
        return None

    def protect(self, func_name: str, func, *args, **kwargs):
        """
        Wrap a function call and protect it if it is a mutation.
        """
        rejection = self.check_mutation(func_name, {"args": args, "kwargs": kwargs})
        if rejection and not rejection.get("allowed"):
            raise ValueError(rejection["reason"])
        return func(*args, **kwargs)
