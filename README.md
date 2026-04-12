# 🌡️ ClimateStock India — Climate-Finance Predictor

> A full-stack, production-grade web application that correlates **Indian regional climate data** (temperature, heatwave events) with **energy sector stock performance**, featuring real-time XGBoost ML predictions, AI chatbot, and live PostgreSQL dashboards.

---

## 📸 Features at a Glance

| Feature | Description |
|---|---|
| 📊 **Live Dashboard** | Real-time temperature vs. stock price area chart, updating every 8 seconds |
| 🤖 **ML Prediction Engine** | XGBoost model predicts energy stock price from climate inputs |
| 💬 **AI Chatbot (ClimateIQ)** | Gemini-powered context-aware chatbot grounded in live DB data |
| 📈 **Insights Page** | Statistical analysis: heatwave impact, price volatility, prediction trends |
| 🌡️ **Climate Events Donut** | Full-table pie chart showing Normal Days vs. Heatwave Alerts |
| ⚡ **Auto DB Seeding** | On first run, auto-creates schema and seeds from CSV — zero setup |

---

## 🗂️ Project Structure

```
Market/
├── backend/                        # Node.js Express API server
│   ├── server.js                   # Main API server (all routes)
│   ├── predict.py                  # Python XGBoost inference script
│   ├── chat.py                     # Python Gemini AI chatbot script
│   ├── init_db.sql                 # PostgreSQL schema (tables definition)
│   ├── init_db.js                  # Manual DB initializer script
│   ├── seed_csv.js                 # Manual CSV seeder script
│   ├── list_models.js              # Utility to list available Gemini models
│   ├── package.json                # Node.js dependencies
│   └── .env                        # Environment variables (secrets)
│
├── frontend/                       # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Market Overview page (charts + stats)
│   │   │   ├── Prediction.jsx      # ML Prediction input & result page
│   │   │   └── Insights.jsx        # Statistical insights dashboard
│   │   ├── components/
│   │   │   ├── ChatBot.jsx         # Floating AI chat widget
│   │   │   └── ChatBot.css         # Chatbot-specific styles
│   │   ├── App.jsx                 # Root app with routing & sidebar nav
│   │   ├── App.css                 # App-level layout styles
│   │   └── index.css               # Global CSS design system & variables
│   ├── index.html
│   └── package.json
│
├── final_processed_data .csv       # Historical climate + stock dataset
├── xgb_stock_prediction_model_raw.pkl  # Pre-trained XGBoost model
├── inspect_model.py                # Utility to inspect model features
└── README.md                       # This file
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express** | REST API server |
| **PostgreSQL** | Persistent database for all historical and prediction data |
| **Python 3** | XGBoost inference (`predict.py`) and Gemini AI bridge (`chat.py`) |
| **XGBoost** | Pre-trained ML model for stock price prediction |
| **Google Gemini API** | Powers the ClimateIQ AI chat assistant |
| **dotenv** | Manages environment variables |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18 + Vite** | Modern SPA framework |
| **Recharts** | Area charts, pie/donut charts for data visualization |
| **Axios** | HTTP client for API calls |
| **Lucide React** | Icon library |
| **Vanilla CSS** | Custom CSS design system (no frameworks) |

---

## 🗃️ Database Schema

The PostgreSQL database `Stockmarket` has three core tables:

### `companies`
| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Unique ID |
| `name` | TEXT | Company name (e.g., Reliance) |
| `symbol` | TEXT UNIQUE | Stock ticker symbol |
| `sector` | TEXT | Always `Energy` for this dataset |

### `temperature_data`
| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Unique ID |
| `date` | DATE | Record date |
| `region` | TEXT | Region (default `Unknown`) |
| `avg_temperature` | NUMERIC | Temperature in °C |
| `heatwave_flag` | BOOLEAN | `true` if heatwave day |

### `stock_data`
| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Unique ID |
| `company_id` | INT FK | References `companies.id` |
| `date` | DATE | Record date |
| `open_price` | NUMERIC | Open price (₹) |
| `close_price` | NUMERIC | Close price (₹) |
| `high_price` | NUMERIC | Day high (₹) |
| `low_price` | NUMERIC | Day low (₹) |
| `volume` | BIGINT | Trade volume |

### `predictions`
| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Unique ID |
| `company_id` | INT FK | References `companies.id` |
| `date` | DATE | Prediction date |
| `input_temperature` | NUMERIC | Temperature used as input (°C) |
| `predicted_price` | NUMERIC | XGBoost predicted price (₹) |
| `predicted_trend` | TEXT | `Bullish`, `Bearish`, or `Neutral` |
| `confidence_score` | NUMERIC | Model confidence (0–100%) |

---

## 🤖 ML Model — XGBoost

**Model file:** `xgb_stock_prediction_model_raw.pkl`

The model was trained on Indian energy sector historical data combining climate and financial features. It predicts the **next-day stock closing price**.

### Input Features (15 total)

| Feature | Description |
|---|---|
| `Temperature` | Regional average temperature (°C) |
| `CDD` | Cooling Degree Days (proxy: `max(0, Temp - 25)`) |
| `CDD_7` | 7-day CDD accumulator |
| `Heatwave` | Binary flag: `1` = heatwave day |
| `Return_Lag1` | 1-day return lag |
| `Return_Lag3` | 3-day return lag |
| `Return_Lag5` | 5-day return lag |
| `Temp_Anomaly` | Deviation from 30°C baseline |
| `CDD_Lag1` | CDD 1-day lag |
| `CDD_Lag3` | CDD 3-day lag |
| `MA_5` | 5-day moving average of close price |
| `Volatility` | Historical volatility |
| `Demand_Trend` | Energy demand trend index |
| `Trend` | Market trend signal |
| `Volatility_Change` | Change in volatility |

### Output
- **Predicted Close Price (₹)** — used to determine trend (Bullish/Bearish/Neutral) and confidence

---

## 📡 API Endpoints

All endpoints are served on `http://localhost:5000`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stocks` | Fetch all companies |
| `GET` | `/api/temperature` | Latest 30 temperature records |
| `GET` | `/api/dashboard` | Time-offset merged climate + stock data (30 rows) |
| `POST` | `/api/predict` | Run XGBoost prediction with climate inputs |
| `GET` | `/api/insights` | Aggregated statistical insights from DB |
| `GET` | `/api/climate-summary` | Full-table heatwave/normal day counts |
| `POST` | `/api/chat` | Send message to ClimateIQ AI chatbot |

### POST `/api/predict` — Request Body
```json
{
  "temperature": 38.5,
  "heatwave_flag": true,
  "company_id": 1
}
```

### POST `/api/predict` — Response
```json
{
  "prediction": 872.34,
  "trend": "Bullish",
  "confidence": 78.5,
  "returnPct": 2.45,
  "volatility": 0.0415
}
```

### POST `/api/chat` — Request Body
```json
{
  "message": "How do heatwaves affect energy stocks?",
  "history": []
}
```

---

## ⚙️ Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
# PostgreSQL Database
DB_NAME=Stockmarket
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432

# Server
PORT=5000

# Google Gemini API Key (for AI chatbot)
GEMINI_API_KEY=your_gemini_api_key_here

# JWT (for future auth)
JWT_SECRET=your_secret_key_here
```

> ⚠️ **Never commit your `.env` file to Git.** Add it to `.gitignore`.

---

## 🚀 Getting Started

### Prerequisites

Make sure the following are installed on your system:

- [Node.js](https://nodejs.org/) `v18+`
- [Python](https://www.python.org/) `3.8+`
- [PostgreSQL](https://www.postgresql.org/) `v14+`
- Python packages: `xgboost`, `pandas`, `numpy`, `scikit-learn`

### 1. Install Python Dependencies

```bash
pip install xgboost pandas numpy scikit-learn
```

### 2. Set Up the Database

Create the database in PostgreSQL:
```sql
CREATE DATABASE Stockmarket;
```

Then update your `backend/.env` file with the correct credentials.

### 3. Start the Backend

```bash
cd backend
npm install
node server.js
```

On first start, the server will **automatically**:
1. Connect to PostgreSQL
2. Create all tables (from `init_db.sql`)
3. Seed data from `final_processed_data .csv`

You should see:
```
✅ Connected to PostgreSQL Database successfully!
✅ Schema created successfully.
⌛ Inserting records (this may take a minute)...
✅ Successfully seeded XXXXX records!
Server running on port 5000
```

### 4. Start the Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Visit: **http://localhost:5173**

---

## 📊 Dataset — `final_processed_data .csv`

The dataset contains historical Indian energy sector climate-finance data.

### Key Columns

| Column | Description |
|---|---|
| `Date` | Trading date |
| `Stock` | Company ticker symbol |
| `CLOSE` | Closing stock price (₹) |
| `Temperature` | Regional temperature (°C) |
| `Heatwave` | Binary: `1` if heatwave day, `0` otherwise |

The data covers **multiple Indian energy companies** including Reliance Industries, Tata Power, NTPC, Adani Green, and Power Grid Corp.

---

## 🧪 Inspecting the ML Model

Run the inspection utility to see model feature names and type:

```bash
python inspect_model.py
```

---

## 🌐 Application Pages

### 1. Dashboard (`/`)
- **3 Stat Cards:** Avg Temperature, Latest Stock Price, Climate Risk Score
- **Area Chart:** Temperature (°C, left axis) vs. Stock Price (₹, right axis) — live 8s refresh
- **Donut Chart:** Climate Events split — Normal Days vs. Heatwave Alerts

### 2. Prediction (`/predict`)
- Input form: Temperature (°C), Heatwave toggle, Company selector
- Circular progress indicator for **Confidence Score** (color-coded: Green/Orange/Red)
- Displays: Predicted Price, Trend (Bullish/Bearish/Neutral), Return %, Volatility

### 3. Insights (`/insights`)
- Temperature statistics: Avg, Max, Min, Standard Deviation
- Stock price analysis: Heatwave-day vs. Normal-day averages, Volatility %
- Prediction history: Total predictions, Bullish/Bearish/Neutral distribution

### 4. AI Chatbot (ClimateIQ)
- Floating chat widget available on all pages
- Context-aware: grounded in live PostgreSQL data (avg temp, stock price, predictions)
- Powered by **Google Gemini** via Python bridge

---

## 🔧 Troubleshooting

### Backend files showing red (D) in VS Code
Files are staged for deletion in Git. Run in the `Market` folder:
```bash
git restore --staged .
```

### `python` not recognized
Make sure Python is added to your system PATH, or use `python3`:
```bash
python3 --version
```

### Database connection error
- Verify PostgreSQL service is running
- Check `DB_PASSWORD` and `DB_USER` in `backend/.env`
- Ensure database `Stockmarket` exists:
  ```sql
  CREATE DATABASE Stockmarket;
  ```

### Port 5000 already in use
Change the port in `backend/.env`:
```env
PORT=5001
```
And update API URLs in frontend pages from `5000` to `5001`.

### Model file not found
Ensure `xgb_stock_prediction_model_raw.pkl` is in the **root `Market/` directory** (not inside `backend/`).

---

## 📁 .gitignore Recommendations

```gitignore
# Dependencies
node_modules/
__pycache__/
*.pyc

# Environment
.env

# Build output
dist/
build/

# Data & Models (optional, large files)
*.pkl
final_processed_data .csv
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is for academic and research purposes.

---

## 👨‍💻 Author

**Bhargav** — Full-Stack Developer  
ClimateStock India Predictor · Built with ❤️ using React, Node.js, Python & XGBoost
