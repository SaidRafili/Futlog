-- Run once:  psql -U postgres -c "CREATE DATABASE teams;"  then  psql -U postgres -d teams -f scripts/schema.sql
CREATE TABLE IF NOT EXISTS teams (
    teamId INT PRIMARY KEY,
    location VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10),
    displayName VARCHAR(100),
    shortDisplayName VARCHAR(100),
    color CHAR(6),
    alternateColor CHAR(6),
    logoURL TEXT,
    venueId INT,
    slug VARCHAR(100) UNIQUE
);
