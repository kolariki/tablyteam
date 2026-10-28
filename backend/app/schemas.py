from typing import Literal

from pydantic import BaseModel, Field

Mode = Literal["handoff", "debate", "roundtable", "review"]


class AgentConfig(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9_-]{1,32}$")
    name: str
    provider: str
    model: str
    persona: str = ""
    role: str | None = None  # id from roles.ROLES; persona is editable on top of it
    color: str | None = None
    temperature: float = 0.8
    wanted_provider: str | None = None  # brand to show when simulated with "mock"
    skills: list[str] = Field(default_factory=list)  # user skill ids (or tpl-* templates) attached to this role


class SessionConfig(BaseModel):
    topic: str
    mode: Mode = "handoff"
    agents: list[AgentConfig] = Field(min_length=2, max_length=8)
    max_turns: int = Field(default=12, ge=1, le=60)
    min_turns: int = Field(default=4, ge=1, le=60)
    language: str = "español rioplatense"
    final_vote: bool = True
    closing_round: bool = Field(default=True, description="after the debate, each role delivers its final decisions for the build doc")
    starter: str | None = None
    max_tokens: int = Field(default=1800, ge=100, le=8000)
    pace_ms: int = Field(default=600, ge=0, le=5000, description="Pause between turns so the camera can follow")
    title: str | None = None
    judge: str | None = Field(default=None, description="agent id whose model writes the verdict explanation; 'none' to skip")
    context: str | None = Field(default=None, description="review mode: the delivered project (brief + tree + key files) the council discusses")
    auto_skills: bool = Field(default=False, description="let the council pick catalog skills per role from the task before starting")
    platform: Literal["web", "mobile", "both"] = Field(default="web", description="what gets built: a web app, a mobile app (iOS + Android, Expo) or both")
    references: list[str] = Field(default_factory=list, description="reference apps / URLs the team studies before designing (research phase of the build)")
    references_auto: bool = Field(default=False, description="the references are the preset's own (never shown to the user); the user's, when given, replace them")
    deep_analysis: bool = Field(default=False, description="paid per use: REA reverse-engineering of the reference apps during the build (needs REA + a local engine)")
    review_of: dict | None = Field(default=None, description="review mode: {build_id, session_id, title, round} of the build under review")
