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


def _run(theme, rows, cols, seed, d):
    return generate(int(rows), int(cols), seed=int(seed), theme=theme,
                    snapshot=date.fromisoformat(d))


def make_table(theme, rows, cols, seed, d):
    result = _run(theme, rows, cols, seed, d)
    df, recipe = result.df, result.recipe
    family = family_of(recipe.key)
    return json.dumps({
        "key": recipe.key,
        "title": recipe.title,
        "row_meaning": recipe.row_meaning,
        "hue": FAMILY_HUES[family],
        "note": result.column_note or "",
        "cols": list(df.columns),
        "numeric": [bool(pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c]))
                    for c in df.columns],
        "rows": [[fmt(v) for v in row] for row in df.itertuples(index=False)],
        "docs": [[c, recipe.docs.get(c, "")] for c in df.columns],
        "seed": int(result.seed),
        "n_rows": len(df),
        "n_cols": len(df.columns),
        "min_cols": len(recipe.core),
        "max_cols": len(recipe.core) + len(recipe.priority),
        "date": result.snapshot.date().isoformat(),
        "csv_name": f"{slug(recipe.title)}_seed{int(result.seed)}.csv",
        "xlsx_name": f"{slug(recipe.title)}_seed{int(result.seed)}.xlsx",
    })


def make_csv(theme, rows, cols, seed, d):
    return _run(theme, rows, cols, seed, d).df.to_csv(index=False)


def make_xlsx(theme, rows, cols, seed, d):
    buffer = io.BytesIO()
    _run(theme, rows, cols, seed, d).df.to_excel(buffer, index=False, engine="openpyxl")
    return buffer.getvalue()
