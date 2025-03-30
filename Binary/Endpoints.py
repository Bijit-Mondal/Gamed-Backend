from flask import Flask, jsonify, request
import sqlitecloud
import math
from fuzzywuzzy import fuzz
from fuzzywuzzy import process

app = Flask(__name__)

# SQLite Cloud connection string
DATABASE_URL = ""

def get_db_connection():
    """Connect to SQLite Cloud database."""
    conn = sqlitecloud.connect(DATABASE_URL)
    return conn

@app.route('/player/<string:player_name>', methods=['GET'])
def get_player_points(player_name):
    """
    Endpoint to fetch credit points for a specific player.
    URL: /player/<player_name>
    """
    # player_name = " ".join(player_name.split("-")).title()
    search_term = player_name

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        threshold = 30

        # Fetch all player names from the database
        cursor.execute("SELECT player_name FROM player_average_points")
        player_names = [row[0] for row in cursor.fetchall()]
        
        # Perform fuzzy matching
        best_match, score = process.extractOne(search_term, player_names, scorer=fuzz.ratio)
        print(best_match)
        print(score)
        if score >= threshold:
            # Retrieve the average point for the best matching player
            query = '''
            SELECT player_name, average_point
            FROM player_average_points
            WHERE player_name = ?
            '''

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(query, (best_match,))
            rows = cursor.fetchone()
            
            if not rows:
                return jsonify({"message": f"No data found for player: {best_match}"}), 404

        # Format the response data
        results = []
        
        results.append({
                "player_name": rows[0],
                "credit_points": math.ceil(rows[1])
            })

        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

@app.route('/players', methods=['GET'])
def get_all_players():
    """
    Endpoint to fetch all players and their average credit points.
    URL: /players
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Query to fetch all players and their average points
        query = '''
        SELECT player_name, total_matches, avg_credit
        FROM total_credits
        '''
        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            return jsonify({"message": "No players found"}), 404

        # Format the response data
        results = []
        for row in rows:
            results.append({
                "player_name": row[0],
                "total_matches": row[1],
                "avg_credit_points": row[2]
            })

        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)
