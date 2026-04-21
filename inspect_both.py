import pickle

print("=== XGBoost Model ===")
with open('xgb_stock_prediction_model_raw.pkl', 'rb') as f:
    xgb_model = pickle.load(f)
print("Type:", type(xgb_model))
if hasattr(xgb_model, 'feature_names_in_'):
    print("Features (sklearn):", list(xgb_model.feature_names_in_))
elif hasattr(xgb_model, 'get_booster'):
    booster = xgb_model.get_booster()
    print("Features (booster):", booster.feature_names)
if hasattr(xgb_model, 'n_features_in_'):
    print("N features:", xgb_model.n_features_in_)

print()
print("=== RF Classifier Model ===")
with open('rf_classifier_20k_model.pkl', 'rb') as f:
    rf_model = pickle.load(f)
print("Type:", type(rf_model))
if hasattr(rf_model, 'feature_names_in_'):
    print("Features (sklearn):", list(rf_model.feature_names_in_))
if hasattr(rf_model, 'n_features_in_'):
    print("N features:", rf_model.n_features_in_)
if hasattr(rf_model, 'classes_'):
    print("Classes:", list(rf_model.classes_))
if hasattr(rf_model, 'n_estimators'):
    print("N estimators:", rf_model.n_estimators)
