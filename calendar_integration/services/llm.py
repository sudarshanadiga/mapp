import os
from openai import OpenAI
from string import Template

PROMPT_DIR = os.path.join(os.path.dirname(__file__), '..', 'prompts')

def load_prompt(filename):
    path = os.path.join(PROMPT_DIR, filename)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError('OpenAI API key not configured')
    return OpenAI(api_key=api_key)

def generate_followups(event_title, event_date, event_description):
    client = get_openai_client()
    prompt_template = load_prompt('followup_events.txt')
    
    # Format the prompt with the event details
    formatted_prompt = prompt_template.format(
        title=event_title, 
        date=event_date, 
        description=event_description
    )
    
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are an expert personal assistant and event planner."},
            {"role": "user", "content": formatted_prompt}
        ],
        max_tokens=500
    )
    content = response.choices[0].message.content
    return content.strip() if content else ""

def generate_mermaid_flowchart(event_title, event_date, followups):
    client = get_openai_client()
    prompt_template = load_prompt('mermaid_flowchart.txt')
    
    # Helper function to prettify dates
    def prettify_date(iso_date):
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
            return dt.strftime('%d %b %Y')
        except:
            return iso_date
    
    # Use string.Template for formatting with both ISO and pretty dates
    tmpl = Template(prompt_template)
    formatted_prompt = tmpl.safe_substitute(
        original_title=event_title,
        original_date=event_date,
        original_date_pretty=prettify_date(event_date),
        followup1_title=followups[0]['title'],
        followup1_date=followups[0]['date'],
        followup1_date_pretty=prettify_date(followups[0]['date']),
        followup2_title=followups[1]['title'],
        followup2_date=followups[1]['date'],
        followup2_date_pretty=prettify_date(followups[1]['date'])
    )
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a diagram generation assistant."},
            {"role": "user", "content": formatted_prompt}
        ],
        max_tokens=500
    )
    content = response.choices[0].message.content
    return content.strip() if content else "" 