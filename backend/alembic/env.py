from alembic import context

from app.database import make_engine
from app.models import Base
from app.settings import Settings

database_path = context.config.attributes.get("database_path")
if database_path is None:
    database_path = Settings.from_env().database_path
engine = make_engine(database_path)
try:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, render_as_batch=True, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
