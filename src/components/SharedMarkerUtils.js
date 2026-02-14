// SharedMarkerUtils.js
// Utility for creating duration-based marker icons (used in both collector and SoundWalk interfaces)
/**
 * @fileoverview This file is part of the BioMapp project, developed for Reserva MANAKAI.
 *
 * Copyright (c) 2026 Alejandro Duque Jaramillo. All rights reserved.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License.
 * For the full license text, please visit: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
 *
 * You are free to:
 * - Share — copy and redistribute the material in any medium or format.
 * - Adapt — remix, transform, and build upon the material.
 *
 * Under the following terms:
 * - Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
 * - NonCommercial — You may not use the material for commercial purposes. This includes, but is not limited to, any use of the code (including for training artificial intelligence models) that is primarily intended for or directed towards commercial advantage or monetary compensation.
 * - ShareAlike — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.
 *
 * This license applies to all forms of use, including by automated systems or artificial intelligence models,
 * to prevent unauthorized commercial exploitation and ensure proper attribution.
 */
import L from 'leaflet';

export function createDurationCircleIcon(duration) {
  const minDuration = 5, maxDuration = 120;
  const minRadius = 20, maxRadius = 80;
  const normalizedDuration = Math.max(minDuration, Math.min(maxDuration, duration || 10));
  const radius = minRadius + ((normalizedDuration - minDuration) / (maxDuration - minDuration)) * (maxRadius - minRadius);

  let color = '#4e4e86'; // blue
  if (normalizedDuration < 30) color = '#4e4e86';
  else if (normalizedDuration < 60) color = '#9dc04cd4';
  else color = '#c24a6e';

  return L.divIcon({
    className: 'duration-circle-marker',
    html: `<div style="
      width: ${radius * 2}px; 
      height: ${radius * 2}px; 
      background-color: ${color}33; 
      border: 3px solid ${color}; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">
      <img src='/ultrared.png' style="
        width: 60%;
        height: 60%;
        object-fit: contain;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: none;
        pointer-events: none;
        opacity: 0.85;
      " alt='mic' />
      <div style="
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
      ">${Math.round(duration || 0)}s</div>
    </div>`,
    iconSize: [radius * 2, radius * 2 + 20],
    iconAnchor: [radius, radius],
  });
} 