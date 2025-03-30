
# pip install sqlitecloud
import sqlite3
import json
import sqlitecloud

# Connect to SQLite database (or create it if it doesn't exist)
conn = sqlite3.connect('cricket_stats.db')
cursor = conn.cursor()

# Sample JSON data
json_data = {}

# Parse JSON data
data = json.loads(json_data)

# Insert data into the stats table
for entry in data:
    player_name = entry.get('player_name')
    opponent = entry.get('opponent', None)  # Default to None if missing
    runs_scored = entry.get('runs_scored', 0)  # Default to 0 if missing
    balls_faced = entry.get('balls_faced', 0)  # Default to 0 if missing
    wickets_taken = entry.get('wickets_taken', 0)  # Default to 0 if missing
    catch_taken = entry.get('catch_taken', 0)  # Default to 0 if missing
    format_type = entry.get('format')
    date = entry.get('date', None)  # Default to None if missing

    # Insert into database
    cursor.execute('''
        INSERT INTO stats (player_name, opponent, runs_scored, balls_faced, wickets_taken, catch_taken, format, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (player_name, opponent, runs_scored, balls_faced, wickets_taken, catch_taken, format_type, date))

# Commit changes and close the connection
conn.commit()
conn.close()

print("Data inserted successfully!")
