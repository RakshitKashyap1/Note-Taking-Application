# NoteTaker - Premium Note Taking App

A beautiful, feature-rich note taking application built with Flask and MySQL, designed with a premium glassmorphism aesthetic.

## Features

- **Notes Management**: Create, Read, Update, and Delete notes.
- **Organization**: Organize notes with tags.
- **Search**: Real-time search by title, content, or tags.
- **Authentication**: Secure user registration and login.
- **Premium Design**: Modern glassmorphism UI with dynamic animations and dark mode.

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: MySQL (via SQLAlchemy)
- **Frontend**: HTML5, Vanilla CSS3, JavaScript (Fetch API)
- **Authentication**: Flask-Login, Bcrypt

## Setup Instructions

1. **Clone the repository**
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure Database**:
   - Create a MySQL database (e.g., `notes_app_db`).
   - Copy `.env.example` to `.env` and update the `DATABASE_URL` with your MySQL credentials.
   ```
   DATABASE_URL=mysql+mysqlconnector://user:password@localhost/notes_app_db
   ```
4. **Run the Application**:
   ```bash
   python run.py
   ```
5. **Access**:
   Open `http://localhost:5000` in your browser.

## Project Structure

- `app/`: Application source code.
  - `routes/`: API and View routes.
  - `models.py`: Database models.
  - `static/`: CSS and JS assets.
  - `templates/`: HTML templates.
- `config.py`: Configuration settings.
- `run.py`: Entry point.
