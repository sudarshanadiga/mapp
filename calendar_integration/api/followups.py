"""
Endpoints that generate and serve "event echo" follow-ups,
including compact Mermaid flowcharts.
"""

from __future__ import annotations

from flask import Blueprint, request, make_response
import re
from datetime import timedelta, datetime

from calendar_integration.services.llm import generate_followups, generate_mermaid_flowchart
from calendar_integration.services.calendar_client import CalendarClient
from calendar_integration.utils.logger import get_logger
from calendar_integration.utils.datetime import parse_datetime
from calendar_integration.api._helpers import csrf_protect, ok, err, require_args

followups_bp = Blueprint("followups", __name__)
logger = get_logger(__name__)

client = CalendarClient()

# ---------------------------------------------------------------------
# Generate follow-up events and return them
# ---------------------------------------------------------------------
@followups_bp.post("/events/<string:event_id>/echo")
@require_args("user_id")
def create_echo(event_id: str):
    """Generate follow-up events for a given event, store them, and return Mermaid + new events."""
    user_id = request.args.get('user_id')
    if not user_id or not user_id.strip():
        logger.warning("Invalid or missing user_id in echo_event request")
        resp, status = err("user_id is required and must not be empty", 400)
        return make_response(resp, status)
    
    if not event_id:
        logger.warning("Missing event_id in echo_event request")
        resp, status = err("event_id is required", 400)
        return make_response(resp, status)
    
    user_id_str = user_id.strip()
    logger.info(f"Echo: Looking up parent event {event_id} for user: {user_id_str}")
    
    # Find the parent event
    events = client.fetch_events(user_id_str)
    parent_event = None
    for event in events:
        if isinstance(event, dict):
            event_id_from_data = event.get('id') or event.get('event_id')
            if str(event_id_from_data) == str(event_id):
                parent_event = event
                break
    
    if not parent_event or not isinstance(parent_event, dict):
        logger.warning(f"Parent event {event_id} not found for user: {user_id_str}")
        resp, status = err("Event not found", 404)
        return make_response(resp, status)
    
    # Generate follow-ups using LLM
    try:
        followup_text = generate_followups(
            parent_event.get('title', ''), 
            parent_event.get('start_time', ''), 
            parent_event.get('description', '')
        )
    except Exception as e:
        logger.error(f"Failed to generate follow-ups: {str(e)}")
        resp, status = err(f"OpenAI error (follow-up generation): {str(e)}", 500)
        return make_response(resp, status)
    
    # Parse follow-up events (reuse logic from llm_flowchart)
    followups = []
    sections = re.split(r'\n(?=\d+\.)', followup_text)
    
    for section in sections:
        if not section.strip():
            continue
        
        title_match = re.search(r'Title:\s*(.+?)(?:\n|$)', section, re.IGNORECASE)
        desc_match = re.search(r'Description:\s*(.+?)(?:\n|$)', section, re.IGNORECASE)
        date_match = re.search(r'Date:\s*(.+?)(?:\n|$)', section, re.IGNORECASE)
        
        if title_match and date_match:
            followups.append({
                "title": title_match.group(1).strip(),
                "description": desc_match.group(1).strip() if desc_match else "",
                "date": date_match.group(1).strip()
            })
    
    if len(followups) < 2:
        # fallback simple parsing
        followups = []
        lines = followup_text.strip().split('\n')
        current_followup = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.lower().startswith('title:'):
                if current_followup and 'title' in current_followup and 'date' in current_followup:
                    followups.append(current_followup)
                current_followup = {'title': line.split(':', 1)[1].strip()}
            elif line.lower().startswith('description:'):
                current_followup['description'] = line.split(':', 1)[1].strip()
            elif line.lower().startswith('date:'):
                current_followup['date'] = line.split(':', 1)[1].strip()
        
        if current_followup and 'title' in current_followup and 'date' in current_followup:
            followups.append(current_followup)
    
    if len(followups) < 2:
        logger.error(f"Failed to parse enough follow-ups. Got {len(followups)}, need 2. Text: {followup_text}")
        followups = [
            {"title": "Follow-up appointment", "description": "Check progress", "date": "1 week later"},
            {"title": "Final check", "description": "Ensure everything is fine", "date": "1 month later"}
        ]
    
    # Generate Mermaid code
    try:
        mermaid_code = generate_mermaid_flowchart(
            parent_event.get('title', ''), 
            parent_event.get('start_time', ''), 
            followups
        )
    except Exception as e:
        logger.error(f"Failed to generate Mermaid code: {str(e)}")
        resp, status = err(f"OpenAI error (Mermaid generation): {str(e)}", 500)
        return make_response(resp, status)
    
    # Insert each follow-up as a new event
    created = []
    # Parse original event's start/end and all_day
    orig_start = parent_event.get('start_time')
    orig_end = parent_event.get('end_time')
    orig_all_day = parent_event.get('all_day', False)
    
    # helper
    def _to_dt(value):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return parse_datetime(value)
            except Exception:
                return None
        return None
    
    orig_start_dt = _to_dt(orig_start)
    orig_end_dt = _to_dt(orig_end)
    
    for f in followups:
        followup_date = f.get('date')
        try:
            followup_date_dt = parse_datetime(followup_date) if isinstance(followup_date, str) else None
        except Exception:
            followup_date_dt = None
        
        if orig_all_day or not orig_start_dt or not followup_date_dt:
            # All-day: end = next day
            start_time = followup_date if isinstance(followup_date, str) else ''
            if followup_date_dt:
                end_time = (followup_date_dt + timedelta(days=1)).date().isoformat()
            else:
                end_time = start_time
            all_day = True
        else:
            # Use original event's time, but on the follow-up date
            start_time_dt = followup_date_dt.replace(hour=orig_start_dt.hour, minute=orig_start_dt.minute, second=0, microsecond=0)
            if orig_end_dt:
                end_time_dt = followup_date_dt.replace(hour=orig_end_dt.hour, minute=orig_end_dt.minute, second=0, microsecond=0)
            else:
                end_time_dt = start_time_dt + timedelta(hours=1)
            start_time = start_time_dt.isoformat() if isinstance(start_time_dt, datetime) else str(start_time_dt)
            end_time = end_time_dt.isoformat() if isinstance(end_time_dt, datetime) else str(end_time_dt)
            all_day = False
        
        event_data = {
            'title': f.get('title', ''),
            'description': f.get('description', ''),
            'start_time': start_time,
            'end_time': end_time,
            'user_id': user_id_str,
            'all_day': all_day,
            'type': 'echo',
            'flowchart': mermaid_code
        }
        
        result = client.create_event(event_data)
        if isinstance(result, dict) and 'error' not in result:
            created.append(result)

    # Update parent event to store flowchart and echo event IDs
    parent_update = {
        'flowchart': mermaid_code,
        'echo_event_ids': [ev.get('event_id') or ev.get('id') for ev in created]
    }
    try:
        client.update_event(event_id, parent_update)
    except Exception as e:
        logger.warning(f"Failed to update parent event with flowchart: {e}")

    # Return Mermaid and new events
    resp, status = ok({
        'mermaid': mermaid_code,
        'events': created
    }, 201)
    return make_response(resp, status)

# ---------------------------------------------------------------------
# Return a Mermaid flowchart for an event chain
# ---------------------------------------------------------------------
@followups_bp.get("/events/<string:event_id>/flowchart")
def flowchart(event_id: str):
    """Generate a Mermaid flowchart for an event and two LLM-generated follow-ups."""
    data = request.get_json()
    if not data:
        return err("Missing request body", 400)

    # Extract event details
    event_title = data.get('title', '')
    event_date = data.get('date', '') or data.get('start_time', '')
    event_description = data.get('description', '')

    if not event_title or not event_date:
        return err("Event title and date are required", 400)

    # First LLM call: generate two follow-up events
    try:
        followup_text = generate_followups(event_title, event_date, event_description)
    except Exception as e:
        logger.error(f"Failed to generate follow-ups: {str(e)}")
        return err(f"OpenAI error (follow-up generation): {str(e)}", 500)

    # Parse follow-up events from LLM output with more flexible parsing
    followups = []
    
    # Split by numbers (1., 2., etc.) to handle various formats
    sections = re.split(r'\n(?=\d+\.)', followup_text)
    
    for section in sections:
        if not section.strip():
            continue
            
        # Extract title, description, and date more flexibly
        title_match = re.search(r'Title:\s*(.+?)(?:\n|$)', section, re.IGNORECASE)
        desc_match = re.search(r'Description:\s*(.+?)(?:\n|$)', section, re.IGNORECASE)
        date_match = re.search(r'Date:\s*(.+?)(?:\n|$)', section, re.IGNORECASE)
        
        if title_match and date_match:
            followups.append({
                "title": title_match.group(1).strip(),
                "description": desc_match.group(1).strip() if desc_match else "",
                "date": date_match.group(1).strip()
            })
    
    # If parsing failed, try a simpler approach
    if len(followups) < 2:
        logger.warning(f"Complex parsing failed, trying simple parsing. Original text: {followup_text}")
        followups = []
        lines = followup_text.strip().split('\n')
        current_followup = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.lower().startswith('title:'):
                if current_followup and 'title' in current_followup and 'date' in current_followup:
                    followups.append(current_followup)
                current_followup = {'title': line.split(':', 1)[1].strip()}
            elif line.lower().startswith('description:'):
                current_followup['description'] = line.split(':', 1)[1].strip()
            elif line.lower().startswith('date:'):
                current_followup['date'] = line.split(':', 1)[1].strip()
        
        # Add the last followup if valid
        if current_followup and 'title' in current_followup and 'date' in current_followup:
            followups.append(current_followup)
    
    # Ensure we have at least 2 follow-ups
    if len(followups) < 2:
        logger.error(f"Failed to parse enough follow-ups. Got {len(followups)}, need 2. Text: {followup_text}")
        # Create default follow-ups as fallback
        followups = [
            {"title": "Follow-up appointment", "description": "Check progress", "date": "1 week later"},
            {"title": "Final check", "description": "Ensure everything is fine", "date": "1 month later"}
        ]

    # Second LLM call: generate Mermaid flowchart code
    try:
        mermaid_code = generate_mermaid_flowchart(event_title, event_date, followups)
    except Exception as e:
        logger.error(f"Failed to generate Mermaid code: {str(e)}")
        return err(f"OpenAI error (Mermaid generation): {str(e)}", 500)

    return ok({
        "mermaid_code": mermaid_code,
        "followups": followups[:2],  # Ensure we only return 2 followups
        "llm_output": followup_text
    }) 