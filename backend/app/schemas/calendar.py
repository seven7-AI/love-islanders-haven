from pydantic import BaseModel, ConfigDict, Field


class CalendarStatus(BaseModel):
    available: bool
    connected: bool


class AuthorizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    return_to: str = Field(default="/profile", pattern=r"^/[A-Za-z0-9/_\-]*$", max_length=100)


class AuthorizeResponse(BaseModel):
    authorization_url: str


class CallbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=512)
    state: str = Field(min_length=1, max_length=1024)


class CallbackResponse(BaseModel):
    connected: bool
    return_to: str


class CalendarEventOut(BaseModel):
    id: str
    title: str
    location: str | None
    notes: str | None
    start: str
    end: str | None
