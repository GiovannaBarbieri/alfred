from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://analise_horas:analise_horas@db:5432/analise_horas"
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    import_session_retention_days: int = 7
    sqlserver_driver: str = "ODBC Driver 18 for SQL Server"
    sqlserver_host: str | None = None
    sqlserver_port: int = 1433
    sqlserver_database: str | None = None
    sqlserver_user: str | None = None
    sqlserver_password: str | None = None
    sqlserver_encrypt: bool = True
    sqlserver_trust_cert: bool = True
    sqlserver_connection_timeout_seconds: int = 10
    sqlserver_query_timeout_seconds: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


settings = Settings()
