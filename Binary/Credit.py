import Fetch
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re
import pinecone
from pinecone import Pinecone
import numpy as np
from sentence_transformers import SentenceTransformer
import uuid
import Database

def calculate_base_credit_points(runs_scored, balls_faced, wickets_taken, catches_taken, match_format):
    """
    Calculates a player's base credit points based on their performance in a cricket match.

    Args:
        runs_scored (int): The number of runs scored by the player.
        balls_faced (int): The number of balls faced by the player.
        wickets_taken (int): The number of wickets taken by the player.
        catches_taken (int): The number of catches taken by the player.
        match_format (str): The format of the match (e.g., "Test", "ODI", "T20").  Case-insensitive.

    Returns:
        float: The calculated base credit points.  Returns -1 if the match format is invalid.
    """

    match_format = match_format.lower()  # Convert to lowercase for case-insensitive comparison

    # Define base point values for different actions
    run_point = 0.5
    ball_faced_point = 0.1
    wicket_point = 10
    catch_point = 5

    # Adjust point values based on match format
    if match_format == "test":
        run_point = 0.7
        ball_faced_point = 0.2
        wicket_point = 15
        catch_point = 7
    elif match_format == "odi":
        run_point = 0.6
        ball_faced_point = 0.15
        wicket_point = 12
        catch_point = 6
    elif match_format == "t20":
        run_point = 0.8
        ball_faced_point = 0.25
        wicket_point = 18
        catch_point = 8
    else:
        print("Invalid match format. Supported formats are 'Test', 'ODI', and 'T20'.")
        return -1  # Indicate an error

    # Calculate base credit points
    base_points = (runs_scored * run_point) + (balls_faced * ball_faced_point) + \
                  (wickets_taken * wicket_point) + (catches_taken * catch_point)

    return base_points


# Example Usage:
if __name__ == "__main__":
    datas = Fetch.fetch_data_from_mongodb()
    urls = []
    for data in datas:
        urls.append(data["url"])
    
    for url in urls:
        try:
            if not url or not url.startswith("http"):
                print("Wrong Url!!!")
            
            # Get Pinecone credentials
            pinecone_api_key = Pinecone(api_key="")
            # pinecone_environment = "llama-text-embed-v2-index"
            pinecone_index_name = "player-stats"
            
            print(f"Fetching data from {url}...")
            html_content = Database.fetch_page_content(url)
            
            print("Extracting player statistics...")
            player_name, matches = Database.scrape_player_match_stats(html_content)
            
            if not matches:
                print("No match data found for the player")
                
            print(f"Found {len(matches)} matches for {player_name}")
            
            # Save to JSON files
            # Database.save_to_json(matches, player_name)
            
            # Initialize SentenceTransformer model for creating embeddings
            print("Loading embedding model...")
            model = SentenceTransformer('all-MiniLM-L6-v2')  # 384-dimensional embeddings
            
            # Initialize Pinecone
            print("Connecting to Pinecone...")
            index = pinecone_api_key.Index(pinecone_index_name)
            
            # Store matches in Pinecone
            print("Storing matches in Pinecone...")
            stored_count = Database.store_matches_in_pinecone(matches, index, model)
            print(f"Successfully stored {stored_count} match vectors in Pinecone")
            
            # Demonstrate a query
            print("\nDemonstrating a sample query...")
            recent_matches = Database.query_player_matches(player_name, index, model, top_k=3)
            print(f"Recent matches for {player_name}:")
            for match in recent_matches:
                print(f"- {match['date']} vs {match['opponent']} ({match['format']}): {match.get('runs', 0)} runs")
            
            print("\nYou can now query this data using the Pinecone API or search interface.")
            
        except Exception as e:
            print(f"An error occurred: {str(e)}")
