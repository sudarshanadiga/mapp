# Calendar Integration Service

A Flask-based calendar integration service that connects to CalDAV servers and provides AI-powered event generation capabilities.

## Features

- **CalDAV Integration**: Connect to any CalDAV-compatible calendar server (Nextcloud, Google Calendar, etc.)
- **AI Event Generation**: Generate personalized calendar events using OpenAI GPT-4
- **Weather Integration**: Real-time weather data with bad weather warnings as background events
- **RESTful API**: Full CRUD operations for calendar events
- **Scheduled Events**: Automated weekly and daily event creation
- **Multiple Calendar Views**: Week, Day, Month, and List views with full event filtering
- **Event Type Filtering**: Filter events by type (Work, Fun, Other) with color-coded styling
- **Authentication**: Basic user authentication system
- **Comprehensive Logging**: Structured logging for monitoring and debugging
- **Input Validation**: Robust validation for all API inputs

## Prerequisites

- Python 3.8+
- CalDAV server (Nextcloud, Google Calendar, etc.)
- OpenAI API key (for AI event generation)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd calendar_integration
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   # CalDAV Configuration
   CALDAV_SERVER_URL=https://your-caldav-server.com
   CALDAV_USERNAME=your_username
   CALDAV_PASSWORD=your_password
   CALENDAR_NAME=pitext_calendar
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   
   # Application Configuration
   HOST=0.0.0.0
   PORT=5000
   DEBUG=True
   ```

## Usage

### Starting the Service

```bash
python main.py
```

The service will start on the configured host and port (default: `http://localhost:5000`).

### API Endpoints

#### Health Check
```http
GET /calendar/
```

#### Get All Events
```http
GET /calendar/events?user_id=user1
Headers: X-API-Key: password123
```

#### Get Specific Event
```http
GET /calendar/events/{event_id}?user_id=user1
Headers: X-API-Key: password123
```

#### Create Event
```http
POST /calendar/events
Headers: X-API-Key: password123
Content-Type: application/json

{
  "title": "Team Meeting",
  "description": "Weekly team sync",
  "start_time": "2024-01-15T10:00:00",
  "end_time": "2024-01-15T11:00:00",
  "location": "Conference Room A"
}
```

#### Update Event
```http
PUT /calendar/events/{event_id}?user_id=user1
Headers: X-API-Key: password123
Content-Type: application/json

{
  "title": "Updated Team Meeting",
  "description": "Updated description"
}
```

#### Delete Event
```http
DELETE /calendar/events/{event_id}?user_id=user1
Headers: X-API-Key: password123
```

#### Generate AI Events
```http
POST /calendar/generate-events
Headers: X-API-Key: password123
Content-Type: application/json

{
  "interests": ["technology", "programming", "AI"]
}
```

### Calendar Interface

The calendar provides multiple view options:

- **Week View**: Traditional weekly grid layout
- **Day View**: Detailed daily schedule
- **Month View**: Monthly overview with event previews
- **List View**: Chronological list of events with filtering

#### Event Types and Filtering

Events are categorized into three types with distinct styling:

- **Work Events** (Blue): Professional and work-related activities
- **Fun Events** (Pink): Recreational and leisure activities  
- **Other Events** (Green): Miscellaneous events and reminders

Use the filter checkboxes in the toolbar to show/hide specific event types.

#### Features

- **Event Filtering**: Toggle visibility of Work, Fun, and Other events
- **Event Creation**: Click on any time slot to create new events
- **Event Editing**: Click on events to edit details
- **Drag & Drop**: Move events by dragging them to new times
- **Sleep Toggle**: Show/hide early (12 AM - 6 AM) and late (10 PM - 12 AM) hours
- **Dark Theme**: Toggle between light and dark themes

### Weather Integration

The calendar includes real-time weather integration with the following features:

#### Weather Classification Criteria
- **Temperature extremes**: Below 32°F or above 95°F
- **Precipitation**: Rain probability > 40%, snow, storms
- **Wind**: Speeds > 25 mph
- **Severe conditions**: Thunderstorms, blizzards, heat warnings

#### Weather API Endpoints
```http
GET /calendar/weather?location=New York
POST /calendar/weather/location
POST /calendar/weather/refresh
GET /calendar/weather/status
```

#### Weather Events
- Weather warnings appear as background events in the calendar
- Red background color for bad weather days
- Weather icons indicate weather type
- Hover tooltips display detailed forecasts
- Available in Week, Month, and Day views

#### Location Management
- Default location: New York
- Location input in calendar header
- Automatic geocoding for any city name
- Daily weather data updates at 6:00 AM

### Authentication

The service uses a simple API key authentication system:

- **user_id**: Passed as a query parameter
- **X-API-Key**: Passed as a header (acts as password)

Pre-configured users:
- `user1` / `password123` (interests: technology, programming)
- `user2` / `password456` (interests: sports, fitness)

### Scheduled Events

The service includes a scheduler that can automatically create events:

```python
from calendar_integration.tasks.scheduled_event_creator import scheduler

# Schedule weekly events
scheduler.schedule_weekly_events("user1", ["technology", "programming"], "monday")

# Schedule daily reminders
scheduler.schedule_daily_reminders("user1", "work")

# Start the scheduler
scheduler.start_scheduler()
```

## Configuration

### CalDAV Server Setup

1. **Nextcloud**: 
   - URL: `https://your-nextcloud.com/remote.php/dav/calendars/username/`
   - Username: Your Nextcloud username
   - Password: Your Nextcloud password

2. **Google Calendar**:
   - URL: `https://calendar.google.com/dav/`
   - Username: Your Google email
   - Password: App-specific password (not your regular password)

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `CALDAV_SERVER_URL` | CalDAV server URL | Yes | - |
| `CALDAV_USERNAME` | CalDAV username | Yes | - |
| `CALDAV_PASSWORD` | CalDAV password | Yes | - |
| `CALENDAR_NAME` | Calendar name to use | No | `pitext_calendar` |
| `OPENAI_API_KEY` | OpenAI API key | No | - |
| `HOST` | Application host | No | `0.0.0.0` |
| `PORT` | Application port | No | `5000` |
| `DEBUG` | Debug mode | No | `True` |

## Error Handling

The service includes comprehensive error handling:

- **Validation Errors**: Input validation with detailed error messages
- **Authentication Errors**: Proper HTTP 401 responses
- **OpenAI API Errors**: Rate limiting, authentication, and quota handling
- **CalDAV Errors**: Connection and calendar operation error handling
- **Logging**: All errors are logged with context

## Logging

Logs are written to both console and `calendar_integration.log` file. Log levels:
- `INFO`: General application flow
- `WARNING`: Non-critical issues
- `ERROR`: Errors that need attention

## Development

### Project Structure

```
calendar_integration/
├── api/                    # API routes and models
│   ├── calendar_routes.py  # Main API endpoints
│   ├── config.py          # Configuration management
│   ├── models.py          # Data models
│   └── auth.py            # Authentication
├── services/              # Business logic
│   ├── calendar_client.py # CalDAV client
│   └── event_generator.py # AI event generation
├── tasks/                 # Background tasks
│   └── scheduled_event_creator.py
├── utils/                 # Utilities
│   ├── logger.py          # Logging configuration
│   ├── validators.py      # Input validation
│   └── helpers.py         # Helper functions
├── main.py               # Application entry point
└── requirements.txt      # Dependencies
```

### Running Tests

```bash
# Run all tests
python -m pytest

# Run with coverage
python -m pytest --cov=calendar_integration
```

## Troubleshooting

### Common Issues

1. **CalDAV Connection Failed**:
   - Verify server URL, username, and password
   - Check if CalDAV is enabled on your server
   - Ensure network connectivity

2. **OpenAI API Errors**:
   - Verify API key is correct
   - Check API quota and rate limits
   - Ensure internet connectivity

3. **Authentication Failures**:
   - Verify user_id and API key combination
   - Check if user exists in the system

4. **Event Creation Failures**:
   - Verify event data format
   - Check start_time is before end_time
   - Ensure all required fields are provided

### Logs

Check the `calendar_integration.log` file for detailed error information and debugging.

## Security Considerations

- **Production Deployment**: Use HTTPS and proper authentication
- **API Keys**: Store API keys securely (use environment variables)
- **User Management**: Implement proper user management system
- **Input Validation**: All inputs are validated to prevent injection attacks
- **Logging**: Sensitive data is not logged

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License. 