"""Convert notebook/train_activity_model.py (# %% cells) into an executed Jupyter notebook.

Usage (from the repo's notebook/ folder):  python ../tools/make_notebook.py
No Jupyter install needed; outputs (printed text, tables, charts) are embedded in the .ipynb.
"""
import ast, base64, contextlib, io, json, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SRC, DST = "train_activity_model.py", "train_activity_model.ipynb"

def split_cells(text):
    cells, cur, kind = [], [], "code"
    for line in text.splitlines():
        if line.startswith("# %%"):
            if any(l.strip() for l in cur):
                cells.append((kind, cur))
            kind = "markdown" if "[markdown]" in line else "code"
            cur = []
        else:
            cur.append(line[2:] if kind == "markdown" and line.startswith("# ") else ("" if kind == "markdown" and line == "#" else line))
    if any(l.strip() for l in cur):
        cells.append((kind, cur))
    return cells

def lines(src):
    src = "\n".join(src).strip("\n").split("\n")
    return [l + "\n" for l in src[:-1]] + [src[-1]]

ns = {"__name__": "__main__"}
nb_cells, count = [], 0
for kind, src in split_cells(open(SRC).read()):
    if kind == "markdown":
        nb_cells.append({"cell_type": "markdown", "metadata": {}, "source": lines(src)})
        continue
    count += 1
    code = "\n".join(src).strip("\n")
    outputs, buf = [], io.StringIO()
    tree = ast.parse(code)
    last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
    plt.show = lambda *a, **k: None
    with contextlib.redirect_stdout(buf):
        exec(compile(tree, "<cell>", "exec"), ns)
        value = eval(compile(ast.Expression(last.value), "<cell>", "eval"), ns) if last else None
    if buf.getvalue():
        outputs.append({"output_type": "stream", "name": "stdout", "text": buf.getvalue()})
    for num in plt.get_fignums():
        png = io.BytesIO()
        plt.figure(num).savefig(png, format="png", dpi=90, bbox_inches="tight")
        outputs.append({"output_type": "display_data", "metadata": {},
                        "data": {"image/png": base64.b64encode(png.getvalue()).decode(), "text/plain": "<Figure>"}})
    plt.close("all")
    if value is not None:
        data = {"text/plain": repr(value)}
        if hasattr(value, "to_html"):
            data["text/html"] = value.to_html()
        outputs.append({"output_type": "execute_result", "execution_count": count, "metadata": {}, "data": data})
    nb_cells.append({"cell_type": "code", "execution_count": count, "metadata": {}, "outputs": outputs, "source": lines(src)})

nb = {"cells": nb_cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
      "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
json.dump(nb, open(DST, "w"), indent=1)
print("wrote", DST, "with", len(nb_cells), "cells")
