
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import csv
import pymongo

def upload_players_to_mongodb(player_data):
    """
    Uploads player names and URLs to a MongoDB database.

    Args:
        player_data (list): A list of dictionaries containing player names and URLs.
        db_name (str): The name of the database to connect to. Defaults to 'cricket'.
        collection_name (str): The name of the collection to store player data. Defaults to 'players'.

    Returns:
        None
    """
    try:
        # Connect to MongoDB
        uri = ""

        # Create a new client and connect to the server
        client = MongoClient(uri, server_api=ServerApi('1'))

        # Send a ping to confirm a successful connection
        try:
            client.admin.command('ping')
            print("Pinged your deployment. You successfully connected to MongoDB!")
        except Exception as e:
            print(e)

        # Access database and collection
        db = client["cricket"]
        collection = db["players"]

        # Insert player data into the collection
        result = collection.insert_many(player_data)
        
        print(f"Inserted {len(result.inserted_ids)} players into the collection.")
    
    except Exception as e:
        print(f"An error occurred: {e}")

def process_csv(filename):
    """Process CSV file and upsert embeddings to Pinecone"""
    urls = []
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header row
        
        vectors = []
        for row_id, row in enumerate(reader):
            if len(row) < 3:
                continue
                
            # Extract 3rd column value
            text = row[2].strip()
            
            url = {
                "player_name": " ".join(text.split("/")[4].split("-")[0:-1]).title(),
                "url": row[2]
            }
            print(url["player_name"])

            urls.append(url)
    return urls


# Example player data
filename = "player_urls.csv"
player_data = process_csv(filename)

# Upload players to MongoDB
upload_players_to_mongodb(player_data)
