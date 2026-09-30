"""Build the static website into docs/ (this is what GitHub Pages publishes).

    python tools/build_web.py

docs/ contains: index.html (the home page, pre-rendered), style.css, app.js,
worker.js, web_api.py, foundry.zip (the generator, run in the browser by
Pyodide) and the self-hosted fonts. docs/img/ holds the README pictures and is left alone.
"""
import shutil
import sys
import zipfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from foundry.display import build_shelves          # noqa: E402
from foundry.recipes import RECIPES                # noqa: E402

OUT = ROOT / "docs"
SITE = ROOT / "site"
MAX_ROWS = 200


def main():
    OUT.mkdir(exist_ok=True)      # only this script's own files are (re)written; nothing is deleted

    max_cols = max(len(r.columns) for r in RECIPES.values())
    env = Environment(loader=FileSystemLoader(SITE), autoescape=True)
    html = env.get_template("index.template.html").render(
        shelves=build_shelves(), max_rows=MAX_ROWS, max_cols=max_cols, themes=sorted(RECIPES))
    (OUT / "index.html").write_text(html, encoding="utf-8")

    css = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
    (OUT / "style.css").write_text(css + (SITE / "extra.css").read_text(encoding="utf-8"), encoding="utf-8")
    for name in ("app.js", "worker.js", "web_api.py"):
        shutil.copy(SITE / name, OUT / name)
    shutil.copytree(ROOT / "static" / "fonts", OUT / "fonts", dirs_exist_ok=True)
    (OUT / ".nojekyll").write_text("")

    with zipfile.ZipFile(OUT / "foundry.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for path in sorted((ROOT / "foundry").rglob("*.py")):
            if path.name == "validate.py":          # needs scipy; not used by the site
                continue
            z.write(path, path.relative_to(ROOT).as_posix())

    print(f"Built {OUT}  ({sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file()) // 1024} KB)")


if __name__ == "__main__":
    main()
