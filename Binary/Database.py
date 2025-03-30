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

def fetch_page_content(url):
    """
    Fetch HTML content from the provided URL
    
    Args:
        url (str): URL of the player profile page
        
    Returns:
        str: HTML content of the page
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
        return response.text
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to fetch the URL: {str(e)}")

def extract_player_name(soup):
    """
    Extract player name from the page
    
    Args:
        soup (BeautifulSoup): Parsed HTML content
        
    Returns:
        str: Player name or "Unknown Player" if not found
    """
    try:
        # Try different selectors that might contain the player name
        selectors = [
            'h1.player-profile-name',
            '.player-name',
            'h1.font-bold',
            'title'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                name = element.text.strip()
                # If it's the title element, extract just the player name
                if selector == 'title':
                    name = name.split('|')[0].strip()
                    if "stats" in name.lower():
                        name = re.sub(r'\s+stats.*', '', name, flags=re.IGNORECASE)
                return name[:-15]
                
        # Extract from URL as fallback
        url_path = soup.find('meta', property='og:url')
        if url_path:
            url = url_path.get('content', '')
            match = re.search(r'/players/([^/]+)', url)
            if match:
                player_slug = match.group(1)
                player_name = ' '.join(word.capitalize() for word in player_slug.split('-') if word.isalpha())
                if player_name:
                    return player_name[:-15]
                    
        return "Unknown Player"
    except Exception:
        return "Unknown Player"

def find_matches_table(soup):
    """
    Find the table containing match statistics
    
    Args:
        soup (BeautifulSoup): Parsed HTML content
        
    Returns:
        BeautifulSoup: Table element containing match statistics or None if not found
    """
    # Look for table with specific classes or within specific container
    try:
        # First try with specific class
        table = soup.find('table', class_='w-full')
        if table:
            return table
            
        # Try with container that has "All Matches" heading
        all_matches_heading = soup.find('p', string=lambda text: text and 'All Matches' in text)
        if all_matches_heading:
            container = all_matches_heading.find_parent('div')
            if container:
                table = container.find('table')
                if table:
                    return table
                    
        # Generic approach - look for tables with certain column headers
        tables = soup.find_all('table')
        for table in tables:
            headers = table.find_all('th')
            header_texts = [h.get_text(strip=True).lower() for h in headers]
            if 'opposition' in header_texts and 'batting' in header_texts:
                return table
                
        return None
    except Exception:
        return None

def scrape_player_match_stats(html_content):
    """
    Scrape player match statistics from the provided HTML content
    
    Args:
        html_content (str): HTML content containing player match statistics
        
    Returns:
        tuple: (player_name, matches_list)
    """
    # Parse HTML content
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Extract player name
    player_name = extract_player_name(soup)
    
    # Find the table containing match stats
    table = find_matches_table(soup)
    if not table:
        raise Exception("Could not find match statistics table in the HTML content")
    
    # Extract all rows except the header
    tbody = table.find('tbody')
    if not tbody:
        raise Exception("Table structure is not as expected (missing tbody)")
        
    rows = tbody.find_all('tr')
    if not rows:
        raise Exception("No match data found in the table")
    
    matches = []
    
    for row in rows:
        cells = row.find_all('td')
        if len(cells) < 5:
            continue  # Skip rows with insufficient data
        
        try:
            # Create match entry with the required format
            match_entry = {
                "player_name": player_name
            }
            
            # Extract opposition
            match_link = cells[0].find('a')
            if not match_link:
                continue
                
            match_entry["opponent"] = match_link.get_text(strip=True)
            
            # Extract batting stats
            batting_div = cells[1].find('div', class_='flex')
            if batting_div:
                batting_stats = batting_div.find('p').get_text(strip=True)
            else:
                batting_stats = cells[1].find('p').get_text(strip=True)
            
            # Extract bowling stats
            bowling_div = cells[2].find('div', class_='flex')
            if bowling_div:
                bowling_stats = bowling_div.find('p').get_text(strip=True)
            else:
                bowling_stats = cells[2].find('p').get_text(strip=True)
            
            # Extract match format
            match_entry["format"] = cells[3].find('p').get_text(strip=True)
            
            # Extract and parse date
            date_text = cells[4].find('p').get_text(strip=True)
            try:
                date_obj = datetime.strptime(date_text, '%d-%b-%Y')
                match_entry["date"] = date_obj.strftime('%Y-%m-%d')
            except ValueError:
                # Try alternative date formats
                try:
                    date_obj = datetime.strptime(date_text, '%d %b %Y')
                    match_entry["date"] = date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    match_entry["date"] = date_text  # Use as-is if parsing fails
            
            # For batting stats, add runs and balls if available
            if batting_stats != "DNB" and batting_stats != "-":
                try:
                    # Handle not out innings (with *)
                    if "*" in batting_stats:
                        # Extract runs and balls using regex
                        match = re.search(r'(\d+)\*\((\d+)\)', batting_stats)
                        if match:
                            runs_str, balls_str = match.groups()
                        else:
                            runs_str, balls_str = batting_stats.replace("*", "").replace("(", "").replace(")", "").split()
                    else:
                        # Extract runs and balls using regex
                        match = re.search(r'(\d+)\((\d+)\)', batting_stats)
                        if match:
                            runs_str, balls_str = match.groups()
                        else:
                            runs_str, balls_str = batting_stats.replace("(", "").replace(")", "").split()
                    
                    match_entry["runs"] = int(runs_str)
                    match_entry["balls_faced"] = int(balls_str)
                except Exception:
                    pass
            
            # Extract bowling figures if available
            if bowling_stats not in ["DNB", "-"] and "/" in bowling_stats:
                try:
                    wickets_runs = bowling_stats.split("/")
                    match_entry["wickets"] = int(wickets_runs[0])
                    match_entry["runs_conceded"] = int(wickets_runs[1])
                except Exception:
                    pass
            
            matches.append(match_entry)
        except Exception as e:
            print(f"Warning: Could not process row: {str(e)}")
    
    return player_name, matches

def save_to_json(matches, player_name):
    """
    Save each match as a separate JSON file
    
    Args:
        matches (list): List of match dictionaries
        player_name (str): Name of the player
    """
    # Create a directory for the player
    player_dir = player_name.lower().replace(' ', '_') + "_matches"
    os.makedirs(player_dir, exist_ok=True)
    
    for i, match in enumerate(matches):
        # Generate a unique filename for each match
        date_str = match.get("date", "unknown_date").replace("-", "")
        opponent = match.get("opponent", "unknown").lower().replace(" ", "_")
        filename = f"{player_dir}/{date_str}_{opponent}_match.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as json_file:
                json.dump(match, json_file, indent=2)
            print(f"Match data saved to {filename}")
        except Exception as e:
            print(f"Error saving match data to {filename}: {str(e)}")
    
    return True

def initialize_pinecone(api_key, environment, index_name, dimension):
    """
    Initialize Pinecone client and ensure index exists
    
    Args:
        api_key (str): Pinecone API key
        environment (str): Pinecone environment
        index_name (str): Name of the index to use
        dimension (int): Vector dimension (depends on embedding model)
        
    Returns:
        pinecone.Index: Initialized Pinecone index
    """
    # Initialize connection to Pinecone
    pinecone.init(api_key=api_key, environment=environment)
    
    # Check if the index exists
    if index_name not in pinecone.list_indexes():
        # Create the index if it doesn't exist
        pinecone.create_index(
            name=index_name,
            dimension=dimension,
            metric="cosine"
        )
        print(f"Created new Pinecone index: {index_name}")
    
    # Connect to the index
    index = pinecone.Index(index_name)
    print(f"Connected to Pinecone index: {index_name}")
    
    return index

def create_vector_representation(match_data, model):
    """
    Create a vector representation of match data
    
    Args:
        match_data (dict): Match data dictionary
        model: SentenceTransformer model for creating embeddings
        
    Returns:
        tuple: (vector_id, vector, metadata)
    """
    # Create a string representation of the match for embedding
    match_text = f"{match_data['player_name']} scored {match_data.get('runs', 0)} runs from {match_data.get('balls_faced', 0)} balls against {match_data['opponent']} in a {match_data['format']} match on {match_data['date']}."
    
    if 'wickets' in match_data:
        match_text += f" Took {match_data['wickets']} wickets conceding {match_data.get('runs_conceded', 0)} runs."
    
    # Generate vector embedding
    vector = model.encode(match_text)
    
    # Create unique ID for the vector
    vector_id = str(uuid.uuid4())
    
    # Create metadata (all the original fields)
    metadata = match_data.copy()
    
    # Convert numeric fields to native types for Pinecone
    for key, value in metadata.items():
        if isinstance(value, (int, float)):
            metadata[key] = value
    
    return vector_id, vector.tolist(), metadata

def store_matches_in_pinecone(matches, index, model):
    """
    Store match data in Pinecone as vectors
    
    Args:
        matches (list): List of match dictionaries
        index: Pinecone index object
        model: SentenceTransformer model for creating embeddings
        
    Returns:
        int: Number of vectors successfully stored
    """
    vectors_to_upsert = []
    
    # Create vector representations for each match
    for match in matches:
        vector_id, vector, metadata = create_vector_representation(match, model)
        vectors_to_upsert.append((vector_id, vector, metadata))
    
    # Upsert in batches (Pinecone has a limit on batch size)
    batch_size = 10
    successful_upserts = 0
    
    for i in range(0, len(vectors_to_upsert), batch_size):
        batch = vectors_to_upsert[i:i+batch_size]
        
        try:
            # Format for upsert: [(id1, vector1, metadata1), ...]
            index.upsert(vectors=[(id, vec, meta) for id, vec, meta in batch])
            successful_upserts += len(batch)
            print(f"Successfully upserted batch of {len(batch)} vectors to Pinecone")
        except Exception as e:
            print(f"Error upserting batch to Pinecone: {str(e)}")
    
    return successful_upserts

def query_player_matches(player_name, index, model, top_k=5):
    """
    Query Pinecone for matches by a specific player
    
    Args:
        player_name (str): Name of the player to query
        index: Pinecone index
        model: SentenceTransformer model
        top_k (int): Number of matches to return
        
    Returns:
        list: List of match metadata
    """
    # Create a query vector
    query_text = f"Matches played by {player_name}"
    query_vector = model.encode(query_text).tolist()
    
    # Query Pinecone
    results = index.query(
        vector=query_vector,
        filter={"player_name": player_name},
        top_k=top_k,
        include_metadata=True
    )
    
    # Extract and return the results
    matches = [match.metadata for match in results.matches]
    return matches

def main():
    try:
        # Get URL from user input
        url = input("Enter cricket.com player URL (e.g., https://www.cricket.com/players/virat-kohli-3993): ")
        
        if not url or not url.startswith("http"):
            print("Please enter a valid URL: ")
            return
        
        # Get Pinecone credentials
        pinecone_api_key = Pinecone(api_key="")
        # pinecone_environment = "llama-text-embed-v2-index"
        pinecone_index_name = "cricket-stats"
        
        print(f"Fetching data from {url}...")
        html_content = fetch_page_content(url)
        
        print("Extracting player statistics...")
        player_name, matches = scrape_player_match_stats(html_content)
        
        if not matches:
            print("No match data found for the player")
            return
            
        print(f"Found {len(matches)} matches for {player_name}")
        
        # Save to JSON files
        save_to_json(matches, player_name)
        
        # Initialize SentenceTransformer model for creating embeddings
        print("Loading embedding model...")
        model = SentenceTransformer('all-MiniLM-L6-v2')  # 384-dimensional embeddings
        
        # Initialize Pinecone
        print("Connecting to Pinecone...")
        index = pinecone_api_key.Index(pinecone_index_name)
        
        # Store matches in Pinecone
        print("Storing matches in Pinecone...")
        stored_count = store_matches_in_pinecone(matches, index, model)
        print(f"Successfully stored {stored_count} match vectors in Pinecone")
        
        # Demonstrate a query
        print("\nDemonstrating a sample query...")
        recent_matches = query_player_matches(player_name, index, model, top_k=3)
        print(f"Recent matches for {player_name}:")
        for match in recent_matches:
            print(f"- {match['date']} vs {match['opponent']} ({match['format']}): {match.get('runs', 0)} runs")
        
        print("\nYou can now query this data using the Pinecone API or search interface.")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()