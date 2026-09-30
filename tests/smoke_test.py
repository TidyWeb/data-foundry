"""Checks every subject through the same engine the website runs.

Run from the project folder:   python tests/smoke_test.py
"""
import io
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from foundry.core import generate  # noqa: E402
from foundry.recipes import RECIPES  # noqa: E402

problems = []


def expect(ok, message):
    if not ok:
        problems.append(message)
        print("FAIL", message)


snapshot = date(2026, 1, 1)
for key in sorted(RECIPES):
    for cols in (1, 6, 99):
        a = generate(200, cols, seed=42, theme=key, snapshot=snapshot)
        b = generate(200, cols, seed=42, theme=key, snapshot=snapshot)
        c = generate(200, cols, seed=43, theme=key, snapshot=snapshot)
        expect(len(a.df) == 200, f"{key} cols={cols}: expected 200 rows, got {len(a.df)}")
        r = RECIPES[key]
        lo, hi = len(r.core), len(r.core) + len(r.priority)
        expect(len(a.df.columns) == min(max(cols, lo), hi), f"{key} cols={cols}: bad column count")
        expect(a.df.equals(b.df), f"{key} cols={cols}: same seed gave different tables")
        expect(not a.df.equals(c.df), f"{key} cols={cols}: different seeds gave the same table")
    df = generate(200, 99, seed=42, theme=key, snapshot=snapshot).df
    csv = df.to_csv(index=False)
    expect(pd.read_csv(io.StringIO(csv)).shape == df.shape, f"{key}: CSV round trip changed the shape")
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False, engine="openpyxl")
    expect(buffer.getvalue()[:2] == b"PK", f"{key}: Excel file is not a valid xlsx")

print(f"subjects: {len(RECIPES)} | problems: {len(problems)}")
sys.exit(1 if problems else 0)
