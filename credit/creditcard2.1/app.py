from flask import Flask, render_template, request, send_file
import numpy as np
import pandas as pd
import pickle
import io

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000

# Load ML model and scaler
model = pickle.load(open("credit_model.pkl", "rb"))
scaler = pickle.load(open("scaler.pkl", "rb"))
EXPECTED_FEATURES = int(getattr(scaler, "n_features_in_", 23))


# Home page (Dashboard)
@app.route("/")
@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/analytics")
def analytics():
    stats = {
        "total_predictions": 1250,
        "high_risk": 350,
        "low_risk": 900,
    }
    return render_template("analytics.html", stats=stats)


@app.route("/settings")
def settings():
    model_info = {
        "name": "XGBoost",
        "status": "Active",
        "features_count": EXPECTED_FEATURES,
    }
    return render_template("settings.html", model_info=model_info)


# Single Prediction
@app.route("/predict", methods=["POST"])
def predict():

    try:

        # Collect user inputs
        ID = int(request.form["ID"])
        LIMIT_BAL = float(request.form["LIMIT_BAL"])
        SEX = int(request.form["SEX"])
        EDUCATION = int(request.form["EDUCATION"])
        MARRIAGE = int(request.form["MARRIAGE"])
        AGE = int(request.form["AGE"])

        PAY_0 = int(request.form["PAY_0"])
        PAY_2 = int(request.form["PAY_2"])
        PAY_3 = int(request.form["PAY_3"])

        BILL_AMT1 = float(request.form["BILL_AMT1"])
        BILL_AMT2 = float(request.form["BILL_AMT2"])

        PAY_AMT1 = float(request.form["PAY_AMT1"])
        PAY_AMT2 = float(request.form["PAY_AMT2"])


        # Build full 24 feature input
        features = [
            ID,
            LIMIT_BAL,
            SEX,
            EDUCATION,
            MARRIAGE,
            AGE,

            PAY_0,
            PAY_2,
            PAY_3,

            0,   # PAY_4
            0,   # PAY_5
            0,   # PAY_6

            BILL_AMT1,
            BILL_AMT2,

            0,   # BILL_AMT3
            0,   # BILL_AMT4
            0,   # BILL_AMT5
            0,   # BILL_AMT6

            PAY_AMT1,
            PAY_AMT2,

            0,   # PAY_AMT3
            0,   # PAY_AMT4
            0,   # PAY_AMT5
            0    # PAY_AMT6
        ]

        # Align with scaler feature count (some training pipelines exclude ID).
        if len(features) == EXPECTED_FEATURES + 1:
            features = features[1:]
        elif len(features) != EXPECTED_FEATURES:
            return f"Error: Model expects {EXPECTED_FEATURES} features, got {len(features)}"

        # Convert to numpy
        input_data = np.array(features, dtype=float).reshape(1, -1)

        # Scale input
        scaled_data = scaler.transform(input_data)

        # Predict
        prediction = model.predict(scaled_data)[0]

        # Probability
        probability = model.predict_proba(scaled_data)[0][1] * 100

        if prediction == 1:
            result = "High Risk"
        else:
            result = "Low Risk"

        return render_template(
            "result.html",
            prediction=result,
            probability=round(probability, 2),
            client_id=ID
        )

    except Exception as e:
        return f"Error: {e}"


# CSV Batch Prediction
@app.route("/predict_csv", methods=["POST"])
def predict_csv():

    try:

        file = request.files["file"]

        df = pd.read_csv(file)

        # Drop target column if exists
        if "default.payment.next.month" in df.columns:
            df = df.drop(columns=["default.payment.next.month"])

        # Align incoming CSV with scaler expected feature count.
        if "ID" in df.columns and len(df.columns) == EXPECTED_FEATURES + 1:
            df = df.drop(columns=["ID"])

        if len(df.columns) != EXPECTED_FEATURES:
            return f"CSV Prediction Error: Expected {EXPECTED_FEATURES} feature columns, got {len(df.columns)}"

        # Scale data
        scaled_data = scaler.transform(df)

        # Predict
        predictions = model.predict(scaled_data)

        probabilities = model.predict_proba(scaled_data)[:, 1]

        df["Prediction"] = ["High Risk" if p == 1 else "Low Risk" for p in predictions]
        df["Probability"] = probabilities * 100

        # Convert dataframe to CSV
        output = io.StringIO()
        df.to_csv(output, index=False)

        output.seek(0)

        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype="text/csv",
            as_attachment=True,
            download_name="prediction_results.csv"
        )

    except Exception as e:
        return f"CSV Prediction Error: {e}"

import os
# Run app
if __name__ == "__main__":
    port=int(os.environ.get("PORT",5000))
    app.run(host="0.0.0.0", port=port)