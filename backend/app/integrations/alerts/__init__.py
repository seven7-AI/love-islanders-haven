"""Emergency alert delivery (SMS/email to a user's safety contacts).

No delivery provider is integrated yet. `UnconfiguredAlertSender` makes that explicit: the API answers 503
`alerts_not_configured` and the app tells the user to contact emergency services directly, instead of claiming that
contacts were notified. A real implementation (e.g. an SMS provider) implements `AlertSender`.
"""

from dataclasses import dataclass
from typing import Protocol


class AlertsNotConfigured(Exception):
    pass


@dataclass(frozen=True)
class AlertRecipient:
    name: str
    phone: str | None
    email: str | None


class AlertSender(Protocol):
    async def send(self, sender_name: str, recipients: list[AlertRecipient], message: str) -> int:
        """Delivers the alert; returns how many recipients it was sent to."""
        ...


class UnconfiguredAlertSender:
    async def send(self, sender_name: str, recipients: list[AlertRecipient], message: str) -> int:
        raise AlertsNotConfigured("Emergency alerts are not configured")
