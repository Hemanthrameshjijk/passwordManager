from app.database import engine
from sqlalchemy import text

print(f"Engine URL: {engine.url}")
with engine.connect() as conn:
    try:
        res = conn.execute(text("SELECT count(*) FROM users"))
        count = res.scalar()
        print(f"SUCCESS: Found {count} users in the database.")
        
        res = conn.execute(text("SELECT email FROM users"))
        emails = [row[0] for row in res]
        print(f"Emails: {emails}")
    except Exception as e:
        print(f"ERROR: {e}")
