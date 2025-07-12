# pitext_travel/api/chat.py
import os, json
from flask import Blueprint, request, jsonify, session
import openai
from pitext_travel.api.llm import generate_trip_itinerary

bp_chat = Blueprint("chat", __name__, url_prefix="/travel/api")

# Initialize OpenAI
api_key = os.getenv('OPENAI_API_KEY')
if api_key:
    openai.api_key = api_key
else:
    print("Warning: OPENAI_API_KEY not found. Travel features will be limited.")

# Keep conversation context
MAX_HISTORY = 20

# Improved function schemas
FUNCTIONS = [
    {
        "name": "plan_trip",
        "description": "Plan a multi-day itinerary for a city. Use this when the user provides BOTH a city name AND number of days.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city name for the trip"
                },
                "days": {
                    "type": "integer", 
                    "description": "Number of days for the trip",
                    "minimum": 1, 
                    "maximum": 14
                }
            },
            "required": ["city", "days"]
        }
    },
    {
        "name": "explain_day",
        "description": "Explain the itinerary for a specific day or provide an overview of all days",
        "parameters": {
            "type": "object",
            "properties": {
                "day_number": {
                    "type": "integer",
                    "description": "The day number to explain (1-based), or 0 for overview",
                    "minimum": 0
                }
            },
            "required": ["day_number"]
        }
    }
]

@bp_chat.route("/chat", methods=["POST"])
def chat():
    user_text = request.json.get("text", "").strip()
    if not user_text:
        return jsonify({"reply": "I didn't catch that."})

    # Initialize session data if needed
    if 'chat_history' not in session:
        session['chat_history'] = []
        session['pending_trip'] = {}
    
    history = session.get('chat_history', [])
    
    # System message that helps the model understand context better
    system_message = {
        "role": "system", 
        "content": """You are a friendly travel planning assistant. Your main job is to help users plan trips by creating detailed itineraries.

IMPORTANT INSTRUCTIONS:
1. When a user mentions wanting to plan a trip to a city but doesn't specify days, ask them how many days they'd like to spend there.
2. When you have BOTH the city name AND number of days, immediately call the plan_trip function.
3. If a user provides a number after you've asked about days, understand that's the number of days for the previously mentioned city.
4. Be conversational but focused on gathering the needed information.
5. Common phrases: "3 days", "three days", "a week" (7 days), "weekend" (2 days), "long weekend" (3 days).
6. When users ask about specific days or want an overview, use the explain_day function.
7. Phrases like "first day", "day 1", "explain the trip", "tell me about day 2" should trigger explain_day.

Current context: """ + json.dumps(session.get('pending_trip', {}))
    }
    
    # Add user message
    history.append({"role": "user", "content": user_text})
    
    # Keep history manageable but include system message
    messages = [system_message] + history[-MAX_HISTORY:]

    try:
        resp = openai.chat.completions.create(
            model="gpt-4.1",
            messages=messages,
            functions=FUNCTIONS,
            function_call="auto",
            temperature=0.7
        ).choices[0].message

        # Handle function calls
        if resp.function_call:
            name = resp.function_call.name
            args = json.loads(resp.function_call.arguments or "{}")

            if name == "plan_trip":
                try:
                    # Generate itinerary
                    itinerary = generate_trip_itinerary(args["city"], args["days"])
                    
                    # Store the itinerary in session
                    session['current_itinerary'] = itinerary
                    session['current_city'] = args["city"]
                    session['current_days'] = args["days"]
                    
                    # Clear pending trip
                    session['pending_trip'] = {}

                    # Add to history
                    history.append({
                        "role": "assistant",
                        "content": f"I've created a wonderful {args['days']}-day itinerary for {args['city']}!"
                    })
                    session['chat_history'] = history
                    session.modified = True

                    return jsonify({
                        "reply": f"I've created a wonderful {args['days']}-day itinerary for {args['city']}! You can see it on the map. Would you like me to explain any specific day or give you an overview?",
                        "itinerary": itinerary
                    })
                except Exception as e:
                    return jsonify({"reply": f"Sorry, I couldn't plan that trip: {str(e)}"})
                    
            elif name == "explain_day":
                if 'current_itinerary' not in session:
                    return jsonify({"reply": "I don't have a current itinerary to explain. Would you like me to plan a trip first?"})
                
                itinerary = session['current_itinerary']
                city = session.get('current_city', 'your destination')
                day_num = args.get("day_number", 0)
                
                if day_num == 0:
                    # Overview
                    reply = f"Here's an overview of your {len(itinerary['days'])}-day trip to {city}:\n\n"
                    for i, day in enumerate(itinerary['days']):
                        reply += f"**{day.get('label', f'Day {i+1}')}**: "
                        stops = [stop['name'] for stop in day['stops']]
                        reply += ", ".join(stops) + "\n"
                else:
                    # Specific day
                    if 0 < day_num <= len(itinerary['days']):
                        day = itinerary['days'][day_num - 1]
                        reply = f"On {day.get('label', f'Day {day_num}')} in {city}, you'll visit:\n\n"
                        for j, stop in enumerate(day['stops'], 1):
                            reply += f"{j}. **{stop['name']}**"
                            if 'placeType' in stop:
                                reply += f" ({stop['placeType'].replace('_', ' ')})"
                            reply += "\n"
                        reply += f"\nThis day includes {len(day['stops'])} stops. Would you like details about any other day?"
                    else:
                        reply = f"I don't have information for day {day_num}. Your trip is {len(itinerary['days'])} days long."
                
                history.append({"role": "assistant", "content": reply})
                session['chat_history'] = history
                session.modified = True
                
                return jsonify({"reply": reply})

        # Regular text response
        else:
            # Add assistant response to history
            history.append({"role": "assistant", "content": resp.content})
            session['chat_history'] = history
            session.modified = True
            
            return jsonify({"reply": resp.content})

    except Exception as e:
        print(f"Chat error: {str(e)}")
        return jsonify({"reply": "I encountered an error. Please try again."})