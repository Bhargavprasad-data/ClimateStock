import sys
import json
import traceback
import pickle
import os
import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

# Define the expected feature names for the XGBoost regressor
XGB_FEATURES = [
    'Temperature', 'CDD', 'CDD_7', 'Heatwave', 'Return_Lag1', 'Return_Lag3',
    'Return_Lag5', 'Temp_Anomaly', 'CDD_Lag1', 'CDD_Lag3', 'MA_5', 'Volatility',
    'Demand_Trend', 'Trend', 'Volatility_Change'
]

def resolve_path(filename):
    """Resolve model path: try relative to backend, then project root."""
    # Running from backend/ directory
    root_path = os.path.join('..', filename)
    if os.path.exists(root_path):
        return root_path
    # Running from project root
    if os.path.exists(filename):
        return filename
    # Inside backend/
    local_path = os.path.join(os.path.dirname(__file__), '..', filename)
    if os.path.exists(local_path):
        return local_path
    raise FileNotFoundError(f"Model file '{filename}' not found")

def load_model(filename):
    """Load a pickle model file."""
    path = resolve_path(filename)
    with open(path, 'rb') as f:
        model = pickle.load(f)
    return model

def get_model_features(model, fallback_features):
    """Try to extract feature names from a trained model, fall back to provided list."""
    if hasattr(model, 'feature_names_in_'):
        return list(model.feature_names_in_)
    if hasattr(model, 'get_booster'):
        booster = model.get_booster()
        if booster.feature_names:
            return booster.feature_names
    return fallback_features

def build_feature_dict(temp, heatwave, ma_5, ret_lag1, ret_lag3, ret_lag5):
    """Build a full feature dictionary from the user-provided inputs."""
    cdd = max(0, temp - 25)
    return {
        'Temperature': temp,
        'CDD': cdd,
        'CDD_7': cdd * 7.0,
        'Heatwave': float(heatwave),
        'Return_Lag1': ret_lag1,
        'Return_Lag3': ret_lag3,
        'Return_Lag5': ret_lag5,
        'Temp_Anomaly': temp - 30.0,
        'CDD_Lag1': cdd,
        'CDD_Lag3': cdd,
        'MA_5': ma_5,
        'Volatility': abs(ret_lag1) * 0.5 if ret_lag1 != 0 else 0.015,
        'Demand_Trend': cdd * 0.1,
        'Trend': 1.0 if ret_lag1 > 0 else (-1.0 if ret_lag1 < 0 else 0.0),
        'Volatility_Change': 0.0
    }

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
        symbol = str(data.get('symbol', 'ADANIPOWER.NS'))

        # Build feature dictionary
        feature_dict = build_feature_dict(temp, heatwave, ma_5, ret_lag1, ret_lag3, ret_lag5)

        # ── Fetch Fundamentals from yfinance (NEW) ────────────────────────
        fundamentals = {}
        try:
            import yfinance as yf
            
            # Map simple database symbols to explicit Yahoo Finance NSE tickers
            yf_map = {
                "ADANI": "ADANIPOWER.NS",
                "RELIANCE": "RELIANCE.NS",
                "TATA": "TATAPOWER.NS",
                "NTPC": "NTPC.NS",
                "POWERGRID": "POWERGRID.NS"
            }
            yf_symbol = yf_map.get(symbol.upper(), symbol)
            if '.' not in yf_symbol:
                yf_symbol += ".NS"

            stock_info = yf.Ticker(yf_symbol).info
            fundamentals = {
                "marketCap": stock_info.get("marketCap"),
                "peRatio": stock_info.get("trailingPE", stock_info.get("forwardPE")),
                "dividendYield": stock_info.get("dividendYield", stock_info.get("trailingAnnualDividendYield")),
                "fiftyTwoWeekHigh": stock_info.get("fiftyTwoWeekHigh"),
                "fiftyTwoWeekLow": stock_info.get("fiftyTwoWeekLow"),
                "sector": stock_info.get("sector", "Energy")
            }
        except Exception as yf_err:
            fundamentals = {"error": f"Could not fetch fundamentals: {str(yf_err)}"}

        # ── Load XGBoost Regressor (price prediction) ──────────────────────
        xgb_model = load_model('xgb_stock_prediction_model_raw.pkl')
        xgb_features = get_model_features(xgb_model, XGB_FEATURES)

        # Build DataFrame with the exact features the XGBoost model expects
        xgb_input = {}
        for feat in xgb_features:
            xgb_input[feat] = feature_dict.get(feat, 0.0)
        xgb_df = pd.DataFrame([xgb_input], columns=xgb_features)

        predicted_price = float(xgb_model.predict(xgb_df)[0])

        # ── Load RF Classifier (trend classification) ──────────────────────
        rf_trend = None
        rf_confidence = None
        rf_probabilities = None

        try:
            rf_model = load_model('rf_classifier_20k_model.pkl')
            rf_features = get_model_features(rf_model, XGB_FEATURES)

            # Build DataFrame for RF with its expected features
            rf_input = {}
            for feat in rf_features:
                rf_input[feat] = feature_dict.get(feat, 0.0)
            rf_df = pd.DataFrame([rf_input], columns=rf_features)

            # Predict trend class
            rf_pred = rf_model.predict(rf_df)[0]

            # Map class to label
            if hasattr(rf_model, 'classes_'):
                classes = list(rf_model.classes_)
                # If classes are strings like 'Bullish', 'Bearish', 'Neutral'
                if isinstance(rf_pred, str):
                    rf_trend = rf_pred
                else:
                    # If classes are numeric (0, 1, 2), map them
                    class_map = {0: 'Bearish', 1: 'Neutral', 2: 'Bullish'}
                    # Try to infer from class labels
                    if all(isinstance(c, str) for c in classes):
                        rf_trend = rf_pred
                    else:
                        rf_trend = class_map.get(int(rf_pred), 'Neutral')
            else:
                rf_trend = str(rf_pred)

            # Get prediction probabilities for confidence
            if hasattr(rf_model, 'predict_proba'):
                probas = rf_model.predict_proba(rf_df)[0]
                rf_confidence = float(max(probas) * 100)
                rf_probabilities = {
                    str(c): round(float(p) * 100, 2)
                    for c, p in zip(rf_model.classes_, probas)
                }

        except Exception as rf_err:
            # RF model is optional — fall back gracefully
            rf_trend = None
            rf_confidence = None
            rf_probabilities = None

        # ── Build response ─────────────────────────────────────────────────
        result = {
            "success": True,
            "prediction": predicted_price,
            "fundamentals": fundamentals
        }

        if rf_trend is not None:
            result["rf_trend"] = rf_trend
        if rf_confidence is not None:
            result["rf_confidence"] = rf_confidence
        if rf_probabilities is not None:
            result["rf_probabilities"] = rf_probabilities

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
