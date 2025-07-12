# api/config.py
import os

class Config:
    # Local database configuration
    CALENDAR_EVENTS_FILE = os.getenv('CALENDAR_EVENTS_FILE', 'calendar_events.json')
    CALENDAR_NAME = os.getenv('CALENDAR_NAME', 'pitext_calendar')

    @staticmethod
    def validate():
        # No validation needed for local database
        pass

if os.path.exists('calendar_events.json'):
    os.remove('calendar_events.json')

# Calendar API Configuration 