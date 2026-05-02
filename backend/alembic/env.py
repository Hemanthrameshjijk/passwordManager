# import os
# from logging.config import fileConfig

# from sqlalchemy import engine_from_config
# from sqlalchemy import pool

# from alembic import context

# from app.database import Base
# import app.models as models

# config = context.config
# fileConfig(config.config_file_name)

# database_url = os.getenv("DATABASE_URL")
# if database_url:
#     config.set_main_option("sqlalchemy.url", database_url)

# target_metadata = Base.metadata


# def run_migrations_offline():
#     url = config.get_main_option("sqlalchemy.url")
#     context.configure(url=url, target_metadata=target_metadata, literal_binds=True)

#     with context.begin_transaction():
#         context.run_migrations()


# def run_migrations_online():
#     connectable = engine_from_config(
#         config.get_section(config.config_ini_section),
#         prefix="sqlalchemy.",
#         poolclass=pool.NullPool,
#     )

#     with connectable.connect() as connection:
#         context.configure(connection=connection, target_metadata=target_metadata)

#         with context.begin_transaction():
#             context.run_migrations()


# if context.is_offline_mode():
#     run_migrations_offline()
# else:
#     run_migrations_online()
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.database import Base
import app.models  # ensure models are imported

# Alembic Config
config = context.config
fileConfig(config.config_file_name)

# 🔥 Spring-style fallback logic (Python version)
DB_URL = os.getenv("DB_URL", "postgresql://postgres:postgres@34.93.203.126:5432/whatsappai")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")

# Optional full override
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    FINAL_DB_URL = DATABASE_URL
else:
    # If someone accidentally uses JDBC → fix it
    FINAL_DB_URL = DB_URL.replace("jdbc:", "")

# ✅ Set final URL for Alembic
config.set_main_option("sqlalchemy.url", FINAL_DB_URL)

# Metadata
target_metadata = Base.metadata


# ─────────────────────────────────────────
# OFFLINE MODE
# ─────────────────────────────────────────
def run_migrations_offline():
    context.configure(
        url=FINAL_DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True
    )

    with context.begin_transaction():
        context.run_migrations()


# ─────────────────────────────────────────
# ONLINE MODE
# ─────────────────────────────────────────
def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=FINAL_DB_URL  # 🔥 force correct DB URL
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True
        )

        with context.begin_transaction():
            context.run_migrations()


# ─────────────────────────────────────────
# RUN
# ─────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()