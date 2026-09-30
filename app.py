import os
from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score
from io import BytesIO

app = Flask(__name__)

REQUIRED_NUMERIC = ["Attendance", "StudyHours", "AssignmentScore", "MidtermScore", "FinalScore"]

def sample_data():
    rng = np.random.default_rng(42)
    rows = []
    groups = [
        (15, 92, 6.5, 88, 86, 90),
        (25, 78, 4.0, 72, 70, 74),
        (20, 62, 2.2, 55, 58, 52),
    ]
    sid = 1
    for count, att, hrs, ass, mid, final in groups:
        for _ in range(count):
            rows.append({
                "StudentID": f"S{sid:03d}",
                "Name": f"Student {sid}",
                "Attendance": round(np.clip(rng.normal(att, 5), 40, 100), 1),
                "StudyHours": round(np.clip(rng.normal(hrs, .7), .5, 10), 1),
                "AssignmentScore": round(np.clip(rng.normal(ass, 6), 20, 100), 1),
                "MidtermScore": round(np.clip(rng.normal(mid, 7), 20, 100), 1),
                "FinalScore": round(np.clip(rng.normal(final, 7), 20, 100), 1),
            })
            sid += 1
    return pd.DataFrame(rows)

def prepare(df):
    df = df.copy()
    for col in REQUIRED_NUMERIC:
        if col not in df.columns:
            raise ValueError(f"CSV must contain '{col}' column.")
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=REQUIRED_NUMERIC).reset_index(drop=True)
    if len(df) < 3:
        raise ValueError("At least 3 valid student records are required.")
    return df

def run_cluster(df, algorithm, k=3):
    X = df[REQUIRED_NUMERIC].values
    Xs = StandardScaler().fit_transform(X)

    if algorithm == "kmeans":
        model = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = model.fit_predict(Xs)
    elif algorithm == "hierarchical":
        model = AgglomerativeClustering(n_clusters=k, linkage="ward")
        labels = model.fit_predict(Xs)
    elif algorithm == "dbscan":
        model = DBSCAN(eps=0.9, min_samples=4)
        labels = model.fit_predict(Xs)
    else:
        raise ValueError("Unknown clustering algorithm.")

    unique = set(labels)
    non_noise = labels != -1
    if len(unique - {-1}) >= 2 and non_noise.sum() > len(unique - {-1}):
        sil = float(silhouette_score(Xs[non_noise], labels[non_noise]))
        db = float(davies_bouldin_score(Xs[non_noise], labels[non_noise]))
    else:
        sil, db = None, None

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(Xs)

    out = df.copy()
    out["Cluster"] = labels + 1
    out["PCA1"] = coords[:, 0]
    out["PCA2"] = coords[:, 1]

    summary = []
    for c in sorted(out["Cluster"].unique()):
        part = out[out["Cluster"] == c]
        summary.append({
            "cluster": int(c),
            "count": int(len(part)),
            "avg_score": round(float(part[["AssignmentScore","MidtermScore","FinalScore"]].mean().mean()), 2),
            "attendance": round(float(part["Attendance"].mean()), 2),
            "study_hours": round(float(part["StudyHours"].mean()), 2),
            "final_score": round(float(part["FinalScore"].mean()), 2)
        })

    return out, summary, sil, db, float(pca.explained_variance_ratio_[0]), float(pca.explained_variance_ratio_[1])

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/sample", methods=["GET"])
def api_sample():
    df = sample_data()
    return jsonify({"columns": list(df.columns), "rows": df.to_dict(orient="records")})

@app.route("/api/cluster", methods=["POST"])
def api_cluster():
    try:
        payload = request.get_json(force=True)
        rows = payload.get("rows", [])
        algorithm = payload.get("algorithm", "kmeans")
        k = int(payload.get("clusters", 3))
        if algorithm in ("kmeans", "hierarchical") and not 2 <= k <= 8:
            raise ValueError("Number of clusters must be between 2 and 8.")
        df = prepare(pd.DataFrame(rows))
        out, summary, sil, db, p1, p2 = run_cluster(df, algorithm, k)
        return jsonify({
            "rows": out.to_dict(orient="records"),
            "summary": summary,
            "metrics": {"silhouette": sil, "davies_bouldin": db},
            "pca_variance": [round(p1*100,2), round(p2*100,2)],
            "features": REQUIRED_NUMERIC,
            "algorithm": algorithm,
            "total_students": len(out)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/download", methods=["POST"])
def api_download():
    try:
        payload = request.get_json(force=True)
        rows = payload.get("rows", [])
        df = pd.DataFrame(rows)
        buf = BytesIO()
        df.to_csv(buf, index=False)
        buf.seek(0)
        return send_file(buf, mimetype="text/csv", as_attachment=True,
                         download_name="student_clustering_results.csv")
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
