import sqlite3
import sqlitecloud

def calculate_and_store_average_points():
    """
    Extracts points for each player from an SQLite database, calculates the average
    point for each player, and stores the results in another SQLite database.

    Args:
        input_db_path: Path to the input SQLite database.
        output_db_path: Path to the output SQLite database.
    """

    try:
        # Connect to SQLite Cloud database
        conn = sqlitecloud.connect("")
        cursor = conn.cursor()

        # Create the output table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS player_average_points (
                player_name TEXT PRIMARY KEY,
                average_point REAL
            )
        """)
        conn.commit()

        # Fetch player names and points from the input database
        cursor.execute("SELECT player_name, point FROM player_points")
        player_points_data = cursor.fetchall()

        # Calculate average points for each player
        player_points = {}
        for player_name, point in player_points_data:
            if player_name in player_points:
                player_points[player_name].append(point)
            else:
                player_points[player_name] = [point]

        player_average_points = {}
        for player_name, points in player_points.items():
            player_average_points[player_name] = sum(points) / len(points)

        # Insert average points into the output database
        for player_name, average_point in player_average_points.items():
            try:
                cursor.execute("""
                    INSERT INTO player_average_points (player_name, average_point)
                    VALUES (?, ?)
                """, (player_name, average_point))
            except sqlite3.IntegrityError:
                # Handle case where player already exists in the table (update instead of insert)
                cursor.execute("""
                    UPDATE player_average_points
                    SET average_point = ?
                    WHERE player_name = ?
                """, (average_point, player_name))

        conn.commit()
        print("Average points calculated and stored successfully.")

    except sqlite3.Error as e:
        print(f"An error occurred: {e}")

    finally:
        # Close connections
        conn.close()


# Example Usage:
if __name__ == "__main__":
    # Replace with your SQL Cloud connection strings

    calculate_and_store_average_points()