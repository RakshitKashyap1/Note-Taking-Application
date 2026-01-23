from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Check if column exists (simple try/except wrapper might be easier or just run it)
        # MySQL specific check or just run it and catch Duplicate column error if needed.
        # But assuming it doesn't exist yet.
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE note ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        print("Migration successful: Added is_pinned column.")
    except Exception as e:
        print(f"Migration failed (maybe column exists?): {e}")
