import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re
import Fetch

# pip install sqlitecloud
import sqlite3
import json
import sqlitecloud

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


def main():
    # Open the connection to SQLite Cloud
    conn = sqlitecloud.connect("")

    # Connect to SQLite database (or create it if it doesn't exist)
    cursor = conn.cursor()
    i = 0
    try:
        urls = Fetch.fetch_data_from_mongodb()
        for url in urls:
            content = fetch_page_content(url["url"])
            details = scrape_player_match_stats(content)
            player_name = details[0]
            details = details[1]
            for entry in details:
                player_name = entry.get('player_name')
                opponent = entry.get('opponent', None)  # Default to None if missing
                runs_scored = entry.get('runs', 0)  # Default to 0 if missing
                balls_faced = entry.get('balls_faced', 0)  # Default to 0 if missing
                wickets_taken = entry.get('wickets', 0)  # Default to 0 if missing
                catch_taken = entry.get('catch_taken', 0)  # Default to 0 if missing
                format_type = entry.get('format')
                date = entry.get('date', None)  # Default to None if missing
                
                # Insert into database
                cursor.execute('''
                    INSERT INTO stats (player_name, opponent, runs_scored, balls_faced, wickets_taken, catch_taken, format, date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (player_name, opponent, runs_scored, balls_faced, wickets_taken, catch_taken, format_type, date))
                print("Successful")
                print(i)
                i = i + 1
            

            
                
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()