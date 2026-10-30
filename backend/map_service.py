"""Read nearby OSM roads on demand; never invent live traffic or lane counts."""
from collections import OrderedDict
from datetime import datetime, timezone
import json
import math
import os
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_OVERPASS_URLS = (
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
)
# Set OVERPASS_URLS to a comma-separated list to override the public fallback list.
OVERPASS_URLS = tuple(
    url.strip() for url in os.environ.get('OVERPASS_URLS', ','.join(DEFAULT_OVERPASS_URLS)).split(',')
    if url.strip()
)
if not OVERPASS_URLS:
    OVERPASS_URLS = DEFAULT_OVERPASS_URLS
USER_AGENT = 'FlowSight/1.1 (educational road explorer; repository URL configured by the maintainer)'
CACHE_TTL = 3600
_cache = OrderedDict()
_lock = threading.Lock()
_last_request = -float('inf')


class MapUnavailable(Exception):
    pass


class MapBusy(Exception):
    pass


def coordinates(payload):
    if not isinstance(payload, dict):
        raise ValueError('Provide latitude and longitude as a JSON object.')
    point = []
    # This is a service bounding box, not a political boundary or country check.
    for key, low, high in [('lat', 6, 37.5), ('lon', 68, 98)]:
        value = payload.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f'{key} must be a finite number.')
        if not low <= value <= high:
            raise ValueError('Choose a point in the India-focused map area (6–37.5° N, 68–98° E).')
        point.append(round(float(value), 5))
    return tuple(point)


def lane_number(value):
    """Do not guess from conditional, directional or semicolon-separated tags."""
    if not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]?', value):
        return None
    return int(value)


def parse_roads(data):
    if not isinstance(data, dict) or not isinstance(data.get('elements'), list) or data.get('remark'):
        raise MapUnavailable('The map provider returned incomplete road data. Try again later.')
    roads = []
    for element in data['elements'][:40]:
        if not isinstance(element, dict) or element.get('type') != 'way' or not isinstance(element.get('tags'), dict):
            continue
        tags = element['tags']
        points = element.get('geometry')
        if not isinstance(points, list):
            continue
        geometry = []
        for point in points:
            if not isinstance(point, dict):
                continue
            lat, lon = point.get('lat'), point.get('lon')
            if (isinstance(lat, (int, float)) and isinstance(lon, (int, float))
                    and math.isfinite(lat) and math.isfinite(lon)
                    and -90 <= lat <= 90 and -180 <= lon <= 180):
                geometry.append([lat, lon])
        if len(geometry) < 2 or len(geometry) > 2000:
            continue
        road_id = element.get('id')
        if isinstance(road_id, bool) or not isinstance(road_id, int) or road_id <= 0:
            continue
        roads.append({
            'id': road_id,
            'name': str(tags.get('name:en') or tags.get('name') or tags.get('ref') or 'Unnamed mapped road')[:180],
            'kind': str(tags.get('highway', 'road'))[:50],
            'lanes': lane_number(tags.get('lanes')),
            'lanes_raw': str(tags.get('lanes', 'Not mapped'))[:80],
            'oneway': str(tags.get('oneway', 'Not mapped'))[:30],
            'geometry': geometry,
            'osm_url': f'https://www.openstreetmap.org/way/{road_id}',
        })
    return sorted(roads, key=lambda road: (road['name'] == 'Unnamed mapped road', road['name'], road['id']))


def nearby_roads(payload):
    global _last_request
    lat, lon = coordinates(payload)
    key = (lat, lon)
    now = time.monotonic()
    with _lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < CACHE_TTL:
            _cache.move_to_end(key)
            return {**cached[1], 'cached': True}
        if now - _last_request < 2:
            raise MapBusy('Please wait two seconds between road lookups.')
        _last_request = now
    query = (f'[out:json][timeout:8];way(around:700,{lat},{lon})'
             '["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"];out geom 40;')
    last_error = None
    roads = None
    for endpoint in OVERPASS_URLS:
        req = Request(endpoint, data=urlencode({'data': query}).encode(),
                      headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
        try:
            with urlopen(req, timeout=10) as response:
                raw = response.read(3_000_001)
            if len(raw) > 3_000_000:
                raise MapUnavailable('This area returned too much map data. Choose a less dense location.')
            roads = parse_roads(json.loads(raw))
            break
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, MapUnavailable) as error:
            last_error = error
    if roads is None:
        raise MapUnavailable('Road lookup is unavailable from the configured OpenStreetMap services. Try again later or enter a manual road scenario.') from last_error
    result = {'roads': roads, 'center': [lat, lon], 'radius_m': 700,
              'fetched_at': datetime.now(timezone.utc).isoformat(),
              'source': 'OpenStreetMap contributors via Overpass API',
              'cached': False,
              'note': 'Road geometry and tags only. No live traffic. Lane tags may be absent, outdated or cover both directions.'}
    with _lock:
        _cache[key] = (now, result)
        _cache.move_to_end(key)
        while len(_cache) > 64:
            _cache.popitem(last=False)
    return result
