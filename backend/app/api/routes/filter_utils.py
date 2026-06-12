from datetime import date


def build_filter_clause(
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    user: str | None = None,
    epic_id: str | None = None,
    category: str | None = None,
    import_id: int | None = None,
) -> tuple[str, list]:
    clauses: list[str] = []
    params: list = []

    if start_date:
        clauses.append("DATE(l.data_hora_cadastro) >= %s")
        params.append(start_date)

    if end_date:
        clauses.append("DATE(l.data_hora_cadastro) <= %s")
        params.append(end_date)

    if user:
        clauses.append("l.login_usuario = %s")
        params.append(user)

    if epic_id:
        clauses.append("l.id_epic = %s")
        params.append(epic_id)

    if category:
        clauses.append("c.nome = %s")
        params.append(category)

    if import_id:
        clauses.append("l.importacao_id = %s")
        params.append(import_id)

    if not clauses:
        return "", params

    return f"WHERE {' AND '.join(clauses)}", params
