from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class CalendarEvent:
    title: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    flowchart: Optional[str] = None
    event_id: Optional[str] = None
    user_id: Optional[str] = None
    type: Optional[str] = None
    echo_event_ids: Optional[list] = None

    def to_dict(self):
        return {
            "title": self.title,
            "description": self.description,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "location": self.location,
            "flowchart": self.flowchart,
            "event_id": self.event_id,
            "user_id": self.user_id,
            "type": self.type,
            "echo_event_ids": self.echo_event_ids
        } 