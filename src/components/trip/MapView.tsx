"use client";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { TripDTO } from "@/lib/dto";
import { hasPin, pinNumbers, stopColor } from "./shared";

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join()).join("|");
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

const pinIcon = (n: number, color: string, booked: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font:700 12px sans-serif;display:grid;place-items:center;border:3px solid ${booked ? "#059669" : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,.5)">${n}</div>`,
  });

export default function MapView({
  dto,
  onSelect,
}: {
  dto: TripDTO;
  onSelect: (id: string) => void;
}) {
  const stopsWithGeo = dto.stops.filter((s) => s.lat != null && s.lng != null);
  const points: [number, number][] = [
    ...dto.days.flatMap((d) =>
      d.items.filter(hasPin).map((i) => [i.lat!, i.lng!] as [number, number]),
    ),
    ...stopsWithGeo.map((s) => [s.lat!, s.lng!] as [number, number]),
  ];
  return (
    <MapContainer
      key="trip-map"
      center={points[0] ?? [30, 10]}
      zoom={5}
      className="h-[55vh] w-full rounded-lg"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit points={points} />
      {stopsWithGeo.slice(1).map((s, i) => {
        const a = stopsWithGeo[i];
        return (
          <Polyline
            key={s.id}
            positions={[
              [a.lat!, a.lng!],
              [s.lat!, s.lng!],
            ]}
            pathOptions={{ color: "#475569", weight: 3, dashArray: "8 8" }}
          >
            <Tooltip sticky>
              {a.city} → {s.city}
            </Tooltip>
          </Polyline>
        );
      })}
      {stopsWithGeo.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat!, s.lng!]}
          radius={7}
          pathOptions={{ color: stopColor(dto, s.id), fillOpacity: 0.25 }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]}>
            {s.city}
          </Tooltip>
        </CircleMarker>
      ))}
      {dto.days.map((d) => {
        const color = stopColor(dto, d.stopId);
        const pins = pinNumbers(d);
        const pts = d.items.filter(hasPin);
        return (
          <div key={d.id}>
            {pts.length > 1 && (
              <Polyline
                positions={pts.map((i) => [i.lat!, i.lng!])}
                pathOptions={{ color, weight: 3, opacity: 0.7 }}
              />
            )}
            {pts.map((it) => (
              <Marker
                key={it.id}
                position={[it.lat!, it.lng!]}
                icon={pinIcon(pins.get(it.id)!, color, it.status === "booked")}
                eventHandlers={{ click: () => onSelect(it.id) }}
              >
                <Popup>
                  <b>{it.title}</b>
                  <br />
                  Day {d.index + 1} · {it.status}
                </Popup>
              </Marker>
            ))}
          </div>
        );
      })}
    </MapContainer>
  );
}
