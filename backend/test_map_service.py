import unittest
from map_service import MapUnavailable, coordinates, lane_number, parse_roads

class MapServiceTests(unittest.TestCase):
    def test_coordinates_accept_india_area_and_round(self):
        self.assertEqual(coordinates({"lat":21.145812,"lon":79.088245}),(21.14581,79.08824))
    def test_coordinates_reject_invalid_values(self):
        for payload in [None,{"lat":100,"lon":79},{"lat":21,"lon":120},{"lat":True,"lon":79},{"lat":float("nan"),"lon":79}]:
            with self.subTest(payload=payload), self.assertRaises(ValueError): coordinates(payload)
    def test_lane_tags_are_only_parsed_when_unambiguous(self):
        self.assertEqual(lane_number("3"),3)
        for value in [None,"","0","3;4","2|3","3 (estimated)","yes","-1"]:
            with self.subTest(value=value): self.assertIsNone(lane_number(value))
    def test_parse_roads_filters_bad_geometry_and_keeps_osm_link(self):
        data={"elements":[
          {"type":"way","id":42,"tags":{"name":"Main Road","highway":"primary","lanes":"2","oneway":"yes"},"geometry":[{"lat":21.1,"lon":79.1},{"lat":21.2,"lon":79.2}]},
          {"type":"node","id":2,"tags":{},"geometry":[]},
          {"type":"way","id":43,"tags":{"name":"Bad"},"geometry":[{"lat":1,"lon":2}]}
        ]}
        roads=parse_roads(data)
        self.assertEqual(len(roads),1)
        self.assertEqual(roads[0]["lanes"],2)
        self.assertEqual(roads[0]["osm_url"],"https://www.openstreetmap.org/way/42")
    def test_incomplete_provider_response_raises(self):
        with self.assertRaises(MapUnavailable): parse_roads({"remark":"timeout","elements":[]})

if __name__=="__main__": unittest.main()
