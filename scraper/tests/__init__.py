"""Bootstrap: coloca `scraper/src` no path para os testes importarem os
módulos do scraper (parse_turmas, gate, semesters) como o main.py faz (flat)."""

import os
import sys

_HERE = os.path.dirname(__file__)
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
for _path in (_SRC, _HERE):
    if _path not in sys.path:
        sys.path.insert(0, _path)
