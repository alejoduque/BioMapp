# Sample Data for BioMap/MANAKAI Soundscape

This directory contains example recordings to demonstrate the BioMap application functionality.

## Structure

The `example-recordings.json` file contains sample audio spot data with the following structure:

- **id**: Unique identifier for the recording
- **filename**: Name of the audio file
- **duration**: Length of recording in seconds
- **timestamp**: Unix timestamp when recording was made
- **location**: GPS coordinates (latitude and longitude)
- **description**: Human-readable description of the sound
- **tags**: Array of descriptive tags
- **pendingUpload**: Boolean indicating if the recording needs to be uploaded

## Example Locations

The sample data includes recordings from various New York City locations:
- Central Park (bird songs)
- Times Square (traffic sounds)
- Bryant Park (water fountain)
- Street music performances

## Usage

These examples demonstrate:
- Different types of environmental sounds
- Various recording durations
- Geographic distribution of recordings
- Tagging and categorization
- Timestamp organization

The data structure matches what the application expects for displaying audio spots on the map and managing the soundscape collection. 