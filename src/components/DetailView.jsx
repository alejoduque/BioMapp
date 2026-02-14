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
import React from 'react';

class DetailView extends React.Component {

  render () {
    var innerInfo = null
    if(this.props.point && this.props.point!== null) {
      var point = this.props.point.properties

      innerInfo =
      <div className="absolute w-full p-2 pt-4 md:pt-16 pin-b pin-l gradient flex items-center justify-center" style={{ height: "50%", backgroundColor: "rgb(20 50 20 / 85%)"}}>
        <i onClick={() => this.props.getPreviousRecording(this.props.point)} className="fas fa-chevron-left text-4xl text-white hover:text-black cursor-pointer m-2 md:m-12"></i>
        <div className="max-w-xl flex flex-col sm:flex-row flex items-start md:items-center h-full">
          <div className="h-1/2 p-4 text-black leading-normal pb-3 font-sans overflow-auto" style={{ flex:2 }}>
            <div className="text-lg font-semibold mb-2">
              50a {point.filename}</div>
            <div className="text-sm mb-3">
              <span className="font-medium">Duración:</span> {point.duration}s | 
              <span className="font-medium ml-2">Calidad:</span> {point.quality} |
              <span className="font-medium ml-2">Fecha:</span> {new Date(point.timestamp).toLocaleDateString()}
            </div>
            {point.notes && (
              <div className="mb-3">
                <span className="font-medium">Descripción:</span> {point.notes}
              </div>
            )}
            {point.speciesTags && point.speciesTags.length > 0 && (
              <div className="mb-3">
                <span className="font-medium">Especies:</span> {point.speciesTags.join(', ')}
              </div>
            )}
            {(point.weather || point.temperature) && (
              <div className="mb-3">
                {point.weather && <><span className="font-medium">Clima:</span> {point.weather}</>}
                {point.temperature && <><span className="font-medium ml-2">Temperatura:</span> {point.temperature}</>}
              </div>
            )}
          </div>
          <div className="p-4 text-large font-sans text-white flex-1">
              <div className="text-lg md:text-4xl mb-6">
                4cd Ubicación GPS
              </div>
              <div className="text-sm opacity-75">
                {this.props.point.geometry.coordinates[1].toFixed(6)}, {this.props.point.geometry.coordinates[0].toFixed(6)}
              </div>
              {/* Removed location name - will show actual GPS coordinates instead */}
              {point.timestamp && (
                <div className="text-xs opacity-75 mt-2">
                  {new Date(point.timestamp).toLocaleString()}
                </div>
              )}
          </div>
        </div>
        <i onClick={() => this.props.getNextRecording(this.props.point)} className="fas fa-chevron-right text-4xl text-white hover:text-black cursor-pointer m-2 md:m-12"></i>
      </div>
    }
    return innerInfo

  }
}

export default DetailView
