
'''
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re

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
                return name
                
        # Extract from URL as fallback
        url_path = soup.find('meta', property='og:url')
        if url_path:
            url = url_path.get('content', '')
            match = re.search(r'/players/([^/]+)', url)
            if match:
                player_slug = match.group(1)
                player_name = ' '.join(word.capitalize() for word in player_slug.split('-') if word.isalpha())
                if player_name:
                    return player_name
                    
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
            # Extract match information
            match_link = cells[0].find('a')
            if not match_link:
                continue
                
            opposition = match_link.get_text(strip=True)
            match_url = match_link.get('href')
            
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
            match_format = cells[3].find('p').get_text(strip=True)
            
            # Extract and parse date
            date_text = cells[4].find('p').get_text(strip=True)
            try:
                date_obj = datetime.strptime(date_text, '%d-%b-%Y')
                formatted_date = date_obj.strftime('%Y-%m-%d')
            except ValueError:
                # Try alternative date formats
                try:
                    date_obj = datetime.strptime(date_text, '%d %b %Y')
                    formatted_date = date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    formatted_date = date_text  # Use as-is if parsing fails
            
            # Create match entry
            match_entry = {
                "opposition": opposition,
                "batting": batting_stats,
                "bowling": bowling_stats,
                "format": match_format,
                "date": formatted_date,
                "match_url": match_url if match_url.startswith('http') else f"https://www.cricket.com{match_url}"
            }
            
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
                        match_entry["not_out"] = True
                    else:
                        # Extract runs and balls using regex
                        match = re.search(r'(\d+)\((\d+)\)', batting_stats)
                        if match:
                            runs_str, balls_str = match.groups()
                        else:
                            runs_str, balls_str = batting_stats.replace("(", "").replace(")", "").split()
                        match_entry["not_out"] = False
                    
                    match_entry["runs"] = int(runs_str)
                    match_entry["balls"] = int(balls_str)
                    if match_entry["runs"] > 0 and match_entry["balls"] > 0:
                        match_entry["strike_rate"] = round(match_entry["runs"] * 100 / match_entry["balls"], 2)
                except Exception:
                    # In case the format is unexpected
                    match_entry["runs_balls"] = batting_stats
            
            # Extract bowling figures if available
            if bowling_stats not in ["DNB", "-"] and "/" in bowling_stats:
                try:
                    wickets_runs = bowling_stats.split("/")
                    match_entry["wickets"] = int(wickets_runs[0])
                    match_entry["runs_conceded"] = int(wickets_runs[1])
                except Exception:
                    match_entry["bowling_figures"] = bowling_stats
            
            matches.append(match_entry)
        except Exception as e:
            print(f"Warning: Could not process row: {str(e)}")
    
    return player_name, matches

def generate_player_stats(matches, player_name):
    """
    Generate overall statistics from the match data
    
    Args:
        matches (list): List of match dictionaries
        player_name (str): Name of the player
        
    Returns:
        dict: Player statistics summary
    """
    # Calculate statistics
    total_runs = sum(match.get("runs", 0) for match in matches)
    total_matches = len(matches)
    total_not_outs = sum(1 for match in matches if match.get("not_out", False))
    innings_batted = sum(1 for match in matches if "runs" in match)
    
    if innings_batted > 0:
        batting_average = round(total_runs / (innings_batted - total_not_outs) if innings_batted > total_not_outs else total_runs, 2)
    else:
        batting_average = 0
    
    highest_score = max((match.get("runs", 0) for match in matches), default=0)
    highest_score_match = None
    for match in matches:
        if match.get("runs", 0) == highest_score:
            not_out_marker = "*" if match.get("not_out", False) else ""
            highest_score_match = f"{highest_score}{not_out_marker} vs {match['opposition']} ({match['date']})"
            break
    
    # Format statistics
    formats = {}
    for match in matches:
        format_name = match["format"]
        if format_name in formats:
            formats[format_name]["matches"] += 1
            if "runs" in match:
                formats[format_name]["innings"] += 1
                formats[format_name]["runs"] += match["runs"]
                formats[format_name]["balls"] += match.get("balls", 0)
                
                # Count centuries and half-centuries
                runs = match["runs"]
                if runs >= 100:
                    formats[format_name]["centuries"] += 1
                elif runs >= 50:
                    formats[format_name]["half_centuries"] += 1
                
                if match.get("not_out", False):
                    formats[format_name]["not_outs"] += 1
        else:
            innings_count = 1 if "runs" in match else 0
            formats[format_name] = {
                "matches": 1,
                "innings": innings_count,
                "runs": match.get("runs", 0) if innings_count else 0,
                "balls": match.get("balls", 0) if innings_count else 0,
                "centuries": 1 if match.get("runs", 0) >= 100 else 0,
                "half_centuries": 1 if 50 <= match.get("runs", 0) < 100 else 0,
                "not_outs": 1 if match.get("not_out", False) else 0
            }
    
    # Calculate additional stats by format
    for format_name, stats in formats.items():
        if stats["innings"] > 0:
            # Calculate average
            dismissals = stats["innings"] - stats["not_outs"]
            stats["average"] = round(stats["runs"] / dismissals, 2) if dismissals > 0 else stats["runs"]
            
            # Calculate strike rate
            stats["strike_rate"] = round(stats["runs"] * 100 / stats["balls"], 2) if stats["balls"] > 0 else 0
    
    # Get recent form (last 5 matches with runs)
    recent_form = []
    for match in sorted(matches, key=lambda x: x.get("date", ""), reverse=True):
        if "runs" in match:
            not_out_marker = "*" if match.get("not_out", False) else ""
            recent_form.append(f"{match['runs']}{not_out_marker}")
            if len(recent_form) >= 5:
                break
    
    # Create player stats dictionary
    player_stats = {
        "player_name": player_name,
        "total_matches": total_matches,
        "total_runs": total_runs,
        "batting_average": batting_average,
        "highest_score": highest_score_match if highest_score_match else str(highest_score),
        "centuries": sum(stats["centuries"] for stats in formats.values()),
        "half_centuries": sum(stats["half_centuries"] for stats in formats.values()),
        "recent_form": recent_form,
        "formats": formats,
        "matches": matches,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    return player_stats

def save_to_json(data, filename="player_stats.json"):
    """
    Save data to a JSON file
    
    Args:
        data (dict): Data to save
        filename (str): Name of the JSON file
    """
    try:
        with open(filename, 'w', encoding='utf-8') as json_file:
            json.dump(data, json_file, indent=2)
        print(f"Data successfully saved to {filename}")
        return True
    except Exception as e:
        print(f"Error saving data to {filename}: {str(e)}")
        return False

def main():
    try:
        # Get URL from user input
        url = input("Enter cricket.com player URL (e.g., https://www.cricket.com/players/virat-kohli-3993): ")
        
        if not url or not url.startswith("http"):
            print("Please enter a valid URL : ")
            return
        
        print(f"Fetching data from {url}...")
        html_content = fetch_page_content(url)
        
        print("Extracting player statistics...")
        player_name, matches = scrape_player_match_stats(html_content)
        
        if not matches:
            print("No match data found for the player")
            return
            
        print(f"Found {len(matches)} matches for {player_name}")
        
        # Generate player statistics
        player_stats = generate_player_stats(matches, player_name)
        
        # Save to JSON file
        output_file = f"{player_name.lower().replace(' ', '_')}_stats.json"
        if save_to_json(player_stats, output_file):
            # Print summary
            print("\nSummary Statistics:")
            print(f"Player: {player_name}")
            print(f"Total Matches: {player_stats['total_matches']}")
            print(f"Total Runs: {player_stats['total_runs']}")
            print(f"Batting Average: {player_stats['batting_average']}")
            print(f"Highest Score: {player_stats['highest_score']}")
            print(f"Centuries: {player_stats['centuries']}")
            print(f"Half-centuries: {player_stats['half_centuries']}")
            print(f"Recent Form: {', '.join(player_stats['recent_form'])}")
            print("\nMatches by Format:")
            for format_name, stats in player_stats['formats'].items():
                print(f"  {format_name}: {stats['matches']} matches, {stats['innings']} innings, {stats['runs']} runs")
                print(f"    Average: {stats.get('average', 0)}, Strike Rate: {stats.get('strike_rate', 0)}")
                print(f"    Centuries: {stats['centuries']}, Half-centuries: {stats['half_centuries']}")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()'
'''

import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re

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
                return name
                
        # Extract from URL as fallback
        url_path = soup.find('meta', property='og:url')
        if url_path:
            url = url_path.get('content', '')
            match = re.search(r'/players/([^/]+)', url)
            if match:
                player_slug = match.group(1)
                player_name = ' '.join(word.capitalize() for word in player_slug.split('-') if word.isalpha())
                if player_name:
                    return player_name
                    
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

def main():
    try:
        # Get URL from user input
        url = input("Enter cricket.com player URL (e.g., https://www.cricket.com/players/virat-kohli-3993): ")
        
        if not url or not url.startswith("http"):
            print("Please enter a valid URL: ")
            return
        
        print(f"Fetching data from {url}...")
        html_content = fetch_page_content(url)
        
        print("Extracting player statistics...")
        player_name, matches = scrape_player_match_stats(html_content)
        
        if not matches:
            print("No match data found for the player")
            return
            
        print(f"Found {len(matches)} matches for {player_name}")
        
        # Save each match to a separate JSON file
        if save_to_json(matches, player_name):
            print(f"\nSuccessfully saved {len(matches)} match data files for {player_name}")
            
            # Print sample of the first match
            if matches:
                print("\nSample match data format:")
                print(json.dumps(matches[0], indent=2))
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()