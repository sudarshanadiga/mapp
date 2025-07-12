#!/usr/bin/env python3
"""
Test script to verify event creation and storage.
"""

import json
import os
import sys
from datetime import datetime, timedelta

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.calendar_client import CalendarClient

def test_event_creation():
    """Test creating an event and verifying it's saved."""
    print("=== Testing Event Creation ===")
    
    # Initialize client
    client = CalendarClient()
    
    # Create a test event
    test_event = {
        'title': 'Test Event',
        'description': 'This is a test event',
        'start_time': datetime.now().isoformat(),
        'end_time': (datetime.now() + timedelta(hours=1)).isoformat(),
        'user_id': 'test_user',
        'eventType': '',  # Regular event
        'location': 'Test Location'
    }
    
    print(f"Creating event: {test_event['title']}")
    
    try:
        # Create the event
        created_event = client.create_event(test_event)
        print(f"✅ Event created successfully!")
        print(f"   Event ID: {created_event.get('event_id')}")
        print(f"   Title: {created_event.get('title')}")
        print(f"   Event Type: '{created_event.get('eventType')}'")
        
        # Verify it's in storage
        all_events = client.fetch_events('test_user')
        print(f"📊 Total events for test_user: {len(all_events)}")
        
        # Check if our event is there
        found = False
        for event in all_events:
            if event.get('title') == test_event['title']:
                found = True
                print(f"✅ Event found in storage!")
                print(f"   Stored Event Type: '{event.get('eventType')}'")
                break
        
        if not found:
            print("❌ Event not found in storage!")
            return False
            
        # Test filtering
        print("\n=== Testing Filter Logic ===")
        work_events = [e for e in all_events if e.get('eventType') == '' or e.get('eventType') == 'work']
        print(f"Work/Regular events: {len(work_events)}")
        
        for event in work_events:
            print(f"   - {event.get('title')} (type: '{event.get('eventType')}')")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating event: {e}")
        return False

def check_storage_file():
    """Check the storage file directly."""
    print("\n=== Checking Storage File ===")
    
    file_path = "calendar_events.json"
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            print(f"📁 Storage file exists: {file_path}")
            print(f"📊 Total events in file: {len(data)}")
            
            for i, event in enumerate(data):
                print(f"   Event {i+1}: {event.get('title')} (type: '{event.get('eventType')}')")
                
        except Exception as e:
            print(f"❌ Error reading storage file: {e}")
    else:
        print(f"❌ Storage file not found: {file_path}")

if __name__ == "__main__":
    print("Calendar Integration Event Creation Test")
    print("=" * 50)
    
    # Check storage file first
    check_storage_file()
    
    # Test event creation
    success = test_event_creation()
    
    # Check storage file again
    check_storage_file()
    
    if success:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Tests failed!")
        sys.exit(1) 