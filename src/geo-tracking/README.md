# Geo Tracking Module

This module manages all data structures for the Employee Geo Activity Timeline feature.

## Collections

### 1. attendance_daily
- **Purpose**: One document per employee per day, tracking daily attendance status and sessions.
- **Key Fields**: companyId, employeeId, attendanceDate, status, firstCheckInAt, sessions
- **Note**: Contains session and break metadata but NOT raw location points

### 2. location_points
- **Purpose**: Append-only collection storing all raw GPS location points received from devices. Never updated after insert.
- **Key Fields**: companyId, employeeId, attendanceId, location (GeoJSON), accuracyM, isMocked, quality
- **Note**: This is the source of truth for location data

### 3. employee_live_locations
- **Purpose**: One document per active employee, tracking latest live location and status. Upserted frequently.
- **Key Fields**: companyId, employeeId, latestPointId, location, status, isStale
- **Note**: NOT a history table - only latest state

### 4. attendance_timeline_summaries
- **Purpose**: Calculated summaries for attendance days. Rebuildable from raw data.
- **Key Fields**: companyId, employeeId, attendanceId, distances, timings, polylines, timelineEvents, anomalies
- **Note**: Never the source of truth - can be fully regenerated

## Why Raw Points Are Not Stored In Attendance Documents

1. **Hot Document Growth**: A single attendance document would grow continuously throughout the day as location points are added, causing performance degradation, increased document size, and potential write bottlenecks. MongoDB handles large, growing documents poorly.

2. **Rebuild Difficulty**: Storing points inline makes it much harder to reprocess or rebuild timeline summaries if needed. Keeping points separate allows full recomputation from source data.
