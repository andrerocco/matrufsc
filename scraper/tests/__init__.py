import os
import sys

_HERE = os.path.dirname(__file__)
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
for _path in (_SRC, _HERE):
    if _path not in sys.path:
        sys.path.insert(0, _path)
