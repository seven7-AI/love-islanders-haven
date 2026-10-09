from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccessibilityPrefs(_Strict):
    textSize: int | None = Field(default=None, ge=80, le=150)
    highContrast: bool | None = None
    colorBlindness: Literal["none", "protanopia", "deuteranopia", "tritanopia"] | None = None


class AppPrefs(_Strict):
    autoTheme: bool | None = None
    language: str | None = Field(default=None, min_length=2, max_length=10)
    soundEffects: bool | None = None
    hapticFeedback: bool | None = None
    animations: bool | None = None


class AICompanionPrefs(_Strict):
    conversationStyle: Literal["playful", "caring", "thoughtful", "flirty"] | None = None
    voiceTone: Literal["warm", "soft", "confident", "soothing"] | None = None
    allowProactiveMessages: bool | None = None
    messageFrequency: int | None = Field(default=None, ge=0, le=10)


class MatchPrefs(_Strict):
    distanceUnit: Literal["km", "mi"] | None = None


class Preferences(_Strict):
    accessibility_settings: AccessibilityPrefs | None = None
    app_customization: AppPrefs | None = None
    ai_companion_settings: AICompanionPrefs | None = None
    match_preferences: MatchPrefs | None = None


Theme = Literal["light", "dark", "system"]


class SettingsOut(BaseModel):
    notifications_enabled: bool
    show_online_status: bool
    location_sharing: bool
    theme: Theme
    preferences: Preferences


class SettingsUpdate(_Strict):
    notifications_enabled: bool | None = None
    show_online_status: bool | None = None
    location_sharing: bool | None = None
    theme: Theme | None = None
    preferences: Preferences | None = None
