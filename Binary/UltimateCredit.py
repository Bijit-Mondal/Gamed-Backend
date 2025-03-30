import json
import pinecone
from pinecone import Pinecone
from typing import Dict, Any, Optional

def get_player_data(index_name: str, player_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve player data from Pinecone by player ID.
    
    Args:
        index_name: Name of the Pinecone index containing player data
        player_id: Unique identifier for the player
        
    Returns:
        Dictionary containing player data or None if not found
    """
    try:
        # Get Pinecone credentials
        pinecone_api_key = Pinecone(api_key="")
        # pinecone_environment = "llama-text-embed-v2-index"
        pinecone_index_name = "cricket-stats"

        # Connect to the Pinecone index
        index = pinecone_api_key.Index(index_name)
        
        # Fetch the vector and metadata for the player
        # Using more defensive coding to handle different response structures
        response = index.fetch(ids=[player_id])
        
        # Print response structure to debug
        print(f"Response type: {type(response)}")
        print(f"Response: {response}")
        
        # Handle different Pinecone client versions
        try:
            # First attempt - if response is an object with vectors attribute
            if hasattr(response, 'vectors'):
                vectors = response.vectors
                # Check if vectors is a dictionary with our player_id
                if isinstance(vectors, dict) and player_id in vectors:
                    vector_data = vectors[player_id]
                    
                    # Extract metadata and values based on structure
                    if hasattr(vector_data, 'metadata'):
                        metadata = vector_data.metadata
                    elif isinstance(vector_data, dict) and 'metadata' in vector_data:
                        metadata = vector_data['metadata']
                    else:
                        metadata = {}
                        
                    if hasattr(vector_data, 'values'):
                        values = vector_data.values
                    elif isinstance(vector_data, dict) and 'values' in vector_data:
                        values = vector_data['values']
                    else:
                        values = []
                        
                    player_data = {
                        'id': player_id,
                        'metadata': metadata,
                        'vector': values
                    }
                    return player_data
            
            # Second attempt - if response is a dictionary with 'vectors' key
            elif isinstance(response, dict) and 'vectors' in response:
                vectors = response['vectors']
                if isinstance(vectors, dict) and player_id in vectors:
                    vector_data = vectors[player_id]
                    
                    metadata = vector_data.get('metadata', {})
                    values = vector_data.get('values', [])
                    
                    player_data = {
                        'id': player_id,
                        'metadata': metadata,
                        'vector': values
                    }
                    return player_data
                
            # Third attempt - if the response itself contains the data directly
            elif isinstance(response, dict) and player_id in response:
                vector_data = response[player_id]
                
                metadata = vector_data.get('metadata', {})
                values = vector_data.get('values', [])
                
                player_data = {
                    'id': player_id,
                    'metadata': metadata,
                    'vector': values
                }
                return player_data
                
            # If we can't find the player data in any expected format
            print(f"Player with ID {player_id} not found in response")
            return None
                
        except Exception as inner_e:
            print(f"Error parsing response: {str(inner_e)}")
            # As a fallback, return the raw response
            return {
                'id': player_id,
                'raw_response': str(response)
            }
            
    except Exception as e:
        print(f"Error retrieving player data: {str(e)}")
        return None

def player_data_to_json(player_data: Dict[str, Any]) -> str:
    """
    Convert player data to JSON string.
    
    Args:
        player_data: Dictionary containing player data
        
    Returns:
        JSON string representation of player data
    """
    return json.dumps(player_data, indent=2)

def main():
    # Configuration
    INDEX_NAME = "cricket-stats"
    PLAYER_ID = "Shardul Thakur"
    
    # Get player data
    # player_data = get_player_data(INDEX_NAME, PLAYER_ID)

    # Get Pinecone credentials
    pinecone_api_key = Pinecone(api_key="")
    # pinecone_environment = "llama-text-embed-v2-index"
    pinecone_index_name = "cricket-stats"

    # Connect to the Pinecone index
    index = pinecone_api_key.Index(pinecone_index_name)

    results = index.query(
    namespace="default", 
    query={
        "inputs": {"text": PLAYER_ID}, 
        "top_k": 10
    }
    )

    print(results)
    


if __name__ == "__main__":
    main()