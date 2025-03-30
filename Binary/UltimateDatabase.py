import sqlitecloud
import sqlite3

def calculate_credit_points(runs, balls_faced, wickets, match_format, catches):
    """
    Calculates credit points for a player based on their performance.
    Ensures points are between 4 and 10.

    Args:
        runs: Runs scored by the player.
        balls_faced: Balls faced by the player.
        wickets: Wickets taken by the player.
        match_format: Format of the match (e.g., 'T20', 'ODI', 'Test').
        catches: Number of catches taken by the player.

    Returns:
        The calculated credit points (between 4 and 10).
    """

    points = 0

    # Batting points
    if balls_faced > 0:
        points += runs / balls_faced * 10  # Runs per ball faced
    if runs >= 50:
        points += 20  # Bonus for a half-century
    if runs >= 100:
        points += 50  # Bonus for a century

    # Bowling points
    points += wickets * 30  # Points per wicket

    # Fielding points
    points += catches * 10  # Points per catch

    # Format-specific adjustments
    if match_format == 'Test':
        points *= 1.2  # Test matches are worth more
    elif match_format == 'ODI':
        points *= 1.0
    elif match_format == 'T20':
        points *= 0.8  # T20 matches are worth less

    # Normalize points to be between 4 and 10
    points = max(4, min(10, points / 10))  # Scale and clamp

    return round(points, 2)  # Round to 2 decimal places

def fetch_player_data():
    # Connect to SQLite Cloud database
    conn = sqlitecloud.connect("")
    cursor = conn.cursor()

    # Query to fetch all player data
    query = "SELECT * FROM stats"
    cursor.execute(query)

    # Fetch all rows from the stats table
    players_data = cursor.fetchall()

    listOfPlayers = []

    # Display data for each player
    for row in players_data:
        player_name = row[0]
        opponent = row[1]  # Default to None if missing
        runs_scored = row[2]  # Default to 0 if missing
        balls_faced = row[3]  # Default to 0 if missing
        wickets_taken = row[4]  # Default to 0 if missing
        catch_taken = row[5]  # Default to 0 if missing
        format_type = row[6]
        date = row[7]  # Default to None if missing
        point = calculate_credit_points(runs_scored, balls_faced, wickets_taken, format, catch_taken)
        listOfPlayers.append((player_name, point))
    return listOfPlayers


def upload_player_points(player_points_list):
    """
    Uploads player names and their corresponding points to an SQLite database.

    Args:
        db_path: Path to the SQLite database.
        player_points_list: A list of tuples, where each tuple contains (player_name, point).
    """

    try:
        # Open the connection to SQLite Cloud
        conn = sqlitecloud.connect("")

        # Connect to SQLite database (or create it if it doesn't exist)
        cursor = conn.cursor()

        # Create the table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS player_points (
                player_name TEXT,
                point REAL
            )
        """)
        conn.commit()

        # Insert the data
        cursor.execute("INSERT INTO player_points (player_name, point) VALUES (?, ?)", player_points_list)
        conn.commit()

        print(f"Successfully uploaded {len(player_points_list)} player points to cloud")

    except sqlite3.Error as e:
        print(f"An error occurred: {e}")

    finally:
        # Close the connection
        if conn:
            conn.close()


# Example Usage:
if __name__ == "__main__":
    # Call the function to fetch and display player data
    players = fetch_player_data()

    upload_player_points(players)

