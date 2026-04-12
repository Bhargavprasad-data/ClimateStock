import sys
import json
import traceback
import pickle
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

# Define the expected feature names
EXPECTED_FEATURES = [
    'Temperature', 'CDD', 'CDD_7', 'Heatwave', 'Return_Lag1', 'Return_Lag3',
    'Return_Lag5', 'Temp_Anomaly', 'CDD_Lag1', 'CDD_Lag3', 'MA_5', 'Volatility',
    'Demand_Trend', 'Trend', 'Volatility_Change'
]

def load_model():
    # Load the pickle file from the root Market directory, or if moved, adjust path
    # assuming we are running inside the backend folder, the model might be in ../
    model_path = '../xgb_stock_prediction_model_raw.pkl'
    try:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        return model
    except FileNotFoundError:
        # Fallback if the user copied it into the backend folder
        with open('xgb_stock_prediction_model_raw.pkl', 'rb') as f:
            model = pickle.load(f)
        return model

def main():
    try:
        input_data = sys.argv[1]
        data = json.loads(input_data)
        
        # User dynamic inputs
        temp = float(data.get('temperature', 35.0))
        heatwave = int(data.get('heatwave_flag', 0))
        ma_5 = float(data.get('ma_5', 635.0))
        ret_lag1 = float(data.get('lag1', 0.0))
        ret_lag3 = float(data.get('lag3', 0.0))
        ret_lag5 = float(data.get('lag5', 0.0))

        # We need to construct a dataframe matching EXPECTED_FEATURES perfectly
        input_dict = {
            'Temperature': temp,
            'CDD': max(0, temp - 25), # Crude Cooling Degree Days proxy if not provided
            'CDD_7': max(0, temp - 25) * 7.0,
            'Heatwave': float(heatwave),
            'Return_Lag1': ret_lag1,
            'Return_Lag3': ret_lag3,
            'Return_Lag5': ret_lag5,
            'Temp_Anomaly': temp - 30.0,  # Proxy anomaly
            'CDD_Lag1': max(0, temp - 25),
            'CDD_Lag3': max(0, temp - 25),
            'MA_5': ma_5,
            'Volatility': 0.0,
            'Demand_Trend': 0.0,
            'Trend': 0.0,
            'Volatility_Change': 0.0
        }

        # Create DataFrame to feed into model with correct column orders
        df = pd.DataFrame([input_dict], columns=EXPECTED_FEATURES)

        model = load_model()
        
        # Predict using DMatrix or DataFrame directly (XGBoost typically accepts DataFrame)
        # using the regressor's predict method
        prediction = model.predict(df)[0]
        
        print(json.dumps({
            "success": True,
            "prediction": float(prediction)
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
