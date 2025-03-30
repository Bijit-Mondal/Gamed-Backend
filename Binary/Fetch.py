import pymongo

def fetch_data_from_mongodb():
    """
    Connects to MongoDB, fetches data from a specified collection, and returns it.

    Returns:
        list: A list of documents fetched from the MongoDB collection.
    """
    try:
        # Replace with your MongoDB connection string
        CONNECTION_STRING = ""
        
        # Connect to MongoDB
        client = pymongo.MongoClient(CONNECTION_STRING)
        # Access the database and collection
        db = client["cricket"]  # Replace with your database name
        collection = db["players"]  # Replace with your collection name
        
        # Fetch all documents from the collection
        documents = collection.find()  # Retrieves all documents
        
        # Convert documents to a list for easier processing
        data_list = [doc for doc in documents]
        
        return data_list
    
    except pymongo.errors.ConnectionFailure as e:
        print(f"Could not connect to MongoDB: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

# Example usage
if __name__ == "__main__":
    data = fetch_data_from_mongodb()
    if data:
        print(f"Fetched {len(data)} documents.")
    else:
        print("No data found or an error occurred.")
