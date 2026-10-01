"""The bridge between the web page and the generator, running inside Pyodide.

The page sends plain settings; this returns plain data (JSON text, CSV text or
xlsx bytes). It uses exactly the same engine as the downloadable app.
"""
import io
import json
from datetime import date

import pandas as pd

from foundry.core import generate
from foundry.display import FAMILY_HUES, family_of, fmt, slug
from foundry.faults import make_messy, summarise


def _run(theme, rows, cols, seed, d):
    return generate(int(rows), int(cols), seed=int(seed), theme=theme,
                    snapshot=date.fromisoformat(d))


def _table(theme, rows, cols, seed, d, messy):
    """The table to show or download, and (when messy) its answer key."""
    result = _run(theme, rows, cols, seed, d)
    if int(messy):
        table, key = make_messy(result.df, result.seed)
        return result, table, key
    return result, result.df, None


def _cell(value):
    if value is None:
        return ""
    return value if isinstance(value, str) else fmt(value)


def make_table(theme, rows, cols, seed, d, messy=0):
    result, df, key = _table(theme, rows, cols, seed, d, messy)
    clean, recipe = result.df, result.recipe
    family = family_of(recipe.key)
    tag = "_messy" if key is not None else ""
    stem = f"{slug(recipe.title)}_seed{int(result.seed)}{tag}"
    return json.dumps({
        "key": recipe.key,
        "title": recipe.title,
        "row_meaning": recipe.row_meaning,
        "hue": FAMILY_HUES[family],
        "note": result.column_note or "",
        "cols": [str(c) for c in df.columns],
        "numeric": [bool(pd.api.types.is_numeric_dtype(clean[c]) and not pd.api.types.is_bool_dtype(clean[c]))
                    for c in clean.columns],
        "rows": [[_cell(v) for v in row] for row in df.itertuples(index=False)],
        "docs": [[c, recipe.docs.get(c, "")] for c in clean.columns],
        "seed": int(result.seed),
        "n_rows": len(clean),
        "n_shown": len(df),
        "n_cols": len(clean.columns),
        "min_cols": len(recipe.core),
        "max_cols": len(recipe.core) + len(recipe.priority),
        "date": result.snapshot.date().isoformat(),
        "messy": key is not None,
        "problems": 0 if key is None else len(key),
        "problem_counts": {} if key is None else summarise(key),
        "csv_name": f"{stem}.csv",
        "xlsx_name": f"{stem}.xlsx",
        "key_name": f"{stem}_answer_key.csv",
    })


def make_csv(theme, rows, cols, seed, d, messy=0):
    return _table(theme, rows, cols, seed, d, messy)[1].to_csv(index=False)


def make_key(theme, rows, cols, seed, d, messy=1):
    return _table(theme, rows, cols, seed, d, 1)[2].to_csv(index=False)


def make_xlsx(theme, rows, cols, seed, d, messy=0):
    buffer = io.BytesIO()
    _table(theme, rows, cols, seed, d, messy)[1].to_excel(buffer, index=False, engine="openpyxl")
    return buffer.getvalue()
