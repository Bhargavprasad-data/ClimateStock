import sys
import json
import urllib.request
import urllib.error
import traceback

def get_available_models(api_key):
    # Trim key and strip quotes (Node might pass them if .env was quoted)
    api_key = api_key.strip().strip('"').strip("'")
    errors = []
    # Try both v1beta and v1 endpoints
    for version in ["v1beta", "v1"]:
        try:
            url = f"https://generativelanguage.googleapis.com/{version}/models?key={api_key}"
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                valid_models = []
                for m in data.get('models', []):
                    if 'generateContent' in m.get('supportedGenerationMethods', []):
                        model_name = m['name'].split('/')[-1]
                        valid_models.append(model_name)
                if valid_models:
                    return valid_models, ""
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8')
            errors.append(f"{version}: {e.code} - {msg}")
        except Exception as e:
            errors.append(f"{version}: {str(e)}")
    return [], " | ".join(errors)

def call_gemini(api_key, full_prompt, history):
    api_key = api_key.strip()
    # Expanded priority list with latest naming conventions
    priority_models = [
        "gemini-1.5-flash",
        "gemini-flash-latest",
        "gemini-1.5-pro",
        "gemini-pro-latest",
        "gemini-2.0-flash",
        "gemini-1.0-pro",
        "gemini-pro"
    ]
    
    # Pre-fetch what models are actually allowed by the API key
    available, disc_err = get_available_models(api_key)
    
    # Construct the final list to try
    models_to_try = [m for m in priority_models if m in available]
    for m in available:
        if m not in models_to_try:
            models_to_try.append(m)
            
    if not models_to_try:
        models_to_try = ["gemini-1.5-flash", "gemini-pro"]
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # Build conversation contents including history
    contents = []
    for msg in (history or []):
        # Map frontend roles to Gemini roles
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.get("content", "")}]
        })
    
    # Add the current interaction
    contents.append({
        "role": "user",
        "parts": [{"text": full_prompt}]
    })
    
    payload = { "contents": contents }
    data = json.dumps(payload).encode('utf-8')
    
    last_error = ""

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        
        try:
            with urllib.request.urlopen(req) as response:
                response_data = response.read().decode('utf-8')
                json_resp = json.loads(response_data)
                
                try:
                    reply_text = json_resp['candidates'][0]['content']['parts'][0]['text']
                    return True, reply_text
                except (KeyError, IndexError):
                    return False, f"Could not parse Gemini response: {json_resp}"
                    
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8')
            last_error = f"HTTP Error {e.code} for {model}: {err_msg}"
            continue # Try the next model
        except Exception as e:
            last_error = str(e)
            continue
            
    return False, f"All models failed. Pre-fetched: {available}. Discovery Errors: {disc_err}. Last Error: {last_error}"

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            # Fallback to argv for local manual testing
            input_data = sys.argv[1] if len(sys.argv) > 1 else "{}"
            
        data = json.loads(input_data)
        
        message = data.get('message', '')
        system_instruction = data.get('systemInstruction', '')
        api_key = data.get('apiKey', '')
        history = data.get('history', [])
        
        if not api_key:
            print(json.dumps({"success": False, "error": "API Key is missing in backend Environment."}))
            sys.exit(1)
            
        full_prompt = f"{system_instruction}\n\nUser Question: {message}"
        success, reply = call_gemini(api_key, full_prompt, history)
        
        if success:
            print(json.dumps({"success": True, "reply": reply}))
        else:
            print(json.dumps({"success": False, "error": reply}))
            
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
