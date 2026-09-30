# Student Academic Performance Clustering

A fully working Flask + Machine Learning web application that groups students with similar academic characteristics.

## Features
- Load built-in sample student data
- Upload your own CSV
- K-Means clustering
- Hierarchical (Agglomerative) clustering
- DBSCAN clustering
- Automatic standardization
- PCA 2D visualization
- Cluster summary cards and table
- Silhouette Score and Davies-Bouldin Index
- Download clustered CSV results
- Responsive interface

## CSV format
Your CSV should contain these numeric columns:

StudentID, Name, Attendance, StudyHours, AssignmentScore, MidtermScore, FinalScore

Example:
```csv
StudentID,Name,Attendance,StudyHours,AssignmentScore,MidtermScore,FinalScore
S001,Anjali,92,6.5,88,86,90
S002,Riya,80,4.2,75,72,78
S003,Neha,61,2.1,55,58,52
```

## Run in VS Code / Windows

1. Open this folder in VS Code.
2. Open Terminal.
3. Create a virtual environment:
   `python -m venv venv`
4. Activate it:
   `venv\Scripts\activate`
5. Install packages:
   `pip install -r requirements.txt`
6. Start:
   `python app.py`
7. Open:
   `http://127.0.0.1:5000`

The application uses the backend to perform the actual clustering, so it is a working ML application rather than a static HTML mockup.
