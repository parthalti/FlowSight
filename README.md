# FlowSight 🚦

**Explainable traffic analytics using machine learning and an interactive dashboard.**

FlowSight explores traffic observations, groups traffic conditions into interpretable segments, and presents the results through a web dashboard.

## Project goals

- Turn traffic observations into understandable congestion segments.
- Explore traffic patterns using machine-learning models.
- Present results in an interactive dashboard.
- Keep the analysis explainable and suitable for experimentation.

## Technology

- **Frontend:** React, Vite
- **Backend:** Python, Flask
- **Machine learning:** scikit-learn-based modelling (see the source and training script for the exact pipeline)

## Repository structure

```text
FlowSight/
├── backend/
│   ├── app.py
│   └── train_models.py
├── requirements.txt
└── README.md
```

The frontend source should be included in the repository when the project is pushed from the local working directory.

## Run locally

### 1. Backend

From the project root, create and activate a Python virtual environment, then install the dependencies:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python backend\train_models.py
python backend\app.py
```

The Flask development server is expected at `http://127.0.0.1:5000` when startup succeeds.

### 2. Frontend

Open a second terminal in the frontend directory (the directory containing its `package.json`):

```bash
npm install
npm run dev
```

Use the local URL printed by Vite in the terminal.

## Model notes

The training script has reported three traffic segments: **Free Flow**, **Moderate Congestion**, and **Severe Congestion**. These labels summarize the available training observations; they should not be treated as ground truth for live roads without validation against real-world traffic data.

## Important limitations

- Treat results as experimental unless the dataset, evaluation metrics, and validation process demonstrate real-world reliability.
- Do not use the dashboard as the sole basis for real-time driving or emergency decisions.
- Keep generated model files and datasets in the repository only if they are intended to be shared and are appropriate to publish.

## Development checklist

- [ ] Push the complete frontend and backend source.
- [ ] Document the dataset source and schema.
- [ ] Record model evaluation metrics and limitations.
- [ ] Add tests for API endpoints and data processing.
- [ ] Add screenshots of the working dashboard.

## License

No license has been selected yet. Until a license is added, others should not assume that the code is available for reuse.
