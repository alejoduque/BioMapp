import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import 'font-awesome/css/font-awesome.min.css';
import 'leaflet/dist/leaflet.css';

// Global Leaflet marker icon override (relative paths)
import L from 'leaflet';
L.Icon.Default.mergeOptions({
  iconUrl: 'leaflet/marker-icon.png',
  shadowUrl: 'leaflet/marker-shadow.png',
  iconRetinaUrl: 'leaflet/marker-icon-2x.png', // Only if present
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);