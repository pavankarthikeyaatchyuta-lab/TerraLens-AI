"""Interactive map component for geospatial visualization of satellite scenes."""

from typing import List, Optional
import streamlit as st
import folium
from streamlit_folium import st_folium

from terralens.app.models.location import Location
from terralens.app.utils.geo_utils import format_coordinates


def render_map_view(
    locations: List[Location],
    selected_location: Optional[Location] = None,
    height: int = 550
) -> Optional[str]:
    """Renders an interactive Folium map with satellite and topo tiles, highlighting candidates."""
    if not locations:
        st.info("No locations available to display on map.")
        return None

    # Calculate center of all locations or selected location
    if selected_location:
        center_lat = selected_location.latitude
        center_lon = selected_location.longitude
        zoom_start = 7
    else:
        center_lat = sum(l.latitude for l in locations) / len(locations)
        center_lon = sum(l.longitude for l in locations) / len(locations)
        zoom_start = 5

    # Initialize Folium Map defaulting to Esri Satellite Mode
    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=zoom_start,
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attr="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        name="Satellite Imagery (Esri)",
        control_scale=True,
    )

    # Add CARTO Tactical Dark as an alternative layer option
    carto_key = "cb1_45sy_1_7b1356d3210f8c48e5b015d3"
    folium.TileLayer(
        tiles=f"https://{{s}}.basemaps.cartocdn.com/rastertiles/dark_all/{{z}}/{{x}}/{{y}}.png?key={carto_key}",
        attr='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
        name="Carto Tactical Dark",
        overlay=False,
        control=True,
    ).add_to(m)

    # Add OpenStreetMap tile layer as an option
    folium.TileLayer(
        tiles="OpenStreetMap",
        name="OpenStreetMap",
        overlay=False,
        control=True,
    ).add_to(m)

    # Plot each candidate location
    for loc in locations:
        is_selected = selected_location and (loc.location_id == selected_location.location_id)

        # Visual marker styling
        marker_color = "red" if is_selected else "blue"
        icon_name = "crosshairs" if is_selected else "camera"

        popup_html = f"""
        <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
            <b style="font-size: 13px; color: #0284c7;">{loc.name}</b><br/>
            <b>ID:</b> {loc.location_id}<br/>
            <b>Sensor:</b> {loc.primary_sensor}<br/>
            <b>Coords:</b> {format_coordinates(loc.latitude, loc.longitude)}<br/>
            <b>Dates:</b> {", ".join(loc.available_dates)}<br/>
            <b>Tags:</b> {", ".join(loc.tags)}
        </div>
        """

        # Marker
        folium.Marker(
            location=[loc.latitude, loc.longitude],
            tooltip=f"{loc.name} ({loc.location_id})",
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color=marker_color, icon=icon_name, prefix="fa"),
        ).add_to(m)

        # Selected location gets a highlight radar pulse circle
        if is_selected:
            folium.Circle(
                location=[loc.latitude, loc.longitude],
                radius=15000,
                color="#f43f5e",
                weight=2,
                fill=True,
                fill_color="#f43f5e",
                fill_opacity=0.15,
                tooltip="Selected AOI Extent",
            ).add_to(m)

        # Plot bounding box rectangle if available
        if loc.bounding_box:
            bbox = loc.bounding_box
            folium.Rectangle(
                bounds=[[bbox.min_lat, bbox.min_lon], [bbox.max_lat, bbox.max_lon]],
                color="#38bdf8" if not is_selected else "#f43f5e",
                weight=1 if not is_selected else 2,
                fill=False,
                dash_array="4, 4",
                tooltip=f"AOI BBox: {loc.location_id}",
            ).add_to(m)

    # Layer control
    folium.LayerControl(position="topright").add_to(m)

    # Render via streamlit_folium
    map_data = st_folium(m, width="100%", height=height, key="terralens_map")

    # If user clicked on a marker, find matching location
    if map_data and map_data.get("last_object_clicked"):
        click_lat = map_data["last_object_clicked"].get("lat")
        click_lng = map_data["last_object_clicked"].get("lng")
        if click_lat is not None and click_lng is not None:
            # Match closest location within small tolerance
            for loc in locations:
                if abs(loc.latitude - click_lat) < 0.05 and abs(loc.longitude - click_lng) < 0.05:
                    return loc.location_id

    return None
