import re
import csv

def extract_player_data(html_content, output_filename="player_urls.csv"):
    """
    Extracts player name, ID, and URL from the given HTML content (script) and saves the data to a CSV file.

    Args:
        html_content (str): The HTML content (specifically the script part) to parse.
        output_filename (str, optional): The name of the CSV file to create. Defaults to "player_urls.csv".

    Returns:
        None
    """

    base_url = "https://www.cricket.com/players/"  # Corrected base URL
    pattern = r'\\"href\\":\\"/players/([a-zA-Z0-9\-]+)\\\",'

    matches = re.findall(pattern, html_content)

    with open(output_filename, 'w', newline='', encoding='utf-8') as csvfile:
        csv_writer = csv.writer(csvfile)
        csv_writer.writerow(['Name', 'ID', 'URL'])  # Write header row

        unique_urls = set()  # Use a set to store unique URLs

        for href in matches:
            try:
                parts = href.split('-')
                url_id = int(parts[-1])
                player_name_slug = '-'.join(parts[:-1])
                player_name = ' '.join(word.capitalize() for word in player_name_slug.split('-'))
                player_url = f"{base_url}{href}/recent"

                if player_url not in unique_urls:  # Check if URL is already in the set
                    csv_writer.writerow([player_name, url_id, player_url])
                    unique_urls.add(player_url)  # Add URL to the set
                else:
                    print(f"Duplicate URL found: {player_url}") #optional
            except Exception as e:
                print(f"Error processing href {href}: {e}")

# Load the HTML content from the provided file
file_path = 'Demo.txt'
try:
    with open(file_path, 'r', encoding='utf-8') as file:
        html_content = file.read()
except FileNotFoundError:
    print(f"Error: The file '{file_path}' was not found.")
    html_content = None
except Exception as e:
    print(f"Error occurred while reading the file: {e}")
    html_content = None

if html_content:
    extract_player_data(html_content)
    print("CSV file created successfully.")
else:
    print("No data to process.")
