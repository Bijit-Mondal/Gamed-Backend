import json
import requests
from bs4 import BeautifulSoup

def create_player_urls(html_content):
    """
    Extracts player name and ID from the given HTML, constructs URLs,
    and returns a JSON string with player names as keys and URLs as values.

    Args:
        html_content (str): The HTML content to parse.

    Returns:
        str: A JSON string containing a dictionary with player names as keys and URLs as values.
             Returns '[]' if no player data is found.
    """

    player_urls = {}
    soup = BeautifulSoup(html_content, 'html.parser')

    # Find all divs with class 'ds-grow'
    player_divs = soup.find_all('div', class_='ds-grow')

    for player_div in player_divs:
        # Find the link (<a> tag) within each player div
        link = player_div.find('a')
        if link:
            player_name = link.text.strip()
            href = link.get('href')

            # Extract player ID from the href
            try:
                player_id = int(href.split('-')[-1])  # Assuming ID is the last part after '-'
            except:
                player_id = None  # Handle cases where id is absent or malformed

            if player_id is not None:  # Only include if id is valid
                base_url = "https://www.cricket.com/players/"
                player_url = f"{base_url}{player_name.lower().replace(' ', '-')}-{player_id}"
                player_urls[player_name] = player_url

    return json.dumps(player_urls, indent=4)  # Convert to JSON string with indentation


# URL of the HTML content
url = "https://www.cricket.com/players"

try:
    response = requests.get(url)
    response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
    html_content = response.text
except requests.exceptions.RequestException as e:
    print(f"Error fetching the URL: {e}")
    html_content = None

if html_content:
    player_urls_json = create_player_urls(html_content)
    print(player_urls_json)
else:
    print("[]")  # Print empty JSON array if no content
