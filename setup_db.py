import mysql.connector
import urllib.parse
import os

# Credentials provided by user
user = "root"
password = "Rakshit@175"
host = "localhost"
database = "notes_app_db"

def setup():
    try:
        # Connect to MySQL Server (without DB)
        print(f"Connecting to MySQL as {user}...")
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password
        )
        cursor = conn.cursor()
        
        # Create Database
        print(f"Creating database '{database}' if it doesn't exist...")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {database}")
        print("Database created or already exists.")
        
        cursor.close()
        conn.close()
        
        # Generate .env file with URL encoded password to handle special chars like '@'
        encoded_password = urllib.parse.quote_plus(password)
        db_url = f"mysql+mysqlconnector://{user}:{encoded_password}@{host}/{database}"
        
        print(f"Updating .env with DATABASE_URL...")
        with open('.env', 'w') as f:
            f.write(f"SECRET_KEY=your_secret_key_here_change_in_prod\n")
            f.write(f"DATABASE_URL={db_url}\n")
            
        print("Setup complete. You can now run the application.")
        
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        print("Please check if MySQL is running and the password is correct.")

if __name__ == "__main__":
    setup()
