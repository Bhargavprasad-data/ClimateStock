import pickle
import xgboost as xgb
import sys

# Load the model
try:
    with open('xgb_stock_prediction_model_raw.pkl', 'rb') as f:
        model = pickle.load(f)
    print("Model type:", type(model))

    if hasattr(model, 'feature_names_in_'):
        print("Feature names (from sklearn API):", model.feature_names_in_)
    elif hasattr(model, 'get_booster'):
        booster = model.get_booster()
        print("Feature names (from xgboost booster):", booster.feature_names)
    else:
        print("Model does not have feature names attribute.")

except Exception as e:
    print("Error loading model:", str(e))
