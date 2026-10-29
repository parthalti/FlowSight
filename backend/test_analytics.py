import unittest
import pandas as pd
from analytics import FEATURES, analyze, find_neighbors, validate_traffic

class AnalyticsValidationTests(unittest.TestCase):
    def valid(self):
        return {"hour":9,"traffic_volume":1800,"average_speed_kmph":28.0,"rainfall_mm":0.0,"incidents":0,"road_lanes":3}
    def test_accepts_valid_inputs(self):
        self.assertEqual(validate_traffic(self.valid()), self.valid())
    def test_rejects_missing_fields(self):
        with self.assertRaises(ValueError): validate_traffic({"hour":9})
    def test_rejects_bool_and_nonfinite(self):
        for value in [True, float("nan"), float("inf"), float("-inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_traffic({**self.valid(), "hour":value})
    def test_rejects_out_of_range_and_fractional_integer(self):
        for field,value in [("hour",24),("traffic_volume",-1),("road_lanes",0),("incidents",1.5)]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_traffic({**self.valid(),field:value})
    def test_rejects_non_object(self):
        with self.assertRaises(ValueError): validate_traffic(None)

class AnalyticsIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from train_models import create_traffic_data
        from sklearn.cluster import KMeans
        from sklearn.linear_model import LinearRegression
        from sklearn.neighbors import NearestNeighbors
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler
        from sklearn.tree import DecisionTreeClassifier
        df=create_traffic_data(n=250,seed=42)
        cluster_features=["traffic_volume","average_speed_kmph","rainfall_mm","incidents","delay_minutes"]
        clusterer=Pipeline([("scale",StandardScaler()),("kmeans",KMeans(n_clusters=3,n_init=5,random_state=42))]).fit(df[cluster_features])
        df["cluster_id"]=clusterer.predict(df[cluster_features])
        summary=df.groupby("cluster_id").delay_minutes.mean().sort_values()
        label_map={int(cid):name for cid,name in zip(summary.index,["Free Flow","Moderate Congestion","Severe Congestion"])}
        df["segment_name"]=df.cluster_id.map(label_map)
        df["record_id"]=range(1,len(df)+1)
        cls.bundle={
            "neighbors":Pipeline([("scale",StandardScaler()),("knn",NearestNeighbors(n_neighbors=100))]).fit(df[FEATURES]),
            "records":df[["record_id"]+FEATURES+["road_zone","weather","delay_minutes","segment_name"]],
            "explainer":DecisionTreeClassifier(max_depth=3,random_state=42).fit(df[FEATURES],df.cluster_id),
            "label_map":label_map,
            "regression":LinearRegression().fit(df[FEATURES],df.delay_minutes),
        }
    def test_neighbor_search_returns_requested_count(self):
        result=find_neighbors(self.bundle, {"hour":9,"traffic_volume":1800,"average_speed_kmph":28,"rainfall_mm":0,"incidents":0,"road_lanes":3}, 10)
        self.assertEqual(len(result),10)
        self.assertIn("similarity_distance",result)
    def test_analyze_returns_coordinated_results(self):
        traffic={"hour":9,"traffic_volume":1800,"average_speed_kmph":28,"rainfall_mm":0,"incidents":0,"road_lanes":3}
        result=analyze(self.bundle,{"traffic":traffic,"reference":traffic,"sample_size":10,"total_lanes":4})
        self.assertEqual(len(result["matches"]),10)
        self.assertEqual(len(result["segments"]),3)
        self.assertEqual(result["lane_plan"]["blocked_lanes"],1)
        self.assertIsInstance(result["lane_plan"]["delay_difference"], float)
        self.assertIn("simulated",result["data_note"])
    def test_analyze_rejects_bad_sample_size(self):
        traffic={"hour":9,"traffic_volume":1800,"average_speed_kmph":28,"rainfall_mm":0,"incidents":0,"road_lanes":3}
        with self.assertRaises(ValueError): analyze(self.bundle,{"traffic":traffic,"reference":traffic,"sample_size":2})

if __name__=="__main__": unittest.main()
