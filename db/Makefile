DATA_DIR = ../matrufsc/public/data

%:
	cd src && uv run python get_turmas.py $@
	cd src && uv run python parse_turmas.py ../$(DATA_DIR) $@_*.xml
	rm -f src/$@_*.xml
	cd src && uv run python gen_index.py ../$(DATA_DIR)
