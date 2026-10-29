# India Road Lab — verification notes

Checked locally on 24 October 2026. The project uses real OpenStreetMap road geometry where the public provider responds, alongside simulated traffic records. It does not include live traffic observations.

## Automated checks

- Backend unit tests cover input validation, road parsing, cache/provider failures and analytics outputs.
- Frontend helper tests cover India-focused coordinate bounds, lane-closure counts and exported scenario provenance.
- The Vite production build should be run from `frontend` using `npm run build`.

## Browser verification checklist

- Confirm the map displays OpenStreetMap attribution.
- Test city shortcuts and ensure changing the pin clears stale lookup status.
- Compare a scenario with all lanes open against one with a lane blocked.
- Verify a full road closure displays a warning and disables scenario export.
- Confirm invalid coordinates and invalid numeric values show an accessible error.
- Check narrow mobile and desktop widths for horizontal overflow.

## External-service limitation

Road retrieval uses the public Overpass API. The endpoint can time out or be rate-limited. When it is unavailable, the UI should show a manual-scenario fallback rather than fabricate road geometry. Road geometry and OSM tags are not live traffic, and lane tags may be missing, outdated, directional or ambiguous.

## Data provenance

The ML training script creates 2,400 simulated traffic observations. The dashboard must clearly disclose that model outputs are exploratory results from simulated data and are not real-world travel-time forecasts or evidence of causal lane-closure effects.
