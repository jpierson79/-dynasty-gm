# Import Pipeline Architecture

Fantrax CSV
      │
      ▼
CSV Parser
      │
      ▼
Normalized Player DTO
      │
      ▼
PlayerIdentityResolver
      │
      ▼
Insert / Update / Conflict / Unmatched
      │
      ▼
Persistence Layer
      │
      ▼
Import Report