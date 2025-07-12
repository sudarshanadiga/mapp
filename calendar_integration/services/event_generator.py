# services/event_generator.py
from datetime import datetime, timedelta
from openai import OpenAI
import os
import re
from calendar_integration.models import CalendarEvent
from calendar_integration.utils.logger import get_logger

logger = get_logger(__name__)

class EventGenerator:
    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            self.client = OpenAI(api_key=api_key)
            self.initialized = True
            logger.info("Event generator initialized successfully")
        else:
            logger.warning("OpenAI API key not found - event generation will be disabled")
            self.client = None
            self.initialized = False

    def _parse_datetime_from_text(self, text: str, base_date: datetime) -> datetime:
        """Parse datetime from text using various patterns."""
        text = text.lower().strip()
        
        # Try to extract date/time patterns
        patterns = [
            r'(\d{1,2}):(\d{2})\s*(am|pm)?',  # Time patterns
            r'(\d{1,2})/(\d{1,2})/(\d{4})',   # Date patterns
            r'(\d{1,2})-(\d{1,2})-(\d{4})',   # Date patterns with dashes
            r'tomorrow',                       # Tomorrow
            r'next\s+(\w+)',                   # Next day of week
            r'in\s+(\d+)\s+days?',             # In X days
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                if 'tomorrow' in text:
                    return base_date + timedelta(days=1)
                elif 'next' in text:
                    # Simple implementation - could be enhanced
                    return base_date + timedelta(days=1)
                elif 'in' in text and 'days' in text:
                    days = int(match.group(1))
                    return base_date + timedelta(days=days)
        
        # Default to tomorrow if no pattern found
        return base_date + timedelta(days=1)

    def generate(self, user_data: dict):
        if not self.initialized or not self.client:
            logger.error("Event generator not initialized")
            return {"error": "Event generator not initialized - check OpenAI API key"}
        
        try:
            interests = user_data.get('interests', [])
            today = datetime.utcnow()
            generated_events = []

            prompt = f"""Generate 3-5 calendar events based on these interests: {', '.join(interests)}. 
            For each event, provide:
            - Title: [event title]
            - Description: [brief description]
            - Date: [specific date or relative date like 'tomorrow', 'next Monday', 'in 3 days']
            - Time: [specific time like '2:00 PM' or '14:00']
            - Duration: [duration in hours, default 1 hour]
            - Location: [location or 'Online' if virtual]
            
            Format each event with clear labels."""

            logger.info(f"Generating events for interests: {interests}")
            
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4.1",
                    messages=[
                        {"role": "system", "content": "You are an AI assistant creating structured calendar events. Always provide complete event details with clear formatting."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=800
                )
            except Exception as api_error:
                error_msg = str(api_error)
                if "rate_limit" in error_msg.lower() or "429" in error_msg:
                    logger.error("OpenAI API rate limit exceeded")
                    return {"error": "Rate limit exceeded. Please try again later."}
                elif "authentication" in error_msg.lower() or "401" in error_msg:
                    logger.error("OpenAI API authentication failed")
                    return {"error": "OpenAI API authentication failed. Check your API key."}
                elif "quota" in error_msg.lower():
                    logger.error("OpenAI API quota exceeded")
                    return {"error": "OpenAI API quota exceeded. Please check your account."}
                else:
                    logger.error(f"OpenAI API error: {error_msg}")
                    return {"error": f"OpenAI API error: {error_msg}"}

            content = response.choices[0].message.content
            if not content:
                logger.warning("Empty response from OpenAI")
                return generated_events

            # Split content into individual events
            event_blocks = content.split('\n\n')
            
            for block in event_blocks:
                if not block.strip():
                    continue
                    
                try:
                    # Parse event details
                    lines = [line.strip() for line in block.split('\n') if line.strip()]
                    
                    title = ""
                    description = ""
                    date_str = ""
                    time_str = ""
                    duration = 1  # default 1 hour
                    location = ""
                    
                    for line in lines:
                        if line.startswith('Title:'):
                            title = line.replace('Title:', '').strip()
                        elif line.startswith('Description:'):
                            description = line.replace('Description:', '').strip()
                        elif line.startswith('Date:'):
                            date_str = line.replace('Date:', '').strip()
                        elif line.startswith('Time:'):
                            time_str = line.replace('Time:', '').strip()
                        elif line.startswith('Duration:'):
                            duration_str = line.replace('Duration:', '').strip()
                            try:
                                duration = int(duration_str.split()[0])  # Extract number from "2 hours"
                            except:
                                duration = 1
                        elif line.startswith('Location:'):
                            location = line.replace('Location:', '').strip()
                    
                    if not title:
                        continue
                        
                    # Parse start time
                    start_time = self._parse_datetime_from_text(f"{date_str} {time_str}", today)
                    
                    # Calculate end time based on duration
                    end_time = start_time + timedelta(hours=duration)
                    
                    event = CalendarEvent(
                        title=title,
                        description=description,
                        start_time=start_time,
                        end_time=end_time,
                        location=location or "TBD"
                    )
                    
                    generated_events.append(event.to_dict())
                    logger.info(f"Generated event: {title}")
                    
                except Exception as e:
                    logger.error(f"Failed to parse event block: {e}")
                    continue

            logger.info(f"Successfully generated {len(generated_events)} events")
            return generated_events
            
        except Exception as e:
            logger.error(f"Failed to generate events: {str(e)}")
            return {"error": f"Failed to generate events: {str(e)}"}
# Event Generator Service 