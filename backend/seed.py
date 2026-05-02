from sqlalchemy.orm import Session
from . import models, auth, database

def seed():
    db = database.SessionLocal()
    try:
        # Check if user exists
        test_email = "test@example.com"
        db_user = db.query(models.User).filter(models.User.email == test_email).first()
        
        if not db_user:
            print(f"Creating test user: {test_email}")
            hashed_pass = auth.get_password_hash("password123")
            db_user = models.User(email=test_email, password_hash=hashed_pass)
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        
        # Add a test vault item
        print("Adding test vault items...")
        test_items = [
            {
                "title": "Google",
                "url": "https://accounts.google.com",
                "encrypted_data": "test_user:test_pass_123"
            },
            {
                "title": "GitHub",
                "url": "https://github.com/login",
                "encrypted_data": "dev_coder:super_secret_github"
            }
        ]
        
        for item in test_items:
            existing = db.query(models.VaultItem).filter(
                models.VaultItem.user_id == db_user.id,
                models.VaultItem.title == item["title"]
            ).first()
            if not existing:
                new_item = models.VaultItem(**item, user_id=db_user.id)
                db.add(new_item)
        
        db.commit()
        print("Seeding complete!")
        print(f"Login with: {test_email} / password123")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
