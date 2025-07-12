#!/usr/bin/env python3
"""
Debug script for calendar integration.
Creates a test event that should be visible in the current month.
"""

import sys
import os
from datetime import datetime, timedelta
import json

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_test_event():
    """Create a test event for the current month."""
    from calendar_integration.services.calendar_client import CalendarClient
    
    client = CalendarClient()
    
    # Create an event for tomorrow at 2 PM
    tomorrow = datetime.now() + timedelta(days=1)
    start_time = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(hours=1)
    
    event_data = {
        'title': 'Debug Test Event',
        'description': 'This is a test event to debug calendar display',
        'location': 'Debug Location',
        'start_time': start_time.isoformat(),
        'end_time': end_time.isoformat(),
        'user_id': 'default_user',  # Use default_user to match the template
        'all_day': False,
        'type': 'debug'
    }
    
    try:
        result = client.create_event(event_data)
        print(f"✅ Created test event: {result}")
        return result
    except Exception as e:
        print(f"❌ Failed to create test event: {e}")
        return None

def check_stored_events():
    """Check what events are currently stored."""
    try:
        with open('calendar_events.json', 'r') as f:
            events = json.load(f)
        
        print(f"📅 Found {len(events)} stored events:")
        for i, event in enumerate(events, 1):
            print(f"  {i}. {event.get('title', 'No title')}")
            print(f"     User: {event.get('user_id', 'No user')}")
            print(f"     Start: {event.get('start_time', 'No start time')}")
            print(f"     End: {event.get('end_time', 'No end time')}")
            print()
        
        return events
    except Exception as e:
        print(f"❌ Failed to read events: {e}")
        return []

def test_api_endpoint():
    """Test the API endpoint directly."""
    import requests
    
    try:
        # Test the health endpoint
        response = requests.get('http://localhost:5000/calendar/health')
        print(f"🏥 Health check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        
        # Test the events endpoint
        response = requests.get('http://localhost:5000/calendar/events?user_id=default_user')
        print(f"📋 Events API: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {data}")
            events = data.get('data', [])
            print(f"   Found {len(events)} events for default_user")
        else:
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"❌ API test failed: {e}")

def main():
    """Run all debug functions."""
    print("🔍 Calendar Integration Debug")
    print("=" * 40)
    
    print("\n1. Checking stored events...")
    check_stored_events()
    
    print("\n2. Creating test event...")
    create_test_event()
    
    print("\n3. Checking stored events again...")
    check_stored_events()
    
    print("\n4. Testing API endpoints...")
    test_api_endpoint()
    
    print("\n✅ Debug complete!")
    print("\nNext steps:")
    print("1. Start the calendar service: python calendar_integration/main.py")
    print("2. Open http://localhost:5000/calendar/ in your browser")
    print("3. Check the browser console for debug messages")
    print("4. Look for the 'Debug Test Event' in tomorrow's calendar")

if __name__ == "__main__":
    main() 